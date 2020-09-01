import {
	getRandomBytes,
	getAddressFromPassphrase,
	getPrivateAndPublicKeyFromPassphrase,
} from '@liskhq/lisk-cryptography';
import * as genesisDelegates from '../fixtures/accounts/devnet/genesis_delegates.json';

import { api } from './api';
import { AccountSeed } from '../types';
import * as genesisAccountFixture from '../fixtures/accounts/devnet/genesis_account.json';

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
