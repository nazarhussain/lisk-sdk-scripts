import { Application, HTTPAPIPlugin, ForgerPlugin, ApplicationConfig } from 'lisk-sdk';
import { objects } from '@liskhq/lisk-utils';
import * as genesisBlockDevnet from '../config/devnet/genesis_block.json';
import * as devnetConfig from '../config/devnet/config.json';

const myConfig = {
	logger: {
		consoleLogLevel: 'debug',
	},
};

type RecursivePartial<T> = {
	[P in keyof T]?: RecursivePartial<T[P]>;
};

// eslint-disable-next-line import/prefer-default-export
export const createApplication = ({
	genesisBlock,
	config,
}: {
	genesisBlock?: Record<string, unknown>;
	config?: RecursivePartial<ApplicationConfig>;
}): Application => {
	const app = Application.defaultApplication(
		genesisBlock || genesisBlockDevnet,
		objects.mergeDeep({}, devnetConfig, myConfig, config ?? {}),
	);

	app.registerPlugin(HTTPAPIPlugin);
	app.registerPlugin(ForgerPlugin);

	return app;
};
