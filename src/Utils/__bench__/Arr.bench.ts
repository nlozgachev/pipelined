import { Arr } from "../Arr.ts";
import { Option } from "#core/Option.ts";
import { Result } from "#core/Result.ts";
import { pipe } from "#composition/pipe.ts";

const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);

// =============================================================================
// map
// =============================================================================

Deno.bench("Arr.map 100", { group: "map-100", baseline: true }, () => {
	pipe(data100, Arr.map((n) => n * 2));
});

Deno.bench("native .map 100", { group: "map-100" }, () => {
	data100.map((n) => n * 2);
});

Deno.bench("Arr.map 10k", { group: "map-10k", baseline: true }, () => {
	pipe(data10k, Arr.map((n) => n * 2));
});

Deno.bench("native .map 10k", { group: "map-10k" }, () => {
	data10k.map((n) => n * 2);
});

// =============================================================================
// filter
// =============================================================================

Deno.bench("Arr.filter 10k", { group: "filter-10k", baseline: true }, () => {
	pipe(data10k, Arr.filter((n) => n % 2 === 0));
});

Deno.bench("native .filter 10k", { group: "filter-10k" }, () => {
	data10k.filter((n) => n % 2 === 0);
});

// =============================================================================
// flatMap
// =============================================================================

Deno.bench("Arr.flatMap 10k", { group: "flatMap-10k", baseline: true }, () => {
	pipe(data10k, Arr.flatMap((n) => [n, n + 1]));
});

Deno.bench("native .flatMap 10k", { group: "flatMap-10k" }, () => {
	data10k.flatMap((n) => [n, n + 1]);
});

// =============================================================================
// reduce
// =============================================================================

Deno.bench("Arr.reduce 10k", { group: "reduce-10k", baseline: true }, () => {
	pipe(data10k, Arr.reduce(0, (acc, n) => acc + n));
});

Deno.bench("native .reduce 10k", { group: "reduce-10k" }, () => {
	data10k.reduce((acc, n) => acc + n, 0);
});

// =============================================================================
// scan
// =============================================================================

Deno.bench("Arr.scan 10k", { group: "scan-10k", baseline: true }, () => {
	pipe(data10k, Arr.scan(0, (acc, n) => acc + n));
});

Deno.bench("scan native loop 10k", { group: "scan-10k" }, () => {
	const result: number[] = [];
	let acc = 0;
	for (const n of data10k) {
		acc += n;
		result.push(acc);
	}
});

// =============================================================================
// traverse (Option — all-Some path)
// =============================================================================

const toSome = (n: number): Option<number> => Option.some(n * 2);

Deno.bench("Arr.traverse Option 10k (all-Some)", { group: "traverse-option-10k", baseline: true }, () => {
	pipe(data10k, Arr.traverse(toSome));
});

Deno.bench("native traverse Option 10k (all-Some)", { group: "traverse-option-10k" }, () => {
	const result: number[] = [];
	for (const n of data10k) {
		const v = toSome(n);
		if (v.kind === "None") break;
		result.push(v.value);
	}
});

// =============================================================================
// traverseResult (all-Ok path)
// =============================================================================

const toOk = (n: number): Result<never, number> => Result.ok(n * 2);

Deno.bench("Arr.traverseResult 10k (all-Ok)", { group: "traverse-result-10k", baseline: true }, () => {
	pipe(data10k, Arr.traverseResult(toOk));
});

Deno.bench("native traverseResult 10k (all-Ok)", { group: "traverse-result-10k" }, () => {
	const result: number[] = [];
	for (const n of data10k) {
		const v = toOk(n);
		if (v.kind === "Ok") result.push(v.value);
	}
});

// =============================================================================
// groupBy
// =============================================================================

const words = Array.from({ length: 10_000 }, (_, i) => `word${i % 100}`);

Deno.bench("Arr.groupBy 10k", { group: "groupBy-10k", baseline: true }, () => {
	pipe(words, Arr.groupBy((s) => s[0]));
});

Deno.bench("native groupBy 10k", { group: "groupBy-10k" }, () => {
	const result: Record<string, string[]> = {};
	for (const s of words) {
		const key = s[0];
		if (!result[key]) result[key] = [];
		result[key].push(s);
	}
});

// =============================================================================
// uniqBy
// =============================================================================

Deno.bench("Arr.uniqBy 10k", { group: "uniqBy-10k", baseline: true }, () => {
	pipe(data10k, Arr.uniqBy((n) => n % 100));
});

Deno.bench("native uniqBy 10k", { group: "uniqBy-10k" }, () => {
	const seen = new Set<number>();
	const result: number[] = [];
	for (const n of data10k) {
		const key = n % 100;
		if (!seen.has(key)) {
			seen.add(key);
			result.push(n);
		}
	}
});

// =============================================================================
// sortBy
// =============================================================================

const shuffled = [...data10k].reverse();

Deno.bench("Arr.sortBy 10k", { group: "sortBy-10k", baseline: true }, () => {
	pipe(shuffled, Arr.sortBy((a, b) => a - b));
});

Deno.bench("native .sort 10k", { group: "sortBy-10k" }, () => {
	[...shuffled].sort((a, b) => a - b);
});

// =============================================================================
// zip
// =============================================================================

const otherArr = Array.from({ length: 10_000 }, (_, i) => i + 1);

Deno.bench("Arr.zip 10k", { group: "zip-10k", baseline: true }, () => {
	pipe(data10k, Arr.zip(otherArr));
});

Deno.bench("native zip loop 10k", { group: "zip-10k" }, () => {
	const len = Math.min(data10k.length, otherArr.length);
	const result: [number, number][] = [];
	for (let i = 0; i < len; i++) {
		result.push([data10k[i], otherArr[i]]);
	}
});

// =============================================================================
// pre-allocation vs push — approach candidates
// =============================================================================

// --- scan ---

Deno.bench("scan push 10k", { group: "scan-approaches-10k" }, () => {
	const result: number[] = [];
	let acc = 0;
	for (let i = 0; i < data10k.length; i++) {
		acc += data10k[i];
		result.push(acc);
	}
});

Deno.bench("[impl] scan pre-alloc 10k", { group: "scan-approaches-10k", baseline: true }, () => {
	const n = data10k.length;
	const result = new Array<number>(n);
	let acc = 0;
	for (let i = 0; i < n; i++) {
		acc += data10k[i];
		result[i] = acc;
	}
});

// --- zip ---

Deno.bench("zip push 10k", { group: "zip-approaches-10k" }, () => {
	const len = Math.min(data10k.length, otherArr.length);
	const result: [number, number][] = [];
	for (let i = 0; i < len; i++) {
		result.push([data10k[i], otherArr[i]]);
	}
});

Deno.bench("[impl] zip pre-alloc 10k", { group: "zip-approaches-10k", baseline: true }, () => {
	const len = Math.min(data10k.length, otherArr.length);
	const result = new Array<[number, number]>(len);
	for (let i = 0; i < len; i++) {
		result[i] = [data10k[i], otherArr[i]];
	}
});

// --- traverse (Option, all-Some) ---

const toSome2 = (n: number): Option<number> => Option.some(n * 2);

Deno.bench("traverse push 10k", { group: "traverse-approaches-10k" }, () => {
	const result: number[] = [];
	for (let i = 0; i < data10k.length; i++) {
		const mapped = toSome2(data10k[i]);
		if (mapped.kind === "None") return;
		result.push(mapped.value);
	}
});

Deno.bench("[impl] traverse pre-alloc 10k", { group: "traverse-approaches-10k", baseline: true }, () => {
	const n = data10k.length;
	const result = new Array<number>(n);
	for (let i = 0; i < n; i++) {
		const mapped = toSome2(data10k[i]);
		if (mapped.kind === "None") return;
		result[i] = mapped.value;
	}
});

// --- traverseResult (all-Ok) ---

const toOk2 = (n: number): Result<never, number> => Result.ok(n * 2);

Deno.bench("traverseResult push 10k", { group: "traverseResult-approaches-10k" }, () => {
	const result: number[] = [];
	for (let i = 0; i < data10k.length; i++) {
		const mapped = toOk2(data10k[i]);
		if (mapped.kind === "Error") return;
		result.push(mapped.value);
	}
});

Deno.bench("[impl] traverseResult pre-alloc 10k", { group: "traverseResult-approaches-10k", baseline: true }, () => {
	const n = data10k.length;
	const result = new Array<number>(n);
	for (let i = 0; i < n; i++) {
		const mapped = toOk2(data10k[i]);
		if (mapped.kind === "Error") return;
		result[i] = mapped.value;
	}
});

// --- for...of vs index loop (unknown output size) ---

Deno.bench("[impl] partition for-of 10k", { group: "partition-approaches-10k", baseline: true }, () => {
	const pass: number[] = [];
	const fail: number[] = [];
	for (const a of data10k) {
		(a % 2 === 0 ? pass : fail).push(a);
	}
});

Deno.bench("partition index 10k", { group: "partition-approaches-10k" }, () => {
	const pass: number[] = [];
	const fail: number[] = [];
	for (let i = 0; i < data10k.length; i++) {
		const a = data10k[i];
		(a % 2 === 0 ? pass : fail).push(a);
	}
});

Deno.bench("[impl] uniqBy for-of 10k", { group: "uniqby-approaches-10k", baseline: true }, () => {
	const seen = new Set<number>();
	const result: number[] = [];
	for (const a of data10k) {
		const key = a % 100;
		if (!seen.has(key)) {
			seen.add(key);
			result.push(a);
		}
	}
});

Deno.bench("uniqBy index 10k", { group: "uniqby-approaches-10k" }, () => {
	const seen = new Set<number>();
	const result: number[] = [];
	for (let i = 0; i < data10k.length; i++) {
		const key = data10k[i] % 100;
		if (!seen.has(key)) {
			seen.add(key);
			result.push(data10k[i]);
		}
	}
});

// =============================================================================
// map — native delegation vs custom pre-alloc loop
// =============================================================================

Deno.bench("map native .map 10k", { group: "map-approaches-10k" }, () => {
	data10k.map((n) => n * 2);
});

Deno.bench("[impl] map pre-alloc loop 10k", { group: "map-approaches-10k", baseline: true }, () => {
	const n = data10k.length;
	const result = new Array<number>(n);
	for (let i = 0; i < n; i++) result[i] = data10k[i] * 2;
});

// =============================================================================
// filter — native delegation vs custom push loop
// =============================================================================

Deno.bench("filter native .filter 10k", { group: "filter-approaches-10k" }, () => {
	data10k.filter((n) => n % 2 === 0);
});

Deno.bench("[impl] filter push loop 10k", { group: "filter-approaches-10k", baseline: true }, () => {
	const result: number[] = [];
	for (let i = 0; i < data10k.length; i++) {
		if (data10k[i] % 2 === 0) result.push(data10k[i]);
	}
});

// =============================================================================
// flatMap — concat+spread vs custom push loop
// =============================================================================

Deno.bench("flatMap concat+spread 10k", { group: "flatMap-approaches-10k" }, () => {
	([] as number[]).concat(...data10k.map((n) => [n, n + 1]));
});

Deno.bench("[impl] flatMap push loop 10k", { group: "flatMap-approaches-10k", baseline: true }, () => {
	const result: number[] = [];
	for (let i = 0; i < data10k.length; i++) {
		result.push(data10k[i], data10k[i] + 1);
	}
});

Deno.bench("flatMap native .flatMap 10k", { group: "flatMap-approaches-10k" }, () => {
	data10k.flatMap((n) => [n, n + 1]);
});

// =============================================================================
// every — native delegation vs custom loop (all-pass and early-exit)
// =============================================================================

Deno.bench("every native .every all-pass 10k", { group: "every-approaches-10k" }, () => {
	data10k.every((n) => n >= 0);
});

Deno.bench("[impl] every loop all-pass 10k", { group: "every-approaches-10k", baseline: true }, () => {
	const n = data10k.length;
	for (let i = 0; i < n; i++) {
		if (!(data10k[i] >= 0)) return;
	}
});

Deno.bench("every native .every early-exit 10k", { group: "every-earlyexit-10k" }, () => {
	data10k.every((n) => n < 5_000);
});

Deno.bench("[impl] every loop early-exit 10k", { group: "every-earlyexit-10k", baseline: true }, () => {
	const n = data10k.length;
	for (let i = 0; i < n; i++) {
		if (!(data10k[i] < 5_000)) return;
	}
});

// =============================================================================
// some — native delegation vs custom loop
// =============================================================================

Deno.bench("some native .some all-false 10k", { group: "some-approaches-10k" }, () => {
	data10k.some((n) => n < 0);
});

Deno.bench("[impl] some loop all-false 10k", { group: "some-approaches-10k", baseline: true }, () => {
	const n = data10k.length;
	for (let i = 0; i < n; i++) {
		if (data10k[i] < 0) return;
	}
});

Deno.bench("some native .some early-exit 10k", { group: "some-earlyexit-10k" }, () => {
	data10k.some((n) => n > 5_000);
});

Deno.bench("[impl] some loop early-exit 10k", { group: "some-earlyexit-10k", baseline: true }, () => {
	const n = data10k.length;
	for (let i = 0; i < n; i++) {
		if (data10k[i] > 5_000) return;
	}
});

// =============================================================================
// take — native .slice vs pre-alloc loop
// =============================================================================

Deno.bench("[impl] take native .slice 10k", { group: "take-approaches-10k", baseline: true }, () => {
	data10k.slice(0, 5_000);
});

Deno.bench("take pre-alloc loop 10k", { group: "take-approaches-10k" }, () => {
	const count = Math.min(5_000, data10k.length);
	const result = new Array<number>(count);
	for (let i = 0; i < count; i++) result[i] = data10k[i];
});

// =============================================================================
// drop — native .slice vs pre-alloc loop
// =============================================================================

Deno.bench("[impl] drop native .slice 10k", { group: "drop-approaches-10k", baseline: true }, () => {
	data10k.slice(5_000);
});

Deno.bench("drop pre-alloc loop 10k", { group: "drop-approaches-10k" }, () => {
	const start = Math.min(5_000, data10k.length);
	const count = data10k.length - start;
	const result = new Array<number>(count);
	for (let i = 0; i < count; i++) result[i] = data10k[start + i];
});

// =============================================================================
// splitAt — two .slice calls vs two pre-alloc loops
// =============================================================================

Deno.bench("[impl] splitAt two .slice 10k", { group: "splitAt-approaches-10k", baseline: true }, () => {
	[data10k.slice(0, 5_000), data10k.slice(5_000)];
});

Deno.bench("splitAt two pre-alloc loops 10k", { group: "splitAt-approaches-10k" }, () => {
	const i = Math.min(5_000, data10k.length);
	const left = new Array<number>(i);
	for (let j = 0; j < i; j++) left[j] = data10k[j];
	const right = new Array<number>(data10k.length - i);
	for (let j = 0; j < right.length; j++) right[j] = data10k[i + j];
});
