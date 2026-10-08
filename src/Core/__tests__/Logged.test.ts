import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";
import { Logged } from "../Logged.ts";

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("make: creates Logged with default empty log", () => {
	const result = Logged.make(42);
	expect(result.value).toBe(42);
	expect(result.log).toStrictEqual([]);
});

test("make: creates Logged with explicit log", () => {
	const result = Logged.make(42, ["init"]);
	expect(result.value).toBe(42);
	expect(result.log).toStrictEqual(["init"]);
});

test("from.value: creates Logged with empty log", () => {
	const result = Logged.from.value<string, number>(42);
	expect(result.value).toBe(42);
	expect(result.log).toStrictEqual([]);
});

test("from.value: works with string value", () => {
	const result = Logged.from.value<string, string>("hello");
	expect(result.value).toBe("hello");
	expect(result.log).toStrictEqual([]);
});

// ---------------------------------------------------------------------------
// tell
// ---------------------------------------------------------------------------

test("from.entry: creates Logged with one log entry and undefined value", () => {
	const result = Logged.from.entry("step A");
	expect(result.value).toBeUndefined();
	expect(result.log).toStrictEqual(["step A"]);
});

test("from.entry: works with number entry", () => {
	const result = Logged.from.entry(42);
	expect(result.value).toBeUndefined();
	expect(result.log).toStrictEqual([42]);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: transforms value", () => {
	const result = pipe(Logged.from.value<string, number>(5), Logged.map((n) => n * 2));
	expect(result.value).toBe(10);
});

test("map: does not change log", () => {
	const initial: Logged<string, number> = { value: 5, log: ["existing"] };
	const result = pipe(initial, Logged.map((n) => n + 1));
	expect(result.value).toBe(6);
	expect(result.log).toStrictEqual(["existing"]);
});

test("map: can change value type", () => {
	const result = pipe(Logged.from.value<string, number>(42), Logged.map((n) => `value: ${n}`));
	expect(result.value).toBe("value: 42");
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("chain: sequences computations and concatenates logs", () => {
	const result = pipe(
		Logged.from.value<string, number>(1),
		Logged.chain((n) => pipe(Logged.from.entry("first"), Logged.map(() => n + 1))),
		Logged.chain((n) => pipe(Logged.from.entry("second"), Logged.map(() => n * 10))),
	);
	expect(result.value).toBe(20);
	expect(result.log).toStrictEqual(["first", "second"]);
});

test("chain: passes value to next computation", () => {
	const result = pipe(
		Logged.from.value<string, number>(3),
		Logged.chain((n) => Logged.from.value<string, number>(n * 7)),
	);
	expect(result.value).toBe(21);
	expect(result.log).toStrictEqual([]);
});

test("chain: accumulates logs from both sides", () => {
	const first: Logged<string, number> = { value: 5, log: ["first-log"] };
	const result = pipe(first, Logged.chain((n) => ({ value: n + 1, log: ["second-log"] as ReadonlyArray<string> })));
	expect(result.value).toBe(6);
	expect(result.log).toStrictEqual(["first-log", "second-log"]);
});

test("chain: preserves empty log when both sides have empty logs", () => {
	const result = pipe(Logged.from.value<string, number>(1), Logged.chain((n) => Logged.from.value(n + 1)));
	expect(result.value).toBe(2);
	expect(result.log).toStrictEqual([]);
});

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

test("apply: applies wrapped function to wrapped value", () => {
	const fn: Logged<string, (n: number) => number> = { value: (n) => n * 3, log: [] };
	const arg: Logged<string, number> = { value: 7, log: [] };
	const result = pipe(fn, Logged.apply(arg));
	expect(result.value).toBe(21);
});

test("apply: concatenates logs from function and argument", () => {
	const fn: Logged<string, (n: number) => number> = { value: (n) => n * 2, log: ["fn"] };
	const arg: Logged<string, number> = { value: 5, log: ["arg"] };
	const result = pipe(fn, Logged.apply(arg));
	expect(result.value).toBe(10);
	expect(result.log).toStrictEqual(["fn", "arg"]);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("tap: runs side effect without changing value or log", () => {
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

test("run: returns value and log tuple", () => {
	const input: Logged<string, number> = { value: 10, log: ["a", "b"] };
	const [value, log] = Logged.run(input);
	expect(value).toBe(10);
	expect(log).toStrictEqual(["a", "b"]);
});

test("run: returns empty log for value created via from.value", () => {
	const [value, log] = Logged.run(Logged.from.value(99));
	expect(value).toBe(99);
	expect(log).toStrictEqual([]);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes in pipeline with tell and map", () => {
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

test("pipe: accumulates logs across multiple chain steps", () => {
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

test("bindTo: wraps value in accumulator object", () => {
	const result = pipe(Logged.from.value<string, number>(2), Logged.bindTo("a"));
	const [value, log] = Logged.run(result);
	expect(value).toStrictEqual({ a: 2 });
	expect(log).toStrictEqual([]);
});

// --- bind ---

test("bind: accumulates values key-by-key in pipeline", () => {
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

test("focus: focuses value transformation via Lens", () => {
	const nameLens = Lens.from.property<{ name: string; }>()("name");
	const input = Logged.from.value<string, { name: string; }>({ name: "alice" });
	const result = pipe(input, Logged.focus(nameLens)((s) => s.toUpperCase()));

	expect(result.value).toStrictEqual({ name: "ALICE" });
	expect(result.log).toStrictEqual([]);
});

// --- side-effect isolation ---

test("tap: executes side effect callback", () => {
	let called = false;
	pipe(
		Logged.from.value<string, number>(42),
		Logged.tap(() => {
			called = true;
		}),
	);
	expect(called).toBe(true);
});

test("map: executes side effect callback", () => {
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
