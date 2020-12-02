import { apiClient, ApplicationConfig } from 'lisk-sdk';
import { AccountSeed } from './types';
import { Chain } from './chain';
import { Factory } from './factory';
import { Faucet } from './faucet';
import { Store } from './store';
import { Pool } from './pool';
import { transfer } from '../transactions';

interface ContainerOptions {
	clientMode: 'ws' | 'ipc';
	connectionString: 'string';
	genesisAccount: AccountSeed;
	config?: Partial<ApplicationConfig>;
	maxTransactions: number;
	maxTransactionsPerAccount: number;
}

export class Container {
	private _options: ContainerOptions;
	public client!: apiClient.APIClient;
	public chain!: Chain;
	public store!: Store;
	public faucet!: Faucet;
	public factory!: Factory;
	public pool!: Pool;
	public networkIdentifier!: Buffer;
	public tx = {
		transfer,
	}

	constructor(opts: ContainerOptions) {
		this._options = opts;
	}

	public async bootstrap(): Promise<Container> {
		if (this._options.clientMode === 'ipc') {
			this.client = await apiClient.createIPCClient(this._options.connectionString);
		} else {
			this.client = await apiClient.createWSClient(this._options.connectionString);
		}

		const networkInfo = await this.client.node.getNodeInfo();

		this.networkIdentifier = Buffer.from(networkInfo.networkIdentifier, 'hex');

		this.chain = new Chain({ client: this.client });
		this.pool = new Pool({
			client: this.client,
			maxTransactions: this._options.maxTransactions,
			maxTransactionsPerAccount: this._options.maxTransactionsPerAccount,
		});

		this.factory = new Factory({ client: this.client, networkIdentifier: this.networkIdentifier });
		this.store = new Store({ client: this.client, networkIdentifier: this.networkIdentifier });
		this.faucet = new Faucet({
			pool: this.pool,
			genesisAccount: this._options.genesisAccount,
			client: this.client,
			store: this.store,
			networkIdentifier: this.networkIdentifier,
		});

		return this;
	}
}
