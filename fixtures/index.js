
const genesisBlock = require('../config/devnet/genesis_block.json');
const {
	getNetworkIdentifier,
	getRandomBytes,
	getPrivateAndPublicKeyFromPassphrase,
	getAddressFromPassphrase,
} = require('@liskhq/lisk-cryptography');

module.exports = networkIdentifier = getNetworkIdentifier(
	Buffer.from(genesisBlock.id, 'hex'),
	'LSK',
);