import { expect, test } from "vitest";
import { juxt } from "../juxt.ts";
import { pipe } from "../pipe.ts";

// --- juxt ---

test("juxt: applies input to two functions returning tuple", () => {
	const nameParts = juxt([(name: string) => name.split(" ")[0], (name: string) => name.split(" ").slice(1).join(" ")]);

	expect(nameParts("Alice Smith")).toStrictEqual(["Alice", "Smith"]);
});

test("juxt: applies input across three functions", () => {
	const numberInfo = juxt([(n: number) => n * 2, (n: number) => n * n, (n: number) => -n]);

	expect(numberInfo(4)).toStrictEqual([8, 16, -4]);
});

test("juxt: applies input across four functions", () => {
	const stringInfo = juxt([
		(s: string) => s.length,
		(s: string) => s.toUpperCase(),
		(s: string) => s.toLowerCase(),
		(s: string) => [...s].toReversed().join(""),
	]);

	expect(stringInfo("Hello")).toStrictEqual([5, "HELLO", "hello", "olleH"]);
});

test("juxt: provides identical input to all functions", () => {
	const inputs: number[] = [];
	const track = juxt([(n: number) => {
		inputs.push(n);
		return n + 1;
	}, (n: number) => {
		inputs.push(n);
		return n + 2;
	}]);

	track(10);

	expect(inputs).toStrictEqual([10, 10]);
});

test("pipe: integrates in pipeline", () => {
	const result = pipe("pipelined", juxt([(s: string) => s.length, (s: string) => s.toUpperCase()]));

	expect(result).toStrictEqual([9, "PIPELINED"]);
});

test("juxt: preserves homogeneous array return type", () => {
	const transforms: ((n: number) => number)[] = [(n) => n + 1, (n) => n + 2, (n) => n + 3];
	const addAll = juxt(transforms);

	expect(addAll(0)).toStrictEqual([1, 2, 3]);
});
