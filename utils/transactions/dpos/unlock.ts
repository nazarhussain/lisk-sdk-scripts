import { getPrivateAndPublicKeyFromPassphrase } from '@liskhq/lisk-cryptography';
import { signTransaction } from '@liskhq/lisk-transactions';

import {
	BaseUnsignedTransactionAssetInput,
	TransactionAssetOutput,
	calcMinTxFee,
	SignedTransactionObject,
} from '../common';

export const unlockAssetSchema = {
	$id: 'lisk/dpos/unlock',
	type: 'object',
	required: ['unlockObjects'],
	properties: {
		unlockObjects: {
      type: 'array',
      // Disable to verify if it fails on node
      // minItems: 1,
      // Disable to verify if it fails on node
			// maxItems: 20,
			items: {
				type: 'object',
				required: ['delegateAddress', 'amount', 'unvoteHeight'],
				properties: {
					delegateAddress: {
						dataType: 'bytes',
						fieldNumber: 1,
						minLength: 20,
						maxLength: 20,
					},
					amount: {
						dataType: 'uint64',
						fieldNumber: 2,
					},
					unvoteHeight: {
						dataType: 'uint32',
						fieldNumber: 3,
					},
				},
			},
			fieldNumber: 1,
		},
	},
};

export interface Unlock {
	readonly delegateAddress: Buffer;
	readonly amount: bigint;
	readonly unvoteHeight: number;
}

export const unlock = ({
	unlockObjects,
	passphrase,
	fee,
	nonce,
	networkIdentifier,
}: BaseUnsignedTransactionAssetInput & {
	unlockObjects: Unlock[];
}): TransactionAssetOutput<{ unlockObjects: Unlock[] }> => {
	const { publicKey } = getPrivateAndPublicKeyFromPassphrase(passphrase);

	const { id, ...rest } = signTransaction(
		unlockAssetSchema,
		{
			moduleID: 5,
			assetID: 2,
			nonce: BigInt(nonce),
			fee: BigInt(fee),
			senderPublicKey: publicKey,
			asset: { unlockObjects },
		},
		networkIdentifier,
		passphrase,
	) as unknown as SignedTransactionObject<{ unlockObjects: Unlock[] }>;

	return {
		id,
		tx: rest,
		minFee: calcMinTxFee(unlockAssetSchema, rest),
	};
};
