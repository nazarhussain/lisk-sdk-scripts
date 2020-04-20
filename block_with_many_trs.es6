const { transfer } = require('../elements/lisk-transactions');
const {
	getNetworkIdentifier,
	getPrivateAndPublicKeyFromPassphrase,
	getRandomBytes,
} = require('../elements/lisk-cryptography');
const { APIClient } = require('../elements/lisk-api-client');

const genesisBlock = require('../framework/test/fixtures/config/devnet/genesis_block');
const {
	genesis: genesisAccount,
} = require('../framework/test/fixtures/accounts');

const networkIdentifier = getNetworkIdentifier(
	genesisBlock.payloadHash,
	genesisBlock.communityIdentifier,
);
const client = new APIClient(['http://localhost:4000']);

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

const process = async () => {
	const passphrase = getRandomBytes(10).toString('utf8');
	const { publicKey } = getPrivateAndPublicKeyFromPassphrase(passphrase);
	genesisAccount.nonce = (
		await client.accounts.get({ address: genesisAccount.address })
	).data[0].nonce;

	const transferTx = transfer({
		amount: '100000000000',
		fee: '150000',
		recipientPublicKey: publicKey,
		nonce: genesisAccount.nonce,
		senderPublicKey: genesisAccount.publicKey,
		passphrase: genesisAccount.passphrase,
		networkIdentifier,
	});

	console.info(await client.transactions.broadcast(transferTx));
	await sleep(10000);

	for (let i = 0; i < 50; i += 1) {
		const randomPassphrase = getRandomBytes(10).toString('utf8');
		const { publicKey: randomPublicKey } = getPrivateAndPublicKeyFromPassphrase(
			randomPassphrase,
		);
		const tx = transfer({
			amount: '500000',
			fee: '150000',
			recipientPublicKey: randomPublicKey,
			nonce: i.toString(),
			senderPublicKey: publicKey,
			passphrase,
			networkIdentifier,
		});
		console.info('Nonce: ', i.toString());
		console.info(await client.transactions.broadcast(tx));
	}

	let res;
	let block;

	do {
		res = await client.blocks.get({ limit: 1 });
		block = res.data[0];
		console.info(
			'Block contains # transactions...',
			block.numberOfTransactions,
		);
		await sleep(1000);
	} while (block.numberOfTransactions < 25);
};
process()
	.then(console.info)
	.catch(console.error);
