import { pipe } from "#composition";
import { Maybe } from "#core";
import { Dict } from "#data";
import * as fc from "fast-check";
import { test } from "vitest";

const pipeFn = pipe;
const dictFromEntries = Dict.from.entries;
const dictLookup = Dict.lookup;
const dictMap = Dict.map;
const dictFilter = Dict.filter;
const dictUnion = Dict.union;
const dictIntersection = Dict.intersection;
const dictCompact = Dict.compact;
const dictReduce = Dict.reduce;
const dictReduceWithKey = Dict.reduceWithKey;
const dictInsert = Dict.insert;
const dictGroupBy = Dict.groupBy;

const makeDict = (n: number): ReadonlyMap<string, number> =>
	dictFromEntries(Array.from({ length: n }, (_, i) => [`key${i}`, i]));

// varied fixtures — generated once at module load, non-sequential keys and values
const [variedEntries100] = fc.sample(
	fc.array(fc.tuple(fc.string({ minLength: 1, maxLength: 10 }), fc.integer()), { minLength: 100, maxLength: 100 }),
	1,
) as [[string, number][]];
const [variedEntries10k] = fc.sample(
	fc.array(fc.tuple(fc.string({ minLength: 1, maxLength: 10 }), fc.integer()), { minLength: 10_000, maxLength: 10_000 }),
	1,
) as [[string, number][]];
const variedDict100 = dictFromEntries(variedEntries100);
const variedDict10k = dictFromEntries(variedEntries10k);

const dict100 = makeDict(100);
const dict10k = makeDict(10_000);
const dictA100 = makeDict(50);
const dictB100 = dictFromEntries(Array.from({ length: 50 }, (_, i) => [`key${i + 25}`, i + 1000]));
const dictA10k = makeDict(5000);
const dictB10k = dictFromEntries(Array.from({ length: 5000 }, (_, i) => [`key${i + 2500}`, i + 10_000]));
const optDict100 = dictFromEntries<string, Maybe<number>>(
	Array.from({ length: 100 }, (_, i) => [`key${i}`, i % 3 === 0 ? Maybe.make.none() : Maybe.make.some(i)]),
);
const optDict10k = dictFromEntries<string, Maybe<number>>(
	Array.from({ length: 10_000 }, (_, i) => [`key${i}`, i % 3 === 0 ? Maybe.make.none() : Maybe.make.some(i)]),
);
const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);

// =============================================================================
// lookup (hit)
// =============================================================================

test("dict-lookup-100-hit", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.lookup 100 (hit)", () => {
			pipeFn(dict100, dictLookup("key50"));
		}),
		bench("2. native map.get 100 (hit)", () => {
			const v = dict100.get("key50");
			const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
			void result;
		}),
	);
});

test("dict-lookup-10k-hit", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.lookup 10k (hit)", () => {
			pipeFn(dict10k, dictLookup("key5000"));
		}),
		bench("2. native map.get 10k (hit)", () => {
			const v = dict10k.get("key5000");
			const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
			void result;
		}),
	);
});

test("dict-lookup-100-miss", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.lookup 100 (miss)", () => {
			pipeFn(dict100, dictLookup("missing"));
		}),
		bench("2. native map.get 100 (miss)", () => {
			const v = dict100.get("missing");
			const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
			void result;
		}),
	);
});

test("dict-lookup-10k-miss", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.lookup 10k (miss)", () => {
			pipeFn(dict10k, dictLookup("missing"));
		}),
		bench("2. native map.get 10k (miss)", () => {
			const v = dict10k.get("missing");
			const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
			void result;
		}),
	);
});

test("dict-map-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.map 100", () => {
			pipeFn(dict100, dictMap((n) => n * 2));
		}),
		bench("2. native map spread 100", () => {
			void new globalThis.Map([...dict100].map(([k, v]) => [k, v * 2] as const));
		}),
	);
});

test("dict-map-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.map 10k", () => {
			pipeFn(dict10k, dictMap((n) => n * 2));
		}),
		bench("2. native map spread 10k", () => {
			void new globalThis.Map([...dict10k].map(([k, v]) => [k, v * 2] as const));
		}),
	);
});

test("dict-map-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.map for-of loop 10k", () => {
			const result = new globalThis.Map<string, number>();
			for (const [k, v] of dict10k) {
				result.set(k, v * 2);
			}
		}),
		bench("2. spread + array map 10k", () => {
			void new globalThis.Map([...dict10k].map(([k, v]) => [k, v * 2] as const));
		}),
		bench("3. forEach 10k", () => {
			const result = new globalThis.Map<string, number>();
			dict10k.forEach((v, k) => result.set(k, v * 2));
		}),
	);
});

test("dict-filter-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.filter 100", () => {
			pipeFn(dict100, dictFilter((n) => n % 2 === 0));
		}),
		bench("2. native filter loop 100", () => {
			const result = new globalThis.Map<string, number>();
			for (const [k, v] of dict100) {
				if (v % 2 === 0) { result.set(k, v); }
			}
		}),
	);
});

test("dict-filter-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.filter 10k", () => {
			pipeFn(dict10k, dictFilter((n) => n % 2 === 0));
		}),
		bench("2. native filter loop 10k", () => {
			const result = new globalThis.Map<string, number>();
			for (const [k, v] of dict10k) {
				if (v % 2 === 0) { result.set(k, v); }
			}
		}),
	);
});

test("dict-union-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.union 100", () => {
			pipeFn(dictA100, dictUnion(dictB100));
		}),
		bench("2. native spread union 100", () => {
			void new globalThis.Map([...dictA100, ...dictB100]);
		}),
	);
});

test("dict-union-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.union 10k", () => {
			pipeFn(dictA10k, dictUnion(dictB10k));
		}),
		bench("2. native spread union 10k", () => {
			void new globalThis.Map([...dictA10k, ...dictB10k]);
		}),
	);
});

test("dict-intersection-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.intersection 100", () => {
			pipeFn(dict100, dictIntersection(dictA100));
		}),
		bench("2. native intersection loop 100", () => {
			const result = new globalThis.Map<string, number>();
			for (const [k, v] of dict100) {
				if (dictA100.has(k)) { result.set(k, v); }
			}
		}),
	);
});

test("dict-intersection-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.intersection 10k", () => {
			pipeFn(dict10k, dictIntersection(dictA10k));
		}),
		bench("2. native intersection loop 10k", () => {
			const result = new globalThis.Map<string, number>();
			for (const [k, v] of dict10k) {
				if (dictA10k.has(k)) { result.set(k, v); }
			}
		}),
	);
});

test("dict-compact-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.compact 100", () => {
			dictCompact(optDict100);
		}),
		bench("2. native compact loop 100", () => {
			const result = new globalThis.Map<string, number>();
			for (const [k, v] of optDict100) {
				if (v.kind === "Some") { result.set(k, v.value); }
			}
		}),
	);
});

test("dict-compact-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.compact 10k", () => {
			dictCompact(optDict10k);
		}),
		bench("2. native compact loop 10k", () => {
			const result = new globalThis.Map<string, number>();
			for (const [k, v] of optDict10k) {
				if (v.kind === "Some") { result.set(k, v.value); }
			}
		}),
	);
});

test("dict-reduce-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.reduce 100 (sum)", () => {
			dictReduce(0, (acc, v: number) => acc + v)(dict100);
		}),
		bench("2. (current) Dict.reduceWithKey 100 (sum)", () => {
			dictReduceWithKey(0, (acc, v: number) => acc + v)(dict100);
		}),
		bench("3. native values() loop 100", () => {
			let acc = 0;
			for (const v of dict100.values()) { acc += v; }
		}),
		bench("4. native entries() loop 100", () => {
			let acc = 0;
			for (const [, v] of dict100) { acc += v; }
		}),
	);
});

test("dict-reduce-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.reduce 10k (sum)", () => {
			dictReduce(0, (acc, v: number) => acc + v)(dict10k);
		}),
		bench("2. (current) Dict.reduceWithKey 10k (sum)", () => {
			dictReduceWithKey(0, (acc, v: number) => acc + v)(dict10k);
		}),
		bench("3. native values() loop 10k", () => {
			let acc = 0;
			for (const v of dict10k.values()) { acc += v; }
		}),
		bench("4. native entries() loop 10k", () => {
			let acc = 0;
			for (const [, v] of dict10k) { acc += v; }
		}),
	);
});

test("dict-insert-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.insert 100", () => {
			pipeFn(dict100, dictInsert("newKey", 999));
		}),
		bench("2. native insert clone 100", () => {
			const result = new globalThis.Map(dict100);
			result.set("newKey", 999);
		}),
	);
});

test("dict-insert-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.insert 10k", () => {
			pipeFn(dict10k, dictInsert("newKey", 999));
		}),
		bench("2. native insert clone 10k", () => {
			const result = new globalThis.Map(dict10k);
			result.set("newKey", 999);
		}),
	);
});

test("dict-groupBy-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.groupBy 100", () => {
			pipeFn(data100, dictGroupBy((n) => n % 10));
		}),
		bench("2. native Map.groupBy 100", () => {
			globalThis.Map.groupBy(data100, (n) => n % 10);
		}),
	);
});

test("dict-groupBy-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.groupBy 10k", () => {
			pipeFn(data10k, dictGroupBy((n) => n % 10));
		}),
		bench("2. native Map.groupBy 10k", () => {
			globalThis.Map.groupBy(data10k, (n) => n % 10);
		}),
	);
});

test("dict-groupBy-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. manual loop groupBy 10k", () => {
			const result = new globalThis.Map<number, number[]>();
			for (const n of data10k) {
				const key = n % 10;
				const arr = result.get(key);
				if (arr !== undefined) { arr.push(n); }
				else { result.set(key, [n]); }
			}
		}),
		bench("2. native Map.groupBy 10k", () => {
			globalThis.Map.groupBy(data10k, (n) => n % 10);
		}),
	);
});

// =============================================================================
// varied fixtures (fast-check generated, non-sequential string keys)
// =============================================================================

test("dict-lookup-varied-100-hit", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.lookup varied 100 (hit)", () => {
			pipeFn(variedDict100, dictLookup(variedEntries100[50][0]));
		}),
		bench("2. native map.get varied 100 (hit)", () => {
			const v = variedDict100.get(variedEntries100[50][0]);
			const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
			void result;
		}),
	);
});

test("dict-lookup-varied-100-miss", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.lookup varied 100 (miss)", () => {
			pipeFn(variedDict100, dictLookup("__missing__"));
		}),
		bench("2. native map.get varied 100 (miss)", () => {
			const v = variedDict100.get("__missing__");
			const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
			void result;
		}),
	);
});

test("dict-filter-varied-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Dict.filter varied 10k", () => {
			pipeFn(variedDict10k, dictFilter((n) => n % 2 === 0));
		}),
		bench("2. native filter loop varied 10k", () => {
			const result = new globalThis.Map<string, number>();
			for (const [k, v] of variedDict10k) {
				if (v % 2 === 0) { result.set(k, v); }
			}
		}),
	);
});
