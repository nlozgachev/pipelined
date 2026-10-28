import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";
import { Pair } from "../Pair.ts";
import { These } from "../These.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbFirst = fc.string().map(These.make.first);
const arbSecond = fc.integer().map(These.make.second);
const arbBoth = fc.tuple(fc.string(), fc.integer()).map(([a, b]) => These.make.both(a, b));
const arbThese = fc.oneof(arbFirst, arbSecond, arbBoth);

// ---------------------------------------------------------------------------
// mapFirst — functor laws
// ---------------------------------------------------------------------------

test("mapFirst: satisfies identity law", () => {
	fc.assert(fc.property(arbThese, (t) => {
		expect(These.mapFirst((x: string) => x)(t)).toStrictEqual(t);
	}));
});

test("mapFirst: satisfies composition law", () => {
	fc.assert(fc.property(arbThese, fc.integer(), fc.string(), (t, n, suffix) => {
		const f = (s: string) => s + suffix;
		const g = (s: string) => s.repeat(Math.max(0, n % 3));
		expect(These.mapFirst(f)(These.mapFirst(g)(t))).toStrictEqual(These.mapFirst((x: string) => f(g(x)))(t));
	}));
});

// ---------------------------------------------------------------------------
// mapSecond — functor laws
// ---------------------------------------------------------------------------

test("mapSecond: satisfies identity law", () => {
	fc.assert(fc.property(arbThese, (t) => {
		expect(These.mapSecond((x: number) => x)(t)).toStrictEqual(t);
	}));
});

test("mapSecond: satisfies composition law", () => {
	fc.assert(fc.property(arbThese, fc.integer(), fc.integer(), (t, a, b) => {
		const f = (x: number) => x + a;
		const g = (x: number) => x * b;
		expect(These.mapSecond(f)(These.mapSecond(g)(t))).toStrictEqual(These.mapSecond((x: number) => f(g(x)))(t));
	}));
});

// ---------------------------------------------------------------------------
// hasFirst / hasSecond — structural invariants
// ---------------------------------------------------------------------------

test("is.both: implies hasFirst and hasSecond", () => {
	fc.assert(fc.property(arbBoth, (t) => {
		expect(These.hasFirst(t)).toBe(true);
		expect(These.hasSecond(t)).toBe(true);
	}));
});

test("is.first: implies hasFirst and not hasSecond", () => {
	fc.assert(fc.property(arbFirst, (t) => {
		expect(These.hasFirst(t)).toBe(true);
		expect(These.hasSecond(t)).toBe(false);
	}));
});

test("is.second: implies hasSecond and not hasFirst", () => {
	fc.assert(fc.property(arbSecond, (t) => {
		expect(These.hasSecond(t)).toBe(true);
		expect(These.hasFirst(t)).toBe(false);
	}));
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("match: handles all three variants without throwing", () => {
	fc.assert(fc.property(arbThese, (t) => {
		const result = These.match({
			first: (a: string) => `first:${a}`,
			second: (b: number) => `second:${b}`,
			both: (a: string, b: number) => `both:${a}:${b}`,
		})(t);
		expectTypeOf(result).toBeString();
	}));
});

// ---------------------------------------------------------------------------
// getFirstOrElse / getSecondOrElse
// ---------------------------------------------------------------------------

test("getFirstOrElse: returns fallback on Second", () => {
	fc.assert(fc.property(arbSecond, fc.string(), (t, fallback) => {
		expect(These.getFirstOrElse(() => fallback)(t)).toBe(fallback);
	}));
});

test("getSecondOrElse: returns fallback on First", () => {
	fc.assert(fc.property(arbFirst, fc.integer(), (t, fallback) => {
		expect(These.getSecondOrElse(() => fallback)(t)).toBe(fallback);
	}));
});

// ---------------------------------------------------------------------------
// tapFirst / tapSecond / tapBoth
// ---------------------------------------------------------------------------

test("tapFirst: always returns identical reference", () => {
	fc.assert(fc.property(arbThese, (t) => {
		expect(These.tapFirst(() => {})(t)).toBe(t);
	}));
});

test("tapSecond: always returns identical reference", () => {
	fc.assert(fc.property(arbThese, (t) => {
		expect(These.tapSecond(() => {})(t)).toBe(t);
	}));
});

test("tapBoth: always returns identical reference", () => {
	fc.assert(fc.property(arbThese, (t) => {
		expect(These.tapBoth(() => {})(t)).toBe(t);
	}));
});

// ---------------------------------------------------------------------------
// to.Pair / from.Pair roundtrip
// ---------------------------------------------------------------------------

test("from.Pair: roundtrips with to.Pair for Pair and These.Both", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		const pair = Pair.make(a, b);
		const these = These.from.Pair(pair);
		expect(these).toStrictEqual(These.make.both(a, b));
		expect(These.to.Pair(these)).toStrictEqual({ kind: "Some", value: pair });
	}));
});

test("to.Pair: returns None for non-Both variants", () => {
	fc.assert(fc.property(fc.oneof(arbFirst, arbSecond), (t) => {
		expect(These.to.Pair(t)).toStrictEqual({ kind: "None" });
	}));
});
