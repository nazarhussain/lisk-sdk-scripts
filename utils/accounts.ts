import { Account } from 'lisk-http-api-client/api';
import {
	getRandomBytes,
	getAddressFromPassphrase,
	getPrivateAndPublicKeyFromPassphrase,
} from '@liskhq/lisk-cryptography';
import * as genesisDelegates from '../fixtures/accounts/devnet/genesis_delegates.json';
import { api, ServerResponse } from './api';
import { AccountSeed } from '../types';
import * as genesisAccountFixture from '../fixtures/accounts/devnet/genesis_account.json';
import { convertLSKToBeddows, transfer } from './transactions';
import { networkIdentifier } from './network';

export const genesisAccount = {
	address: Buffer.from(genesisAccountFixture.address, 'hex'),
	publicKey: Buffer.from(genesisAccountFixture.publicKey, 'hex'),
	passphrase: genesisAccountFixture.passphrase,
};

export const generateRandomAccount = (): AccountSeed => {
	const passphrase = getRandomBytes(20).toString('hex');
	const address = getAddressFromPassphrase(passphrase);
	const { publicKey, privateKey } = getPrivateAndPublicKeyFromPassphrase(passphrase);

	return { passphrase, publicKey, privateKey, nonce: BigInt(0), address };
};

export const getGenesisDelegatesKeyPair = (
	generatorPublicKey: string,
): Record<string, unknown> | undefined =>
	genesisDelegates.find(({ publicKey }) => publicKey === generatorPublicKey);

export const getAccountNonce = async (address: Buffer): Promise<bigint> => {
	const result = await api.http.accounts.accountsAddressGet(address.toString('hex'));
	return BigInt(result.data.sequence.nonce);
};

export const getAccount = async (address: Buffer): Promise<Account> =>
	(await api.http.accounts.accountsAddressGet(address.toString('hex'))).data;

export const buildAccount = async ({ balance }: { balance: string }): Promise<AccountSeed> => {
	const account = generateRandomAccount();
	const genesisAccountNonce = BigInt(await getAccountNonce(genesisAccount.address));
	const { tx } = transfer({
		recipientAddress: account.address,
		amount: convertLSKToBeddows(balance),
		fee: convertLSKToBeddows('0.1'),
		nonce: genesisAccountNonce.toString(),
		passphrase: genesisAccount.passphrase,
		networkIdentifier,
	});

	await api.http.transactions.transactionsPost(tx);

	return account;
};

export const buildAccounts = async ({
	balance,
	count,
}: {
	balance: string;
	count: number;
}): Promise<AccountSeed[]> => {
	const accounts: AccountSeed[] = [];
	const genesisAccountNonce = BigInt(await getAccountNonce(genesisAccount.address));

	for (let i = 0; i < count; i += 1) {
		const account = generateRandomAccount();
		const { tx } = transfer({
			recipientAddress: account.address,
			amount: convertLSKToBeddows(balance),
			fee: convertLSKToBeddows('0.1'),
			nonce: (genesisAccountNonce + BigInt(i)).toString(),
			passphrase: genesisAccount.passphrase,
			networkIdentifier,
		});

		try {
			await api.http.transactions.transactionsPost(tx);
		} catch (res) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
			const error = await res.json();
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
			throw new ServerResponse<typeof res>(res.status, error);
		}
		accounts.push(account);
	}

	return accounts;
};
