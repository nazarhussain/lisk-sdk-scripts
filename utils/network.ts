import { getNetworkIdentifier } from '@liskhq/lisk-cryptography';
import * as genesisBlock from '../config/devnet/genesis_block.json';
import * as genesisConfig from '../config/devnet/config.json';
import { api, Block } from './api';

export const sleep = async (ms: number): Promise<void> =>
	new Promise(resolve => setTimeout(resolve, ms));

export const networkIdentifier = getNetworkIdentifier(
	Buffer.from(genesisBlock.header.id, 'hex'),
	genesisConfig.genesisConfig.communityIdentifier,
);

export const getLastBlock = async (): Promise<Block> =>
	(await api.http.blocks.blocksGet((await api.http.node.nodeInfoGet()).data.height)).data[0];

export const waitForBlock = async ({
	delay = 1000,
	height,
	heightOffset,
	fn,
}:
	| { delay?: number; height: number; heightOffset?: number; fn?: (b: Block) => boolean }
	| { delay?: number; height?: number; heightOffset: number; fn?: (b: Block) => boolean }
	| { delay?: number; height?: number; heightOffset?: number; fn: (b: Block) => boolean }): Promise<
	Block
> => {
	let matcher: (b: Block) => boolean;
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
