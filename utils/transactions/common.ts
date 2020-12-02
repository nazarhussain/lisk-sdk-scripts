import { objects } from '@liskhq/lisk-utils';
import { codec, Schema } from '@liskhq/lisk-codec';
import * as genesisConfig from '../../config/devnet/config.json';

export const baseAssetSchema = {
	$id: 'lisk/base-transaction',
	type: 'object',
	required: ['moduleID', 'assetID', 'nonce', 'fee', 'senderPublicKey', 'asset'],
	properties: {
		moduleID: {
			dataType: 'uint32',
			fieldNumber: 1,
		},
		assetID: {
			dataType: 'uint32',
			fieldNumber: 2,
		},
		nonce: {
			dataType: 'uint64',
			fieldNumber: 3,
		},
		fee: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
		senderPublicKey: {
			dataType: 'bytes',
			fieldNumber: 5,
		},
		asset: {
			dataType: 'bytes',
			fieldNumber: 6,
		},
		signatures: {
			type: 'array',
			items: {
				dataType: 'bytes',
			},
			fieldNumber: 7,
		},
	},
};

export interface BaseTransactionAssetInput {
	moduleID?: number;
	assetId?: number;
	senderPublicKey?: Buffer;
	fee: string;
	nonce: string;
	networkIdentifier: Buffer;
}

export interface SignedTransactionObject<T> {
	id: Buffer;
	moduleID: number;
	assetID: number;
	senderPublicKey: Buffer;
	fee: bigint;
	nonce: bigint;
	networkIdentifier: Buffer;
	signatures: Buffer[];
	asset: T;
}

export interface TransactionAssetOutput<T> {
	id: Buffer;
	tx: Omit<SignedTransactionObject<T>, 'id'>;
	minFee: bigint;
}

export interface BaseUnsignedTransactionAssetInput extends BaseTransactionAssetInput {
	passphrase: string;
}

export const getFullAssetSchema = (assetSchema: Schema): Schema =>
	objects.mergeDeep({}, baseAssetSchema, {
		properties: { asset: assetSchema },
	}) as Schema;

export const calcMinTxFee = (
	assetSchema: Schema,
	tx: Omit<SignedTransactionObject<Record<string, unknown>>, 'id'>,
): bigint => {
	// eslint-disable-next-line @typescript-eslint/ban-types
	const assetBytes = codec.encode(assetSchema, (tx.asset as unknown) as object);
	const bytes = codec.encode(baseAssetSchema, { ...tx, asset: assetBytes });
	return BigInt(bytes.length * genesisConfig.genesisConfig.minFeePerByte);
};
