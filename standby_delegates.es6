const assert = require('assert');
const {
	client,
	storage,
	arrDifference,
	networkIdentifier,
	getRandomAccount,
	waitForBlock,
	genesisAccount,
	getAccountNonce,
	calcRound,
	startOfRound,
	getLastBlock,
} = require('./utils.es6');
const {
	registerDelegate,
	castVotes,
	transfer,
	utils: { convertLSKToBeddows },
} = require('../elements/lisk-transactions');

const getForgetList = async () =>
	JSON.parse(await storage.entities.ConsensusState.getKey('dpos:forgersList'));

const getVoteWeights = async () =>
	JSON.parse(await storage.entities.ConsensusState.getKey('dpos:voteWeights'));

const getDposListsForRound = async round => {
	await waitForBlock({ height: startOfRound(round) });

	const forgerList = (await getForgetList()).find(list => list.round === round);
	const voteWeightsList = (await getVoteWeights()).find(
		list => list.round === round,
	);

	return { forgerList, voteWeightsList };
};

const registerRandomDelegate = async ({ username } = {}) => {
	const account = getRandomAccount();
	account.username =
		username ||
		Math.random()
			.toString(36)
			.substring(2, 15);
	genesisAccount.nonce = await getAccountNonce(genesisAccount);

	const transferTx = transfer({
		amount: convertLSKToBeddows('12'),
		fee: convertLSKToBeddows('0.1'),
		recipientPublicKey: account.publicKey,
		nonce: genesisAccount.nonce.toString(),
		senderPublicKey: genesisAccount.publicKey,
		passphrase: genesisAccount.passphrase,
		networkIdentifier,
	});
	await client.transactions.broadcast(transferTx);
	await waitForBlock({ heightOffset: 1 });

	const delegateTx = registerDelegate({
		passphrase: account.passphrase,
		nonce: account.nonce.toString(),
		networkIdentifier,
		username: account.username,
		fee: convertLSKToBeddows('10.5'),
	});

	await client.transactions.broadcast(delegateTx);

	return account;
};

// For first round there must be 101 active delegates and 2 standby delegates
const case1FirstRound = async () => {
	const forgerList = await getForgetList();
	const firstRound = forgerList.find(list => list.round === 1);
	const {
		round,
		standby: standbyDelegates,
		delegates: shuffledDelegates,
	} = firstRound;
	const activeDelegates = arrDifference(shuffledDelegates, standbyDelegates);

	assert(round === 1, 'First round not found');
	assert(
		standbyDelegates.length === 2,
		`Standby delegates in first round are not 2 instead ${standbyDelegates.length}`,
	);
	assert(
		activeDelegates.length === 101,
		`Active delegates in first round are not 101 instead ${activeDelegates.length}`,
	);
	console.info(
		'Case1: For first round there must be 101 active delegates and 2 standby delegates',
	);
};

// Create delegates with 0 totalVotes Received, with the current genesis they
// should not be included in the forgers list and vote weights
const case2DelegateWithZeroTotalVotes = async () => {
	const delegate = await registerRandomDelegate();
	await waitForBlock({ heightOffset: 1 });
	const [account] = (
		await client.accounts.get({ address: delegate.address })
	).data;
	console.info({ delegate: account });
	assert(account !== undefined, 'Delegate account is not registered');

	const lastBlock = await getLastBlock();
	const nextRound = calcRound(lastBlock.height) + 3;
	const { forgerList, voteWeightsList } = await getDposListsForRound(nextRound);

	const inForgerList = forgerList.delegates.includes(delegate.address);
	const inVoteWeights = voteWeightsList.delegates.find(
		({ address }) => address === delegate.address,
	);

	assert(forgerList !== undefined, 'Forger list for round must exists.');
	assert(
		voteWeightsList !== undefined,
		'Vote weight list for round must exists.',
	);
	assert(!inForgerList, 'Delegate should not be part of forger list');
	assert(!inVoteWeights, 'Delegate should not be part of vote weights list');

	console.info(
		'Case 2: Create delegates with 0 totalVotes Received, with the current genesis they\n' +
			'// should not be included in the forgers list and vote weights',
	);
};

// Create delegate with 1000 voteWeight, and see if they will be included in the
// voteWeights and at some point forgerList (with randomness)
const case3DelegateWith1000TotalVotes = async () => {
	const delegate = await registerRandomDelegate();
	await waitForBlock({ heightOffset: 1 });

	// Transfer 1000 LSK
	const transferTx = transfer({
		amount: convertLSKToBeddows('10000'),
		fee: convertLSKToBeddows('0.1'),
		recipientPublicKey: delegate.publicKey,
		nonce: await getAccountNonce(genesisAccount),
		senderPublicKey: genesisAccount.publicKey,
		passphrase: genesisAccount.passphrase,
		networkIdentifier,
	});
	await client.transactions.broadcast(transferTx);
	await waitForBlock({ heightOffset: 1 });

	const voteTx = castVotes({
		votes: [
			{
				delegateAddress: delegate.address,
				amount: convertLSKToBeddows('1000'),
			},
		],
		passphrase: delegate.passphrase,
		nonce: await getAccountNonce(delegate),
		fee: convertLSKToBeddows('1'),
		networkIdentifier,
	});
	await client.transactions.broadcast(voteTx);

	const lastBlock = await getLastBlock();
	let nextRound = calcRound(lastBlock.height) + 3;
	let inForgerList = false;

	while (!inForgerList) {
		const { forgerList, voteWeightsList } = await getDposListsForRound(
			nextRound,
		);
		const inVoteWeights = voteWeightsList.delegates.find(
			({ address }) => address === delegate.address,
		);
		inForgerList = forgerList.delegates.includes(delegate.address);

		assert(inVoteWeights, 'Delegate should be part of vote weights list');
		assert(
			inVoteWeights.voteWeight === convertLSKToBeddows('1000'),
			'Delegate vote weight should be 1000 LSK',
		);
		if (inForgerList) {
			console.info(
				`Delegate ${delegate.address} is part of the forget list for round ${nextRound}`,
			);
			if (forgerList.standby.includes(delegate.address)) {
				console.info(`Delegate ${delegate.address} is a standby delegate`);
			} else {
				console.info(`Delegate ${delegate.address} is not a standby delegate`);
			}
			break;
		}

		console.info(
			`Delegate is not part of current forget list for round ${nextRound}. Waiting for next round.`,
		);
		nextRound += 1;
	}

	console.info(
		'Create delegate with 1000 voteWeight, and see if they will be included in the ' +
			'voteWeights and at some point forgerList (with randomness)',
	);
};

const process = async () => {
	// First case for round 1
	await storage.bootstrap();

	// await case1FirstRound();

	// await case2DelegateWithZeroTotalVotes();

	// await case3DelegateWith1000TotalVotes();

	const lastBlock = await getLastBlock();
	const round = calcRound(lastBlock.height);
	const { forgerList } = await getDposListsForRound(round);
	console.info({ 'Standby delegates': forgerList.standby, round });
};

process()
	.then(console.info)
	.catch(console.error);
