import { setWorldConstructor, setDefaultTimeout } from 'cucumber';
import { api } from '../../utils/api';
import { AccountSeed } from '../../types';

// eslint-disable-next-line import/prefer-default-export
export class CustomWorld {
	public api: typeof api;
	public debug: boolean;
	public accounts: Record<string, AccountSeed>;
  public lastError: Record<string, unknown> | undefined;
  public lastTrsId: string | undefined;

	constructor() {
		this.api = api;
		this.debug = false;
		this.accounts = {};
    this.lastError = undefined;
    this.lastTrsId = undefined;
	}
}

declare module 'cucumber' {
	interface World {
		api: typeof api;
		debug: boolean;
    accounts: Record<string, AccountSeed>;
    lastError: Record<string, unknown> | undefined;
    lastTrsId: string | undefined;
	}
}

// Disable timeout as we need longer processing
setDefaultTimeout(-1);

setWorldConstructor(CustomWorld);
