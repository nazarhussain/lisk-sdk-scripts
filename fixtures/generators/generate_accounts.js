const fs = require('fs');
const { convertLSKToBeddows } = require('@liskhq/lisk-transactions');
const { getRandomAccount, getAccountNonce } = require('../accounts');
const { waitForBlock, networkIdentifier } = require('../../utils/network');
const { transfer } = require('../../utils/transactions');
const genesisAccount = require('../accounts/devnet/genesis_account.json');
const api = require('../../api_clients');

const maxAccounts = 1000;
const perAccountLimit = 64;

const process = async () => {
	const accounts = Array(maxAccounts)
		.fill(0)
		.map(() => getRandomAccount());

	const result = [];

	let genesisAccountNonce = BigInt(await getAccountNonce(genesisAccount.address));

	await waitForBlock({ heightOffset: 1 });
	for (const [index, account] of accounts.entries()) {
		console.info(`Creating account [${index + 1}] ${account.address.toString('hex')}`);

		if ((index + 1) % perAccountLimit === 0) {
			await waitForBlock({ heightOffset: 1 });
		}

		const [id, tx] = transfer({
			recipientAddress: account.address,
			amount: convertLSKToBeddows('10000'),
			fee: convertLSKToBeddows('0.1'),
			nonce: genesisAccountNonce.toString(),
			passphrase: genesisAccount.passphrase,
			networkIdentifier,
		});

		try {
			await api.http.transactions.transactionsPost(tx);
		} catch (error) {
			console.log(await error.json());
			throw error;
		}

		result.push({
			address: account.address.toString('hex'),
			publicKey: account.publicKey.toString('hex'),
			passphrase: account.passphrase,
		});
		genesisAccountNonce += BigInt(1);
	}

	await waitForBlock({ heightOffset: 1 });
	console.info('Storing the JSON file to sample_accounts.json');
	fs.writeFileSync(`${__dirname}/sample_accounts.json`, JSON.stringify(result, null, 4));
};

process().then(console.info).catch(console.error);
