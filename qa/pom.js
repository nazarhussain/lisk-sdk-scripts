const assert = require('assert');

const {
	transfer,
	reportMisbehavior,
	utils: { convertLSKToBeddows, convertBeddowsToLSK },
} = require('@liskhq/lisk-transactions');

const { getBytes } = require('lisk-framework/src/application/node/block_processor_v2');

const { hash, signDataWithPrivateKey } = require('@liskhq/lisk-cryptography');
const {
	client,
	waitForBlock,
	genesisAccount,
	getGenesisKeyPair,
	getAccountNonce,
	getAccount,
	getRandomAccount,
	networkIdentifier,
	getLastBlock,
} = require('../utils.js');

const blockHeaderProps = [
	'blockSignature',
	'generatorPublicKey',
	'height',
	'maxHeightPreviouslyForged',
	'maxHeightPrevoted',
	'numberOfTransactions',
	'payloadHash',
	'payloadLength',
	'previousBlockId',
	'reward',
	'seedReveal',
	'timestamp',
	'totalAmount',
	'totalFee',
	'version',
];
const extractBlockHeader = block =>
	Object.assign({}, ...blockHeaderProps.map(key => ({ [key]: block[key] })));

const createContradictingBlockHeader = header => {
	const header2 = { ...header };
	delete header2.blockSignature;

	// Same maxHeightPreviouslyForged but with lower height
	header2.height = header.height - 5;

	const { privateKey } = getGenesisKeyPair(header.generatorPublicKey);

	header2.blockSignature = signDataWithPrivateKey(
		hash(Buffer.concat([Buffer.from(networkIdentifier, 'hex'), getBytes(header2)])),
		Buffer.from(privateKey, 'hex'),
	);

	return header2;
};

const process = async () => {
	const pomTxFee = convertLSKToBeddows('1');
	const accountBalance = convertLSKToBeddows('5');
	const blockReward = (await client.node.getConstants()).data.reward;

	const { passphrase, address } = getRandomAccount();

	const balanceTx = transfer({
		passphrase: genesisAccount.passphrase,
		senderPublicKey: genesisAccount.publicKey,
		recipientId: address,
		amount: accountBalance,
		fee: convertLSKToBeddows('0.1'),
		nonce: await getAccountNonce(genesisAccount),
		networkIdentifier,
	});

	const block = await getLastBlock();
	const header1 = extractBlockHeader(block);
	const header2 = createContradictingBlockHeader(header1);

	const pomTx = reportMisbehavior({
		fee: pomTxFee,
		nonce: await getAccountNonce({ address }),
		networkIdentifier,
		passphrase,
		header1,
		header2,
	});

	await client.transactions.broadcast(balanceTx);
	await waitForBlock({ heightOffset: 1 });

	const { balance: accBalanceBeforePoM } = await getAccount({ address });
	const { balance: delegateBalanceBeforePoM } = await getAccount({
		publicKey: header1.generatorPublicKey,
	});

	await client.transactions.broadcast(pomTx);
	await waitForBlock({ heightOffset: 1 });
	console.info('PoM transaction accepted');

	const { balance: accBalanceAfterPoM } = await getAccount({ address });
	const { balance: delegateBalanceAfterPoM } = await getAccount({
		publicKey: header1.generatorPublicKey,
	});

	console.info({ header1, header2 });
	console.info({
		pomTxFee: convertBeddowsToLSK(pomTxFee),
		blockReward: convertBeddowsToLSK(blockReward),
	});
	console.info('Account Balance', {
		before: convertBeddowsToLSK(accBalanceBeforePoM),
		after: convertBeddowsToLSK(accBalanceAfterPoM),
	});
	console.info('Delegate Balance', {
		before: convertBeddowsToLSK(delegateBalanceBeforePoM),
		after: convertBeddowsToLSK(delegateBalanceAfterPoM),
	});

	assert(
		BigInt(accBalanceAfterPoM) ===
			BigInt(accBalanceBeforePoM) - BigInt(pomTxFee) + BigInt(blockReward),
		'Account balance is not updated correctly after PoM accepted.',
	);
	console.info('Account balance is updated correctly after PoM accepted.');

	assert(
		BigInt(delegateBalanceAfterPoM) === BigInt(delegateBalanceBeforePoM) - BigInt(blockReward),
		'Delegate balance is not updated correctly after PoM accepted.',
	);

	console.info('Delegate balance is updated correctly after PoM accepted.');
};

process().then(console.info).catch(console.error);
