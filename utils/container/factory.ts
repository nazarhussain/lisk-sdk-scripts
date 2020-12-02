import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { APIClient } from '@liskhq/lisk-api-client';
import {
	getRandomBytes,
	getPrivateAndPublicKeyFromPassphrase,
	getAddressFromPassphrase,
} from '@liskhq/lisk-cryptography';
import { AccountSeed } from './types';

export class Factory {
	private _client: APIClient;
	private _networkIdentifier: Buffer;
	private _accountsCache: { [key: string]: AccountSeed[] };

	constructor(opts: { client: APIClient; networkIdentifier: Buffer }) {
		this._client = opts.client;
		this._networkIdentifier = opts.networkIdentifier;
		this._accountsCache = {};
		console.log(typeof this._client);
		console.log(typeof this._networkIdentifier);
	}

	// eslint-disable-next-line class-methods-use-this
	public generateRandomAccount(): AccountSeed {
		const passphrase = getRandomBytes(20).toString('hex');
		const address = getAddressFromPassphrase(passphrase);
		const { publicKey, privateKey } = getPrivateAndPublicKeyFromPassphrase(passphrase);

		return { passphrase, publicKey, privateKey, address };
	}

	generateRandomAccounts(label: string, count: number, force: true): AccountSeed[] {
		if (this._accountsCache[label] && !force) {
			return this._accountsCache[label];
		}

		this._accountsCache[label] = Array(count)
			.fill(0)
			.map(() => this.generateRandomAccount());

		return this._accountsCache[label];
	}

	loadOrGenerateRandomAccounts(label: string, count: number, force: true): AccountSeed[] {
		const fileName = resolve(`${process.cwd()}/cache/${label}.json`);
		if (existsSync(fileName)) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			return JSON.parse(readFileSync(fileName, 'utf8')).map(
				(a: {
					address: string;
					publicKey: string;
					privateKey: string;
					passphrase: string;
				}): AccountSeed =>
					(({
						address: Buffer.from(a.address, 'hex'),
						publicKey: Buffer.from(a.publicKey, 'hex'),
						privateKey: Buffer.from(a.privateKey, 'hex'),
						passphrase: a.passphrase,
					} as unknown) as AccountSeed),
			) as AccountSeed[];
		}

		const accounts = this.generateRandomAccounts(label, count, force);
		mkdirSync(dirname(fileName), { recursive: true });
		writeFileSync(
			fileName,
			JSON.stringify(
				accounts.map(a => ({
					address: a.address.toString('hex'),
					publicKey: a.publicKey.toString('hex'),
					privateKey: a.privateKey.toString('hex'),
					passphrase: a.passphrase,
				})),
			),
		);

		return accounts;
	}

	getAccounts(label: string): AccountSeed[] {
		return this._accountsCache[label];
	}
}
