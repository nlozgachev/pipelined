import { expect, test } from "vitest";
import { converge } from "../converge.ts";
import { pipe } from "../pipe.ts";

test("converge - applies input to both transformers and combines results", () => {
	const toRecord = converge(
		(lower: string, upper: string) => ({ lower, upper }),
		[(s: string) => s.toLowerCase(), (s: string) => s.toUpperCase()],
	);

	expect(toRecord("Hello")).toEqual({ lower: "hello", upper: "HELLO" });
});

test("converge - both transformers receive the same input value", () => {
	const inputs: number[] = [];
	const track = converge(
		(a: number, b: number) => a + b,
		[
			(n: number) => {
				inputs.push(n);
				return n * 2;
			},
			(n: number) => {
				inputs.push(n);
				return n * 3;
			},
		],
	);

	track(5);

	expect(inputs).toEqual([5, 5]);
});

test("converge - three transformers", () => {
	const summarise = converge(
		(min: number, max: number, sum: number) => ({ min, max, sum }),
		[
			(ns: number[]) => Math.min(...ns),
			(ns: number[]) => Math.max(...ns),
			(ns: number[]) => ns.reduce((a, b) => a + b, 0),
		],
	);

	expect(summarise([1, 2, 3, 4])).toEqual({ min: 1, max: 4, sum: 10 });
});

test("converge - four transformers", () => {
	const describe = converge(
		(len: number, first: string, last: string, upper: string) => ({ len, first, last, upper }),
		[
			(s: string) => s.length,
			(s: string) => s[0],
			(s: string) => s[s.length - 1],
			(s: string) => s.toUpperCase(),
		],
	);

	expect(describe("hello")).toEqual({ len: 5, first: "h", last: "o", upper: "HELLO" });
});

test("converge - works in a pipe chain", () => {
	const toNameRecord = converge(
		(trimmed: string, initials: string) => ({ trimmed, initials }),
		[
			(name: string) => name.trim(),
			(name: string) => name.split(" ").map((w) => w[0]).join(""),
		],
	);

	const result = pipe("  Alice Bob  ", toNameRecord);

	expect(result).toEqual({ trimmed: "Alice Bob", initials: "AB" });
});
