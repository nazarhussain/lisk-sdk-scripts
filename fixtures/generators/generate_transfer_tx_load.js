const {
	getRandomAccount,
	getAccountNonce,
} = require('../accounts');
const {networkIdentifier} = require('../../utils/network');
const {transfer, convertLSKToBeddows} = require('../../utils/transactions');
const accounts = require('../generators/sample_accounts.json');
const api = require('../../api_clients');

const generateTransferTransactions = async () => {
	let count = 0;

	while (true) {
		const recipient = getRandomAccount();
		const sender = accounts[count % (accounts.length - 1)];

		const [id, tx] = transfer({
			recipientAddress: recipient.address,
			amount: convertLSKToBeddows('0.6'),
			fee: convertLSKToBeddows('0.4'),
			nonce: await getAccountNonce(sender.address),
			passphrase: sender.passphrase,
			networkIdentifier,
		});

		try {
			await api.http.transactions.transactionsPost(tx);
		} catch(error) {
			console.log(await error.json());
			throw error;
		}
		
		count += 1;
		console.info(`Broadcasted ${count} transactions...`);
	}
};

const activeLoadType = generateTransferTransactions;

activeLoadType()
	.then(console.info)
	.catch(console.error);
