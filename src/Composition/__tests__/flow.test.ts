import { expect, test } from "vitest";
import { Deferred } from "../../Core/Deferred.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { flow } from "../flow.ts";

test("flow: wraps single function", () => {
	const double = flow((n: number) => n * 2);
	expect(double(5)).toBe(10);
});

test("flow: executes two functions left-to-right", () => {
	const addOneThenDouble = flow((n: number) => n + 1, (n: number) => n * 2);
	// 5 + 1 = 6, 6 * 2 = 12
	expect(addOneThenDouble(5)).toBe(12);
});

test("flow: executes three functions left-to-right", () => {
	const fn = flow((n: number) => n + 1, (n: number) => n * 2, (n: number) => `Result: ${n}`);
	expect(fn(5)).toBe("Result: 12");
});

test("flow: executes functions in left-to-right order", () => {
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

test("flow: allows reusability of created function", () => {
	const process = flow(
		(s: string) => s.trim(),
		(s: string) => s.toLowerCase(),
		(s: string) => s.replaceAll(/\s+/g, "-"),
	);

	expect(process("  Hello World  ")).toBe("hello-world");
	expect(process("FOO BAR")).toBe("foo-bar");
	expect(process("  Already Clean")).toBe("already-clean");
});

test("flow: supports multi-argument first function", () => {
	const add = flow((a: number, b: number) => a + b, (sum: number) => sum * 10);
	expect(add(3, 4)).toBe(70);
});

test("flow: supports multi-argument first function with three arguments", () => {
	const fn = flow((a: number, b: number, c: number) => a + b + c, (sum: number) => `Sum: ${sum}`);
	expect(fn(1, 2, 3)).toBe("Sum: 6");
});

test("flow: integrates with Maybe in pipeline", () => {
	const safeParseAndDouble = flow(
		(s: string) => {
			const n = parseInt(s, 10);
			return isNaN(n) ? (Maybe.make.none() as Maybe<number>) : Maybe.make.some(n);
		},
		Maybe.map((n: number) => n * 2),
		Maybe.getOrElse(() => 0),
	);

	expect(safeParseAndDouble("21")).toBe(42);
	expect(safeParseAndDouble("abc")).toBe(0);
});

test("flow: can be passed to higher-order functions", () => {
	const transform = flow((n: number) => n * 2, (n: number) => n + 1);

	const results = [1, 2, 3].map(transform);
	expect(results).toStrictEqual([3, 5, 7]);
});

test("flow: transforms types across steps", () => {
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

test("flow: composes 4 functions", () => {
	expect(flow(inc, inc, inc, inc)(0)).toBe(4);
});

test("flow: composes 5 functions", () => {
	expect(flow(inc, inc, inc, inc, inc)(0)).toBe(5);
});

test("flow: composes 6 functions", () => {
	expect(flow(inc, inc, inc, inc, inc, inc)(0)).toBe(6);
});

test("flow: composes 7 functions", () => {
	expect(flow(inc, inc, inc, inc, inc, inc, inc)(0)).toBe(7);
});

test("flow: composes 8 functions", () => {
	expect(flow(inc, inc, inc, inc, inc, inc, inc, inc)(0)).toBe(8);
});

test("flow: composes 9 functions", () => {
	expect(flow(inc, inc, inc, inc, inc, inc, inc, inc, inc)(0)).toBe(9);
});

test("flow: composes 10 functions", () => {
	expect(flow(inc, inc, inc, inc, inc, inc, inc, inc, inc, inc)(0)).toBe(10);
});

test("flow: returns first argument unchanged when called with zero functions", () => {
	// The typed overloads don't expose flow() with no arguments, but the
	// underlying implementation has a defensive guard: if no functions are
	// provided, return the first argument as-is.
	const identity = (flow as (...fns: Array<(...a: unknown[]) => unknown>) => (...a: unknown[]) => unknown)();
	expect(identity(42)).toBe(42);
	expect(identity("hello")).toBe("hello");
});

// --- flow.when ---

test("when: runs onTrue if predicate is met", () => {
	let called = false;
	const run = flow.when((n: number) => n > 5, (n: number) => {
		called = true;
		return n * 2;
	});
	expect(run(6)).toBe(12);
	expect(called).toBe(true);
});

test("when: returns value unchanged if predicate is not met", () => {
	let called = false;
	const run = flow.when((n: number) => n > 5, (n: number) => {
		called = true;
		return n * 2;
	});
	expect(run(4)).toBe(4);
	expect(called).toBe(false);
});

// --- flow.unless ---

test("unless: runs onFalse if predicate is not met", () => {
	let called = false;
	const run = flow.unless((n: number) => n > 5, (n: number) => {
		called = true;
		return n * 2;
	});
	expect(run(4)).toBe(8);
	expect(called).toBe(true);
});

test("unless: returns value unchanged if predicate is met", () => {
	let called = false;
	const run = flow.unless((n: number) => n > 5, (n: number) => {
		called = true;
		return n * 2;
	});
	expect(run(6)).toBe(6);
	expect(called).toBe(false);
});

// --- flow.either ---

test("either: runs onTrue if predicate is met", () => {
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

test("either: runs onFalse if predicate is not met", () => {
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

test("try: returns result of success path", () => {
	let errorCalled = false;
	const run = flow.try((s: string) => JSON.parse(s), () => {
		errorCalled = true;
		return { fallback: true };
	});
	expect(run('{"a": 1}')).toStrictEqual({ a: 1 });
	expect(errorCalled).toBe(false);
});

test("try: handles error and returns fallback value", () => {
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

test("struct: builds structured object from inputs", () => {
	const run = flow.struct<number, { double: number; str: string; isEven: boolean; }>({
		double: (n) => n * 2,
		str: (n) => `value is ${n}`,
		isEven: (n) => n % 2 === 0,
	});
	expect(run(5)).toStrictEqual({ double: 10, str: "value is 5", isEven: false });
});

// --- flow.safe ---

test("safe: runs all steps if none are nil", () => {
	const run = flow.safe((n: number) => n * 2, (n: number) => n + 1);
	expect(run(5)).toBe(11);
});

test("safe: short-circuits on null immediately", () => {
	let secondCalled = false;
	const run = flow.safe((n: number) => (n > 5 ? null : n * 2), (n: number) => {
		secondCalled = true;
		return n + 1;
	});
	expect(run(6)).toBeNull();
	expect(secondCalled).toBe(false);
});

test("safe: short-circuits on undefined immediately", () => {
	let secondCalled = false;
	const run = flow.safe((n: number) => (n > 5 ? undefined : n * 2), (n: number) => {
		secondCalled = true;
		return n + 1;
	});
	expect(run(6)).toBeUndefined();
	expect(secondCalled).toBe(false);
});

test("safe: short-circuits initial null and undefined", () => {
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

test("async: awaits synchronous and asynchronous steps", async () => {
	const run = flow.async(
		(n: number) => Promise.resolve(n * 2),
		(n: number) => n + 1,
		(n: number) => Promise.resolve(`result: ${n}`),
	);
	const res = await run(5);
	expect(res).toBe("result: 11");
});

test("async: supports input promise", async () => {
	const run = flow.async((n: number) => Promise.resolve(n * 2));
	const res = await run(Promise.resolve(5));
	expect(res).toBe(10);
});

// --- integration/composition ---

test("flow: integrates with other composition combinators", () => {
	const run = flow((n: number) => n + 1, flow.when((n) => n > 5, (n) => n * 2), (n) => `Final: ${n}`);
	expect(run(5)).toBe("Final: 12");
	expect(run(3)).toBe("Final: 4");
});

test("async: resolves Deferred values and functions returning Deferred", async () => {
	const run = flow.async(
		(n: number) => Deferred.from.Promise(Promise.resolve(n * 2)),
		(n: number) => n + 1,
		(n: number) => Deferred.from.Promise(Promise.resolve(`result: ${n}`)),
	);
	const res = await run(Deferred.from.Promise(Promise.resolve(5)));
	expect(res).toBe("result: 11");
});
