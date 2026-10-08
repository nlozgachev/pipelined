import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Arr } from "../Arr.ts";
import { Num } from "../Num.ts";

// ---------------------------------------------------------------------------
// is
// ---------------------------------------------------------------------------

test("is.zero: identifies zero correctly", () => {
	expect(Num.is.zero(0)).toBe(true);
	expect(Num.is.zero(-0)).toBe(true);
	expect(Num.is.zero(1)).toBe(false);
	expect(Num.is.zero(-1)).toBe(false);
});

test("is.integer: identifies whole integers", () => {
	expect(Num.is.integer(5)).toBe(true);
	expect(Num.is.integer(-10)).toBe(true);
	expect(Num.is.integer(0)).toBe(true);
	expect(Num.is.integer(3.14)).toBe(false);
	expect(Num.is.integer(NaN)).toBe(false);
	expect(Num.is.integer(Infinity)).toBe(false);
});

test("is.float: identifies finite floats", () => {
	expect(Num.is.float(3.14)).toBe(true);
	expect(Num.is.float(-0.5)).toBe(true);
	expect(Num.is.float(5)).toBe(false);
	expect(Num.is.float(0)).toBe(false);
	expect(Num.is.float(NaN)).toBe(false);
	expect(Num.is.float(Infinity)).toBe(false);
});

test("is.finite: identifies finite numbers", () => {
	expect(Num.is.finite(42)).toBe(true);
	expect(Num.is.finite(-3.14)).toBe(true);
	expect(Num.is.finite(0)).toBe(true);
	expect(Num.is.finite(Infinity)).toBe(false);
	expect(Num.is.finite(-Infinity)).toBe(false);
	expect(Num.is.finite(NaN)).toBe(false);
});

test("is.nan: identifies NaN", () => {
	expect(Num.is.nan(NaN)).toBe(true);
	expect(Num.is.nan(42)).toBe(false);
	expect(Num.is.nan(Infinity)).toBe(false);
});

test("is.even: identifies even integers", () => {
	expect(Num.is.even(4)).toBe(true);
	expect(Num.is.even(-2)).toBe(true);
	expect(Num.is.even(0)).toBe(true);
	expect(Num.is.even(3)).toBe(false);
	expect(Num.is.even(-1)).toBe(false);
	expect(Num.is.even(2.5)).toBe(false);
});

test("is.odd: identifies odd integers", () => {
	expect(Num.is.odd(3)).toBe(true);
	expect(Num.is.odd(-1)).toBe(true);
	expect(Num.is.odd(4)).toBe(false);
	expect(Num.is.odd(0)).toBe(false);
	expect(Num.is.odd(2.5)).toBe(false);
});

test("is.positive: identifies positive numbers", () => {
	expect(Num.is.positive(5)).toBe(true);
	expect(Num.is.positive(0.1)).toBe(true);
	expect(Num.is.positive(0)).toBe(false);
	expect(Num.is.positive(-5)).toBe(false);
});

test("is.negative: identifies negative numbers", () => {
	expect(Num.is.negative(-5)).toBe(true);
	expect(Num.is.negative(-0.1)).toBe(true);
	expect(Num.is.negative(0)).toBe(false);
	expect(Num.is.negative(5)).toBe(false);
});

// ---------------------------------------------------------------------------
// range
// ---------------------------------------------------------------------------

test("range: produces integers from start to end inclusive", () => {
	expect(Num.range(0, 5)).toStrictEqual([0, 1, 2, 3, 4, 5]);
});

test("range: produces every nth integer with custom step", () => {
	expect(Num.range(0, 10, 2)).toStrictEqual([0, 2, 4, 6, 8, 10]);
	expect(Num.range(0, 9, 2)).toStrictEqual([0, 2, 4, 6, 8]);
});

test("range: returns empty array when start exceeds end", () => {
	expect(Num.range(5, 0)).toStrictEqual([]);
});

test("range: returns single element when start equals end", () => {
	expect(Num.range(3, 3)).toStrictEqual([3]);
	expect(Num.range(3, 3, 2)).toStrictEqual([3]);
});

test("range: returns empty array for non-positive step", () => {
	expect(Num.range(0, 5, 0)).toStrictEqual([]);
	expect(Num.range(0, 5, -1)).toStrictEqual([]);
});

test("range: matches default behavior when step is 1", () => {
	expect(Num.range(1, 4, 1)).toStrictEqual(Num.range(1, 4));
});

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

test("clamp: returns value unchanged when within bounds", () => {
	expect(pipe(42, Num.clamp(0, 100))).toBe(42);
});

test("clamp: returns min when value is below range", () => {
	expect(pipe(-5, Num.clamp(0, 100))).toBe(0);
});

test("clamp: returns max when value is above range", () => {
	expect(pipe(150, Num.clamp(0, 100))).toBe(100);
});

test("clamp: returns bound when min and max are equal", () => {
	expect(pipe(99, Num.clamp(50, 50))).toBe(50);
});

// ---------------------------------------------------------------------------
// between
// ---------------------------------------------------------------------------

test("between: returns true when value is inside inclusive range", () => {
	expect(pipe(5, Num.between(1, 10))).toBe(true);
	expect(pipe(1, Num.between(1, 10))).toBe(true);
	expect(pipe(10, Num.between(1, 10))).toBe(true);
});

test("between: returns false when value is outside range", () => {
	expect(pipe(0, Num.between(1, 10))).toBe(false);
	expect(pipe(11, Num.between(1, 10))).toBe(false);
});

// ---------------------------------------------------------------------------
// inRange
// ---------------------------------------------------------------------------

test("inRange: returns true when value is inside half-open range", () => {
	expect(pipe(5, Num.inRange(1, 10))).toBe(true);
	expect(pipe(1, Num.inRange(1, 10))).toBe(true);
});

test("inRange: returns false when value is outside range or on upper boundary", () => {
	expect(pipe(0, Num.inRange(1, 10))).toBe(false);
	expect(pipe(10, Num.inRange(1, 10))).toBe(false);
	expect(pipe(11, Num.inRange(1, 10))).toBe(false);
});

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

test("parse: returns Some for valid integer string", () => {
	expect(Num.parse("42")).toStrictEqual(Maybe.make.some(42));
});

test("parse: returns Some for valid float string", () => {
	expect(Num.parse("3.14")).toStrictEqual(Maybe.make.some(3.14));
});

test("parse: returns None for non-numeric string", () => {
	expect(Num.parse("abc")).toStrictEqual(Maybe.make.none());
});

test("parse: returns None for empty string", () => {
	expect(Num.parse("")).toStrictEqual(Maybe.make.none());
});

test("parse: returns None for whitespace-only string", () => {
	expect(Num.parse("   ")).toStrictEqual(Maybe.make.none());
});

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

test("add: adds operand to value", () => {
	expect(pipe(5, Num.add(3))).toBe(8);
});

test("add: composes with Arr.map", () => {
	expect(pipe([1, 2, 3], Arr.map(Num.add(10)))).toStrictEqual([11, 12, 13]);
});

// ---------------------------------------------------------------------------
// subtract
// ---------------------------------------------------------------------------

test("subtract: subtracts operand from value", () => {
	expect(pipe(10, Num.subtract(3))).toBe(7);
});

test("subtract: composes with Arr.map", () => {
	expect(pipe([5, 10, 15], Arr.map(Num.subtract(2)))).toStrictEqual([3, 8, 13]);
});

// ---------------------------------------------------------------------------
// multiply
// ---------------------------------------------------------------------------

test("multiply: multiplies value by operand", () => {
	expect(pipe(6, Num.multiply(7))).toBe(42);
});

test("multiply: composes with Arr.map", () => {
	expect(pipe([1, 2, 3], Arr.map(Num.multiply(100)))).toStrictEqual([100, 200, 300]);
});

// ---------------------------------------------------------------------------
// divide
// ---------------------------------------------------------------------------

test("divide: returns Some for non-zero divisor", () => {
	expect(pipe(20, Num.divide(4))).toStrictEqual(Maybe.make.some(5));
});

test("divide: returns None when divisor is zero", () => {
	expect(pipe(5, Num.divide(0))).toStrictEqual(Maybe.make.none());
});

test("divide: composes with Arr.filterMap", () => {
	expect(pipe([10, 20, 30], Arr.filterMap(Num.divide(10)))).toStrictEqual([1, 2, 3]);
});

// ---------------------------------------------------------------------------
// abs
// ---------------------------------------------------------------------------

test("abs: returns absolute value of positive number", () => {
	expect(pipe(5, Num.abs)).toBe(5);
});

test("abs: returns absolute value of negative number", () => {
	expect(pipe(-5, Num.abs)).toBe(5);
});

test("abs: returns zero for zero", () => {
	expect(pipe(0, Num.abs)).toBe(0);
});

test("abs: composes with Arr.map", () => {
	expect(pipe([-1, -2, 3], Arr.map(Num.abs))).toStrictEqual([1, 2, 3]);
});

// ---------------------------------------------------------------------------
// negate
// ---------------------------------------------------------------------------

test("negate: negates positive number", () => {
	expect(pipe(5, Num.negate)).toBe(-5);
});

test("negate: negates negative number", () => {
	expect(pipe(-5, Num.negate)).toBe(5);
});

test("negate: composes with Arr.map", () => {
	expect(pipe([1, 2, 3], Arr.map(Num.negate))).toStrictEqual([-1, -2, -3]);
});

// ---------------------------------------------------------------------------
// round
// ---------------------------------------------------------------------------

test("round: rounds to nearest integer upward", () => {
	expect(pipe(3.5, Num.round)).toBe(4);
});

test("round: rounds to nearest integer downward", () => {
	expect(pipe(3.4, Num.round)).toBe(3);
});

test("round: returns integer unchanged", () => {
	expect(pipe(5, Num.round)).toBe(5);
});

// ---------------------------------------------------------------------------
// floor
// ---------------------------------------------------------------------------

test("floor: rounds down to integer", () => {
	expect(pipe(3.9, Num.floor)).toBe(3);
});

test("floor: rounds down negative floats", () => {
	expect(pipe(-3.2, Num.floor)).toBe(-4);
});

test("floor: returns integer unchanged", () => {
	expect(pipe(5, Num.floor)).toBe(5);
});

// ---------------------------------------------------------------------------
// ceil
// ---------------------------------------------------------------------------

test("ceil: rounds up to integer", () => {
	expect(pipe(3.1, Num.ceil)).toBe(4);
});

test("ceil: rounds up negative floats toward zero", () => {
	expect(pipe(-3.9, Num.ceil)).toBe(-3);
});

test("ceil: returns integer unchanged", () => {
	expect(pipe(5, Num.ceil)).toBe(5);
});

// ---------------------------------------------------------------------------
// remainder
// ---------------------------------------------------------------------------

test("remainder: returns Some for remainder of division", () => {
	expect(pipe(10, Num.remainder(3))).toStrictEqual(Maybe.make.some(1));
});

test("remainder: returns Some(0) when evenly divisible", () => {
	expect(pipe(9, Num.remainder(3))).toStrictEqual(Maybe.make.some(0));
});

test("remainder: returns None when divisor is zero", () => {
	expect(pipe(5, Num.remainder(0))).toStrictEqual(Maybe.make.none());
});

test("remainder: composes with Arr.filterMap", () => {
	expect(pipe([10, 11, 12], Arr.filterMap(Num.remainder(3)))).toStrictEqual([1, 2, 0]);
});

// ---------------------------------------------------------------------------
// sum
// ---------------------------------------------------------------------------

test("sum: computes sum of numbers", () => {
	expect(Num.sum([1, 2, 3])).toBe(6);
	expect(Num.sum([-1, 2, -3.5])).toBe(-2.5);
});

test("sum: returns 0 for empty array", () => {
	expect(Num.sum([])).toBe(0);
});

// ---------------------------------------------------------------------------
// mean
// ---------------------------------------------------------------------------

test("mean: computes mean of numbers", () => {
	expect(Num.mean([1, 2, 3])).toStrictEqual(Maybe.make.some(2));
	expect(Num.mean([1.5, 2.5, 5])).toStrictEqual(Maybe.make.some(3));
});

test("mean: returns None for empty array", () => {
	expect(Num.mean([])).toStrictEqual(Maybe.make.none());
});

// ---------------------------------------------------------------------------
// min
// ---------------------------------------------------------------------------

test("min: computes minimum of numbers", () => {
	expect(Num.min([5, 1, 3])).toStrictEqual(Maybe.make.some(1));
	expect(Num.min([-1.5, -5, -3])).toStrictEqual(Maybe.make.some(-5));
});

test("min: returns None for empty array", () => {
	expect(Num.min([])).toStrictEqual(Maybe.make.none());
});

// ---------------------------------------------------------------------------
// max
// ---------------------------------------------------------------------------

test("max: computes maximum of numbers", () => {
	expect(Num.max([1, 5, 3])).toStrictEqual(Maybe.make.some(5));
	expect(Num.max([-1.5, -5, -3])).toStrictEqual(Maybe.make.some(-1.5));
});

test("max: returns None for empty array", () => {
	expect(Num.max([])).toStrictEqual(Maybe.make.none());
});

// ---------------------------------------------------------------------------
// collection folding pipe composition
// ---------------------------------------------------------------------------

test("sum: composes with range in pipe workflow", () => {
	const result = pipe(Num.range(1, 5), Num.sum);
	expect(result).toBe(15);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes range map and filter transformations", () => {
	const result = pipe(Num.range(1, 10), Arr.map(Num.multiply(2)), Arr.filter(Num.between(6, 14)));
	expect(result).toStrictEqual([6, 8, 10, 12, 14]);
});

// ---------------------------------------------------------------------------
// format
// ---------------------------------------------------------------------------

test("format: formats finite number into string", () => {
	const fmt = Num.format({ style: "decimal" }, "en-US");
	expect(fmt(1234.5)).toStrictEqual(Maybe.make.some("1,234.5"));
});

test("format: returns None for NaN or non-finite numbers", () => {
	const fmt = Num.format();
	expect(fmt(NaN)).toStrictEqual(Maybe.make.none());
	expect(fmt(Infinity)).toStrictEqual(Maybe.make.none());
});
