const { createWSClient, createIPCClient } = require('@liskhq/lisk-api-client');
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

const newMultisigAccount =
	'pheat elephant begin area loud senior blind track kite desert select midnight extra rotate broom glove lounge fuel outer matter mystery slab assault refuse';
const memberA =
	'fheat elephant begin area loud senior blind track kite desert select midnight extra rotate broom glove lounge fuel outer matter mystery slab assault refuse';
const memberB =
	'gheat elephant begin area loud senior blind track kite desert select midnight extra rotate broom glove lounge fuel outer matter mystery slab assault refuse';

const accounts = {
	newAccount: getFullAccountFromPassphrase(newMultisigAccount),
	memberA: getFullAccountFromPassphrase(memberA),
	memberB: getFullAccountFromPassphrase(memberB),
};

(async () => {
	try {
		const wsClient = await createIPCClient('/Users/nazar/.lisk/lisk-core');
		// const wsClient = await createWSClient('ws://localhost:8080/ws');
		console.log('WS Client successfully connected to lisk-core');

		const asset = {
			numberOfSignatures: 3,
			mandatoryKeys: [
				accounts.newAccount.publicKey,
				accounts.memberB.publicKey,
				accounts.memberA.publicKey,
			],
			optionalKeys: [],
		};

		const registerMultisig = {
			moduleID: 4,
			assetID: 0,
			senderPublicKey: accounts.newAccount.publicKey,
			nonce: BigInt(4),
			fee: BigInt(10000000),
			asset,
		};

		const regMultisigTransaction = await wsClient.transaction.create(
			registerMultisig,
			accounts.newAccount.passphrase,
		);
		await wsClient.transaction.sign(
			regMultisigTransaction,
			[accounts.newAccount.passphrase, accounts.memberA.passphrase, accounts.memberB.passphrase],
			{
				includeSenderSignature: true,
				multisignatureKeys: {
					mandatoryKeys: asset.mandatoryKeys,
					optionalKeys: asset.optionalKeys,
				},
			},
		);

		const trsJSON = wsClient.transaction.toJSON(regMultisigTransaction);
		console.log(JSON.stringify(trsJSON, null, 2));

		const trs = {
			moduleID: 2,
			assetID: 0,
			senderPublicKey: accounts.newAccount.publicKey,
			nonce: BigInt(5),
			fee: BigInt(10000000),
			asset: {
				recipientAddress: accounts.newAccount.address,
				amount: BigInt(25),
				data: '',
			},
		};

		const transfer = await wsClient.transaction.create(trs, accounts.newAccount.passphrase);
		await wsClient.transaction.sign(
			transfer,
			[accounts.newAccount.passphrase, accounts.memberA.passphrase, accounts.memberB.passphrase],
			{
				includeSenderSignature: false,
				multisignatureKeys: {
					mandatoryKeys: asset.mandatoryKeys,
					optionalKeys: asset.optionalKeys,
				},
			},
		);
		const transferJSON = wsClient.transaction.toJSON(transfer);
		console.log(JSON.stringify(transferJSON, null, 2));

		process.exit();
	} catch (error) {
		console.log('Ups.......');
		console.log(error);
		process.exit();
	}
})();
