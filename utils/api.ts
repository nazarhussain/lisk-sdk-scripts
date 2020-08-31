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

export const api = { http };
