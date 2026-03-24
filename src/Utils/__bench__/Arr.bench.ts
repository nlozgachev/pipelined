import { pipe } from "#composition/pipe.ts";
import { Maybe } from "#core/Maybe.ts";
import { Result } from "#core/Result.ts";
import { bench, describe } from "vitest";
import { Arr } from "../Arr.ts";

const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);
const otherArr = Array.from({ length: 10_000 }, (_, i) => i + 1);
const shuffled = [...data10k].reverse();
const words = Array.from({ length: 10_000 }, (_, i) => `word${i % 100}`);
const toSome = (n: number): Maybe<number> => Maybe.some(n * 2);
const toSome2 = (n: number): Maybe<number> => Maybe.some(n * 2);
const toOk = (n: number): Result<never, number> => Result.ok(n * 2);
const toOk2 = (n: number): Result<never, number> => Result.ok(n * 2);

// =============================================================================
// map
// =============================================================================

describe("map-100", () => {
	bench("Arr.map 100", () => {
		pipe(data100, Arr.map((n) => n * 2));
	});
	bench("native .map 100", () => {
		data100.map((n) => n * 2);
	});
});

describe("map-10k", () => {
	bench("Arr.map 10k", () => {
		pipe(data10k, Arr.map((n) => n * 2));
	});
	bench("native .map 10k", () => {
		data10k.map((n) => n * 2);
	});
});

describe("filter-10k", () => {
	bench("Arr.filter 10k", () => {
		pipe(data10k, Arr.filter((n) => n % 2 === 0));
	});
	bench("native .filter 10k", () => {
		data10k.filter((n) => n % 2 === 0);
	});
});

describe("flatMap-10k", () => {
	bench("Arr.flatMap 10k", () => {
		pipe(data10k, Arr.flatMap((n) => [n, n + 1]));
	});
	bench("native .flatMap 10k", () => {
		data10k.flatMap((n) => [n, n + 1]);
	});
});

describe("reduce-10k", () => {
	bench("Arr.reduce 10k", () => {
		pipe(data10k, Arr.reduce(0, (acc, n) => acc + n));
	});
	bench("native .reduce 10k", () => {
		data10k.reduce((acc, n) => acc + n, 0);
	});
});

describe("scan-10k", () => {
	bench("Arr.scan 10k", () => {
		pipe(data10k, Arr.scan(0, (acc, n) => acc + n));
	});
	bench("scan native loop 10k", () => {
		const result: number[] = [];
		let acc = 0;
		for (const n of data10k) {
			acc += n;
			result.push(acc);
		}
	});
});

describe("traverse-maybe-10k", () => {
	bench("Arr.traverse Maybe 10k (all-Some)", () => {
		pipe(data10k, Arr.traverse(toSome));
	});
	bench("native traverse Maybe 10k (all-Some)", () => {
		const result: number[] = [];
		for (const n of data10k) {
			const v = toSome(n);
			if (v.kind === "None") break;
			result.push(v.value);
		}
	});
});

describe("traverse-result-10k", () => {
	bench("Arr.traverseResult 10k (all-Ok)", () => {
		pipe(data10k, Arr.traverseResult(toOk));
	});
	bench("native traverseResult 10k (all-Ok)", () => {
		const result: number[] = [];
		for (const n of data10k) {
			const v = toOk(n);
			if (v.kind === "Ok") result.push(v.value);
		}
	});
});

describe("groupBy-10k", () => {
	bench("Arr.groupBy 10k", () => {
		pipe(words, Arr.groupBy((s) => s[0]));
	});
	bench("native groupBy 10k", () => {
		const result: Record<string, string[]> = {};
		for (const s of words) {
			const [key] = s;
			if (!result[key]) result[key] = [];
			result[key].push(s);
		}
	});
});

describe("uniqBy-10k", () => {
	bench("Arr.uniqBy 10k", () => {
		pipe(data10k, Arr.uniqBy((n) => n % 100));
	});
	bench("native uniqBy 10k", () => {
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
	bench("Arr.sortBy 10k", () => {
		pipe(shuffled, Arr.sortBy((a, b) => a - b));
	});
	bench("native .sort 10k", () => {
		[...shuffled].sort((a, b) => a - b);
	});
});

describe("zip-10k", () => {
	bench("Arr.zip 10k", () => {
		pipe(data10k, Arr.zip(otherArr));
	});
	bench("native zip loop 10k", () => {
		const len = Math.min(data10k.length, otherArr.length);
		const result: [number, number][] = [];
		for (let i = 0; i < len; i++) {
			result.push([data10k[i], otherArr[i]]);
		}
	});
});

describe("scan-approaches-10k", () => {
	bench("scan push 10k", () => {
		const result: number[] = [];
		let acc = 0;
		for (let i = 0; i < data10k.length; i++) {
			acc += data10k[i];
			result.push(acc);
		}
	});
	bench("[impl] scan pre-alloc 10k", () => {
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
	bench("zip push 10k", () => {
		const len = Math.min(data10k.length, otherArr.length);
		const result: [number, number][] = [];
		for (let i = 0; i < len; i++) {
			result.push([data10k[i], otherArr[i]]);
		}
	});
	bench("[impl] zip pre-alloc 10k", () => {
		const len = Math.min(data10k.length, otherArr.length);
		const result = new Array<[number, number]>(len);
		for (let i = 0; i < len; i++) {
			result[i] = [data10k[i], otherArr[i]];
		}
	});
});

describe("traverse-approaches-10k", () => {
	bench("traverse push 10k", () => {
		const result: number[] = [];
		for (let i = 0; i < data10k.length; i++) {
			const mapped = toSome2(data10k[i]);
			if (mapped.kind === "None") return;
			result.push(mapped.value);
		}
	});
	bench("[impl] traverse pre-alloc 10k", () => {
		const n = data10k.length;
		const result = new Array<number>(n);
		for (let i = 0; i < n; i++) {
			const mapped = toSome2(data10k[i]);
			if (mapped.kind === "None") return;
			result[i] = mapped.value;
		}
	});
});

describe("traverseResult-approaches-10k", () => {
	bench("traverseResult push 10k", () => {
		const result: number[] = [];
		for (let i = 0; i < data10k.length; i++) {
			const mapped = toOk2(data10k[i]);
			if (mapped.kind === "Error") return;
			result.push(mapped.value);
		}
	});
	bench("[impl] traverseResult pre-alloc 10k", () => {
		const n = data10k.length;
		const result = new Array<number>(n);
		for (let i = 0; i < n; i++) {
			const mapped = toOk2(data10k[i]);
			if (mapped.kind === "Error") return;
			result[i] = mapped.value;
		}
	});
});

describe("partition-approaches-10k", () => {
	bench("[impl] partition for-of 10k", () => {
		const pass: number[] = [];
		const fail: number[] = [];
		for (const a of data10k) {
			(a % 2 === 0 ? pass : fail).push(a);
		}
	});
	bench("partition index 10k", () => {
		const pass: number[] = [];
		const fail: number[] = [];
		for (let i = 0; i < data10k.length; i++) {
			const a = data10k[i];
			(a % 2 === 0 ? pass : fail).push(a);
		}
	});
});

describe("uniqby-approaches-10k", () => {
	bench("[impl] uniqBy for-of 10k", () => {
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
	bench("uniqBy index 10k", () => {
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
	bench("map native .map 10k", () => {
		data10k.map((n) => n * 2);
	});
	bench("[impl] map pre-alloc loop 10k", () => {
		const n = data10k.length;
		const result = new Array<number>(n);
		for (let i = 0; i < n; i++) result[i] = data10k[i] * 2;
	});
});

describe("filter-approaches-10k", () => {
	bench("filter native .filter 10k", () => {
		data10k.filter((n) => n % 2 === 0);
	});
	bench("[impl] filter push loop 10k", () => {
		const result: number[] = [];
		for (let i = 0; i < data10k.length; i++) {
			if (data10k[i] % 2 === 0) result.push(data10k[i]);
		}
	});
});

describe("flatMap-approaches-10k", () => {
	bench("flatMap concat+spread 10k", () => {
		([] as number[]).concat(...data10k.map((n) => [n, n + 1]));
	});
	bench("[impl] flatMap push loop 10k", () => {
		const result: number[] = [];
		for (let i = 0; i < data10k.length; i++) {
			result.push(data10k[i], data10k[i] + 1);
		}
	});
	bench("flatMap native .flatMap 10k", () => {
		data10k.flatMap((n) => [n, n + 1]);
	});
});

describe("every-approaches-10k", () => {
	bench("every native .every all-pass 10k", () => {
		data10k.every((n) => n >= 0);
	});
	bench("[impl] every loop all-pass 10k", () => {
		const n = data10k.length;
		for (let i = 0; i < n; i++) {
			if (!(data10k[i] >= 0)) return;
		}
	});
});

describe("every-earlyexit-10k", () => {
	bench("every native .every early-exit 10k", () => {
		data10k.every((n) => n < 5_000);
	});
	bench("[impl] every loop early-exit 10k", () => {
		const n = data10k.length;
		for (let i = 0; i < n; i++) {
			if (!(data10k[i] < 5_000)) return;
		}
	});
});

describe("some-approaches-10k", () => {
	bench("some native .some all-false 10k", () => {
		data10k.some((n) => n < 0);
	});
	bench("[impl] some loop all-false 10k", () => {
		const n = data10k.length;
		for (let i = 0; i < n; i++) {
			if (data10k[i] < 0) return;
		}
	});
});

describe("some-earlyexit-10k", () => {
	bench("some native .some early-exit 10k", () => {
		data10k.some((n) => n > 5_000);
	});
	bench("[impl] some loop early-exit 10k", () => {
		const n = data10k.length;
		for (let i = 0; i < n; i++) {
			if (data10k[i] > 5_000) return;
		}
	});
});

describe("take-approaches-10k", () => {
	bench("[impl] take native .slice 10k", () => {
		data10k.slice(0, 5_000);
	});
	bench("take pre-alloc loop 10k", () => {
		const count = Math.min(5_000, data10k.length);
		const result = new Array<number>(count);
		for (let i = 0; i < count; i++) result[i] = data10k[i];
	});
});

describe("drop-approaches-10k", () => {
	bench("[impl] drop native .slice 10k", () => {
		data10k.slice(5_000);
	});
	bench("drop pre-alloc loop 10k", () => {
		const start = Math.min(5_000, data10k.length);
		const count = data10k.length - start;
		const result = new Array<number>(count);
		for (let i = 0; i < count; i++) result[i] = data10k[start + i];
	});
});

describe("splitAt-approaches-10k", () => {
	bench("[impl] splitAt two .slice 10k", () => {
		void [data10k.slice(0, 5_000), data10k.slice(5_000)];
	});
	bench("splitAt two pre-alloc loops 10k", () => {
		const i = Math.min(5_000, data10k.length);
		const left = new Array<number>(i);
		for (let j = 0; j < i; j++) left[j] = data10k[j];
		const right = new Array<number>(data10k.length - i);
		for (let j = 0; j < right.length; j++) right[j] = data10k[i + j];
	});
});
