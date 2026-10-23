import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Task } from "../Task.ts";
import { Validation } from "../Validation.ts";

test("make / map: infers lazy infallible task return types", () => {
	const taskNum = Task.make(42);
	expectTypeOf(taskNum).toEqualTypeOf<Task<number>>();

	const mapped = pipe(taskNum, Task.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Task<string>>();
});

test("chain: sequences asynchronous computations", () => {
	const taskNum = Task.make(42);
	const chained = pipe(taskNum, Task.chain((n) => Task.make(n > 0)));
	expectTypeOf(chained).toEqualTypeOf<Task<boolean>>();
});

test("all & sequential: preserve tuple element types", () => {
	const taskA = Task.make(1);
	const taskB = Task.make("hello");

	const allTask = Task.all([taskA, taskB]);
	expectTypeOf(allTask).toEqualTypeOf<Task<[number, string]>>();

	const seqTask = Task.sequential([taskA, taskB]);
	expectTypeOf(seqTask).toEqualTypeOf<Task<[number, string]>>();
});

test("bind & bindTo: accumulates pipeline object record correctly", () => {
	const bound = pipe(Task.make(42), Task.bindTo("a"), Task.bind("b", ({ a }) => Task.make(a.toString())));
	expectTypeOf(bound).toEqualTypeOf<Task<{ a: number; } & { b: string; }>>();
	expectTypeOf(bound).toMatchTypeOf<Task<{ a: number; b: string; }>>();
});

test("abortable: returns task and abort handle", () => {
	const { task, abort } = Task.abortable((_signal) => Promise.resolve(42));
	expectTypeOf(task).toEqualTypeOf<Task<number>>();
	expectTypeOf(abort).toEqualTypeOf<() => void>();
});

test("namespace aliases: equivalence with specialized core types", () => {
	expectTypeOf<Task.Result<string, number>>().toEqualTypeOf<Task<Result<string, number>>>();
	expectTypeOf<Task.Maybe<string>>().toEqualTypeOf<Task<Maybe<string>>>();
	expectTypeOf<Task.Validation<string, number>>().toEqualTypeOf<Task<Validation<string, number>>>();
});

test("negative: disallows fallible primitives and invalid signatures", () => {
	const taskNum = Task.make(42);

	// @ts-expect-error Task is infallible and strictly does not expose a 'fail' constructor
	expectTypeOf(Task.fail).toBeUndefined();

	// @ts-expect-error Task.map requires a function
	expectTypeOf(Task.map(123)(taskNum)).toBeFunction();

	// @ts-expect-error Task.chain transform must return a Task
	expectTypeOf(Task.chain((n: number) => n * 2)(taskNum)).toBeFunction();

	// @ts-expect-error Task.make requires a value argument
	expectTypeOf(Task.make()).toBeFunction();
});
