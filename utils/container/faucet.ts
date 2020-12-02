import { APIClient } from '@liskhq/lisk-api-client';
import { convertLSKToBeddows } from '@liskhq/lisk-transactions';
import { AccountSeed } from './types';
import { Store } from './store';
import { transfer } from '../transactions';
import { Pool } from './pool';

export class Faucet {
	private _client: APIClient;
	private _store: Store;
	private _pool: Pool;
	private _networkIdentifier: Buffer;
	private _genesisAccount: AccountSeed;

	constructor(opts: {
		client: APIClient;
		store: Store;
		pool: Pool
		networkIdentifier: Buffer;
		genesisAccount: AccountSeed;
	}) {
		this._client = opts.client;
		this._networkIdentifier = opts.networkIdentifier;
		this._store = opts.store;
		this._genesisAccount = opts.genesisAccount;
		this._pool = opts.pool;
		console.log(typeof this._client);
	}

	async fundAccount(account: AccountSeed, balance: bigint | string): Promise<Buffer> {
		const genesisAccountNonce = await this._store.getAccountNonce(this._genesisAccount.address);
		const amount = (typeof balance === 'string' ? convertLSKToBeddows(balance) : balance) as bigint;

		const { tx, id } = transfer({
			recipientAddress: account.address,
			amount,
			fee: convertLSKToBeddows('0.1'),
			nonce: genesisAccountNonce.toString(),
			passphrase: this._genesisAccount.passphrase,
			networkIdentifier: this._networkIdentifier,
		});

		await this._pool.send(tx as never);

		return id;
	}

	async fundAccounts(accounts: AccountSeed[], balance: bigint | string): Promise<Buffer[]> {
		let genesisAccountNonce = await this._store.getAccountNonce(this._genesisAccount.address);
		const amount = (typeof balance === 'string' ? convertLSKToBeddows(balance) : balance) as bigint;
		const ids: Buffer[] = [];

		for (const account of accounts) {
			const { tx, id } = transfer({
				recipientAddress: account.address,
				amount,
				fee: convertLSKToBeddows('0.1'),
				nonce: genesisAccountNonce.toString(),
				passphrase: this._genesisAccount.passphrase,
				networkIdentifier: this._networkIdentifier,
			});

			this._pool.send(tx as never);

			genesisAccountNonce += BigInt(1);
			ids.push(id);
		}

		await this._pool.waitAllTxConfirmed();

		return ids;
	}
}
