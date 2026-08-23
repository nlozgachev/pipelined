import * as fc from "fast-check";
import { expect, test } from "vitest";
import { Pair } from "../Pair.ts";

// Arbitrary for property testing: generating pairs of (string, integer)
const arbPair = fc.tuple(fc.string(), fc.integer());

// --- Pair property tests ---

test("Pair.from.pair → Pair.first — round-trip", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		expect(Pair.first(Pair.from.pair(a, b))).toBe(a);
	}));
});

test("Pair.from.pair → Pair.second — round-trip", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		expect(Pair.second(Pair.from.pair(a, b))).toBe(b);
	}));
});

// --- Swap ---

test("Pair.swap — involution (swap twice is identity)", () => {
	fc.assert(fc.property(arbPair, (p) => {
		expect(Pair.swap(Pair.swap(p))).toStrictEqual(p);
	}));
});

test("Pair.swap — exchanges first and second", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		const swapped = Pair.swap(Pair.from.pair(a, b));
		expect(Pair.first(swapped)).toBe(b);
		expect(Pair.second(swapped)).toBe(a);
	}));
});

// --- Map property tests ---

test("Pair.mapFirst — identity law", () => {
	fc.assert(fc.property(arbPair, (p) => {
		expect(Pair.mapFirst((x: string) => x)(p)).toStrictEqual(p);
	}));
});

test("Pair.mapFirst — does not affect second", () => {
	fc.assert(fc.property(arbPair, fc.string(), (p, suffix) => {
		const result = Pair.mapFirst((s: string) => s + suffix)(p);
		expect(Pair.second(result)).toBe(Pair.second(p));
	}));
});

test("Pair.mapSecond — identity law", () => {
	fc.assert(fc.property(arbPair, (p) => {
		expect(Pair.mapSecond((x: number) => x)(p)).toStrictEqual(p);
	}));
});

test("Pair.mapSecond — does not affect first", () => {
	fc.assert(fc.property(arbPair, fc.integer(), (p, delta) => {
		const result = Pair.mapSecond((n: number) => n + delta)(p);
		expect(Pair.first(result)).toBe(Pair.first(p));
	}));
});

// --- Tap property test ---

test("Pair.tap — always returns the identical reference", () => {
	fc.assert(fc.property(arbPair, (p) => {
		expect(Pair.tap(() => {})(p)).toBe(p);
	}));
});

// --- Fold property test ---

test("Pair.fold — combines both elements", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (a, b) => {
		const result = Pair.fold((s: string, n: number) => `${s}:${n}`)(Pair.from.pair(a, b));
		expect(result).toBe(`${a}:${b}`);
	}));
});
