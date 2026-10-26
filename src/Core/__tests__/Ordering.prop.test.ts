import * as fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Ordering } from "../Ordering.ts";

// ---------------------------------------------------------------------------
// Total Order Laws: Reflexivity, Antisymmetry, Transitivity
// ---------------------------------------------------------------------------

test("string: satisfies reflexivity and antisymmetry", () => {
	fc.assert(fc.property(fc.string(), (str) => {
		expect(Ordering.string(str, str)).toBe(0);
	}));

	fc.assert(fc.property(fc.string(), fc.string(), (a, b) => {
		const ab = Ordering.string(a, b);
		const ba = Ordering.string(b, a);
		expect([-1, 0, 1]).toContain(ab);
		expect([-1, 0, 1]).toContain(ba);
		expect(ba).toBe(ab === 0 ? 0 : -ab);
	}));
});

test("number: satisfies reflexivity, antisymmetry, and trichotomy for finite and non-integer floats", () => {
	const arbNum = fc.oneof(fc.integer(), fc.double({ noDefaultInfinity: true, noNaN: true }));

	fc.assert(fc.property(arbNum, (num) => {
		expect(Ordering.number(num, num)).toBe(0);
	}));

	fc.assert(fc.property(arbNum, arbNum, (a, b) => {
		const ab = Ordering.number(a, b);
		const ba = Ordering.number(b, a);
		expect([-1, 0, 1]).toContain(ab);
		expect([-1, 0, 1]).toContain(ba);
		expect(ba).toBe(ab === 0 ? 0 : -ab);
	}));
});

test("number: satisfies transitivity", () => {
	const arbSortedTriple = fc.tuple(fc.integer(), fc.integer(), fc.integer()).map((triple) =>
		triple.sort((x, y) => x - y)
	);

	fc.assert(fc.property(arbSortedTriple, ([a, b, c]) => {
		expect(Ordering.number(a, b)).toBeLessThanOrEqual(0);
		expect(Ordering.number(b, c)).toBeLessThanOrEqual(0);
		expect(Ordering.number(a, c)).toBeLessThanOrEqual(0);
	}));
});

test("date: satisfies reflexivity and antisymmetry", () => {
	const arbDate = fc.date({ noInvalidDate: true });

	fc.assert(fc.property(arbDate, (date) => {
		expect(Ordering.date(date, new Date(date.getTime()))).toBe(0);
	}));

	fc.assert(fc.property(arbDate, arbDate, (a, b) => {
		const ab = Ordering.date(a, b);
		const ba = Ordering.date(b, a);
		expect([-1, 0, 1]).toContain(ab);
		expect([-1, 0, 1]).toContain(ba);
		expect(ba).toBe(ab === 0 ? 0 : -ab);
	}));
});

// ---------------------------------------------------------------------------
// reverse
// ---------------------------------------------------------------------------

test("reverse: is an involution and inverts comparator sign", () => {
	const reversed = Ordering.reverse(Ordering.number);
	const doubleReversed = Ordering.reverse(reversed);

	fc.assert(fc.property(fc.integer(), fc.integer(), (a, b) => {
		expect(reversed(a, b)).toBe(Ordering.number(b, a));
		expect(doubleReversed(a, b)).toBe(Ordering.number(a, b));
	}));
});

// ---------------------------------------------------------------------------
// thenBy
// ---------------------------------------------------------------------------

test("thenBy: chains tiebreakers and short-circuits on non-zero", () => {
	type Pair = { readonly priority: number; readonly id: string; };
	const byPriority = pipe(Ordering.number, Ordering.by((p: Pair) => p.priority));
	const byId = pipe(Ordering.string, Ordering.by((p: Pair) => p.id));
	const chained = pipe(byPriority, Ordering.thenBy(byId));

	fc.assert(fc.property(fc.integer(), fc.string(), fc.string(), (priority, idA, idB) => {
		const a: Pair = { priority, id: idA };
		const b: Pair = { priority, id: idB };
		expect(chained(a, b)).toBe(Ordering.string(idA, idB));
	}));
});

// ---------------------------------------------------------------------------
// byFields and tuple
// ---------------------------------------------------------------------------

test("byFields: returns 0 for empty list and matches single ordering", () => {
	const empty = Ordering.byFields<number>([]);
	const single = Ordering.byFields([Ordering.number]);

	fc.assert(fc.property(fc.integer(), fc.integer(), (a, b) => {
		expect(empty(a, b)).toBe(0);
		expect(single(a, b)).toBe(Ordering.number(a, b));
	}));
});

test("tuple: satisfies reflexivity and antisymmetry", () => {
	const pairOrd = Ordering.tuple(Ordering.string, Ordering.number);

	fc.assert(fc.property(fc.string(), fc.integer(), (str, num) => {
		expect(pairOrd([str, num], [str, num])).toBe(0);
	}));

	fc.assert(fc.property(fc.string(), fc.integer(), fc.string(), fc.integer(), (s1, n1, s2, n2) => {
		const ab = pairOrd([s1, n1], [s2, n2]);
		const ba = pairOrd([s2, n2], [s1, n1]);
		expect([-1, 0, 1]).toContain(ab);
		expect([-1, 0, 1]).toContain(ba);
		expect(ba).toBe(ab === 0 ? 0 : -ab);
	}));
});
