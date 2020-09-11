import { getPrivateAndPublicKeyFromPassphrase } from '@liskhq/lisk-cryptography';
import { signTransaction } from '@liskhq/lisk-transactions';
import { codec } from '@liskhq/lisk-codec';

import {
	BaseUnsignedTransactionAssetInput,
	TransactionAssetOutput,
	getFullAssetSchema,
	calcMinTxFee,
} from '../common';

export const registerMultisigAssetSchema = {
  $id: 'lisk/keys/register',
	type: 'object',
	required: ['numberOfSignatures', 'optionalKeys', 'mandatoryKeys'],
	properties: {
		numberOfSignatures: {
			dataType: 'uint32',
      fieldNumber: 1,
      // Disable to check if tx is validated on server
      // minimum: 1,
      // Disable to check if tx is validated on server
			// maximum: 64,
		},
		mandatoryKeys: {
			type: 'array',
			items: {
        dataType: 'bytes',
				minLength: 32,
				maxLength: 32,
			},
      fieldNumber: 2,
      // Disable to check if tx is validated on server
      // minItems: 0,
      // Disable to check if tx is validated on server
			// maxItems: 64,
		},
		optionalKeys: {
			type: 'array',
			items: {
				dataType: 'bytes',
				minLength: 32,
				maxLength: 32,
			},
      fieldNumber: 3,
      // Disable to check if tx is validated on server
      // minItems: 0,
      // Disable to check if tx is validated on server
			// maxItems: 64,
		},
	},
};

export interface KeysAsset {
	mandatoryKeys: Array<Readonly<Buffer>>;
	optionalKeys: Array<Readonly<Buffer>>;
	readonly numberOfSignatures: number;
}

export interface KeysAssetJSON {
	mandatoryKeys: Array<Readonly<string>>;
	optionalKeys: Array<Readonly<string>>;
	readonly numberOfSignatures: number;
}

export const registerMultisig = ({
  numberOfSignatures,
  optionalKeys,
  mandatoryKeys,
	passphrase,
	fee,
	nonce,
	networkIdentifier,
}: BaseUnsignedTransactionAssetInput & KeysAsset): TransactionAssetOutput<KeysAssetJSON> => {
	const { publicKey } = getPrivateAndPublicKeyFromPassphrase(passphrase);

	const { id, ...rest } = signTransaction(
		registerMultisigAssetSchema,
		{
			moduleID: 4,
			assetID: 0,
			nonce: BigInt(nonce),
			fee: BigInt(fee),
			senderPublicKey: publicKey,
			asset: { mandatoryKeys, optionalKeys, numberOfSignatures },
		},
		networkIdentifier,
		passphrase,
	);

	return {
		id: (id as Buffer).toString('hex'),
		tx: codec.toJSON(getFullAssetSchema(registerMultisigAssetSchema), rest),
		minFee: calcMinTxFee(registerMultisigAssetSchema, rest),
	};
};
