import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../../Types/Duration.ts";
import type { Deferred } from "../Deferred.ts";
import type { Maybe } from "../Maybe.ts";
import type { Result } from "../Result.ts";
import { Task } from "../Task.ts";
import type { Validation } from "../Validation.ts";

test("make & from.sync: infers lazy infallible task return types", () => {
	const taskNum = Task.make(42);
	expectTypeOf(taskNum).toEqualTypeOf<Task<number>>();

	const syncTask = Task.from.sync(() => "hello");
	expectTypeOf(syncTask).toEqualTypeOf<Task<string>>();
});

test("tryCatch: wraps promise factory into infallible task via fallback", () => {
	const safeTask = Task.tryCatch(() => Promise.resolve(42), { onError: (_error: unknown) => 0 });
	expectTypeOf(safeTask).toEqualTypeOf<Task<number>>();

	const widenedTask = Task.tryCatch(() => Promise.resolve(42), { onError: (_error: unknown) => "fallback" });
	expectTypeOf(widenedTask).toEqualTypeOf<Task<number | string>>();
});

test("map & apply: transforms encapsulated values and applies function tasks", () => {
	const taskNum = Task.make(42);
	const mapped = pipe(taskNum, Task.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Task<string>>();

	const taskFn = Task.make((n: number) => n > 0);
	const applied = pipe(taskFn, Task.apply(taskNum));
	expectTypeOf(applied).toEqualTypeOf<Task<boolean>>();
});

test("chain: sequences asynchronous computations", () => {
	const taskNum = Task.make(42);
	const chained = pipe(taskNum, Task.chain((n) => Task.make(n > 0)));
	expectTypeOf(chained).toEqualTypeOf<Task<boolean>>();
});

test("tap & delay: passes value through unchanged", () => {
	const taskNum = Task.make(42);
	const tapped = pipe(taskNum, Task.tap((_n) => {}));
	expectTypeOf(tapped).toEqualTypeOf<Task<number>>();

	const delayed = pipe(taskNum, Task.delay(Duration.milliseconds(100)));
	expectTypeOf(delayed).toEqualTypeOf<Task<number>>();
});

test("repeat & poll: loops task execution according to policy or predicate", () => {
	const taskNum = Task.make(42);
	const repeated = pipe(taskNum, Task.repeat({ times: 3 }));
	expectTypeOf(repeated).toEqualTypeOf<Task<readonly number[]>>();

	const polled = pipe(taskNum, Task.poll({ until: (n) => n === 42 }));
	expectTypeOf(polled).toEqualTypeOf<Task<number>>();
});

test("all, sequential & race: preserve element types and execute multiple tasks", () => {
	const taskA = Task.make(1);
	const taskB = Task.make("hello");

	const allTask = Task.all([taskA, taskB]);
	expectTypeOf(allTask).toEqualTypeOf<Task<[number, string]>>();

	const seqTask = Task.sequential([taskA, taskB]);
	expectTypeOf(seqTask).toEqualTypeOf<Task<[number, string]>>();

	const raceTask = Task.race([taskA, Task.make(2)]);
	expectTypeOf(raceTask).toEqualTypeOf<Task<number>>();

	const mixedRace = Task.race([taskA, taskB]);
	expectTypeOf(mixedRace).toEqualTypeOf<Task<number | string>>();
});

test("timeout: converts task into fallible result channel with typed error", () => {
	const taskNum = Task.make(42);
	const timed = pipe(taskNum, Task.timeout({ duration: Duration.seconds(1), onTimeout: () => "timed_out" as const }));
	expectTypeOf(timed).toEqualTypeOf<Task<Result<"timed_out", number>>>();
});

test("bind & bindTo: accumulates pipeline object record correctly", () => {
	const bound = pipe(Task.make(42), Task.bindTo("a"), Task.bind("b", ({ a }) => Task.make(a.toString())));
	expectTypeOf(bound).toEqualTypeOf<Task<{ a: number; } & { b: string; }>>();
	expectTypeOf(bound).toMatchTypeOf<Task<{ a: number; b: string; }>>();
});

test("memoize: preserves return type while caching result", () => {
	const memoized = Task.memoize(Task.make(42));
	expectTypeOf(memoized).toEqualTypeOf<Task<number>>();
});

test("withProgress & withLabel: attaches metadata and progress reporters", () => {
	const taskNum = Task.make(42);
	const progressTask = pipe(
		taskNum,
		Task.withProgress((ratio) => {
			expectTypeOf(ratio).toEqualTypeOf<number>();
		}),
	);
	expectTypeOf(progressTask).toEqualTypeOf<Task<number>>();

	const labeled = pipe(taskNum, Task.withLabel("syncJob"));
	expectTypeOf(labeled).toEqualTypeOf<Task.LabeledTask<"syncJob", number>>();
	expectTypeOf(labeled.label).toEqualTypeOf<"syncJob">();
});

test("run & abortable: execution dispatch and cancellable handle generation", () => {
	const taskNum = Task.make(42);
	const def = pipe(taskNum, Task.run());
	expectTypeOf(def).toEqualTypeOf<Deferred<number>>();

	const controller = new AbortController();
	const defWithSig = pipe(taskNum, Task.run(controller.signal));
	expectTypeOf(defWithSig).toEqualTypeOf<Deferred<number>>();

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

	// @ts-expect-error Task.timeout requires duration and onTimeout
	expectTypeOf(Task.timeout({ duration: Duration.seconds(1) })).toBeFunction();

	// @ts-expect-error Task.repeat requires times
	expectTypeOf(Task.repeat({})).toBeFunction();
});
