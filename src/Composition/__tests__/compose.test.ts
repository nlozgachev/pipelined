import { expect, test } from "vitest";
import { Maybe } from "../../Core/Maybe.ts";
import { Result } from "../../Core/Result.ts";
import { compose } from "../compose.ts";

test("compose: wraps single function", () => {
	const double = compose((n: number) => n * 2);
	expect(double(5)).toBe(10);
});

test("compose: executes two functions right-to-left", () => {
	const addOne = (n: number) => n + 1;
	const double = (n: number) => n * 2;

	// compose(addOne, double) => addOne(double(x))
	const fn = compose(addOne, double);
	expect(fn(5)).toBe(11); // 5 * 2 + 1 = 11
});

test("compose: executes three functions right-to-left", () => {
	const toString = (n: number) => `Value: ${n}`;
	const addOne = (n: number) => n + 1;
	const double = (n: number) => n * 2;

	// compose(toString, addOne, double) => toString(addOne(double(x)))
	const fn = compose(toString, addOne, double);
	expect(fn(5)).toBe("Value: 11"); // 5 * 2 + 1 = 11 => "Value: 11"
});

test("compose: executes right-to-left evaluation order", () => {
	const log: string[] = [];
	const a = (n: number) => {
		log.push("a");
		return n + 1;
	};
	const b = (n: number) => {
		log.push("b");
		return n * 2;
	};
	const c = (n: number) => {
		log.push("c");
		return n + 10;
	};

	const fn = compose(a, b, c);
	const result = fn(5);

	// c runs first: 5 + 10 = 15
	// b runs second: 15 * 2 = 30
	// a runs third: 30 + 1 = 31
	expect(result).toBe(31);
	expect(log).toStrictEqual(["c", "b", "a"]);
});

test("compose: transforms types across steps", () => {
	const length = (s: string) => s.length;
	const toUpper = (s: string) => s.toUpperCase();

	const fn = compose(length, toUpper);
	expect(fn("hello")).toBe(5);
});

test("compose: integrates with Maybe", () => {
	const getOrDefault = Maybe.getOrElse(() => "none");
	const toUpper = Maybe.map((s: string) => s.toUpperCase());

	const fn = compose(getOrDefault, toUpper);

	expect(fn(Maybe.make.some("hello"))).toBe("HELLO");
	expect(fn(Maybe.make.none())).toBe("none");
});

test("compose: integrates with Result", () => {
	const getOrDefault = Result.getOrElse(() => 0);
	const doubleResult = Result.map((n: number) => n * 2);

	const fn = compose(getOrDefault, doubleResult);

	expect(fn(Result.make.ok<number>(5))).toBe(10);
	expect(fn(Result.make.err("err") as Result<string, number>)).toBe(0);
});

// ---------------------------------------------------------------------------
// switch case coverage (one test per step count to keep every case reachable)
// ---------------------------------------------------------------------------

const inc = (n: number) => n + 1;

test("compose: supports 4 functions", () => {
	expect(compose(inc, inc, inc, inc)(0)).toBe(4);
});

test("compose: supports 5 functions", () => {
	expect(compose(inc, inc, inc, inc, inc)(0)).toBe(5);
});

test("compose: supports 6 functions", () => {
	expect(compose(inc, inc, inc, inc, inc, inc)(0)).toBe(6);
});

test("compose: supports 7 functions", () => {
	expect(compose(inc, inc, inc, inc, inc, inc, inc)(0)).toBe(7);
});

test("compose: supports 8 functions", () => {
	expect(compose(inc, inc, inc, inc, inc, inc, inc, inc)(0)).toBe(8);
});

test("compose: supports 9 functions", () => {
	expect(compose(inc, inc, inc, inc, inc, inc, inc, inc, inc)(0)).toBe(9);
});

test("compose: supports 10 functions", () => {
	expect(compose(inc, inc, inc, inc, inc, inc, inc, inc, inc, inc)(0)).toBe(10);
});

test("compose: produces reusable composed function", () => {
	const increment = (n: number) => n + 1;
	const triple = (n: number) => n * 3;

	const fn = compose(increment, triple);
	expect(fn(1)).toBe(4);
	expect(fn(2)).toBe(7);
	expect(fn(10)).toBe(31);
});
