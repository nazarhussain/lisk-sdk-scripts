import { getPrivateAndPublicKeyFromPassphrase } from '@liskhq/lisk-cryptography';
import { signTransaction } from '@liskhq/lisk-transactions';
import { codec } from '@liskhq/lisk-codec';
import { blockHeaderSchemaWithAsset, BlockHeader } from '../../blocks';

import {
	BaseUnsignedTransactionAssetInput,
	TransactionAssetOutput,
	getFullAssetSchema,
	calcMinTxFee,
} from '../common';

export const pomAssetSchema = {
	$id: 'lisk/dpos/pom',
	type: 'object',
	required: ['header1', 'header2'],
	properties: {
		header1: {
			...blockHeaderSchemaWithAsset,
			fieldNumber: 1,
		},
		header2: {
			...blockHeaderSchemaWithAsset,
			fieldNumber: 2,
		},
	},
};

export const proofMisbehavior = ({
	header1,
	header2,
	passphrase,
	fee,
	nonce,
	networkIdentifier,
}: BaseUnsignedTransactionAssetInput & {
	header1: BlockHeader;
	header2: BlockHeader;
}): TransactionAssetOutput<{
	header1: Record<string, unknown>;
	header2: Record<string, unknown>;
}> => {
	const { publicKey } = getPrivateAndPublicKeyFromPassphrase(passphrase);

	const { id, ...rest } = signTransaction(
		pomAssetSchema,
		{
			moduleID: 5,
			assetID: 3,
			nonce: BigInt(nonce),
			fee: BigInt(fee),
			senderPublicKey: publicKey,
			asset: { header1, header2 },
		},
		networkIdentifier,
		passphrase,
	);

	return {
		id: (id as Buffer).toString('hex'),
		tx: codec.toJSON(getFullAssetSchema(pomAssetSchema), rest),
		minFee: calcMinTxFee(pomAssetSchema, rest),
	};
};
