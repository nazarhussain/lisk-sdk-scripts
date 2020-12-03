const { utils } = require('lisk-sdk');
const { sleep } = require('../utils/container/common');
const childProcess = require('child_process');
const path = require('path');

const [, , liskCorePath] = process.argv;

const { getApplication } = require(`${liskCorePath}/dist/application`);
const genesisBlock = require(`${liskCorePath}/config/devnet/genesis_block.json`);
const config = require(`${liskCorePath}/config/devnet/config.json`);

const app = getApplication(
	genesisBlock,
	utils.objects.mergeDeep(config, { forging: { force: false } }),
	{
		enableHTTPAPIPlugin: true,
		enableForgerPlugin: true,
	},
);

const testIterations = 3;
const processableCheckDuration = 50;
const txPayloadLimit = 15 * 1024;

const maxTransactionsBenchMarkValues = [
	// 1024,
	// 2048,
	// 3072,
	4096,
	// 5120,
	// 6144,
	// 7168,
	8192,
	// 9216,
	10240,
];
const perAccountBenchMarkValues = [
	// 16,
	// 32,
	// 48,
	64,
	// 80,
	// 96,
	// 112,
	128,
	// 144,
	// 160,
	// 176,
	// 192,
	// 208,
	// 224,
	// 240,
	256,
	// 272,
	// 288,
	// 304,
	// 320,
	// 336,
	// 352,
	// 368,
	// 384,
	// 400,
	// 416,
	// 432,
	// 448,
	// 464,
	// 480,
	// 496,
	// 512,
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
	const flatResults = results.flat();

	for (const maxTransactions of maxTransactionsBenchMarkValues) {
		for (const maxTransactionsPerAccount of perAccountBenchMarkValues) {
			const res = flatResults.filter(
				r =>
					r.maxTransactions === maxTransactions &&
					r.maxTransactionsPerAccount === maxTransactionsPerAccount,
			);
			const spentTimes = res.map(r => r.spentTime);
			const sizes = res.map(r => r.size);
			const counts = res.map(r => r.count);

			aggregate.push({
				maxTransactions,
				maxTransactionsPerAccount,
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
	const transactions = txPool.getAll();
	for (const tx of transactions) {
		txPool.remove(tx);
	}
};

/**
 * Benchmark getProcessableTransactions by repeating the results
 *
 * @param txPool
 * @return {Promise<{BenchMarkEntry}>}
 */
const benchmarkProcessableTransactions = async txPool => {
	const maxTransactions = txPool._maxTransactions;
	const maxTransactionsPerAccount = txPool._maxTransactionsPerAccount;

	const results = [];

	let size = 0;
	let count = 0;

	while (size < txPayloadLimit) {
		const transactionsMap = txPool.getProcessableTransactions();
		const transactions = transactionsMap.values().flat();
		count = 0;
		size = 0;
		for (const transaction of transactions) {
			size += transaction.getBytes().length;
			count += 1;
		}

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
		maxTransactionsPerAccount,
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
		for (const perAccountLimit of perAccountBenchMarkValues) {
			txPool.stop();
			emptyTxPool(txPool);
			// eslint-disable-next-line no-param-reassign
			txPool._maxTransactionsPerAccount = perAccountLimit;
			// eslint-disable-next-line no-param-reassign
			txPool._maxTransactions = maxTransactionsLimit;
			await txPool.start();

			const loadProcess = childProcess.fork(
				path.join(__dirname, '../load_generators/generate_transfer_tx_load.js'),
				['--unhandled-rejections', 'strict'],
				{
					env: {
						PATH: process.env.PATH,
						MAX_TRANSACTIONS: maxTransactionsLimit,
						MAX_TRANSACTIONS_PER_ACCOUNT: perAccountLimit,
					},
				},
			);

			benchMarkResults.push(await benchmarkProcessableTransactions(txPool));

			loadProcess.kill('SIGHUP');
		}
	}

	return benchMarkResults;
};

app
	.run()
	.then(async () => {
		app.logger.info('App started...');
		const results = [];

		for (let i = 1; i <= testIterations; i += 1) {
			results.push(await startBenchMark(app._node._transactionPool));
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
