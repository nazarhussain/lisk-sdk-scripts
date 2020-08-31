import { Before } from 'cucumber';

// eslint-disable-next-line prefer-arrow-callback
Before({ tags: '@ignore' }, function () {
	return 'skipped';
});

Before({ tags: '@debug' }, function () {
	this.debug = true;
});
