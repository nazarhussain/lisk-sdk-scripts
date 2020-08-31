export const arrIntersect = <T= any>(arrA:T[], arrB:T[]):T[] => arrA.filter(x => arrB.includes(x));
export const arrDifference = <T= any>(arrA:T[], arrB:T[]):T[] => arrA.filter(x => !arrB.includes(x));
export const arrSymDifference = <T= any>(arrA:T[], arrB:T[]):T[] =>
	arrA.filter(x => !arrB.includes(x)).concat(arrB.filter(x => !arrA.includes(x)));
export const arrUnion = <T= any>(arrA:T[], arrB:T[]):T[] => [...arrA, ...arrB];
export const arrCompare = <T= any>(arrA:T[], arrB:T[]):boolean => arrA.every((v, i) => arrB[i] === v);
