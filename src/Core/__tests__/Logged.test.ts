import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Logged } from "../Logged.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

Deno.test("Logged.make creates a Logged with an empty log", () => {
	const result = Logged.make<string, number>(42);
	assertStrictEquals(result.value, 42);
	assertEquals(result.log, []);
});

Deno.test("Logged.make works with string value", () => {
	const result = Logged.make<string, string>("hello");
	assertStrictEquals(result.value, "hello");
	assertEquals(result.log, []);
});

// ---------------------------------------------------------------------------
// tell
// ---------------------------------------------------------------------------

Deno.test("Logged.tell creates a Logged with one log entry and undefined value", () => {
	const result = Logged.tell("step A");
	assertStrictEquals(result.value, undefined);
	assertEquals(result.log, ["step A"]);
});

Deno.test("Logged.tell with a number entry", () => {
	const result = Logged.tell(42);
	assertStrictEquals(result.value, undefined);
	assertEquals(result.log, [42]);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("Logged.map transforms the value", () => {
	const result = pipe(Logged.make<string, number>(5), Logged.map((n) => n * 2));
	assertStrictEquals(result.value, 10);
});

Deno.test("Logged.map does not change the log", () => {
	const initial: Logged<string, number> = { value: 5, log: ["existing"] };
	const result = pipe(initial, Logged.map((n) => n + 1));
	assertStrictEquals(result.value, 6);
	assertEquals(result.log, ["existing"]);
});

Deno.test("Logged.map can change the value type", () => {
	const result = pipe(Logged.make<string, number>(42), Logged.map((n) => `value: ${n}`));
	assertStrictEquals(result.value, "value: 42");
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

Deno.test("Logged.chain sequences computations and concatenates logs", () => {
	const result = pipe(
		Logged.make<string, number>(1),
		Logged.chain((n) => pipe(Logged.tell("first"), Logged.map(() => n + 1))),
		Logged.chain((n) => pipe(Logged.tell("second"), Logged.map(() => n * 10))),
	);
	assertStrictEquals(result.value, 20);
	assertEquals(result.log, ["first", "second"]);
});

Deno.test("Logged.chain passes the value to the next computation", () => {
	const result = pipe(
		Logged.make<string, number>(3),
		Logged.chain((n) => Logged.make<string, number>(n * 7)),
	);
	assertStrictEquals(result.value, 21);
	assertEquals(result.log, []);
});

Deno.test("Logged.chain accumulates logs from both sides", () => {
	const first: Logged<string, number> = { value: 5, log: ["first-log"] };
	const result = pipe(
		first,
		Logged.chain((n) => ({ value: n + 1, log: ["second-log"] as ReadonlyArray<string> })),
	);
	assertStrictEquals(result.value, 6);
	assertEquals(result.log, ["first-log", "second-log"]);
});

Deno.test("Logged.chain with empty logs stays empty", () => {
	const result = pipe(
		Logged.make<string, number>(1),
		Logged.chain((n) => Logged.make(n + 1)),
	);
	assertStrictEquals(result.value, 2);
	assertEquals(result.log, []);
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

Deno.test("Logged.ap applies a wrapped function to a wrapped value", () => {
	const fn: Logged<string, (n: number) => number> = { value: (n) => n * 3, log: [] };
	const arg: Logged<string, number> = { value: 7, log: [] };
	const result = pipe(fn, Logged.ap(arg));
	assertStrictEquals(result.value, 21);
});

Deno.test("Logged.ap concatenates logs from function and argument", () => {
	const fn: Logged<string, (n: number) => number> = { value: (n) => n * 2, log: ["fn"] };
	const arg: Logged<string, number> = { value: 5, log: ["arg"] };
	const result = pipe(fn, Logged.ap(arg));
	assertStrictEquals(result.value, 10);
	assertEquals(result.log, ["fn", "arg"]);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

Deno.test("Logged.tap runs a side effect without changing value or log", () => {
	let captured = -1;
	const input: Logged<string, number> = { value: 42, log: ["existing"] };
	const result = pipe(
		input,
		Logged.tap((n) => {
			captured = n;
		}),
	);
	assertStrictEquals(captured, 42);
	assertStrictEquals(result.value, 42);
	assertEquals(result.log, ["existing"]);
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

Deno.test("Logged.run returns [value, log] tuple", () => {
	const input: Logged<string, number> = { value: 10, log: ["a", "b"] };
	const [value, log] = Logged.run(input);
	assertStrictEquals(value, 10);
	assertEquals(log, ["a", "b"]);
});

Deno.test("Logged.run on a make-created Logged returns empty log", () => {
	const [value, log] = Logged.run(Logged.make(99));
	assertStrictEquals(value, 99);
	assertEquals(log, []);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("Logged composes well in a pipe chain with tell and map", () => {
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
	assertStrictEquals(value, "HELLO");
	assertEquals(log, ['validated: " hello "', 'processed: "hello"']);
});

Deno.test("Logged logs accumulate across multiple chain steps", () => {
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
	assertStrictEquals(value, 3);
	assertEquals(log, ["a", "b", "c"]);
});
