import { objects } from '@liskhq/lisk-utils';
import {
	blockHeaderSchema,
	blockHeaderAssetSchema,
	BlockHeader,
	signingBlockHeaderSchema,
} from '@liskhq/lisk-chain';
import { Schema, codec } from '@liskhq/lisk-codec';
import { signDataWithPassphrase } from '@liskhq/lisk-cryptography';
import { networkIdentifier } from './network';
import { BlockHeaderJSON } from './api';

export { BlockHeader } from '@liskhq/lisk-chain';

export const getBlockHeaderSchemaWithAsset = (): Schema => {
	const schema = objects.mergeDeep(
		{},
		blockHeaderSchema,
		{
			properties: { asset: blockHeaderAssetSchema },
		},
		{
			properties: { asset: { type: 'object' } },
		},
	);

	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	delete schema.properties.asset.dataType;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	delete schema.properties.asset.$id;

	return schema as Schema;
};

export const blockHeaderSchemaWithAsset = getBlockHeaderSchemaWithAsset();

export const signBlockHeader = (header: BlockHeader, passphrase: string): Buffer => {
	const assetBytes = codec.encode(blockHeaderAssetSchema, header.asset);
	const blockBytes = codec.encode(signingBlockHeaderSchema, { ...header, asset: assetBytes });

	return signDataWithPassphrase(Buffer.concat([networkIdentifier, blockBytes]), passphrase);
};

export const blockHeaderFromJSON = (header: BlockHeaderJSON): BlockHeader => {
	const headerCopy = { ...header };
	delete headerCopy.id;
	return codec.fromJSON<BlockHeader>(blockHeaderSchemaWithAsset, headerCopy);
};
