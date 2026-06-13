import { pipe } from "#composition";
import { Maybe, Result, Task } from "#core";
import { expect, test } from "vitest";

// ---------------------------------------------------------------------------
// of
// ---------------------------------------------------------------------------

test("Task.Maybe.some creates a Task that resolves to Some", async () => {
	await expect(Task.Maybe.some(42)()).resolves.toStrictEqual({ kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// none
// ---------------------------------------------------------------------------

test("Task.Maybe.none creates a Task that resolves to None", async () => {
	await expect(Task.Maybe.none()()).resolves.toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromMaybe
// ---------------------------------------------------------------------------

test("Task.Maybe.fromMaybe lifts Some into a Task", async () => {
	await expect(Task.Maybe.fromMaybe(Maybe.some(10))()).resolves.toStrictEqual({ kind: "Some", value: 10 });
});

test("Task.Maybe.fromMaybe lifts None into a Task", async () => {
	await expect(Task.Maybe.fromMaybe(Maybe.none())()).resolves.toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromTask
// ---------------------------------------------------------------------------

test("Task.Maybe.fromTask wraps a Task result in Some", async () => {
	const task = Task.resolve(5);
	await expect(Task.Maybe.fromTask(task)()).resolves.toStrictEqual({ kind: "Some", value: 5 });
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("taskMaybe.tryCatch returns Some when Promise resolves", async () => {
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
	await expect(pipe(Task.Maybe.some(5), Task.Maybe.map((n: number) => n * 2))()).resolves.toStrictEqual({
		kind: "Some",
		value: 10,
	});
});

test("Task.Maybe.map passes through None unchanged", async () => {
	await expect(pipe(Task.Maybe.none<number>(), Task.Maybe.map((n: number) => n * 2))()).resolves.toStrictEqual({
		kind: "None",
	});
});

test("Task.Maybe.map can change the value type", async () => {
	await expect(pipe(Task.Maybe.some(7), Task.Maybe.map((n: number) => `val:${n}`))()).resolves.toStrictEqual({
		kind: "Some",
		value: "val:7",
	});
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Task.Maybe.chain applies function when Some", async () => {
	const result = await pipe(Task.Maybe.some(5), Task.Maybe.chain((n: number) => Task.Maybe.some(n * 2)))();
	expect(result).toStrictEqual({ kind: "Some", value: 10 });
});

test("taskMaybe.chain propagates None without calling function", async () => {
	let called = false;
	await pipe(
		Task.Maybe.none<number>(),
		Task.Maybe.chain((_n: number) => {
			called = true;
			return Task.Maybe.some(_n);
		}),
	)();
	expect(called).toBe(false);
});

test("taskMaybe.chain returns None when function returns None", async () => {
	await expect(pipe(Task.Maybe.some(5), Task.Maybe.chain((_n: number) => Task.Maybe.none()))()).resolves.toStrictEqual({
		kind: "None",
	});
});

test("Task.Maybe.chain composes multiple async steps", async () => {
	const result = await pipe(
		Task.Maybe.some(1),
		Task.Maybe.chain((n: number) => Task.Maybe.some(n + 1)),
		Task.Maybe.chain((n: number) => Task.Maybe.some(n * 10)),
	)();
	expect(result).toStrictEqual({ kind: "Some", value: 20 });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("Task.Maybe.ap applies Some function to Some value", async () => {
	const result = await pipe(Task.Maybe.some((n: number) => n * 3), Task.Maybe.ap(Task.Maybe.some(4)))();
	expect(result).toStrictEqual({ kind: "Some", value: 12 });
});

test("Task.Maybe.ap returns None when function is None", async () => {
	await expect(pipe(Task.Maybe.none<(n: number) => number>(), Task.Maybe.ap(Task.Maybe.some(4)))()).resolves
		.toStrictEqual({ kind: "None" });
});

test("Task.Maybe.ap returns None when argument is None", async () => {
	await expect(pipe(Task.Maybe.some((n: number) => n * 3), Task.Maybe.ap(Task.Maybe.none<number>()))()).resolves
		.toStrictEqual({ kind: "None" });
});

test("Task.Maybe.ap propagates the AbortSignal to both sides", async () => {
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

	await pipe(fnTask, Task.Maybe.ap(argTask))(controller.signal);

	expect(signal1).toBe(controller.signal);
	expect(signal2).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Task.Maybe.fold calls onSome for Some", async () => {
	await expect(pipe(Task.Maybe.some(5), Task.Maybe.fold(() => "none", (n: number) => `some:${n}`))()).resolves.toBe(
		"some:5",
	);
});

test("Task.Maybe.fold calls onNone for None", async () => {
	await expect(pipe(Task.Maybe.none(), Task.Maybe.fold(() => "none", (n: number) => `some:${n}`))()).resolves.toBe(
		"none",
	);
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("Task.Maybe.match calls some handler for Some", async () => {
	await expect(pipe(Task.Maybe.some(5), Task.Maybe.match({ some: (n: number) => `got:${n}`, none: () => "empty" }))())
		.resolves.toBe("got:5");
});

test("Task.Maybe.match calls none handler for None", async () => {
	await expect(pipe(Task.Maybe.none(), Task.Maybe.match({ some: (n: number) => `got:${n}`, none: () => "empty" }))())
		.resolves.toBe("empty");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Task.Maybe.getOrElse returns value for Some", async () => {
	await expect(pipe(Task.Maybe.some(5), Task.Maybe.getOrElse(() => 0))()).resolves.toBe(5);
});

test("Task.Maybe.getOrElse returns default for None", async () => {
	await expect(pipe(Task.Maybe.none<number>(), Task.Maybe.getOrElse(() => 0))()).resolves.toBe(0);
});

test("Task.Maybe.getOrElse widens return type to A | B when default is a different type", async () => {
	const result = await pipe(Task.Maybe.none(), Task.Maybe.getOrElse(() => null))();
	expect(result).toBeNull();
});

test("Task.Maybe.getOrElse returns Some value typed as A | B when Some", async () => {
	const result = await pipe(Task.Maybe.some(5), Task.Maybe.getOrElse(() => null))();
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("taskMaybe.tap executes side effect on Some and returns original", async () => {
	let seen = 0;
	const result = await pipe(
		Task.Maybe.some(5),
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
		Task.Maybe.none(),
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
	await expect(pipe(Task.Maybe.some(5), Task.Maybe.filter((n: number) => n > 3))()).resolves.toStrictEqual({
		kind: "Some",
		value: 5,
	});
});

test("Task.Maybe.filter returns None when predicate fails", async () => {
	await expect(pipe(Task.Maybe.some(2), Task.Maybe.filter((n: number) => n > 3))()).resolves.toStrictEqual({
		kind: "None",
	});
});

test("Task.Maybe.filter passes through None unchanged", async () => {
	await expect(pipe(Task.Maybe.none<number>(), Task.Maybe.filter((_n) => true))()).resolves.toStrictEqual({
		kind: "None",
	});
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("Task.Maybe.toResult returns Ok for Some", async () => {
	await expect(pipe(Task.Maybe.some(42), Task.Maybe.toResult(() => "missing"))()).resolves.toStrictEqual({
		kind: "Ok",
		value: 42,
	});
});

test("taskMaybe.toResult returns Err for None using onNone", async () => {
	await expect(pipe(Task.Maybe.none<number>(), Task.Maybe.toResult(() => "missing"))()).resolves.toStrictEqual({
		kind: "Err",
		error: "missing",
	});
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("taskMaybe composes well in a pipe chain", async () => {
	const result = await pipe(
		Task.Maybe.some(5),
		Task.Maybe.map((n: number) => n * 2),
		Task.Maybe.filter((n: number) => n > 5),
		Task.Maybe.chain((n: number) => Task.Maybe.some(n + 1)),
		Task.Maybe.getOrElse(() => 0),
	)();
	expect(result).toBe(11);
});

test("taskMaybe pipe short-circuits on None", async () => {
	const result = await pipe(
		Task.Maybe.some(2),
		Task.Maybe.filter((n: number) => n > 5),
		Task.Maybe.map((n: number) => n * 10),
		Task.Maybe.getOrElse(() => 0),
	)();
	expect(result).toBe(0);
});

// --- fromNullable ---

test("Task.Maybe.fromNullable returns Some for non-null value", async () => {
	const result = await Task.Maybe.fromNullable(42)();
	expect(result).toStrictEqual(Maybe.some(42));
});

test("Task.Maybe.fromNullable returns None for null", async () => {
	const result = await Task.Maybe.fromNullable(null)();
	expect(result).toStrictEqual(Maybe.none());
});

test("Task.Maybe.fromNullable returns None for undefined", async () => {
	const result = await Task.Maybe.fromNullable(undefined)();
	expect(result).toStrictEqual(Maybe.none());
});

// --- fromResult ---

test("Task.Maybe.fromResult returns Some for Ok", async () => {
	const result = await Task.Maybe.fromResult(Result.ok(42))();
	expect(result).toStrictEqual(Maybe.some(42));
});

test("Task.Maybe.fromResult returns None for Error", async () => {
	const result = await Task.Maybe.fromResult(Result.err("bad"))();
	expect(result).toStrictEqual(Maybe.none());
});

// --- bindTo ---

test("Task.Maybe.bindTo wraps a value in an accumulator object", async () => {
	const result = await pipe(Task.Maybe.some(2), Task.Maybe.bindTo("a"))();
	expect(result).toStrictEqual(Maybe.some({ a: 2 }));
});

// --- bind ---

test("Task.Maybe.bind accumulates values key-by-key in a pipeline", async () => {
	const result = await pipe(
		Task.Maybe.some(2),
		Task.Maybe.bindTo("a"),
		Task.Maybe.bind("b", ({ a }) => Task.Maybe.some(a * 3)),
		Task.Maybe.bind("c", ({ a, b }) => Task.Maybe.some(a + b)),
	)();
	expect(result).toStrictEqual(Maybe.some({ a: 2, b: 6, c: 8 }));
});

test("Task.Maybe.bind short-circuits on None", async () => {
	let called = false;
	const result = await pipe(
		Task.Maybe.some(2),
		Task.Maybe.bindTo("a"),
		Task.Maybe.bind("b", () => Task.Maybe.none()),
		Task.Maybe.bind("c", ({ b }) => {
			called = true;
			return Task.Maybe.some(b);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual(Maybe.none());
});

// --- recover ---

test("Task.Maybe.recover returns original Some", async () => {
	const result = await pipe(Task.Maybe.some(42), Task.Maybe.recover(() => Task.Maybe.some(0)))();
	expect(result).toStrictEqual(Maybe.some(42));
});

test("Task.Maybe.recover returns fallback on None", async () => {
	const result = await pipe(Task.Maybe.none<number>(), Task.Maybe.recover(() => Task.Maybe.some(42)))();
	expect(result).toStrictEqual(Maybe.some(42));
});

// --- struct ---

test("Task.Maybe.struct combines record of Some in parallel", async () => {
	const result = await Task.Maybe.struct({ name: Task.Maybe.some("Alice"), age: Task.Maybe.some(30) })();
	expect(result).toStrictEqual(Maybe.some({ name: "Alice", age: 30 }));
});

test("Task.Maybe.struct returns None if any key yields None", async () => {
	const result = await Task.Maybe.struct({ name: Task.Maybe.some("Alice"), age: Task.Maybe.none<number>() })();
	expect(result).toStrictEqual(Maybe.none());
});
