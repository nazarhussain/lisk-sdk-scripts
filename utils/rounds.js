
const arrIntersect = (arrA, arrB) => arrA.filter(x => arrB.includes(x));
const arrDifference = (arrA, arrB) => arrA.filter(x => !arrB.includes(x));
const arrSymDifference = (arrA, arrB) =>
	arrA
		.filter(x => !arrB.includes(x))
		.concat(arrB.filter(x => !arrA.includes(x)));
const arrUnion = (arrA, arrB) => [...arrA, ...arrB];
const arrCompare = (arrA, arrB) => arrA.every((v, i) => arrB[i] === v);

const blocksPerRound = 103;

const calcRound = height => Math.ceil(height / blocksPerRound);
const startOfRound = round => round * blocksPerRound - blocksPerRound + 1;
const  endOfRound = round => round * blocksPerRound;
const middleOfRound = round =>
	Math.floor(
		(startOfRound(round, blocksPerRound) + endOfRound(round, blocksPerRound)) /
			2,
	);

	