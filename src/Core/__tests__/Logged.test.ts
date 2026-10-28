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

test("make: preserves falsy values without corruption", () => {
	expect(Logged.make(0).value).toBe(0);
	expect(Logged.make(false).value).toBe(false);
	expect(Logged.make("").value).toBe("");
	expect(Logged.make(null).value).toBeNull();
	expect(Logged.make(undefined).value).toBeUndefined();
	expect(Number.isNaN(Logged.make(NaN).value)).toBe(true);
});

// ---------------------------------------------------------------------------
// from.entry
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

test("from.entry: works with object entry", () => {
	const result = Logged.from.entry({ code: "AUTH", level: "info" });
	expect(result.value).toBeUndefined();
	expect(result.log).toStrictEqual([{ code: "AUTH", level: "info" }]);
});

// ---------------------------------------------------------------------------
// to.Pair
// ---------------------------------------------------------------------------

test("to.Pair: extracts value and log tuple", () => {
	const input = Logged.make(10, ["a", "b"]);
	const [value, log] = Logged.to.Pair(input);
	expect(value).toBe(10);
	expect(log).toStrictEqual(["a", "b"]);
});

test("to.Pair: returns empty log for value created via make", () => {
	const [value, log] = Logged.to.Pair(Logged.make(99));
	expect(value).toBe(99);
	expect(log).toStrictEqual([]);
});

test("to.Pair: preserves falsy values", () => {
	const [zeroVal, zeroLog] = Logged.to.Pair(Logged.make(0, ["zero"]));
	expect(zeroVal).toBe(0);
	expect(zeroLog).toStrictEqual(["zero"]);

	const [falseVal, falseLog] = Logged.to.Pair(Logged.make(false));
	expect(falseVal).toBe(false);
	expect(falseLog).toStrictEqual([]);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: transforms value", () => {
	const result = pipe(Logged.make(5), Logged.map((n) => n * 2));
	expect(result.value).toBe(10);
});

test("map: does not change log", () => {
	const initial = Logged.make(5, ["existing"]);
	const result = pipe(initial, Logged.map((n) => n + 1));
	expect(result.value).toBe(6);
	expect(result.log).toStrictEqual(["existing"]);
});

test("map: can change value type", () => {
	const result = pipe(Logged.make(42), Logged.map((n) => `value: ${n}`));
	expect(result.value).toBe("value: 42");
});

test("map: preserves falsy results", () => {
	const result = pipe(Logged.make(10), Logged.map((n) => (n > 5 ? 0 : 1)));
	expect(result.value).toBe(0);
});

test("map: executes side effect callback", () => {
	let called = false;
	pipe(
		Logged.make(42),
		Logged.map((n) => {
			called = true;
			return n * 2;
		}),
	);
	expect(called).toBe(true);
});

// ---------------------------------------------------------------------------
// mapLog
// ---------------------------------------------------------------------------

test("mapLog: transforms each log entry", () => {
	const initial = Logged.make(100, ["first", "second"]);
	const result = pipe(initial, Logged.mapLog((entry) => entry.toUpperCase()));
	expect(result.value).toBe(100);
	expect(result.log).toStrictEqual(["FIRST", "SECOND"]);
});

test("mapLog: preserves value and empty logs", () => {
	const initial = Logged.make(42);
	const result = pipe(initial, Logged.mapLog((entry: string) => entry.toUpperCase()));
	expect(result.value).toBe(42);
	expect(result.log).toStrictEqual([]);
});

test("mapLog: transforms log entry types", () => {
	const initial = Logged.make("payload", [1, 2, 3]);
	const result = pipe(initial, Logged.mapLog((n) => `item_${n}`));
	expect(result.value).toBe("payload");
	expect(result.log).toStrictEqual(["item_1", "item_2", "item_3"]);
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("chain: sequences computations and concatenates logs", () => {
	const result = pipe(
		Logged.make(1),
		Logged.chain((n) => pipe(Logged.from.entry("first"), Logged.map(() => n + 1))),
		Logged.chain((n) => pipe(Logged.from.entry("second"), Logged.map(() => n * 10))),
	);
	expect(result.value).toBe(20);
	expect(result.log).toStrictEqual(["first", "second"]);
});

test("chain: passes value to next computation", () => {
	const result = pipe(Logged.make(3), Logged.chain((n) => Logged.make(n * 7)));
	expect(result.value).toBe(21);
	expect(result.log).toStrictEqual([]);
});

test("chain: accumulates logs from both sides without type casts", () => {
	const first = Logged.make(5, ["first-log"]);
	const result = pipe(first, Logged.chain((n) => Logged.make(n + 1, ["second-log"])));
	expect(result.value).toBe(6);
	expect(result.log).toStrictEqual(["first-log", "second-log"]);
});

test("chain: preserves empty log when both sides have empty logs", () => {
	const result = pipe(Logged.make(1), Logged.chain((n) => Logged.make(n + 1)));
	expect(result.value).toBe(2);
	expect(result.log).toStrictEqual([]);
});

test("chain: preserves falsy intermediate and return values", () => {
	const result = pipe(
		Logged.make(0),
		Logged.chain((n) => Logged.make(n === 0 ? "" : "not-zero", ["checked zero"])),
		Logged.chain((s) => Logged.make(s.length > 0, ["checked length"])),
	);
	expect(result.value).toBe(false);
	expect(result.log).toStrictEqual(["checked zero", "checked length"]);
});

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

test("apply: applies wrapped function to wrapped value", () => {
	const fn = Logged.make((n: number) => n * 3);
	const arg = Logged.make(7);
	const result = pipe(fn, Logged.apply(arg));
	expect(result.value).toBe(21);
});

test("apply: concatenates logs from function and argument", () => {
	const fn = Logged.make((n: number) => n * 2, ["fn"]);
	const arg = Logged.make(5, ["arg"]);
	const result = pipe(fn, Logged.apply(arg));
	expect(result.value).toBe(10);
	expect(result.log).toStrictEqual(["fn", "arg"]);
});

test("apply: works with falsy arguments", () => {
	const fn = Logged.make((s: string) => s.length === 0, ["empty-checker"]);
	const arg = Logged.make("", ["empty-string"]);
	const result = pipe(fn, Logged.apply(arg));
	expect(result.value).toBe(true);
	expect(result.log).toStrictEqual(["empty-checker", "empty-string"]);
});

// ---------------------------------------------------------------------------
// tap & tapLog
// ---------------------------------------------------------------------------

test("tap: runs side effect without changing value or log", () => {
	let captured = -1;
	const input = Logged.make(42, ["existing"]);
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

test("tap: executes side effect callback", () => {
	let called = false;
	pipe(
		Logged.make(42),
		Logged.tap(() => {
			called = true;
		}),
	);
	expect(called).toBe(true);
});

test("tapLog: runs side effect on log array without changing value or log", () => {
	let entryCount = 0;
	const input = Logged.make("data", ["a", "b", "c"]);
	const result = pipe(
		input,
		Logged.tapLog((logs) => {
			entryCount = logs.length;
		}),
	);
	expect(entryCount).toBe(3);
	expect(result.value).toBe("data");
	expect(result.log).toStrictEqual(["a", "b", "c"]);
});

// ---------------------------------------------------------------------------
// bindTo & bind
// ---------------------------------------------------------------------------

test("bindTo: wraps value in accumulator object", () => {
	const result = pipe(Logged.make(2), Logged.bindTo("a"));
	const [value, log] = Logged.to.Pair(result);
	expect(value).toStrictEqual({ a: 2 });
	expect(log).toStrictEqual([]);
});

test("bindTo: preserves falsy values", () => {
	const result = pipe(Logged.make(0), Logged.bindTo("count"));
	expect(result.value).toStrictEqual({ count: 0 });
});

test("bind: accumulates values key-by-key in pipeline", () => {
	const result = pipe(
		Logged.make(2),
		Logged.bindTo("a"),
		Logged.bind("b", ({ a }) => pipe(Logged.from.entry("logged b"), Logged.map(() => a * 3))),
		Logged.bind("c", ({ a, b }) => pipe(Logged.from.entry("logged c"), Logged.map(() => a + b))),
	);
	const [value, log] = Logged.to.Pair(result);
	expect(value).toStrictEqual({ a: 2, b: 6, c: 8 });
	expect(log).toStrictEqual(["logged b", "logged c"]);
});

test("bind: handles falsy field values", () => {
	const result = pipe(
		Logged.make("init"),
		Logged.bindTo("str"),
		Logged.bind("zero", () => Logged.make(0, ["added zero"])),
		Logged.bind("flag", () => Logged.make(false, ["added flag"])),
	);
	expect(result.value).toStrictEqual({ str: "init", zero: 0, flag: false });
	expect(result.log).toStrictEqual(["added zero", "added flag"]);
});

// ---------------------------------------------------------------------------
// focus
// ---------------------------------------------------------------------------

test("focus: executes logged sub-computation on focused lens target and accumulates logs", () => {
	type State = { profile: { name: string; age: number; }; active: boolean; };
	const profileLens = Lens.from.property<State>()("profile");

	const input = Logged.make<string, State>({ profile: { name: "alice", age: 30 }, active: true }, [
		"loaded initial state",
	]);

	const result = pipe(
		input,
		Logged.focus(profileLens)((p) => Logged.make({ ...p, name: p.name.toUpperCase() }, ["capitalized profile name"])),
	);

	expect(result.value).toStrictEqual({ profile: { name: "ALICE", age: 30 }, active: true });
	expect(result.log).toStrictEqual(["loaded initial state", "capitalized profile name"]);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes in pipeline with entry, map, and mapLog", () => {
	const validated = (input: string): Logged<string, string> =>
		input.length > 0
			? pipe(Logged.from.entry(`validated: "${input}"`), Logged.map(() => input.trim()))
			: pipe(Logged.from.entry(`rejected: "${input}"`), Logged.map(() => "(empty)"));

	const program = pipe(
		Logged.make(" hello "),
		Logged.chain(validated),
		Logged.chain((s) => pipe(Logged.from.entry(`processed: "${s}"`), Logged.map(() => s.toUpperCase()))),
		Logged.mapLog((log) => `[LOG] ${log}`),
	);

	const [value, log] = Logged.to.Pair(program);
	expect(value).toBe("HELLO");
	expect(log).toStrictEqual(['[LOG] validated: " hello "', '[LOG] processed: "hello"']);
});

test("pipe: accumulates logs across multiple chain steps", () => {
	const steps = ["a", "b", "c"];
	const program = steps.reduce(
		(acc: Logged<string, number>, step) =>
			pipe(acc, Logged.chain((n) => pipe(Logged.from.entry(step), Logged.map(() => n + 1)))),
		Logged.make(0),
	);
	const [value, log] = Logged.to.Pair(program);
	expect(value).toBe(3);
	expect(log).toStrictEqual(["a", "b", "c"]);
});
