const { Container } = require('../utils/container');
const { homedir } = require('os');

const process = async () => {
	const container = new Container({
		clientMode: 'ipc',
		connectionString: `${homedir()}/.lisk/lisk-core`,
		genesisAccount: {
			address: Buffer.from('d04699e57c4a3846c988f3c15306796f8eae5c1c', 'hex'),
			publicKey: Buffer.from(
				'0fe9a3f1a21b5530f27f87a414b549e79a940bf24fdf2b2f05e7f22aeeecc86a',
				'hex',
			),
			passphrase: 'peanut hundred pen hawk invite exclude brain chunk gadget wait wrong ready',
		},
	});

	await container.bootstrap();

	const accounts = container.factory.loadOrGenerateRandomAccounts('benchmarks', 200);
	await container.faucet.fundAccounts(accounts, '10000');
	console.info('Account generation complete....');
};

process().then(console.info).catch(console.error);
