import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Deferred } from "../Deferred.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Task } from "../Task.ts";

test("Task.Maybe type equality check", async () => {
	const tm = Task.Maybe.make.some<number>(42);
	expectTypeOf(tm).toEqualTypeOf<Task.Maybe<number>>();
	const res = await tm();
	expectTypeOf(res).toEqualTypeOf<Maybe<number>>();
});

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("Task.Maybe.make.some creates a Task that resolves to Some", async () => {
	await expect(Task.Maybe.make.some(42)()).resolves.toStrictEqual({ kind: "Some", value: 42 });
});

test("Task.Maybe.make.none creates a Task that resolves to None", async () => {
	await expect(Task.Maybe.make.none()()).resolves.toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromMaybe
// ---------------------------------------------------------------------------

test("Task.Maybe.fromMaybe lifts Some into a Task", async () => {
	await expect(Task.Maybe.from.Maybe(Maybe.make.some(10))()).resolves.toStrictEqual({ kind: "Some", value: 10 });
});

test("Task.Maybe.fromMaybe lifts None into a Task", async () => {
	await expect(Task.Maybe.from.Maybe(Maybe.make.none())()).resolves.toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromTask
// ---------------------------------------------------------------------------

test("Task.Maybe.fromTask wraps a Task result in Some", async () => {
	const task = Task.resolve(5);
	await expect(Task.Maybe.from.Task(task)()).resolves.toStrictEqual({ kind: "Some", value: 5 });
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("Task.Maybe.tryCatch returns Some when Promise resolves", async () => {
	await expect(Task.Maybe.tryCatch(() => Promise.resolve(99))()).resolves.toStrictEqual({ kind: "Some", value: 99 });
});

test("Task.Maybe.tryCatch returns None when Promise rejects", async () => {
	await expect(Task.Maybe.tryCatch(() => Promise.reject(new Error("boom")))()).resolves.toStrictEqual({ kind: "None" });
});

test("Task.Maybe.tryCatch receives the AbortSignal from the call site", async () => {
	let receivedSignal: AbortSignal | undefined;
	const task = Task.Maybe.tryCatch((signal) => {
		receivedSignal = signal;
		return Promise.resolve(42);
	});
	const controller = new AbortController();
	await task(controller.signal);
	expect(receivedSignal).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Task.Maybe.map transforms Some value", async () => {
	await expect(pipe(Task.Maybe.make.some(5), Task.Maybe.map((n: number) => n * 2))()).resolves.toStrictEqual({
		kind: "Some",
		value: 10,
	});
});

test("Task.Maybe.map passes through None unchanged", async () => {
	await expect(pipe(Task.Maybe.make.none<number>(), Task.Maybe.map((n: number) => n * 2))()).resolves.toStrictEqual({
		kind: "None",
	});
});

test("Task.Maybe.map can change the value type", async () => {
	await expect(pipe(Task.Maybe.make.some(7), Task.Maybe.map((n: number) => `val:${n}`))()).resolves.toStrictEqual({
		kind: "Some",
		value: "val:7",
	});
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Task.Maybe.chain applies function when Some", async () => {
	const result = await pipe(Task.Maybe.make.some(5), Task.Maybe.chain((n: number) => Task.Maybe.make.some(n * 2)))();
	expect(result).toStrictEqual({ kind: "Some", value: 10 });
});

test("Task.Maybe.chain propagates None without calling function", async () => {
	let called = false;
	await pipe(
		Task.Maybe.make.none<number>(),
		Task.Maybe.chain((_n: number) => {
			called = true;
			return Task.Maybe.make.some(_n);
		}),
	)();
	expect(called).toBe(false);
});

test("Task.Maybe.chain returns None when function returns None", async () => {
	await expect(pipe(Task.Maybe.make.some(5), Task.Maybe.chain((_n: number) => Task.Maybe.make.none()))()).resolves
		.toStrictEqual({ kind: "None" });
});

test("Task.Maybe.chain composes multiple async steps", async () => {
	const result = await pipe(
		Task.Maybe.make.some(1),
		Task.Maybe.chain((n: number) => Task.Maybe.make.some(n + 1)),
		Task.Maybe.chain((n: number) => Task.Maybe.make.some(n * 10)),
	)();
	expect(result).toStrictEqual({ kind: "Some", value: 20 });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("Task.Maybe.ap applies Some function to Some value", async () => {
	const result = await pipe(Task.Maybe.make.some((n: number) => n * 3), Task.Maybe.ap(Task.Maybe.make.some(4)))();
	expect(result).toStrictEqual({ kind: "Some", value: 12 });
});

test("Task.Maybe.ap returns None when function is None", async () => {
	await expect(pipe(Task.Maybe.make.none<(n: number) => number>(), Task.Maybe.ap(Task.Maybe.make.some(4)))()).resolves
		.toStrictEqual({ kind: "None" });
});

test("Task.Maybe.ap returns None when argument is None", async () => {
	await expect(pipe(Task.Maybe.make.some((n: number) => n * 3), Task.Maybe.ap(Task.Maybe.make.none<number>()))())
		.resolves.toStrictEqual({ kind: "None" });
});

test("Task.Maybe.ap propagates the AbortSignal to both sides", async () => {
	const controller = new AbortController();
	let signal1: AbortSignal | undefined;
	let signal2: AbortSignal | undefined;

	const fnTask = (signal?: AbortSignal) =>
		Deferred.from.Promise(
			Promise.resolve(Maybe.make.some((n: number) => n * 3)).then((res) => {
				signal1 = signal;
				return res;
			}),
		);

	const argTask = (signal?: AbortSignal) =>
		Deferred.from.Promise(
			Promise.resolve(Maybe.make.some(4)).then((res) => {
				signal2 = signal;
				return res;
			}),
		);

	await pipe(fnTask, Task.Maybe.ap(argTask))(controller.signal);

	expect(signal1).toBe(controller.signal);
	expect(signal2).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Task.Maybe.fold calls onSome for Some", async () => {
	await expect(pipe(Task.Maybe.make.some(5), Task.Maybe.fold(() => "none", (n: number) => `some:${n}`))()).resolves.toBe(
		"some:5",
	);
});

test("Task.Maybe.fold calls onNone for None", async () => {
	await expect(pipe(Task.Maybe.make.none(), Task.Maybe.fold(() => "none", (n: number) => `some:${n}`))()).resolves.toBe(
		"none",
	);
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("Task.Maybe.match calls some handler for Some", async () => {
	await expect(
		pipe(Task.Maybe.make.some(5), Task.Maybe.match({ some: (n: number) => `got:${n}`, none: () => "empty" }))(),
	).resolves.toBe("got:5");
});

test("Task.Maybe.match calls none handler for None", async () => {
	await expect(
		pipe(Task.Maybe.make.none(), Task.Maybe.match({ some: (n: number) => `got:${n}`, none: () => "empty" }))(),
	).resolves.toBe("empty");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Task.Maybe.getOrElse returns value for Some", async () => {
	await expect(pipe(Task.Maybe.make.some(5), Task.Maybe.getOrElse(() => 0))()).resolves.toBe(5);
});

test("Task.Maybe.getOrElse returns default for None", async () => {
	await expect(pipe(Task.Maybe.make.none<number>(), Task.Maybe.getOrElse(() => 0))()).resolves.toBe(0);
});

test("Task.Maybe.getOrElse widens return type to A | B when default is a different type", async () => {
	const result = await pipe(Task.Maybe.make.none(), Task.Maybe.getOrElse(() => null))();
	expect(result).toBeNull();
});

test("Task.Maybe.getOrElse returns Some value typed as A | B when Some", async () => {
	const result = await pipe(Task.Maybe.make.some(5), Task.Maybe.getOrElse(() => null))();
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("Task.Maybe.tap executes side effect on Some and returns original", async () => {
	let seen = 0;
	const result = await pipe(
		Task.Maybe.make.some(5),
		Task.Maybe.tap((n: number) => {
			seen = n;
		}),
	)();
	expect(seen).toBe(5);
	expect(result).toStrictEqual({ kind: "Some", value: 5 });
});

test("Task.Maybe.tap does not execute side effect on None", async () => {
	let called = false;
	await pipe(
		Task.Maybe.make.none(),
		Task.Maybe.tap(() => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("Task.Maybe.filter keeps Some when predicate passes", async () => {
	await expect(pipe(Task.Maybe.make.some(5), Task.Maybe.filter((n: number) => n > 3))()).resolves.toStrictEqual({
		kind: "Some",
		value: 5,
	});
});

test("Task.Maybe.filter returns None when predicate fails", async () => {
	await expect(pipe(Task.Maybe.make.some(2), Task.Maybe.filter((n: number) => n > 3))()).resolves.toStrictEqual({
		kind: "None",
	});
});

test("Task.Maybe.filter passes through None unchanged", async () => {
	await expect(pipe(Task.Maybe.make.none<number>(), Task.Maybe.filter((_n) => true))()).resolves.toStrictEqual({
		kind: "None",
	});
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("Task.Maybe.toResult returns Ok for Some", async () => {
	await expect(pipe(Task.Maybe.make.some(42), Task.Maybe.to.Result(() => "missing"))()).resolves.toStrictEqual({
		kind: "Ok",
		value: 42,
	});
});

test("Task.Maybe.toResult returns Err for None using onNone", async () => {
	await expect(pipe(Task.Maybe.make.none<number>(), Task.Maybe.to.Result(() => "missing"))()).resolves.toStrictEqual({
		kind: "Err",
		error: "missing",
	});
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Task.Maybe composes well in a pipe chain", async () => {
	const result = await pipe(
		Task.Maybe.make.some(5),
		Task.Maybe.map((n: number) => n * 2),
		Task.Maybe.filter((n: number) => n > 5),
		Task.Maybe.chain((n: number) => Task.Maybe.make.some(n + 1)),
		Task.Maybe.getOrElse(() => 0),
	)();
	expect(result).toBe(11);
});

test("Task.Maybe pipe short-circuits on None", async () => {
	const result = await pipe(
		Task.Maybe.make.some(2),
		Task.Maybe.filter((n: number) => n > 5),
		Task.Maybe.map((n: number) => n * 10),
		Task.Maybe.getOrElse(() => 0),
	)();
	expect(result).toBe(0);
});

// --- from.nullable ---

test("Task.Maybe.from.nullable returns Some for non-null value", async () => {
	const result = await Task.Maybe.from.nullable(42)();
	expect(result).toStrictEqual(Maybe.make.some(42));
});

test("Task.Maybe.from.nullable returns None for null", async () => {
	const result = await Task.Maybe.from.nullable(null)();
	expect(result).toStrictEqual(Maybe.make.none());
});

test("Task.Maybe.from.nullable returns None for undefined", async () => {
	const result = await Task.Maybe.from.nullable(undefined)();
	expect(result).toStrictEqual(Maybe.make.none());
});

// --- fromResult ---

test("Task.Maybe.fromResult returns Some for Ok", async () => {
	const result = await Task.Maybe.from.Result(Result.make.ok(42))();
	expect(result).toStrictEqual(Maybe.make.some(42));
});

test("Task.Maybe.fromResult returns None for Error", async () => {
	const result = await Task.Maybe.from.Result(Result.make.err("bad"))();
	expect(result).toStrictEqual(Maybe.make.none());
});

// --- bindTo ---

test("Task.Maybe.bindTo wraps a value in an accumulator object", async () => {
	const result = await pipe(Task.Maybe.make.some(2), Task.Maybe.bindTo("a"))();
	expect(result).toStrictEqual(Maybe.make.some({ a: 2 }));
});

// --- bind ---

test("Task.Maybe.bind accumulates values key-by-key in a pipeline", async () => {
	const result = await pipe(
		Task.Maybe.make.some(2),
		Task.Maybe.bindTo("a"),
		Task.Maybe.bind("b", ({ a }) => Task.Maybe.make.some(a * 3)),
		Task.Maybe.bind("c", ({ a, b }) => Task.Maybe.make.some(a + b)),
	)();
	expect(result).toStrictEqual(Maybe.make.some({ a: 2, b: 6, c: 8 }));
});

test("Task.Maybe.bind short-circuits on None", async () => {
	let called = false;
	const result = await pipe(
		Task.Maybe.make.some(2),
		Task.Maybe.bindTo("a"),
		Task.Maybe.bind("b", () => Task.Maybe.make.none()),
		Task.Maybe.bind("c", ({ b }) => {
			called = true;
			return Task.Maybe.make.some(b);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual(Maybe.make.none());
});

// --- recover ---

test("Task.Maybe.recover returns original Some", async () => {
	const result = await pipe(Task.Maybe.make.some(42), Task.Maybe.recover(() => Task.Maybe.make.some(0)))();
	expect(result).toStrictEqual(Maybe.make.some(42));
});

test("Task.Maybe.recover returns fallback on None", async () => {
	const result = await pipe(Task.Maybe.make.none<number>(), Task.Maybe.recover(() => Task.Maybe.make.some(42)))();
	expect(result).toStrictEqual(Maybe.make.some(42));
});

// --- struct ---

test("Task.Maybe.struct combines record of Some in parallel", async () => {
	const result = await Task.Maybe.struct({ name: Task.Maybe.make.some("Alice"), age: Task.Maybe.make.some(30) })();
	expect(result).toStrictEqual(Maybe.make.some({ name: "Alice", age: 30 }));
});

test("Task.Maybe.struct returns None if any key yields None", async () => {
	const result = await Task.Maybe.struct({ name: Task.Maybe.make.some("Alice"), age: Task.Maybe.make.none<number>() })();
	expect(result).toStrictEqual(Maybe.make.none());
});

test("Task.Maybe.make creates some and none tasks", async () => {
	const someTask = Task.Maybe.make.some(42);
	const noneTask = Task.Maybe.make.none();

	await expect(someTask()).resolves.toStrictEqual(Maybe.make.some(42));
	await expect(noneTask()).resolves.toStrictEqual(Maybe.make.none());
});

test("Task.Maybe.memoize executes task only once across multiple calls", async () => {
	let calls = 0;
	const task = Task.Maybe.tryCatch(() => {
		calls++;
		return Promise.resolve(99);
	});
	const memoized = Task.Maybe.memoize(task);

	const r1 = await memoized();
	const r2 = await memoized();

	expect(r1).toStrictEqual(Maybe.make.some(99));
	expect(r2).toStrictEqual(Maybe.make.some(99));
	expect(calls).toBe(1);
});
