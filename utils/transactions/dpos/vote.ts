import { getPrivateAndPublicKeyFromPassphrase } from '@liskhq/lisk-cryptography';
import { signTransaction } from '@liskhq/lisk-transactions';

import {
	BaseUnsignedTransactionAssetInput,
	TransactionAssetOutput,
	calcMinTxFee,
	SignedTransactionObject,
} from '../common';

export const voteAssetSchema = {
	$id: 'lisk/dpos/vote',
	type: 'object',
	required: ['votes'],
	properties: {
		votes: {
      type: 'array',
      // Disable to verify if it fails on node
      // minItems: 1,
      // Disable to verify if it fails on node
			// maxItems: 20,
			items: {
				type: 'object',
				required: ['delegateAddress', 'amount'],
				properties: {
					delegateAddress: {
						dataType: 'bytes',
						fieldNumber: 1,
						minLength: 20,
						maxLength: 20,
					},
					amount: {
						dataType: 'sint64',
						fieldNumber: 2,
					},
				},
			},
			fieldNumber: 1,
		},
	},
};

export interface Vote {
	readonly delegateAddress: Buffer;
	readonly amount: bigint;
}

export const vote = ({
	votes,
	passphrase,
	fee,
	nonce,
	networkIdentifier,
}: BaseUnsignedTransactionAssetInput & {
	votes: Vote[];
}): TransactionAssetOutput<{ votes: Vote[] }> => {
	const { publicKey } = getPrivateAndPublicKeyFromPassphrase(passphrase);

	const { id, ...rest } = signTransaction(
		voteAssetSchema,
		{
			moduleID: 5,
			assetID: 1,
			nonce: BigInt(nonce),
			fee: BigInt(fee),
			senderPublicKey: publicKey,
			asset: { votes },
		},
		networkIdentifier,
		passphrase,
	)as unknown as SignedTransactionObject<{ votes: Vote[] }>;

	return {
		id,
		tx: rest,
		minFee: calcMinTxFee(voteAssetSchema, rest),
	};
};
