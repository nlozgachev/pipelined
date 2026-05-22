import { pipe } from "#composition/pipe.ts";
import { Maybe } from "#core/Maybe.ts";
import * as fc from "fast-check";
import { bench, describe } from "vitest";
import { Dict } from "../Dict.ts";

const makeDict = (n: number): ReadonlyMap<string, number> =>
	Dict.fromEntries(Array.from({ length: n }, (_, i) => [`key${i}`, i]));

// varied fixtures — generated once at module load, non-sequential keys and values
const [variedEntries100] = fc.sample(
	fc.array(fc.tuple(fc.string({ minLength: 1, maxLength: 10 }), fc.integer()), { minLength: 100, maxLength: 100 }),
	1,
) as [[string, number][]];
const [variedEntries10k] = fc.sample(
	fc.array(fc.tuple(fc.string({ minLength: 1, maxLength: 10 }), fc.integer()), { minLength: 10_000, maxLength: 10_000 }),
	1,
) as [[string, number][]];
const variedDict100 = Dict.fromEntries(variedEntries100);
const variedDict10k = Dict.fromEntries(variedEntries10k);

const dict100 = makeDict(100);
const dict10k = makeDict(10_000);
const dictA100 = makeDict(50);
const dictB100 = Dict.fromEntries(Array.from({ length: 50 }, (_, i) => [`key${i + 25}`, i + 1000]));
const dictA10k = makeDict(5_000);
const dictB10k = Dict.fromEntries(Array.from({ length: 5_000 }, (_, i) => [`key${i + 2_500}`, i + 10_000]));
const optDict100 = Dict.fromEntries<string, Maybe<number>>(
	Array.from({ length: 100 }, (_, i) => [
		`key${i}`,
		i % 3 === 0 ? Maybe.none() : Maybe.some(i),
	]),
);
const optDict10k = Dict.fromEntries<string, Maybe<number>>(
	Array.from({ length: 10_000 }, (_, i) => [
		`key${i}`,
		i % 3 === 0 ? Maybe.none() : Maybe.some(i),
	]),
);
const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);

// =============================================================================
// lookup (hit)
// =============================================================================

describe("dict-lookup-100-hit", () => {
	bench("1. (current) Dict.lookup 100 (hit", () => {
		pipe(dict100, Dict.lookup("key50"));
	});
	bench("2. native map.get 100 (hit", () => {
		const v = dict100.get("key50");
		const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
		void result;
	});
});

describe("dict-lookup-10k-hit", () => {
	bench("1. (current) Dict.lookup 10k (hit", () => {
		pipe(dict10k, Dict.lookup("key5000"));
	});
	bench("2. native map.get 10k (hit", () => {
		const v = dict10k.get("key5000");
		const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
		void result;
	});
});

describe("dict-lookup-100-miss", () => {
	bench("1. (current) Dict.lookup 100 (miss", () => {
		pipe(dict100, Dict.lookup("missing"));
	});
	bench("2. native map.get 100 (miss", () => {
		const v = dict100.get("missing");
		const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
		void result;
	});
});

describe("dict-lookup-10k-miss", () => {
	bench("1. (current) Dict.lookup 10k (miss", () => {
		pipe(dict10k, Dict.lookup("missing"));
	});
	bench("2. native map.get 10k (miss", () => {
		const v = dict10k.get("missing");
		const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
		void result;
	});
});

describe("dict-map-100", () => {
	bench("1. (current) Dict.map 100", () => {
		pipe(dict100, Dict.map((n) => n * 2));
	});
	bench("2. native map spread 100", () => {
		void new globalThis.Map([...dict100].map(([k, v]) => [k, v * 2] as const));
	});
});

describe("dict-map-10k", () => {
	bench("1. (current) Dict.map 10k", () => {
		pipe(dict10k, Dict.map((n) => n * 2));
	});
	bench("2. native map spread 10k", () => {
		void new globalThis.Map([...dict10k].map(([k, v]) => [k, v * 2] as const));
	});
});

describe("dict-map-approaches-10k", () => {
	bench("1. (current) Dict.map for-of loop 10k", () => {
		const result = new globalThis.Map<string, number>();
		for (const [k, v] of dict10k) {
			result.set(k, v * 2);
		}
	});
	bench("2. spread + array map 10k", () => {
		void new globalThis.Map([...dict10k].map(([k, v]) => [k, v * 2] as const));
	});
	bench("3. forEach 10k", () => {
		const result = new globalThis.Map<string, number>();
		dict10k.forEach((v, k) => result.set(k, v * 2));
	});
});

describe("dict-filter-100", () => {
	bench("1. (current) Dict.filter 100", () => {
		pipe(dict100, Dict.filter((n) => n % 2 === 0));
	});
	bench("2. native filter loop 100", () => {
		const result = new globalThis.Map<string, number>();
		for (const [k, v] of dict100) {
			if (v % 2 === 0) result.set(k, v);
		}
	});
});

describe("dict-filter-10k", () => {
	bench("1. (current) Dict.filter 10k", () => {
		pipe(dict10k, Dict.filter((n) => n % 2 === 0));
	});
	bench("2. native filter loop 10k", () => {
		const result = new globalThis.Map<string, number>();
		for (const [k, v] of dict10k) {
			if (v % 2 === 0) result.set(k, v);
		}
	});
});

describe("dict-union-100", () => {
	bench("1. (current) Dict.union 100", () => {
		pipe(dictA100, Dict.union(dictB100));
	});
	bench("2. native spread union 100", () => {
		void new globalThis.Map([...dictA100, ...dictB100]);
	});
});

describe("dict-union-10k", () => {
	bench("1. (current) Dict.union 10k", () => {
		pipe(dictA10k, Dict.union(dictB10k));
	});
	bench("2. native spread union 10k", () => {
		void new globalThis.Map([...dictA10k, ...dictB10k]);
	});
});

describe("dict-intersection-100", () => {
	bench("1. (current) Dict.intersection 100", () => {
		pipe(dict100, Dict.intersection(dictA100));
	});
	bench("2. native intersection loop 100", () => {
		const result = new globalThis.Map<string, number>();
		for (const [k, v] of dict100) {
			if (dictA100.has(k)) result.set(k, v);
		}
	});
});

describe("dict-intersection-10k", () => {
	bench("1. (current) Dict.intersection 10k", () => {
		pipe(dict10k, Dict.intersection(dictA10k));
	});
	bench("2. native intersection loop 10k", () => {
		const result = new globalThis.Map<string, number>();
		for (const [k, v] of dict10k) {
			if (dictA10k.has(k)) result.set(k, v);
		}
	});
});

describe("dict-compact-100", () => {
	bench("1. (current) Dict.compact 100", () => {
		Dict.compact(optDict100);
	});
	bench("2. native compact loop 100", () => {
		const result = new globalThis.Map<string, number>();
		for (const [k, v] of optDict100) {
			if (v.kind === "Some") result.set(k, v.value);
		}
	});
});

describe("dict-compact-10k", () => {
	bench("1. (current) Dict.compact 10k", () => {
		Dict.compact(optDict10k);
	});
	bench("2. native compact loop 10k", () => {
		const result = new globalThis.Map<string, number>();
		for (const [k, v] of optDict10k) {
			if (v.kind === "Some") result.set(k, v.value);
		}
	});
});

describe("dict-reduce-100", () => {
	bench("1. (current) Dict.reduce 100 (sum", () => {
		Dict.reduce(0, (acc, v: number) => acc + v)(dict100);
	});
	bench("2. (current) Dict.reduceWithKey 100 (sum", () => {
		Dict.reduceWithKey(0, (acc, v: number) => acc + v)(dict100);
	});
	bench("3. native values() loop 100", () => {
		let _acc = 0;
		for (const v of dict100.values()) _acc += v;
	});
	bench("4. native entries() loop 100", () => {
		let _acc = 0;
		for (const [, v] of dict100) _acc += v;
	});
});

describe("dict-reduce-10k", () => {
	bench("1. (current) Dict.reduce 10k (sum", () => {
		Dict.reduce(0, (acc, v: number) => acc + v)(dict10k);
	});
	bench("2. (current) Dict.reduceWithKey 10k (sum", () => {
		Dict.reduceWithKey(0, (acc, v: number) => acc + v)(dict10k);
	});
	bench("3. native values() loop 10k", () => {
		let _acc = 0;
		for (const v of dict10k.values()) _acc += v;
	});
	bench("4. native entries() loop 10k", () => {
		let _acc = 0;
		for (const [, v] of dict10k) _acc += v;
	});
});

describe("dict-insert-100", () => {
	bench("1. (current) Dict.insert 100", () => {
		pipe(dict100, Dict.insert("newKey", 999));
	});
	bench("2. native insert clone 100", () => {
		const result = new globalThis.Map(dict100);
		result.set("newKey", 999);
	});
});

describe("dict-insert-10k", () => {
	bench("1. (current) Dict.insert 10k", () => {
		pipe(dict10k, Dict.insert("newKey", 999));
	});
	bench("2. native insert clone 10k", () => {
		const result = new globalThis.Map(dict10k);
		result.set("newKey", 999);
	});
});

describe("dict-groupBy-100", () => {
	bench("1. (current) Dict.groupBy 100", () => {
		pipe(data100, Dict.groupBy((n) => n % 10));
	});
	bench("2. native Map.groupBy 100", () => {
		globalThis.Map.groupBy(data100, (n) => n % 10);
	});
});

describe("dict-groupBy-10k", () => {
	bench("1. (current) Dict.groupBy 10k", () => {
		pipe(data10k, Dict.groupBy((n) => n % 10));
	});
	bench("2. native Map.groupBy 10k", () => {
		globalThis.Map.groupBy(data10k, (n) => n % 10);
	});
});

describe("dict-groupBy-approaches-10k", () => {
	bench("1. manual loop groupBy 10k", () => {
		const result = new globalThis.Map<number, number[]>();
		for (const n of data10k) {
			const key = n % 10;
			const arr = result.get(key);
			if (arr !== undefined) arr.push(n);
			else result.set(key, [n]);
		}
	});
	bench("2. native Map.groupBy 10k", () => {
		globalThis.Map.groupBy(data10k, (n) => n % 10);
	});
});

// =============================================================================
// varied fixtures (fast-check generated, non-sequential string keys)
// =============================================================================

describe("dict-lookup-varied-100-hit", () => {
	bench("1. (current) Dict.lookup varied 100 (hit", () => {
		pipe(variedDict100, Dict.lookup(variedEntries100[50][0]));
	});
	bench("2. native map.get varied 100 (hit", () => {
		const v = variedDict100.get(variedEntries100[50][0]);
		const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
		void result;
	});
});

describe("dict-lookup-varied-100-miss", () => {
	bench("1. (current) Dict.lookup varied 100 (miss", () => {
		pipe(variedDict100, Dict.lookup("__missing__"));
	});
	bench("2. native map.get varied 100 (miss", () => {
		const v = variedDict100.get("__missing__");
		const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
		void result;
	});
});

describe("dict-filter-varied-10k", () => {
	bench("1. (current) Dict.filter varied 10k", () => {
		pipe(variedDict10k, Dict.filter((n) => n % 2 === 0));
	});
	bench("2. native filter loop varied 10k", () => {
		const result = new globalThis.Map<string, number>();
		for (const [k, v] of variedDict10k) {
			if (v % 2 === 0) result.set(k, v);
		}
	});
});
