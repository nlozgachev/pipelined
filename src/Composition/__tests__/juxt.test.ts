import { expect, test } from "vitest";
import { juxt } from "../juxt.ts";
import { pipe } from "../pipe.ts";

test("juxt - applies input to two functions and returns a tuple", () => {
	const nameParts = juxt([
		(name: string) => name.split(" ")[0],
		(name: string) => name.split(" ").slice(1).join(" "),
	]);

	expect(nameParts("Alice Smith")).toEqual(["Alice", "Smith"]);
});

test("juxt - applies input to three functions", () => {
	const numberInfo = juxt([
		(n: number) => n * 2,
		(n: number) => n * n,
		(n: number) => -n,
	]);

	expect(numberInfo(4)).toEqual([8, 16, -4]);
});

test("juxt - applies input to four functions", () => {
	const stringInfo = juxt([
		(s: string) => s.length,
		(s: string) => s.toUpperCase(),
		(s: string) => s.toLowerCase(),
		(s: string) => s.split("").reverse().join(""),
	]);

	expect(stringInfo("Hello")).toEqual([5, "HELLO", "hello", "olleH"]);
});

test("juxt - each function receives the same input value", () => {
	const inputs: number[] = [];
	const track = juxt([
		(n: number) => {
			inputs.push(n);
			return n + 1;
		},
		(n: number) => {
			inputs.push(n);
			return n + 2;
		},
	]);

	track(10);

	expect(inputs).toEqual([10, 10]);
});

test("juxt - works in a pipe chain", () => {
	const result = pipe(
		"pipelined",
		juxt([
			(s: string) => s.length,
			(s: string) => s.toUpperCase(),
		]),
	);

	expect(result).toEqual([9, "PIPELINED"]);
});

test("juxt - homogeneous array overload returns typed array", () => {
	const transforms: ((n: number) => number)[] = [
		(n) => n + 1,
		(n) => n + 2,
		(n) => n + 3,
	];
	const addAll = juxt(transforms);

	expect(addAll(0)).toEqual([1, 2, 3]);
});
