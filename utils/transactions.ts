import { getPrivateAndPublicKeyFromPassphrase } from '@liskhq/lisk-cryptography';
import { signTransaction } from '@liskhq/lisk-transactions';
import { codec, Schema } from '@liskhq/lisk-codec';
import { objects } from '@liskhq/lisk-utils';
import * as genesisConfig from '../config/devnet/config.json';

export { convertBeddowsToLSK, convertLSKToBeddows } from '@liskhq/lisk-transactions';

const baseAssetSchema = {
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

const transferAssetSchema = {
	$id: 'lisk/transfer-asset',
	title: 'Transfer transaction asset',
	type: 'object',
	required: ['amount', 'recipientAddress', 'data'],
	properties: {
		amount: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
		recipientAddress: {
			dataType: 'bytes',
			fieldNumber: 2,
			minLength: 20,
			maxLength: 20,
		},
		data: {
			dataType: 'string',
			fieldNumber: 3,
			minLength: 0,
			maxLength: 64,
		},
	},
};

const registerAssetSchema = {
	$id: 'lisk/dpos/register',
	type: 'object',
	required: ['username'],
	properties: {
		username: {
			dataType: 'string',
			fieldNumber: 1,
			// Disable to check if tx is validated on server
			// minLength: 1,
			// Disable to check if tx is validated on server
			// maxLength: 20,
		},
	},
};

const getFullAssetSchema = (assetSchema: Schema): Schema =>
	objects.mergeDeep({}, baseAssetSchema, {
		properties: { asset: assetSchema },
	}) as Schema;

export interface BaseTransactionAssetInput {
	moduleID?: number;
	assetId?: number;
	senderPublicKey?: Buffer;
	fee: string;
	nonce: string;
	networkIdentifier: Buffer;
}

export interface TransactionAssetOutput<T> {
	id: string;
	tx: {
		moduleID: number;
		assetID: number;
		senderPublicKey: string;
		fee: string;
		nonce: string;
		networkIdentifier: string;
		signatures: string[];
		asset: T;
	};
	minFee: bigint;
}

export interface BaseUnsignedTransactionAssetInput extends BaseTransactionAssetInput {
	passphrase: string;
}

export const calcMinTxFee = (assetSchema: Schema, tx: Record<string, unknown>): bigint => {
	// eslint-disable-next-line @typescript-eslint/ban-types
	const assetBytes = codec.encode(assetSchema, tx.asset as object);
	const bytes = codec.encode(baseAssetSchema, { ...tx, asset: assetBytes });
	return BigInt(bytes.length * genesisConfig.genesisConfig.minFeePerByte);
};

export const transfer = ({
	recipientAddress,
	amount,
	passphrase,
	fee,
	nonce,
	networkIdentifier,
}: BaseUnsignedTransactionAssetInput & {
	recipientAddress: Buffer;
	amount: string;
}): TransactionAssetOutput<{ recipientAddress: string; amount: string }> => {
	const { publicKey } = getPrivateAndPublicKeyFromPassphrase(passphrase);

	const { id, ...rest } = signTransaction(
		transferAssetSchema,
		{
			moduleID: 2,
			assetID: 0,
			nonce: BigInt(nonce),
			fee: BigInt(fee),
			senderPublicKey: publicKey,
			asset: { amount: BigInt(amount), recipientAddress, data: '' },
		},
		networkIdentifier,
		passphrase,
	);

	return {
		id: (id as Buffer).toString('hex'),
		tx: codec.toJSON(getFullAssetSchema(transferAssetSchema), rest),
		minFee: calcMinTxFee(transferAssetSchema, rest),
	};
};

export const register = ({
	username,
	passphrase,
	fee,
	nonce,
	networkIdentifier,
}: BaseUnsignedTransactionAssetInput & {
	username: string;
}): TransactionAssetOutput<{ username: string }> => {
	const { publicKey } = getPrivateAndPublicKeyFromPassphrase(passphrase);

	const { id, ...rest } = signTransaction(
		registerAssetSchema,
		{
			moduleID: 5,
			assetID: 0,
			nonce: BigInt(nonce),
			fee: BigInt(fee),
			senderPublicKey: publicKey,
			asset: { username },
		},
		networkIdentifier,
		passphrase,
	);

	return {
		id: (id as Buffer).toString('hex'),
		tx: codec.toJSON(getFullAssetSchema(registerAssetSchema), rest),
		minFee: calcMinTxFee(registerAssetSchema, rest),
	};
};
