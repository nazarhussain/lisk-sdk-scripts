import { Given, When, Then } from 'cucumber';
import * as expect from 'expect';
import { generateRandomAccount, genesisAccount, getAccountNonce } from '../../utils/accounts';
import { networkIdentifier, waitForBlock, getLastBlock } from '../../utils/network';
import { transfer, convertLSKToBeddows, register } from '../../utils/transactions';

Given('A valid account {string} with {int}LSK balance', async function (
	accountName: string,
	balance: number,
) {
	const account = generateRandomAccount();
	this.accounts[accountName] = account;

	const genesisAccountNonce = BigInt(await getAccountNonce(genesisAccount.address));

	const [id, tx] = transfer({
		recipientAddress: account.address,
		amount: convertLSKToBeddows(balance.toString()),
		fee: convertLSKToBeddows('0.1'),
		nonce: genesisAccountNonce.toString(),
		passphrase: genesisAccount.passphrase,
		networkIdentifier,
	});

	await this.api.http.transactions.transactionsPost(tx);
	await waitForBlock({ heightOffset: 1 });
	await this.api.http.transactions.transactionsIdGet(id);
});

When('Try to register account {string} as delegate with username {string}', async function (
	accountName: string,
	username: string,
) {
  const account = this.accounts[accountName];

	const genesisAccountNonce = BigInt(await getAccountNonce(genesisAccount.address));
	const [id, tx] = register({
		senderPublicKey: account.publicKey,
		username,
		nonce: genesisAccountNonce.toString(),
		passphrase: genesisAccount.passphrase,
		fee: convertLSKToBeddows('11'),
		networkIdentifier,
	});

	try {
		await this.api.http.transactions.transactionsPost(tx);
		this.lastTrsId = id;
	} catch (res) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		this.lastError = await res.json();
	}
});

Then('It should fail with error message {string}', function (message: string) {
	expect(this.lastError).toEqual({ errors: [{ message }] });
});

Then('It should be accepted', function () {
	expect(this.lastError).toBeUndefined();
	expect(this.lastTrsId).not.toBeUndefined();
});

Then(
	'the account {string} should be converted to a delegate with username {string}',
	async function (accountName: string, username: string) {
		await waitForBlock({ heightOffset: 1 });
		const res = await this.api.http.accounts.accountsAddressGet(
			this.accounts[accountName].address.toString('hex'),
    );
		expect(res.data.dpos.delegate.username).toEqual(username);
	},
);

When('Try to register account {string} as delegate with username {string} with fee {int}LSK', async function (accountName: string, username: string, fee: number) {
  const account = this.accounts[accountName];

	const genesisAccountNonce = BigInt(await getAccountNonce(genesisAccount.address));
	const [id, tx] = register({
		senderPublicKey: account.publicKey,
		username,
		nonce: genesisAccountNonce.toString(),
		passphrase: genesisAccount.passphrase,
		fee: convertLSKToBeddows(fee.toString()),
		networkIdentifier,
	});

	try {
		await this.api.http.transactions.transactionsPost(tx);
		this.lastTrsId = id;
	} catch (res) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		this.lastError = await res.json();
	}
});

Then('the account {string} should have lastForgedHeight set to last block height', async function (accountName: string) {
  const lastBlock = await getLastBlock();
  await waitForBlock({ heightOffset: 1 });

  const res = await this.api.http.accounts.accountsAddressGet(
    this.accounts[accountName].address.toString('hex'),
  );
  expect(res.data.dpos.delegate.lastForgedHeight).toEqual(lastBlock.header.height + 1);
});
