const {
	client,
	getRandomAccount,
	getAccountNonce,
	networkIdentifier,
} = require('../utils.js');
const accounts = require('./sample_accounts.json');

const {
	transfer,
	utils: { convertLSKToBeddows },
} = require('@liskhq/lisk-transactions');

const generateTransferTransactions = async () => {
	let count = 0;

	while (true) {
		const recipient = getRandomAccount();
		const sender = accounts[count % (accounts.length - 1)];

		const tx = transfer({
			recipientPublicKey: recipient.publicKey,
			amount: convertLSKToBeddows('0.6'),
			fee: convertLSKToBeddows('0.1'),
			nonce: await getAccountNonce(sender),
			passphrase: sender.passphrase,
			networkIdentifier,
		});

		await client.transactions.broadcast(tx);
		count += 1;
		console.info(`Broadcasted ${count} transactions...`);
	}
};

const activeLoadType = generateTransferTransactions;

activeLoadType()
	.then(console.info)
	.catch(console.error);
