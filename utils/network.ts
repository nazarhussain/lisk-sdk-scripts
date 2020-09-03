import { getNetworkIdentifier } from '@liskhq/lisk-cryptography';
import * as genesisBlock from '../config/devnet/genesis_block.json';
import * as genesisConfig from '../config/devnet/config.json';
import { api, BlockJSON } from './api';

export const sleep = async (ms: number): Promise<void> =>
	new Promise(resolve => setTimeout(resolve, ms));

export const networkIdentifier = getNetworkIdentifier(
	Buffer.from(genesisBlock.header.id, 'hex'),
	genesisConfig.genesisConfig.communityIdentifier,
);

export const getLastBlock = async (): Promise<BlockJSON> =>
	(await api.http.blocks.blocksGet((await api.http.node.nodeInfoGet()).data.height)).data[0];

export const getBlockByHeight = async (height: number): Promise<BlockJSON> =>
	(await api.http.blocks.blocksGet(height)).data[0];

export const waitForBlock = async ({
	delay = 200,
	height,
	heightOffset,
	fn,
}:
	| { delay?: number; height: number; heightOffset?: number; fn?: (b: BlockJSON) => boolean }
	| { delay?: number; height?: number; heightOffset: number; fn?: (b: BlockJSON) => boolean }
	| {
			delay?: number;
			height?: number;
			heightOffset?: number;
			fn: (b: BlockJSON) => boolean;
	  }): Promise<BlockJSON> => {
	let matcher: (b: BlockJSON) => boolean;
	let targetHeight!: number;
	let lastBlock = await getLastBlock();

	if (height) {
		targetHeight = height;
		matcher = tipOfChain => tipOfChain.header.height < targetHeight;
	} else if (heightOffset) {
		targetHeight = lastBlock.header.height + heightOffset;
		matcher = tipOfChain => tipOfChain.header.height < targetHeight;
	} else if (fn) {
		matcher = fn;
	} else {
		throw Error('Must specify either height, heightOffset or condition fn');
	}

	while (matcher(lastBlock)) {
		if (targetHeight) {
			console.info(`Current Height: ${lastBlock.header.height}, Target Height: ${targetHeight}`);
		} else {
			console.info(`Current Height: ${lastBlock.header.height}`);
		}

		await sleep(delay);
		lastBlock = await getLastBlock();
	}

	return lastBlock;
};
