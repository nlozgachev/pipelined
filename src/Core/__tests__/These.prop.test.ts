import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";
import { These } from "../These.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbFirst = fc.string().map(These.first);
const arbSecond = fc.integer().map(These.second);
const arbBoth = fc.tuple(fc.string(), fc.integer()).map(([a, b]) => These.both(a, b));
const arbThese = fc.oneof(arbFirst, arbSecond, arbBoth);

// ---------------------------------------------------------------------------
// mapFirst — functor laws
// ---------------------------------------------------------------------------

test("These.mapFirst — identity law", () => {
	fc.assert(
		fc.property(arbThese, (t) => {
			expect(These.mapFirst((x: string) => x)(t)).toEqual(t);
		}),
	);
});

test("These.mapFirst — composition law", () => {
	fc.assert(
		fc.property(arbThese, fc.integer(), fc.string(), (t, n, suffix) => {
			const f = (s: string) => s + suffix;
			const g = (s: string) => s.repeat(Math.max(0, n % 3));
			expect(These.mapFirst(f)(These.mapFirst(g)(t))).toEqual(
				These.mapFirst((x: string) => f(g(x)))(t),
			);
		}),
	);
});

// ---------------------------------------------------------------------------
// mapSecond — functor laws
// ---------------------------------------------------------------------------

test("These.mapSecond — identity law", () => {
	fc.assert(
		fc.property(arbThese, (t) => {
			expect(These.mapSecond((x: number) => x)(t)).toEqual(t);
		}),
	);
});

test("These.mapSecond — composition law", () => {
	fc.assert(
		fc.property(arbThese, fc.integer(), fc.integer(), (t, a, b) => {
			const f = (x: number) => x + a;
			const g = (x: number) => x * b;
			expect(These.mapSecond(f)(These.mapSecond(g)(t))).toEqual(
				These.mapSecond((x: number) => f(g(x)))(t),
			);
		}),
	);
});

// ---------------------------------------------------------------------------
// hasFirst / hasSecond — structural invariants
// ---------------------------------------------------------------------------

test("These.isBoth implies hasFirst and hasSecond", () => {
	fc.assert(
		fc.property(arbBoth, (t) => {
			expect(These.hasFirst(t)).toBe(true);
			expect(These.hasSecond(t)).toBe(true);
		}),
	);
});

test("These.isFirst implies hasFirst and not hasSecond", () => {
	fc.assert(
		fc.property(arbFirst, (t) => {
			expect(These.hasFirst(t)).toBe(true);
			expect(These.hasSecond(t)).toBe(false);
		}),
	);
});

test("These.isSecond implies hasSecond and not hasFirst", () => {
	fc.assert(
		fc.property(arbSecond, (t) => {
			expect(These.hasSecond(t)).toBe(true);
			expect(These.hasFirst(t)).toBe(false);
		}),
	);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("These.fold — handles all three variants without throwing", () => {
	fc.assert(
		fc.property(arbThese, (t) => {
			const result = These.fold(
				(a: string) => `first:${a}`,
				(b: number) => `second:${b}`,
				(a: string, b: number) => `both:${a}:${b}`,
			)(t);
			expectTypeOf(result).toBeString();
		}),
	);
});

// ---------------------------------------------------------------------------
// getFirstOrElse / getSecondOrElse
// ---------------------------------------------------------------------------

test("These.getFirstOrElse — returns fallback on Second", () => {
	fc.assert(
		fc.property(arbSecond, fc.string(), (t, fallback) => {
			expect(These.getFirstOrElse(() => fallback)(t)).toBe(fallback);
		}),
	);
});

test("These.getSecondOrElse — returns fallback on First", () => {
	fc.assert(
		fc.property(arbFirst, fc.integer(), (t, fallback) => {
			expect(These.getSecondOrElse(() => fallback)(t)).toBe(fallback);
		}),
	);
});
