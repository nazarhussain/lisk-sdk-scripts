import { APIClient } from '@liskhq/lisk-api-client';
import { BlockJSON } from '../api';
import { sleep } from './common';

export class Chain {
	private _client: APIClient;

	constructor(opts: {client: APIClient}) {
		this._client = opts.client;
	}

	public async getLastBlock(): Promise<BlockJSON> {
		return (this._client.block.getByHeight(
			(await this._client.node.getNodeInfo()).height,
		) as unknown) as Promise<BlockJSON>;
	}

	public async getBlockByHeight(height: number): Promise<BlockJSON> {
		return (this._client.block.getByHeight(height) as unknown) as Promise<BlockJSON>;
	}

	public async waitForBlock({
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
		  }): Promise<BlockJSON> {
		let matcher: (b: BlockJSON) => boolean;
		let targetHeight!: number;
		let lastBlock = await this.getLastBlock();

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
			lastBlock = await this.getLastBlock();
		}

		return lastBlock;
	}
}
