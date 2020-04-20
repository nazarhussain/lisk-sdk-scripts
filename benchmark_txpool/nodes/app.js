const {
	Application,
	genesisBlockDevnet,
	configDevnet,
	configurator,
} = require('../../../sdk');

const myConfig = {
	components: {
		logger: {
			consoleLogLevel: 'info',
		},
		storage: {
			user: 'postgres',
			password: 'password',
		},
	},
};

configurator.loadConfig(configDevnet);
configurator.loadConfig(myConfig);

const createApplication = (customConfig = {}, genesisBlock = null) => {
	const config = configurator.getConfig(customConfig);
	const app = new Application(genesisBlock || genesisBlockDevnet, config);

	return app;
};

module.exports = {
	createApplication,
	genesisBlockDevnet,
};
