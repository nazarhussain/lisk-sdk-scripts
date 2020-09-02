import { AccountSeed } from '../types';
import { api, ServerResponse, TransactionCreateResponse } from './api';
import { convertLSKToBeddows, register, vote, unlock } from './transactions';
import { getAccountNonce } from './accounts';
import { networkIdentifier } from './network';

export const registerDelegate = async ({
	account,
	username,
	fee,
}: {
	account: AccountSeed;
	username: string;
	fee: string;
}): Promise<ServerResponse<TransactionCreateResponse>> => {
	const { id, tx } = register({
		senderPublicKey: account.publicKey,
		username,
		nonce: BigInt(await getAccountNonce(account.address)).toString(),
		passphrase: account.passphrase,
		fee: convertLSKToBeddows(fee),
		networkIdentifier,
	});

	try {
		const res = await api.http.transactions.transactionsPost(tx);

		expect(res.data.transactionId).toEqual(id);

		return new ServerResponse<typeof res>(200, res);
	} catch (res) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
		const response = await res.json();
		console.error('Error during delegate registration');
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		console.error(response);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		throw new ServerResponse<typeof res>(res.status, response);
	}
};

export const castVotes = async ({
	voter,
	delegates,
	fixedAmount,
	eachDelegateAmount,
	fee,
}:
	| {
			voter: AccountSeed;
			delegates: AccountSeed[];
			fee?: string;
			fixedAmount?: string;
			eachDelegateAmount: string[];
	  }
	| {
			voter: AccountSeed;
			delegates: AccountSeed[];
			fee?: string;
			fixedAmount: string;
			eachDelegateAmount?: string[];
	  }): Promise<ServerResponse<TransactionCreateResponse>> => {
	let voteAmount: bigint[];

	if (fixedAmount) {
		voteAmount = Array(delegates.length).fill(BigInt(convertLSKToBeddows(fixedAmount))) as bigint[];
	} else if (eachDelegateAmount) {
		voteAmount = eachDelegateAmount.map(d => BigInt(convertLSKToBeddows(d)));
	}

	const votes = delegates.map((d, index) => ({
		delegateAddress: d.address,
		amount: voteAmount[index],
	}));

	const { id, tx } = vote({
		senderPublicKey: voter.publicKey,
		votes,
		nonce: BigInt(await getAccountNonce(voter.address)).toString(),
		passphrase: voter.passphrase,
		fee: convertLSKToBeddows(fee ?? '0.2'),
		networkIdentifier,
	});

	try {
		const res = await api.http.transactions.transactionsPost(tx);

		expect(res.data.transactionId).toEqual(id);

		return new ServerResponse<typeof res>(200, res);
	} catch (res) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
		const response = await res.json();
		console.error('Error during vote casting.');
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		console.error(response);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		throw new ServerResponse<typeof res>(res.status, response);
	}
};

export const unlockFunds = async ({
	voter,
	delegates,
	fixedAmount,
	eachDelegateAmount,
	fixedUnVoteHeight,
	eachDelegateHeightUnVoteHeight,
	fee,
}:
	| {
			voter: AccountSeed;
			delegates: AccountSeed[];
			fee?: string;
			fixedAmount?: string;
			eachDelegateAmount: string[];
			fixedUnVoteHeight?: number;
			eachDelegateHeightUnVoteHeight: number[];
	  }
	| {
			voter: AccountSeed;
			delegates: AccountSeed[];
			fee?: string;
			fixedAmount: string;
			eachDelegateAmount?: string[];
			fixedUnVoteHeight: number;
			eachDelegateHeightUnVoteHeight?: number[];
	  }): Promise<ServerResponse<TransactionCreateResponse>> => {
	let voteAmount: bigint[];
	let unVoteHeight: number[];

	if (fixedAmount) {
		voteAmount = Array(delegates.length).fill(BigInt(convertLSKToBeddows(fixedAmount))) as bigint[];
	} else if (eachDelegateAmount) {
		voteAmount = eachDelegateAmount.map(d => BigInt(convertLSKToBeddows(d)));
	}

	if (fixedUnVoteHeight) {
		unVoteHeight = Array(delegates.length).fill(fixedUnVoteHeight) as number[];
	} else if (eachDelegateHeightUnVoteHeight) {
		unVoteHeight = eachDelegateHeightUnVoteHeight;
	}

	const unlockObjects = delegates.map((d, index) => ({
		delegateAddress: d.address,
		amount: voteAmount[index],
		unvoteHeight: unVoteHeight[index],
	}));

	const { id, tx } = unlock({
		senderPublicKey: voter.publicKey,
		unlockObjects,
		nonce: BigInt(await getAccountNonce(voter.address)).toString(),
		passphrase: voter.passphrase,
		fee: convertLSKToBeddows(fee ?? '0.2'),
		networkIdentifier,
	});

	try {
		const res = await api.http.transactions.transactionsPost(tx);

		expect(res.data.transactionId).toEqual(id);

		return new ServerResponse<typeof res>(200, res);
	} catch (res) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		throw new ServerResponse<typeof res>(res.status, await res.json());
	}
};
