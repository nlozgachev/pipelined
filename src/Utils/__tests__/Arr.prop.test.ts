import { Maybe } from "#core/Maybe.ts";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Arr } from "../Arr.ts";

// ---------------------------------------------------------------------------
// reverse
// ---------------------------------------------------------------------------

test("Arr.reverse — involution", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), (xs) => {
			expect(Arr.reverse(Arr.reverse(xs))).toEqual(xs);
		}),
	);
});

// ---------------------------------------------------------------------------
// take / drop
// ---------------------------------------------------------------------------

test("Arr.take + Arr.drop — partition round-trip", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), fc.integer({ min: 0 }), (xs, n) => {
			expect([...Arr.take(n)(xs), ...Arr.drop(n)(xs)]).toEqual(xs);
		}),
	);
});

// ---------------------------------------------------------------------------
// uniq
// ---------------------------------------------------------------------------

test("Arr.uniq — idempotence", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), (xs) => {
			expect(Arr.uniq(Arr.uniq(xs))).toEqual(Arr.uniq(xs));
		}),
	);
});

test("Arr.uniq — no duplicates", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), (xs) => {
			const result = Arr.uniq(xs);
			expect(result).toHaveLength(new Set(result).size);
		}),
	);
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("Arr.filter — all results satisfy predicate", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), fc.integer(), (xs, threshold) => {
			const p = (x: number) => x > threshold;
			expect(Arr.filter(p)(xs).every(p)).toBe(true);
		}),
	);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Arr.map — functor identity", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), (xs) => {
			expect(Arr.map((x) => x)(xs)).toEqual(xs);
		}),
	);
});

test("Arr.map — functor composition", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), fc.integer(), fc.integer(), (xs, a, b) => {
			const f = (x: number) => x + a;
			const g = (x: number) => x * b;
			expect(Arr.map(f)(Arr.map(g)(xs))).toEqual(Arr.map((x: number) => f(g(x)))(xs));
		}),
	);
});

// ---------------------------------------------------------------------------
// chunksOf / flatten
// ---------------------------------------------------------------------------

test("Arr.chunksOf + Arr.flatten — round-trip", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), fc.integer({ min: 1 }), (xs, n) => {
			expect(Arr.flatten(Arr.chunksOf(n)(xs))).toEqual(xs);
		}),
	);
});

// ---------------------------------------------------------------------------
// sortBy
// ---------------------------------------------------------------------------

test("Arr.sortBy — idempotence", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), (xs) => {
			const cmp = (a: number, b: number) => a - b;
			expect(Arr.sortBy(cmp)(Arr.sortBy(cmp)(xs))).toEqual(Arr.sortBy(cmp)(xs));
		}),
	);
});

// ---------------------------------------------------------------------------
// splitAt
// ---------------------------------------------------------------------------

test("Arr.splitAt — round-trip", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), fc.integer(), (xs, n) => {
			const [before, after] = Arr.splitAt(n)(xs);
			expect([...before, ...after]).toEqual(xs);
		}),
	);
});

// ---------------------------------------------------------------------------
// zip
// ---------------------------------------------------------------------------

test("Arr.zip — length is min of both arrays", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), fc.array(fc.integer()), (xs, ys) => {
			expect(Arr.zip(ys)(xs)).toHaveLength(Math.min(xs.length, ys.length));
		}),
	);
});

// ---------------------------------------------------------------------------
// size
// ---------------------------------------------------------------------------

test("Arr.size — matches native length", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), (xs) => {
			expect(Arr.size(xs)).toBe(xs.length);
		}),
	);
});

// ---------------------------------------------------------------------------
// head
// ---------------------------------------------------------------------------

test("Arr.head — empty array returns None", () => {
	expect(Arr.head([])).toEqual(Maybe.none());
});

test("Arr.head — non-empty array returns Some(first element)", () => {
	fc.assert(
		fc.property(fc.array(fc.integer(), { minLength: 1 }), (xs) => {
			expect(Arr.head(xs)).toEqual(Maybe.some(xs[0]));
		}),
	);
});

// ---------------------------------------------------------------------------
// every / some
// ---------------------------------------------------------------------------

test("Arr.every implies Arr.some", () => {
	fc.assert(
		fc.property(fc.array(fc.integer(), { minLength: 1 }), fc.integer(), (xs, threshold) => {
			const p = (x: number) => x > threshold;
			expect(!Arr.every(p)(xs) || Arr.some(p)(xs)).toBe(true);
		}),
	);
});

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

test("Arr.reduce — matches native reduce", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), fc.integer(), (xs, init) => {
			const f = (acc: number, a: number) => acc + a;
			expect(Arr.reduce(init, f)(xs)).toBe(xs.reduce(f, init));
		}),
	);
});

// ---------------------------------------------------------------------------
// intersperse
// ---------------------------------------------------------------------------

test("Arr.intersperse — length formula for arrays with 2+ elements", () => {
	fc.assert(
		fc.property(fc.array(fc.integer(), { minLength: 2 }), fc.integer(), (xs, sep) => {
			expect(Arr.intersperse(sep)(xs)).toHaveLength(xs.length * 2 - 1);
		}),
	);
});

// ---------------------------------------------------------------------------
// partition
// ---------------------------------------------------------------------------

test("Arr.partition — completeness", () => {
	fc.assert(
		fc.property(fc.array(fc.integer()), fc.integer(), (xs, threshold) => {
			const p = (x: number) => x > threshold;
			const [pass, fail] = Arr.partition(p)(xs);
			const combined = [...pass, ...fail].sort((a, b) => a - b);
			const original = [...xs].sort((a, b) => a - b);
			expect(combined).toEqual(original);
		}),
	);
});
