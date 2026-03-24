import { expect, test } from "vitest";
import { Maybe } from "../../Core/Maybe.ts";
import { Result } from "../../Core/Result.ts";
import { pipe } from "../pipe.ts";

test("pipe - single value (identity)", () => {
	expect(pipe(42)).toBe(42);
	expect(pipe("hello")).toBe("hello");
	expect(pipe(true)).toBe(true);
	expect(pipe(null)).toBeNull();
	expect(pipe(undefined)).toBeUndefined();
});

test("pipe - single function transformation", () => {
	const result = pipe(5, (n: number) => n * 2);
	expect(result).toBe(10);
});

test("pipe - two function transformations", () => {
	const result = pipe(
		5,
		(n: number) => n * 2,
		(n: number) => n + 1,
	);
	expect(result).toBe(11);
});

test("pipe - three function transformations", () => {
	const result = pipe(
		"hello",
		(s: string) => s.toUpperCase(),
		(s: string) => `${s}!`,
		(s: string) => s.length,
	);
	expect(result).toBe(6);
});

test("pipe - type preservation through number chain", () => {
	const result = pipe(
		10,
		(n: number) => n / 2,
		(n: number) => n + 0.5,
	);
	expect(result).toBe(5.5);
});

test("pipe - type transformation through chain", () => {
	const result = pipe(
		42,
		(n: number) => String(n),
		(s: string) => s.split(""),
		(arr: string[]) => arr.length,
	);
	expect(result).toBe(2);
});

test("pipe - integration with Maybe.map", () => {
	const result = pipe(
		Maybe.some(5),
		Maybe.map((n: number) => n * 2),
		Maybe.map((n: number) => n + 1),
		Maybe.getOrElse(() => 0),
	);
	expect(result).toBe(11);
});

test("pipe - integration with Maybe.map on None", () => {
	const result = pipe(
		Maybe.none() as Maybe<number>,
		Maybe.map((n: number) => n * 2),
		Maybe.getOrElse(() => 0),
	);
	expect(result).toBe(0);
});

test("pipe - integration with Result.map on Ok", () => {
	const result = pipe(
		Result.ok<number>(10),
		Result.map((n: number) => n * 3),
		Result.getOrElse(() => 0),
	);
	expect(result).toBe(30);
});

test("pipe - integration with Result.map on Err", () => {
	const result = pipe(
		Result.err("oops") as Result<string, number>,
		Result.map((n: number) => n * 3),
		Result.getOrElse(() => 0),
	);
	expect(result).toBe(0);
});

test("pipe - works with objects", () => {
	const result = pipe(
		{ name: "Alice", age: 30 },
		(user) => user.name,
		(name) => name.toUpperCase(),
	);
	expect(result).toBe("ALICE");
});

test("pipe - works with arrays", () => {
	const result = pipe(
		[1, 2, 3, 4, 5],
		(arr) => arr.filter((n) => n % 2 === 0),
		(arr) => arr.reduce((a, b) => a + b, 0),
	);
	expect(result).toBe(6);
});

// ---------------------------------------------------------------------------
// switch case coverage (one test per step count to keep every case reachable)
// ---------------------------------------------------------------------------

const inc = (n: number) => n + 1;

test("pipe - 4 functions", () => {
	expect(pipe(0, inc, inc, inc, inc)).toBe(4);
});
test("pipe - 5 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc)).toBe(5);
});
test("pipe - 6 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc)).toBe(6);
});
test("pipe - 7 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc, inc)).toBe(7);
});
test("pipe - 8 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc, inc, inc)).toBe(8);
});
test("pipe - 9 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc, inc, inc, inc)).toBe(9);
});
test("pipe - 10 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc, inc, inc, inc, inc)).toBe(10);
});
