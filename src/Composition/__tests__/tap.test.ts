import { expect, test } from "vitest";
import { pipe } from "../pipe.ts";
import { tap } from "../tap.ts";

test("tap - side effect executes", () => {
	let sideEffect = 0;
	const fn = tap((n: number) => {
		sideEffect = n;
	});
	fn(42);
	expect(sideEffect).toBe(42);
});

test("tap - returns original value unchanged", () => {
	const fn = tap((_n: number) => {
		// side effect
	});
	expect(fn(42)).toBe(42);
});

test("tap - returns the exact same reference for objects", () => {
	const obj = { name: "Alice" };
	const fn = tap((_o: typeof obj) => {
		// side effect
	});
	expect(fn(obj)).toBe(obj);
});

test("tap - works with string values", () => {
	let captured = "";
	const fn = tap((s: string) => {
		captured = s;
	});
	expect(fn("hello")).toBe("hello");
	expect(captured).toBe("hello");
});

test("tap - works in pipe", () => {
	const log: number[] = [];

	const result = pipe(
		5,
		(n: number) => n * 2,
		tap((n: number) => log.push(n)),
		(n: number) => n + 1,
		tap((n: number) => log.push(n)),
	);

	expect(result).toBe(11);
	expect(log).toEqual([10, 11]);
});

test("tap - side effect does not influence the return value", () => {
	const fn = tap((_n: number) => 999); // return value is ignored
	expect(fn(42)).toBe(42);
});

test("tap - multiple taps in sequence", () => {
	const effects: string[] = [];

	const result = pipe(
		"hello",
		tap((s: string) => effects.push(`first: ${s}`)),
		(s: string) => s.toUpperCase(),
		tap((s: string) => effects.push(`second: ${s}`)),
		(s: string) => `${s}!`,
		tap((s: string) => effects.push(`third: ${s}`)),
	);

	expect(result).toBe("HELLO!");
	expect(effects).toEqual(["first: hello", "second: HELLO", "third: HELLO!"]);
});

test("tap - works with arrays", () => {
	let length = 0;
	const arr = [1, 2, 3];

	const result = pipe(
		arr,
		tap((a: number[]) => {
			({ length } = a);
		}),
	);

	expect(result).toBe(arr);
	expect(length).toBe(3);
});
