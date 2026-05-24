import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Task } from "../Task.ts";
import { TaskMaybe } from "../TaskMaybe.ts";

// ---------------------------------------------------------------------------
// of
// ---------------------------------------------------------------------------

test("TaskMaybe.some creates a Task that resolves to Some", async () => {
	await expect(TaskMaybe.some(42)()).resolves.toStrictEqual({ kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// none
// ---------------------------------------------------------------------------

test("TaskMaybe.none creates a Task that resolves to None", async () => {
	await expect(TaskMaybe.none()()).resolves.toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromMaybe
// ---------------------------------------------------------------------------

test("TaskMaybe.fromMaybe lifts Some into a Task", async () => {
	await expect(TaskMaybe.fromMaybe(Maybe.some(10))()).resolves.toStrictEqual({ kind: "Some", value: 10 });
});

test("TaskMaybe.fromMaybe lifts None into a Task", async () => {
	await expect(TaskMaybe.fromMaybe(Maybe.none())()).resolves.toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromTask
// ---------------------------------------------------------------------------

test("TaskMaybe.fromTask wraps a Task result in Some", async () => {
	const task = Task.resolve(5);
	await expect(TaskMaybe.fromTask(task)()).resolves.toStrictEqual({ kind: "Some", value: 5 });
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("taskMaybe.tryCatch returns Some when Promise resolves", async () => {
	await expect(TaskMaybe.tryCatch(() => Promise.resolve(99))()).resolves.toStrictEqual({ kind: "Some", value: 99 });
});

test("TaskMaybe.tryCatch returns None when Promise rejects", async () => {
	await expect(TaskMaybe.tryCatch(() => Promise.reject(new Error("boom")))()).resolves.toStrictEqual({ kind: "None" });
});

test("TaskMaybe.tryCatch receives the AbortSignal from the call site", async () => {
	let receivedSignal: AbortSignal | undefined;
	const task = TaskMaybe.tryCatch((signal) => {
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

test("TaskMaybe.map transforms Some value", async () => {
	await expect(pipe(TaskMaybe.some(5), TaskMaybe.map((n: number) => n * 2))()).resolves.toStrictEqual({
		kind: "Some",
		value: 10,
	});
});

test("TaskMaybe.map passes through None unchanged", async () => {
	await expect(pipe(TaskMaybe.none<number>(), TaskMaybe.map((n: number) => n * 2))()).resolves.toStrictEqual({
		kind: "None",
	});
});

test("TaskMaybe.map can change the value type", async () => {
	await expect(pipe(TaskMaybe.some(7), TaskMaybe.map((n: number) => `val:${n}`))()).resolves.toStrictEqual({
		kind: "Some",
		value: "val:7",
	});
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("TaskMaybe.chain applies function when Some", async () => {
	const result = await pipe(TaskMaybe.some(5), TaskMaybe.chain((n: number) => TaskMaybe.some(n * 2)))();
	expect(result).toStrictEqual({ kind: "Some", value: 10 });
});

test("taskMaybe.chain propagates None without calling function", async () => {
	let called = false;
	await pipe(
		TaskMaybe.none<number>(),
		TaskMaybe.chain((_n: number) => {
			called = true;
			return TaskMaybe.some(_n);
		}),
	)();
	expect(called).toBe(false);
});

test("taskMaybe.chain returns None when function returns None", async () => {
	await expect(pipe(TaskMaybe.some(5), TaskMaybe.chain((_n: number) => TaskMaybe.none()))()).resolves.toStrictEqual({
		kind: "None",
	});
});

test("TaskMaybe.chain composes multiple async steps", async () => {
	const result = await pipe(
		TaskMaybe.some(1),
		TaskMaybe.chain((n: number) => TaskMaybe.some(n + 1)),
		TaskMaybe.chain((n: number) => TaskMaybe.some(n * 10)),
	)();
	expect(result).toStrictEqual({ kind: "Some", value: 20 });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("TaskMaybe.ap applies Some function to Some value", async () => {
	const result = await pipe(TaskMaybe.some((n: number) => n * 3), TaskMaybe.ap(TaskMaybe.some(4)))();
	expect(result).toStrictEqual({ kind: "Some", value: 12 });
});

test("TaskMaybe.ap returns None when function is None", async () => {
	await expect(pipe(TaskMaybe.none<(n: number) => number>(), TaskMaybe.ap(TaskMaybe.some(4)))()).resolves.toStrictEqual({
		kind: "None",
	});
});

test("TaskMaybe.ap returns None when argument is None", async () => {
	await expect(pipe(TaskMaybe.some((n: number) => n * 3), TaskMaybe.ap(TaskMaybe.none<number>()))()).resolves
		.toStrictEqual({ kind: "None" });
});

test("TaskMaybe.ap propagates the AbortSignal to both sides", async () => {
	const controller = new AbortController();
	let signal1: AbortSignal | undefined;
	let signal2: AbortSignal | undefined;

	const fnTask = Task.from((signal) => {
		signal1 = signal;
		return Promise.resolve(Maybe.some((n: number) => n * 3));
	});

	const argTask = Task.from((signal) => {
		signal2 = signal;
		return Promise.resolve(Maybe.some(4));
	});

	await pipe(fnTask, TaskMaybe.ap(argTask))(controller.signal);

	expect(signal1).toBe(controller.signal);
	expect(signal2).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("TaskMaybe.fold calls onSome for Some", async () => {
	await expect(pipe(TaskMaybe.some(5), TaskMaybe.fold(() => "none", (n: number) => `some:${n}`))()).resolves.toBe(
		"some:5",
	);
});

test("TaskMaybe.fold calls onNone for None", async () => {
	await expect(pipe(TaskMaybe.none(), TaskMaybe.fold(() => "none", (n: number) => `some:${n}`))()).resolves.toBe("none");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("TaskMaybe.match calls some handler for Some", async () => {
	await expect(pipe(TaskMaybe.some(5), TaskMaybe.match({ some: (n: number) => `got:${n}`, none: () => "empty" }))())
		.resolves.toBe("got:5");
});

test("TaskMaybe.match calls none handler for None", async () => {
	await expect(pipe(TaskMaybe.none(), TaskMaybe.match({ some: (n: number) => `got:${n}`, none: () => "empty" }))())
		.resolves.toBe("empty");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("TaskMaybe.getOrElse returns value for Some", async () => {
	await expect(pipe(TaskMaybe.some(5), TaskMaybe.getOrElse(() => 0))()).resolves.toBe(5);
});

test("TaskMaybe.getOrElse returns default for None", async () => {
	await expect(pipe(TaskMaybe.none<number>(), TaskMaybe.getOrElse(() => 0))()).resolves.toBe(0);
});

test("TaskMaybe.getOrElse widens return type to A | B when default is a different type", async () => {
	const result = await pipe(TaskMaybe.none(), TaskMaybe.getOrElse(() => null))();
	expect(result).toBeNull();
});

test("TaskMaybe.getOrElse returns Some value typed as A | B when Some", async () => {
	const result = await pipe(TaskMaybe.some(5), TaskMaybe.getOrElse(() => null))();
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("taskMaybe.tap executes side effect on Some and returns original", async () => {
	let seen = 0;
	const result = await pipe(
		TaskMaybe.some(5),
		TaskMaybe.tap((n: number) => {
			seen = n;
		}),
	)();
	expect(seen).toBe(5);
	expect(result).toStrictEqual({ kind: "Some", value: 5 });
});

test("TaskMaybe.tap does not execute side effect on None", async () => {
	let called = false;
	await pipe(
		TaskMaybe.none(),
		TaskMaybe.tap(() => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("TaskMaybe.filter keeps Some when predicate passes", async () => {
	await expect(pipe(TaskMaybe.some(5), TaskMaybe.filter((n: number) => n > 3))()).resolves.toStrictEqual({
		kind: "Some",
		value: 5,
	});
});

test("TaskMaybe.filter returns None when predicate fails", async () => {
	await expect(pipe(TaskMaybe.some(2), TaskMaybe.filter((n: number) => n > 3))()).resolves.toStrictEqual({
		kind: "None",
	});
});

test("TaskMaybe.filter passes through None unchanged", async () => {
	await expect(pipe(TaskMaybe.none<number>(), TaskMaybe.filter((_n) => true))()).resolves.toStrictEqual({
		kind: "None",
	});
});

// ---------------------------------------------------------------------------
// toTaskResult
// ---------------------------------------------------------------------------

test("TaskMaybe.toTaskResult returns Ok for Some", async () => {
	await expect(pipe(TaskMaybe.some(42), TaskMaybe.toTaskResult(() => "missing"))()).resolves.toStrictEqual({
		kind: "Ok",
		value: 42,
	});
});

test("taskMaybe.toTaskResult returns Err for None using onNone", async () => {
	await expect(pipe(TaskMaybe.none<number>(), TaskMaybe.toTaskResult(() => "missing"))()).resolves.toStrictEqual({
		kind: "Err",
		error: "missing",
	});
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("taskMaybe composes well in a pipe chain", async () => {
	const result = await pipe(
		TaskMaybe.some(5),
		TaskMaybe.map((n: number) => n * 2),
		TaskMaybe.filter((n: number) => n > 5),
		TaskMaybe.chain((n: number) => TaskMaybe.some(n + 1)),
		TaskMaybe.getOrElse(() => 0),
	)();
	expect(result).toBe(11);
});

test("taskMaybe pipe short-circuits on None", async () => {
	const result = await pipe(
		TaskMaybe.some(2),
		TaskMaybe.filter((n: number) => n > 5),
		TaskMaybe.map((n: number) => n * 10),
		TaskMaybe.getOrElse(() => 0),
	)();
	expect(result).toBe(0);
});

// --- fromNullable ---

test("TaskMaybe.fromNullable returns Some for non-null value", async () => {
	const result = await TaskMaybe.fromNullable(42)();
	expect(result).toStrictEqual(Maybe.some(42));
});

test("TaskMaybe.fromNullable returns None for null", async () => {
	const result = await TaskMaybe.fromNullable(null)();
	expect(result).toStrictEqual(Maybe.none());
});

test("TaskMaybe.fromNullable returns None for undefined", async () => {
	const result = await TaskMaybe.fromNullable(undefined)();
	expect(result).toStrictEqual(Maybe.none());
});

// --- fromResult ---

test("TaskMaybe.fromResult returns Some for Ok", async () => {
	const result = await TaskMaybe.fromResult(Result.ok(42))();
	expect(result).toStrictEqual(Maybe.some(42));
});

test("TaskMaybe.fromResult returns None for Error", async () => {
	const result = await TaskMaybe.fromResult(Result.err("bad"))();
	expect(result).toStrictEqual(Maybe.none());
});

// --- bindTo ---

test("TaskMaybe.bindTo wraps a value in an accumulator object", async () => {
	const result = await pipe(TaskMaybe.some(2), TaskMaybe.bindTo("a"))();
	expect(result).toStrictEqual(Maybe.some({ a: 2 }));
});

// --- bind ---

test("TaskMaybe.bind accumulates values key-by-key in a pipeline", async () => {
	const result = await pipe(
		TaskMaybe.some(2),
		TaskMaybe.bindTo("a"),
		TaskMaybe.bind("b", ({ a }) => TaskMaybe.some(a * 3)),
		TaskMaybe.bind("c", ({ a, b }) => TaskMaybe.some(a + b)),
	)();
	expect(result).toStrictEqual(Maybe.some({ a: 2, b: 6, c: 8 }));
});

test("TaskMaybe.bind short-circuits on None", async () => {
	let called = false;
	const result = await pipe(
		TaskMaybe.some(2),
		TaskMaybe.bindTo("a"),
		TaskMaybe.bind("b", () => TaskMaybe.none()),
		TaskMaybe.bind("c", ({ b }) => {
			called = true;
			return TaskMaybe.some(b);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual(Maybe.none());
});
