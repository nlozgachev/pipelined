import { pipe } from "#composition/pipe.ts";
import { Maybe } from "#core/Maybe.ts";
import { expect, test } from "vitest";
import { Arr } from "../Arr.ts";
import { Num } from "../Num.ts";

// ---------------------------------------------------------------------------
// range
// ---------------------------------------------------------------------------

test("Num.range produces integers from start to end (both inclusive)", () => {
	expect(Num.range(0, 5)).toEqual([0, 1, 2, 3, 4, 5]);
});

test("Num.range with step produces every nth integer up to and including to", () => {
	expect(Num.range(0, 10, 2)).toEqual([0, 2, 4, 6, 8, 10]);
	expect(Num.range(0, 9, 2)).toEqual([0, 2, 4, 6, 8]);
});

test("Num.range returns empty array when from > to", () => {
	expect(Num.range(5, 0)).toEqual([]);
});

test("Num.range returns single element when from equals to", () => {
	expect(Num.range(3, 3)).toEqual([3]);
	expect(Num.range(3, 3, 2)).toEqual([3]);
});

test("Num.range returns empty array for non-positive step", () => {
	expect(Num.range(0, 5, 0)).toEqual([]);
	expect(Num.range(0, 5, -1)).toEqual([]);
});

test("Num.range with step 1 matches default behaviour", () => {
	expect(Num.range(1, 4, 1)).toEqual(Num.range(1, 4));
});

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

test("Num.clamp returns value unchanged when within bounds", () => {
	expect(pipe(42, Num.clamp(0, 100))).toBe(42);
});

test("Num.clamp returns min when value is below range", () => {
	expect(pipe(-5, Num.clamp(0, 100))).toBe(0);
});

test("Num.clamp returns max when value is above range", () => {
	expect(pipe(150, Num.clamp(0, 100))).toBe(100);
});

test("Num.clamp returns min == max when they are equal", () => {
	expect(pipe(99, Num.clamp(50, 50))).toBe(50);
});

// ---------------------------------------------------------------------------
// between
// ---------------------------------------------------------------------------

test("Num.between returns true when value is inside range (inclusive)", () => {
	expect(pipe(5, Num.between(1, 10))).toBe(true);
	expect(pipe(1, Num.between(1, 10))).toBe(true);
	expect(pipe(10, Num.between(1, 10))).toBe(true);
});

test("Num.between returns false when value is outside range", () => {
	expect(pipe(0, Num.between(1, 10))).toBe(false);
	expect(pipe(11, Num.between(1, 10))).toBe(false);
});

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

test("Num.parse returns Some for a valid integer string", () => {
	expect(Num.parse("42")).toEqual(Maybe.some(42));
});

test("Num.parse returns Some for a valid float string", () => {
	expect(Num.parse("3.14")).toEqual(Maybe.some(3.14));
});

test("Num.parse returns None for a non-numeric string", () => {
	expect(Num.parse("abc")).toEqual(Maybe.none());
});

test("Num.parse returns None for an empty string", () => {
	expect(Num.parse("")).toEqual(Maybe.none());
});

test("Num.parse returns None for a whitespace-only string", () => {
	expect(Num.parse("   ")).toEqual(Maybe.none());
});

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

test("Num.add adds the operand to the value", () => {
	expect(pipe(5, Num.add(3))).toBe(8);
});

test("Num.add composes with Arr.map", () => {
	expect(pipe([1, 2, 3], Arr.map(Num.add(10)))).toEqual([11, 12, 13]);
});

// ---------------------------------------------------------------------------
// subtract
// ---------------------------------------------------------------------------

test("Num.subtract subtracts the operand from the value", () => {
	expect(pipe(10, Num.subtract(3))).toBe(7);
});

test("Num.subtract composes with Arr.map", () => {
	expect(pipe([5, 10, 15], Arr.map(Num.subtract(2)))).toEqual([3, 8, 13]);
});

// ---------------------------------------------------------------------------
// multiply
// ---------------------------------------------------------------------------

test("Num.multiply multiplies the value by the operand", () => {
	expect(pipe(6, Num.multiply(7))).toBe(42);
});

test("Num.multiply composes with Arr.map", () => {
	expect(pipe([1, 2, 3], Arr.map(Num.multiply(100)))).toEqual([100, 200, 300]);
});

// ---------------------------------------------------------------------------
// divide
// ---------------------------------------------------------------------------

test("Num.divide divides the value by the operand", () => {
	expect(pipe(20, Num.divide(4))).toBe(5);
});

test("Num.divide composes with Arr.map", () => {
	expect(pipe([10, 20, 30], Arr.map(Num.divide(10)))).toEqual([1, 2, 3]);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Num pipe composition - range, map, filter", () => {
	const result = pipe(
		Num.range(1, 10),
		Arr.map(Num.multiply(2)),
		Arr.filter(Num.between(6, 14)),
	);
	expect(result).toEqual([6, 8, 10, 12, 14]);
});
