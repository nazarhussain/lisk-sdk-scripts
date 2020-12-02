const { createIPCClient } = require('@liskhq/lisk-api-client');

const client = await createIPCClient('/Users/nazar/.lisk/lisk-core');

module.exports = { client };
