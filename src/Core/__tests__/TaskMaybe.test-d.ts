import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { type Maybe } from "../Maybe.ts";
import { Task } from "../Task.ts";

test("make: infers Task.Maybe variant types", async () => {
	const someTask = Task.Maybe.make.some(42);
	expectTypeOf(someTask).toEqualTypeOf<Task.Maybe<number>>();

	const noneTask = Task.Maybe.make.none<number>();
	expectTypeOf(noneTask).toEqualTypeOf<Task.Maybe<number>>();

	const res = await someTask();
	expectTypeOf(res).toEqualTypeOf<Maybe<number>>();
});

test("map & chain: propagates and transforms inner value", () => {
	const taskNum = Task.Maybe.make.some(42);

	const mapped = pipe(taskNum, Task.Maybe.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Task.Maybe<string>>();

	const chained = pipe(taskNum, Task.Maybe.chain((n) => Task.Maybe.make.some(n > 0)));
	expectTypeOf(chained).toEqualTypeOf<Task.Maybe<boolean>>();
});

test("filter: narrows type when passed a type guard refinement", () => {
	const isString = (val: unknown): val is string => typeof val === "string";
	const input: Task.Maybe<unknown> = Task.Maybe.make.some("hello");
	const narrowed = pipe(input, Task.Maybe.filter(isString));
	expectTypeOf(narrowed).toEqualTypeOf<Task.Maybe<string>>();
});

test("struct: combines record of Task.Maybes into single record", () => {
	const structured = Task.Maybe.struct({ a: Task.Maybe.make.some(1), b: Task.Maybe.make.some("foo") });
	expectTypeOf(structured).toEqualTypeOf<Task.Maybe<{ a: number; b: string; }>>();
});

test("bind & bindTo: accumulates pipeline object record correctly", () => {
	const bound = pipe(
		Task.Maybe.make.some(42),
		Task.Maybe.bindTo("a"),
		Task.Maybe.bind("b", ({ a }) => Task.Maybe.make.some(a.toString())),
	);
	expectTypeOf(bound).toEqualTypeOf<Task.Maybe<{ a: number; } & { b: string; }>>();
	expectTypeOf(bound).toMatchTypeOf<Task.Maybe<{ a: number; b: string; }>>();
});

test("negative: flags invalid transforms and non-Task.Maybe struct fields", () => {
	const task = Task.Maybe.make.some(42);

	// @ts-expect-error Map transform must be a function
	expectTypeOf(Task.Maybe.map(123)(task)).toBeFunction();

	// @ts-expect-error Chain transform must return a Task.Maybe
	expectTypeOf(Task.Maybe.chain((n: number) => n * 2)(task)).toBeFunction();

	// @ts-expect-error Struct field values must be Task.Maybe instances
	expectTypeOf(Task.Maybe.struct({ a: 123 })).toBeFunction();
});
