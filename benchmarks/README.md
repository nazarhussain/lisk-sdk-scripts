# Benchmarking

Use following steps to setup and run the benchmarking scripts.

## Pre-requisites

Install nvm, node and setup the repo

```bash
apt update
apt install build-essential
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash
source ~/.bashrc
nvm install 12.20
nvm install 10.20
```

Clone required repositories.

```bash
git clone https://github.com/nazarhussain/lisk-sdk-scripts
git clone https://github.com/LiskHQ/lisk-core.git
```

## Transaction Pool Benchmarking

In this benchmarking script we will focus on following KPI:

> How much in ms it take to make 15kb of transactions ready to forge from an incoming flow of valid transactions.

### Tx Pool for V3

We first need to generate few accounts that we are gonna use in benchmarking.

```bash
cd lisk-core
git fetch origin
git checkout release/3.0.0
nvm use 12.20
npm ci --registry https://npm.lisk.io
npm run build
./bin/run start -n devnet
```

Run the script in other window which will generate accounts.

```bash
cd lisk-sdk-scripts
git checkout sdk-5.0
nvm use 12.20
npm install -g yarn
yarn --registry=https://npm.lisk.io
cp -r /root/lisk-core/config/ .

npx ts-node load_generators/generate_accounts.js
```

It will take some time and you will have 200 accounts with initial founds at `/root/lisk-sdk-scripts/cache/benchmarks.json`. We will use these accounts in next steps.

We can close the lisk-core running in other window.

Now its time to run the benchmarking scripts.

```bash
npx ts-node benchmarks/lisk_core_tx_pool_v3.js /root/lisk-core
```

When the scripts finishes you will get an output like this. It's a csv, copy it to some text editor and save it.

```csv
Max Transactions,Transactions Per Account,Count Min,Count Max,Count Avg,Spent Time Min,Spent Time Max,Spent Time Average,Transaction Size Min,Transaction Size Max,Transaction Size Average
4096,64,129,130,130,658,1133,867,18318,18460,18413
4096,128,128,130,129,605,1291,927,18176,18460,18318
4096,256,120,176,154,614,1028,803,17040,25040,21897
8192,64,114,130,123,568,819,681,16188,18460,17419
8192,128,114,130,124,715,1026,902,16188,18460,17655
8192,256,113,250,162,562,1758,1080,16046,35621,22997
10240,64,129,129,129,664,978,853,18318,18318,18318
10240,128,127,129,128,660,968,848,18034,18318,18223
10240,256,156,210,183,993,1154,1091,22180,29901,26041
```

### Tx Pool for V2

This benchmark is a bit tricky to run and for that we need to tweak source a bit.

We need to install v2 binary version, as it come along PostgreSQL installation.

```bash
wget https://downloads.lisk.io/lisk/main/2.1.6/lisk-2.1.6-Linux-x86_64.tar.gz
tar -xzvf lisk-2.1.6-Linux-x86_64.tar.gz
cd lisk-2.1.6-Linux-x86_64
bash lisk.sh start_db
source env.sh
createdb lisk_dev
```

As the Lisk 2.1.6 run the transaction pool job every 5 seconds which is way high to run this benchmark. So we need to tweak one config here. Update minimum value of `.modules.chain.broadcasts.broadcastInterval` to `50`

```bash
vi +28 /home/lisk/lisk-2.1.6-Linux-x86_64/node_modules/lisk-framework/src/modules/chain/defaults/config.js
```

Change `minimum` value to `50`.

Now change to old release on source code to use qa scripts.

```bash
cd lisk-core
git checkout v2.1.6 -b v2.1.6
cd qa
nvm use 10.20
npm ci --dev
```

If you face any error in package installations. Try these commands and then run `npm ci --dev`.

```bash
npm config set user 0
npm config set unsafe-perm true
```

Add local peer for sending transactions. For that add `127.0.0.1` to `peers` property of `qa/test/fixtures/config.json` file.

Copy following script as `qa/test/stress/0_only_transfer.js`

```js
const output = require('codeceptjs').output;
const {
	TO_BEDDOWS,
	createAccounts,
	TRS_TYPE,
} = require('../../utils');

const I = actor();
const STRESS_COUNT = parseInt(process.env.STRESS_COUNT) || 25;
const accounts = createAccounts(STRESS_COUNT);

Feature('Generic stress test');

Scenario('Transfer funds', async () => {
	output.print(
		`==========Running Stress Test, Transaction Type: ${
			TRS_TYPE.TRANSFER
		}==========`
	);

	const LSK_TOKEN = 100;
	const transferTrx = accounts.map(a => ({
		recipientId: a.address,
		amount: TO_BEDDOWS(LSK_TOKEN),
	}));

	try {
		await I.transferToMultipleAccounts(
			transferTrx
		);
	} catch (error) {
		output.print('Error while processing transfer fund transaction', error);
	}
})
	.tag('@slow')
	.tag('@only_transfer')
	.tag('@stress');
```

Now its time to start the node.

```bash
cd lisk-sdk-scripts
nvm use 10.20
node benchmarks/lisk_core_tx_pool_v2.js /home/lisk/lisk-2.1.6-Linux-x86_64  | npx bunyan -o short
```

And afterwards run the stress test to send transactions.

```bash
cd lisk-core/qa
nvm use 10.20
STRESS_COUNT=1000 npm run stress:generic -- --grep '@only_transfer'
```

Remember above command will send 1000 transactions and then end. So you have to run it multiple times (5-6) times until the benchmarking scripts finish. And at the end you will see an output similar to:

```csv
Max Transactions,Transactions Per Account,Count Min,Count Max,Count Avg,Spent Time Min,Spent Time Max,Spent Time Average,Transaction Size Min,Transaction Size Max,Transaction Size Average
4096,NaN,202,1000,474,764,8663,3412,23634,117000,55497
8192,NaN,134,220,183,488,777,608,15678,25740,21372
```
