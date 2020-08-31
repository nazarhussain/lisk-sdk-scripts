export const blocksPerRound = 103;

export const calcRound = (height: number): number => Math.ceil(height / blocksPerRound);
export const startOfRound = (round: number): number => round * blocksPerRound - blocksPerRound + 1;
export const endOfRound = (round: number): number => round * blocksPerRound;
export const middleOfRound = (round: number): number =>
	Math.floor((startOfRound(round) + endOfRound(round)) / 2);
