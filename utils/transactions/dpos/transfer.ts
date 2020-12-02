import { getPrivateAndPublicKeyFromPassphrase } from '@liskhq/lisk-cryptography';
import { signMultiSignatureTransaction, signTransaction } from '@liskhq/lisk-transactions';
import { codec } from '@liskhq/lisk-codec';

import {
	BaseUnsignedTransactionAssetInput,
	TransactionAssetOutput,
	getFullAssetSchema,
	calcMinTxFee,
	SignedTransactionObject,
} from '../common';

export const transferAssetSchema = {
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

export const transfer = ({
	recipientAddress,
	amount,
	passphrase,
	fee,
	nonce,
	networkIdentifier,
}: BaseUnsignedTransactionAssetInput & {
	recipientAddress: Buffer;
	amount: bigint;
}): TransactionAssetOutput<{ recipientAddress: Buffer; amount: bigint }> => {
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
	) as unknown as SignedTransactionObject<{ recipientAddress: Buffer; amount: bigint }>;

	return {
		id,
		tx: rest,
		minFee: calcMinTxFee(transferAssetSchema, rest),
	};
};

export const transferMultisig = ({
	recipientAddress,
	amount,
	passphrase,
	passphrases,
	optionalKeys,
	mandatoryKeys,
	fee,
	nonce,
	networkIdentifier,
}: BaseUnsignedTransactionAssetInput & {
	recipientAddress: Buffer;
	amount: string;
} & {
	passphrases: string[];
	optionalKeys: Buffer[];
	mandatoryKeys: Buffer[];
}): TransactionAssetOutput<{
	recipientAddress: string;
	amount: string;
}> => {
	const { publicKey } = getPrivateAndPublicKeyFromPassphrase(passphrase);

	let txObject = {
		id: null,
		moduleID: 2,
		assetID: 0,
		nonce: BigInt(nonce),
		fee: BigInt(fee),
		senderPublicKey: publicKey,
		asset: { amount: BigInt(amount), recipientAddress, data: '' },
		signatures: [],
	};

	for (const pass of [...passphrases]) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		txObject = signMultiSignatureTransaction(
			transferAssetSchema,
			txObject,
			networkIdentifier,
			pass,
			{
				mandatoryKeys: [...mandatoryKeys] as Buffer[],
				optionalKeys: [...optionalKeys] as Buffer[],
			},
			false,
		) as any;
	}

	const { id, ...rest } = txObject;

	return {
		id: ((id as unknown) as Buffer),
		tx: codec.toJSON(getFullAssetSchema(transferAssetSchema), rest),
		minFee: calcMinTxFee(transferAssetSchema, rest as any),
	};
};
