export interface AccountSeed {
	passphrase: string;
	publicKey: Buffer;
	privateKey: Buffer;
	address: Buffer;
}

export interface Account {
  address: Buffer;
  sequence: {
    nonce: bigint;
  }
}
