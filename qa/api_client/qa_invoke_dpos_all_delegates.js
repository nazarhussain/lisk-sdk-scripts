const { createWSClient, createIPCClient } = require('@liskhq/lisk-api-client');

(async () => {
	try {
		const wsClient = await createIPCClient('/Users/nazar/.lisk/lisk-core');
		// const wsClient = await createWSClient('ws://localhost:8080/ws');
		console.log('WS Client successfully connected to lisk-core');
		const res = await wsClient.invoke('dpos:getAllDelegates');
		console.log(res);
		process.exit();
	} catch (error) {
		console.log('Ups.......');
		console.log(error);
		process.exit();
	}
})();
