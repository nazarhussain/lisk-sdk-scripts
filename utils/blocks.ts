import { objects } from '@liskhq/lisk-utils';
import {
	blockHeaderSchema,
	blockHeaderAssetSchema,
	BlockHeader,
	signingBlockHeaderSchema,
	GenesisBlock,
	getGenesisBlockHeaderAssetSchema,
	blockSchema,
} from '@liskhq/lisk-chain';
import { Schema, codec } from '@liskhq/lisk-codec';
import { getGenesisBlockJSON } from '@liskhq/lisk-genesis';
import { signDataWithPassphrase } from '@liskhq/lisk-cryptography';
import { networkIdentifier } from './network';
import { BlockHeaderJSON } from './api';
import { fullAccountSchema, FullAccount, defaultAccountModules } from './schema';

export { BlockHeader, GenesisBlockHeader, GenesisBlock } from '@liskhq/lisk-chain';

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

const assetSchema = {
	...blockHeaderSchema.properties.asset,
	...getGenesisBlockHeaderAssetSchema(fullAccountSchema),
	dataType: undefined,
};
delete assetSchema.dataType;
delete assetSchema.fieldNumber;

export const genesisBlockSchema = {
	...blockSchema,
	properties: {
		...blockSchema.properties,
		header: {
			...blockHeaderSchema,
			properties: {
				...blockHeaderSchema.properties,
				asset: assetSchema,
			},
		},
	},
};

export const genesisBlockFromJSON = (genesisBlock: Record<string, unknown>): GenesisBlock => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
	const cloned = objects.cloneDeep(genesisBlock);

	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	delete cloned.header.id;

	return codec.fromJSON<GenesisBlock>(genesisBlockSchema, cloned);
};

export const genesisBlockToJSON = (
	genesisBlock: GenesisBlock<FullAccount>,
): Record<string, unknown> =>
	getGenesisBlockJSON({
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		genesisBlock: genesisBlock as any,
		accountAssetSchemas: defaultAccountModules,
	});
