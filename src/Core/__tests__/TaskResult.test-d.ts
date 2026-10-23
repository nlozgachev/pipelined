import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { type Result } from "../Result.ts";
import { Task } from "../Task.ts";

test("make: infers precise variant types for Ok and Err tasks", () => {
	const okTask = Task.Result.make.ok(42);
	expectTypeOf(okTask).toEqualTypeOf<Task.Result<never, number>>();

	const errTask = Task.Result.make.err("failed");
	expectTypeOf(errTask).toEqualTypeOf<Task.Result<string, never>>();
});

test("map / mapError: preserves natural union and propagates channel types", () => {
	const naturalUnion: Task.Result<string, number> = constTruthyBool()
		? Task.Result.make.ok(42)
		: Task.Result.make.err("err");

	const mapped = pipe(naturalUnion, Task.Result.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Task.Result<string, string>>();

	const mappedErr = pipe(naturalUnion, Task.Result.mapError((err) => err.length));
	expectTypeOf(mappedErr).toEqualTypeOf<Task.Result<number, number>>();
});

test("chain: unifies error channels across asynchronous pipelines", () => {
	const naturalUnion: Task.Result<"ERR_A", number> = constTruthyBool()
		? Task.Result.make.ok(42)
		: Task.Result.make.err("ERR_A");

	const chained = pipe(
		naturalUnion,
		Task.Result.chain((n) => (n > 0 ? Task.Result.make.ok(n.toString()) : Task.Result.make.err("ERR_B" as const))),
	);
	expectTypeOf(chained).toEqualTypeOf<Task.Result<"ERR_A" | "ERR_B", string>>();
});

test("tap & tapError: preserve channel types through side effects", () => {
	const naturalUnion: Task.Result<"ERR", number> = constTruthyBool()
		? Task.Result.make.ok(42)
		: Task.Result.make.err("ERR");

	const tapped = pipe(naturalUnion, Task.Result.tap((_n) => {}));
	expectTypeOf(tapped).toEqualTypeOf<Task.Result<"ERR", number>>();

	const tappedErr = pipe(naturalUnion, Task.Result.tapError((_e) => {}));
	expectTypeOf(tappedErr).toEqualTypeOf<Task.Result<"ERR", number>>();
});

test("apply: widens error types across independent parallel evaluations", async () => {
	const fnResult: Task.Result<"ERR_FN", (n: number) => string> = constTruthyBool()
		? Task.Result.make.ok((n: number) => String(n))
		: Task.Result.make.err("ERR_FN");
	const argResult: Task.Result<"ERR_ARG", number> = constTruthyBool()
		? Task.Result.make.ok(123)
		: Task.Result.make.err("ERR_ARG");

	const applied = pipe(fnResult, Task.Result.apply(argResult));
	expectTypeOf(applied).toEqualTypeOf<Task.Result<"ERR_FN" | "ERR_ARG", string>>();

	const res = await applied();
	expectTypeOf(res).toEqualTypeOf<Result<"ERR_FN" | "ERR_ARG", string>>();
});

test("struct: preserves heterogeneous error unions and object shapes", () => {
	const taskA: Task.Result<"ERR_A", number> = constTruthyBool() ? Task.Result.make.ok(1) : Task.Result.make.err("ERR_A");
	const taskB: Task.Result<"ERR_B", string> = constTruthyBool()
		? Task.Result.make.ok("foo")
		: Task.Result.make.err("ERR_B");

	const structured = Task.Result.struct({ a: taskA, b: taskB });
	expectTypeOf(structured).toEqualTypeOf<Task.Result<"ERR_A" | "ERR_B", { a: number; b: string; }>>();
});

test("bind & bindTo: accumulates pipeline object record correctly", () => {
	const taskA: Task.Result<"ERR_A", number> = constTruthyBool() ? Task.Result.make.ok(1) : Task.Result.make.err("ERR_A");

	const bound = pipe(
		taskA,
		Task.Result.bindTo("a"),
		Task.Result.bind("b", ({ a }) => a > 0 ? Task.Result.make.ok(a.toString()) : Task.Result.make.err("ERR_B" as const)),
	);
	expectTypeOf(bound).toEqualTypeOf<Task.Result<"ERR_A" | "ERR_B", { a: number; } & { b: string; }>>();
	expectTypeOf(bound).toMatchTypeOf<Task.Result<"ERR_A" | "ERR_B", { a: number; b: string; }>>();
});

test("ensure: narrows type when passed a type guard refinement", () => {
	const isString = (val: unknown): val is string => typeof val === "string";
	const input: Task.Result<"ERR_INIT", unknown> = constTruthyBool()
		? Task.Result.make.ok("hello")
		: Task.Result.make.err("ERR_INIT");

	const ensured = pipe(input, Task.Result.ensure(isString, () => "NOT_STRING" as const));
	expectTypeOf(ensured).toEqualTypeOf<Task.Result<"ERR_INIT" | "NOT_STRING", string>>();
});

test("negative: flags invalid transforms and non-Task.Result struct fields", () => {
	const task = Task.Result.make.ok(42);

	// @ts-expect-error Map transform must be a function
	expectTypeOf(Task.Result.map(123)(task)).toBeFunction();

	// @ts-expect-error Chain transform must return a Task.Result
	expectTypeOf(Task.Result.chain((n: number) => n * 2)(task)).toBeFunction();

	// @ts-expect-error Struct field values must be Task.Result instances
	expectTypeOf(Task.Result.struct({ a: 123 })).toBeFunction();
});
