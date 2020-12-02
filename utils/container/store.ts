import { APIClient } from '@liskhq/lisk-api-client';
import { Account } from './types';

export class Store {
	private _client: APIClient;
	private _networkIdentifier: Buffer;

	constructor(opts: { client: APIClient; networkIdentifier: Buffer }) {
		this._client = opts.client;
		this._networkIdentifier = opts.networkIdentifier;
		console.log(this._networkIdentifier);
	}

	async getAccountNonce(address: Buffer): Promise<bigint> {
		return (await this.getAccount(address)).sequence.nonce;
	}

	async getAccount(address: Buffer): Promise<Account> {
		return ((await this._client.account.get(address)) as unknown) as Account;
	}
}
