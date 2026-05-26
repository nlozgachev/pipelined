import { bench, describe } from "vitest";

// ---------------------------------------------------------------------------
// Implementations to benchmark
// ---------------------------------------------------------------------------

// 1. Current concat-spread approach
export const flattenConcatSpread = <A>(data: readonly (readonly A[])[]): readonly A[] => {
	try {
		return ([] as A[]).concat(...data);
	} catch {
		// Return dummy array on stack overflow
		return [] as A[];
	}
};

// 2. Simple push loop
export const flattenPushLoop = <A>(data: readonly (readonly A[])[]): readonly A[] => {
	const result: A[] = [];
	const outerLen = data.length;
	for (let i = 0; i < outerLen; i++) {
		const chunk = data[i];
		const innerLen = chunk.length;
		for (let j = 0; j < innerLen; j++) {
			result.push(chunk[j]);
		}
	}
	return result;
};

// 3. Pre-allocated loop
export const flattenPreAlloc = <A>(data: readonly (readonly A[])[]): readonly A[] => {
	let totalLen = 0;
	const outerLen = data.length;
	for (let i = 0; i < outerLen; i++) {
		totalLen += data[i].length;
	}
	const result = new Array<A>(totalLen);
	let idx = 0;
	for (let i = 0; i < outerLen; i++) {
		const chunk = data[i];
		const innerLen = chunk.length;
		for (let j = 0; j < innerLen; j++) {
			result[idx++] = chunk[j];
		}
	}
	return result;
};

// 4. Native flat(1)
export const flattenNativeFlat = <A>(data: readonly (readonly A[])[]): readonly A[] => data.flat(1);

// 5. Concat loop
export const flattenConcatLoop = <A>(data: readonly (readonly A[])[]): readonly A[] => {
	let result: readonly A[] = [];
	const outerLen = data.length;
	for (let i = 0; i < outerLen; i++) {
		result = result.concat(data[i]);
	}
	return result;
};

// ---------------------------------------------------------------------------
// Benchmark Data Setup
// ---------------------------------------------------------------------------

// 1. Wide and shallow: 1000 arrays of size 10 (10k items)
const wideShallowData = Array.from({ length: 1000 }, (_, i) => Array.from({ length: 10 }, (_inner, j) => i * 10 + j));

// 2. Narrow and deep: 10 arrays of size 1000 (10k items)
const narrowDeepData = Array.from({ length: 10 }, (_, i) => Array.from({ length: 1000 }, (_inner, j) => i * 1000 + j));

// 3. Large: 100 arrays of size 1000 (100k items)
const largeData = Array.from({ length: 100 }, (_, i) => Array.from({ length: 1000 }, (_inner, j) => i * 1000 + j));

// 4. Extreme (stack overflow risk for concat-spread): 70,000 arrays of size 1
const extremeData = Array.from({ length: 70_000 }, (_, i) => [i]);

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

describe("flatten-wide-shallow-10k", () => {
	bench("1. concat-spread", () => {
		flattenConcatSpread(wideShallowData);
	});
	bench("2. push-loop", () => {
		flattenPushLoop(wideShallowData);
	});
	bench("3. (current) pre-alloc-loop", () => {
		flattenPreAlloc(wideShallowData);
	});
	bench("4. native-flat-1", () => {
		flattenNativeFlat(wideShallowData);
	});
	bench("5. concat-loop", () => {
		flattenConcatLoop(wideShallowData);
	});
});

describe("flatten-narrow-deep-10k", () => {
	bench("1. concat-spread", () => {
		flattenConcatSpread(narrowDeepData);
	});
	bench("2. push-loop", () => {
		flattenPushLoop(narrowDeepData);
	});
	bench("3. (current) pre-alloc-loop", () => {
		flattenPreAlloc(narrowDeepData);
	});
	bench("4. native-flat-1", () => {
		flattenNativeFlat(narrowDeepData);
	});
	bench("5. concat-loop", () => {
		flattenConcatLoop(narrowDeepData);
	});
});

describe("flatten-large-100k", () => {
	bench("1. concat-spread", () => {
		flattenConcatSpread(largeData);
	});
	bench("2. push-loop", () => {
		flattenPushLoop(largeData);
	});
	bench("3. (current) pre-alloc-loop", () => {
		flattenPreAlloc(largeData);
	});
	bench("4. native-flat-1", () => {
		flattenNativeFlat(largeData);
	});
	bench("5. concat-loop", () => {
		flattenConcatLoop(largeData);
	});
});

describe("flatten-extreme-70k-arrays (stack overflow shape)", () => {
	bench("1. concat-spread - overflow caught", () => {
		flattenConcatSpread(extremeData);
	});
	bench("2. push-loop", () => {
		flattenPushLoop(extremeData);
	});
	bench("3. (current) pre-alloc-loop", () => {
		flattenPreAlloc(extremeData);
	});
	bench("4. native-flat-1", () => {
		flattenNativeFlat(extremeData);
	});
	bench("5. concat-loop", () => {
		flattenConcatLoop(extremeData);
	});
});
