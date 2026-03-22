import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { flow } from "../flow.ts";
import { Option } from "../../Core/Option.ts";

Deno.test("flow - single function wraps it", () => {
	const double = flow((n: number) => n * 2);
	assertStrictEquals(double(5), 10);
});

Deno.test("flow - two functions execute left-to-right", () => {
	const addOneThenDouble = flow(
		(n: number) => n + 1,
		(n: number) => n * 2,
	);
	// 5 + 1 = 6, 6 * 2 = 12
	assertStrictEquals(addOneThenDouble(5), 12);
});

Deno.test("flow - three functions execute left-to-right", () => {
	const fn = flow(
		(n: number) => n + 1,
		(n: number) => n * 2,
		(n: number) => `Result: ${n}`,
	);
	assertStrictEquals(fn(5), "Result: 12");
});

Deno.test("flow - left-to-right order confirmed", () => {
	const log: string[] = [];
	const a = (x: string) => {
		log.push("a");
		return x;
	};
	const b = (x: string) => {
		log.push("b");
		return x;
	};
	const c = (x: string) => {
		log.push("c");
		return x;
	};

	flow(a, b, c)("");
	assertEquals(log, ["a", "b", "c"]);
});

Deno.test("flow - reusability of created function", () => {
	const process = flow(
		(s: string) => s.trim(),
		(s: string) => s.toLowerCase(),
		(s: string) => s.replace(/\s+/g, "-"),
	);

	assertStrictEquals(process("  Hello World  "), "hello-world");
	assertStrictEquals(process("FOO BAR"), "foo-bar");
	assertStrictEquals(process("  Already Clean"), "already-clean");
});

Deno.test("flow - multi-argument first function", () => {
	const add = flow(
		(a: number, b: number) => a + b,
		(sum: number) => sum * 10,
	);
	assertStrictEquals(add(3, 4), 70);
});

Deno.test("flow - multi-argument first function with three args", () => {
	const fn = flow(
		(a: number, b: number, c: number) => a + b + c,
		(sum: number) => `Sum: ${sum}`,
	);
	assertStrictEquals(fn(1, 2, 3), "Sum: 6");
});

Deno.test("flow - integration with Option", () => {
	const safeParseAndDouble = flow(
		(s: string) => {
			const n = parseInt(s, 10);
			return isNaN(n) ? (Option.none() as Option<number>) : Option.some(n);
		},
		Option.map((n: number) => n * 2),
		Option.getOrElse(() => 0),
	);

	assertStrictEquals(safeParseAndDouble("21"), 42);
	assertStrictEquals(safeParseAndDouble("abc"), 0);
});

Deno.test("flow - can be used as argument to higher-order functions", () => {
	const transform = flow(
		(n: number) => n * 2,
		(n: number) => n + 1,
	);

	const results = [1, 2, 3].map(transform);
	assertEquals(results, [3, 5, 7]);
});

Deno.test("flow - type transformation across functions", () => {
	const fn = flow(
		(n: number) => String(n),
		(s: string) => s.length,
		(len: number) => len > 1,
	);
	assertStrictEquals(fn(5), false);
	assertStrictEquals(fn(10), true);
});

// ---------------------------------------------------------------------------
// zero-function edge case (exercises the implementation's defensive guard)
// ---------------------------------------------------------------------------

Deno.test("flow - zero functions returns the first argument unchanged", () => {
	// The typed overloads don't expose flow() with no arguments, but the
	// underlying implementation has a defensive guard: if no functions are
	// provided, return the first argument as-is.
	const identity = (
		flow as (
			...fns: Array<(...a: unknown[]) => unknown>
		) => (...a: unknown[]) => unknown
	)();
	assertStrictEquals(identity(42), 42);
	assertStrictEquals(identity("hello"), "hello");
});
