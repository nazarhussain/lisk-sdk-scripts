const { APIClient } = require('../elements/lisk-api-client');
const genesisBlock = require('../framework/test/fixtures/config/devnet/genesis_block');
const genesisDelegates = require('../framework/test/mocha/data/genesis_delegates.json')
	.delegates;
const devnetConfig = require('../framework/test/fixtures/config/devnet/config.json');
const {
	getNetworkIdentifier,
	getRandomBytes,
	getPrivateAndPublicKeyFromPassphrase,
	getAddressFromPassphrase,
} = require('../elements/lisk-cryptography');
const {
	createStorageComponent,
} = require('../framework/src/components/storage');
const {
	NetworkInfoEntity,
	AccountEntity,
	BlockEntity,
	ChainStateEntity,
	ConsensusStateEntity,
	ForgerInfoEntity,
	TransactionEntity,
} = require('../framework/src/application/storage/entities');

const {
	genesis: genesisAccount,
} = require('../framework/test/fixtures/accounts');

const client = new APIClient(['http://localhost:4000']);

const networkIdentifier = getNetworkIdentifier(
	genesisBlock.payloadHash,
	genesisBlock.communityIdentifier,
);

const storage = createStorageComponent(
	devnetConfig.components.storage,
	console,
);

storage.registerEntity('NetworkInfo', NetworkInfoEntity);
storage.registerEntity('Account', AccountEntity, { replaceExisting: true });
storage.registerEntity('Block', BlockEntity, { replaceExisting: true });
storage.registerEntity('Transaction', TransactionEntity, {
	replaceExisting: true,
});
storage.registerEntity('ChainState', ChainStateEntity);
storage.registerEntity('ConsensusState', ConsensusStateEntity);
storage.registerEntity('ForgerInfo', ForgerInfoEntity);

storage.entities.Account.extendDefaultOptions({
	limit: 103,
});

const sleep = async ms => new Promise(resolve => setTimeout(resolve, ms));

const getAccount = async filters => {
	const result = await client.accounts.get({
		...filters,
		limit: 1,
	});

	return result.data.length ? result.data[0] : undefined;
};

const getAccountNonce = async account => {
	const result = await getAccount({ address: account.address });

	return result ? parseInt(result.nonce, 10).toString() : '0';
};

const getAccountFromStorage = async address =>
	storage.entities.Account.getOne({ address });

const getLastBlock = async (withTransactions = false) => {
	const [lastBlock] = (await client.blocks.get({ limit: 1 })).data;

	if (!withTransactions) {
		return lastBlock;
	}

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

const waitForBlock = async ({ height, heightOffset, condition }) => {
	let lastBlock = await getLastBlock();
	const targetHeight = height || lastBlock.height + heightOffset;
	const matcher = condition || (tipOfChain => tipOfChain.height < targetHeight);

	while (matcher(lastBlock)) {
		console.info(
			`Current Height: ${lastBlock.height}, Target Height: ${targetHeight}`,
		);
		await sleep(1000);
		lastBlock = await getLastBlock();
	}

	return lastBlock;
};

const arrIntersect = (arrA, arrB) => arrA.filter(x => arrB.includes(x));
const arrDifference = (arrA, arrB) => arrA.filter(x => !arrB.includes(x));
const arrSymDifference = (arrA, arrB) =>
	arrA
		.filter(x => !arrB.includes(x))
		.concat(arrB.filter(x => !arrA.includes(x)));
const arrUnion = (arrA, arrB) => [...arrA, ...arrB];
const arrCompare = (arrA, arrB) => arrA.every((v, i) => arrB[i] === v);

const getRandomAccount = () => {
	const passphrase = getRandomBytes(10).toString('hex');
	const address = getAddressFromPassphrase(passphrase);
	const { publicKey, privateKey } = getPrivateAndPublicKeyFromPassphrase(
		passphrase,
	);

	return { passphrase, publicKey, privateKey, nonce: 0, address };
};

const getGenesisKeyPair = generatorPublicKey =>
	genesisDelegates.find(({ publicKey }) => publicKey === generatorPublicKey);

const blocksPerRound = 103;

const calcRound = height => Math.ceil(height / blocksPerRound);
const startOfRound = round => round * blocksPerRound - blocksPerRound + 1;
const endOfRound = round => round * blocksPerRound;
const middleOfRound = round =>
	Math.floor(
		(startOfRound(round, blocksPerRound) + endOfRound(round, blocksPerRound)) /
			2,
	);

module.exports = {
	arrCompare,
	arrDifference,
	arrIntersect,
	arrSymDifference,
	arrUnion,
	calcRound,
	client,
	config: devnetConfig,
	endOfRound,
	genesisAccount,
	genesisBlock,
	genesisDelegates,
	getAccount,
	getAccountFromStorage,
	getAccountNonce,
	getGenesisKeyPair,
	getLastBlock,
	getRandomAccount,
	middleOfRound,
	networkIdentifier,
	sleep,
	startOfRound,
	storage,
	waitForBlock,
};
