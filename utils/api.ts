import {
	AccountsApi,
	BlocksApi,
	NodeApi,
	TransactionsApi,
	BlockResponseData,
} from 'lisk-http-api-client';

export { BlockHeader, Transaction } from 'lisk-http-api-client';
export type Block = BlockResponseData;

const httpApiURL = 'http://localhost:4000/api';
// const forgerApiURL = 'http://localhost:4001/api';

export const http = {
	accounts: new AccountsApi({ basePath: httpApiURL }),
	blocks: new BlocksApi({ basePath: httpApiURL }),
	node: new NodeApi({ basePath: httpApiURL }),
	transactions: new TransactionsApi({ basePath: httpApiURL }),
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

export const api = { http };
