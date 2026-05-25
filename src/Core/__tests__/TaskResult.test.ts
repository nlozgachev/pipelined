import { pipe } from "#composition";
import { Deferred, Maybe, Result, TaskResult } from "#core";
import { expect, expectTypeOf, test } from "vitest";

// ---------------------------------------------------------------------------
// of
// ---------------------------------------------------------------------------

test("TaskResult.ok creates a Task that resolves to Ok", async () => {
	const result = await TaskResult.ok<string, number>(42)();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

// ---------------------------------------------------------------------------
// fail
// ---------------------------------------------------------------------------

test("TaskResult.err creates a Task that resolves to Err", async () => {
	const result = await TaskResult.err<string, number>("error")();
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("TaskResult.tryCatch returns Ok when Promise resolves", async () => {
	const result = await TaskResult.tryCatch(() => Promise.resolve(42), (e) => `Error: ${e}`)();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("TaskResult.tryCatch returns Err when Promise rejects", async () => {
	const result = await TaskResult.tryCatch(() => Promise.reject(new Error("boom")), (e) => (e as Error).message)();
	expect(result).toStrictEqual({ kind: "Err", error: "boom" });
});

test("taskResult.tryCatch catches synchronous throws in async functions", async () => {
	const result = await TaskResult.tryCatch(
		// oxlint-disable-next-line require-await
		async () => {
			throw new Error("sync throw");
		},
		(e) => (e as Error).message,
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "sync throw" });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("TaskResult.map transforms Ok value", async () => {
	const result = await pipe(TaskResult.ok<string, number>(5), TaskResult.map((n: number) => n * 2))();
	expect(result).toStrictEqual({ kind: "Ok", value: 10 });
});

test("TaskResult.map passes through Err unchanged", async () => {
	const result = await pipe(TaskResult.err<string, number>("error"), TaskResult.map((n: number) => n * 2))();
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

test("TaskResult.map can change the value type", async () => {
	const result = await pipe(TaskResult.ok<string, number>(42), TaskResult.map((n: number) => `num: ${n}`))();
	expect(result).toStrictEqual({ kind: "Ok", value: "num: 42" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("TaskResult.mapError transforms Err value", async () => {
	const result = await pipe(
		TaskResult.err<string, number>("oops"),
		TaskResult.mapError((e: string) => e.toUpperCase()),
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "OOPS" });
});

test("TaskResult.mapError passes through Ok unchanged", async () => {
	const result = await pipe(TaskResult.ok<string, number>(5), TaskResult.mapError((e: string) => e.toUpperCase()))();
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("TaskResult.chain applies function when Ok", async () => {
	const validatePositive = (n: number): TaskResult<string, number> =>
		n > 0 ? TaskResult.ok(n) : TaskResult.err("Must be positive");

	const result = await pipe(TaskResult.ok<string, number>(5), TaskResult.chain(validatePositive))();
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("taskResult.chain returns Err when function returns Err", async () => {
	const validatePositive = (n: number): TaskResult<string, number> =>
		n > 0 ? TaskResult.ok(n) : TaskResult.err("Must be positive");

	const result = await pipe(TaskResult.ok<string, number>(-1), TaskResult.chain(validatePositive))();
	expect(result).toStrictEqual({ kind: "Err", error: "Must be positive" });
});

test("taskResult.chain propagates Err without calling function", async () => {
	let called = false;
	const result = await pipe(
		TaskResult.err<string, number>("error"),
		TaskResult.chain((_n: number) => {
			called = true;
			return TaskResult.ok<string, number>(_n);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

test("TaskResult.chain composes multiple async steps", async () => {
	const result = await pipe(
		TaskResult.ok<string, number>(1),
		TaskResult.chain((n: number) => TaskResult.ok<string, number>(n + 1)),
		TaskResult.chain((n: number) => TaskResult.ok<string, number>(n * 10)),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 20 });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("TaskResult.fold calls onOk for Ok", async () => {
	const result = await pipe(
		TaskResult.ok<string, number>(5),
		TaskResult.fold((e: string) => `Error: ${e}`, (n: number) => `Value: ${n}`),
	)();
	expect(result).toBe("Value: 5");
});

test("TaskResult.fold calls onErr for Err", async () => {
	const result = await pipe(
		TaskResult.err<string, number>("bad"),
		TaskResult.fold((e: string) => `Error: ${e}`, (n: number) => `Value: ${n}`),
	)();
	expect(result).toBe("Error: bad");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("TaskResult.match calls ok handler for Ok", async () => {
	const result = await pipe(
		TaskResult.ok<string, number>(5),
		TaskResult.match({ ok: (n: number) => `got ${n}`, err: (e: string) => `failed: ${e}` }),
	)();
	expect(result).toBe("got 5");
});

test("TaskResult.match calls err handler for Err", async () => {
	const result = await pipe(
		TaskResult.err<string, number>("bad"),
		TaskResult.match({ ok: (n: number) => `got ${n}`, err: (e: string) => `failed: ${e}` }),
	)();
	expect(result).toBe("failed: bad");
});

test("taskResult.match is data-last (returns a function first)", async () => {
	const handler = TaskResult.match<string, number, string>({ ok: (n) => `val: ${n}`, err: (e) => `err: ${e}` });
	const okResult = await handler(TaskResult.ok<string, number>(3))();
	expect(okResult).toBe("val: 3");
	const errResult = await handler(TaskResult.err<string, number>("x"))();
	expect(errResult).toBe("err: x");
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("taskResult.recover returns original Ok without calling fallback", async () => {
	let called = false;
	const result = await pipe(
		TaskResult.ok<string, number>(5),
		TaskResult.recover((_e: string) => {
			called = true;
			return TaskResult.ok<string, number>(99);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("TaskResult.recover provides fallback for Err", async () => {
	const result = await pipe(
		TaskResult.err<string, number>("error"),
		TaskResult.recover((_e: string) => TaskResult.ok<string, number>(99)),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 99 });
});

test("taskResult.recover widens to TaskResult<E, A | B> when fallback returns a different type", async () => {
	const result = await pipe(TaskResult.err("error"), TaskResult.recover((_e) => TaskResult.ok("recovered")))();
	expect(result).toStrictEqual({ kind: "Ok", value: "recovered" });
});

test("TaskResult.recover preserves Ok typed as TaskResult<E, A | B>", async () => {
	const result = await pipe(TaskResult.ok(5), TaskResult.recover((_e) => TaskResult.ok("recovered")))();
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("taskResult.recover passes the error to the fallback function", async () => {
	let receivedError = "";
	await pipe(
		TaskResult.err<string, number>("original error"),
		TaskResult.recover((e: string) => {
			receivedError = e;
			return TaskResult.ok<string, number>(0);
		}),
	)();
	expect(receivedError).toBe("original error");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("TaskResult.getOrElse returns value for Ok", async () => {
	const result = await pipe(TaskResult.ok<string, number>(5), TaskResult.getOrElse(() => 0))();
	expect(result).toBe(5);
});

test("TaskResult.getOrElse returns default for Err", async () => {
	const result = await pipe(TaskResult.err<string, number>("error"), TaskResult.getOrElse(() => 0))();
	expect(result).toBe(0);
});

test("TaskResult.getOrElse widens return type to A | B when default is a different type", async () => {
	const result = await pipe(TaskResult.err("error"), TaskResult.getOrElse(() => null))();
	expect(result).toBeNull();
});

test("TaskResult.getOrElse returns Ok value typed as A | B when Ok", async () => {
	const result = await pipe(TaskResult.ok(5), TaskResult.getOrElse(() => null))();
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("taskResult.tap executes side effect on Ok and returns original", async () => {
	let sideEffect = 0;
	const result = await pipe(
		TaskResult.ok<string, number>(5),
		TaskResult.tap((n: number) => {
			sideEffect = n;
		}),
	)();
	expect(sideEffect).toBe(5);
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("TaskResult.tap does not execute side effect on Err", async () => {
	let called = false;
	const result = await pipe(
		TaskResult.err<string, number>("error"),
		TaskResult.tap((_n: number) => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("taskResult composes well in a pipe chain", async () => {
	const result = await pipe(
		TaskResult.ok<string, number>(5),
		TaskResult.map((n: number) => n * 2),
		TaskResult.chain((n: number) =>
			n > 5 ? TaskResult.ok<string, number>(n) : TaskResult.err<string, number>("Too small")
		),
		TaskResult.getOrElse(() => 0),
	)();
	expect(result).toBe(10);
});

test("taskResult pipe short-circuits on Err", async () => {
	const result = await pipe(
		TaskResult.ok<string, number>(2),
		TaskResult.map((n: number) => n * 2),
		TaskResult.chain((n: number) =>
			n > 5 ? TaskResult.ok<string, number>(n) : TaskResult.err<string, number>("Too small")
		),
		TaskResult.getOrElse(() => 0),
	)();
	expect(result).toBe(0);
});

test("taskResult tryCatch integrates with pipe chain", async () => {
	const result = await pipe(
		TaskResult.tryCatch(() => Promise.resolve(42), (e) => `Error: ${e}`),
		TaskResult.map((n: number) => n + 8),
		TaskResult.getOrElse(() => 0),
	)();
	expect(result).toBe(50);
});

// ---------------------------------------------------------------------------
// tryCatch — signal threading
// ---------------------------------------------------------------------------

test("TaskResult.tryCatch receives the AbortSignal from the call site", async () => {
	const controller = new AbortController();
	let receivedSignal: AbortSignal | undefined;
	const task = TaskResult.tryCatch((signal) => {
		receivedSignal = signal;
		return Promise.resolve(42);
	}, String);
	await task(controller.signal);
	expect(receivedSignal).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// composition scenarios
// ---------------------------------------------------------------------------

test("TaskResult.recover value flows into subsequent map steps", async () => {
	const result = await pipe(
		TaskResult.err<string, number>("not found"),
		TaskResult.recover((_e: string) => TaskResult.ok<string, number>(0)),
		TaskResult.map((n: number) => n + 1),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 1 });
});

test("TaskResult.mapError normalizes the error type before recover acts on it", async () => {
	type ApiError = { code: number; msg: string; };
	const result = await pipe(
		TaskResult.tryCatch(() => Promise.reject(new Error("service unavailable")), (e) => (e as Error).message),
		TaskResult.mapError((msg: string): ApiError => ({ code: 503, msg })),
		TaskResult.recover((e: ApiError) =>
			e.code >= 500 ? TaskResult.ok<ApiError, string>("cached") : TaskResult.err<ApiError, string>(e)
		),
		TaskResult.getOrElse(() => "none"),
	)();
	expect(result).toBe("cached");
});

test("TaskResult.tap runs its side effect at the correct point in the chain", async () => {
	const log: number[] = [];
	const result = await pipe(
		TaskResult.ok<string, number>(5),
		TaskResult.tap((n: number) => log.push(n)),
		TaskResult.chain((n: number) => TaskResult.ok<string, number>(n * 2)),
		TaskResult.map((n: number) => n + 1),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 11 });
	expect(log).toStrictEqual([5]); // tap sees the pre-chain value
});

test("TaskResult.match handles the ok path at the end of a composed chain", async () => {
	const result = await pipe(
		TaskResult.tryCatch(() => Promise.resolve(10), String),
		TaskResult.map((n: number) => n * 2),
		TaskResult.chain((n: number) =>
			n > 15 ? TaskResult.ok<string, number>(n) : TaskResult.err<string, number>("too small")
		),
		TaskResult.match({ ok: (n: number) => `val:${n}`, err: (e: string) => `err:${e}` }),
	)();
	expect(result).toBe("val:20");
});

test("TaskResult.match handles the err path at the end of a composed chain", async () => {
	const result = await pipe(
		TaskResult.tryCatch(() => Promise.resolve(5), String),
		TaskResult.map((n: number) => n * 2),
		TaskResult.chain((n: number) =>
			n > 15 ? TaskResult.ok<string, number>(n) : TaskResult.err<string, number>("too small")
		),
		TaskResult.match({ ok: (n: number) => `val:${n}`, err: (e: string) => `err:${e}` }),
	)();
	expect(result).toBe("err:too small");
});

test("TaskResult.fold receives the transformed error from a prior mapError", async () => {
	const result = await pipe(
		TaskResult.tryCatch(() => Promise.reject(new Error("boom")), (e: unknown) => (e as Error).message),
		TaskResult.mapError((msg: string) => msg.toUpperCase()),
		TaskResult.fold((e: string) => `error: ${e}`, (_: number) => "ok"),
	)();
	expect(result).toBe("error: BOOM");
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("TaskResult.ap applies Ok function to Ok value", async () => {
	const result = await pipe(
		TaskResult.ok<string, (n: number) => number>((n) => n * 3),
		TaskResult.ap(TaskResult.ok<string, number>(4)),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 12 });
});

test("TaskResult.ap propagates the error if function is Error", async () => {
	const result = await pipe(
		TaskResult.err<string, (n: number) => number>("error fn"),
		TaskResult.ap(TaskResult.ok<string, number>(4)),
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "error fn" });
});

test("TaskResult.ap propagates the error if value is Error", async () => {
	const result = await pipe(
		TaskResult.ok<string, (n: number) => number>((n) => n * 3),
		TaskResult.ap(TaskResult.err<string, number>("error val")),
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "error val" });
});

test("TaskResult.ap propagates the first error if both are Error", async () => {
	const result = await pipe(
		TaskResult.err<string, (n: number) => number>("error fn"),
		TaskResult.ap(TaskResult.err<string, number>("error val")),
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "error fn" });
});

test("TaskResult.ap propagates the AbortSignal down to both sides in parallel", async () => {
	let signalLeft: AbortSignal | undefined;
	let signalRight: AbortSignal | undefined;

	const left: TaskResult<string, (n: number) => number> = (signal) => {
		signalLeft = signal;
		return Deferred.fromPromise(Promise.resolve(Result.ok((n: number) => n * 3)));
	};
	const right: TaskResult<string, number> = (signal) => {
		signalRight = signal;
		return Deferred.fromPromise(Promise.resolve(Result.ok(4)));
	};

	const controller = new AbortController();
	const result = await pipe(left, TaskResult.ap(right))(controller.signal);

	expect(result).toStrictEqual({ kind: "Ok", value: 12 });
	expect(signalLeft).toBe(controller.signal);
	expect(signalRight).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// tapError
// ---------------------------------------------------------------------------

test("TaskResult.tapError calls side effect with error on Err", async () => {
	let captured: string | undefined;
	await pipe(
		TaskResult.err<string, number>("oops"),
		TaskResult.tapError((e) => {
			captured = e;
		}),
	)();
	expect(captured).toBe("oops");
});

test("TaskResult.tapError does not call side effect on Ok", async () => {
	let called = false;
	await pipe(
		TaskResult.ok<string, number>(1),
		TaskResult.tapError(() => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
});

test("TaskResult.tapError returns original Err result unchanged", async () => {
	const result = await pipe(TaskResult.err<string, number>("oops"), TaskResult.tapError(() => {}))();
	expect(result).toStrictEqual({ kind: "Err", error: "oops" });
});

test("TaskResult.tapError returns original Ok result unchanged", async () => {
	const result = await pipe(TaskResult.ok<string, number>(42), TaskResult.tapError(() => {}))();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

test("TaskResult.run executes the task and returns the Result", async () => {
	const result = await pipe(TaskResult.ok<string, number>(42), TaskResult.run());
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("TaskResult.run passes the signal to the task", async () => {
	const controller = new AbortController();
	let receivedSignal: AbortSignal | undefined;
	const task: TaskResult<never, void> = (signal) => {
		receivedSignal = signal;
		return Deferred.fromPromise(Promise.resolve(Result.ok(undefined)));
	};
	await pipe(task, TaskResult.run(controller.signal));
	expect(receivedSignal).toBe(controller.signal);
});

// --- fromNullable ---

test("TaskResult.fromNullable returns Ok for non-null value", async () => {
	const result = await TaskResult.fromNullable(() => "is null")(42)();
	expect(result).toStrictEqual(Result.ok(42));
});

test("TaskResult.fromNullable returns Err for null", async () => {
	const result = await TaskResult.fromNullable(() => "is null")(null)();
	expect(result).toStrictEqual(Result.err("is null"));
});

test("TaskResult.fromNullable returns Err for undefined", async () => {
	const result = await TaskResult.fromNullable(() => "is null")(undefined)();
	expect(result).toStrictEqual(Result.err("is null"));
});

// --- fromMaybe ---

test("TaskResult.fromMaybe returns Ok for Some", async () => {
	const result = await TaskResult.fromMaybe(() => "is none")(Maybe.some(42))();
	expect(result).toStrictEqual(Result.ok(42));
});

test("TaskResult.fromMaybe returns Err for None", async () => {
	const result = await TaskResult.fromMaybe(() => "is none")(Maybe.none())();
	expect(result).toStrictEqual(Result.err("is none"));
});

// --- fromResult ---

test("TaskResult.fromResult returns Ok for Ok", async () => {
	const result = await TaskResult.fromResult(Result.ok(42))();
	expect(result).toStrictEqual(Result.ok(42));
});

test("TaskResult.fromResult returns Err for Err", async () => {
	const result = await TaskResult.fromResult(Result.err("bad"))();
	expect(result).toStrictEqual(Result.err("bad"));
});

// --- fromThrowable ---

test("TaskResult.fromThrowable returns Ok when it succeeds", async () => {
	const parse = TaskResult.fromThrowable((s: string) => Promise.resolve(JSON.parse(s)), () => "parse error");
	const result = await parse('{"a":1}')();
	expect(result).toStrictEqual(Result.ok({ a: 1 }));
});

test("TaskResult.fromThrowable returns Err when it throws", async () => {
	const fetch = TaskResult.fromThrowable(
		(_url: string) => Promise.reject(new Error("network error")),
		(e) => (e as Error).message,
	);
	const result = await fetch("/api")();
	expect(result).toStrictEqual(Result.err("network error"));
});

// --- bindTo ---

test("TaskResult.bindTo wraps a value in an accumulator object", async () => {
	const task = pipe(TaskResult.ok<string, number>(2), TaskResult.bindTo("a"));
	expectTypeOf(task).toEqualTypeOf<TaskResult<string, { a: number; }>>();

	const result = await task();
	expect(result).toStrictEqual(Result.ok({ a: 2 }));
});

// --- bind ---

test("TaskResult.bind accumulates values key-by-key in a pipeline", async () => {
	const task = pipe(
		TaskResult.ok<string, number>(2),
		TaskResult.bindTo("a"),
		TaskResult.bind("b", ({ a }) => TaskResult.ok<string, number>(a * 3)),
		TaskResult.bind("c", ({ a, b }) => TaskResult.ok<string, number>(a + b)),
	);
	expectTypeOf(task).toEqualTypeOf<TaskResult<string, { a: number; } & { b: number; } & { c: number; }>>();

	const result = await task();
	expect(result).toStrictEqual(Result.ok({ a: 2, b: 6, c: 8 }));
});

test("TaskResult.bind short-circuits on Err", async () => {
	let called = false;
	const task = pipe(
		TaskResult.ok<string, number>(2),
		TaskResult.bindTo("a"),
		TaskResult.bind("b", () => TaskResult.err<string, number>("fail")),
		TaskResult.bind("c", ({ b }) => {
			called = true;
			return TaskResult.ok<string, number>(b);
		}),
	);
	expectTypeOf(task).toEqualTypeOf<TaskResult<string, { a: number; } & { b: number; } & { c: number; }>>();

	const result = await task();
	expect(called).toBe(false);
	expect(result).toStrictEqual(Result.err("fail"));
});

// --- struct ---

test("TaskResult.struct combines a record of Ok values into a single Ok record", async () => {
	const res = await TaskResult.struct({
		a: TaskResult.ok<string, number>(1),
		b: TaskResult.ok<string, string>("hello"),
	})();
	expect(res).toStrictEqual(Result.ok({ a: 1, b: "hello" }));
});

test("TaskResult.struct short-circuits on the first Err encountered", async () => {
	const res = await TaskResult.struct({
		a: TaskResult.ok<string, number>(1),
		b: TaskResult.err<string, string>("first fail"),
		c: TaskResult.err<string, number>("second fail"),
	})();
	expect(res).toStrictEqual(Result.err("first fail"));
});

test("TaskResult.struct propagates AbortSignal and executes in parallel", async () => {
	let signalA: AbortSignal | undefined;
	let signalB: AbortSignal | undefined;

	const taskA: TaskResult<string, number> = (signal) => {
		signalA = signal;
		return Deferred.fromPromise(Promise.resolve(Result.ok(1)));
	};
	const taskB: TaskResult<string, string> = (signal) => {
		signalB = signal;
		return Deferred.fromPromise(Promise.resolve(Result.ok("hello")));
	};

	const controller = new AbortController();
	const res = await TaskResult.struct({ a: taskA, b: taskB })(controller.signal);

	expect(res).toStrictEqual(Result.ok({ a: 1, b: "hello" }));
	expect(signalA).toBe(controller.signal);
	expect(signalB).toBe(controller.signal);
});

test("TaskResult.struct composes in a pipe pipeline", async () => {
	const res = await pipe(
		TaskResult.ok<string, { name: string; }>({ name: "Alice" }),
		TaskResult.map((u) => u.name),
		TaskResult.chain((name) =>
			TaskResult.struct({
				name: TaskResult.ok<string, string>(name),
				valid: TaskResult.fromResult(Result.fromPredicate((n: string) => n.length > 0, () => "invalid")(name)),
			})
		),
	)();
	expect(res).toStrictEqual(Result.ok({ name: "Alice", valid: "Alice" }));
});

test("TaskResult.struct returns ok({}) when given an empty object", async () => {
	const res = await TaskResult.struct({})();
	expect(res).toStrictEqual(Result.ok({}));
});
