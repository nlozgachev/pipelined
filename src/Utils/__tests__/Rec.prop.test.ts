import fc from "fast-check";
import { expect, test } from "vitest";
import { Rec } from "../Rec.ts";

const dict = fc.dictionary(fc.string({ minLength: 1 }), fc.integer());

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Rec.map — functor identity", () => {
	fc.assert(
		fc.property(dict, (obj) => {
			expect(Rec.map((x) => x)(obj)).toEqual(obj);
		}),
	);
});

test("Rec.map — functor composition", () => {
	fc.assert(
		fc.property(dict, fc.integer(), fc.integer(), (obj, a, b) => {
			const f = (x: number) => x + a;
			const g = (x: number) => x * b;
			expect(Rec.map(f)(Rec.map(g)(obj))).toEqual(Rec.map((x: number) => f(g(x)))(obj));
		}),
	);
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("Rec.filter(always true) — identity", () => {
	fc.assert(
		fc.property(dict, (obj) => {
			expect(Rec.filter(() => true)(obj)).toEqual(obj);
		}),
	);
});

test("Rec.filter(always false) — empty result", () => {
	fc.assert(
		fc.property(dict, (obj) => {
			expect(Rec.filter(() => false)(obj)).toEqual({});
		}),
	);
});

// ---------------------------------------------------------------------------
// entries / fromEntries
// ---------------------------------------------------------------------------

test("Rec.fromEntries(Rec.entries) — round-trip", () => {
	fc.assert(
		fc.property(dict, (obj) => {
			expect(Rec.fromEntries(Rec.entries(obj) as readonly (readonly [string, number])[])).toEqual(obj);
		}),
	);
});

// ---------------------------------------------------------------------------
// size / isEmpty
// ---------------------------------------------------------------------------

test("Rec.size — agrees with native", () => {
	fc.assert(
		fc.property(dict, (obj) => {
			expect(Rec.size(obj)).toBe(Object.keys(obj).length);
		}),
	);
});

test("Rec.isEmpty — iff size is 0", () => {
	fc.assert(
		fc.property(dict, (obj) => {
			expect(Rec.isEmpty(obj)).toBe(Rec.size(obj) === 0);
		}),
	);
});

// ---------------------------------------------------------------------------
// keys / values
// ---------------------------------------------------------------------------

test("Rec.keys — agrees with native", () => {
	fc.assert(
		fc.property(dict, (obj) => {
			expect([...Rec.keys(obj)].sort()).toEqual(Object.keys(obj).sort());
		}),
	);
});

test("Rec.values — agrees with native", () => {
	fc.assert(
		fc.property(dict, (obj) => {
			expect([...Rec.values(obj)].sort((a, b) => a - b)).toEqual(
				Object.values(obj).sort((a, b) => a - b),
			);
		}),
	);
});

// ---------------------------------------------------------------------------
// pick / omit
// ---------------------------------------------------------------------------

test("Rec.pick — result only contains picked keys", () => {
	fc.assert(
		fc.property(dict, fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }), (obj, ks) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const result = (Rec.pick as (...keys: string[]) => (data: Record<string, number>) => Record<string, number>)(
				...ks,
			)(obj);
			expect(Object.keys(result).every((k) => ks.includes(k))).toBe(true);
		}),
	);
});

test("Rec.omit — result does not contain omitted keys", () => {
	fc.assert(
		fc.property(dict, fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }), (obj, ks) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const result = (Rec.omit as (...keys: string[]) => (data: Record<string, number>) => Record<string, number>)(
				...ks,
			)(obj);
			expect(Object.keys(result).every((k) => !ks.includes(k))).toBe(true);
		}),
	);
});

// ---------------------------------------------------------------------------
// merge
// ---------------------------------------------------------------------------

test("Rec.merge — result contains all keys from both objects", () => {
	fc.assert(
		fc.property(dict, dict, (obj, other) => {
			const result = Rec.merge(other)(obj);
			const allKeys = new Set([...Object.keys(obj), ...Object.keys(other)]);
			expect(new Set(Object.keys(result))).toEqual(allKeys);
		}),
	);
});
