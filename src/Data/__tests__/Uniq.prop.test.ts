import fc from "fast-check";
import { expect, test } from "vitest";
import { Uniq } from "../Uniq.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbUniq = fc.array(fc.integer(), { maxLength: 10 }).map(Uniq.from.array);

// ---------------------------------------------------------------------------
// from.array / to.array — round-trip
// ---------------------------------------------------------------------------

test("from.array: contains same unique elements as to.array", () => {
	fc.assert(fc.property(fc.array(fc.integer()), (arr) => {
		const s = Uniq.from.array(arr);
		const unique = [...new Set(arr)].toSorted((a, b) => a - b);
		expect([...Uniq.to.array(s)].toSorted((a, b) => a - b)).toStrictEqual(unique);
	}));
});

test("from.array: satisfies idempotence on unique input", () => {
	fc.assert(fc.property(arbUniq, (s) => {
		expect(Uniq.from.array(Uniq.to.array(s))).toStrictEqual(s);
	}));
});

// ---------------------------------------------------------------------------
// size / isEmpty
// ---------------------------------------------------------------------------

test("size: agrees with to.array length", () => {
	fc.assert(fc.property(arbUniq, (s) => {
		expect(Uniq.size(s)).toBe(Uniq.to.array(s).length);
	}));
});

test("is.empty: returns true if and only if size is zero", () => {
	fc.assert(fc.property(arbUniq, (s) => {
		expect(Uniq.is.empty(s)).toBe(Uniq.size(s) === 0);
	}));
});

// ---------------------------------------------------------------------------
// map — functor laws
// ---------------------------------------------------------------------------

test("map: satisfies identity functor law", () => {
	fc.assert(fc.property(arbUniq, (s) => {
		expect(Uniq.map((x: number) => x)(s)).toStrictEqual(s);
	}));
});

// ---------------------------------------------------------------------------
// insert / has
// ---------------------------------------------------------------------------

test("insert: ensures inserted item is found via has", () => {
	fc.assert(fc.property(arbUniq, fc.integer(), (s, item) => {
		expect(Uniq.has(item)(Uniq.insert(item)(s))).toBe(true);
	}));
});

test("insert: increases size by at most one", () => {
	fc.assert(fc.property(arbUniq, fc.integer(), (s, item) => {
		const after = Uniq.insert(item)(s);
		expect(Uniq.size(after)).toBeGreaterThanOrEqual(Uniq.size(s));
		expect(Uniq.size(after)).toBeLessThanOrEqual(Uniq.size(s) + 1);
	}));
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

test("remove: ensures removed item is not found via has", () => {
	fc.assert(fc.property(arbUniq, fc.integer(), (s, item) => {
		expect(Uniq.has(item)(Uniq.remove(item)(s))).toBe(false);
	}));
});

// ---------------------------------------------------------------------------
// union
// ---------------------------------------------------------------------------

test("union: contains all items from both sets", () => {
	fc.assert(fc.property(arbUniq, arbUniq, (s1, s2) => {
		const result = Uniq.union(s2)(s1);
		Uniq.to.array(s1).forEach((item) => expect(Uniq.has(item)(result)).toBe(true));
		Uniq.to.array(s2).forEach((item) => expect(Uniq.has(item)(result)).toBe(true));
	}));
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

test("intersection: results in subset of both inputs", () => {
	fc.assert(fc.property(arbUniq, arbUniq, (s1, s2) => {
		const result = Uniq.intersection(s2)(s1);
		Uniq.to.array(result).forEach((item) => {
			expect(Uniq.has(item)(s1)).toBe(true);
			expect(Uniq.has(item)(s2)).toBe(true);
		});
	}));
});

// ---------------------------------------------------------------------------
// difference
// ---------------------------------------------------------------------------

test("difference: produces set disjoint from second set", () => {
	fc.assert(fc.property(arbUniq, arbUniq, (s1, s2) => {
		const result = Uniq.difference(s2)(s1);
		Uniq.to.array(result).forEach((item) => {
			expect(Uniq.has(item)(s2)).toBe(false);
		});
	}));
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("filter: acts as identity when predicate always returns true", () => {
	fc.assert(fc.property(arbUniq, (s) => {
		expect(Uniq.filter(() => true)(s)).toStrictEqual(s);
	}));
});

test("filter: returns empty set when predicate always returns false", () => {
	fc.assert(fc.property(arbUniq, (_s) => {
		expect(Uniq.filter(() => false)(Uniq.from.array([1, 2, 3]))).toStrictEqual(Uniq.empty());
	}));
});
