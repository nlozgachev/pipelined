import { pipe } from "#composition";
import { Maybe, Result } from "#core";
import { Arr } from "#data";
import { bench, describe } from "vitest";

const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);
const otherArr = Array.from({ length: 10_000 }, (_, i) => i + 1);
const shuffled = [...data10k].toReversed();
const words = Array.from({ length: 10_000 }, (_, i) => `word${i % 100}`);
const toSome = (n: number): Maybe<number> => Maybe.some(n * 2);
const toSome2 = (n: number): Maybe<number> => Maybe.some(n * 2);
const toOk = (n: number): Result<never, number> => Result.ok(n * 2);
const toOk2 = (n: number): Result<never, number> => Result.ok(n * 2);

// =============================================================================
// map
// =============================================================================

describe("map-100", () => {
	bench("1. (current) Arr.map 100", () => {
		pipe(data100, Arr.map((n) => n * 2));
	});
	bench("2. native .map 100", () => {
		data100.map((n) => n * 2);
	});
});

describe("map-10k", () => {
	bench("1. (current) Arr.map 10k", () => {
		pipe(data10k, Arr.map((n) => n * 2));
	});
	bench("2. native .map 10k", () => {
		data10k.map((n) => n * 2);
	});
});

describe("filter-10k", () => {
	bench("1. (current) Arr.filter 10k", () => {
		pipe(data10k, Arr.filter((n) => n % 2 === 0));
	});
	bench("2. native .filter 10k", () => {
		data10k.filter((n) => n % 2 === 0);
	});
});

describe("flatMap-10k", () => {
	bench("1. (current) Arr.flatMap 10k", () => {
		pipe(data10k, Arr.flatMap((n) => [n, n + 1]));
	});
	bench("2. native .flatMap 10k", () => {
		data10k.flatMap((n) => [n, n + 1]);
	});
});

describe("reduce-10k", () => {
	bench("1. (current) Arr.reduce 10k", () => {
		pipe(data10k, Arr.reduce(0, (acc, n) => acc + n));
	});
	bench("2. native .reduce 10k", () => {
		data10k.reduce((acc, n) => acc + n, 0);
	});
});

describe("scan-10k", () => {
	bench("1. (current) Arr.scan 10k", () => {
		pipe(data10k, Arr.scan(0, (acc, n) => acc + n));
	});
	bench("2. scan native loop 10k", () => {
		const result: number[] = [];
		let acc = 0;
		for (const n of data10k) {
			acc += n;
			result.push(acc);
		}
	});
});

describe("traverse-maybe-10k", () => {
	bench("1. (current) Arr.traverse Maybe 10k (all-Some", () => {
		pipe(data10k, Arr.Maybe.traverse(toSome));
	});
	bench("2. native traverse Maybe 10k (all-Some", () => {
		const result: number[] = [];
		for (const n of data10k) {
			const v = toSome(n);
			if (v.kind === "None") { break; }
			result.push(v.value);
		}
	});
});

describe("traverse-result-10k", () => {
	bench("1. (current) Arr.traverseResult 10k (all-Ok", () => {
		pipe(data10k, Arr.Result.traverse(toOk));
	});
	bench("2. native traverseResult 10k (all-Ok", () => {
		const result: number[] = [];
		for (const n of data10k) {
			const v = toOk(n);
			if (v.kind === "Ok") { result.push(v.value); }
		}
	});
});

describe("groupBy-10k", () => {
	bench("1. (current) Arr.groupBy 10k", () => {
		pipe(words, Arr.groupBy((s) => s[0]));
	});
	bench("2. native groupBy 10k", () => {
		const result: Record<string, string[]> = {};
		for (const s of words) {
			const [key] = s;
			if (!result[key]) { result[key] = []; }
			result[key].push(s);
		}
	});
});

describe("uniqBy-10k", () => {
	bench("1. (current) Arr.uniqBy 10k", () => {
		pipe(data10k, Arr.uniqBy((n) => n % 100));
	});
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
	});
});

describe("sortBy-10k", () => {
	bench("1. (current) Arr.sortBy 10k", () => {
		pipe(shuffled, Arr.sortBy((a, b) => a - b));
	});
	bench("2. native .sort 10k", () => {
		[...shuffled].toSorted((a, b) => a - b);
	});
	bench("3. native .toSorted 10k", () => {
		shuffled.toSorted((a, b) => a - b);
	});
});

describe("reverse-10k", () => {
	bench("1. (current) Arr.reverse 10k", () => {
		pipe(data10k, Arr.reverse);
	});
	bench("2. native .reverse 10k", () => {
		[...data10k].toReversed();
	});
	bench("3. native .toReversed 10k", () => {
		data10k.toReversed();
	});
});

describe("insertAt-10k", () => {
	bench("1. (current) Arr.insertAt 10k", () => {
		pipe(data10k, Arr.insertAt(5000, -1));
	});
	bench("2. native .toSpliced insert 10k", () => {
		data10k.toSpliced(5000, 0, -1);
	});
	bench("3. spread + splice insert 10k", () => {
		const result = [...data10k];
		result.splice(5000, 0, -1);
	});
});

describe("removeAt-10k", () => {
	bench("1. (current) Arr.removeAt 10k", () => {
		pipe(data10k, Arr.removeAt(5000));
	});
	bench("2. native .toSpliced remove 10k", () => {
		data10k.toSpliced(5000, 1);
	});
	bench("3. spread + splice remove 10k", () => {
		const result = [...data10k];
		result.splice(5000, 1);
	});
});

describe("zip-10k", () => {
	bench("1. (current) Arr.zip 10k", () => {
		pipe(data10k, Arr.zip(otherArr));
	});
	bench("2. native zip loop 10k", () => {
		const len = Math.min(data10k.length, otherArr.length);
		const result: [number, number][] = [];
		for (let i = 0; i < len; i++) {
			result.push([data10k[i], otherArr[i]]);
		}
	});
});

describe("scan-approaches-10k", () => {
	bench("1. scan push 10k", () => {
		const result: number[] = [];
		let acc = 0;
		for (let i = 0; i < data10k.length; i++) {
			acc += data10k[i];
			result.push(acc);
		}
	});
	bench("2. (current) scan pre-alloc 10k", () => {
		const n = data10k.length;
		const result = new Array<number>(n);
		let acc = 0;
		for (let i = 0; i < n; i++) {
			acc += data10k[i];
			result[i] = acc;
		}
	});
});

describe("zip-approaches-10k", () => {
	bench("1. zip push 10k", () => {
		const len = Math.min(data10k.length, otherArr.length);
		const result: [number, number][] = [];
		for (let i = 0; i < len; i++) {
			result.push([data10k[i], otherArr[i]]);
		}
	});
	bench("2. (current) zip pre-alloc 10k", () => {
		const len = Math.min(data10k.length, otherArr.length);
		const result = new Array<[number, number]>(len);
		for (let i = 0; i < len; i++) {
			result[i] = [data10k[i], otherArr[i]];
		}
	});
});

describe("traverse-approaches-10k", () => {
	bench("1. traverse push 10k", () => {
		const result: number[] = [];
		for (let i = 0; i < data10k.length; i++) {
			const mapped = toSome2(data10k[i]);
			if (mapped.kind === "None") { return; }
			result.push(mapped.value);
		}
	});
	bench("2. (current) traverse pre-alloc 10k", () => {
		const n = data10k.length;
		const result = new Array<number>(n);
		for (let i = 0; i < n; i++) {
			const mapped = toSome2(data10k[i]);
			if (mapped.kind === "None") { return; }
			result[i] = mapped.value;
		}
	});
});

describe("traverseResult-approaches-10k", () => {
	bench("1. traverseResult push 10k", () => {
		const result: number[] = [];
		for (let i = 0; i < data10k.length; i++) {
			const mapped = toOk2(data10k[i]);
			if (mapped.kind === "Err") { return; }
			result.push(mapped.value);
		}
	});
	bench("2. (current) traverseResult pre-alloc 10k", () => {
		const n = data10k.length;
		const result = new Array<number>(n);
		for (let i = 0; i < n; i++) {
			const mapped = toOk2(data10k[i]);
			if (mapped.kind === "Err") { return; }
			result[i] = mapped.value;
		}
	});
});

describe("partition-approaches-10k", () => {
	bench("1. (current) partition for-of 10k", () => {
		const pass: number[] = [];
		const fail: number[] = [];
		for (const a of data10k) {
			(a % 2 === 0 ? pass : fail).push(a);
		}
	});
	bench("2. partition index 10k", () => {
		const pass: number[] = [];
		const fail: number[] = [];
		for (let i = 0; i < data10k.length; i++) {
			const a = data10k[i];
			(a % 2 === 0 ? pass : fail).push(a);
		}
	});
});

describe("uniqby-approaches-10k", () => {
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
	});
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
	});
});

describe("map-approaches-10k", () => {
	bench("1. map native .map 10k", () => {
		data10k.map((n) => n * 2);
	});
	bench("2. (current) map pre-alloc loop 10k", () => {
		const n = data10k.length;
		const result = new Array<number>(n);
		for (let i = 0; i < n; i++) { result[i] = data10k[i] * 2; }
	});
});

describe("filter-approaches-10k", () => {
	bench("1. filter native .filter 10k", () => {
		data10k.filter((n) => n % 2 === 0);
	});
	bench("2. (current) filter push loop 10k", () => {
		const result: number[] = [];
		for (let i = 0; i < data10k.length; i++) {
			if (data10k[i] % 2 === 0) { result.push(data10k[i]); }
		}
	});
});

describe("flatMap-approaches-10k", () => {
	bench("1. flatMap concat+spread 10k", () => {
		([] as number[]).concat(...data10k.map((n) => [n, n + 1]));
	});
	bench("2. (current) flatMap push loop 10k", () => {
		const result: number[] = [];
		for (let i = 0; i < data10k.length; i++) {
			result.push(data10k[i], data10k[i] + 1);
		}
	});
	bench("3. flatMap native .flatMap 10k", () => {
		data10k.flatMap((n) => [n, n + 1]);
	});
});

describe("every-approaches-10k", () => {
	bench("1. every native .every all-pass 10k", () => {
		data10k.every((n) => n >= 0);
	});
	bench("2. (current) every loop all-pass 10k", () => {
		const n = data10k.length;
		for (let i = 0; i < n; i++) {
			if (!(data10k[i] >= 0)) { return; }
		}
	});
});

describe("every-earlyexit-10k", () => {
	bench("1. every native .every early-exit 10k", () => {
		data10k.every((n) => n < 5000);
	});
	bench("2. (current) every loop early-exit 10k", () => {
		const n = data10k.length;
		for (let i = 0; i < n; i++) {
			if (!(data10k[i] < 5000)) { return; }
		}
	});
});

describe("some-approaches-10k", () => {
	bench("1. some native .some all-false 10k", () => {
		data10k.some((n) => n < 0);
	});
	bench("2. (current) some loop all-false 10k", () => {
		const n = data10k.length;
		for (let i = 0; i < n; i++) {
			if (data10k[i] < 0) { return; }
		}
	});
});

describe("some-earlyexit-10k", () => {
	bench("1. some native .some early-exit 10k", () => {
		data10k.some((n) => n > 5000);
	});
	bench("2. (current) some loop early-exit 10k", () => {
		const n = data10k.length;
		for (let i = 0; i < n; i++) {
			if (data10k[i] > 5000) { return; }
		}
	});
});

describe("take-approaches-10k", () => {
	bench("1. (current) take native .slice 10k", () => {
		data10k.slice(0, 5000);
	});
	bench("2. take pre-alloc loop 10k", () => {
		const count = Math.min(5000, data10k.length);
		const result = new Array<number>(count);
		for (let i = 0; i < count; i++) { result[i] = data10k[i]; }
	});
});

describe("drop-approaches-10k", () => {
	bench("1. (current) drop native .slice 10k", () => {
		data10k.slice(5000);
	});
	bench("2. drop pre-alloc loop 10k", () => {
		const start = Math.min(5000, data10k.length);
		const count = data10k.length - start;
		const result = new Array<number>(count);
		for (let i = 0; i < count; i++) { result[i] = data10k[start + i]; }
	});
});

describe("splitAt-approaches-10k", () => {
	bench("1. (current) splitAt two .slice 10k", () => {
		void [data10k.slice(0, 5000), data10k.slice(5000)];
	});
	bench("2. splitAt two pre-alloc loops 10k", () => {
		const i = Math.min(5000, data10k.length);
		const left = new Array<number>(i);
		for (let j = 0; j < i; j++) { left[j] = data10k[j]; }
		const right = new Array<number>(data10k.length - i);
		for (let j = 0; j < right.length; j++) { right[j] = data10k[i + j]; }
	});
});
