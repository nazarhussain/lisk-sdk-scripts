const { createIPCClient } = require('@liskhq/lisk-api-client');

(async () => {
	try {
		const wsClient = await createIPCClient('/Users/nazar/.lisk/lisk-core');
		console.log('WS Client successfully connected to lisk-core');
		console.log(wsClient);
		process.exit();
	} catch (error) {
		console.log('Ups.......');
		console.log(error);
		process.exit();
	}
})();
