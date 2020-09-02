import { AccountSeed } from '../types';
import { api, ServerResponse, TransactionCreateResponse } from './api';
import { convertLSKToBeddows, register } from './transactions';
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
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		throw new ServerResponse<typeof res>(res.status, await res.json());
	}
};
