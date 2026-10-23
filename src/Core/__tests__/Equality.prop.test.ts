import * as fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Equality } from "../Equality.ts";

// ---------------------------------------------------------------------------
// Equivalence Relation Laws: Reflexivity, Symmetry, Transitivity
// ---------------------------------------------------------------------------

test("string: satisfies reflexivity and symmetry", () => {
	fc.assert(fc.property(fc.string(), (str) => {
		expect(Equality.string(str, str)).toBe(true);
	}));

	fc.assert(fc.property(fc.string(), fc.string(), (a, b) => {
		expect(Equality.string(a, b)).toBe(Equality.string(b, a));
	}));
});

test("number: satisfies reflexivity and symmetry for finite floats", () => {
	const arbNum = fc.oneof(fc.integer(), fc.double({ noDefaultInfinity: true, noNaN: true }));

	fc.assert(fc.property(arbNum, (num) => {
		expect(Equality.number(num, num)).toBe(true);
	}));

	fc.assert(fc.property(arbNum, arbNum, (a, b) => {
		expect(Equality.number(a, b)).toBe(Equality.number(b, a));
	}));
});

test("boolean: satisfies reflexivity and symmetry", () => {
	fc.assert(fc.property(fc.boolean(), (bool) => {
		expect(Equality.boolean(bool, bool)).toBe(true);
	}));

	fc.assert(fc.property(fc.boolean(), fc.boolean(), (a, b) => {
		expect(Equality.boolean(a, b)).toBe(Equality.boolean(b, a));
	}));
});

test("date: satisfies reflexivity and symmetry", () => {
	const arbDate = fc.date({ noInvalidDate: true });

	fc.assert(fc.property(arbDate, (date) => {
		expect(Equality.date(date, new Date(date.getTime()))).toBe(true);
	}));

	fc.assert(fc.property(arbDate, arbDate, (a, b) => {
		expect(Equality.date(a, b)).toBe(Equality.date(b, a));
	}));
});

// ---------------------------------------------------------------------------
// array
// ---------------------------------------------------------------------------

test("array: satisfies reflexivity and symmetry", () => {
	const arbArray = fc.array(fc.integer());
	const arrEq = Equality.array(Equality.number);

	fc.assert(fc.property(arbArray, (arr) => {
		expect(arrEq(arr, [...arr])).toBe(true);
	}));

	fc.assert(fc.property(arbArray, arbArray, (a, b) => {
		expect(arrEq(a, b)).toBe(arrEq(b, a));
	}));
});

// ---------------------------------------------------------------------------
// by
// ---------------------------------------------------------------------------

test("by: adapts equality checker to projected property", () => {
	type Item = { readonly id: string; readonly score: number; };
	const byId = pipe(Equality.string, Equality.by((item: Item) => item.id));

	fc.assert(fc.property(fc.string(), fc.integer(), fc.integer(), (id, score1, score2) => {
		const itemA: Item = { id, score: score1 };
		const itemB: Item = { id, score: score2 };
		expect(byId(itemA, itemB)).toBe(true);
	}));
});

// ---------------------------------------------------------------------------
// and
// ---------------------------------------------------------------------------

test("and: is idempotent and satisfies boolean conjunction", () => {
	const eq = Equality.number;
	const combined = pipe(eq, Equality.and(eq));

	fc.assert(fc.property(fc.integer(), fc.integer(), (a, b) => {
		expect(combined(a, b)).toBe(eq(a, b));
	}));
});

// ---------------------------------------------------------------------------
// struct and tuple
// ---------------------------------------------------------------------------

test("struct: satisfies reflexivity and symmetry for record structures", () => {
	type Point = { readonly x: number; readonly y: number; };
	const pointEq = Equality.struct<Point>({ x: Equality.number, y: Equality.number });

	fc.assert(fc.property(fc.integer(), fc.integer(), (x, y) => {
		const p: Point = { x, y };
		expect(pointEq(p, { x, y })).toBe(true);
	}));
});

test("tuple: satisfies reflexivity and symmetry for tuples", () => {
	const pairEq = Equality.tuple(Equality.string, Equality.number);

	fc.assert(fc.property(fc.string(), fc.integer(), (str, num) => {
		expect(pairEq([str, num], [str, num])).toBe(true);
	}));
});
