import fc from "fast-check";
import { expect, test } from "vitest";
import { Maybe } from "../../Core/Maybe.ts";
import { Arr } from "../Arr.ts";

// ---------------------------------------------------------------------------
// reverse
// ---------------------------------------------------------------------------

test("reverse: involution", () => {
	fc.assert(fc.property(fc.array(fc.integer()), (xs) => {
		expect(Arr.reverse(Arr.reverse(xs))).toStrictEqual(xs);
	}));
});

// ---------------------------------------------------------------------------
// take / drop
// ---------------------------------------------------------------------------

test("take: round-trips with drop", () => {
	fc.assert(fc.property(fc.array(fc.integer()), fc.integer({ min: 0 }), (xs, n) => {
		expect([...Arr.take(n)(xs), ...Arr.drop(n)(xs)]).toStrictEqual(xs);
	}));
});

// ---------------------------------------------------------------------------
// uniq
// ---------------------------------------------------------------------------

test("uniq: is idempotent", () => {
	fc.assert(fc.property(fc.array(fc.integer()), (xs) => {
		expect(Arr.uniq(Arr.uniq(xs))).toStrictEqual(Arr.uniq(xs));
	}));
});

test("uniq: contains no duplicate elements", () => {
	fc.assert(fc.property(fc.array(fc.integer()), (xs) => {
		const result = Arr.uniq(xs);
		expect(result).toHaveLength(new Set(result).size);
	}));
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("filter: all results satisfy predicate", () => {
	fc.assert(fc.property(fc.array(fc.integer()), fc.integer(), (xs, threshold) => {
		const p = (x: number) => x > threshold;
		expect(Arr.filter(p)(xs).every(p)).toBe(true);
	}));
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: preserves identity", () => {
	fc.assert(fc.property(fc.array(fc.integer()), (xs) => {
		expect(Arr.map((x) => x)(xs)).toStrictEqual(xs);
	}));
});

test("map: preserves composition", () => {
	fc.assert(fc.property(fc.array(fc.integer()), fc.integer(), fc.integer(), (xs, a, b) => {
		const f = (x: number) => x + a;
		const g = (x: number) => x * b;
		expect(Arr.map(f)(Arr.map(g)(xs))).toStrictEqual(Arr.map((x: number) => f(g(x)))(xs));
	}));
});

// ---------------------------------------------------------------------------
// chunksOf / flatten
// ---------------------------------------------------------------------------

test("chunksOf: round-trips with flatten", () => {
	fc.assert(fc.property(fc.array(fc.integer()), fc.integer({ min: 1 }), (xs, n) => {
		expect(Arr.flatten(Arr.chunksOf(n)(xs))).toStrictEqual(xs);
	}));
});

// ---------------------------------------------------------------------------
// sortBy
// ---------------------------------------------------------------------------

test("sortBy: is idempotent", () => {
	fc.assert(fc.property(fc.array(fc.integer()), (xs) => {
		const cmp = (a: number, b: number) => a - b;
		expect(Arr.sortBy(cmp)(Arr.sortBy(cmp)(xs))).toStrictEqual(Arr.sortBy(cmp)(xs));
	}));
});

// ---------------------------------------------------------------------------
// splitAt
// ---------------------------------------------------------------------------

test("splitAt: round-trips to reconstruct array", () => {
	fc.assert(fc.property(fc.array(fc.integer()), fc.integer(), (xs, n) => {
		const [before, after] = Arr.splitAt(n)(xs);
		expect([...before, ...after]).toStrictEqual(xs);
	}));
});

// ---------------------------------------------------------------------------
// zip
// ---------------------------------------------------------------------------

test("zip: length is min of both arrays", () => {
	fc.assert(fc.property(fc.array(fc.integer()), fc.array(fc.integer()), (xs, ys) => {
		expect(Arr.zip(ys)(xs)).toHaveLength(Math.min(xs.length, ys.length));
	}));
});

// ---------------------------------------------------------------------------
// size
// ---------------------------------------------------------------------------

test("size: matches native length", () => {
	fc.assert(fc.property(fc.array(fc.integer()), (xs) => {
		expect(Arr.size(xs)).toBe(xs.length);
	}));
});

// ---------------------------------------------------------------------------
// head
// ---------------------------------------------------------------------------

test("head: returns None for empty array", () => {
	expect(Arr.head([])).toStrictEqual(Maybe.make.none());
});

test("head: returns Some of first element for non-empty array", () => {
	fc.assert(fc.property(fc.array(fc.integer(), { minLength: 1 }), (xs) => {
		expect(Arr.head(xs)).toStrictEqual(Maybe.make.some(xs[0]));
	}));
});

// ---------------------------------------------------------------------------
// every / some
// ---------------------------------------------------------------------------

test("every: implies some for non-empty array", () => {
	fc.assert(fc.property(fc.array(fc.integer(), { minLength: 1 }), fc.integer(), (xs, threshold) => {
		const p = (x: number) => x > threshold;
		expect(!Arr.every(p)(xs) || Arr.some(p)(xs)).toBe(true);
	}));
});

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

test("reduce: matches native reduce", () => {
	fc.assert(fc.property(fc.array(fc.integer()), fc.integer(), (xs, init) => {
		const f = (acc: number, a: number) => acc + a;
		expect(Arr.reduce(init, f)(xs)).toBe(xs.reduce(f, init));
	}));
});

// ---------------------------------------------------------------------------
// intersperse
// ---------------------------------------------------------------------------

test("intersperse: produces expected length for arrays with multiple elements", () => {
	fc.assert(fc.property(fc.array(fc.integer(), { minLength: 2 }), fc.integer(), (xs, sep) => {
		expect(Arr.intersperse(sep)(xs)).toHaveLength(xs.length * 2 - 1);
	}));
});

// ---------------------------------------------------------------------------
// partition
// ---------------------------------------------------------------------------

test("partition: preserves all elements across partitions", () => {
	fc.assert(fc.property(fc.array(fc.integer()), fc.integer(), (xs, threshold) => {
		const p = (x: number) => x > threshold;
		const [pass, fail] = Arr.partition(p)(xs);
		const combined = [...pass, ...fail].toSorted((a, b) => a - b);
		const original = [...xs].toSorted((a, b) => a - b);
		expect(combined).toStrictEqual(original);
	}));
});
