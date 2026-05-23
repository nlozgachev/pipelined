import { pipe } from "#composition/pipe.ts";
import { Maybe } from "#core/Maybe.ts";
import { expect, test } from "vitest";
import { Arr } from "../Arr.ts";
import { Num } from "../Num.ts";

// ---------------------------------------------------------------------------
// range
// ---------------------------------------------------------------------------

test("Num.range produces integers from start to end (both inclusive)", () => {
	expect(Num.range(0, 5)).toStrictEqual([0, 1, 2, 3, 4, 5]);
});

test("Num.range with step produces every nth integer up to and including to", () => {
	expect(Num.range(0, 10, 2)).toStrictEqual([0, 2, 4, 6, 8, 10]);
	expect(Num.range(0, 9, 2)).toStrictEqual([0, 2, 4, 6, 8]);
});

test("Num.range returns empty array when from > to", () => {
	expect(Num.range(5, 0)).toStrictEqual([]);
});

test("Num.range returns single element when from equals to", () => {
	expect(Num.range(3, 3)).toStrictEqual([3]);
	expect(Num.range(3, 3, 2)).toStrictEqual([3]);
});

test("Num.range returns empty array for non-positive step", () => {
	expect(Num.range(0, 5, 0)).toStrictEqual([]);
	expect(Num.range(0, 5, -1)).toStrictEqual([]);
});

test("Num.range with step 1 matches default behaviour", () => {
	expect(Num.range(1, 4, 1)).toStrictEqual(Num.range(1, 4));
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
	expect(Num.parse("42")).toStrictEqual(Maybe.some(42));
});

test("Num.parse returns Some for a valid float string", () => {
	expect(Num.parse("3.14")).toStrictEqual(Maybe.some(3.14));
});

test("Num.parse returns None for a non-numeric string", () => {
	expect(Num.parse("abc")).toStrictEqual(Maybe.none());
});

test("Num.parse returns None for an empty string", () => {
	expect(Num.parse("")).toStrictEqual(Maybe.none());
});

test("Num.parse returns None for a whitespace-only string", () => {
	expect(Num.parse("   ")).toStrictEqual(Maybe.none());
});

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

test("Num.add adds the operand to the value", () => {
	expect(pipe(5, Num.add(3))).toBe(8);
});

test("num.add composes with Arr.map", () => {
	expect(pipe([1, 2, 3], Arr.map(Num.add(10)))).toStrictEqual([11, 12, 13]);
});

// ---------------------------------------------------------------------------
// subtract
// ---------------------------------------------------------------------------

test("Num.subtract subtracts the operand from the value", () => {
	expect(pipe(10, Num.subtract(3))).toBe(7);
});

test("num.subtract composes with Arr.map", () => {
	expect(pipe([5, 10, 15], Arr.map(Num.subtract(2)))).toStrictEqual([3, 8, 13]);
});

// ---------------------------------------------------------------------------
// multiply
// ---------------------------------------------------------------------------

test("Num.multiply multiplies the value by the operand", () => {
	expect(pipe(6, Num.multiply(7))).toBe(42);
});

test("num.multiply composes with Arr.map", () => {
	expect(pipe([1, 2, 3], Arr.map(Num.multiply(100)))).toStrictEqual([100, 200, 300]);
});

// ---------------------------------------------------------------------------
// divide
// ---------------------------------------------------------------------------

test("Num.divide returns Some for non-zero divisor", () => {
	expect(pipe(20, Num.divide(4))).toStrictEqual(Maybe.some(5));
});

test("Num.divide returns None when divisor is zero", () => {
	expect(pipe(5, Num.divide(0))).toStrictEqual(Maybe.none());
});

test("num.divide composes with Arr.filterMap", () => {
	expect(pipe([10, 20, 30], Arr.filterMap(Num.divide(10)))).toStrictEqual([1, 2, 3]);
});

// ---------------------------------------------------------------------------
// abs
// ---------------------------------------------------------------------------

test("Num.abs returns absolute value of positive number", () => {
	expect(pipe(5, Num.abs)).toBe(5);
});

test("Num.abs returns absolute value of negative number", () => {
	expect(pipe(-5, Num.abs)).toBe(5);
});

test("Num.abs returns 0 for 0", () => {
	expect(pipe(0, Num.abs)).toBe(0);
});

test("num.abs composes with Arr.map", () => {
	expect(pipe([-1, -2, 3], Arr.map(Num.abs))).toStrictEqual([1, 2, 3]);
});

// ---------------------------------------------------------------------------
// negate
// ---------------------------------------------------------------------------

test("Num.negate negates a positive number", () => {
	expect(pipe(5, Num.negate)).toBe(-5);
});

test("Num.negate negates a negative number", () => {
	expect(pipe(-5, Num.negate)).toBe(5);
});

test("num.negate composes with Arr.map", () => {
	expect(pipe([1, 2, 3], Arr.map(Num.negate))).toStrictEqual([-1, -2, -3]);
});

// ---------------------------------------------------------------------------
// round
// ---------------------------------------------------------------------------

test("Num.round rounds to nearest integer (up)", () => {
	expect(pipe(3.5, Num.round)).toBe(4);
});

test("Num.round rounds to nearest integer (down)", () => {
	expect(pipe(3.4, Num.round)).toBe(3);
});

test("Num.round returns integer unchanged", () => {
	expect(pipe(5, Num.round)).toBe(5);
});

// ---------------------------------------------------------------------------
// floor
// ---------------------------------------------------------------------------

test("Num.floor rounds down to integer", () => {
	expect(pipe(3.9, Num.floor)).toBe(3);
});

test("Num.floor returns negative integer (rounding down)", () => {
	expect(pipe(-3.2, Num.floor)).toBe(-4);
});

test("Num.floor returns integer unchanged", () => {
	expect(pipe(5, Num.floor)).toBe(5);
});

// ---------------------------------------------------------------------------
// ceil
// ---------------------------------------------------------------------------

test("Num.ceil rounds up to integer", () => {
	expect(pipe(3.1, Num.ceil)).toBe(4);
});

test("Num.ceil returns negative integer (rounding up toward zero)", () => {
	expect(pipe(-3.9, Num.ceil)).toBe(-3);
});

test("Num.ceil returns integer unchanged", () => {
	expect(pipe(5, Num.ceil)).toBe(5);
});

// ---------------------------------------------------------------------------
// remainder
// ---------------------------------------------------------------------------

test("Num.remainder returns Some for the remainder of division", () => {
	expect(pipe(10, Num.remainder(3))).toStrictEqual(Maybe.some(1));
});

test("Num.remainder returns Some(0) when evenly divisible", () => {
	expect(pipe(9, Num.remainder(3))).toStrictEqual(Maybe.some(0));
});

test("Num.remainder returns None when divisor is zero", () => {
	expect(pipe(5, Num.remainder(0))).toStrictEqual(Maybe.none());
});

test("num.remainder composes with Arr.filterMap", () => {
	expect(pipe([10, 11, 12], Arr.filterMap(Num.remainder(3)))).toStrictEqual([1, 2, 0]);
});

// ---------------------------------------------------------------------------
// sum
// ---------------------------------------------------------------------------

test("Num.sum computes the sum of a list of numbers", () => {
	expect(Num.sum([1, 2, 3])).toBe(6);
	expect(Num.sum([-1, 2, -3.5])).toBe(-2.5);
});

test("Num.sum returns 0 for an empty array", () => {
	expect(Num.sum([])).toBe(0);
});

// ---------------------------------------------------------------------------
// mean
// ---------------------------------------------------------------------------

test("Num.mean computes the mean of a list of numbers", () => {
	expect(Num.mean([1, 2, 3])).toStrictEqual(Maybe.some(2));
	expect(Num.mean([1.5, 2.5, 5])).toStrictEqual(Maybe.some(3));
});

test("Num.mean returns None for an empty array", () => {
	expect(Num.mean([])).toStrictEqual(Maybe.none());
});

// ---------------------------------------------------------------------------
// min
// ---------------------------------------------------------------------------

test("Num.min computes the minimum of a list of numbers", () => {
	expect(Num.min([5, 1, 3])).toStrictEqual(Maybe.some(1));
	expect(Num.min([-1.5, -5, -3])).toStrictEqual(Maybe.some(-5));
});

test("Num.min returns None for an empty array", () => {
	expect(Num.min([])).toStrictEqual(Maybe.none());
});

// ---------------------------------------------------------------------------
// max
// ---------------------------------------------------------------------------

test("Num.max computes the maximum of a list of numbers", () => {
	expect(Num.max([1, 5, 3])).toStrictEqual(Maybe.some(5));
	expect(Num.max([-1.5, -5, -3])).toStrictEqual(Maybe.some(-1.5));
});

test("Num.max returns None for an empty array", () => {
	expect(Num.max([])).toStrictEqual(Maybe.none());
});

// ---------------------------------------------------------------------------
// collection folding pipe composition
// ---------------------------------------------------------------------------

test("num folding composes in a pipe", () => {
	const result = pipe(Num.range(1, 5), Num.sum);
	expect(result).toBe(15);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("num pipe composition - range, map, filter", () => {
	const result = pipe(Num.range(1, 10), Arr.map(Num.multiply(2)), Arr.filter(Num.between(6, 14)));
	expect(result).toStrictEqual([6, 8, 10, 12, 14]);
});
