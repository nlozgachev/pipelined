import fc from "fast-check";
import { expect, test } from "vitest";
import { Uniq } from "../Uniq.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbUniq = fc.array(fc.integer(), { maxLength: 10 }).map(Uniq.fromArray);

// ---------------------------------------------------------------------------
// fromArray / toArray — round-trip
// ---------------------------------------------------------------------------

test("uniq.fromArray → Uniq.toArray — contains same unique elements", () => {
	fc.assert(fc.property(fc.array(fc.integer()), (arr) => {
		const s = Uniq.fromArray(arr);
		const unique = [...new Set(arr)].toSorted((a, b) => a - b);
		expect([...Uniq.toArray(s)].toSorted((a, b) => a - b)).toStrictEqual(unique);
	}));
});

test("Uniq.fromArray — idempotence on unique input", () => {
	fc.assert(fc.property(arbUniq, (s) => {
		expect(Uniq.fromArray(Uniq.toArray(s))).toStrictEqual(s);
	}));
});

// ---------------------------------------------------------------------------
// size / isEmpty
// ---------------------------------------------------------------------------

test("Uniq.size — agrees with toArray length", () => {
	fc.assert(fc.property(arbUniq, (s) => {
		expect(Uniq.size(s)).toBe(Uniq.toArray(s).length);
	}));
});

test("Uniq.isEmpty — iff size is 0", () => {
	fc.assert(fc.property(arbUniq, (s) => {
		expect(Uniq.isEmpty(s)).toBe(Uniq.size(s) === 0);
	}));
});

// ---------------------------------------------------------------------------
// map — functor laws
// ---------------------------------------------------------------------------

test("Uniq.map — identity law", () => {
	fc.assert(fc.property(arbUniq, (s) => {
		expect(Uniq.map((x: number) => x)(s)).toStrictEqual(s);
	}));
});

// ---------------------------------------------------------------------------
// insert / has
// ---------------------------------------------------------------------------

test("Uniq.insert — inserted item is found via has", () => {
	fc.assert(fc.property(arbUniq, fc.integer(), (s, item) => {
		expect(Uniq.has(item)(Uniq.insert(item)(s))).toBe(true);
	}));
});

test("Uniq.insert — size increases by at most 1", () => {
	fc.assert(fc.property(arbUniq, fc.integer(), (s, item) => {
		const after = Uniq.insert(item)(s);
		expect(Uniq.size(after)).toBeGreaterThanOrEqual(Uniq.size(s));
		expect(Uniq.size(after)).toBeLessThanOrEqual(Uniq.size(s) + 1);
	}));
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

test("Uniq.remove — removed item is not found via has", () => {
	fc.assert(fc.property(arbUniq, fc.integer(), (s, item) => {
		expect(Uniq.has(item)(Uniq.remove(item)(s))).toBe(false);
	}));
});

// ---------------------------------------------------------------------------
// union
// ---------------------------------------------------------------------------

test("Uniq.union — result contains all items from both sets", () => {
	fc.assert(fc.property(arbUniq, arbUniq, (s1, s2) => {
		const result = Uniq.union(s2)(s1);
		Uniq.toArray(s1).forEach((item) => expect(Uniq.has(item)(result)).toBe(true));
		Uniq.toArray(s2).forEach((item) => expect(Uniq.has(item)(result)).toBe(true));
	}));
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

test("Uniq.intersection — result is subset of both inputs", () => {
	fc.assert(fc.property(arbUniq, arbUniq, (s1, s2) => {
		const result = Uniq.intersection(s2)(s1);
		Uniq.toArray(result).forEach((item) => {
			expect(Uniq.has(item)(s1)).toBe(true);
			expect(Uniq.has(item)(s2)).toBe(true);
		});
	}));
});

// ---------------------------------------------------------------------------
// difference
// ---------------------------------------------------------------------------

test("Uniq.difference — result is disjoint from the other set", () => {
	fc.assert(fc.property(arbUniq, arbUniq, (s1, s2) => {
		const result = Uniq.difference(s2)(s1);
		Uniq.toArray(result).forEach((item) => {
			expect(Uniq.has(item)(s2)).toBe(false);
		});
	}));
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("Uniq.filter(always true) — identity", () => {
	fc.assert(fc.property(arbUniq, (s) => {
		expect(Uniq.filter(() => true)(s)).toStrictEqual(s);
	}));
});

test("Uniq.filter(always false) — empty result", () => {
	fc.assert(fc.property(arbUniq, (_s) => {
		expect(Uniq.filter(() => false)(Uniq.fromArray([1, 2, 3]))).toStrictEqual(Uniq.empty());
	}));
});
