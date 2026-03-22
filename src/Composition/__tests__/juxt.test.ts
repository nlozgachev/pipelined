import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { juxt } from "../juxt.ts";
import { pipe } from "../pipe.ts";

Deno.test("juxt - applies input to two functions and returns a tuple", () => {
	const nameParts = juxt([
		(name: string) => name.split(" ")[0],
		(name: string) => name.split(" ").slice(1).join(" "),
	]);

	assertEquals(nameParts("Alice Smith"), ["Alice", "Smith"]);
});

Deno.test("juxt - applies input to three functions", () => {
	const numberInfo = juxt([
		(n: number) => n * 2,
		(n: number) => n * n,
		(n: number) => -n,
	]);

	assertEquals(numberInfo(4), [8, 16, -4]);
});

Deno.test("juxt - applies input to four functions", () => {
	const stringInfo = juxt([
		(s: string) => s.length,
		(s: string) => s.toUpperCase(),
		(s: string) => s.toLowerCase(),
		(s: string) => s.split("").reverse().join(""),
	]);

	assertEquals(stringInfo("Hello"), [5, "HELLO", "hello", "olleH"]);
});

Deno.test("juxt - each function receives the same input value", () => {
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

	assertEquals(inputs, [10, 10]);
});

Deno.test("juxt - works in a pipe chain", () => {
	const result = pipe(
		"pipelined",
		juxt([
			(s: string) => s.length,
			(s: string) => s.toUpperCase(),
		]),
	);

	assertEquals(result, [9, "PIPELINED"]);
});

Deno.test("juxt - homogeneous array overload returns typed array", () => {
	const transforms: ((n: number) => number)[] = [
		(n) => n + 1,
		(n) => n + 2,
		(n) => n + 3,
	];
	const addAll = juxt(transforms);

	assertEquals(addAll(0), [1, 2, 3]);
});
