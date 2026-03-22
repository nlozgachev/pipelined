import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Logged } from "../Logged.ts";

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("Logged.make creates a Logged with an empty log", () => {
	const result = Logged.make<string, number>(42);
	expect(result.value).toBe(42);
	expect(result.log).toEqual([]);
});

test("Logged.make works with string value", () => {
	const result = Logged.make<string, string>("hello");
	expect(result.value).toBe("hello");
	expect(result.log).toEqual([]);
});

// ---------------------------------------------------------------------------
// tell
// ---------------------------------------------------------------------------

test("Logged.tell creates a Logged with one log entry and undefined value", () => {
	const result = Logged.tell("step A");
	expect(result.value).toBeUndefined();
	expect(result.log).toEqual(["step A"]);
});

test("Logged.tell with a number entry", () => {
	const result = Logged.tell(42);
	expect(result.value).toBeUndefined();
	expect(result.log).toEqual([42]);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Logged.map transforms the value", () => {
	const result = pipe(Logged.make<string, number>(5), Logged.map((n) => n * 2));
	expect(result.value).toBe(10);
});

test("Logged.map does not change the log", () => {
	const initial: Logged<string, number> = { value: 5, log: ["existing"] };
	const result = pipe(initial, Logged.map((n) => n + 1));
	expect(result.value).toBe(6);
	expect(result.log).toEqual(["existing"]);
});

test("Logged.map can change the value type", () => {
	const result = pipe(Logged.make<string, number>(42), Logged.map((n) => `value: ${n}`));
	expect(result.value).toBe("value: 42");
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Logged.chain sequences computations and concatenates logs", () => {
	const result = pipe(
		Logged.make<string, number>(1),
		Logged.chain((n) => pipe(Logged.tell("first"), Logged.map(() => n + 1))),
		Logged.chain((n) => pipe(Logged.tell("second"), Logged.map(() => n * 10))),
	);
	expect(result.value).toBe(20);
	expect(result.log).toEqual(["first", "second"]);
});

test("Logged.chain passes the value to the next computation", () => {
	const result = pipe(
		Logged.make<string, number>(3),
		Logged.chain((n) => Logged.make<string, number>(n * 7)),
	);
	expect(result.value).toBe(21);
	expect(result.log).toEqual([]);
});

test("Logged.chain accumulates logs from both sides", () => {
	const first: Logged<string, number> = { value: 5, log: ["first-log"] };
	const result = pipe(
		first,
		Logged.chain((n) => ({ value: n + 1, log: ["second-log"] as ReadonlyArray<string> })),
	);
	expect(result.value).toBe(6);
	expect(result.log).toEqual(["first-log", "second-log"]);
});

test("Logged.chain with empty logs stays empty", () => {
	const result = pipe(
		Logged.make<string, number>(1),
		Logged.chain((n) => Logged.make(n + 1)),
	);
	expect(result.value).toBe(2);
	expect(result.log).toEqual([]);
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
	expect(result.log).toEqual(["fn", "arg"]);
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
	expect(result.log).toEqual(["existing"]);
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

test("Logged.run returns [value, log] tuple", () => {
	const input: Logged<string, number> = { value: 10, log: ["a", "b"] };
	const [value, log] = Logged.run(input);
	expect(value).toBe(10);
	expect(log).toEqual(["a", "b"]);
});

test("Logged.run on a make-created Logged returns empty log", () => {
	const [value, log] = Logged.run(Logged.make(99));
	expect(value).toBe(99);
	expect(log).toEqual([]);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Logged composes well in a pipe chain with tell and map", () => {
	const validated = (input: string): Logged<string, string> =>
		input.length > 0 ? pipe(Logged.tell(`validated: "${input}"`), Logged.map(() => input.trim())) : pipe(
			Logged.tell(`rejected: "${input}"`),
			Logged.map(() => "(empty)"),
		);

	const program = pipe(
		Logged.make<string, string>(" hello "),
		Logged.chain(validated),
		Logged.chain((s) =>
			pipe(
				Logged.tell(`processed: "${s}"`),
				Logged.map(() => s.toUpperCase()),
			)
		),
	);

	const [value, log] = Logged.run(program);
	expect(value).toBe("HELLO");
	expect(log).toEqual(['validated: " hello "', 'processed: "hello"']);
});

test("Logged logs accumulate across multiple chain steps", () => {
	const steps = ["a", "b", "c"];
	const program = steps.reduce(
		(acc: Logged<string, number>, step) =>
			pipe(
				acc,
				Logged.chain((n) => pipe(Logged.tell(step), Logged.map(() => n + 1))),
			),
		Logged.make<string, number>(0),
	);
	const [value, log] = Logged.run(program);
	expect(value).toBe(3);
	expect(log).toEqual(["a", "b", "c"]);
});
