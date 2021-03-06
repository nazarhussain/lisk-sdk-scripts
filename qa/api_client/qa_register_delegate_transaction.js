const { createWSClient } = require('@liskhq/lisk-api-client');
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

console.log(accounts.newAccount.address.toString('hex'));
console.log(accounts.newAccount.publicKey.toString('hex'));
console.log(accounts.senderAccount.address.toString('hex'));

(async () => {
	const sleep = time => new Promise(resolve => setTimeout(() => resolve(), time));

	try {
		const wsClient = await createWSClient('ws://localhost:8080/ws');
		console.log('WS Client successfully connected to lisk-core');
		// Fund the account we're gonna register as a delegate
		const trs = {
			moduleID: 2,
			assetID: 0,
			senderPublicKey: accounts.senderAccount.publicKey,
			nonce: BigInt(0),
			fee: BigInt(10000000),
			asset: {
				recipientAddress: accounts.newAccount.address,
				amount: BigInt(250000000000),
				data: '',
			},
		};

		const transfer = await wsClient.transaction.create(trs, accounts.senderAccount.passphrase);
		const trsJSON = wsClient.transaction.toJSON(transfer);
		await wsClient.transaction.send(transfer);
		console.log(JSON.stringify(trsJSON, null, 2));
		await sleep(10 * 1000);

		// Register the account as delegate
		const registerTrs = {
			moduleID: 5,
			assetID: 0,
			senderPublicKey: accounts.newAccount.publicKey,
			nonce: BigInt(3),
			fee: BigInt(2000127000),
			asset: {
				username: 'karmapolice',
			},
		};

		const register = await wsClient.transaction.create(registerTrs, accounts.newAccount.passphrase);
		const registerJSON = wsClient.transaction.toJSON(register);
		console.log(JSON.stringify(registerJSON, null, 2));

		process.exit();
	} catch (error) {
		console.log('Ups.......');
		console.log(error);
		process.exit();
	}
})();
