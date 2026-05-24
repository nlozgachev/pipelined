import { flow } from "#composition";
import { Maybe } from "#core";
import { expect, test } from "vitest";

test("flow - single function wraps it", () => {
	const double = flow((n: number) => n * 2);
	expect(double(5)).toBe(10);
});

test("flow - two functions execute left-to-right", () => {
	const addOneThenDouble = flow((n: number) => n + 1, (n: number) => n * 2);
	// 5 + 1 = 6, 6 * 2 = 12
	expect(addOneThenDouble(5)).toBe(12);
});

test("flow - three functions execute left-to-right", () => {
	const fn = flow((n: number) => n + 1, (n: number) => n * 2, (n: number) => `Result: ${n}`);
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
	expect(log).toStrictEqual(["a", "b", "c"]);
});

test("flow - reusability of created function", () => {
	const process = flow(
		(s: string) => s.trim(),
		(s: string) => s.toLowerCase(),
		(s: string) => s.replaceAll(/\s+/g, "-"),
	);

	expect(process("  Hello World  ")).toBe("hello-world");
	expect(process("FOO BAR")).toBe("foo-bar");
	expect(process("  Already Clean")).toBe("already-clean");
});

test("flow - multi-argument first function", () => {
	const add = flow((a: number, b: number) => a + b, (sum: number) => sum * 10);
	expect(add(3, 4)).toBe(70);
});

test("flow - multi-argument first function with three args", () => {
	const fn = flow((a: number, b: number, c: number) => a + b + c, (sum: number) => `Sum: ${sum}`);
	expect(fn(1, 2, 3)).toBe("Sum: 6");
});

test("flow - integration with Maybe", () => {
	const safeParseAndDouble = flow(
		(s: string) => {
			const n = parseInt(s, 10);
			return isNaN(n) ? (Maybe.none() as Maybe<number>) : Maybe.some(n);
		},
		Maybe.map((n: number) => n * 2),
		Maybe.getOrElse(() => 0),
	);

	expect(safeParseAndDouble("21")).toBe(42);
	expect(safeParseAndDouble("abc")).toBe(0);
});

test("flow - can be used as argument to higher-order functions", () => {
	const transform = flow((n: number) => n * 2, (n: number) => n + 1);

	const results = [1, 2, 3].map(transform);
	expect(results).toStrictEqual([3, 5, 7]);
});

test("flow - type transformation across functions", () => {
	const fn = flow((n: number) => String(n), (s: string) => s.length, (len: number) => len > 1);
	expect(fn(5)).toBe(false);
	expect(fn(10)).toBe(true);
});

// ---------------------------------------------------------------------------
// zero-function edge case (exercises the implementation's defensive guard)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// switch case coverage (one test per step count to keep every case reachable)
// ---------------------------------------------------------------------------

const inc = (n: number) => n + 1;

test("flow - 4 functions", () => {
	expect(flow(inc, inc, inc, inc)(0)).toBe(4);
});

test("flow - 5 functions", () => {
	expect(flow(inc, inc, inc, inc, inc)(0)).toBe(5);
});

test("flow - 6 functions", () => {
	expect(flow(inc, inc, inc, inc, inc, inc)(0)).toBe(6);
});

test("flow - 7 functions", () => {
	expect(flow(inc, inc, inc, inc, inc, inc, inc)(0)).toBe(7);
});

test("flow - 8 functions", () => {
	expect(flow(inc, inc, inc, inc, inc, inc, inc, inc)(0)).toBe(8);
});

test("flow - 9 functions", () => {
	expect(flow(inc, inc, inc, inc, inc, inc, inc, inc, inc)(0)).toBe(9);
});

test("flow - 10 functions", () => {
	expect(flow(inc, inc, inc, inc, inc, inc, inc, inc, inc, inc)(0)).toBe(10);
});

test("flow - zero functions returns the first argument unchanged", () => {
	// The typed overloads don't expose flow() with no arguments, but the
	// underlying implementation has a defensive guard: if no functions are
	// provided, return the first argument as-is.
	const identity = (flow as (...fns: Array<(...a: unknown[]) => unknown>) => (...a: unknown[]) => unknown)();
	expect(identity(42)).toBe(42);
	expect(identity("hello")).toBe("hello");
});

// --- flow.when ---

test("flow.when - runs onTrue if predicate is met", () => {
	let called = false;
	const run = flow.when((n: number) => n > 5, (n: number) => {
		called = true;
		return n * 2;
	});
	expect(run(6)).toBe(12);
	expect(called).toBe(true);
});

test("flow.when - returns value unchanged if predicate is not met", () => {
	let called = false;
	const run = flow.when((n: number) => n > 5, (n: number) => {
		called = true;
		return n * 2;
	});
	expect(run(4)).toBe(4);
	expect(called).toBe(false);
});

// --- flow.unless ---

test("flow.unless - runs onFalse if predicate is not met", () => {
	let called = false;
	const run = flow.unless((n: number) => n > 5, (n: number) => {
		called = true;
		return n * 2;
	});
	expect(run(4)).toBe(8);
	expect(called).toBe(true);
});

test("flow.unless - returns value unchanged if predicate is met", () => {
	let called = false;
	const run = flow.unless((n: number) => n > 5, (n: number) => {
		called = true;
		return n * 2;
	});
	expect(run(6)).toBe(6);
	expect(called).toBe(false);
});

// --- flow.either ---

test("flow.either - runs onTrue if predicate is met", () => {
	let trueCalled = false;
	let falseCalled = false;
	const run = flow.either((n: number) => n > 5, (n: number) => {
		trueCalled = true;
		return n * 2;
	}, (n: number) => {
		falseCalled = true;
		return n + 10;
	});
	expect(run(6)).toBe(12);
	expect(trueCalled).toBe(true);
	expect(falseCalled).toBe(false);
});

test("flow.either - runs onFalse if predicate is not met", () => {
	let trueCalled = false;
	let falseCalled = false;
	const run = flow.either((n: number) => n > 5, (n: number) => {
		trueCalled = true;
		return n * 2;
	}, (n: number) => {
		falseCalled = true;
		return n + 10;
	});
	expect(run(4)).toBe(14);
	expect(trueCalled).toBe(false);
	expect(falseCalled).toBe(true);
});

// --- flow.try ---

test("flow.try - returns result of success path", () => {
	let errorCalled = false;
	const run = flow.try((s: string) => JSON.parse(s), () => {
		errorCalled = true;
		return { fallback: true };
	});
	expect(run('{"a": 1}')).toStrictEqual({ a: 1 });
	expect(errorCalled).toBe(false);
});

test("flow.try - handles error and returns fallback value", () => {
	let errorCalled = false;
	const run = flow.try((s: string) => JSON.parse(s), (err, input) => {
		errorCalled = true;
		expect(err).toBeInstanceOf(Error);
		expect(input).toBe("invalid json");
		return { fallback: true };
	});
	expect(run("invalid json")).toStrictEqual({ fallback: true });
	expect(errorCalled).toBe(true);
});

// --- flow.struct ---

test("flow.struct - builds structured object from inputs", () => {
	const run = flow.struct<number, { double: number; str: string; isEven: boolean; }>({
		double: (n) => n * 2,
		str: (n) => `value is ${n}`,
		isEven: (n) => n % 2 === 0,
	});
	expect(run(5)).toStrictEqual({ double: 10, str: "value is 5", isEven: false });
});

// --- flow.safe ---

test("flow.safe - runs all steps if none are nil", () => {
	const run = flow.safe((n: number) => n * 2, (n: number) => n + 1);
	expect(run(5)).toBe(11);
});

test("flow.safe - short circuits on null immediately", () => {
	let secondCalled = false;
	const run = flow.safe((n: number) => (n > 5 ? null : n * 2), (n: number) => {
		secondCalled = true;
		return n + 1;
	});
	expect(run(6)).toBeNull();
	expect(secondCalled).toBe(false);
});

test("flow.safe - short circuits on undefined immediately", () => {
	let secondCalled = false;
	const run = flow.safe((n: number) => (n > 5 ? undefined : n * 2), (n: number) => {
		secondCalled = true;
		return n + 1;
	});
	expect(run(6)).toBeUndefined();
	expect(secondCalled).toBe(false);
});

test("flow.safe - short-circuits initial null/undefined", () => {
	let firstCalled = false;
	const run = flow.safe<number | null | undefined, number>((n) => {
		firstCalled = true;
		return n * 2;
	});
	expect(run(null)).toBeNull();
	expect(run(undefined)).toBeUndefined();
	expect(firstCalled).toBe(false);
});

// --- flow.async ---

test("flow.async - awaits synchronous and asynchronous steps", async () => {
	const run = flow.async(
		(n: number) => Promise.resolve(n * 2),
		(n: number) => n + 1,
		(n: number) => Promise.resolve(`result: ${n}`),
	);
	const res = await run(5);
	expect(res).toBe("result: 11");
});

test("flow.async - supports input promise", async () => {
	const run = flow.async((n: number) => Promise.resolve(n * 2));
	const res = await run(Promise.resolve(5));
	expect(res).toBe(10);
});

// --- integration/composition ---

test("flow - integration with other composition helpers", () => {
	const run = flow((n: number) => n + 1, flow.when((n) => n > 5, (n) => n * 2), (n) => `Final: ${n}`);
	expect(run(5)).toBe("Final: 12");
	expect(run(3)).toBe("Final: 4");
});
