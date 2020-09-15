import { getRandomBytes } from '@liskhq/lisk-cryptography';
import { AccountSeed } from '../../types';
import { buildAccount, buildAccounts, getAccount, getAccountNonce } from '../../utils/accounts';
import { networkIdentifier, waitForBlock } from '../../utils/network';
import { covertToMultisig, extractSignatures, postTransaction } from '../../utils/test';
import { convertLSKToBeddows } from '../../utils/transactions';
import { registerMultisig } from '../../utils/transactions/keys/register_multisig';

describe('multisig registration', () => {
	let account: AccountSeed;

	describe('validateSchema', () => {
		const passphrases = [];
		beforeAll(async () => {
			account = await buildAccount({ balance: '100' });
			await waitForBlock({ heightOffset: 1 });
		});

		it('should fail validation if asset has numberOfSignatures > 64', async () => {
			const asset = {
				numberOfSignatures: 100,
				mandatoryKeys: [getRandomBytes(32)],
				optionalKeys: [getRandomBytes(32)],
			};

			await expect(covertToMultisig({ ...asset, account, fee: '2', passphrases })).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Error: Lisk validator found 1 error[s]:\nshould be <= 64',
						},
					],
				},
			});
		});

		it('should fail validation if asset has numberOfSignatures < 1', async () => {
			const asset = {
				numberOfSignatures: 0,
				mandatoryKeys: [getRandomBytes(32)],
				optionalKeys: [getRandomBytes(32)],
			};

			await expect(covertToMultisig({ ...asset, account, fee: '2', passphrases })).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Error: Lisk validator found 1 error[s]:\nshould be >= 1',
						},
					],
				},
			});
		});

		it('should fail validation if asset has more than 64 mandatory keys', async () => {
			const asset = {
				numberOfSignatures: 2,
				mandatoryKeys: [...Array(65).keys()].map(() => getRandomBytes(32)),
				optionalKeys: [],
			};

			await expect(covertToMultisig({ ...asset, account, fee: '2', passphrases })).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								'Error: Lisk validator found 1 error[s]:\nshould NOT have more than 64 items',
						},
					],
				},
			});
		});

		it('should fail validation if asset mandatory keys contains items with length bigger than 32', async () => {
			const asset = {
				numberOfSignatures: 2,
				mandatoryKeys: [...Array(1).keys()].map(() => getRandomBytes(64)),
				optionalKeys: [],
			};

			await expect(covertToMultisig({ ...asset, account, fee: '2', passphrases })).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								"Error: Lisk validator found 1 error[s]:\nProperty '.mandatoryKeys[0]' maxLength exceeded",
						},
					],
				},
			});
		});

		it('should fail validation if asset mandatory keys contains items with length smaller than 32', async () => {
			const asset = {
				numberOfSignatures: 2,
				mandatoryKeys: [...Array(1).keys()].map(() => getRandomBytes(10)),
				optionalKeys: [],
			};

			await expect(covertToMultisig({ ...asset, account, fee: '2', passphrases })).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								"Error: Lisk validator found 1 error[s]:\nProperty '.mandatoryKeys[0]' minLength not satisfied",
						},
					],
				},
			});
		});

		it('should fail validation if asset optional keys contains items with length bigger than 32', async () => {
			const asset = {
				numberOfSignatures: 2,
				mandatoryKeys: [],
				optionalKeys: [...Array(1).keys()].map(() => getRandomBytes(64)),
			};

			await expect(covertToMultisig({ ...asset, account, fee: '2', passphrases })).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								"Error: Lisk validator found 1 error[s]:\nProperty '.optionalKeys[0]' maxLength exceeded",
						},
					],
				},
			});
		});

		it('should fail validation if asset optional keys contains items with length smaller than 32', async () => {
			const asset = {
				numberOfSignatures: 2,
				mandatoryKeys: [],
				optionalKeys: [...Array(1).keys()].map(() => getRandomBytes(31)),
			};

			await expect(covertToMultisig({ ...asset, account, fee: '2', passphrases })).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								"Error: Lisk validator found 1 error[s]:\nProperty '.optionalKeys[0]' minLength not satisfied",
						},
					],
				},
			});
		});

		it('should fail validation if asset has more than 64 optional keys', async () => {
			const asset = {
				numberOfSignatures: 2,
				mandatoryKeys: [],
				optionalKeys: [...Array(65).keys()].map(() => getRandomBytes(32)),
			};

			await expect(covertToMultisig({ ...asset, account, fee: '2', passphrases })).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								'Error: Lisk validator found 1 error[s]:\nshould NOT have more than 64 items',
						},
					],
				},
			});
		});
	});

	describe('validate', () => {
		let sender: AccountSeed;
		let account1: AccountSeed;
		let account2: AccountSeed;
		let account3: AccountSeed;
		let account4: AccountSeed;
		let passphrases: string[];

		beforeAll(async () => {
			[sender, account1, account2, account3, account4] = (
				await buildAccounts({
					balance: '100',
					count: 5,
				})
			).sort((a, b) => a.publicKey.compare(b.publicKey));
			account = sender;
			passphrases = [account1, account2, account3, account4].map(a => a.passphrase);
			await waitForBlock({ heightOffset: 1 });
		});

		it('should throw error when there are duplicated mandatory keys', async () => {
			await expect(
				covertToMultisig({
					numberOfSignatures: 3,
					account,
					fee: '2',
					mandatoryKeys: [account1.publicKey, account2.publicKey, account1.publicKey],
					optionalKeys: [account3.publicKey, account4.publicKey],
					passphrases,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Error: MandatoryKeys contains duplicate public keys.',
						},
					],
				},
			});
		});

		it('should throw error when there are duplicated optional keys', async () => {
			await expect(
				covertToMultisig({
					numberOfSignatures: 3,
					account,
					fee: '2',
					mandatoryKeys: [account1.publicKey, account2.publicKey],
					optionalKeys: [account3.publicKey, account4.publicKey, account3.publicKey],
					passphrases,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Error: OptionalKeys contains duplicate public keys.',
						},
					],
				},
			});
		});

		it('should throw error when numberOfSignatures is bigger than the count of all keys', async () => {
			await expect(
				covertToMultisig({
					numberOfSignatures: 5,
					account,
					fee: '2',
					mandatoryKeys: [account1.publicKey, account2.publicKey],
					optionalKeys: [account3.publicKey, account4.publicKey],
					passphrases,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								'Error: The numberOfSignatures is bigger than the count of Mandatory and Optional keys.',
						},
					],
				},
			});
		});

		it('should throw error when numberOfSignatures is smaller than mandatory key count', async () => {
			await expect(
				covertToMultisig({
					numberOfSignatures: 1,
					account,
					fee: '2',
					mandatoryKeys: [account1.publicKey, account2.publicKey],
					optionalKeys: [account3.publicKey, account4.publicKey],
					passphrases,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								'Error: The numberOfSignatures needs to be equal or bigger than the number of Mandatory keys.',
						},
					],
				},
			});
		});

		it('should throw error when mandatory and optional key sets are not disjointed', async () => {
			await expect(
				covertToMultisig({
					numberOfSignatures: 3,
					account,
					fee: '2',
					mandatoryKeys: [account1.publicKey, account2.publicKey],
					optionalKeys: [account3.publicKey, account4.publicKey, account2.publicKey],
					passphrases,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								'Error: Invalid combination of Mandatory and Optional keys. Repeated keys across Mandatory and Optional were found.',
						},
					],
				},
			});
		});

		it('should throw error when mandatory keys set is not sorted', async () => {
			await expect(
				covertToMultisig({
					numberOfSignatures: 3,
					account,
					fee: '2',
					mandatoryKeys: [account1.publicKey, account2.publicKey].sort((a, b) => -1 * a.compare(b)),
					optionalKeys: [account3.publicKey, account4.publicKey],
					passphrases,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Error: Mandatory keys should be sorted lexicographically.',
						},
					],
				},
			});
		});

		it('should throw error when optional keys set is not sorted', async () => {
			await expect(
				covertToMultisig({
					numberOfSignatures: 3,
					account,
					fee: '2',
					mandatoryKeys: [account1.publicKey, account2.publicKey],
					optionalKeys: [account3.publicKey, account4.publicKey].sort((a, b) => -1 * a.compare(b)),
					passphrases,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Error: Optional keys should be sorted lexicographically.',
						},
					],
				},
			});
		});

		it('should throw error when the number of optional and mandatory keys is more than 64', async () => {
			await expect(
				covertToMultisig({
					numberOfSignatures: 35,
					account,
					fee: '2',
					mandatoryKeys: Array(32)
						.fill(0)
						.map(() => getRandomBytes(32))
						.sort((a, b) => a.compare(b)),
					optionalKeys: Array(33)
						.fill(0)
						.map(() => getRandomBytes(32))
						.sort((a, b) => a.compare(b)),
					passphrases,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								'Error: The count of Mandatory and Optional keys should be between 1 and 64.',
						},
					],
				},
			});
		});

		it('should throw error when the number of optional and mandatory keys is less than 1', async () => {
			await expect(
				covertToMultisig({
					numberOfSignatures: 0,
					account,
					fee: '2',
					mandatoryKeys: [],
					optionalKeys: [],
					passphrases,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Error: Lisk validator found 1 error[s]:\nshould be >= 1',
						},
					],
				},
			});
		});

		it('should return error when number of mandatory, optional and sender keys do not match the number of signatures', async () => {
			await expect(
				covertToMultisig({
					numberOfSignatures: 3,
					account,
					fee: '2',
					mandatoryKeys: [account1.publicKey, account2.publicKey],
					optionalKeys: [account3.publicKey, account4.publicKey],
					overrideSignatures: [getRandomBytes(64), getRandomBytes(64)],
					passphrases,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								'Error: The number of mandatory, optional and sender keys should match the number of signatures',
						},
					],
				},
			});
		});
	});

	describe('apply', () => {
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
			account = sender;
			passphrases = [account1, account2, account3, account4].map(a => a.passphrase);
			await waitForBlock({ heightOffset: 1 });
		});

		it('should not throw when registering for first time', async () => {
			await expect(
				covertToMultisig({
					numberOfSignatures: 3,
					account,
					fee: '2',
					mandatoryKeys: [account1.publicKey, account2.publicKey],
					optionalKeys: [account3.publicKey, account4.publicKey],
					passphrases,
				}),
			).resolves.not.toBeUndefined();
		});

		it('should updated account', async () => {
			const beforeUpdate = await getAccount(account.address);
			await covertToMultisig({
				numberOfSignatures: 3,
				account,
				fee: '2',
				mandatoryKeys: [account1.publicKey, account2.publicKey],
				optionalKeys: [account3.publicKey, account4.publicKey],
				passphrases,
			});
			await waitForBlock({ heightOffset: 1 });

			const updatedAccount = await getAccount(account.address);

			expect(beforeUpdate.keys.numberOfSignatures).toEqual(0);
			expect(beforeUpdate.keys.mandatoryKeys).toEqual([]);
			expect(beforeUpdate.keys.optionalKeys).toEqual([]);
			expect(updatedAccount.keys.numberOfSignatures).toEqual(3);
			expect(updatedAccount.keys.mandatoryKeys).toEqual([
				account1.publicKey.toString('hex'),
				account2.publicKey.toString('hex'),
			]);
			expect(updatedAccount.keys.optionalKeys).toEqual([
				account3.publicKey.toString('hex'),
				account4.publicKey.toString('hex'),
			]);
		});

		it('should throw error when account is already multisignature', async () => {
			await covertToMultisig({
				numberOfSignatures: 3,
				account,
				fee: '2',
				mandatoryKeys: [account1.publicKey, account2.publicKey],
				optionalKeys: [account3.publicKey, account4.publicKey],
				passphrases,
			});
			await waitForBlock({ heightOffset: 1 });

			await expect(
				covertToMultisig({
					numberOfSignatures: 3,
					account,
					fee: '2',
					mandatoryKeys: [account1.publicKey, account2.publicKey],
					optionalKeys: [account3.publicKey, account4.publicKey],
					passphrases,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Register multisignature only allowed once per account.',
						},
					],
				},
			});
		});
	});

	describe('use cases', () => {
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
			account = sender;
			passphrases = [account1, account2, account3, account4].map(a => a.passphrase);
			await waitForBlock({ heightOffset: 1 });
		});

		describe('When sender is not member', () => {
			describe('2 mandatory keys; 2 optional keys; numberofSignature: 4; Sender Signature present as first signature. All members signatures present.', () => {
				it('should be accepted', async () => {
					await expect(
						covertToMultisig({
							numberOfSignatures: 4,
							account,
							fee: '2',
							mandatoryKeys: [account1.publicKey, account2.publicKey],
							optionalKeys: [account3.publicKey, account4.publicKey],
							passphrases,
						}),
					).resolves.not.toBeUndefined();
				});
			});

			describe('2 mandatory keys; Sender Signature present as first signature. All members signatures present.', () => {
				it('should be accepted', async () => {
					await expect(
						covertToMultisig({
							numberOfSignatures: 2,
							account,
							fee: '2',
							mandatoryKeys: [account1.publicKey, account2.publicKey],
							optionalKeys: [],
							passphrases,
						}),
					).resolves.not.toBeUndefined();
				});
			});

			describe('2 optional keys; Sender Signature present as first signature. All members signatures present.', () => {
				it('should be accepted', async () => {
					await expect(
						covertToMultisig({
							numberOfSignatures: 2,
							account,
							fee: '2',
							mandatoryKeys: [],
							optionalKeys: [account3.publicKey, account4.publicKey],
							passphrases,
						}),
					).resolves.not.toBeUndefined();
				});
			});

			describe('2 mandatory keys; 2 optional keys; Sender Signature present as first signature. All members signatures present but not in order for each key group.', () => {
				it('should be rejected', async () => {
					const { id, tx } = registerMultisig({
						senderPublicKey: account.publicKey,
						mandatoryKeys: [account1.publicKey, account2.publicKey],
						optionalKeys: [account3.publicKey, account4.publicKey],
						numberOfSignatures: 4,
						nonce: BigInt(await getAccountNonce(account.address)).toString(),
						passphrase: account.passphrase,
						passphrases,
						fee: convertLSKToBeddows('2'),
						networkIdentifier,
					});
					const { senderSignature, mandatorySignatures, optionalSignatures } = extractSignatures(
						tx,
						true,
					);

					const signatures = [
						...optionalSignatures,
						...mandatorySignatures,
						senderSignature,
					] as string[];

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

			describe('2 mandatory keys; 2 optional keys; Sender Signature present as first signature. All members signatures present but only Mandatory in order for each key group.', () => {
				it('should be rejected', async () => {
					const { id, tx } = registerMultisig({
						senderPublicKey: account.publicKey,
						mandatoryKeys: [account1.publicKey, account2.publicKey],
						optionalKeys: [account3.publicKey, account4.publicKey],
						numberOfSignatures: 4,
						nonce: BigInt(await getAccountNonce(account.address)).toString(),
						passphrase: account.passphrase,
						passphrases,
						fee: convertLSKToBeddows('2'),
						networkIdentifier,
					});

					const { senderSignature, mandatorySignatures, optionalSignatures } = extractSignatures(
						tx,
						true,
					);

					const signatures = [
						senderSignature,
						...mandatorySignatures,
						...optionalSignatures.reverse(),
					] as string[];

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

			describe('2 mandatory keys; 2 optional keys; Sender Signature present as first signature. All members signatures missing.', () => {
				it('should be rejected', async () => {
					const { id, tx } = registerMultisig({
						senderPublicKey: account.publicKey,
						mandatoryKeys: [account1.publicKey, account2.publicKey],
						optionalKeys: [account3.publicKey, account4.publicKey],
						numberOfSignatures: 4,
						nonce: BigInt(await getAccountNonce(account.address)).toString(),
						passphrase: account.passphrase,
						passphrases,
						fee: convertLSKToBeddows('2'),
						networkIdentifier,
					});

					const { senderSignature, mandatorySignatures, optionalSignatures } = extractSignatures(
						tx,
						true,
					);

					const signatures = [
						senderSignature,
						...mandatorySignatures.map(() => ''),
						...optionalSignatures.map(() => ''),
					] as string[];

					await expect(postTransaction({ ...tx, signatures }, id)).rejects.toEqual({
						status: 409,
						response: {
							errors: [
								{
									message: 'A valid signature is required for each registered key.',
								},
							],
						},
					});
				});
			});

			describe('2 mandatory keys; 2 optional keys; Sender Signature present as first signature. All members signatures present but only Optional in order for each key group.', () => {
				it('should be rejected', async () => {
					const { id, tx } = registerMultisig({
						senderPublicKey: account.publicKey,
						mandatoryKeys: [account1.publicKey, account2.publicKey],
						optionalKeys: [account3.publicKey, account4.publicKey],
						numberOfSignatures: 4,
						nonce: BigInt(await getAccountNonce(account.address)).toString(),
						passphrase: account.passphrase,
						passphrases,
						fee: convertLSKToBeddows('2'),
						networkIdentifier,
					});

					const { senderSignature, mandatorySignatures, optionalSignatures } = extractSignatures(
						tx,
						true,
					);

					const signatures = [
						senderSignature,
						...mandatorySignatures.reverse(),
						...optionalSignatures,
					] as string[];

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

			describe('2 mandatory keys; 2 optional keys; Sender Signature present as last signature. All members signatures present.', () => {
				it('should be rejected', async () => {
					const { id, tx } = registerMultisig({
						senderPublicKey: account.publicKey,
						mandatoryKeys: [account1.publicKey, account2.publicKey],
						optionalKeys: [account3.publicKey, account4.publicKey],
						numberOfSignatures: 4,
						nonce: BigInt(await getAccountNonce(account.address)).toString(),
						passphrase: account.passphrase,
						passphrases,
						fee: convertLSKToBeddows('2'),
						networkIdentifier,
					});

					const { senderSignature, mandatorySignatures, optionalSignatures } = extractSignatures(
						tx,
						true,
					);

					const signatures = [
						...mandatorySignatures,
						...optionalSignatures,
						senderSignature,
					] as string[];

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

			describe('2 mandatory keys; 2 optional keys; Sender Signature not present. All members signatures present.', () => {
				it('should be rejected', async () => {
					const { id, tx } = registerMultisig({
						senderPublicKey: account.publicKey,
						mandatoryKeys: [account1.publicKey, account2.publicKey],
						optionalKeys: [account3.publicKey, account4.publicKey],
						numberOfSignatures: 4,
						nonce: BigInt(await getAccountNonce(account.address)).toString(),
						passphrase: account.passphrase,
						passphrases,
						fee: convertLSKToBeddows('2'),
						networkIdentifier,
					});

					const { mandatorySignatures, optionalSignatures } = extractSignatures(tx, true);

					const signatures = [...mandatorySignatures, ...optionalSignatures] as string[];

					await expect(postTransaction({ ...tx, signatures }, id)).rejects.toEqual({
						status: 409,
						response: {
							errors: [
								{
									message:
										'Error: The number of mandatory, optional and sender keys should match the number of signatures',
								},
							],
						},
					});
				});
			});

			describe('2 mandatory keys; Sender Signature present as first signature. Some members signatures present.', () => {
				it('should be rejected', async () => {
					const { id, tx } = registerMultisig({
						senderPublicKey: account.publicKey,
						mandatoryKeys: [account1.publicKey, account2.publicKey],
						optionalKeys: [],
						numberOfSignatures: 2,
						nonce: BigInt(await getAccountNonce(account.address)).toString(),
						passphrase: account.passphrase,
						passphrases,
						fee: convertLSKToBeddows('2'),
						networkIdentifier,
					});

					const { senderSignature, mandatorySignatures } = extractSignatures(tx, true);

					const signatures = [senderSignature, mandatorySignatures[0]] as string[];

					await expect(postTransaction({ ...tx, signatures }, id)).rejects.toEqual({
						status: 409,
						response: {
							errors: [
								{
									message:
										'Error: The number of mandatory, optional and sender keys should match the number of signatures',
								},
							],
						},
					});
				});
			});

			describe('2 optional keys; Sender Signature present as first signature. Some members signatures present.', () => {
				it('should be rejected', async () => {
					const { id, tx } = registerMultisig({
						senderPublicKey: account.publicKey,
						mandatoryKeys: [],
						optionalKeys: [account3.publicKey, account4.publicKey],
						numberOfSignatures: 2,
						nonce: BigInt(await getAccountNonce(account.address)).toString(),
						passphrase: account.passphrase,
						passphrases,
						fee: convertLSKToBeddows('2'),
						networkIdentifier,
					});

					const { senderSignature, optionalSignatures } = extractSignatures(tx, true);

					const signatures = [senderSignature, optionalSignatures[0]] as string[];

					await expect(postTransaction({ ...tx, signatures }, id)).rejects.toEqual({
						status: 409,
						response: {
							errors: [
								{
									message:
										'Error: The number of mandatory, optional and sender keys should match the number of signatures',
								},
							],
						},
					});
				});
			});
		});

		describe('When sender is member', () => {
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
				account = sender;
				passphrases = [account1, account2, account3, account4].map(a => a.passphrase);
				await waitForBlock({ heightOffset: 1 });
			});

			describe('2 mandatory keys; 2 optional keys; Sender Signature present as first signature and as member. All members signatures present.', () => {
				it('should be accepted', async () => {
					await expect(
						covertToMultisig({
							numberOfSignatures: 4,
							account,
							fee: '2',
							mandatoryKeys: [account.publicKey, account1.publicKey, account2.publicKey],
							optionalKeys: [account3.publicKey, account4.publicKey],
							passphrases,
						}),
					).resolves.not.toBeUndefined();
				});
			});

			describe('2 mandatory keys; Sender Signature present as first signature. All members signatures present.', () => {
				it('should be accepted', async () => {
					await expect(
						covertToMultisig({
							numberOfSignatures: 3,
							account,
							fee: '2',
							mandatoryKeys: [account.publicKey, account1.publicKey, account2.publicKey],
							optionalKeys: [],
							passphrases,
						}),
					).resolves.not.toBeUndefined();
				});
			});

			describe('2 optional keys; Sender Signature present as first signature. All members signatures present.', () => {
				it('should be accepted', async () => {
					await expect(
						covertToMultisig({
							numberOfSignatures: 3,
							account,
							fee: '2',
							mandatoryKeys: [],
							optionalKeys: [account.publicKey, account3.publicKey, account4.publicKey],
							passphrases,
						}),
					).resolves.not.toBeUndefined();
				});
			});
		});
	});
});
