const { AccountsApi, BlocksApi, NodeApi, TransactionsApi } = require("lisk-http-api-client");

const httpApiURL = 'http://localhost:4000/api';
const forgerApiURL = 'http://localhost:4001/api';

module.exports = {
  http: {
    accounts: new AccountsApi({basePath: httpApiURL, fetch}),
    blocks: new BlocksApi({basePath: httpApiURL}),
    node: new NodeApi({basePath: httpApiURL}),
    transactions: new TransactionsApi({basePath: httpApiURL}),
  }
}
