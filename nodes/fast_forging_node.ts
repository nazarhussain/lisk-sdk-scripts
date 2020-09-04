import { createApplication } from '../utils/application';

const app = createApplication({
	genesisConfig: { blockTime: 2 },
	forging: { waitThreshold: 1, force: true },
});

app
	.run()
	.then(() => {
		app.logger.info('App started...');
	})
	.catch(error => {
		if (error instanceof Error) {
			app.logger.error('App stopped with error');
			app.logger.debug(error.stack);
		} else {
			app.logger.error('App stopped with error', error);
		}
		process.exit();
	});
