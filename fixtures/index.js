const {
	getNetworkIdentifier,
	getRandomBytes,
	getPrivateAndPublicKeyFromPassphrase,
	getAddressFromPassphrase,
} = require('@liskhq/lisk-cryptography');
const genesisBlock = require('../config/devnet/genesis_block.json');

module.exports = networkIdentifier = getNetworkIdentifier(
	Buffer.from(genesisBlock.id, 'hex'),
	'LSK',
);
