import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { BigNum } from "../BigNum.ts";

// --- from.string ---

test("BigNum.from.string parses valid string into bigint", () => {
	expect(BigNum.from.string("123")).toStrictEqual({ kind: "Some", value: 123n });
});

test("BigNum.from.string returns None for invalid string or empty string", () => {
	expect(BigNum.from.string("abc")).toStrictEqual({ kind: "None" });
	expect(BigNum.from.string("  ")).toStrictEqual({ kind: "None" });
});

// --- from.number ---

test("BigNum.from.number converts safe integers to bigint", () => {
	expect(BigNum.from.number(42)).toStrictEqual({ kind: "Some", value: 42n });
});

test("BigNum.from.number returns None for floats or non-safe integers", () => {
	expect(BigNum.from.number(3.14)).toStrictEqual({ kind: "None" });
	expect(BigNum.from.number(NaN)).toStrictEqual({ kind: "None" });
	expect(BigNum.from.number(9007199254740992)).toStrictEqual({ kind: "None" });
});

// --- to.number ---

test("BigNum.to.number converts bigint within safe range to number", () => {
	expect(BigNum.to.number(42n)).toStrictEqual({ kind: "Some", value: 42 });
});

test("BigNum.to.number returns None for bigint outside safe range", () => {
	expect(BigNum.to.number(9007199254740993n)).toStrictEqual({ kind: "None" });
});

// --- arithmetic ---

test("BigNum.add adds two bigints", () => {
	expect(pipe(10n, BigNum.add(5n))).toBe(15n);
});

test("BigNum.sub subtracts b from a", () => {
	expect(pipe(10n, BigNum.sub(3n))).toBe(7n);
});

test("BigNum.mul multiplies two bigints", () => {
	expect(pipe(6n, BigNum.mul(7n))).toBe(42n);
});

test("BigNum.div divides a by b and returns None on zero division", () => {
	expect(pipe(20n, BigNum.div(4n))).toStrictEqual({ kind: "Some", value: 5n });
	expect(pipe(20n, BigNum.div(0n))).toStrictEqual({ kind: "None" });
});

test("BigNum.mod returns remainder and returns None on zero divisor", () => {
	expect(pipe(10n, BigNum.mod(3n))).toStrictEqual({ kind: "Some", value: 1n });
	expect(pipe(10n, BigNum.mod(0n))).toStrictEqual({ kind: "None" });
});

test("BigNum.clamp clamps a bigint within range", () => {
	expect(pipe(150n, BigNum.clamp(0n, 100n))).toBe(100n);
	expect(pipe(-5n, BigNum.clamp(0n, 100n))).toBe(0n);
	expect(pipe(42n, BigNum.clamp(0n, 100n))).toBe(42n);
});

test("BigNum.inRange checks half-open range", () => {
	expect(pipe(5n, BigNum.inRange(1n, 10n))).toBe(true);
	expect(pipe(10n, BigNum.inRange(1n, 10n))).toBe(false);
});

test("BigNum.abs returns absolute value", () => {
	expect(BigNum.abs(-42n)).toBe(42n);
	expect(BigNum.abs(42n)).toBe(42n);
});

test("BigNum.min and BigNum.max compare two bigints", () => {
	expect(pipe(10n, BigNum.min(5n))).toBe(5n);
	expect(pipe(2n, BigNum.min(5n))).toBe(2n);
	expect(pipe(10n, BigNum.max(20n))).toBe(20n);
	expect(pipe(30n, BigNum.max(20n))).toBe(30n);
});
