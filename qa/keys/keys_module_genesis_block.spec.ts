import { existsSync, rmdirSync } from 'fs';
import { getRandomBytes } from '@liskhq/lisk-cryptography';
import { homedir } from 'os';
import { join } from 'path';
import { Application, validator } from 'lisk-sdk';
import { createGenesisBlock } from '@liskhq/lisk-genesis';
import { generateRandomAccount } from '../../utils/accounts';
import { createApplication } from '../../utils/application';
import { genesisBlockFromJSON, genesisBlockToJSON } from '../../utils/blocks';
import * as genesisBlockJSON from '../../config/devnet/genesis_block.json';
import { defaultAccountModules } from '../../utils/schema';

const appLabel = 'keys-module-genesis-test-app';
const dataPath = join(homedir(), '.lisk', appLabel);

describe('keys module / genesis block', () => {
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

	describe('When mandatory keys are not ordered in an account from genesis block', () => {
		it('node would not start', async () => {
			const genesisBlock = genesisBlockFromJSON(genesisBlockJSON);
			const account = generateRandomAccount();
			const invalidAccount = {
				address: account.address,
				keys: {
					numberOfSignatures: 2,
					mandatoryKeys: [getRandomBytes(32), getRandomBytes(32)].sort((a, b) => -1 * a.compare(b)),
				},
			};
			const updatedGenesisBlock = createGenesisBlock({
				accountAssetSchemas: defaultAccountModules,
				accounts: [...genesisBlock.header.asset.accounts, invalidAccount],
				initDelegates: [...genesisBlock.header.asset.initDelegates],
				roundLength: 103,
			});

			app = createApplication({
				genesisBlock: genesisBlockToJSON(updatedGenesisBlock as any),
				config: appConfig,
			});

			try {
				await app.run();
			} catch (err) {
				const error = err as validator.LiskValidationError;
				expect(error.errors).toHaveLength(1);
				expect(error.errors[0]).toMatchObject(
					expect.objectContaining({
						message: 'should be lexicographically ordered',
						keyword: 'mandatoryKeys',
					}),
				);
			}

			expect.assertions(2);
		});
	});

	describe('When optional keys are not ordered in an account from genesis block', () => {
		it('node would not start', async () => {
			const genesisBlock = genesisBlockFromJSON(genesisBlockJSON);
			const account = generateRandomAccount();
			const invalidAccount = {
				address: account.address,
				keys: {
					numberOfSignatures: 2,
					mandatoryKeys: [],
					optionalKeys: [getRandomBytes(32), getRandomBytes(32)].sort((a, b) => -1 * a.compare(b)),
				},
			};
			const updatedGenesisBlock = createGenesisBlock({
				accountAssetSchemas: defaultAccountModules,
				accounts: [...genesisBlock.header.asset.accounts, invalidAccount],
				initDelegates: [...genesisBlock.header.asset.initDelegates],
				roundLength: 103,
			});

			app = createApplication({
				genesisBlock: genesisBlockToJSON(updatedGenesisBlock as any),
				config: appConfig,
			});

			try {
				await app.run();
			} catch (err) {
				const error = err as validator.LiskValidationError;
				expect(error.errors).toHaveLength(1);
				expect(error.errors[0]).toMatchObject(
					expect.objectContaining({
						message: 'should be lexicographically ordered',
						keyword: 'optionalKeys',
					}),
				);
			}

			expect.assertions(2);
		});
	});

	describe('When mandatory keys repeated in an account from genesis block', () => {
		it('node would not start', async () => {
			const genesisBlock = genesisBlockFromJSON(genesisBlockJSON);
			const account = generateRandomAccount();
			const key = getRandomBytes(32);
			const invalidAccount = {
				address: account.address,
				keys: {
					numberOfSignatures: 3,
					mandatoryKeys: [key, key, getRandomBytes(32)].sort((a, b) => a.compare(b)),
				},
			};
			const updatedGenesisBlock = createGenesisBlock({
				accountAssetSchemas: defaultAccountModules,
				accounts: [...genesisBlock.header.asset.accounts, invalidAccount],
				initDelegates: [...genesisBlock.header.asset.initDelegates],
				roundLength: 103,
			});

			app = createApplication({
				genesisBlock: genesisBlockToJSON(updatedGenesisBlock as any),
				config: appConfig,
			});

			try {
				await app.run();
			} catch (err) {
				const error = err as validator.LiskValidationError;
				expect(error.errors).toHaveLength(1);
				expect(error.errors[0]).toMatchObject(
					expect.objectContaining({
						message: 'should NOT have duplicate items',
						keyword: 'uniqueItems',
						dataPath: expect.toInclude('.keys.mandatoryKeys'),
					}),
				);
			}

			expect.assertions(2);
		});
	});

	describe('When optional keys repeated in an account from genesis block', () => {
		it('node would not start', async () => {
			const genesisBlock = genesisBlockFromJSON(genesisBlockJSON);
			const account = generateRandomAccount();
			const key = getRandomBytes(32);
			const invalidAccount = {
				address: account.address,
				keys: {
					numberOfSignatures: 2,
					mandatoryKeys: [],
					optionalKeys: [key, key, getRandomBytes(32)].sort((a, b) => a.compare(b)),
				},
			};
			const updatedGenesisBlock = createGenesisBlock({
				accountAssetSchemas: defaultAccountModules,
				accounts: [...genesisBlock.header.asset.accounts, invalidAccount],
				initDelegates: [...genesisBlock.header.asset.initDelegates],
				roundLength: 103,
			});

			app = createApplication({
				genesisBlock: genesisBlockToJSON(updatedGenesisBlock as any),
				config: appConfig,
			});

			try {
				await app.run();
			} catch (err) {
				const error = err as validator.LiskValidationError;
				expect(error.errors).toHaveLength(1);
				expect(error.errors[0]).toMatchObject(
					expect.objectContaining({
						message: 'should NOT have duplicate items',
						keyword: 'uniqueItems',
						dataPath: expect.toInclude('.keys.optionalKeys'),
					}),
				);
			}

			expect.assertions(2);
		});
	});

	describe('When same key present in both mandatory and optional account from genesis block', () => {
		it('node would not start', async () => {
			const genesisBlock = genesisBlockFromJSON(genesisBlockJSON);
			const account = generateRandomAccount();
			const key = getRandomBytes(32);
			const invalidAccount = {
				address: account.address,
				keys: {
					numberOfSignatures: 2,
					mandatoryKeys: [key],
					optionalKeys: [key, getRandomBytes(32)].sort((a, b) => a.compare(b)),
				},
			};
			const updatedGenesisBlock = createGenesisBlock({
				accountAssetSchemas: defaultAccountModules,
				accounts: [...genesisBlock.header.asset.accounts, invalidAccount],
				initDelegates: [...genesisBlock.header.asset.initDelegates],
				roundLength: 103,
			});

			app = createApplication({
				genesisBlock: genesisBlockToJSON(updatedGenesisBlock as any),
				config: appConfig,
			});

			try {
				await app.run();
			} catch (err) {
				const error = err as validator.LiskValidationError;
				expect(error.errors).toHaveLength(1);
				expect(error.errors[0]).toMatchObject(
					expect.objectContaining({
						message: 'should NOT have duplicate items among mandatoryKeys and optionalKeys',
						keyword: 'uniqueItems',
					}),
				);
			}

			expect.assertions(2);
		});
	});

	describe('When numberOfSignatures > 0 and mandatory and optional keys empty', () => {
		it('node would not start', async () => {
			const genesisBlock = genesisBlockFromJSON(genesisBlockJSON);
			const account = generateRandomAccount();
			const invalidAccount = {
				address: account.address,
				keys: {
					numberOfSignatures: 1,
					mandatoryKeys: [],
					optionalKeys: [],
				},
			};
			const updatedGenesisBlock = createGenesisBlock({
				accountAssetSchemas: defaultAccountModules,
				accounts: [...genesisBlock.header.asset.accounts, invalidAccount],
				initDelegates: [...genesisBlock.header.asset.initDelegates],
				roundLength: 103,
			});

			app = createApplication({
				genesisBlock: genesisBlockToJSON(updatedGenesisBlock as any),
				config: appConfig,
			});

			try {
				await app.run();
			} catch (err) {
				const error = err as validator.LiskValidationError;
				expect(error.errors).toHaveLength(1);
				expect(error.errors[0]).toMatchObject(
					expect.objectContaining({
						message: 'should be maximum of length of mandatoryKeys and optionalKeys',
						keyword: 'max',
					}),
				);
			}

			expect.assertions(2);
		});
	});
});
