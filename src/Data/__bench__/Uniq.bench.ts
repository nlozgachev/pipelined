import { pipe } from "#composition";
import { Uniq } from "#data";
import * as fc from "fast-check";
import { test } from "vitest";

const pipeFn = pipe;
const uniqFromArray = Uniq.from.array;
const uniqHas = Uniq.has;
const uniqMap = Uniq.map;
const uniqFilter = Uniq.filter;
const uniqUnion = Uniq.union;
const uniqIntersection = Uniq.intersection;
const uniqDifference = Uniq.difference;
const uniqReduce = Uniq.reduce;
const uniqInsert = Uniq.insert;

const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);

// varied fixtures — generated once at module load, used across bench groups
const [variedData100] = fc.sample(fc.array(fc.integer({ min: 0, max: 200 }), { minLength: 100, maxLength: 100 }), 1);
const [variedData10k] = fc.sample(
	fc.array(fc.integer({ min: 0, max: 20_000 }), { minLength: 10_000, maxLength: 10_000 }),
	1,
);
const variedSet100 = uniqFromArray(variedData100);
const variedSet10k = uniqFromArray(variedData10k);

const set100 = uniqFromArray(data100);
const set10k = uniqFromArray(data10k);
const setA100 = uniqFromArray(Array.from({ length: 50 }, (_, i) => i));
const setB100 = uniqFromArray(Array.from({ length: 50 }, (_, i) => i + 25));
const setA10k = uniqFromArray(Array.from({ length: 5000 }, (_, i) => i));
const setB10k = uniqFromArray(Array.from({ length: 5000 }, (_, i) => i + 2500));

// =============================================================================
// from.array
// =============================================================================

test("uniq-from.array-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.from.array 100", () => {
			uniqFromArray(data100);
		}),
		bench("2. native new Set 100", () => {
			void new globalThis.Set(data100);
		}),
	);
});

test("uniq-from.array-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.from.array 10k", () => {
			uniqFromArray(data10k);
		}),
		bench("2. native new Set 10k", () => {
			void new globalThis.Set(data10k);
		}),
	);
});

test("uniq-has-100-hit", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.has 100 (present)", () => {
			pipeFn(set100, uniqHas(50));
		}),
		bench("2. native set.has 100 (present)", () => {
			set100.has(50);
		}),
	);
});

test("uniq-has-100-miss", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.has 100 (absent)", () => {
			pipeFn(set100, uniqHas(9999));
		}),
		bench("2. native set.has 100 (absent)", () => {
			set100.has(9999);
		}),
	);
});

test("uniq-has-10k-hit", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.has 10k (present)", () => {
			pipeFn(set10k, uniqHas(5000));
		}),
		bench("2. native set.has 10k (present)", () => {
			set10k.has(5000);
		}),
	);
});

test("uniq-has-10k-miss", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.has 10k (absent)", () => {
			pipeFn(set10k, uniqHas(99_999));
		}),
		bench("2. native set.has 10k (absent)", () => {
			set10k.has(99_999);
		}),
	);
});

test("uniq-map-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.map 100", () => {
			pipeFn(set100, uniqMap((n) => n * 2));
		}),
		bench("2. native map loop 100", () => {
			const result = new globalThis.Set<number>();
			for (const item of set100) { result.add(item * 2); }
		}),
	);
});

test("uniq-map-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.map 10k", () => {
			pipeFn(set10k, uniqMap((n) => n * 2));
		}),
		bench("2. native map loop 10k", () => {
			const result = new globalThis.Set<number>();
			for (const item of set10k) { result.add(item * 2); }
		}),
	);
});

test("uniq-filter-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.filter 100", () => {
			pipeFn(set100, uniqFilter((n) => n % 2 === 0));
		}),
		bench("2. native filter loop 100", () => {
			const result = new globalThis.Set<number>();
			for (const item of set100) { if (item % 2 === 0) { result.add(item); } }
		}),
	);
});

test("uniq-filter-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.filter 10k", () => {
			pipeFn(set10k, uniqFilter((n) => n % 2 === 0));
		}),
		bench("2. native filter loop 10k", () => {
			const result = new globalThis.Set<number>();
			for (const item of set10k) { if (item % 2 === 0) { result.add(item); } }
		}),
	);
});

test("uniq-union-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.union 100", () => {
			pipeFn(setA100, uniqUnion(setB100));
		}),
		bench("2. native union loop 100", () => {
			const result = new globalThis.Set(setA100);
			for (const item of setB100) { result.add(item); }
		}),
		bench("3. native set.union() 100", () => {
			(setA100 as Set<number>).union(setB100 as Set<number>);
		}),
	);
});

test("uniq-union-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.union 10k", () => {
			pipeFn(setA10k, uniqUnion(setB10k));
		}),
		bench("2. native union loop 10k", () => {
			const result = new globalThis.Set(setA10k);
			for (const item of setB10k) { result.add(item); }
		}),
		bench("3. native set.union() 10k", () => {
			(setA10k as Set<number>).union(setB10k as Set<number>);
		}),
	);
});

test("uniq-union-approaches-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. native set.union() 10k", () => {
			(setA10k as Set<number>).union(setB10k as Set<number>);
		}),
		bench("2. for-of add loop 10k", () => {
			const result = new globalThis.Set(setA10k);
			for (const item of setB10k) { result.add(item); }
		}),
		bench("3. spread union 10k", () => {
			void new globalThis.Set([...setA10k, ...setB10k]);
		}),
	);
});

test("uniq-intersection-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.intersection 100", () => {
			pipeFn(set100, uniqIntersection(setA100));
		}),
		bench("2. native intersection loop 100", () => {
			const result = new globalThis.Set<number>();
			for (const item of set100) { if (setA100.has(item)) { result.add(item); } }
		}),
		bench("3. native set.intersection() 100", () => {
			(set100 as Set<number>).intersection(setA100 as Set<number>);
		}),
	);
});

test("uniq-intersection-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.intersection 10k", () => {
			pipeFn(set10k, uniqIntersection(setA10k));
		}),
		bench("2. native intersection loop 10k", () => {
			const result = new globalThis.Set<number>();
			for (const item of set10k) { if (setA10k.has(item)) { result.add(item); } }
		}),
		bench("3. native set.intersection() 10k", () => {
			(set10k as Set<number>).intersection(setA10k as Set<number>);
		}),
	);
});

test("uniq-difference-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.difference 100", () => {
			pipeFn(set100, uniqDifference(setA100));
		}),
		bench("2. native difference loop 100", () => {
			const result = new globalThis.Set<number>();
			for (const item of set100) { if (!setA100.has(item)) { result.add(item); } }
		}),
		bench("3. native set.difference() 100", () => {
			(set100 as Set<number>).difference(setA100 as Set<number>);
		}),
	);
});

test("uniq-difference-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.difference 10k", () => {
			pipeFn(set10k, uniqDifference(setA10k));
		}),
		bench("2. native difference loop 10k", () => {
			const result = new globalThis.Set<number>();
			for (const item of set10k) { if (!setA10k.has(item)) { result.add(item); } }
		}),
		bench("3. native set.difference() 10k", () => {
			(set10k as Set<number>).difference(setA10k as Set<number>);
		}),
	);
});

test("uniq-reduce-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.reduce 100 (sum)", () => {
			uniqReduce(0, (acc, n: number) => acc + n)(set100);
		}),
		bench("2. native reduce loop 100", () => {
			let acc = 0;
			for (const item of set100) { acc += item; }
		}),
	);
});

test("uniq-reduce-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.reduce 10k (sum)", () => {
			uniqReduce(0, (acc, n: number) => acc + n)(set10k);
		}),
		bench("2. native reduce loop 10k", () => {
			let acc = 0;
			for (const item of set10k) { acc += item; }
		}),
	);
});

test("uniq-insert-100-new", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.insert 100 (new item)", () => {
			pipeFn(set100, uniqInsert(9999));
		}),
		bench("2. native insert clone 100", () => {
			const result = new globalThis.Set(set100);
			result.add(9999);
		}),
	);
});

test("uniq-insert-10k-new", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.insert 10k (new item)", () => {
			pipeFn(set10k, uniqInsert(99_999));
		}),
		bench("2. native insert clone 10k", () => {
			const result = new globalThis.Set(set10k);
			result.add(99_999);
		}),
	);
});

test("uniq-insert-10k-existing", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.insert 10k (existing — no copy)", () => {
			pipeFn(set10k, uniqInsert(500));
		}),
		bench("2. native insert existing 10k", () => {
			const result = new globalThis.Set(set10k);
			result.add(500);
		}),
	);
});

// =============================================================================
// varied fixtures (fast-check generated, non-sequential with duplicates)
// =============================================================================

test("uniq-from.array-varied-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.from.array varied 100", () => {
			uniqFromArray(variedData100);
		}),
		bench("2. native new Set varied 100", () => {
			void new globalThis.Set(variedData100);
		}),
	);
});

test("uniq-has-varied-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.has varied 100 (present)", () => {
			pipeFn(variedSet100, uniqHas(variedData100[50]));
		}),
		bench("2. native set.has varied 100 (present)", () => {
			variedSet100.has(variedData100[50]);
		}),
	);
});

test("uniq-has-varied-100-miss", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.has varied 100 (absent)", () => {
			pipeFn(variedSet100, uniqHas(9999));
		}),
		bench("2. native set.has varied 100 (absent)", () => {
			variedSet100.has(9999);
		}),
	);
});

test("uniq-from.array-varied-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.from.array varied 10k", () => {
			uniqFromArray(variedData10k);
		}),
		bench("2. native new Set varied 10k", () => {
			void new globalThis.Set(variedData10k);
		}),
	);
});

test("uniq-filter-varied-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.filter varied 10k", () => {
			pipeFn(variedSet10k, uniqFilter((n) => n % 2 === 0));
		}),
		bench("2. native filter loop varied 10k", () => {
			const result = new globalThis.Set<number>();
			for (const item of variedSet10k) { if (item % 2 === 0) { result.add(item); } }
		}),
	);
});

test("uniq-map-varied-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Uniq.map varied 10k", () => {
			pipeFn(variedSet10k, uniqMap((n) => n * 2));
		}),
		bench("2. native map loop varied 10k", () => {
			const result = new globalThis.Set<number>();
			for (const item of variedSet10k) { result.add(item * 2); }
		}),
	);
});
