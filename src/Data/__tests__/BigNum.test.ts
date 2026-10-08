import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { BigNum } from "../BigNum.ts";

// --- is ---

test("is.zero: returns true only for 0n", () => {
	expect(BigNum.is.zero(0n)).toBe(true);
	expect(BigNum.is.zero(1n)).toBe(false);
	expect(BigNum.is.zero(-1n)).toBe(false);
});

test("is.even: checks parity alongside is.odd", () => {
	expect(BigNum.is.even(4n)).toBe(true);
	expect(BigNum.is.even(3n)).toBe(false);
	expect(BigNum.is.even(0n)).toBe(true);
	expect(BigNum.is.even(-2n)).toBe(true);

	expect(BigNum.is.odd(3n)).toBe(true);
	expect(BigNum.is.odd(4n)).toBe(false);
	expect(BigNum.is.odd(0n)).toBe(false);
	expect(BigNum.is.odd(-3n)).toBe(true);
});

test("is.positive: checks sign alongside is.negative", () => {
	expect(BigNum.is.positive(5n)).toBe(true);
	expect(BigNum.is.positive(0n)).toBe(false);
	expect(BigNum.is.positive(-5n)).toBe(false);

	expect(BigNum.is.negative(-5n)).toBe(true);
	expect(BigNum.is.negative(0n)).toBe(false);
	expect(BigNum.is.negative(5n)).toBe(false);
});

// --- from.string ---

test("from.string: parses valid string into bigint", () => {
	expect(BigNum.from.string("123")).toStrictEqual({ kind: "Some", value: 123n });
});

test("from.string: returns None for invalid string or empty string", () => {
	expect(BigNum.from.string("abc")).toStrictEqual({ kind: "None" });
	expect(BigNum.from.string("  ")).toStrictEqual({ kind: "None" });
});

// --- from.number ---

test("from.number: converts safe integers to bigint", () => {
	expect(BigNum.from.number(42)).toStrictEqual({ kind: "Some", value: 42n });
});

test("from.number: returns None for floats or non-safe integers", () => {
	expect(BigNum.from.number(3.14)).toStrictEqual({ kind: "None" });
	expect(BigNum.from.number(NaN)).toStrictEqual({ kind: "None" });
	expect(BigNum.from.number(9007199254740992)).toStrictEqual({ kind: "None" });
});

// --- to.number ---

test("to.number: converts bigint within safe range to number", () => {
	expect(BigNum.to.number(42n)).toStrictEqual({ kind: "Some", value: 42 });
});

test("to.number: returns None for bigint outside safe range", () => {
	expect(BigNum.to.number(9007199254740993n)).toStrictEqual({ kind: "None" });
});

// --- arithmetic ---

test("add: adds two bigints", () => {
	expect(pipe(10n, BigNum.add(5n))).toBe(15n);
});

test("subtract: subtracts b from a", () => {
	expect(pipe(10n, BigNum.subtract(3n))).toBe(7n);
});

test("multiply: multiplies two bigints", () => {
	expect(pipe(6n, BigNum.multiply(7n))).toBe(42n);
});

test("divide: divides a by b and returns None on zero division", () => {
	expect(pipe(20n, BigNum.divide(4n))).toStrictEqual({ kind: "Some", value: 5n });
	expect(pipe(20n, BigNum.divide(0n))).toStrictEqual({ kind: "None" });
});

test("remainder: returns remainder and returns None on zero divisor", () => {
	expect(pipe(10n, BigNum.remainder(3n))).toStrictEqual({ kind: "Some", value: 1n });
	expect(pipe(10n, BigNum.remainder(0n))).toStrictEqual({ kind: "None" });
});

test("between: checks inclusive range", () => {
	expect(pipe(5n, BigNum.between(1n, 10n))).toBe(true);
	expect(pipe(1n, BigNum.between(1n, 10n))).toBe(true);
	expect(pipe(10n, BigNum.between(1n, 10n))).toBe(true);
	expect(pipe(0n, BigNum.between(1n, 10n))).toBe(false);
	expect(pipe(11n, BigNum.between(1n, 10n))).toBe(false);
});

test("clamp: clamps a bigint within range", () => {
	expect(pipe(150n, BigNum.clamp(0n, 100n))).toBe(100n);
	expect(pipe(-5n, BigNum.clamp(0n, 100n))).toBe(0n);
	expect(pipe(42n, BigNum.clamp(0n, 100n))).toBe(42n);
});

test("inRange: checks half-open range", () => {
	expect(pipe(5n, BigNum.inRange(1n, 10n))).toBe(true);
	expect(pipe(10n, BigNum.inRange(1n, 10n))).toBe(false);
});

test("abs: returns absolute value", () => {
	expect(BigNum.abs(-42n)).toBe(42n);
	expect(BigNum.abs(42n)).toBe(42n);
});

test("min: compares two bigints alongside max", () => {
	expect(pipe(10n, BigNum.min(5n))).toBe(5n);
	expect(pipe(2n, BigNum.min(5n))).toBe(2n);
	expect(pipe(10n, BigNum.max(20n))).toBe(20n);
	expect(pipe(30n, BigNum.max(20n))).toBe(30n);
});
