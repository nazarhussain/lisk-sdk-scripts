import { getRandomBytes } from '@liskhq/lisk-cryptography';
import { AccountSeed } from '../../types';
import { buildAccount, buildAccounts, getAccountNonce } from '../../utils/accounts';
import { networkIdentifier, waitForBlock } from '../../utils/network';
import { covertToMultisig, extractSignatures, postTransaction } from '../../utils/test';
import { convertLSKToBeddows, transfer, transferMultisig } from '../../utils/transactions';

describe('keys module', () => {
	let sender: AccountSeed;
	let account1: AccountSeed;
	let account2: AccountSeed;
	let account3: AccountSeed;
	let account4: AccountSeed;
	let passphrases: string[];

	beforeEach(async () => {
		[sender, account1, account2, account3, account4] = (
			await buildAccounts({
				balance: '100',
				count: 5,
			})
		).sort((a, b) => a.publicKey.compare(b.publicKey));
		passphrases = [account1, account2, account3, account4].map(a => a.passphrase);
		await waitForBlock({ heightOffset: 1 });
	});

	describe('When send transaction from a normal account', () => {
		describe('With single valid signature', () => {
			it.todo('should be accepted'); // This case is already been functional in before each block
		});

		describe('With multiple valid signatures', () => {
			it('should be rejected', async () => {
				const { id, tx } = transfer({
					recipientAddress: account2.address,
					amount: convertLSKToBeddows('2'),
					fee: convertLSKToBeddows('0.1'),
					nonce: BigInt(await getAccountNonce(account1.address)).toString(),
					passphrase: account1.passphrase,
					networkIdentifier,
				});

				const signatures = [...tx.signatures, ...tx.signatures];

				await expect(postTransaction({ ...tx, signatures }, id)).rejects.toEqual({
					status: 409,
					response: {
						errors: [
							{
								message:
									'Transactions from a single signature account should have exactly one signature. Found 2 signatures.',
							},
						],
					},
				});
			});
		});

		describe('With single invalid signature', () => {
			it('should be rejected', async () => {
				const { id, tx } = transfer({
					recipientAddress: account2.address,
					amount: convertLSKToBeddows('2'),
					fee: convertLSKToBeddows('0.1'),
					nonce: BigInt(await getAccountNonce(account1.address)).toString(),
					passphrase: account1.passphrase,
					networkIdentifier,
				});

				const signatures = [getRandomBytes(64).toString('hex')];

				await expect(postTransaction({ ...tx, signatures }, id)).rejects.toEqual({
					status: 409,
					response: {
						errors: [
							{
								message: expect.toInclude('Failed to validate signature'),
							},
						],
					},
				});
			});
		});

		describe('With no signature', () => {
			it('should be rejected', async () => {
				const { id, tx } = transfer({
					recipientAddress: account2.address,
					amount: convertLSKToBeddows('2'),
					fee: convertLSKToBeddows('0.1'),
					nonce: BigInt(await getAccountNonce(account1.address)).toString(),
					passphrase: account1.passphrase,
					networkIdentifier,
				});

				const signatures = [];

				await expect(postTransaction({ ...tx, signatures }, id)).rejects.toEqual({
					status: 400,
					response: {
						errors: [
							{
								message: 'Lisk validator found 1 error[s]:\nshould NOT have fewer than 1 items',
							},
						],
					},
				});
			});
		});
	});

	describe('When send transaction from a multi-signature account', () => {
		describe('2 mandatory 2 optional, number of signatures required 3. Mandatory signatures ordered and present; one of the optional signatures present and the other is empty buffer', () => {
			it('should be accepted', async () => {
				const mandatoryKeys = [account1.publicKey, account2.publicKey];
				const optionalKeys = [account3.publicKey, account4.publicKey];
				await covertToMultisig({
					numberOfSignatures: 3,
					account: sender,
					fee: '2',
					mandatoryKeys,
					optionalKeys,
					passphrases,
				});
				const account = await buildAccount({ balance: '10' });
				await waitForBlock({ heightOffset: 1 });

				const { tx } = transferMultisig({
					amount: convertLSKToBeddows('10'),
					fee: convertLSKToBeddows('0.4'),
					recipientAddress: account.address,
					passphrase: sender.passphrase,
					passphrases: [account1.passphrase, account2.passphrase, account3.passphrase],
					mandatoryKeys,
					optionalKeys,
					networkIdentifier,
					nonce: BigInt(await getAccountNonce(sender.address)).toString(),
				});

				await expect(postTransaction(tx)).resolves.not.toBeUndefined();
			});
		});

		describe('4 optional, number of signatures required 2. Optional signatures ordered and present', () => {
			it('should be rejected', async () => {
				const mandatoryKeys = [];
				const optionalKeys = [
					account1.publicKey,
					account2.publicKey,
					account3.publicKey,
					account4.publicKey,
				];
				await covertToMultisig({
					numberOfSignatures: 2,
					account: sender,
					fee: '2',
					mandatoryKeys,
					optionalKeys,
					passphrases,
				});
				const account = await buildAccount({ balance: '10' });
				await waitForBlock({ heightOffset: 1 });

				const { tx } = transferMultisig({
					amount: convertLSKToBeddows('10'),
					fee: convertLSKToBeddows('0.4'),
					recipientAddress: account.address,
					passphrase: sender.passphrase,
					passphrases: [
						account1.passphrase,
						account2.passphrase,
						account3.passphrase,
						account4.passphrase,
					],
					mandatoryKeys,
					optionalKeys,
					networkIdentifier,
					nonce: BigInt(await getAccountNonce(sender.address)).toString(),
				});

				const { mandatorySignatures, optionalSignatures } = extractSignatures(
					{
						signatures: tx.signatures,
						asset: {
							mandatoryKeys: [],
							optionalKeys: optionalKeys.map(k => k.toString('hex')),
							numberOfSignatures: 3,
						},
					},
					false,
				);
				const signatures = [...optionalSignatures, ...mandatorySignatures];

				await expect(postTransaction({ ...tx, signatures })).rejects.toEqual({
					status: 409,
					response: {
						errors: [
							{
								message: expect.toInclude(
									'Transaction signatures does not match required number of signatures',
								),
							},
						],
					},
				});
			});
		});

		describe('2 mandatory 2 optional, number of signatures required 3. Mandatory signatures out of order', () => {
			it('should be rejected', async () => {
				const mandatoryKeys = [account1.publicKey, account2.publicKey];
				const optionalKeys = [account3.publicKey, account4.publicKey];
				await covertToMultisig({
					numberOfSignatures: 3,
					account: sender,
					fee: '2',
					mandatoryKeys,
					optionalKeys,
					passphrases,
				});
				const account = await buildAccount({ balance: '10' });
				await waitForBlock({ heightOffset: 1 });

				const { tx } = transferMultisig({
					amount: convertLSKToBeddows('10'),
					fee: convertLSKToBeddows('0.4'),
					recipientAddress: account.address,
					passphrase: sender.passphrase,
					passphrases: [account1.passphrase, account2.passphrase, account3.passphrase],
					mandatoryKeys,
					optionalKeys,
					networkIdentifier,
					nonce: BigInt(await getAccountNonce(sender.address)).toString(),
				});

				const { mandatorySignatures, optionalSignatures } = extractSignatures(
					{
						signatures: tx.signatures,
						asset: {
							mandatoryKeys: mandatoryKeys.map(k => k.toString('hex')),
							optionalKeys: optionalKeys.map(k => k.toString('hex')),
							numberOfSignatures: 3,
						},
					},
					false,
				);
				const signatures = [...mandatorySignatures.reverse(), ...optionalSignatures];

				await expect(postTransaction({ ...tx, signatures })).rejects.toEqual({
					status: 409,
					response: {
						errors: [
							{
								message: expect.toInclude(
									'Transaction signatures does not match required number of signatures',
								),
							},
						],
					},
				});
			});
		});

		describe('2 mandatory 2 optional, number of signatures required 3. Optional signatures out of order', () => {
			it('should be rejected', async () => {
				const mandatoryKeys = [account1.publicKey, account2.publicKey];
				const optionalKeys = [account3.publicKey, account4.publicKey];
				await covertToMultisig({
					numberOfSignatures: 3,
					account: sender,
					fee: '2',
					mandatoryKeys,
					optionalKeys,
					passphrases,
				});
				const account = await buildAccount({ balance: '10' });
				await waitForBlock({ heightOffset: 1 });

				const { tx } = transferMultisig({
					amount: convertLSKToBeddows('10'),
					fee: convertLSKToBeddows('0.4'),
					recipientAddress: account.address,
					passphrase: sender.passphrase,
					passphrases: [account1.passphrase, account2.passphrase, account3.passphrase],
					mandatoryKeys,
					optionalKeys,
					networkIdentifier,
					nonce: BigInt(await getAccountNonce(sender.address)).toString(),
				});

				const { mandatorySignatures, optionalSignatures } = extractSignatures(
					{
						signatures: tx.signatures,
						asset: {
							mandatoryKeys: mandatoryKeys.map(k => k.toString('hex')),
							optionalKeys: optionalKeys.map(k => k.toString('hex')),
							numberOfSignatures: 3,
						},
					},
					false,
				);
				const signatures = [...optionalSignatures, ...mandatorySignatures];

				await expect(postTransaction({ ...tx, signatures })).rejects.toEqual({
					status: 409,
					response: {
						errors: [
							{
								message: expect.toInclude(
									'Transaction signatures does not match required number of signatures',
								),
							},
						],
					},
				});
			});
		});

		describe('2 mandatory 2 optional, number of signatures required 3. One mandatory signature missing.', () => {
			it('should be rejected', async () => {
				const mandatoryKeys = [account1.publicKey, account2.publicKey];
				const optionalKeys = [account3.publicKey, account4.publicKey];
				await covertToMultisig({
					numberOfSignatures: 3,
					account: sender,
					fee: '2',
					mandatoryKeys,
					optionalKeys,
					passphrases,
				});
				const account = await buildAccount({ balance: '10' });
				await waitForBlock({ heightOffset: 1 });

				const { tx } = transferMultisig({
					amount: convertLSKToBeddows('10'),
					fee: convertLSKToBeddows('0.4'),
					recipientAddress: account.address,
					passphrase: sender.passphrase,
					passphrases: [account1.passphrase, account2.passphrase, account3.passphrase],
					mandatoryKeys,
					optionalKeys,
					networkIdentifier,
					nonce: BigInt(await getAccountNonce(sender.address)).toString(),
				});

				const { mandatorySignatures, optionalSignatures } = extractSignatures(
					{
						signatures: tx.signatures,
						asset: {
							mandatoryKeys: mandatoryKeys.map(k => k.toString('hex')),
							optionalKeys: optionalKeys.map(k => k.toString('hex')),
							numberOfSignatures: 3,
						},
					},
					false,
				);
				const signatures = [mandatorySignatures[0], ...optionalSignatures];

				await expect(postTransaction({ ...tx, signatures })).rejects.toEqual({
					status: 409,
					response: {
						errors: [
							{
								message: expect.toInclude(
									'Transaction signatures does not match required number of signatures',
								),
							},
						],
					},
				});
			});
		});

		describe('2 mandatory 2 optional, number of signatures required 3. All optional signatures present.', () => {
			it('should be rejected', async () => {
				const mandatoryKeys = [account1.publicKey, account2.publicKey];
				const optionalKeys = [account3.publicKey, account4.publicKey];
				await covertToMultisig({
					numberOfSignatures: 3,
					account: sender,
					fee: '2',
					mandatoryKeys,
					optionalKeys,
					passphrases,
				});
				const account = await buildAccount({ balance: '10' });
				await waitForBlock({ heightOffset: 1 });

				const { tx } = transferMultisig({
					amount: convertLSKToBeddows('10'),
					fee: convertLSKToBeddows('0.4'),
					recipientAddress: account.address,
					passphrase: sender.passphrase,
					passphrases: [
						account1.passphrase,
						account2.passphrase,
						account3.passphrase,
						account4.passphrase,
					],
					mandatoryKeys,
					optionalKeys,
					networkIdentifier,
					nonce: BigInt(await getAccountNonce(sender.address)).toString(),
				});

				const { mandatorySignatures, optionalSignatures } = extractSignatures(
					{
						signatures: tx.signatures,
						asset: {
							mandatoryKeys: mandatoryKeys.map(k => k.toString('hex')),
							optionalKeys: optionalKeys.map(k => k.toString('hex')),
							numberOfSignatures: 3,
						},
					},
					false,
				);
				const signatures = [...mandatorySignatures, ...optionalSignatures];

				await expect(postTransaction({ ...tx, signatures })).rejects.toEqual({
					status: 409,
					response: {
						errors: [
							{
								message: expect.toInclude(
									'Transaction signatures does not match required number of signatures',
								),
							},
						],
					},
				});
			});
		});

		describe('2 mandatory 2 optional, number of signatures required 3. All mandatory signatures present. One optional present. One optional missing (i.e. no empty buffer on its place)', () => {
			it('should be rejected', async () => {
				const mandatoryKeys = [account1.publicKey, account2.publicKey];
				const optionalKeys = [account3.publicKey, account4.publicKey];
				await covertToMultisig({
					numberOfSignatures: 3,
					account: sender,
					fee: '2',
					mandatoryKeys,
					optionalKeys,
					passphrases,
				});
				const account = await buildAccount({ balance: '10' });
				await waitForBlock({ heightOffset: 1 });

				const { tx } = transferMultisig({
					amount: convertLSKToBeddows('10'),
					fee: convertLSKToBeddows('0.4'),
					recipientAddress: account.address,
					passphrase: sender.passphrase,
					passphrases: [account1.passphrase, account2.passphrase, account3.passphrase],
					mandatoryKeys,
					optionalKeys,
					networkIdentifier,
					nonce: BigInt(await getAccountNonce(sender.address)).toString(),
				});

				const { mandatorySignatures, optionalSignatures } = extractSignatures(
					{
						signatures: tx.signatures,
						asset: {
							mandatoryKeys: mandatoryKeys.map(k => k.toString('hex')),
							optionalKeys: optionalKeys.map(k => k.toString('hex')),
							numberOfSignatures: 3,
						},
					},
					false,
				);
				const signatures = [...mandatorySignatures, optionalSignatures[0]];

				await expect(postTransaction({ ...tx, signatures })).rejects.toEqual({
					status: 409,
					response: {
						errors: [
							{
								message: expect.toInclude(
									'Transaction signatures does not match required number of signatures',
								),
							},
						],
					},
				});
			});
		});
	});
});
