const { createWSClient, createIPCClient } = require('@liskhq/lisk-api-client');

(async () => {
	try {
		const wsClient = await createIPCClient('/Users/nazar/.lisk/lisk-core');
		// const wsClient = await createWSClient('ws://localhost:8080/ws');
		console.log('WS Client successfully connected to lisk-core');
		const maxEvents = 5;
		let eventCount = 0;
		wsClient.subscribe('app:block:new', data => {
			const blockBinaryMessage = Buffer.from(data.data.block, 'hex');
			console.log(blockBinaryMessage);
			const decodedBlock = wsClient.block.decode(blockBinaryMessage);
			console.log(decodedBlock);
			const decodedBlockJSON = wsClient.block.toJSON(decodedBlock);
			console.log(decodedBlockJSON);
			const decodedBlockFromJSON = wsClient.block.fromJSON(decodedBlockJSON);
			console.log(decodedBlockFromJSON);
			const encodedBlock = wsClient.block.encode({
				header: decodedBlock.header,
				payload: decodedBlock.payload,
			});
			console.log(encodedBlock);
			console.log('Binary blocks match:', !!!Buffer.compare(blockBinaryMessage, encodedBlock));

			eventCount++;
			if (eventCount === maxEvents) {
				process.exit();
			}
		});
	} catch (error) {
		console.log('Ups.......');
		console.log(error);
		process.exit();
	}
})();
