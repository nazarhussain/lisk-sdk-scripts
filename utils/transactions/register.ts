import { getPrivateAndPublicKeyFromPassphrase } from '@liskhq/lisk-cryptography';
import { signTransaction } from '@liskhq/lisk-transactions';
import { codec } from '@liskhq/lisk-codec';

import {
	BaseUnsignedTransactionAssetInput,
	TransactionAssetOutput,
	getFullAssetSchema,
	calcMinTxFee,
} from './common';

export const registerAssetSchema = {
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
