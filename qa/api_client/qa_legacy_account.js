const { createWSClient, createIPCClient } = require('@liskhq/lisk-api-client');

(async () => {
	try {
		const wsClient = await createIPCClient('/Users/nazar/.lisk/lisk-core');
		// const wsClient = await createWSClient('ws://localhost:8080/ws');
		console.log('WS Client successfully connected to lisk-core');

		// ACHTUNG! ACHTUNG! you need to replace the genesis block accounts from dev with this ones for this to work
		// as the genesis block public keys were not saved
		// const accounts = [
		//   {
		//    "passphrase": "rude exclude man marine flame tenant animal such robot silver toward common",
		//    "privateKey": "e7e4bfcd7b831d39df3ebf40fe68e9c7d2fbb377b1891f4f3056a850dac2a009849943a9311b86401a8302f0ee70b96e2e68ce57fdb03ec68f9bcee5a10439a2",
		//    "publicKey": "849943a9311b86401a8302f0ee70b96e2e68ce57fdb03ec68f9bcee5a10439a2",
		//    "binaryAddress": "34f29cd28852fbb7a18b9033b085f5251e62855b",
		//    "address": "lskbta4akk365hs83o5rzasxx8qpk8bmx6skgm47f",
		//    "legacy": "b7fb5288d29cf234"
		//   },
		//   {
		//    "passphrase": "live coral skill lab letter art tonight play census enhance celery exile",
		//    "privateKey": "9bffbe368b572ecd0e257caa6ed15a14fc8f969410805816a0458791716a99cdd44da3cb7855dd12183a9621857124af70210bb54d4715ad6b14858a38192bbd",
		//    "publicKey": "d44da3cb7855dd12183a9621857124af70210bb54d4715ad6b14858a38192bbd",
		//    "binaryAddress": "238e81a1b0703bf0e98b01c6f48c437a006f018b",
		//    "address": "lskp7n3c39u7zhgxdo5znc84cvc83zbfzo5hzw5jw",
		//    "legacy": "f03b70b0a1818e23"
		//   }
		//  ]

		const accounts = [
			{
				passphrase: 'salad lawn air dentist enforce purity arctic jewel net neck alone mention',
				privateKey: Buffer.from(
					'80989c2bac40fc16819b87ee35257386ac852eac042dd8043eb19192b2fa21f438262844cf23c096aca2dad2e4cd75d50491ac30c89f84c83932d04ea903ef4c',
					'hex',
				),
				publicKey: Buffer.from(
					'38262844cf23c096aca2dad2e4cd75d50491ac30c89f84c83932d04ea903ef4c',
					'hex',
				),
				address: Buffer.from('8789de4316d79d22', 'hex'),
				oldAddress: '9766581646657035554L',
			},
		];

		const res = await wsClient.invoke('legacyAccount:getUnregisteredAccount', {
			publicKey: '38262844cf23c096aca2dad2e4cd75d50491ac30c89f84c83932d04ea903ef4c',
		});
		console.log(res);
		process.exit();
	} catch (error) {
		console.log(error);
		process.exit();
	}
})();
