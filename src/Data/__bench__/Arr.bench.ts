import { pipe } from "#composition";
import { Maybe, Result } from "#core";
import { Arr } from "#data";
import { test } from "vitest";

const pipeFn = pipe;
const arrMap = Arr.map;
const arrFilter = Arr.filter;
const arrFlatMap = Arr.flatMap;
const arrReduce = Arr.reduce;
const arrScan = Arr.scan;
const arrTraverseMaybe = Arr.traverse.Maybe;
const arrTraverseResult = Arr.traverse.Result;
const arrGroupBy = Arr.groupBy;
const arrUniqBy = Arr.uniqBy;
const arrSortBy = Arr.sortBy;
const arrReverse = Arr.reverse;
const arrInsertAt = Arr.insertAt;
const arrRemoveAt = Arr.removeAt;
const arrZip = Arr.zip;

const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);
const otherArr = Array.from({ length: 10_000 }, (_, i) => i + 1);
const shuffled = [...data10k].toReversed();
const words = Array.from({ length: 10_000 }, (_, i) => `word${i % 100}`);
const toSome = (n: number): Maybe<number> => Maybe.make.some(n * 2);
const toSome2 = (n: number): Maybe<number> => Maybe.make.some(n * 2);
const toOk = (n: number): Result<never, number> => Result.make.ok(n * 2);
const toOk2 = (n: number): Result<never, number> => Result.make.ok(n * 2);

// =============================================================================
// map
// =============================================================================

test("map-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.map 100", () => {
			pipeFn(data100, arrMap((n) => n * 2));
		}),
		bench("2. native .map 100", () => {
			data100.map((n) => n * 2);
		}),
	);
});

test("map-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.map 10k", () => {
			pipeFn(data10k, arrMap((n) => n * 2));
		}),
		bench("2. native .map 10k", () => {
			data10k.map((n) => n * 2);
		}),
	);
});

test("filter-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.filter 10k", () => {
			pipeFn(data10k, arrFilter((n) => n % 2 === 0));
		}),
		bench("2. native .filter 10k", () => {
			data10k.filter((n) => n % 2 === 0);
		}),
	);
});

test("flatMap-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.flatMap 10k", () => {
			pipeFn(data10k, arrFlatMap((n) => [n, n + 1]));
		}),
		bench("2. native .flatMap 10k", () => {
			data10k.flatMap((n) => [n, n + 1]);
		}),
	);
});

test("reduce-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.reduce 10k", () => {
			pipeFn(data10k, arrReduce(0, (acc, n) => acc + n));
		}),
		bench("2. native .reduce 10k", () => {
			data10k.reduce((acc, n) => acc + n, 0);
		}),
	);
});

test("scan-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.scan 10k", () => {
			pipeFn(data10k, arrScan(0, (acc, n) => acc + n));
		}),
		bench("2. scan native loop 10k", () => {
			const result: number[] = [];
			let acc = 0;
			for (const n of data10k) {
				acc += n;
				result.push(acc);
			}
		}),
	);
});

test("traverse-maybe-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.traverse Maybe 10k (all-Some", () => {
			pipeFn(data10k, arrTraverseMaybe(toSome));
		}),
		bench("2. native traverse Maybe 10k (all-Some", () => {
			const result: number[] = [];
			for (const n of data10k) {
				const v = toSome(n);
				if (v.kind === "None") { break; }
				result.push(v.value);
			}
		}),
	);
});

test("traverse-result-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.traverseResult 10k (all-Ok", () => {
			pipeFn(data10k, arrTraverseResult(toOk));
		}),
		bench("2. native traverseResult 10k (all-Ok", () => {
			const result: number[] = [];
			for (const n of data10k) {
				const v = toOk(n);
				if (v.kind === "Ok") { result.push(v.value); }
			}
		}),
	);
});

test("groupBy-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.groupBy 10k", () => {
			pipeFn(words, arrGroupBy((s) => s[0]));
		}),
		bench("2. native groupBy 10k", () => {
			const result: Record<string, string[]> = {};
			for (const s of words) {
				const [key] = s;
				if (!result[key]) { result[key] = []; }
				result[key].push(s);
			}
		}),
	);
});

test("uniqBy-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.uniqBy 10k", () => {
			pipeFn(data10k, arrUniqBy((n) => n % 100));
		}),
		bench("2. native uniqBy 10k", () => {
			const seen = new Set<number>();
			const result: number[] = [];
			for (const n of data10k) {
				const key = n % 100;
				if (!seen.has(key)) {
					seen.add(key);
					result.push(n);
				}
			}
		}),
	);
});

test("sortBy-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.sortBy 10k", () => {
			pipeFn(shuffled, arrSortBy((a, b) => a - b));
		}),
		bench("2. native .sort 10k", () => {
			[...shuffled].toSorted((a, b) => a - b);
		}),
		bench("3. native .toSorted 10k", () => {
			shuffled.toSorted((a, b) => a - b);
		}),
	);
});

test("reverse-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.reverse 10k", () => {
			pipeFn(data10k, arrReverse);
		}),
		bench("2. native .reverse 10k", () => {
			[...data10k].toReversed();
		}),
		bench("3. native .toReversed 10k", () => {
			data10k.toReversed();
		}),
	);
});

test("insertAt-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.insertAt 10k", () => {
			pipeFn(data10k, arrInsertAt(5000, -1));
		}),
		bench("2. native .toSpliced insert 10k", () => {
			data10k.toSpliced(5000, 0, -1);
		}),
		bench("3. spread + splice insert 10k", () => {
			const result = [...data10k];
			result.splice(5000, 0, -1);
		}),
	);
});

test("removeAt-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.removeAt 10k", () => {
			pipeFn(data10k, arrRemoveAt(5000));
		}),
		bench("2. native .toSpliced remove 10k", () => {
			data10k.toSpliced(5000, 1);
		}),
		bench("3. spread + splice remove 10k", () => {
			const result = [...data10k];
			result.splice(5000, 1);
		}),
	);
});

test("zip-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.zip 10k", () => {
			pipeFn(data10k, arrZip(otherArr));
		}),
		bench("2. native zip loop 10k", () => {
			const len = Math.min(data10k.length, otherArr.length);
			const result: [number, number][] = [];
			for (let i = 0; i < len; i++) {
				result.push([data10k[i], otherArr[i]]);
			}
		}),
	);
});

test("scan-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. scan push 10k", () => {
			const result: number[] = [];
			let acc = 0;
			for (let i = 0; i < data10k.length; i++) {
				acc += data10k[i];
				result.push(acc);
			}
		}),
		bench("2. (current) scan pre-alloc 10k", () => {
			const n = data10k.length;
			const result = new Array<number>(n);
			let acc = 0;
			for (let i = 0; i < n; i++) {
				acc += data10k[i];
				result[i] = acc;
			}
		}),
	);
});

test("zip-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. zip push 10k", () => {
			const len = Math.min(data10k.length, otherArr.length);
			const result: [number, number][] = [];
			for (let i = 0; i < len; i++) {
				result.push([data10k[i], otherArr[i]]);
			}
		}),
		bench("2. (current) zip pre-alloc 10k", () => {
			const len = Math.min(data10k.length, otherArr.length);
			const result = new Array<[number, number]>(len);
			for (let i = 0; i < len; i++) {
				result[i] = [data10k[i], otherArr[i]];
			}
		}),
	);
});

test("traverse-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. traverse push 10k", () => {
			const result: number[] = [];
			for (let i = 0; i < data10k.length; i++) {
				const mapped = toSome2(data10k[i]);
				if (mapped.kind === "None") { return; }
				result.push(mapped.value);
			}
		}),
		bench("2. (current) traverse pre-alloc 10k", () => {
			const n = data10k.length;
			const result = new Array<number>(n);
			for (let i = 0; i < n; i++) {
				const mapped = toSome2(data10k[i]);
				if (mapped.kind === "None") { return; }
				result[i] = mapped.value;
			}
		}),
	);
});

test("traverseResult-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. traverseResult push 10k", () => {
			const result: number[] = [];
			for (let i = 0; i < data10k.length; i++) {
				const mapped = toOk2(data10k[i]);
				if (mapped.kind === "Err") { return; }
				result.push(mapped.value);
			}
		}),
		bench("2. (current) traverseResult pre-alloc 10k", () => {
			const n = data10k.length;
			const result = new Array<number>(n);
			for (let i = 0; i < n; i++) {
				const mapped = toOk2(data10k[i]);
				if (mapped.kind === "Err") { return; }
				result[i] = mapped.value;
			}
		}),
	);
});

test("partition-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) partition for-of 10k", () => {
			const pass: number[] = [];
			const fail: number[] = [];
			for (const a of data10k) {
				(a % 2 === 0 ? pass : fail).push(a);
			}
		}),
		bench("2. partition index 10k", () => {
			const pass: number[] = [];
			const fail: number[] = [];
			for (let i = 0; i < data10k.length; i++) {
				const a = data10k[i];
				(a % 2 === 0 ? pass : fail).push(a);
			}
		}),
	);
});

test("uniqby-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) uniqBy for-of 10k", () => {
			const seen = new Set<number>();
			const result: number[] = [];
			for (const a of data10k) {
				const key = a % 100;
				if (!seen.has(key)) {
					seen.add(key);
					result.push(a);
				}
			}
		}),
		bench("2. uniqBy index 10k", () => {
			const seen = new Set<number>();
			const result: number[] = [];
			for (let i = 0; i < data10k.length; i++) {
				const key = data10k[i] % 100;
				if (!seen.has(key)) {
					seen.add(key);
					result.push(data10k[i]);
				}
			}
		}),
	);
});

test("map-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. map native .map 10k", () => {
			data10k.map((n) => n * 2);
		}),
		bench("2. (current) map pre-alloc loop 10k", () => {
			const n = data10k.length;
			const result = new Array<number>(n);
			for (let i = 0; i < n; i++) { result[i] = data10k[i] * 2; }
		}),
	);
});

test("filter-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. filter native .filter 10k", () => {
			data10k.filter((n) => n % 2 === 0);
		}),
		bench("2. (current) filter push loop 10k", () => {
			const result: number[] = [];
			for (let i = 0; i < data10k.length; i++) {
				if (data10k[i] % 2 === 0) { result.push(data10k[i]); }
			}
		}),
	);
});

test("flatMap-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. flatMap concat+spread 10k", () => {
			([] as number[]).concat(...data10k.map((n) => [n, n + 1]));
		}),
		bench("2. (current) flatMap push loop 10k", () => {
			const result: number[] = [];
			for (let i = 0; i < data10k.length; i++) {
				result.push(data10k[i], data10k[i] + 1);
			}
		}),
		bench("3. flatMap native .flatMap 10k", () => {
			data10k.flatMap((n) => [n, n + 1]);
		}),
	);
});

test("every-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. every native .every all-pass 10k", () => {
			data10k.every((n) => n >= 0);
		}),
		bench("2. (current) every loop all-pass 10k", () => {
			const n = data10k.length;
			for (let i = 0; i < n; i++) {
				if (!(data10k[i] >= 0)) { return; }
			}
		}),
	);
});

test("every-earlyexit-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. every native .every early-exit 10k", () => {
			data10k.every((n) => n < 5000);
		}),
		bench("2. (current) every loop early-exit 10k", () => {
			const n = data10k.length;
			for (let i = 0; i < n; i++) {
				if (!(data10k[i] < 5000)) { return; }
			}
		}),
	);
});

test("some-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. some native .some all-false 10k", () => {
			data10k.some((n) => n < 0);
		}),
		bench("2. (current) some loop all-false 10k", () => {
			const n = data10k.length;
			for (let i = 0; i < n; i++) {
				if (data10k[i] < 0) { return; }
			}
		}),
	);
});

test("some-earlyexit-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. some native .some early-exit 10k", () => {
			data10k.some((n) => n > 5000);
		}),
		bench("2. (current) some loop early-exit 10k", () => {
			const n = data10k.length;
			for (let i = 0; i < n; i++) {
				if (data10k[i] > 5000) { return; }
			}
		}),
	);
});

test("take-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) take native .slice 10k", () => {
			data10k.slice(0, 5000);
		}),
		bench("2. take pre-alloc loop 10k", () => {
			const count = Math.min(5000, data10k.length);
			const result = new Array<number>(count);
			for (let i = 0; i < count; i++) { result[i] = data10k[i]; }
		}),
	);
});

test("drop-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) drop native .slice 10k", () => {
			data10k.slice(5000);
		}),
		bench("2. drop pre-alloc loop 10k", () => {
			const start = Math.min(5000, data10k.length);
			const count = data10k.length - start;
			const result = new Array<number>(count);
			for (let i = 0; i < count; i++) { result[i] = data10k[start + i]; }
		}),
	);
});

test("splitAt-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) splitAt two .slice 10k", () => {
			void [data10k.slice(0, 5000), data10k.slice(5000)];
		}),
		bench("2. splitAt two pre-alloc loops 10k", () => {
			const i = Math.min(5000, data10k.length);
			const left = new Array<number>(i);
			for (let j = 0; j < i; j++) { left[j] = data10k[j]; }
			const right = new Array<number>(data10k.length - i);
			for (let j = 0; j < right.length; j++) { right[j] = data10k[i + j]; }
		}),
	);
});
