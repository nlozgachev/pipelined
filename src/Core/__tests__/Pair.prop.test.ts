import * as fc from "fast-check";
import { expect, test } from "vitest";
import { Pair } from "../Pair.ts";

// Arbitrary for property testing: generating pairs of (string, integer)
const arbPair = fc.tuple(fc.string(), fc.integer());

// --- Pair property tests ---

test("first: extracts first element created by make", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		expect(Pair.first(Pair.make(a, b))).toBe(a);
	}));
});

test("second: extracts second element created by make", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		expect(Pair.second(Pair.make(a, b))).toBe(b);
	}));
});

// --- Swap ---

test("swap: is an involution", () => {
	fc.assert(fc.property(arbPair, (p) => {
		expect(Pair.swap(Pair.swap(p))).toStrictEqual(p);
	}));
});

test("swap: exchanges first and second elements", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		const swapped = Pair.swap(Pair.make(a, b));
		expect(Pair.first(swapped)).toBe(b);
		expect(Pair.second(swapped)).toBe(a);
	}));
});

// --- Map property tests ---

test("mapFirst: satisfies identity law", () => {
	fc.assert(fc.property(arbPair, (p) => {
		expect(Pair.mapFirst((x: string) => x)(p)).toStrictEqual(p);
	}));
});

test("mapFirst: does not affect second element", () => {
	fc.assert(fc.property(arbPair, fc.string(), (p, suffix) => {
		const result = Pair.mapFirst((s: string) => s + suffix)(p);
		expect(Pair.second(result)).toBe(Pair.second(p));
	}));
});

test("mapSecond: satisfies identity law", () => {
	fc.assert(fc.property(arbPair, (p) => {
		expect(Pair.mapSecond((x: number) => x)(p)).toStrictEqual(p);
	}));
});

test("mapSecond: does not affect first element", () => {
	fc.assert(fc.property(arbPair, fc.integer(), (p, delta) => {
		const result = Pair.mapSecond((n: number) => n + delta)(p);
		expect(Pair.first(result)).toBe(Pair.first(p));
	}));
});

// --- Tap property test ---

test("tap: returns identical reference", () => {
	fc.assert(fc.property(arbPair, (p) => {
		expect(Pair.tap(() => {})(p)).toBe(p);
	}));
});

// --- Fold property test ---

test("fold: combines both elements", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		const result = Pair.fold((s: string, n: number) => `${s}:${n}`)(Pair.make(a, b));
		expect(result).toBe(`${a}:${b}`);
	}));
});
