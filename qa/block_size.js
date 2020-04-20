const {
	client,
	networkIdentifier,
	genesisAccount,
	sleep,
	waitForBlock,
} = require('../utils.js');

const {
	transfer,
	TransferTransaction,
} = require('@liskhq/lisk-transactions');
const {
	getPrivateAndPublicKeyFromPassphrase,
	getRandomBytes,
} = require('@liskhq/lisk-cryptography');

const createAccount = async balance => {
	const passphrase = getRandomBytes(10).toString('utf8');
	const { privateKey, publicKey } = getPrivateAndPublicKeyFromPassphrase(
		passphrase,
	);

	const transferTx = transfer({
		amount: balance.toString(),
		fee: '150000',
		recipientPublicKey: publicKey,
		nonce: genesisAccount.nonce.toString(),
		senderPublicKey: genesisAccount.publicKey,
		passphrase: genesisAccount.passphrase,
		networkIdentifier,
	});
	genesisAccount.nonce += 1;
	console.info(await client.transactions.broadcast(transferTx));

	return { passphrase, publicKey, privateKey, nonce: 0 };
};

const process = async () => {
	genesisAccount.nonce = parseInt(
		(await client.accounts.get({ address: genesisAccount.address })).data[0]
			.nonce,
		10,
	);
	let broadcastedPayloadSize = 0;
	let perAccount = 0;
	let accountIndex = 0;
	let trxCount = 0;
	const maxPayloadSize = 1024 * 15;

	const account1 = await createAccount(100000000000);
	const account2 = await createAccount(100000000000);
	const account3 = await createAccount(100000000000);
	const accounts = [account1, account2, account3];
	await sleep(10000);

	while (broadcastedPayloadSize < maxPayloadSize + 1024) {
		const randomPassphrase = getRandomBytes(10).toString('utf8');
		const { publicKey: randomPublicKey } = getPrivateAndPublicKeyFromPassphrase(
			randomPassphrase,
		);

		const fromAccount = accounts[accountIndex];

		const tx = transfer({
			amount: '500000',
			fee: '200000',
			recipientPublicKey: randomPublicKey,
			nonce: fromAccount.nonce.toString(),
			senderPublicKey: fromAccount.publicKey,
			passphrase: fromAccount.passphrase,
			networkIdentifier,
			data: new Array(64).fill('a').join(''),
		});
		broadcastedPayloadSize += new TransferTransaction(tx).getBytes().length;
		perAccount += 1;
		fromAccount.nonce += 1;

		if (perAccount > 63) {
			perAccount = 0;
			accountIndex += 1;
		}

		console.info('broadcastedPayloadSize: ', broadcastedPayloadSize);
		console.info(await client.transactions.broadcast(tx));
		trxCount += 1;
	}

	let res;
	let block;

	do {
		res = await client.blocks.get({ limit: 1 });
		[block] = res.data;
		console.info(
			'Looking for block with higher transactions...',
			block.numberOfTransactions,
		);
		await sleep(1000);

		// Last known block contains 3 transactions
	} while (block.numberOfTransactions <= 3);

	const transactions = (
		await client.transactions.get({
			height: block.height,
			limit: block.numberOfTransactions,
		})
	).data;

	console.info({
		broadcastedTransactions: trxCount,
		forgedTransactions: transactions.length,
	});
	const forgedPayloadSize = transactions.reduce((acc, tx) => {
		return acc + new TransferTransaction(tx).getBytes().length;
	}, 0);

	console.info({ forgedPayloadSize, broadcastedPayloadSize });
};
process()
	.then(console.info)
	.catch(console.error);
