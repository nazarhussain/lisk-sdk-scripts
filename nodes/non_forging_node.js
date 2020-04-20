const { createApplication } = require('./app');

const app = createApplication({ forging: { force: false } });

app
	.run()
	.then(() => {
		app.logger.info('App started...');
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
