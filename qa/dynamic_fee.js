const assert = require('assert');
const {
	transfer,
	TransferTransaction,
	utils: { convertLSKToBeddows },
} = require('@liskhq/lisk-transactions');
const {
	getNetworkIdentifier,
	getPrivateAndPublicKeyFromPassphrase,
	getRandomBytes,
	getAddressFromPassphrase,
} = require('@liskhq/lisk-cryptography');
const { APIClient } = require('@liskhq/lisk-api-client');

const genesisBlock = require('lisk-framework/test/fixtures/config/devnet/genesis_block.json');
const {
	app: {
		node: {
			forging: { delegates, defaultPassword },
		},
	},
} = require('lisk-framework/test/fixtures/config/devnet/config.json');
const { genesis: genesisAccount } = require('lisk-framework/test/fixtures/accounts');

const networkIdentifier = getNetworkIdentifier(
	genesisBlock.payloadHash,
	genesisBlock.communityIdentifier,
);
const client = new APIClient(['http://localhost:4000']);

const sleep = async ms => new Promise(resolve => setTimeout(resolve, ms));

const compareArray = (a, b) => a.every((v, i) => b[i] === v);

const updateForging = async forging => {
	for (const delegate of delegates) {
		await client.node.updateForgingStatus({
			forging,
			publicKey: delegate.publicKey,
			password: defaultPassword,
		});
	}
};

const getRandomAccount = () => {
	const passphrase = getRandomBytes(10).toString('utf8');
	const address = getAddressFromPassphrase(passphrase);
	const { publicKey, privateKey } = getPrivateAndPublicKeyFromPassphrase(passphrase);

	return { passphrase, publicKey, privateKey, nonce: 0, address };
};

const transferTx = ({ amount, fee, nonce, recipientAccount, senderAccount }) => {
	const randomRecipientAccount = recipientAccount || getRandomAccount();
	const randomSenderAccount = senderAccount || genesisAccount;

	const tx = transfer({
		amount: amount || '100000000000',
		fee: fee || '150000',
		recipientPublicKey: randomRecipientAccount.publicKey,
		nonce: nonce || randomSenderAccount.nonce.toString(),
		senderPublicKey: randomSenderAccount.publicKey,
		passphrase: randomSenderAccount.passphrase,
		networkIdentifier,
	});

	randomSenderAccount.nonce += 1;

	return tx;
};

const getLastBlock = async () => {
	const [lastBlock] = (await client.blocks.get({ limit: 1 })).data;
	let transactions = [];
	let offset = 0;

	do {
		transactions = transactions.concat(
			(
				await client.transactions.get({
					height: lastBlock.height,
					limit: 100, // Max limit
					offset,
				})
			).data,
		);
		offset += 100;
	} while (transactions.length < lastBlock.numberOfTransactions);

	lastBlock.transactions = transactions;

	return lastBlock;
};

const updateAccountNonce = async account => {
	account.nonce = parseInt(
		(await client.accounts.get({ address: account.address })).data[0].nonce,
		10,
	);
};

const userDefinedFeeCase = async () => {
	console.info('Tx should be accepted with whatever fee provided.');
	await updateAccountNonce(genesisAccount);

	const feeBroadcasted = ['150000', '210000', '300000'];
	for (const fee of feeBroadcasted) {
		await client.transactions.broadcast(transferTx({ fee }));
	}
	await sleep(10000);
	const lastBlock = await getLastBlock();
	const feeForged = lastBlock.transactions.map(t => t.fee);
	console.info({ feeBroadcasted, feeForged });
	assert(lastBlock.numberOfTransactions === 3, 'Block with different transactions forged');
	assert(compareArray(feeForged, feeBroadcasted), 'Transaction with different fee forged');
};

const minFeeCase = async () => {
	await updateAccountNonce(genesisAccount);
	console.info('Transaction with fee lower than minimum per byte fee should not be accepted');
	const tx = transferTx({ fee: '150000' });
	const { minFee } = new TransferTransaction(tx);
	const validMinFeeTx = transferTx({ fee: minFee.toString() });
	const inValidMinFeeTx = transferTx({ fee: (minFee - BigInt(1)).toString() });

	console.info({
		validMinFee: validMinFeeTx.fee,
		inValidMinFee: inValidMinFeeTx.fee,
	});
	const validMinFeeTxResult = await client.transactions.broadcast(validMinFeeTx);
	let error = null;

	try {
		await client.transactions.broadcast(inValidMinFeeTx);
	} catch (err) {
		error = err;
	}
	assert(
		validMinFeeTxResult.data.message === 'Transaction(s) accepted',
		'Transaction with minimum fee is not accepted',
	);
	assert(
		error.errors[0].message === 'Insufficient transaction fee. Minimum required fee is: 130000',
		'Transaction with invalid min fee accepted',
	);
	await sleep(10000);
};

const feePriorityCase = async () => {
	await updateAccountNonce(genesisAccount);
	console.info('Transactions should be forged in correct fee priority');

	const accounts = Array(4)
		.fill(0)
		.map(() => getRandomAccount());

	for (const account of accounts) {
		await client.transactions.broadcast(
			transferTx({ amount: '800000000', recipientAccount: account }),
		);
	}
	await sleep(10000);

	const feeBroadcasted = ['210000', '150000', '300000', '400000'];
	const feeOrdered = ['400000', '300000', '210000', '150000'];

	for (const [index, fee] of feeBroadcasted.entries()) {
		console.info(
			`Sending transaction with fee: ${fee}, from account: ${accounts[index].publicKey}`,
		);
		await client.transactions.broadcast(
			transferTx({ fee, amount: '500000', senderAccount: accounts[index] }),
		);
	}
	await sleep(10000);
	const lastBlock = await getLastBlock();
	const feeForged = lastBlock.transactions.map(t => t.fee);
	console.info({ feeBroadcasted, feeForged, feeOrdered });
	assert(compareArray(feeOrdered, feeForged), 'Block was not forged in right fee priority');
};

const sequentialNonceCase = async () => {
	await updateAccountNonce(genesisAccount);
	console.info('Transactions should be forged only with sequential nonce');
	const account = getRandomAccount();
	await client.transactions.broadcast(
		transferTx({ amount: '800000000', recipientAccount: account }),
	);
	await sleep(10000);

	const nonceBroadcasted = ['0', '1', '3', '4'];
	const expectedNonceForged = ['0', '1'];

	for (const nonce of nonceBroadcasted) {
		console.info(`Sending transaction with nonce: ${nonce}`);
		await client.transactions.broadcast(
			transferTx({ amount: '500000', nonce, senderAccount: account }),
		);
	}
	await sleep(10000);
	const lastBlock = await getLastBlock();
	const nonceForged = lastBlock.transactions.map(t => t.nonce);
	console.info({ nonceBroadcasted, expectedNonceForged, nonceForged });
	assert(compareArray(expectedNonceForged, nonceForged), 'Non-sequential nonce forged');
};

const minRemainingBalanceCase = async () => {
	await updateAccountNonce(genesisAccount);
	console.info(
		'Minimum remaining balance should not decrease less than 0.05 LSK from sender account',
	);

	const account1 = getRandomAccount();
	const account2 = getRandomAccount();
	const account3 = getRandomAccount();
	await client.transactions.broadcast(
		transferTx({
			amount: convertLSKToBeddows('5'),
			recipientAccount: account1,
		}),
	);
	await client.transactions.broadcast(
		transferTx({
			amount: convertLSKToBeddows('5'),
			recipientAccount: account2,
		}),
	);
	await sleep(10000);

	console.info('Sending transaction causing remaining balance limit should pass');
	const tx = transferTx({
		amount: convertLSKToBeddows('3.95'),
		fee: convertLSKToBeddows('1'),
		nonce: '0',
		senderAccount: account1,
	});
	const res = await client.transactions.broadcast(tx);
	assert(
		res.data.message === 'Transaction(s) accepted',
		'Transaction with min remaining balance rejected.',
	);
	// ---------------

	console.info('Sending transaction causing less than remaining balance should fail');
	let error = null;
	try {
		const tx = transferTx({
			amount: convertLSKToBeddows('3.96'),
			fee: convertLSKToBeddows('1'),
			nonce: '0',
			senderAccount: account2,
		});
		await client.transactions.broadcast(tx);
	} catch (err) {
		error = err;
	}
	assert(
		error.errors[0].message ===
			`Account does not have enough minimum remaining LSK: ${account2.address}, balance: 0.04`,
		'Transaction with extra spending accepted',
	);

	// ---------------
	console.info('Sending transaction with less than 0.05 amount to new account should fail');
	error = null;
	try {
		await client.transactions.broadcast(
			transferTx({
				amount: convertLSKToBeddows('0.04'),
				recipientAccount: account3,
			}),
		);
	} catch (err) {
		error = err;
	}
	assert(
		error.errors[0].message ===
			`Account does not have enough minimum remaining LSK: ${account3.address}, balance: 0.04`,
		'Transaction with low balance in recipient account is not fail',
	);

	// -----------------------
	console.info('Sending transaction with exactly 0.05 amount to new account should pass');
	await updateAccountNonce(genesisAccount);
	const res2 = await client.transactions.broadcast(
		transferTx({
			amount: convertLSKToBeddows('0.05'),
			recipientAccount: account3,
		}),
	);
	assert(
		res2.data.message === 'Transaction(s) accepted',
		'Transaction with min remaining balance in recipient account rejected.',
	);
};

const txInvalidationCase = async () => {
	await updateAccountNonce(genesisAccount);
	console.info(
		'Transaction should be able to invalidated with sent with higher fee and same nonce',
	);

	const { nonce } = genesisAccount;

	const tx1 = transferTx({
		amount: convertLSKToBeddows('5'),
		fee: convertLSKToBeddows('2'),
		nonce: nonce.toString(),
	});
	const tx2 = transferTx({
		amount: convertLSKToBeddows('5'),
		fee: convertLSKToBeddows('3'),
		nonce: nonce.toString(),
	});
	console.info(`Sending tx ${tx1.id} with nonce ${tx1.nonce} and fee ${tx1.fee}`);
	await client.transactions.broadcast(tx1);
	console.info(`Sending tx ${tx2.id} with nonce ${tx2.nonce} and fee ${tx2.fee}`);
	await client.transactions.broadcast(tx2);
	await sleep(10000);

	const block = await getLastBlock();

	assert(block.numberOfTransactions === 1, 'Block was forged with more transactions');
	assert(block.transactions[0].id === tx2.id, 'Block forged with invalid transaction');
	console.info(
		`Block forged with tx ${block.transactions[0].id} with nonce ${block.transactions[0].nonce} and fee ${block.transactions[0].fee}`,
	);
};

const txPoolFullCase = async () => {
	await updateAccountNonce(genesisAccount);
	const perAccountLimit = 64;
	console.info(
		'When TxPool is full then it should accept a high fee priority transaction into the pool',
	);

	// Create 65 accounts
	// 64 accounts to make TxPool full
	// And 1 account to transfer higher fee transaction
	const accounts = Array(perAccountLimit + 1)
		.fill(0)
		.map(() => getRandomAccount());

	console.info(`Crediting ${perAccountLimit + 1} accounts...`);

	// Credit the accounts
	for (const [index, account] of accounts.entries()) {
		// Wait for block as genesis account can't send more than 64 transactions
		if (index === perAccountLimit) {
			await sleep(10000);
		}
		const tx = transferTx({
			amount: convertLSKToBeddows('100'),
			fee: convertLSKToBeddows('0.5'),
			recipientAccount: account,
			senderAccount: genesisAccount,
		});
		await client.transactions.broadcast(tx);
	}
	await sleep(10000);

	// Disable forging so TxPool can be filled.
	await updateForging(false);

	// From every account send 64 transactions
	for (let i = 0; i < perAccountLimit; i += 1) {
		for (let j = 0; j < perAccountLimit; j += 1) {
			const account = accounts[i];
			const tx = transferTx({
				amount: convertLSKToBeddows('1'),
				fee: convertLSKToBeddows('0.6'),
				senderAccount: account,
			});

			console.info(
				`Sending sender:${account.address} tx: ${tx.id}, nonce: ${tx.nonce}, fee: ${tx.fee}`,
			);
			await client.transactions.broadcast(tx);
		}
	}

	console.info(`Sent ${perAccountLimit * perAccountLimit} transactions with fee 0.6`);
	const highFeeTx = transferTx({
		amount: convertLSKToBeddows('1'),
		fee: convertLSKToBeddows('0.8'),
		senderAccount: accounts[perAccountLimit],
	});
	console.info(
		`Sending sender:${accounts[perAccountLimit].address} tx: ${highFeeTx.id}, nonce: ${highFeeTx.nonce}, fee: ${highFeeTx.fee}`,
	);
	await client.transactions.broadcast(highFeeTx);

	// Enable forging so TxPool can be filled.
	await updateForging(true);
	await sleep(10000);

	const block = await getLastBlock();
	const txIds = block.transactions.map(t => t.id);

	assert(txIds.includes(highFeeTx.id), 'Block not forged with high fee transaction');

	console.info(
		`Block forged with ${block.numberOfTransactions} transactions and contains high fee transaction ${highFeeTx.id}`,
	);
};

const process = async () => {
	genesisAccount.nonce = parseInt(
		(await client.accounts.get({ address: genesisAccount.address })).data[0].nonce,
		10,
	);

	// await userDefinedFeeCase();
	console.info('------------');

	// await minFeeCase();
	console.info('------------');

	// await feePriorityCase();
	console.info('------------');

	// await sequentialNonceCase();
	// console.info('------------');

	// await minRemainingBalanceCase();
	console.info('------------');

	// await txInvalidationCase();
	console.info('------------');

	await txPoolFullCase();
	console.info('------------');
};

process().then(console.info).catch(console.error);
