import { pipe } from "#composition/pipe.ts";
import { bench, describe } from "vitest";
import { Uniq } from "../Uniq.ts";

const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);

const set100 = Uniq.fromArray(data100);
const set10k = Uniq.fromArray(data10k);
const setA100 = Uniq.fromArray(Array.from({ length: 50 }, (_, i) => i));
const setB100 = Uniq.fromArray(Array.from({ length: 50 }, (_, i) => i + 25));
const setA10k = Uniq.fromArray(Array.from({ length: 5_000 }, (_, i) => i));
const setB10k = Uniq.fromArray(Array.from({ length: 5_000 }, (_, i) => i + 2_500));

// =============================================================================
// fromArray
// =============================================================================

describe("uniq-fromArray-100", () => {
	bench("Uniq.fromArray 100", () => {
		Uniq.fromArray(data100);
	});
	bench("native new Set 100", () => {
		void new globalThis.Set(data100);
	});
});

describe("uniq-fromArray-10k", () => {
	bench("Uniq.fromArray 10k", () => {
		Uniq.fromArray(data10k);
	});
	bench("native new Set 10k", () => {
		void new globalThis.Set(data10k);
	});
});

describe("uniq-has-100-hit", () => {
	bench("Uniq.has 100 (present)", () => {
		pipe(set100, Uniq.has(50));
	});
	bench("native set.has 100 (present)", () => {
		set100.has(50);
	});
});

describe("uniq-has-100-miss", () => {
	bench("Uniq.has 100 (absent)", () => {
		pipe(set100, Uniq.has(9999));
	});
	bench("native set.has 100 (absent)", () => {
		set100.has(9999);
	});
});

describe("uniq-has-10k-hit", () => {
	bench("Uniq.has 10k (present)", () => {
		pipe(set10k, Uniq.has(5000));
	});
	bench("native set.has 10k (present)", () => {
		set10k.has(5000);
	});
});

describe("uniq-has-10k-miss", () => {
	bench("Uniq.has 10k (absent)", () => {
		pipe(set10k, Uniq.has(99999));
	});
	bench("native set.has 10k (absent)", () => {
		set10k.has(99999);
	});
});

describe("uniq-map-100", () => {
	bench("Uniq.map 100", () => {
		pipe(set100, Uniq.map((n) => n * 2));
	});
	bench("native map loop 100", () => {
		const result = new globalThis.Set<number>();
		for (const item of set100) result.add(item * 2);
	});
});

describe("uniq-map-10k", () => {
	bench("Uniq.map 10k", () => {
		pipe(set10k, Uniq.map((n) => n * 2));
	});
	bench("native map loop 10k", () => {
		const result = new globalThis.Set<number>();
		for (const item of set10k) result.add(item * 2);
	});
});

describe("uniq-filter-100", () => {
	bench("Uniq.filter 100", () => {
		pipe(set100, Uniq.filter((n) => n % 2 === 0));
	});
	bench("native filter loop 100", () => {
		const result = new globalThis.Set<number>();
		for (const item of set100) if (item % 2 === 0) result.add(item);
	});
});

describe("uniq-filter-10k", () => {
	bench("Uniq.filter 10k", () => {
		pipe(set10k, Uniq.filter((n) => n % 2 === 0));
	});
	bench("native filter loop 10k", () => {
		const result = new globalThis.Set<number>();
		for (const item of set10k) if (item % 2 === 0) result.add(item);
	});
});

describe("uniq-union-100", () => {
	bench("Uniq.union 100", () => {
		pipe(setA100, Uniq.union(setB100));
	});
	bench("native union loop 100", () => {
		const result = new globalThis.Set(setA100);
		for (const item of setB100) result.add(item);
	});
	bench("native set.union() 100", () => {
		(setA100 as Set<number>).union(setB100 as Set<number>);
	});
});

describe("uniq-union-10k", () => {
	bench("Uniq.union 10k", () => {
		pipe(setA10k, Uniq.union(setB10k));
	});
	bench("native union loop 10k", () => {
		const result = new globalThis.Set(setA10k);
		for (const item of setB10k) result.add(item);
	});
	bench("native set.union() 10k", () => {
		(setA10k as Set<number>).union(setB10k as Set<number>);
	});
});

describe("uniq-union-approaches-10k", () => {
	bench("[impl] native set.union() 10k", () => {
		(setA10k as Set<number>).union(setB10k as Set<number>);
	});
	bench("for-of add loop 10k", () => {
		const result = new globalThis.Set(setA10k);
		for (const item of setB10k) result.add(item);
	});
	bench("spread union 10k", () => {
		void new globalThis.Set([...setA10k, ...setB10k]);
	});
});

describe("uniq-intersection-100", () => {
	bench("Uniq.intersection 100", () => {
		pipe(set100, Uniq.intersection(setA100));
	});
	bench("native intersection loop 100", () => {
		const result = new globalThis.Set<number>();
		for (const item of set100) if (setA100.has(item)) result.add(item);
	});
	bench("native set.intersection() 100", () => {
		(set100 as Set<number>).intersection(setA100 as Set<number>);
	});
});

describe("uniq-intersection-10k", () => {
	bench("Uniq.intersection 10k", () => {
		pipe(set10k, Uniq.intersection(setA10k));
	});
	bench("native intersection loop 10k", () => {
		const result = new globalThis.Set<number>();
		for (const item of set10k) if (setA10k.has(item)) result.add(item);
	});
	bench("native set.intersection() 10k", () => {
		(set10k as Set<number>).intersection(setA10k as Set<number>);
	});
});

describe("uniq-difference-100", () => {
	bench("Uniq.difference 100", () => {
		pipe(set100, Uniq.difference(setA100));
	});
	bench("native difference loop 100", () => {
		const result = new globalThis.Set<number>();
		for (const item of set100) if (!setA100.has(item)) result.add(item);
	});
	bench("native set.difference() 100", () => {
		(set100 as Set<number>).difference(setA100 as Set<number>);
	});
});

describe("uniq-difference-10k", () => {
	bench("Uniq.difference 10k", () => {
		pipe(set10k, Uniq.difference(setA10k));
	});
	bench("native difference loop 10k", () => {
		const result = new globalThis.Set<number>();
		for (const item of set10k) if (!setA10k.has(item)) result.add(item);
	});
	bench("native set.difference() 10k", () => {
		(set10k as Set<number>).difference(setA10k as Set<number>);
	});
});

describe("uniq-reduce-100", () => {
	bench("Uniq.reduce 100 (sum)", () => {
		Uniq.reduce(0, (acc, n: number) => acc + n)(set100);
	});
	bench("native reduce loop 100", () => {
		let _acc = 0;
		for (const item of set100) _acc += item;
	});
});

describe("uniq-reduce-10k", () => {
	bench("Uniq.reduce 10k (sum)", () => {
		Uniq.reduce(0, (acc, n: number) => acc + n)(set10k);
	});
	bench("native reduce loop 10k", () => {
		let _acc = 0;
		for (const item of set10k) _acc += item;
	});
});

describe("uniq-insert-100-new", () => {
	bench("Uniq.insert 100 (new item)", () => {
		pipe(set100, Uniq.insert(9999));
	});
	bench("native insert clone 100", () => {
		const result = new globalThis.Set(set100);
		result.add(9999);
	});
});

describe("uniq-insert-10k-new", () => {
	bench("Uniq.insert 10k (new item)", () => {
		pipe(set10k, Uniq.insert(99999));
	});
	bench("native insert clone 10k", () => {
		const result = new globalThis.Set(set10k);
		result.add(99999);
	});
});

describe("uniq-insert-10k-existing", () => {
	bench("Uniq.insert 10k (existing — no copy)", () => {
		pipe(set10k, Uniq.insert(500));
	});
	bench("native insert existing 10k", () => {
		const result = new globalThis.Set(set10k);
		result.add(500);
	});
});
