import { utils } from 'lisk-sdk';
import { APIClient } from '@liskhq/lisk-api-client';
import { SignedTransactionObject } from '../transactions/common';

const WAIT_FREQUENCY = 100;

export class Pool {
	private _client: APIClient;
	private _maxTransactions: number;
	private _maxTransactionsPerAccount: number;
	private _queue: SignedTransactionObject<unknown>[];
	private _accountMap: { [key: string]: number };
	private _txSendingJob: utils.jobHandlers.Scheduler<void>;

	constructor(opts: {
		client: APIClient;
		maxTransactions?: number;
		maxTransactionsPerAccount?: number;
	}) {
		this._client = opts.client;
		this._maxTransactions = opts.maxTransactions ?? 4096;
		this._maxTransactionsPerAccount = opts.maxTransactionsPerAccount ?? 64;
		this._queue = [];
		this._accountMap = {};
		this._txSendingJob = new utils.jobHandlers.Scheduler(() => this._sendJob(), 100);
		this._client.subscribe('app:block:new', data => this._onNewBlock(data));
		// To be used later
		console.info(this._maxTransactions);
	}

	reset(options: { maxTransactions: number; maxTransactionsPerAccount: number }): void {
		this._maxTransactions = options.maxTransactions;
		this._maxTransactionsPerAccount = options.maxTransactionsPerAccount;
	}

	send(tx: SignedTransactionObject<never>): void {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		this._txSendingJob.start();
		this._queue.push(tx);
		const senderKey = tx.senderPublicKey.toString('hex');
		if (!this._accountMap[senderKey]) {
			this._accountMap[senderKey] = 0;
		}
	}

	async waitAllTxToSend(): Promise<void> {
		let id;

		// eslint-disable-next-line consistent-return
		const checkTx = cb => {
			if (id) {
				clearTimeout(id);
			}
			if (this._queue.length === 0) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
				return cb();
			}

			id = setTimeout(checkTx, WAIT_FREQUENCY, cb);
		};

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return new Promise(resolve => {
			checkTx(resolve);
		});
	}

	async waitAllTxConfirmed(): Promise<void> {
		let id;

		// eslint-disable-next-line consistent-return
		const checkTx = cb => {
			if (id) {
				clearTimeout(id);
			}
			if (
				Object.values(this._accountMap).filter(Boolean).length === 0 &&
				this._queue.length === 0
			) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
				return cb();
			}

			id = setTimeout(checkTx, WAIT_FREQUENCY, cb);
		};

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return new Promise(resolve => {
			checkTx(resolve);
		});
	}

	private async _sendJob(): Promise<void> {
		for (let i = 0; i < this._queue.length; i += 1) {
			const tx = this._queue[i];
			const senderKey = tx.senderPublicKey.toString('hex');
			if (this._accountMap[senderKey] < this._maxTransactionsPerAccount) {
				await this._client.transaction.send((tx as unknown) as Record<string, unknown>);
				this._accountMap[senderKey] += 1;
				this._queue.splice(i, 1);
				i -= 1;
			}
		}
	}

	private _onNewBlock(data): void {
		const { block: blockString } = data as { block: string; accounts: string[] };
		const block = this._client.block.decode<{ payload: { senderPublicKey: Buffer }[] }>(
			Buffer.from(blockString, 'hex'),
		);

		for (const tx of block.payload) {
			this._accountMap[tx.senderPublicKey.toString('hex')] -= 1;
		}
	}
}
