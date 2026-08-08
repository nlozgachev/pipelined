import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";
import { Logged } from "../Logged.ts";

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("Logged.from.value creates a Logged with an empty log", () => {
	const result = Logged.from.value<string, number>(42);
	expect(result.value).toBe(42);
	expect(result.log).toStrictEqual([]);
});

test("Logged.from.value works with string value", () => {
	const result = Logged.from.value<string, string>("hello");
	expect(result.value).toBe("hello");
	expect(result.log).toStrictEqual([]);
});

// ---------------------------------------------------------------------------
// tell
// ---------------------------------------------------------------------------

test("Logged.from.entry creates a Logged with one log entry and undefined value", () => {
	const result = Logged.from.entry("step A");
	expect(result.value).toBeUndefined();
	expect(result.log).toStrictEqual(["step A"]);
});

test("Logged.from.entry with a number entry", () => {
	const result = Logged.from.entry(42);
	expect(result.value).toBeUndefined();
	expect(result.log).toStrictEqual([42]);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Logged.map transforms the value", () => {
	const result = pipe(Logged.from.value<string, number>(5), Logged.map((n) => n * 2));
	expect(result.value).toBe(10);
});

test("Logged.map does not change the log", () => {
	const initial: Logged<string, number> = { value: 5, log: ["existing"] };
	const result = pipe(initial, Logged.map((n) => n + 1));
	expect(result.value).toBe(6);
	expect(result.log).toStrictEqual(["existing"]);
});

test("Logged.map can change the value type", () => {
	const result = pipe(Logged.from.value<string, number>(42), Logged.map((n) => `value: ${n}`));
	expect(result.value).toBe("value: 42");
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Logged.chain sequences computations and concatenates logs", () => {
	const result = pipe(
		Logged.from.value<string, number>(1),
		Logged.chain((n) => pipe(Logged.from.entry("first"), Logged.map(() => n + 1))),
		Logged.chain((n) => pipe(Logged.from.entry("second"), Logged.map(() => n * 10))),
	);
	expect(result.value).toBe(20);
	expect(result.log).toStrictEqual(["first", "second"]);
});

test("Logged.chain passes the value to the next computation", () => {
	const result = pipe(
		Logged.from.value<string, number>(3),
		Logged.chain((n) => Logged.from.value<string, number>(n * 7)),
	);
	expect(result.value).toBe(21);
	expect(result.log).toStrictEqual([]);
});

test("Logged.chain accumulates logs from both sides", () => {
	const first: Logged<string, number> = { value: 5, log: ["first-log"] };
	const result = pipe(first, Logged.chain((n) => ({ value: n + 1, log: ["second-log"] as ReadonlyArray<string> })));
	expect(result.value).toBe(6);
	expect(result.log).toStrictEqual(["first-log", "second-log"]);
});

test("Logged.chain with empty logs stays empty", () => {
	const result = pipe(Logged.from.value<string, number>(1), Logged.chain((n) => Logged.from.value(n + 1)));
	expect(result.value).toBe(2);
	expect(result.log).toStrictEqual([]);
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("Logged.ap applies a wrapped function to a wrapped value", () => {
	const fn: Logged<string, (n: number) => number> = { value: (n) => n * 3, log: [] };
	const arg: Logged<string, number> = { value: 7, log: [] };
	const result = pipe(fn, Logged.ap(arg));
	expect(result.value).toBe(21);
});

test("Logged.ap concatenates logs from function and argument", () => {
	const fn: Logged<string, (n: number) => number> = { value: (n) => n * 2, log: ["fn"] };
	const arg: Logged<string, number> = { value: 5, log: ["arg"] };
	const result = pipe(fn, Logged.ap(arg));
	expect(result.value).toBe(10);
	expect(result.log).toStrictEqual(["fn", "arg"]);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("Logged.tap runs a side effect without changing value or log", () => {
	let captured = -1;
	const input: Logged<string, number> = { value: 42, log: ["existing"] };
	const result = pipe(
		input,
		Logged.tap((n) => {
			captured = n;
		}),
	);
	expect(captured).toBe(42);
	expect(result.value).toBe(42);
	expect(result.log).toStrictEqual(["existing"]);
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

test("Logged.run returns [value, log] tuple", () => {
	const input: Logged<string, number> = { value: 10, log: ["a", "b"] };
	const [value, log] = Logged.run(input);
	expect(value).toBe(10);
	expect(log).toStrictEqual(["a", "b"]);
});

test("Logged.run on a make-created Logged returns empty log", () => {
	const [value, log] = Logged.run(Logged.from.value(99));
	expect(value).toBe(99);
	expect(log).toStrictEqual([]);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("logged composes well in a pipe chain with tell and map", () => {
	const validated = (input: string): Logged<string, string> =>
		input.length > 0
			? pipe(Logged.from.entry(`validated: "${input}"`), Logged.map(() => input.trim()))
			: pipe(Logged.from.entry(`rejected: "${input}"`), Logged.map(() => "(empty)"));

	const program = pipe(
		Logged.from.value<string, string>(" hello "),
		Logged.chain(validated),
		Logged.chain((s) => pipe(Logged.from.entry(`processed: "${s}"`), Logged.map(() => s.toUpperCase()))),
	);

	const [value, log] = Logged.run(program);
	expect(value).toBe("HELLO");
	expect(log).toStrictEqual(['validated: " hello "', 'processed: "hello"']);
});

test("logged logs accumulate across multiple chain steps", () => {
	const steps = ["a", "b", "c"];
	const program = steps.reduce(
		(acc: Logged<string, number>, step) =>
			pipe(acc, Logged.chain((n) => pipe(Logged.from.entry(step), Logged.map(() => n + 1)))),
		Logged.from.value<string, number>(0),
	);
	const [value, log] = Logged.run(program);
	expect(value).toBe(3);
	expect(log).toStrictEqual(["a", "b", "c"]);
});

// --- bindTo ---

test("Logged.bindTo wraps a value in an accumulator object", () => {
	const result = pipe(Logged.from.value<string, number>(2), Logged.bindTo("a"));
	const [value, log] = Logged.run(result);
	expect(value).toStrictEqual({ a: 2 });
	expect(log).toStrictEqual([]);
});

// --- bind ---

test("Logged.bind accumulates values key-by-key in a pipeline", () => {
	const result = pipe(
		Logged.from.value<string, number>(2),
		Logged.bindTo("a"),
		Logged.bind("b", ({ a }) => pipe(Logged.from.entry("logged b"), Logged.map(() => a * 3))),
		Logged.bind("c", ({ a, b }) => pipe(Logged.from.entry("logged c"), Logged.map(() => a + b))),
	);
	const [value, log] = Logged.run(result);
	expect(value).toStrictEqual({ a: 2, b: 6, c: 8 });
	expect(log).toStrictEqual(["logged b", "logged c"]);
});

// --- focus ---

test("Logged.focus focuses a value transformation via Lens", () => {
	const nameLens = Lens.from.property<{ name: string; }>()("name");
	const input = Logged.from.value<string, { name: string; }>({ name: "alice" });
	const result = pipe(input, Logged.focus(nameLens)((s) => s.toUpperCase()));

	expect(result.value).toStrictEqual({ name: "ALICE" });
	expect(result.log).toStrictEqual([]);
});

// --- side-effect isolation ---

test("Logged.tap executes side effect callback", () => {
	let called = false;
	pipe(
		Logged.from.value<string, number>(42),
		Logged.tap(() => {
			called = true;
		}),
	);
	expect(called).toBe(true);
});

test("Logged.map executes side effect callback", () => {
	let called = false;
	pipe(
		Logged.from.value<string, number>(42),
		Logged.map((n) => {
			called = true;
			return n * 2;
		}),
	);
	expect(called).toBe(true);
});
