import { expect, test } from "vitest";
import { Option } from "../../Core/Option.ts";
import { flow } from "../flow.ts";

test("flow - single function wraps it", () => {
	const double = flow((n: number) => n * 2);
	expect(double(5)).toBe(10);
});

test("flow - two functions execute left-to-right", () => {
	const addOneThenDouble = flow(
		(n: number) => n + 1,
		(n: number) => n * 2,
	);
	// 5 + 1 = 6, 6 * 2 = 12
	expect(addOneThenDouble(5)).toBe(12);
});

test("flow - three functions execute left-to-right", () => {
	const fn = flow(
		(n: number) => n + 1,
		(n: number) => n * 2,
		(n: number) => `Result: ${n}`,
	);
	expect(fn(5)).toBe("Result: 12");
});

test("flow - left-to-right order confirmed", () => {
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
	expect(log).toEqual(["a", "b", "c"]);
});

test("flow - reusability of created function", () => {
	const process = flow(
		(s: string) => s.trim(),
		(s: string) => s.toLowerCase(),
		(s: string) => s.replace(/\s+/g, "-"),
	);

	expect(process("  Hello World  ")).toBe("hello-world");
	expect(process("FOO BAR")).toBe("foo-bar");
	expect(process("  Already Clean")).toBe("already-clean");
});

test("flow - multi-argument first function", () => {
	const add = flow(
		(a: number, b: number) => a + b,
		(sum: number) => sum * 10,
	);
	expect(add(3, 4)).toBe(70);
});

test("flow - multi-argument first function with three args", () => {
	const fn = flow(
		(a: number, b: number, c: number) => a + b + c,
		(sum: number) => `Sum: ${sum}`,
	);
	expect(fn(1, 2, 3)).toBe("Sum: 6");
});

test("flow - integration with Option", () => {
	const safeParseAndDouble = flow(
		(s: string) => {
			const n = parseInt(s, 10);
			return isNaN(n) ? (Option.none() as Option<number>) : Option.some(n);
		},
		Option.map((n: number) => n * 2),
		Option.getOrElse(() => 0),
	);

	expect(safeParseAndDouble("21")).toBe(42);
	expect(safeParseAndDouble("abc")).toBe(0);
});

test("flow - can be used as argument to higher-order functions", () => {
	const transform = flow(
		(n: number) => n * 2,
		(n: number) => n + 1,
	);

	const results = [1, 2, 3].map(transform);
	expect(results).toEqual([3, 5, 7]);
});

test("flow - type transformation across functions", () => {
	const fn = flow(
		(n: number) => String(n),
		(s: string) => s.length,
		(len: number) => len > 1,
	);
	expect(fn(5)).toBe(false);
	expect(fn(10)).toBe(true);
});

// ---------------------------------------------------------------------------
// zero-function edge case (exercises the implementation's defensive guard)
// ---------------------------------------------------------------------------

test("flow - zero functions returns the first argument unchanged", () => {
	// The typed overloads don't expose flow() with no arguments, but the
	// underlying implementation has a defensive guard: if no functions are
	// provided, return the first argument as-is.
	const identity = (
		flow as (
			...fns: Array<(...a: unknown[]) => unknown>
		) => (...a: unknown[]) => unknown
	)();
	expect(identity(42)).toBe(42);
	expect(identity("hello")).toBe("hello");
});
