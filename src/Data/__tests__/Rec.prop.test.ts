import fc from "fast-check";
import { expect, test } from "vitest";
import { Rec } from "../Rec.ts";

const dict = fc.dictionary(fc.string({ minLength: 1 }), fc.integer()).map((o) => ({ ...o }));

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: satisfies identity functor law", () => {
	fc.assert(fc.property(dict, (obj) => {
		expect(Rec.map((x) => x)(obj)).toStrictEqual(obj);
	}));
});

test("map: satisfies composition functor law", () => {
	fc.assert(fc.property(dict, fc.integer(), fc.integer(), (obj, a, b) => {
		const f = (x: number) => x + a;
		const g = (x: number) => x * b;
		expect(Rec.map(f)(Rec.map(g)(obj))).toStrictEqual(Rec.map((x: number) => f(g(x)))(obj));
	}));
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("filter: acts as identity when predicate always returns true", () => {
	fc.assert(fc.property(dict, (obj) => {
		expect(Rec.filter(() => true)(obj)).toStrictEqual(obj);
	}));
});

test("filter: returns empty object when predicate always returns false", () => {
	fc.assert(fc.property(dict, (obj) => {
		expect(Rec.filter(() => false)(obj)).toStrictEqual(Object.create(Object.getPrototypeOf(obj)));
	}));
});

// ---------------------------------------------------------------------------
// entries / fromEntries
// ---------------------------------------------------------------------------

test("from.entries: round-trips with entries", () => {
	fc.assert(fc.property(dict, (obj) => {
		expect(Rec.from.entries(Rec.entries(obj) as readonly (readonly [string, number])[])).toStrictEqual(obj);
	}));
});

// ---------------------------------------------------------------------------
// size / isEmpty
// ---------------------------------------------------------------------------

test("size: agrees with native Object.keys length", () => {
	fc.assert(fc.property(dict, (obj) => {
		expect(Rec.size(obj)).toBe(Object.keys(obj).length);
	}));
});

test("is.empty: returns true if and only if size is zero", () => {
	fc.assert(fc.property(dict, (obj) => {
		expect(Rec.is.empty(obj)).toBe(Rec.size(obj) === 0);
	}));
});

// ---------------------------------------------------------------------------
// keys / values
// ---------------------------------------------------------------------------

test("keys: agrees with native Object.keys", () => {
	fc.assert(fc.property(dict, (obj) => {
		expect([...Rec.keys(obj)].toSorted()).toStrictEqual(Object.keys(obj).toSorted());
	}));
});

test("values: agrees with native Object.values", () => {
	fc.assert(fc.property(dict, (obj) => {
		expect([...Rec.values(obj)].toSorted((a, b) => a - b)).toStrictEqual(Object.values(obj).toSorted((a, b) => a - b));
	}));
});

// ---------------------------------------------------------------------------
// pick / omit
// ---------------------------------------------------------------------------

test("pick: retains only picked keys", () => {
	fc.assert(fc.property(dict, fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }), (obj, ks) => {
		const result = (Rec.pick as (...keys: string[]) => (data: Record<string, number>) => Record<string, number>)(...ks)(
			obj,
		);
		expect(Object.keys(result).every((k) => ks.includes(k))).toBe(true);
	}));
});

test("omit: excludes omitted keys", () => {
	fc.assert(fc.property(dict, fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }), (obj, ks) => {
		const result = (Rec.omit as (...keys: string[]) => (data: Record<string, number>) => Record<string, number>)(...ks)(
			obj,
		);
		expect(Object.keys(result).every((k) => !ks.includes(k))).toBe(true);
	}));
});

// ---------------------------------------------------------------------------
// merge
// ---------------------------------------------------------------------------

test("merge: contains all keys from both records", () => {
	fc.assert(fc.property(dict, dict, (obj, other) => {
		const result = Rec.merge(other)(obj);
		const allKeys = new Set([...Object.keys(obj), ...Object.keys(other)]);
		expect(new Set(Object.keys(result))).toStrictEqual(allKeys);
	}));
});
