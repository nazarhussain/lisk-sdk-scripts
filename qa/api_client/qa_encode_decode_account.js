const { createWSClient, createIPCClient } = require('@liskhq/lisk-api-client');

(async () => {
	try {
		const wsClient = await createIPCClient('/Users/nazar/.lisk/lisk-core');
		// const wsClient = await createWSClient('ws://localhost:8080/ws');
		console.log('WS Client successfully connected to lisk-core');

		const accountAddress = Buffer.from('4033640d08a9de48673273b21e58d9e269d44ab1', 'hex');
		const account = await wsClient.account.get(accountAddress);
		console.log(account);
		const accountJSON = wsClient.account.toJSON(account);
		console.log(accountJSON);
		const accountFromJSON = wsClient.account.fromJSON(accountJSON);
		console.log(accountFromJSON);
		const encodedAccount = wsClient.account.encode(account);
		console.log(encodedAccount);
		const decodedAccount = wsClient.account.encode(account);
		console.log(decodedAccount);
		process.exit();
	} catch (error) {
		console.log('Ups.......');
		console.log(error);
		process.exit();
	}
})();
