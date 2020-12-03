const { Container } = require('../utils/container');
const { transactions } = require('lisk-sdk');
const { sleep } = require('../utils/container/common');
const { homedir } = require('os');

const exec = async () => {
	const maxTransactions = parseInt(process.env.MAX_TRANSACTIONS);
	const maxTransactionsPerAccount = parseInt(process.env.MAX_TRANSACTIONS_PER_ACCOUNT);
	const maxAccounts = maxTransactions / maxTransactionsPerAccount;

	const container = new Container({
		clientMode: 'ipc',
		connectionString: `${homedir()}/.lisk/devnet`,
		genesisAccount: {
			address: Buffer.from('d04699e57c4a3846c988f3c15306796f8eae5c1c', 'hex'),
			publicKey: Buffer.from(
				'0fe9a3f1a21b5530f27f87a414b549e79a940bf24fdf2b2f05e7f22aeeecc86a',
				'hex',
			),
			passphrase: 'peanut hundred pen hawk invite exclude brain chunk gadget wait wrong ready',
		},
		maxTransactions,
		maxTransactionsPerAccount,
	});

	await container.bootstrap();

	const allAccounts = container.factory.loadOrGenerateRandomAccounts('benchmarks', maxAccounts);
	const accounts = allAccounts.slice(0, maxAccounts - 2);
	const accountsNonceMap = {};

	for (const account of accounts) {
		const genesisAccountNonce = await container.store.getAccountNonce(account.address);
		accountsNonceMap[account.address.toString('hex')] = genesisAccountNonce;
	}

	for (const account of accounts) {
		for (let i = 1; i <= maxTransactionsPerAccount - 5; i++) {
			const recipient = container.factory.generateRandomAccount();
			const address = account.address.toString('hex');

			const { id, tx } = container.tx.transfer({
				recipientAddress: recipient.address,
				amount: BigInt(transactions.convertLSKToBeddows('0.3')),
				fee: BigInt(transactions.convertLSKToBeddows('0.1')),
				nonce: accountsNonceMap[address],
				passphrase: account.passphrase,
				networkIdentifier: container.networkIdentifier,
			});
			accountsNonceMap[address] += BigInt(1);

			container.pool.send(tx);
		}
	}
};

exec().then(console.info).catch(console.error);
