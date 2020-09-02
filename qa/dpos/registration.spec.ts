import { getRandomBytes } from '@liskhq/lisk-cryptography';
import { getAccountNonce, buildAccount } from '../../utils/accounts';
import { convertLSKToBeddows, register, convertBeddowsToLSK } from '../../utils/transactions';
import { networkIdentifier, waitForBlock, getLastBlock } from '../../utils/network';
import { api } from '../../utils/api';
import { registerDelegate } from '../../utils/test';
import { AccountSeed } from '../../types';

const expectDelegateRegistered = async (account: AccountSeed, username?: string): Promise<void> => {
	const lastBlock = await getLastBlock();
	await waitForBlock({ heightOffset: 1 });
	const res = await api.http.accounts.accountsAddressGet(account.address.toString('hex'));

	if (username) {
		expect(res.data.dpos.delegate.username).toEqual(username);
	} else {
		expect(res.data.dpos.delegate.username).not.toEqual('');
	}

	expect(res.data.dpos.delegate.lastForgedHeight).toEqual(lastBlock.header.height + 1);
};

describe('DPOS Delegate Registration', () => {
	describe('Invalid Cases', () => {
		let account: AccountSeed;

		// A valid account exists with 20LSK balance
		beforeAll(async () => {
			account = await buildAccount({ balance: '20' });
			await waitForBlock({ heightOffset: 1 });
		});

		describe('Register username which contains upper case letters', () => {
			test.each(['Delegate', 'myDelegate', 'mydelegatE'])(
				'should fail when account registered with username "%s"',
				async (username: string) => {
					await expect(registerDelegate({ account, username, fee: '11' })).rejects.toMatchObject({
						status: 409,
						response: {
							errors: [{ message: 'ValidationError: The username is in unsupported format' }],
						},
					});
				},
			);
		});

		describe('Register username over maximum length 20', () => {
			test.each(['perttyprettylongusername1', '123456789012345678901'])(
				'should fail when account registered with username "%s"',
				async (username: string) => {
					await expect(registerDelegate({ account, username, fee: '11' })).rejects.toMatchObject({
						status: 409,
						response: {
							errors: [
								{
									message:
										"Error: Lisk validator found 1 error[s]:\nProperty '.username' should NOT be longer than 20 characters",
								},
							],
						},
					});
				},
			);
		});

		describe('Register username as empty string', () => {
			it('should fail when account registered with empty string username', async () => {
				await expect(registerDelegate({ account, username: '', fee: '11' })).rejects.toMatchObject({
					status: 409,
					response: {
						errors: [
							{
								message:
									"Error: Lisk validator found 1 error[s]:\nProperty '.username' should NOT be shorter than 1 characters",
							},
						],
					},
				});
			});
		});

		describe('Register username with string containing spaces', () => {
			test.each([' ', ' myuser', 'myuser ', 'my user'])(
				'should fail when account registered with username "%s"',
				async (username: string) => {
					await expect(registerDelegate({ account, username, fee: '11' })).rejects.toMatchObject({
						status: 409,
						response: {
							errors: [
								{
									message: 'ValidationError: The username is in unsupported format',
								},
							],
						},
					});
				},
			);
		});

		describe('Register username which contains null characters', () => {
			test.each(['myUser\u0000', '\u0000myDelegate', 'mydel\u0000egatE'])(
				'should fail when account registered with username "%s"',
				async (username: string) => {
					await expect(registerDelegate({ account, username, fee: '11' })).rejects.toMatchObject({
						status: 409,
						response: {
							errors: [{ message: 'ValidationError: The username is in unsupported format' }],
						},
					});
				},
			);
		});

		describe('Register username with less than name fee', () => {
			it('should fail with error message', async () => {
				const username = getRandomBytes(10).toString('hex');

				const { minFee } = register({
					senderPublicKey: account.publicKey,
					username,
					nonce: BigInt(await getAccountNonce(account.address)).toString(),
					passphrase: account.passphrase,
					fee: convertLSKToBeddows('9'),
					networkIdentifier,
				});

				await expect(
					registerDelegate({
						account,
						username,
						fee: convertBeddowsToLSK(
							(minFee + BigInt(convertLSKToBeddows('10')) - BigInt(1)).toString(),
						),
					}),
				).rejects.toMatchObject({
					status: 409,
					response: {
						errors: [
							{
								message: 'Error: Insufficient transaction fee. Minimum required fee is: 1000136000',
							},
						],
					},
				});
			});
		});
	});

	describe('Valid Cases', () => {
		let account: AccountSeed;

		// A valid account exists with 20LSK balance
		beforeEach(async () => {
			account = await buildAccount({ balance: '20' });
			await waitForBlock({ heightOffset: 1 });
		});

		describe('Register username with fee equal to name fee', () => {
			it('should register account as delegate', async () => {
				const username = getRandomBytes(10).toString('hex');

				const { minFee } = register({
					senderPublicKey: account.publicKey,
					username,
					nonce: BigInt(await getAccountNonce(account.address)).toString(),
					passphrase: account.passphrase,
					fee: convertLSKToBeddows('9'),
					networkIdentifier,
				});

				await expect(
					registerDelegate({
						account,
						username,
						fee: convertBeddowsToLSK((minFee + BigInt(convertLSKToBeddows('10'))).toString()),
					}),
				).resolves.toEqual(expect.objectContaining({ status: 200 }));
				await expectDelegateRegistered(account, username);
			});
		});

		describe('Register username which have special characters !@$&_.', () => {
			test.each(['user!', 'user@', 'user&', 'user_', 'user.nad', 'user.', 'user.&df1'])(
				'should register account as delegate with username "%s"',
				async (usernamePrefix: string) => {
					const username = getRandomBytes(5).toString('hex') + usernamePrefix;

					await expect(registerDelegate({ account, username, fee: '11' })).resolves.toEqual(
						expect.objectContaining({ status: 200 }),
					);
					await expectDelegateRegistered(account, username);
				},
			);
		});

		describe('Register username which have only integers', () => {
			it('should register account as delegate with username as only integers', async () => {
				const username = [...getRandomBytes(8)].map(a => a).join('');

				await expect(registerDelegate({ account, username, fee: '11' })).resolves.toEqual(
					expect.objectContaining({ status: 200 }),
				);
				await expectDelegateRegistered(account, username);
			});
		});

		describe('Register duplicate delegate username', () => {
			it('should fail with error', async () => {
				const username = getRandomBytes(5).toString('hex');
				await registerDelegate({ account, username, fee: '11' });
				await expectDelegateRegistered(account, username);
				const account2 = await buildAccount({ balance: '20' });
				await waitForBlock({ heightOffset: 1 });

				await expect(
					registerDelegate({ account: account2, username, fee: '11' }),
				).rejects.toMatchObject({
					status: 409,
					response: {
						errors: [
							{
								message: 'Username is not unique',
							},
						],
					},
				});
			});
		});

		describe('Re-register account as delegate which is already a delegate', () => {
			it('should fail with error', async () => {
				const username = getRandomBytes(5).toString('hex');
				await registerDelegate({ account, username, fee: '11' });
				await expectDelegateRegistered(account, username);

				await expect(
					registerDelegate({ account, username: 'change.name', fee: '11' }),
				).rejects.toMatchObject({
					status: 409,
					response: {
						errors: [
							{
								message: 'Account is already a delegate',
							},
						],
					},
				});
			});
		});
	});
});
