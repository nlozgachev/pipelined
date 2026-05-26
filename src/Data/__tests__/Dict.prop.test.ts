import { Maybe } from "#core";
import { Dict } from "#data";
import fc from "fast-check";
import { expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbDict = fc.array(fc.tuple(fc.string({ minLength: 1 }), fc.integer()), { maxLength: 8 }).map((pairs) =>
	Dict.fromEntries(pairs)
);

// ---------------------------------------------------------------------------
// fromEntries / entries — round-trip
// ---------------------------------------------------------------------------

test("dict.fromEntries → Dict.entries — every entry is found via lookup", () => {
	fc.assert(fc.property(fc.array(fc.tuple(fc.string({ minLength: 1 }), fc.integer()), { maxLength: 8 }), (pairs) => {
		const m = Dict.fromEntries(pairs);
		const entries = Dict.entries(m);
		entries.forEach(([k, v]) => {
			expect(Dict.lookup(k)(m)).toStrictEqual(Maybe.some(v));
		});
	}));
});

// ---------------------------------------------------------------------------
// map — functor laws
// ---------------------------------------------------------------------------

test("Dict.map — identity law", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.map((x: number) => x)(m)).toStrictEqual(m);
	}));
});

test("Dict.map — composition law", () => {
	fc.assert(fc.property(arbDict, fc.integer(), fc.integer(), (m, a, b) => {
		const f = (x: number) => x + a;
		const g = (x: number) => x * b;
		expect(Dict.map(f)(Dict.map(g)(m))).toStrictEqual(Dict.map((x: number) => f(g(x)))(m));
	}));
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("Dict.filter(always true) — identity", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.filter(() => true)(m)).toStrictEqual(m);
	}));
});

test("Dict.filter(always false) — empty result", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.filter(() => false)(m)).toStrictEqual(Dict.empty());
	}));
});

// ---------------------------------------------------------------------------
// size / isEmpty
// ---------------------------------------------------------------------------

test("Dict.size — agrees with entries count", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.size(m)).toBe(Dict.entries(m).length);
	}));
});

test("Dict.isEmpty — iff size is 0", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.isEmpty(m)).toBe(Dict.size(m) === 0);
	}));
});

// ---------------------------------------------------------------------------
// insert / lookup
// ---------------------------------------------------------------------------

test("Dict.insert — inserted key is immediately found via lookup", () => {
	fc.assert(fc.property(arbDict, fc.string({ minLength: 1 }), fc.integer(), (m, k, v) => {
		expect(Dict.lookup(k)(Dict.insert(k, v)(m))).toStrictEqual(Maybe.some(v));
	}));
});

// ---------------------------------------------------------------------------
// remove / lookup
// ---------------------------------------------------------------------------

test("Dict.remove — removed key is not found via lookup", () => {
	fc.assert(fc.property(arbDict, fc.string({ minLength: 1 }), (m, k) => {
		expect(Dict.lookup(k)(Dict.remove(k)(m))).toStrictEqual(Maybe.none());
	}));
});

// ---------------------------------------------------------------------------
// union
// ---------------------------------------------------------------------------

test("Dict.union — result contains all keys from both maps", () => {
	fc.assert(fc.property(arbDict, arbDict, (m1, m2) => {
		const result = Dict.union(m2)(m1);
		Dict.keys(m1).forEach((k) => expect(Dict.has(k)(result)).toBe(true));
		Dict.keys(m2).forEach((k) => expect(Dict.has(k)(result)).toBe(true));
	}));
});

// ---------------------------------------------------------------------------
// keys / values
// ---------------------------------------------------------------------------

test("Dict.keys — length matches size", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.keys(m)).toHaveLength(Dict.size(m));
	}));
});

test("Dict.values — length matches size", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.values(m)).toHaveLength(Dict.size(m));
	}));
});
