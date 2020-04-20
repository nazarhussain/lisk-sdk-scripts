const fs = require('fs');
const {
	getRandomAccount,
	getAccountNonce,
	genesisAccount,
	networkIdentifier,
	client,
	waitForBlock,
} = require('../utils.js');
const {
	transfer,
	utils: { convertLSKToBeddows },
} = require('../../elements/lisk-transactions');


const maxAccounts = 1000;
const perAccountLimit = 64;

const process = async () => {
	const accounts = Array(maxAccounts)
		.fill(0)
		.map(() => getRandomAccount());

	const result = [];

	let genesisAccountNonce = BigInt(await getAccountNonce(genesisAccount));

	await waitForBlock({ heightOffset: 1 });
	for (const [index, account] of accounts.entries()) {
		console.info(`Creating account ${account.address}`);

		if ((index + 1) % perAccountLimit === 0) {
			await waitForBlock({ heightOffset: 1 });
		}

		const tx = transfer({
			recipientPublicKey: account.publicKey,
			amount: convertLSKToBeddows('10000'),
			fee: convertLSKToBeddows('0.1'),
			nonce: genesisAccountNonce.toString(),
			passphrase: genesisAccount.passphrase,
			networkIdentifier,
		});

		await client.transactions.broadcast(tx);

		result.push({
			address: account.address,
			publicKey: account.publicKey,
			passphrase: account.passphrase,
		});
		genesisAccountNonce += BigInt(1);
	}

	await waitForBlock({ heightOffset: 1 });
	console.info('Storing the JSON file to sample_accounts.json');
	fs.writeFileSync('./sample_accounts.json', JSON.stringify(result, null, 4));
};

process()
	.then(console.info)
	.catch(console.error);
