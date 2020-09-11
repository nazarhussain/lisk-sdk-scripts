import 'jest-extended';
import { Application } from 'lisk-sdk';
import { objects } from '@liskhq/lisk-utils';
import { rmdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createGenesisBlock } from '@liskhq/lisk-genesis';
import { api } from '../../utils/api';
import * as genesisBlockJSON from '../../config/devnet/genesis_block.json';
import { genesisBlockFromJSON, genesisBlockToJSON } from '../../utils/blocks';
import { createApplication } from '../../utils/application';
import {
	generateRandomAccount,
	getAccount,
	getGenesisKeyPairByAddress,
	buildAccount,
} from '../../utils/accounts';
import { defaultAccountModules } from '../../utils/schema';
import { waitForBlock } from '../../utils/network';
import { castVotes } from '../../utils/test';
import { convertLSKToBeddows } from '../../utils/transactions';

const appLabel = 'my-dpos-test-app';
const dataPath = join(homedir(), '.lisk', appLabel);

describe('DPOS Module', () => {
	let app: Application | undefined;
	let exitMock: jest.SpyInstance;
	const appConfig = { label: appLabel };

	beforeEach(() => {
		exitMock = jest.spyOn(process, 'exit').mockImplementation(jest.fn() as never);
		if (existsSync(dataPath)) {
			rmdirSync(dataPath, { recursive: true });
		}
	});

	afterEach(async () => {
		if (app) {
			await app.shutdown();
			app = undefined;
		}
		exitMock.mockRestore();
	});

	describe('When genesis block initDelegates contains more delegates than round length', () => {
		it('Genesis block should be rejected', async () => {
			const genesisBlock = genesisBlockFromJSON(genesisBlockJSON);
			const updatedGenesisBlock = createGenesisBlock({
				accountAssetSchemas: defaultAccountModules,
				accounts: genesisBlock.header.asset.accounts,
				initDelegates: [
					...genesisBlock.header.asset.initDelegates,
					generateRandomAccount().address,
				],
				roundLength: 103,
			});

			app = createApplication({
				genesisBlock: genesisBlockToJSON(updatedGenesisBlock as any),
				config: appConfig,
			});

			await expect(app.run()).rejects.toThrow(
				'Genesis block init delegates list is larger than allowed delegates per round',
			);
		});
	});

	describe('When genesis block initDelegates contains an address which is not a delegate account', () => {
		it('Genesis block should be rejected', async () => {
			const genesisBlock = genesisBlockFromJSON(genesisBlockJSON);
			const nonDelegateAccount = generateRandomAccount();
			const initDelegates = [...genesisBlock.header.asset.initDelegates];
			const accounts = [...genesisBlock.header.asset.accounts];

			initDelegates.splice(0, 1);
			initDelegates.push(nonDelegateAccount.address);
			accounts.push({ address: nonDelegateAccount.address });

			const updatedGenesisBlock = createGenesisBlock({
				accountAssetSchemas: defaultAccountModules,
				initDelegates,
				accounts,
				roundLength: 103,
			});

			app = createApplication({
				genesisBlock: genesisBlockToJSON(updatedGenesisBlock as any),
				config: appConfig,
			});

			await expect(app.run()).rejects.toThrow(
				'Genesis block init delegates list contain addresses which are not delegates',
			);
		});
	});

	describe('When genesis block is accepted', () => {
		it('should register all usernames for delegate accounts', async () => {
			const allDelegates = genesisBlockJSON.header.asset.accounts
				.filter(d => d.dpos.delegate.username !== '')
				.map(d => ({
					address: d.address,
					username: d.dpos.delegate.username,
				}));

			app = createApplication({
				genesisBlock: genesisBlockJSON,
				config: appConfig,
			});

			await app.run();
			const delegates = (await api.http.delegates.delegatesGet(150)).data;

			expect(delegates).toHaveLength(103);
			expect(
				delegates.map(d => ({ address: d.address, username: d.dpos.delegate.username })),
			).toEqual(allDelegates);
		});
	});

	describe('During bootstrap period', () => {
		let initDelegates: Buffer[];
		const roundLength = 5;

		beforeEach(async () => {
			const genesisBlock = genesisBlockFromJSON(genesisBlockJSON);
			initDelegates = genesisBlock.header.asset.initDelegates.slice(0, roundLength);

			const updatedGenesisBlock = createGenesisBlock({
				accountAssetSchemas: defaultAccountModules,
				initDelegates,
				accounts: genesisBlock.header.asset.accounts,
				initRounds: 50,
				roundLength,
			});

			app = createApplication({
				genesisBlock: genesisBlockToJSON(updatedGenesisBlock as any),
				config: {
					...appConfig,
					genesisConfig: { blockTime: 3, activeDelegates: 3, standbyDelegates: 2 },
					forging: { waitThreshold: 1 },
				},
			});

			await app.run();
		});

		it('it should not update the consecutiveMissedBlocks if its missed', async () => {
			const delegateAddress = initDelegates[0];
			const { password } = getGenesisKeyPairByAddress(delegateAddress.toString('hex'));
			const delegateAccount = await getAccount(delegateAddress);

			// Make this delegate miss a block
			await api.forger.forging.forgingPatch({
				address: delegateAddress.toString('hex'),
				password,
				forging: false,
			});

			// Let's wait for 2 rounds
			await waitForBlock({ heightOffset: roundLength * 2, delay: 1000 });

			const delegateAccountUpdated = await getAccount(delegateAddress);

			expect(delegateAccount.dpos.delegate.consecutiveMissedBlocks).toEqual(0);
			expect(delegateAccountUpdated.dpos.delegate.consecutiveMissedBlocks).toEqual(0);
		});

		it('it should not update the lastForgedHeight', async () => {
			const delegateAddress = initDelegates[0];
			const { password } = getGenesisKeyPairByAddress(delegateAddress.toString('hex'));
			const delegateAccount = await getAccount(delegateAddress);

			// Make this delegate miss a block
			await api.forger.forging.forgingPatch({
				address: delegateAddress.toString('hex'),
				password,
				forging: true,
			});

			// Let's wait for 2 rounds
			await waitForBlock({ heightOffset: roundLength * 2, delay: 1000 });

			const delegateAccountUpdated = await getAccount(delegateAddress);

			expect(delegateAccount.dpos.delegate.lastForgedHeight).toEqual(0);
			expect(delegateAccountUpdated.dpos.delegate.lastForgedHeight).toEqual(0);
		});
	});

	describe('After bootstrap period', () => {
		let initDelegates: Buffer[];
		const roundLength = 5;
		const initRounds = 3; // It can't be lower than 3
		const bootstrapLastHeight = initRounds * roundLength;

		beforeEach(async () => {
			const genesisBlock = genesisBlockFromJSON(genesisBlockJSON);
			initDelegates = genesisBlock.header.asset.initDelegates.slice(0, roundLength);

			const updatedGenesisBlock = createGenesisBlock({
				accountAssetSchemas: defaultAccountModules,
				initDelegates,
				accounts: genesisBlock.header.asset.accounts,
				initRounds,
				roundLength,
			});

			app = createApplication({
				genesisBlock: genesisBlockToJSON(updatedGenesisBlock as any),
				config: {
					...appConfig,
					genesisConfig: { blockTime: 3, activeDelegates: 3, standbyDelegates: 2 },
					forging: { waitThreshold: 1 },
				},
			});

			await app.run();

			// Let's pass the bootstrap period
			await waitForBlock({ height: roundLength * initRounds, delay: 1000 });
		});

		it('should update the consecutiveMissedBlocks if missed the block', async () => {
			const delegateAddress = initDelegates[0];
			const { password } = getGenesisKeyPairByAddress(delegateAddress.toString('hex'));
			const delegateAccount = await getAccount(delegateAddress);

			// Make this delegate miss a block
			await api.forger.forging.forgingPatch({
				address: delegateAddress.toString('hex'),
				password,
				forging: false,
			});

			// Let's wait for 2 rounds
			await waitForBlock({ heightOffset: roundLength * 2, delay: 1000 });

			const delegateAccountUpdated = await getAccount(delegateAddress);

			expect(delegateAccount.dpos.delegate.consecutiveMissedBlocks).toEqual(0);
			expect(delegateAccountUpdated.dpos.delegate.consecutiveMissedBlocks).toEqual(2);
		});

		it('should update the lastForgedHeight and reset consecutiveMissedBlocks if forge the block', async () => {
			const delegateAddress = initDelegates[0];
			const { password } = getGenesisKeyPairByAddress(delegateAddress.toString('hex'));
			const delegateAccount = await getAccount(delegateAddress);

			// Make this delegate miss a block
			await api.forger.forging.forgingPatch({
				address: delegateAddress.toString('hex'),
				password,
				forging: true,
			});

			// Let's wait for 2 rounds
			await waitForBlock({ heightOffset: roundLength * 2, delay: 1000 });

			const delegateAccountUpdated = await getAccount(delegateAddress);

			expect(delegateAccountUpdated.dpos.delegate.lastForgedHeight).toBeGreaterThan(
				delegateAccount.dpos.delegate.lastForgedHeight,
			);

			expect(delegateAccountUpdated.dpos.delegate.consecutiveMissedBlocks).toEqual(0);
		});

		// For this test change values of MAX_CONSECUTIVE_MISSED_BLOCKS and MAX_LAST_FORGED_HEIGHT_DIFF to mentioned below
		describe('When delegate missed MAX_CONSECUTIVE_MISSED_BLOCKS[50] consecutive block and forged in last MAX_LAST_FORGED_HEIGHT_DIFF[260000]', () => {
			const MAX_CONSECUTIVE_MISSED_BLOCKS = 2; // If no one else misses then it implies 2 rounds
			const MAX_LAST_FORGED_HEIGHT_DIFF = roundLength * 5; // It forges any block in last 5 rounds

			it('should not be banned', async () => {
				const delegateAddress = initDelegates[0].toString('hex');
				const { password } = getGenesisKeyPairByAddress(delegateAddress);
				// Let the delegate forge the block for two rounds
				await waitForBlock({ height: bootstrapLastHeight + roundLength * 2 });

				// Disable the forging
				await api.forger.forging.forgingPatch({
					address: delegateAddress,
					forging: false,
					password,
				});

				// Let the delegate misses the block for more rounds than MAX_CONSECUTIVE_MISSED_BLOCKS
				await waitForBlock({
					height: bootstrapLastHeight + MAX_LAST_FORGED_HEIGHT_DIFF - 1,
					delay: 1000,
				});

				const delegateAccount = await getAccount(initDelegates[0]);

				expect(delegateAccount.dpos.delegate.consecutiveMissedBlocks).toEqual(
					MAX_CONSECUTIVE_MISSED_BLOCKS + 1,
				);
				expect(delegateAccount.dpos.delegate.isBanned).toEqual(false);
			});
		});

		// For this test change values of MAX_CONSECUTIVE_MISSED_BLOCKS and MAX_LAST_FORGED_HEIGHT_DIFF to mentioned below
		describe('When delegate missed MAX_CONSECUTIVE_MISSED_BLOCKS[50] consecutive block and not forged in last MAX_LAST_FORGED_HEIGHT_DIFF[260000]', () => {
			const MAX_CONSECUTIVE_MISSED_BLOCKS = 2; // If no one else misses then it implies 2 rounds
			const MAX_LAST_FORGED_HEIGHT_DIFF = roundLength * 5; // It forges any block in last 5 rounds

			it('should be banned', async () => {
				const delegateAddress = initDelegates[0].toString('hex');
				const { password } = getGenesisKeyPairByAddress(delegateAddress);

				// Disable the forging
				await api.forger.forging.forgingPatch({
					address: delegateAddress,
					forging: false,
					password,
				});

				// Let the delegate misses the block for more rounds than MAX_CONSECUTIVE_MISSED_BLOCKS
				await waitForBlock({
					height: bootstrapLastHeight + MAX_LAST_FORGED_HEIGHT_DIFF - 1,
					delay: 1000,
				});

				const delegateAccount = await getAccount(initDelegates[0]);

				expect(delegateAccount.dpos.delegate.consecutiveMissedBlocks).toBeGreaterThan(
					MAX_CONSECUTIVE_MISSED_BLOCKS,
				);
				expect(delegateAccount.dpos.delegate.consecutiveMissedBlocks).toEqual(5);	// As we disabled forging for 5 rounds
				expect(delegateAccount.dpos.delegate.isBanned).toEqual(true);
			});
		});
	});

	describe('After bootstrap period when its last block of round', () => {
		let initDelegates: Buffer[];
		const roundLength = 5;
		const initRounds = 3; // It can't be lower than 3

		it('should update 2 standby delegates and remaining active delegates', async () => {
			const genesisBlock = genesisBlockFromJSON(genesisBlockJSON);
			initDelegates = genesisBlock.header.asset.initDelegates.slice(0, roundLength);

			// As per mainnet scenario, need to reset totalVotesReceived for all accounts to zero
			const accounts = genesisBlock.header.asset.accounts.map(a =>
				objects.mergeDeep({}, a, {
					// Make all very rich
					token: { balance: BigInt(convertLSKToBeddows('10000000')) },
					dpos: { delegate: { totalVotesReceived: BigInt(0) }, sentVotes: [] },
				}),
			);

			const updatedGenesisBlock = createGenesisBlock({
				accountAssetSchemas: defaultAccountModules,
				initDelegates,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				accounts: accounts as any,
				initRounds,
				roundLength,
			});

			app = createApplication({
				genesisBlock: genesisBlockToJSON(updatedGenesisBlock as any),
				config: {
					...appConfig,
					genesisConfig: {
						blockTime: 3,
						communityIdentifier: 'MyToken',
						activeDelegates: 3,
						standbyDelegates: 2,
					},
					forging: { waitThreshold: 1 },
				},
			});

			await app.run();

			const networkIdentifier = Buffer.from(
				(await api.http.node.nodeInfoGet()).data.networkIdentifier,
				'hex',
			);

			// Let's vote for 5 random delegates which are not in the initDelegate list
			const voter = await buildAccount({ balance: '10000', networkIdentifier });
			await waitForBlock({ heightOffset: 1 });
			const votedDelegates = genesisBlock.header.asset.initDelegates.slice(-3);
			// Do the self votes so next vote transaction can have impact
			for (const delegateAddress of votedDelegates) {
				const delegateAccount = accounts.find(a => (a.address as Buffer).equals(delegateAddress));
				const { passphrase } = getGenesisKeyPairByAddress(delegateAddress.toString('hex'));
				await castVotes({
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					voter: { ...delegateAccount, passphrase } as any,
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					delegates: [delegateAccount as any],
					fixedAmount: '100',
					networkIdentifier,
				});
			}
			await castVotes({
				voter,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				delegates: votedDelegates.map(d => ({ address: d })).slice(0, 3) as any,
				fixedAmount: '100',
				networkIdentifier,
			});
			await waitForBlock({ heightOffset: 1 });

			// After voting, now wait till second last block of bootstrap period
			await waitForBlock({ height: initRounds * roundLength - 1, delay: 1000 });

			const forgersListBeforeBootstrapPeriod = (await api.http.delegates.forgersGet()).data.map(
				d => d.address,
			);
			await waitForBlock({ height: initRounds * roundLength });
			const forgersListAfterBootstrapPeriod = (await api.http.delegates.forgersGet()).data.map(
				d => d.address,
			);

			const votedDelegatesAddresses = votedDelegates.map(d => d.toString('hex'));
			const initDelegatesAddresses = initDelegates.map(d => d.toString('hex'));

			expect(forgersListBeforeBootstrapPeriod).toIncludeSameMembers(initDelegatesAddresses);
			expect(forgersListAfterBootstrapPeriod).toHaveLength(roundLength);
			expect(forgersListBeforeBootstrapPeriod).not.toIncludeAnyMembers(votedDelegatesAddresses);
			expect(forgersListAfterBootstrapPeriod).toIncludeAllMembers(votedDelegatesAddresses);
			expect(forgersListAfterBootstrapPeriod).toIncludeAllMembers(
				votedDelegatesAddresses.slice(0, 2),
			);
		});
	});
});
