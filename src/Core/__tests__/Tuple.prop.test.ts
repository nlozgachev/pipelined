import { Tuple } from "#core";
import fc from "fast-check";
import { expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbTuple = fc.tuple(fc.string(), fc.integer());

// ---------------------------------------------------------------------------
// make / first / second
// ---------------------------------------------------------------------------

test("tuple.make → Tuple.first — round-trip", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		expect(Tuple.first(Tuple.make(a, b))).toBe(a);
	}));
});

test("tuple.make → Tuple.second — round-trip", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		expect(Tuple.second(Tuple.make(a, b))).toBe(b);
	}));
});

// ---------------------------------------------------------------------------
// swap — involution
// ---------------------------------------------------------------------------

test("Tuple.swap — involution (swap twice is identity)", () => {
	fc.assert(fc.property(arbTuple, (t) => {
		expect(Tuple.swap(Tuple.swap(t))).toStrictEqual(t);
	}));
});

test("Tuple.swap — exchanges first and second", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		const swapped = Tuple.swap(Tuple.make(a, b));
		expect(Tuple.first(swapped)).toBe(b);
		expect(Tuple.second(swapped)).toBe(a);
	}));
});

// ---------------------------------------------------------------------------
// mapFirst — functor laws
// ---------------------------------------------------------------------------

test("Tuple.mapFirst — identity law", () => {
	fc.assert(fc.property(arbTuple, (t) => {
		expect(Tuple.mapFirst((x: string) => x)(t)).toStrictEqual(t);
	}));
});

test("Tuple.mapFirst — does not affect second", () => {
	fc.assert(fc.property(arbTuple, fc.string(), (t, suffix) => {
		const result = Tuple.mapFirst((s: string) => s + suffix)(t);
		expect(Tuple.second(result)).toBe(Tuple.second(t));
	}));
});

// ---------------------------------------------------------------------------
// mapSecond — functor laws
// ---------------------------------------------------------------------------

test("Tuple.mapSecond — identity law", () => {
	fc.assert(fc.property(arbTuple, (t) => {
		expect(Tuple.mapSecond((x: number) => x)(t)).toStrictEqual(t);
	}));
});

test("Tuple.mapSecond — does not affect first", () => {
	fc.assert(fc.property(arbTuple, fc.integer(), (t, delta) => {
		const result = Tuple.mapSecond((n: number) => n + delta)(t);
		expect(Tuple.first(result)).toBe(Tuple.first(t));
	}));
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("Tuple.tap — always returns the identical reference", () => {
	fc.assert(fc.property(arbTuple, (t) => {
		expect(Tuple.tap(() => {})(t)).toBe(t);
	}));
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Tuple.fold — combines both elements", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		const result = Tuple.fold((s: string, n: number) => `${s}:${n}`)(Tuple.make(a, b));
		expect(result).toBe(`${a}:${b}`);
	}));
});
