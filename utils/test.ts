import { BlockHeader } from '@liskhq/lisk-chain';
import { AccountSeed } from '../types';
import { api, ServerResponse, TransactionCreateResponse, TransactionRequest } from './api';
import { convertLSKToBeddows, register, vote, unlock, transfer } from './transactions';
import { getAccountNonce, genesisAccount } from './accounts';
import { networkIdentifier as devnetNetworkIdentifier } from './network';
import { proofMisbehavior } from './transactions/dpos/pom';
import { registerMultisig } from './transactions/keys/register_multisig';

const DEBUG_RESPONSE = 0;

// eslint-disable-next-line @typescript-eslint/no-empty-function, no-console
const debug = DEBUG_RESPONSE ? console.debug : (..._data: any[]): void => {};

export const postTransaction = async (
	tx: TransactionRequest,
	id?: string,
): Promise<ServerResponse<TransactionCreateResponse>> => {
	try {
		const res = await api.http.transactions.transactionsPost(tx);

		if (id) {
			expect(res.data.transactionId).toEqual(id);
		}

		return new ServerResponse<TransactionCreateResponse>(200, res);
	} catch (res) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
		const response = await res.json();
		debug('Error during delegate registration');
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		debug(response);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		throw new ServerResponse<TransactionCreateResponse>(res.status, response);
	}
};

export const transferTokens = async ({
	amount,
	recipientAddress,
	senderAddress,
	passphrase,
	networkIdentifier,
}:
	| {
			amount: string;
			recipientAddress: Buffer;
			networkIdentifier?: Buffer;
			senderAddress?: Buffer;
			passphrase?: string;
	  }
	| {
			amount: string;
			recipientAddress: Buffer;
			networkIdentifier?: Buffer;
			senderAddress: Buffer;
			passphrase: string;
	  }): Promise<ServerResponse<TransactionCreateResponse>> => {
	const senderAccountNonce = BigInt(await getAccountNonce(senderAddress ?? genesisAccount.address));

	const { id, tx } = transfer({
		recipientAddress,
		amount: convertLSKToBeddows(amount),
		fee: convertLSKToBeddows('0.1'),
		nonce: senderAccountNonce.toString(),
		passphrase: passphrase ?? genesisAccount.passphrase,
		networkIdentifier: networkIdentifier ?? devnetNetworkIdentifier,
	});

	return postTransaction(tx, id);
};

export const covertToMultisig = async ({
	account,
	optionalKeys,
	mandatoryKeys,
	numberOfSignatures,
	fee,
	passphrases,
	networkIdentifier,
	overrideSignatures,
}: {
	account: AccountSeed;
	networkIdentifier?: Buffer;
	fee: string;
	optionalKeys: Buffer[];
	mandatoryKeys: Buffer[];
	passphrases: string[];
	numberOfSignatures: number;
	overrideSignatures?: Buffer[];
}): Promise<ServerResponse<TransactionCreateResponse>> => {
	const { id, tx } = registerMultisig({
		senderPublicKey: account.publicKey,
		mandatoryKeys,
		optionalKeys,
		numberOfSignatures,
		nonce: BigInt(await getAccountNonce(account.address)).toString(),
		passphrase: account.passphrase,
		passphrases,
		fee: convertLSKToBeddows(fee),
		networkIdentifier: networkIdentifier ?? devnetNetworkIdentifier,
	});

	if (overrideSignatures) {
		tx.signatures = overrideSignatures.map(s => s.toString('hex'));
	}

	return postTransaction(tx, id);
};

export const registerDelegate = async ({
	account,
	username,
	fee,
	networkIdentifier,
}: {
	account: AccountSeed;
	username: string;
	networkIdentifier?: Buffer;
	fee: string;
}): Promise<ServerResponse<TransactionCreateResponse>> => {
	const { id, tx } = register({
		senderPublicKey: account.publicKey,
		username,
		nonce: BigInt(await getAccountNonce(account.address)).toString(),
		passphrase: account.passphrase,
		fee: convertLSKToBeddows(fee),
		networkIdentifier: networkIdentifier ?? devnetNetworkIdentifier,
	});

	return postTransaction(tx, id);
};

export const castVotes = async ({
	voter,
	delegates,
	fixedAmount,
	eachDelegateAmount,
	networkIdentifier,
	fee,
}:
	| {
			voter: AccountSeed;
			delegates: AccountSeed[];
			networkIdentifier?: Buffer;
			fee?: string;
			fixedAmount?: string;
			eachDelegateAmount: string[];
	  }
	| {
			voter: AccountSeed;
			delegates: AccountSeed[];
			networkIdentifier?: Buffer;
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
		networkIdentifier: networkIdentifier ?? devnetNetworkIdentifier,
	});

	return postTransaction(tx, id);
};

export const unlockFunds = async ({
	voter,
	delegates,
	fixedAmount,
	eachDelegateAmount,
	fixedUnVoteHeight,
	eachDelegateHeightUnVoteHeight,
	networkIdentifier,
	fee,
}:
	| {
			voter: AccountSeed;
			delegates: AccountSeed[];
			networkIdentifier?: Buffer;
			fee?: string;
			fixedAmount?: string;
			eachDelegateAmount: string[];
			fixedUnVoteHeight?: number;
			eachDelegateHeightUnVoteHeight: number[];
	  }
	| {
			voter: AccountSeed;
			delegates: AccountSeed[];
			networkIdentifier?: Buffer;
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
		networkIdentifier: networkIdentifier ?? devnetNetworkIdentifier,
	});

	return postTransaction(tx, id);
};

export const claimMisbehavior = async ({
	account,
	header1,
	header2,
	fee,
	networkIdentifier,
}: {
	account: AccountSeed;
	header1: BlockHeader;
	header2: BlockHeader;
	networkIdentifier?: Buffer;
	fee?: string;
}): Promise<ServerResponse<TransactionCreateResponse>> => {
	const { id, tx } = proofMisbehavior({
		senderPublicKey: account.publicKey,
		header1,
		header2,
		nonce: BigInt(await getAccountNonce(account.address)).toString(),
		passphrase: account.passphrase,
		fee: convertLSKToBeddows(fee ?? '0.2'),
		networkIdentifier: networkIdentifier ?? devnetNetworkIdentifier,
	});

	return postTransaction(tx, id);
};
