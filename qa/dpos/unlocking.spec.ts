import 'jest-extended';
import { getRandomBytes } from '@liskhq/lisk-cryptography';
import { AccountSeed } from '../../types';
import { buildAccount, buildAccounts, getAccount } from '../../utils/accounts';
import { registerDelegate, castVotes, unlockFunds } from '../../utils/test';
import { waitForBlock } from '../../utils/network';
import { AccountJSON } from '../../utils/api';
import { convertLSKToBeddows } from '../../utils/transactions';

describe('DPOS Unlocking', () => {
	// Delegates which only have votes
	let onlyVotedDelegates: AccountSeed[] = [];
	const voteAmount = 30;

	// Delegates for which all votes are down-voted
	let fullyUnVotedDelegates: AccountSeed[] = [];
	const fullyUnVotedAmount = voteAmount;
	let fullyUnVotedHeight!: number;

	// Delegates for which we have some amount voted and some down-voted
	let votedAndUnVotedDelegates: AccountSeed[] = [];
	const votedAndUnVotedAmount = voteAmount - 10;
	let votedAndUnVotedHeight!: number;

	// Delegates which are not voted neither down-voted
	let newDelegates: AccountSeed[] = [];
	let voter: AccountSeed;
	let account: AccountSeed;

	beforeAll(async () => {
		// Create accounts
		voter = await buildAccount({ balance: '1000' });
		await waitForBlock({ heightOffset: 1 });
		console.info('Sender account created...');

		account = await buildAccount({ balance: '1000' });
		await waitForBlock({ heightOffset: 1 });
		console.info('Random account created...');

		onlyVotedDelegates = await buildAccounts({ balance: '20', count: 3 });
		await waitForBlock({ heightOffset: 1 });
		console.info('onlyUpVotedDelegates accounts created...');

		fullyUnVotedDelegates = await buildAccounts({ balance: '20', count: 3 });
		await waitForBlock({ heightOffset: 1 });
		console.info('onlyDownVotedDelegates accounts created...');

		votedAndUnVotedDelegates = await buildAccounts({ balance: '20', count: 3 });
		await waitForBlock({ heightOffset: 1 });
		console.info('upVotedAndDownVotedDelegates accounts created...');

		newDelegates = await buildAccounts({ balance: '20', count: 2 });
		await waitForBlock({ heightOffset: 1 });
		console.info('newDelegates accounts created...');

		// Convert delegate accounts to delegates
		for (let i = 0; i < onlyVotedDelegates.length; i += 1) {
			await registerDelegate({
				account: onlyVotedDelegates[i],
				username: `n${getRandomBytes(5).toString('hex')}${i}`,
				fee: '11',
			});
		}
		for (let i = 0; i < fullyUnVotedDelegates.length; i += 1) {
			await registerDelegate({
				account: fullyUnVotedDelegates[i],
				username: `d${getRandomBytes(5).toString('hex')}${i}`,
				fee: '11',
			});
		}
		for (let i = 0; i < votedAndUnVotedDelegates.length; i += 1) {
			await registerDelegate({
				account: votedAndUnVotedDelegates[i],
				username: `d${getRandomBytes(5).toString('hex')}${i}`,
				fee: '11',
			});
		}
		for (let i = 0; i < newDelegates.length; i += 1) {
			await registerDelegate({
				account: newDelegates[i],
				username: `d${getRandomBytes(5).toString('hex')}${i}`,
				fee: '11',
			});
		}
		await waitForBlock({ heightOffset: 2 });
		console.info('All delegate accounts registered as delegates...');

		// Cast up-votes and down-votes
		await castVotes({
			voter,
			delegates: onlyVotedDelegates,
			fixedAmount: voteAmount.toString(),
		});
		await waitForBlock({ heightOffset: 1 });
		console.info('Up vote casted for onlyUpVotedDelegates...');

		await castVotes({
			voter,
			delegates: fullyUnVotedDelegates,
			fixedAmount: voteAmount.toString(),
		});
		await waitForBlock({ heightOffset: 1 });
		console.info('Up vote casted for onlyDownVotedDelegates...');

		await castVotes({
			voter,
			delegates: fullyUnVotedDelegates,
			fixedAmount: `-${fullyUnVotedAmount.toString()}`,
		});
		fullyUnVotedHeight = (await waitForBlock({ heightOffset: 1 })).header.height;
		console.info('Down vote casted for onlyDownVotedDelegates...');

		await castVotes({
			voter,
			delegates: votedAndUnVotedDelegates,
			fixedAmount: voteAmount.toString(),
		});
		await waitForBlock({ heightOffset: 1 });
		console.info('Up vote casted for upVotedAndDownVotedDelegates...');

		await castVotes({
			voter,
			delegates: votedAndUnVotedDelegates,
			fixedAmount: `-${votedAndUnVotedAmount.toString()}`,
		});
		votedAndUnVotedHeight = (await waitForBlock({ heightOffset: 1 })).header.height;
		console.info('Down vote casted for upVotedAndDownVotedDelegates...');
		console.info({ fullyUnVotedHeight, votedAndUnVotedHeight });
	});

	describe('Unlock transaction with empty unlocking array', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({ voter, delegates: [], fixedAmount: '10', fixedUnVoteHeight: 10 }),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								'Error: Lisk validator found 1 error[s]:\nshould NOT have fewer than 1 items',
						},
					],
				},
			});
		});
	});

	describe('Unlock transaction with more than 20 unlocking objects', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({
					voter,
					delegates: [
						...onlyVotedDelegates,
						...onlyVotedDelegates,
						...onlyVotedDelegates,
						...onlyVotedDelegates,
						...onlyVotedDelegates,
						...onlyVotedDelegates,
						...onlyVotedDelegates,
					],
					fixedAmount: '10',
					fixedUnVoteHeight: 10,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								'Error: Lisk validator found 1 error[s]:\nshould NOT have more than 20 items',
						},
					],
				},
			});
		});
	});

	describe('Unlock with an zero amount', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({
					voter,
					delegates: onlyVotedDelegates,
					fixedAmount: '0',
					fixedUnVoteHeight: 10,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'ValidationError: Amount cannot be less than or equal to zero',
						},
					],
				},
			});
		});
	});

	// Can't test it as can't serialize to sign the transaction
	describe.skip('Unlock with an negative amount', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({
					voter,
					delegates: [onlyVotedDelegates[0]],
					fixedAmount: '-10',
					fixedUnVoteHeight: 10,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								'Error: Lisk validator found 1 error[s]:\nProperty \'.unlockObjects[0].amount\' should pass "dataType" keyword validation',
						},
					],
				},
			});
		});
	});

	// Can't test it as can't serialize to sign the transaction
	describe.skip('Unlock with zero unlock height', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({
					voter,
					delegates: onlyVotedDelegates,
					fixedAmount: '10',
					fixedUnVoteHeight: 0,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								'Error: Lisk validator found 1 error[s]:\nshould NOT have more than 20 items',
						},
					],
				},
			});
		});
	});

	// Can't test it as can't serialize to sign the transaction
	describe.skip('Unlock with negative unlock height', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({
					voter,
					delegates: [onlyVotedDelegates[0]],
					fixedAmount: '10',
					fixedUnVoteHeight: -10,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message:
								'Error: Lisk validator found 1 error[s]:\nProperty \'.unlockObjects[0].unvoteHeight\' should pass "dataType" keyword validation',
						},
					],
				},
			});
		});
	});

	describe('Unlock with an amount not multiple of 10LSK', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({
					voter,
					delegates: onlyVotedDelegates,
					fixedAmount: '9',
					fixedUnVoteHeight: 10,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'ValidationError: Amount should be multiple of 10 * 10^8',
						},
					],
				},
			});
		});
	});

	describe('Unlock for an account which is not a delegate', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({
					voter,
					delegates: [account],
					fixedAmount: '10',
					fixedUnVoteHeight: 10,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Voted account is not registered as delegate',
						},
					],
				},
			});
		});
	});

	describe('Unlock for an delegate which is not down voted earlier', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({
					voter,
					delegates: newDelegates,
					fixedAmount: '10',
					fixedUnVoteHeight: 10,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Corresponding unlocking object not found',
						},
					],
				},
			});
		});
	});

	describe('Unlock for an amount which is not down-voted earlier', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({
					voter,
					delegates: fullyUnVotedDelegates,
					fixedAmount: '90',
					fixedUnVoteHeight: 10,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Corresponding unlocking object not found',
						},
					],
				},
			});
		});
	});

	describe('Unlock for a height which is not down-voted earlier', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({
					voter,
					delegates: fullyUnVotedDelegates,
					fixedAmount: voteAmount.toString(),
					fixedUnVoteHeight: 2,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Corresponding unlocking object not found',
						},
					],
				},
			});
		});
	});

	describe('Unlock with multiple unlock objects for same delegates and not already down voted multiple times', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({
					voter,
					delegates: [fullyUnVotedDelegates[0], fullyUnVotedDelegates[0]],
					eachDelegateAmount: [fullyUnVotedAmount.toString(), '10'],
					eachDelegateHeightUnVoteHeight: [fullyUnVotedHeight, fullyUnVotedHeight],
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Unlocking is not permitted as it is still within the waiting period',
						},
					],
				},
			});
		});
	});

	describe('Unlock with duplicate unlock objects', () => {
		it('should fail', async () => {
			await expect(
				unlockFunds({
					voter,
					delegates: [fullyUnVotedDelegates[0], fullyUnVotedDelegates[0]],
					fixedAmount: fullyUnVotedAmount.toString(),
					fixedUnVoteHeight: fullyUnVotedHeight,
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Unlocking is not permitted as it is still within the waiting period',
						},
					],
				},
			});
		});
	});

	describe('Delegate Vote', () => {
		describe('Unlock amount which has not waited for 2000 blocks', () => {
			it('should fail', async () => {
				await expect(
					unlockFunds({
						voter,
						delegates: [fullyUnVotedDelegates[0]],
						fixedAmount: fullyUnVotedAmount.toString(),
						fixedUnVoteHeight: fullyUnVotedHeight,
					}),
				).rejects.toEqual({
					status: 409,
					response: {
						errors: [
							{
								message: 'Unlocking is not permitted as it is still within the waiting period',
							},
						],
					},
				});
			});
		});

		// To test this you need to change the wait time to low in SDK and here and then test
		describe.skip('Unlock amount which has waited for 2000 blocks', () => {
			const WAIT_TIME_VOTE = 2000;
			let voterAccount: AccountJSON;
			let voterUpdatedAccount: AccountJSON;

			beforeAll(async () => {
				console.info('%%%%%%% before all execute');
				await waitForBlock({ height: fullyUnVotedHeight + WAIT_TIME_VOTE });
				voterAccount = await getAccount(voter.address);
				await unlockFunds({
					voter,
					delegates: [fullyUnVotedDelegates[0], fullyUnVotedDelegates[1]],
					fixedAmount: fullyUnVotedAmount.toString(),
					fixedUnVoteHeight: fullyUnVotedHeight,
				});
				await waitForBlock({ heightOffset: 1 });
				voterUpdatedAccount = await getAccount(voter.address);
			});

			it('should credit the amount to sender account', () => {
				expect(BigInt(voterUpdatedAccount.token.balance)).toEqual(
					BigInt(voterAccount.token.balance) +
						BigInt(2) * BigInt(convertLSKToBeddows(fullyUnVotedAmount.toString())),
				);
			});

			it('should remove particular unlocking from the sender account', () => {
				expect(
					voterAccount.dpos.unlocking.find(
						v => v.delegateAddress === fullyUnVotedDelegates[0].address.toString('hex'),
					),
				).not.toBeUndefined();

				expect(
					voterAccount.dpos.unlocking.find(
						v => v.delegateAddress === fullyUnVotedDelegates[1].address.toString('hex'),
					),
				).not.toBeUndefined();

				expect(
					voterUpdatedAccount.dpos.unlocking.find(
						v => v.delegateAddress === fullyUnVotedDelegates[0].address.toString('hex'),
					),
				).toBeUndefined();

				expect(
					voterUpdatedAccount.dpos.unlocking.find(
						v => v.delegateAddress === fullyUnVotedDelegates[1].address.toString('hex'),
					),
				).toBeUndefined();
			});
		});
	});

	describe('Self Vote', () => {
		let selfVoter: AccountSeed;
		let selfUnVoteHeight: number;

		beforeAll(async () => {
			// Create self voter delegate accounts
			selfVoter = await buildAccount({ balance: '1000' });
			await waitForBlock({ heightOffset: 1 });
			console.info('Self voter account created...');

			await registerDelegate({
				account: selfVoter,
				username: `s${getRandomBytes(5).toString('hex')}`,
				fee: '11',
			});
			await waitForBlock({ heightOffset: 2 });
			console.info('Self delegate account registered as delegate...');

			await castVotes({
				voter: selfVoter,
				delegates: [selfVoter],
				fixedAmount: '100',
			});
			await waitForBlock({ heightOffset: 1 });
			console.info('Self delegate voted for itself...');

			await castVotes({
				voter: selfVoter,
				delegates: [selfVoter],
				fixedAmount: '-40',
			});
			selfUnVoteHeight = (await waitForBlock({ heightOffset: 1 })).header.height;
			console.info('Self delegate un-voted for itself...');
		});

		describe('Unlock amount which has not waited for 260000 blocks', () => {
			it('should fail', async () => {
				await expect(
					unlockFunds({
						voter: selfVoter,
						delegates: [selfVoter],
						fixedAmount: '40',
						fixedUnVoteHeight: selfUnVoteHeight,
					}),
				).rejects.toEqual({
					status: 409,
					response: {
						errors: [
							{
								message: 'Unlocking is not permitted as it is still within the waiting period',
							},
						],
					},
				});
			});
		});

		// To test this you need to change the wait time to low in SDK and here and then test
		describe.skip('Unlock amount which has waited for 260000 blocks', () => {
			const WAIT_TIME_SELF_VOTE = 260000;
			let selfVoterAccount: AccountJSON;
			let selfVoterUpdatedAccount: AccountJSON;

			beforeAll(async () => {
				await waitForBlock({ height: selfUnVoteHeight + WAIT_TIME_SELF_VOTE });
				selfVoterAccount = await getAccount(voter.address);
				await unlockFunds({
					voter: selfVoter,
					delegates: [selfVoter],
					fixedAmount: '40',
					fixedUnVoteHeight: selfUnVoteHeight,
				});
				await waitForBlock({ heightOffset: 1 });
				selfVoterUpdatedAccount = await getAccount(voter.address);
			});

			it('should credit the amount to sender account', () => {
				expect(BigInt(selfVoterUpdatedAccount.token.balance)).toEqual(
					BigInt(selfVoterAccount.token.balance) + BigInt(convertLSKToBeddows('40')),
				);
			});

			it('should remove particular unlocking from the sender account', () => {
				expect(
					selfVoterAccount.dpos.unlocking.find(
						v => v.delegateAddress === selfVoter.address.toString('hex'),
					),
				).not.toBeUndefined();

				expect(
					selfVoterAccount.dpos.unlocking.find(
						v => v.delegateAddress === selfVoter.address.toString('hex'),
					),
				).not.toBeUndefined();

				expect(
					selfVoterUpdatedAccount.dpos.unlocking.find(
						v => v.delegateAddress === selfVoter.address.toString('hex'),
					),
				).toBeUndefined();

				expect(
					selfVoterUpdatedAccount.dpos.unlocking.find(
						v => v.delegateAddress === selfVoter.address.toString('hex'),
					),
				).toBeUndefined();
			});
		});
	});
});
