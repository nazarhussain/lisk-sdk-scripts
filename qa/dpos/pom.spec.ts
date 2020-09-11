import 'jest-extended';
import { getRandomBytes } from '@liskhq/lisk-cryptography';
import { AccountSeed } from '../../types';
import {
	buildAccount,
	getGenesisKeyPairByPublicKey,
	generateRandomAccount,
	getAccount,
} from '../../utils/accounts';
import { claimMisbehavior, transferTokens } from '../../utils/test';
import { waitForBlock, getLastBlock } from '../../utils/network';
import { BlockHeaderJSON, AccountJSON } from '../../utils/api';
import { signBlockHeader, blockHeaderFromJSON, BlockHeader } from '../../utils/blocks';
import { convertLSKToBeddows, convertBeddowsToLSK } from '../../utils/transactions';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

const createModifiedBlockHeader = (header: BlockHeader, height: number): BlockHeader => {
	const header2 = { ...header } as Partial<Writeable<BlockHeader>>;
	delete header2.signature;
	header2.height = height;

	const { passphrase } = getGenesisKeyPairByPublicKey(header.generatorPublicKey.toString('hex'));
	header2.signature = signBlockHeader(header2 as BlockHeader, passphrase);

	return header2 as BlockHeader;
};

const createContradictingBlockHeader = (header: BlockHeader): BlockHeader =>
	createModifiedBlockHeader(header, header.height - 5);

describe('DPOS PoM', () => {
	let sender: AccountSeed;
	let nonDelegateAccount: AccountSeed;

	beforeAll(async () => {
		// Create accounts
		sender = await buildAccount({ balance: '1000' });
		await waitForBlock({ heightOffset: 1 });
		nonDelegateAccount = await buildAccount({ balance: '1000' });
		await waitForBlock({ heightOffset: 1 });
		console.info('Account created...');
	});

	describe('PoM with generatorPublicKey are not same', () => {
		it('should fail', async () => {
			const lastBlockHeader = blockHeaderFromJSON((await getLastBlock()).header);
			const newBlockHeader = {
				...lastBlockHeader,
				generatorPublicKey: generateRandomAccount().publicKey,
			};
			createContradictingBlockHeader(blockHeaderFromJSON((await getLastBlock()).header));

			await expect(
				claimMisbehavior({
					account: sender,
					header1: lastBlockHeader,
					header2: newBlockHeader,
					fee: '2',
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'ValidationError: GeneratorPublicKey of each BlockHeader should match.',
						},
					],
				},
			});
		});
	});

	describe('PoM with identical block headers', () => {
		it('should fail', async () => {
			const lastBlockHeader = blockHeaderFromJSON((await getLastBlock()).header);

			await expect(
				claimMisbehavior({
					account: sender,
					header1: lastBlockHeader,
					header2: lastBlockHeader,
					fee: '2',
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Error: BlockHeaders are identical. No contradiction detected.',
						},
					],
				},
			});
		});
	});

	describe('PoM with invalid header signatures for header 2', () => {
		it('should fail', async () => {
			const lastBlockHeaderJSON = (await getLastBlock()).header;
			const lastBlockHeader1 = blockHeaderFromJSON(lastBlockHeaderJSON);
			const lastBlockHeader2 = {
				...createContradictingBlockHeader(blockHeaderFromJSON(lastBlockHeaderJSON)),
				signature: getRandomBytes(lastBlockHeader1.signature.length),
			};

			await expect(
				claimMisbehavior({
					account: sender,
					header1: lastBlockHeader1,
					header2: lastBlockHeader2,
					fee: '2',
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Invalid block signature for header 2.',
						},
					],
				},
			});
		});
	});

	describe('PoM with invalid header signatures for header 1', () => {
		it('should fail', async () => {
			const lastBlockHeaderJSON = (await getLastBlock()).header;
			const lastBlockHeader1 = blockHeaderFromJSON(lastBlockHeaderJSON);
			const lastBlockHeader2 = {
				...createContradictingBlockHeader(blockHeaderFromJSON(lastBlockHeaderJSON)),
				signature: getRandomBytes(lastBlockHeader1.signature.length),
			};

			await expect(
				claimMisbehavior({
					account: sender,
					header1: lastBlockHeader2,
					header2: lastBlockHeader1,
					fee: '2',
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Invalid block signature for header 1.',
						},
					],
				},
			});
		});
	});

	describe('PoM for an account which is not a delegate', () => {
		it('should fail', async () => {
			const lastBlockHeaderJSON = (await getLastBlock()).header;
			const lastBlockHeader1 = {
				...blockHeaderFromJSON(lastBlockHeaderJSON),
				generatorPublicKey: nonDelegateAccount.publicKey,
			};
			const lastBlockHeader2 = {
				...createContradictingBlockHeader(blockHeaderFromJSON(lastBlockHeaderJSON)),
				generatorPublicKey: nonDelegateAccount.publicKey,
			};

			await expect(
				claimMisbehavior({
					account: sender,
					header1: lastBlockHeader2,
					header2: lastBlockHeader1,
					fee: '2',
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Account is not a delegate',
						},
					],
				},
			});
		});
	});

	describe.skip('When sender and delegate are same accounts', () => {
		it('should be ok', async () => {
			const lastBlockHeaderJSON = (await getLastBlock()).header;
			const lastBlockHeader1 = blockHeaderFromJSON(lastBlockHeaderJSON);
			const lastBlockHeader2 = createContradictingBlockHeader(
				blockHeaderFromJSON(lastBlockHeaderJSON),
			);
			const delegate = getGenesisKeyPairByPublicKey(lastBlockHeaderJSON.generatorPublicKey);

			await transferTokens({
				amount: '100',
				recipientAddress: Buffer.from(delegate.address, 'hex'),
			});
			await waitForBlock({ heightOffset: 1 });

			await expect(
				claimMisbehavior({
					account: {
						...delegate,
						publicKey: Buffer.from(delegate.publicKey, 'hex'),
						address: Buffer.from(delegate.address, 'hex'),
						privateKey: Buffer.alloc(0),
						nonce: BigInt(0),
					},
					header1: lastBlockHeader2,
					header2: lastBlockHeader1,
					fee: '2',
				}),
			).resolves.not.toBeUndefined();
		});
	});

	// To test this scenario accurately make sure chain is out of bootstrap period and have some block rewards
	describe('When delegate balance is higher than the last block reward', () => {
		let delegateAccount: AccountJSON;
		let delegateAccountUpdated: AccountJSON;
		let senderAccount: AccountJSON;
		let senderAccountUpdated: AccountJSON;
		let lastPunishedHeight: number;
		let blockReward: bigint;
		let lastBlockHeaderJSON: BlockHeaderJSON;
		let delegateAddress: Buffer;

		beforeAll(async () => {
			lastBlockHeaderJSON = (await getLastBlock()).header;
			delegateAddress = Buffer.from(
				getGenesisKeyPairByPublicKey(lastBlockHeaderJSON.generatorPublicKey).address,
				'hex',
			);
			// Let's transfer some funds to delegate
			await transferTokens({ amount: '100', recipientAddress: delegateAddress });
			await waitForBlock({ heightOffset: 1 });

			delegateAccount = await getAccount(delegateAddress);
			senderAccount = await getAccount(sender.address);

			const lastBlockHeader1 = blockHeaderFromJSON(lastBlockHeaderJSON);
			const lastBlockHeader2 = createContradictingBlockHeader(
				blockHeaderFromJSON(lastBlockHeaderJSON),
			);
			blockReward = lastBlockHeader1.reward;

			await claimMisbehavior({
				account: sender,
				header1: lastBlockHeader1,
				header2: lastBlockHeader2,
				fee: '2',
			});
			lastPunishedHeight = (await waitForBlock({ heightOffset: 1 })).header.height;
		});

		it('should update delegate account pomHeights', () => {
			expect(delegateAccount.dpos.delegate.pomHeights).not.toContain(lastPunishedHeight);
			expect(delegateAccountUpdated.dpos.delegate.pomHeights).toContain(lastPunishedHeight);
		});

		it('should credit block reward to sender account', () => {
			expect(BigInt(senderAccountUpdated.token.balance)).toEqual(
				BigInt(senderAccount.token.balance) + blockReward - BigInt(convertLSKToBeddows('2')),
			);
		});

		it('should debit block reward to delegate account', () => {
			expect(BigInt(delegateAccountUpdated.token.balance)).toEqual(
				BigInt(delegateAccount.token.balance) - blockReward,
			);
		});

		describe('When delegate is already punished within 780000 blocks range from current height', () => {
			it('should fail', async () => {
				const lastBlockHeight = (await waitForBlock({ heightOffset: 2 })).header.height;
				const lastBlockHeader1 = createModifiedBlockHeader(
					blockHeaderFromJSON(lastBlockHeaderJSON),
					lastBlockHeight,
				);
				const lastBlockHeader2 = createContradictingBlockHeader(lastBlockHeader1);

				await expect(
					claimMisbehavior({
						account: sender,
						header1: lastBlockHeader2,
						header2: lastBlockHeader1,
						fee: '2',
					}),
				).rejects.toEqual({
					status: 409,
					response: {
						errors: [
							{
								message: 'Cannot apply proof-of-misbehavior. Delegate is already punished. ',
							},
						],
					},
				});
			});
		});

		// To these these case manually change SELF_VOTE_PUNISH_TIME to a low value and MAX_POM_HEIGHTS to 2 Make sure the delegate is not punished before tests in this file
		describe.skip('When PoM for delegate is punished upto 5 times', () => {
			const MAX_POM_HEIGHTS = 2;
			const SELF_VOTE_PUNISH_TIME = 10;

			beforeAll(async () => {
				const lastBlockHeight = (
					await waitForBlock({ height: lastPunishedHeight + SELF_VOTE_PUNISH_TIME })
				).header.height;
				const lastBlockHeader1 = createModifiedBlockHeader(
					blockHeaderFromJSON(lastBlockHeaderJSON),
					lastBlockHeight,
				);
				const lastBlockHeader2 = createContradictingBlockHeader(lastBlockHeader1);

				delegateAccount = await getAccount(delegateAddress);
				await claimMisbehavior({
					account: sender,
					header1: lastBlockHeader1,
					header2: lastBlockHeader2,
					fee: '2',
				});
				await waitForBlock({ heightOffset: 1 });
				delegateAccountUpdated = await getAccount(delegateAddress);
			});

			it('should ban the delegate permanently', () => {
				expect(delegateAccount.dpos.delegate.pomHeights).toHaveLength(MAX_POM_HEIGHTS - 1);
				expect(delegateAccount.dpos.delegate.isBanned).toBeFalse();

				expect(delegateAccountUpdated.dpos.delegate.pomHeights).toHaveLength(MAX_POM_HEIGHTS);
				expect(delegateAccountUpdated.dpos.delegate.isBanned).toBeTrue();
			});

			describe('PoM for a delegate which is already banned', () => {
				it('should fail', async () => {
					const lastBlockHeight = (
						await waitForBlock({ height: lastPunishedHeight + SELF_VOTE_PUNISH_TIME })
					).header.height;
					const lastBlockHeader1 = createModifiedBlockHeader(
						blockHeaderFromJSON(lastBlockHeaderJSON),
						lastBlockHeight,
					);
					const lastBlockHeader2 = createContradictingBlockHeader(lastBlockHeader1);

					await expect(
						claimMisbehavior({
							account: sender,
							header1: lastBlockHeader1,
							header2: lastBlockHeader2,
							fee: '2',
						}),
					).rejects.toEqual({
						status: 409,
						response: {
							errors: [
								{
									message: 'Cannot apply proof-of-misbehavior. Delegate is banned.',
								},
							],
						},
					});
				});
			});
		});
	});

	// https://github.com/LiskHQ/lisk-sdk/issues/5758
	describe.skip('When delegate balance is less than than last block reward', () => {
		let delegateAccount: AccountJSON;
		let delegateAccountUpdated: AccountJSON;
		let senderAccount: AccountJSON;
		let senderAccountUpdated: AccountJSON;
		let delegateRemainingBalance: bigint;
		let blockHeight: number;
		let blockReward: bigint;

		beforeAll(async () => {
			const lastBlockHeaderJSON = (await getLastBlock()).header;
			const delegate = getGenesisKeyPairByPublicKey(lastBlockHeaderJSON.generatorPublicKey);
			const delegateAddress = Buffer.from(delegate.address, 'hex');
			const lastBlockHeader1 = blockHeaderFromJSON(lastBlockHeaderJSON);
			const lastBlockHeader2 = createContradictingBlockHeader(
				blockHeaderFromJSON(lastBlockHeaderJSON),
			);
			blockReward = lastBlockHeader1.reward;

			delegateAccount = await getAccount(delegateAddress);
			const amountToTransfer =
				BigInt(delegateAccount.token.balance) - blockReward + BigInt(5000000) - BigInt(1000);
			delegateRemainingBalance = BigInt(delegateAccount.token.balance) - amountToTransfer;

			// Let's transfer some funds from delegate to get its balance below block reward
			await transferTokens({
				amount: convertBeddowsToLSK(amountToTransfer.toString()),
				recipientAddress: sender.address,
				senderAddress: delegateAddress,
				passphrase: delegate.passphrase,
			});
			await waitForBlock({ heightOffset: 1 });

			delegateAccount = await getAccount(delegateAddress);
			senderAccount = await getAccount(sender.address);

			console.info('balance', delegateAccount.token.balance);

			await claimMisbehavior({
				account: sender,
				header1: lastBlockHeader1,
				header2: lastBlockHeader2,
				fee: '2',
			});
			blockHeight = (await waitForBlock({ heightOffset: 1 })).header.height;

			delegateAccountUpdated = await getAccount(delegateAddress);
			senderAccountUpdated = await getAccount(sender.address);

			expect(blockReward).toBeGreaterThan(delegateRemainingBalance);
		});

		it('should update delegate account pomHeights', () => {
			expect(delegateAccount.dpos.delegate.pomHeights).not.toContain(blockHeight);
			expect(delegateAccountUpdated.dpos.delegate.pomHeights).toContain(blockHeight);
		});

		it('should credit block reward to sender account', () => {
			expect(BigInt(senderAccountUpdated.token.balance)).toEqual(
				BigInt(senderAccount.token.balance) +
					delegateRemainingBalance -
					BigInt(convertLSKToBeddows('2')),
			);
		});

		it('should empty out delegate account', () => {
			expect(BigInt(delegateAccountUpdated.token.balance)).toEqual(BigInt(0));
		});
	});
});
