import { Schema } from '@liskhq/lisk-codec';

export const baseAccountSchema = {
	$id: '/account/base',
	type: 'object',
	properties: {
		address: { dataType: 'bytes', fieldNumber: 1 },
	},
	required: ['address'],
};

export const tokenAssetSchema = {
	type: 'object',
	properties: {
		balance: {
			fieldNumber: 1,
			dataType: 'uint64',
		},
	},
	default: {
		balance: BigInt(0),
	},
};

export const sequenceAssetSchema = {
	type: 'object',
	properties: {
		nonce: {
			fieldNumber: 1,
			dataType: 'uint64',
		},
	},
	default: {
		nonce: BigInt(0),
	},
};

export const keysAssetSchema = {
	type: 'object',
	properties: {
		mandatoryKeys: {
			fieldNumber: 1,
			type: 'array',
			items: {
				dataType: 'bytes',
			},
		},
		optionalKeys: {
			fieldNumber: 2,
			type: 'array',
			items: {
				dataType: 'bytes',
			},
		},
		numberOfSignatures: {
			fieldNumber: 3,
			dataType: 'uint32',
		},
	},
	default: {
		mandatoryKeys: [],
		optionalKeys: [],
		numberOfSignatures: 0,
	},
};

export const dposAssetSchema = {
	type: 'object',
	properties: {
		delegate: {
			type: 'object',
			fieldNumber: 1,
			properties: {
				username: { dataType: 'string', fieldNumber: 1 },
				pomHeights: {
					type: 'array',
					items: { dataType: 'uint32' },
					fieldNumber: 2,
				},
				consecutiveMissedBlocks: { dataType: 'uint32', fieldNumber: 3 },
				lastForgedHeight: { dataType: 'uint32', fieldNumber: 4 },
				isBanned: { dataType: 'boolean', fieldNumber: 5 },
				totalVotesReceived: { dataType: 'uint64', fieldNumber: 6 },
			},
			required: [
				'username',
				'pomHeights',
				'consecutiveMissedBlocks',
				'lastForgedHeight',
				'isBanned',
				'totalVotesReceived',
			],
		},
		sentVotes: {
			type: 'array',
			fieldNumber: 2,
			items: {
				type: 'object',
				properties: {
					delegateAddress: {
						dataType: 'bytes',
						fieldNumber: 1,
					},
					amount: {
						dataType: 'uint64',
						fieldNumber: 2,
					},
				},
				required: ['delegateAddress', 'amount'],
			},
		},
		unlocking: {
			type: 'array',
			fieldNumber: 3,
			items: {
				type: 'object',
				properties: {
					delegateAddress: {
						dataType: 'bytes',
						fieldNumber: 1,
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
				required: ['delegateAddress', 'amount', 'unvoteHeight'],
			},
		},
	},
	default: {
		delegate: {
			username: '',
			pomHeights: [],
			consecutiveMissedBlocks: 0,
			lastForgedHeight: 0,
			isBanned: false,
			totalVotesReceived: BigInt(0),
		},
		sentVotes: [],
		unlocking: [],
	},
};

export interface FullAccount {
	token: {
		balance: bigint;
	};
	sequence: {
		nonce: bigint;
	};
	keys: {
		mandatoryKeys: Buffer[];
		optionalKeys: Buffer[];
		numberOfSignatures: number;
	};
	dpos: {
		delegate: DelegateAccountAsset;
		sentVotes: VoteAccountAsset[];
		unlocking: UnlockingAccountAsset[];
	};
}

export interface DelegateAccountAsset {
	username: string;
	pomHeights: number[];
	consecutiveMissedBlocks: number;
	lastForgedHeight: number;
	isBanned: boolean;
	totalVotesReceived: bigint;
}

export interface VoteAccountAsset {
	delegateAddress: Buffer;
	amount: bigint;
}

export interface UnlockingAccountAsset {
	delegateAddress: Buffer;
	amount: bigint;
	unvoteHeight: number;
}

export const defaultAccountModules = {
	token: {
		fieldNumber: 2,
		...tokenAssetSchema,
	},
	sequence: {
		fieldNumber: 3,
		...sequenceAssetSchema,
	},
	keys: {
		fieldNumber: 4,
		...keysAssetSchema,
	},
	dpos: {
		fieldNumber: 5,
		...dposAssetSchema,
	},
};

export const fullAccountSchema = {
	...baseAccountSchema,
	properties: {
		...baseAccountSchema.properties,
		...Object.entries(defaultAccountModules).reduce((prev, [key, val]) => {
			const { default: defaultValue, ...others } = val;
			return {
				...prev,
				[key]: others,
			};
		}, {}),
	},
} as Schema;
