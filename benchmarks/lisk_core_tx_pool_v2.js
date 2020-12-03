const [, , liskCorePath] = process.argv;
const { config } = require(`${liskCorePath}/dist/helpers/config`);
const { NETWORK } = config;
const genesisBlock = require(`${liskCorePath}/config/${NETWORK}/genesis_block.json`);
const { Application } = require(`${liskCorePath}/node_modules/lisk-sdk`);

const sleep = async ms => new Promise(resolve => setTimeout(resolve, ms));

config.modules.chain.forging.force = false;
config.modules.chain.broadcasts.broadcastInterval = 50;
config.modules.chain.broadcasts.active = false;

const app = new Application(genesisBlock, config);

const testIterations = 3;
const processableCheckDuration = 50;
const txPayloadLimit = 15 * 1024;

const maxTransactionsBenchMarkValues = [
	4096,
	8192,
	// 10240
];

/**
 * @typedef BenchMarkEntry
 * @type {object}
 * @property {number} maxTransactions
 * @property {number} maxTransactionsPerAccount
 * @property {number} size
 * @property {number} spentTime
 */

/**
 * @typedef AggregatedBenchMarkEntry
 * @type {object}
 * @property {number} maxTransactions
 * @property {number} maxTransactionsPerAccount
 * @property {object} size
 * @property {number} size.min
 * @property {number} size.max
 * @property {number} size.avg
 * @property {object} spentTime
 * @property {number} spentTime.min
 * @property {number} spentTime.max
 * @property {number} spentTime.avg
 */

/**
 * Aggregate the results iterations
 *
 * @param {Array<Array<BenchMarkEntry>>} results
 * @return {Array<AggregatedBenchMarkEntry>}
 */
const aggregateBenchmarkResults = results => {
	const aggregate = [];
	const flatResults = [].concat.apply([], results);

	for (const maxTransactions of maxTransactionsBenchMarkValues) {
		const res = flatResults.filter(r => r.maxTransactions === maxTransactions);
		const spentTimes = res.map(r => r.spentTime);
		const sizes = res.map(r => r.size);
		const counts = res.map(r => r.count);

		aggregate.push({
			maxTransactions,
			maxTransactionsPerAccount: NaN,
			count: {
				min: Math.min(...counts),
				max: Math.max(...counts),
				avg: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
			},
			size: {
				min: Math.min(...sizes),
				max: Math.max(...sizes),
				avg: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
			},
			spentTime: {
				min: Math.min(...spentTimes),
				max: Math.max(...spentTimes),
				avg: Math.round(spentTimes.reduce((a, b) => a + b, 0) / spentTimes.length),
			},
		});
	}

	return aggregate;
};

/**
 * Convert results to csv
 *
 * @param {Array<AggregatedBenchMarkEntry>} results
 */
const resultToCSV = results => {
	console.info('---------------------------------------');
	const columns = [
		'Max Transactions',
		'Transactions Per Account',
		'Count Min',
		'Count Max',
		'Count Avg',
		'Spent Time Min',
		'Spent Time Max',
		'Spent Time Average',
		'Transaction Size Min',
		'Transaction Size Max',
		'Transaction Size Average',
	];

	console.info(columns.join());

	for (const { maxTransactions, maxTransactionsPerAccount, size, spentTime, count } of results) {
		console.info(
			[
				maxTransactions,
				maxTransactionsPerAccount,
				count.min,
				count.max,
				count.avg,
				spentTime.min,
				spentTime.max,
				spentTime.avg,
				size.min,
				size.max,
				size.avg,
			].join(),
		);
	}
	console.info('---------------------------------------');
};

const emptyTxPool = txPool => {
	txPool.pool.removeTransactionsFromQueues(Object.keys(txPool.pool.queues), () => true);
};

/**
 * Benchmark getProcessableTransactions by repeating the results
 *
 * @param txPool
 * @return {Promise<{BenchMarkEntry}>}
 */
const benchmarkProcessableTransactions = async txPool => {
	const maxTransactions = txPool.pool._maxTransactionsPerQueue;

	const results = [];

	let size = 0;
	let count = 0;

	while (size < txPayloadLimit) {
		const transactions = txPool.pool.getProcessableTransactions(maxTransactions);
		size = 0;
		count = 0;
		for (const transaction of transactions) {
			size += transaction.getBytes().length;
			count += 1;
		}
		console.info({ size, count });
		results.push({
			time: new Date().getTime(),
			count,
			size,
		});

		await sleep(processableCheckDuration);
	}

	const filteredResults = results.filter(res => res.count > 0);
	const firstEntry = filteredResults[0];
	const lastEntry = filteredResults[filteredResults.length - 1];
	const spentTime = lastEntry.time - firstEntry.time;
	const txsSize = lastEntry.size;
	const txsCount = lastEntry.count;

	return {
		count: txsCount,
		size: txsSize,
		spentTime,
		maxTransactions,
		maxTransactions,
	};
};

/**
 * Start benchmark and return result
 *
 * @param txPool
 * @return {Promise<[BenchMarkEntry]>}
 */
const startBenchMark = async txPool => {
	const benchMarkResults = [];

	for (const maxTransactionsLimit of maxTransactionsBenchMarkValues) {
		emptyTxPool(txPool);
		// eslint-disable-next-line no-param-reassign
		txPool.maxTransactionsPerBlock = maxTransactionsLimit;
		txPool.maxTransactionsPerQueue = maxTransactionsLimit;
		txPool.pool._maxTransactionsPerQueue = maxTransactionsLimit;
		txPool.pool._verifiedTransactionsProcessingLimitPerInterval = maxTransactionsLimit;
		txPool.pool._pendingTransactionsProcessingLimit = maxTransactionsLimit;

		benchMarkResults.push(await benchmarkProcessableTransactions(txPool));
	}

	return benchMarkResults;
};

app
	.run()
	.then(async () => {
		app.logger.info('App started...');
		const results = [];

		const txPool = app.controller.modules.chain.chain.transactionPool;

		for (let i = 1; i <= testIterations; i += 1) {
			results.push(await startBenchMark(txPool));
		}

		resultToCSV(aggregateBenchmarkResults(results));

		await app.shutdown(0);
	})
	.catch(error => {
		if (error instanceof Error) {
			app.logger.error('App stopped with error', error);
			app.logger.debug(error.stack);
		} else {
			app.logger.error('App stopped with error', error);
		}
		process.exit();
	});
