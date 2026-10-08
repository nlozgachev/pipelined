import fc from "fast-check";
import { expect, test } from "vitest";
import { Maybe } from "../../Core/Maybe.ts";
import { Dict } from "../Dict.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbDict = fc.array(fc.tuple(fc.string({ minLength: 1 }), fc.integer()), { maxLength: 8 }).map((pairs) =>
	Dict.from.entries(pairs)
);

// ---------------------------------------------------------------------------
// fromEntries / entries — round-trip
// ---------------------------------------------------------------------------

test("from.entries: ensures every entry is found via lookup", () => {
	fc.assert(fc.property(fc.array(fc.tuple(fc.string({ minLength: 1 }), fc.integer()), { maxLength: 8 }), (pairs) => {
		const m = Dict.from.entries(pairs);
		const entries = Dict.entries(m);
		entries.forEach(([k, v]) => {
			expect(Dict.lookup(k)(m)).toStrictEqual(Maybe.make.some(v));
		});
	}));
});

// ---------------------------------------------------------------------------
// map — functor laws
// ---------------------------------------------------------------------------

test("map: satisfies identity functor law", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.map((x: number) => x)(m)).toStrictEqual(m);
	}));
});

test("map: satisfies composition functor law", () => {
	fc.assert(fc.property(arbDict, fc.integer(), fc.integer(), (m, a, b) => {
		const f = (x: number) => x + a;
		const g = (x: number) => x * b;
		expect(Dict.map(f)(Dict.map(g)(m))).toStrictEqual(Dict.map((x: number) => f(g(x)))(m));
	}));
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("filter: acts as identity when predicate always returns true", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.filter(() => true)(m)).toStrictEqual(m);
	}));
});

test("filter: returns empty dict when predicate always returns false", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.filter(() => false)(m)).toStrictEqual(Dict.empty());
	}));
});

// ---------------------------------------------------------------------------
// size / isEmpty
// ---------------------------------------------------------------------------

test("size: agrees with entries count", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.size(m)).toBe(Dict.entries(m).length);
	}));
});

test("is.empty: returns true if and only if size is zero", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.is.empty(m)).toBe(Dict.size(m) === 0);
	}));
});

// ---------------------------------------------------------------------------
// insert / lookup
// ---------------------------------------------------------------------------

test("insert: ensures inserted key is found via lookup", () => {
	fc.assert(fc.property(arbDict, fc.string({ minLength: 1 }), fc.integer(), (m, k, v) => {
		expect(Dict.lookup(k)(Dict.insert(k, v)(m))).toStrictEqual(Maybe.make.some(v));
	}));
});

// ---------------------------------------------------------------------------
// remove / lookup
// ---------------------------------------------------------------------------

test("remove: ensures removed key is not found via lookup", () => {
	fc.assert(fc.property(arbDict, fc.string({ minLength: 1 }), (m, k) => {
		expect(Dict.lookup(k)(Dict.remove(k)(m))).toStrictEqual(Maybe.make.none());
	}));
});

// ---------------------------------------------------------------------------
// union
// ---------------------------------------------------------------------------

test("union: contains all keys from both dicts", () => {
	fc.assert(fc.property(arbDict, arbDict, (m1, m2) => {
		const result = Dict.union(m2)(m1);
		Dict.keys(m1).forEach((k) => expect(Dict.has(k)(result)).toBe(true));
		Dict.keys(m2).forEach((k) => expect(Dict.has(k)(result)).toBe(true));
	}));
});

// ---------------------------------------------------------------------------
// keys / values
// ---------------------------------------------------------------------------

test("keys: produces length matching size", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.keys(m)).toHaveLength(Dict.size(m));
	}));
});

test("values: produces length matching size", () => {
	fc.assert(fc.property(arbDict, (m) => {
		expect(Dict.values(m)).toHaveLength(Dict.size(m));
	}));
});
