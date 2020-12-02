interface LogObject {
	[key: string]: string | number | Error | undefined | bigint | Buffer | LogObject;
}

const others: LogObject = { bigint: BigInt(2), buffer: Buffer.from('nadf'), object: { buffer: Buffer.from('naza'), bigint: BigInt(20) }, array: [BigInt(2), Buffer.from('nazar')] };

const otherKeys = Object.entries(others);

const meta = otherKeys.reduce<Record<string, unknown>>((prev, [key, value]) => {
	if (typeof value === 'bigint') {
		// eslint-disable-next-line
		prev[key] = value.toString();
	} else if (Buffer.isBuffer(value)) {
		// eslint-disable-next-line
		prev[key] = value.toString('hex');
	} else {
		// eslint-disable-next-line
		prev[key] = value;
	}
	// console.log({ current })
	return prev;
}, {});
