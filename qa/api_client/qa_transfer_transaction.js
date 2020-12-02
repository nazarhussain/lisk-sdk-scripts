const { createIPCClient } = require('@liskhq/lisk-api-client');
const crypto = require('@liskhq/lisk-cryptography');

const getFullAccountFromPassphrase = passphrase => {
	return {
		...crypto.getPrivateAndPublicKeyFromPassphrase(passphrase),
		address: crypto.getAddressFromPassphrase(passphrase),
		passphrase,
	};
};

const networkIdentifier = Buffer.from(
	'9c1708715f64be299607351c8b7203cb86104203cbd2d5cd5685ebabf855d305',
	'hex',
);

const senderPass = 'peanut hundred pen hawk invite exclude brain chunk gadget wait wrong ready';
const newMultisigAccount =
	'pheat elephant begin area loud senior blind track kite desert select midnight extra rotate broom glove lounge fuel outer matter mystery slab assault refuse';

const accounts = {
	senderAccount: getFullAccountFromPassphrase(senderPass),
	newAccount: getFullAccountFromPassphrase(newMultisigAccount),
};

(async () => {
	try {
		const wsClient = await createIPCClient('/Users/nazar/.lisk/lisk-core');
		console.log('WS Client successfully connected to lisk-core');

		const trs = {
			moduleID: 2,
			assetID: 0,
			senderPublicKey: accounts.senderAccount.publicKey,
			nonce: BigInt(0),
			fee: BigInt(10000000),
			asset: {
				recipientAddress: accounts.newAccount.address,
				amount: BigInt(250000000000000),
				data: '',
			},
		};

		const transfer = await wsClient.transaction.create(trs, accounts.senderAccount.passphrase);
		console.log(transfer);
		await wsClient.transaction.send(transfer);
		const trsJSON = wsClient.transaction.toJSON(transfer);
		console.log(JSON.stringify(trsJSON, null, 2));
		console.log(wsClient.transaction.fromJSON(trsJSON));
		console.log('"Success..."');
		process.exit();
	} catch (error) {
		console.log('Ups.......');
		console.log(error);
		process.exit();
	}
})();
