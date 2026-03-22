import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { tap } from "../tap.ts";
import { pipe } from "../pipe.ts";

Deno.test("tap - side effect executes", () => {
	let sideEffect = 0;
	const fn = tap((n: number) => {
		sideEffect = n;
	});
	fn(42);
	assertStrictEquals(sideEffect, 42);
});

Deno.test("tap - returns original value unchanged", () => {
	const fn = tap((_n: number) => {
		// side effect
	});
	assertStrictEquals(fn(42), 42);
});

Deno.test("tap - returns the exact same reference for objects", () => {
	const obj = { name: "Alice" };
	const fn = tap((_o: typeof obj) => {
		// side effect
	});
	assertStrictEquals(fn(obj), obj);
});

Deno.test("tap - works with string values", () => {
	let captured = "";
	const fn = tap((s: string) => {
		captured = s;
	});
	assertStrictEquals(fn("hello"), "hello");
	assertStrictEquals(captured, "hello");
});

Deno.test("tap - works in pipe", () => {
	const log: number[] = [];

	const result = pipe(
		5,
		(n: number) => n * 2,
		tap((n: number) => log.push(n)),
		(n: number) => n + 1,
		tap((n: number) => log.push(n)),
	);

	assertStrictEquals(result, 11);
	assertEquals(log, [10, 11]);
});

Deno.test("tap - side effect does not influence the return value", () => {
	const fn = tap((_n: number) => {
		return 999; // return value is ignored
	});
	assertStrictEquals(fn(42), 42);
});

Deno.test("tap - multiple taps in sequence", () => {
	const effects: string[] = [];

	const result = pipe(
		"hello",
		tap((s: string) => effects.push(`first: ${s}`)),
		(s: string) => s.toUpperCase(),
		tap((s: string) => effects.push(`second: ${s}`)),
		(s: string) => s + "!",
		tap((s: string) => effects.push(`third: ${s}`)),
	);

	assertStrictEquals(result, "HELLO!");
	assertEquals(effects, ["first: hello", "second: HELLO", "third: HELLO!"]);
});

Deno.test("tap - works with arrays", () => {
	let length = 0;
	const arr = [1, 2, 3];

	const result = pipe(
		arr,
		tap((a: number[]) => {
			length = a.length;
		}),
	);

	assertStrictEquals(result, arr);
	assertStrictEquals(length, 3);
});
