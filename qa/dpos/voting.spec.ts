import 'jest-extended';
import { getRandomBytes } from '@liskhq/lisk-cryptography';
import { AccountSeed } from '../../types';
import { buildAccount, buildAccounts, getAccount } from '../../utils/accounts';
import { registerDelegate, castVotes } from '../../utils/test';
import { waitForBlock } from '../../utils/network';
import { convertLSKToBeddows, convertBeddowsToLSK } from '../../utils/transactions';
import { Account } from '../../utils/api';

const voterBalance = 1000;
const votedAmountPerDelegate = 30;

describe('DPOS Voting', () => {
	let nonVotedDelegates: AccountSeed[] = [];
	let votedDelegates: AccountSeed[] = [];
	let voter: AccountSeed;

	beforeAll(async () => {
		// Create accounts
		voter = await buildAccount({ balance: voterBalance.toString() });
		await waitForBlock({ heightOffset: 1 });
		nonVotedDelegates = await buildAccounts({ balance: '20', count: 21 });
		await waitForBlock({ heightOffset: 1 });
		votedDelegates = await buildAccounts({ balance: '20', count: 8 });
		await waitForBlock({ heightOffset: 1 });

		// Convert delegate accounts to delegates
		for (let i = 0; i < nonVotedDelegates.length; i += 1) {
			await registerDelegate({
				account: nonVotedDelegates[i],
				username: `n${getRandomBytes(5).toString('hex')}${i}`,
				fee: '11',
			});
		}
		for (let i = 0; i < votedDelegates.length; i += 1) {
			await registerDelegate({
				account: votedDelegates[i],
				username: `d${getRandomBytes(5).toString('hex')}${i}`,
				fee: '11',
			});
		}
		await waitForBlock({ heightOffset: 1 });

		// Cast vote for votedDelegates
		await castVotes({
			voter,
			delegates: votedDelegates,
			fixedAmount: votedAmountPerDelegate.toString(),
		});
		await waitForBlock({ heightOffset: 1 });
		const updatedVoter = await getAccount(voter.address);

		expect(updatedVoter.dpos.sentVotes).toIncludeSameMembers(
			votedDelegates.map(d => ({
				delegateAddress: d.address.toString('hex'),
				amount: convertLSKToBeddows(votedAmountPerDelegate.toString()),
			})),
		);
	});

	describe('Vote with empty votes in transaction', () => {
		it('should fail', async () => {
			await expect(castVotes({ voter, delegates: [], fixedAmount: '10' })).rejects.toEqual({
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

	describe('Vote with more than 20 total votes mix of up-votes and down-votes', () => {
		it('should fail', async () => {
			const upVoteDelegates = nonVotedDelegates.slice(0, 10);
			const upVotes = Array(upVoteDelegates.length).fill('10') as string[];
			const downVoteDelegates = nonVotedDelegates.slice(10);
			const downVotes = Array(downVoteDelegates.length).fill('-10') as string[];

			const allDelegates = [...upVoteDelegates, ...downVoteDelegates];
			const allAmounts = [...upVotes, ...downVotes];

			expect(allDelegates).toHaveLength(21);
			await expect(
				castVotes({ voter, delegates: allDelegates, eachDelegateAmount: allAmounts }),
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

	describe('Vote for more than 10 up-votes', () => {
		it('should fail', async () => {
			await expect(
				castVotes({ voter, delegates: nonVotedDelegates.slice(0, 11), fixedAmount: '10' }),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'ValidationError: Upvote can only be casted upto 10',
						},
					],
				},
			});
		});
	});

	describe('Vote for more than 10 down-votes', () => {
		it('should fail', async () => {
			await expect(
				castVotes({ voter, delegates: nonVotedDelegates.slice(0, 11), fixedAmount: '-10' }),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'ValidationError: Downvote can only be casted upto 10',
						},
					],
				},
			});
		});
	});

	describe('Vote non delegate account', () => {
		it('should fail', async () => {
			const account = await buildAccount({ balance: '20' });
			await waitForBlock({ heightOffset: 1 });

			await expect(castVotes({ voter, delegates: [account], fixedAmount: '-10' })).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: `Voted delegate is not registered. Address: ${account.address.toString(
								'hex',
							)}`,
						},
					],
				},
			});
		});
	});

	describe('Vote delegate with more than balance', () => {
		it('should fail', async () => {
			await expect(
				castVotes({
					voter,
					delegates: [nonVotedDelegates[0]],
					fixedAmount: (voterBalance + 10).toString(),
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Remaining balance must be greater than 5000000',
						},
					],
				},
			});
		});
	});

	describe('Vote delegate with amount not multiple of 10LSK', () => {
		it('should fail', async () => {
			await expect(
				castVotes({ voter, delegates: [nonVotedDelegates[0]], fixedAmount: '9' }),
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

	describe('Vote twice for a delegate', () => {
		it('should fail', async () => {
			await expect(
				castVotes({
					voter,
					delegates: [nonVotedDelegates[0], nonVotedDelegates[0]],
					fixedAmount: '10',
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'ValidationError: Delegate address must be unique',
						},
					],
				},
			});
		});
	});

	describe('Down vote twice for a delegate', () => {
		it('should fail', async () => {
			await expect(
				castVotes({
					voter,
					delegates: [nonVotedDelegates[0], nonVotedDelegates[0]],
					fixedAmount: '-10',
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'ValidationError: Delegate address must be unique',
						},
					],
				},
			});
		});
	});

	describe('Down vote delegate who is not voted', () => {
		it('should fail', async () => {
			await expect(
				castVotes({
					voter,
					delegates: [nonVotedDelegates[0]],
					fixedAmount: '-10',
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Cannot cast downvote to delegate who is not upvoted',
						},
					],
				},
			});
		});
	});

	describe('Down vote delegate with more amount than voted', () => {
		it('should fail', async () => {
			await expect(
				castVotes({
					voter,
					delegates: [votedDelegates[0]],
					fixedAmount: (-2 * votedAmountPerDelegate).toString(),
				}),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Cannot downvote more than upvoted',
						},
					],
				},
			});
		});
	});

	describe('Down vote delegate with amount not multiple of 10LSK', () => {
		it('should fail', async () => {
			await expect(
				castVotes({ voter, delegates: [votedDelegates[0]], fixedAmount: '-9' }),
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

	describe('When already voted for a delegate', () => {
		it('should increase totalVotesReceived for that delegate', async () => {
			const delegate = await getAccount(votedDelegates[0].address);
			await castVotes({ voter, delegates: [votedDelegates[0]], fixedAmount: '10' });
			await waitForBlock({ heightOffset: 1 });
			const updatedDelegate = await getAccount(votedDelegates[0].address);

			expect(BigInt(updatedDelegate.dpos.delegate.totalVotesReceived)).toEqual(
				BigInt(delegate.dpos.delegate.totalVotesReceived) + BigInt(convertLSKToBeddows('10')),
			);
		});
	});

	describe('When valid up vote transaction for multiple delegates', () => {
		let delegate1: Account;
		let delegate2: Account;
		let updatedDelegate1: Account;
		let updatedDelegate2: Account;
		let account: Account;
		let updatedAccount: Account;
		const voteFee = '10';

		beforeAll(async () => {
			delegate1 = await getAccount(votedDelegates[0].address);
			delegate2 = await getAccount(votedDelegates[1].address);
			account = await getAccount(voter.address);
			await castVotes({
				voter,
				delegates: [votedDelegates[0], votedDelegates[1]],
				eachDelegateAmount: ['10', '30'],
				fee: voteFee,
			});
			await waitForBlock({ heightOffset: 1 });

			updatedDelegate1 = await getAccount(votedDelegates[0].address);
			updatedDelegate2 = await getAccount(votedDelegates[1].address);
			updatedAccount = await getAccount(voter.address);
		});

		it('should increase that particular delegates totalVotesReceived', () => {
			expect(BigInt(updatedDelegate1.dpos.delegate.totalVotesReceived)).toEqual(
				BigInt(delegate1.dpos.delegate.totalVotesReceived) + BigInt(convertLSKToBeddows('10')),
			);
			expect(BigInt(updatedDelegate2.dpos.delegate.totalVotesReceived)).toEqual(
				BigInt(delegate2.dpos.delegate.totalVotesReceived) + BigInt(convertLSKToBeddows('30')),
			);
		});

		it('should decrease account balance', () => {
			expect(BigInt(updatedAccount.token.balance)).toEqual(
				BigInt(account.token.balance) -
					BigInt(convertLSKToBeddows('10')) -
					BigInt(convertLSKToBeddows('30')) -
					BigInt(convertLSKToBeddows(voteFee)),
			);
		});
	});

	describe('When valid down vote transaction for multiple delegates', () => {
		let delegate1: Account;
		let delegate2: Account;
		let updatedDelegate1: Account;
		let updatedDelegate2: Account;
		let account: Account;
		let updatedAccount: Account;
		let lastBlockHeight: number;
		const voteFee = '10';

		beforeAll(async () => {
			delegate1 = await getAccount(votedDelegates[0].address);
			delegate2 = await getAccount(votedDelegates[1].address);
			account = await getAccount(voter.address);
			await castVotes({
				voter,
				delegates: [votedDelegates[0], votedDelegates[1]],
				eachDelegateAmount: ['-10', '-20'],
				fee: voteFee,
			});
			lastBlockHeight = (await waitForBlock({ heightOffset: 1 })).header.height;

			updatedDelegate1 = await getAccount(votedDelegates[0].address);
			updatedDelegate2 = await getAccount(votedDelegates[1].address);
			updatedAccount = await getAccount(voter.address);
		});

		it('should decrease that particular delegates totalVotesReceived', () => {
			expect(BigInt(updatedDelegate1.dpos.delegate.totalVotesReceived)).toEqual(
				BigInt(delegate1.dpos.delegate.totalVotesReceived) - BigInt(convertLSKToBeddows('10')),
			);
			expect(BigInt(updatedDelegate2.dpos.delegate.totalVotesReceived)).toEqual(
				BigInt(delegate2.dpos.delegate.totalVotesReceived) - BigInt(convertLSKToBeddows('20')),
			);
		});

		it('should have correct unlocking', () => {
			expect(account.dpos.unlocking).toEqual([]);
			expect(updatedAccount.dpos.unlocking).toIncludeSameMembers([
				{
					delegateAddress: delegate1.address,
					amount: convertLSKToBeddows('10'),
					unvoteHeight: lastBlockHeight,
				},
				{
					delegateAddress: delegate2.address,
					amount: convertLSKToBeddows('20'),
					unvoteHeight: lastBlockHeight,
				},
			]);
		});
	});

	describe('When up vote makes account sentVotes contains more than 10 votes', () => {
		it('should fail', async () => {
			const account = await getAccount(voter.address);
			const existingVotes = account.dpos.sentVotes.length;
			const moreVotes = 11 - existingVotes;

			await expect(
				castVotes({ voter, delegates: nonVotedDelegates.slice(0, moreVotes), fixedAmount: '10' }),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Account can only vote upto 10',
						},
					],
				},
			});
		});
	});

	describe('When having more than 20 unlocking objects for an account', () => {
		it('should fail', async () => {
			// There are 8 voted delegates and voted for 30 LSK
			// Let's down-vote 8 delegates at a time with 10 LSK
			// It should fail on 3rd transaction which will make unlocking to grow to 24
			await castVotes({ voter, delegates: votedDelegates, fixedAmount: '-10' });
			await waitForBlock({ heightOffset: 1 });
			await castVotes({ voter, delegates: votedDelegates, fixedAmount: '-10' });
			await waitForBlock({ heightOffset: 1 });

			await expect(
				castVotes({ voter, delegates: votedDelegates, fixedAmount: '-10' }),
			).rejects.toEqual({
				status: 409,
				response: {
					errors: [
						{
							message: 'Cannot downvote which exceeds account.dpos.unlocking to have more than 20',
						},
					],
				},
			});
		});
	});

	describe('When down vote make voted amount reaches to zero ', () => {
		it('should remove the voted delegate from sentVotes', async () => {
			const account = await getAccount(voter.address);
			const { delegateAddress, amount } = account.dpos.sentVotes[0];
			const delegate = votedDelegates.find(
				v => v.address.toString('hex') === delegateAddress,
			) as AccountSeed;
			await castVotes({
				voter,
				delegates: [delegate],
				fixedAmount: convertBeddowsToLSK(`-${amount}`),
			});
			await waitForBlock({ heightOffset: 1 });
			const updatedAccount = await getAccount(voter.address);
			const findVote = updatedAccount.dpos.sentVotes.find(
				v => v.delegateAddress === delegateAddress,
			);

			expect(findVote).toBeUndefined();
		});
	});
});
