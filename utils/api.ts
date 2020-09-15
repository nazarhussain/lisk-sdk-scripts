import {
	AccountsApi,
	BlocksApi,
	NodeApi as HttpNodeApi,
	TransactionsApi,
	BlockResponseData,
	DelegatesApi,
} from 'lisk-http-api-client';

import { NodeApi as ForgerNodeApi } from 'lisk-forger-api-client';

export {
	BlockHeader as BlockHeaderJSON,
	Transaction,
	TransactionCreateResponse,
	TransactionRequest,
	Account as AccountJSON,
} from 'lisk-http-api-client';
export type BlockJSON = BlockResponseData;

const httpApiURL = 'http://localhost:4000/api';
const forgerApiURL = 'http://localhost:4001/api';

export const http = {
	accounts: new AccountsApi({ basePath: httpApiURL }),
	blocks: new BlocksApi({ basePath: httpApiURL }),
	node: new HttpNodeApi({ basePath: httpApiURL }),
	transactions: new TransactionsApi({ basePath: httpApiURL }),
	delegates: new DelegatesApi({ basePath: httpApiURL }),
};

export const forger = {
	forging: new ForgerNodeApi({ basePath: forgerApiURL }),
};

export class ServerResponse<T = Record<string, unknown>> {
	public status: number;
	public response: T;

	constructor(status: number, response: T) {
		this.response = response;
		this.status = status;
	}

	toJSON(): { status: number; response: T } {
		return { status: this.status, response: this.response };
	}
}

export const api = { http, forger };
