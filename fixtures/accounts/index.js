const {getRandomBytes, getAddressFromPassphrase, getPrivateAndPublicKeyFromPassphrase} = require('@liskhq/lisk-cryptography');

const api = require('../../api_clients');

const getRandomAccount = () => {
	const passphrase = getRandomBytes(10).toString('hex');
	const address = getAddressFromPassphrase(passphrase);
	const { publicKey, privateKey } = getPrivateAndPublicKeyFromPassphrase(
		passphrase,
	);

	return { passphrase, publicKey, privateKey, nonce: 0, address };
};

const getGenesisDelegatesKeyPair = generatorPublicKey =>
	genesisDelegates.find(({ publicKey }) => publicKey === generatorPublicKey);
	
const getAccountNonce = async (address)	=> {
  const result = await api.http.accounts.accountsAddressGet(address);
  return BigInt(result.data.sequence.nonce);
}
  
module.exports = {
  getRandomAccount,
	getGenesisDelegatesKeyPair,
	getAccountNonce
}
