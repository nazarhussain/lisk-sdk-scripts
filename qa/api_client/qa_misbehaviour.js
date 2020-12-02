const { createWSClient, createIPCClient } = require('@liskhq/lisk-api-client');
const crypto = require('@liskhq/lisk-cryptography');

const getFullAccountFromPassphrase = passphrase => {
	return {
		...crypto.getPrivateAndPublicKeyFromPassphrase(passphrase),
		address: crypto.getAddressFromPassphrase(passphrase),
		passphrase,
	};
};

const senderAccount = getFullAccountFromPassphrase(
	'pheat elephant begin area loud senior blind track kite desert select midnight extra rotate broom glove lounge fuel outer matter mystery slab assault refuse',
);

(async () => {
	try {
		const wsClient = await createIPCClient('/Users/nazar/.lisk/lisk-core');
		// const wsClient = await createWSClient('ws://localhost:8080/ws');
		console.log('WS Client successfully connected to lisk-core');
		/* 
    fund an account with this transaction the passphrase is 'pheat elephant begin area loud senior blind track kite desert select midnight extra rotate broom glove lounge fuel outer matter mystery slab assault refuse'
    {
      "moduleID": 2,
      "assetID": 0,
      "senderPublicKey": "0fe9a3f1a21b5530f27f87a414b549e79a940bf24fdf2b2f05e7f22aeeecc86a",
      "nonce": "0",
      "fee": "10000000",
      "asset": {
        "recipientAddress": "4033640d08a9de48673273b21e58d9e269d44ab1",
        "amount": "1000000000000",
        "data": ""
      },
      "signatures": [
        "b26c281f4005f1f434f24c8b4947ac0265d6753546fd0256a0af45567a6daecd434c400316caf348f9beaca6db920a18aa1c937f38a54fba0b684d6540d5160f"
      ]
    }
    */
		const maxEvents = 2;
		let eventCount = 0;
		const blocks = [];

		console.log('Waiting for two blocks please wait...');
		wsClient.subscribe('app:block:new', async data => {
			eventCount++;
			blocks.push(wsClient.block.decode(Buffer.from(data.data.block, 'hex')));
			if (eventCount === maxEvents) {
				for (const block of blocks) {
					delete block.header.id;
				}
				const trs = {
					moduleID: 5,
					assetID: 3,
					senderPublicKey: senderAccount.publicKey,
					nonce: BigInt(1),
					fee: BigInt(10000000),
					asset: {
						header1: blocks[0].header,
						header2: blocks[1].header,
					},
				};

				const signedTrs = await wsClient.transaction.create(trs, senderAccount.passphrase);

				const trsJSON = wsClient.transaction.toJSON(signedTrs);
				console.log(JSON.stringify(trsJSON, null, 2));

				process.exit();
			}
		});
	} catch (error) {
		console.log(error);
		process.exit();
	}
})();
