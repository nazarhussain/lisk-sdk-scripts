import { Application } from 'lisk-sdk';
import { objects } from '@liskhq/lisk-utils';
import { HTTPAPIPlugin } from '@liskhq/lisk-framework-http-api-plugin';
import { ForgerPlugin } from '@liskhq/lisk-framework-forger-plugin';
import * as genesisBlockDevnet from '../config/devnet/genesis_block.json';
import * as config from '../config/devnet/config.json';

const myConfig = {
	rootPath: '~/.lisk/my-qa-app',
	logger: {
		logger: {
			consoleLogLevel: 'debug',
		},
	},
};

// eslint-disable-next-line import/prefer-default-export
export const createApplication = (
	customConfig: Record<string, unknown>,
	genesisBlock = null,
): Application => {
	const app = Application.defaultApplication(
		genesisBlock || genesisBlockDevnet,
		objects.mergeDeep({}, config, myConfig, customConfig),
	);

	app.registerPlugin(HTTPAPIPlugin);
	app.registerPlugin(ForgerPlugin);

	return app;
};
