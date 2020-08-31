

export interface AccountSeed {
  passphrase: string;
  publicKey: Buffer;
  privateKey: Buffer;
  nonce: BigInt;
  address: Buffer;
  [key: string]: unknown;
}
