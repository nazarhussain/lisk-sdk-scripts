const {
	networkIdentifier,
	client,
	genesisAccount,
	getAccountNonce,
	getRandomAccount,
} = require('../utils');

const {
	transfer,
	utils: { convertLSKToBeddows },
} = require('../../elements/lisk-transactions');


const process = async () => {
	const accountNonce = parseInt(await getAccountNonce(genesisAccount), 10);

	const tx1 = transfer({
		recipientId: getRandomAccount().address,
		amount: convertLSKToBeddows('1'),
		fee: convertLSKToBeddows('0.2'),
		nonce: accountNonce.toString(),
		passphrase: genesisAccount.passphrase,
		networkIdentifier,
	});

	const tx2 = transfer({
		recipientId: getRandomAccount().address,
		amount: convertLSKToBeddows('2'),
		fee: convertLSKToBeddows('0.1'),
		nonce: accountNonce.toString(),
		passphrase: genesisAccount.passphrase,
		networkIdentifier,
	});

	await client.transactions.broadcast(tx1);
	await client.transactions.broadcast(tx2);
};

process().then(console.info).catch(console.error);
