import { pipe } from "#composition";
import { Deferred, Maybe, Result, Task } from "#core";
import { expect, expectTypeOf, test } from "vitest";

// ---------------------------------------------------------------------------
// of
// ---------------------------------------------------------------------------

test("Task.Result.ok creates a Task that resolves to Ok", async () => {
	const result = await Task.Result.ok<string, number>(42)();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

// ---------------------------------------------------------------------------
// fail
// ---------------------------------------------------------------------------

test("Task.Result.err creates a Task that resolves to Err", async () => {
	const result = await Task.Result.err<string, number>("error")();
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("Task.Result.tryCatch returns Ok when Promise resolves", async () => {
	const result = await Task.Result.tryCatch(() => Promise.resolve(42), (e) => `Error: ${e}`)();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("Task.Result.tryCatch returns Err when Promise rejects", async () => {
	const result = await Task.Result.tryCatch(() => Promise.reject(new Error("boom")), (e) => (e as Error).message)();
	expect(result).toStrictEqual({ kind: "Err", error: "boom" });
});

test("taskResult.tryCatch catches synchronous throws in async functions", async () => {
	const result = await Task.Result.tryCatch(
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

test("Task.Result.map transforms Ok value", async () => {
	const result = await pipe(Task.Result.ok<string, number>(5), Task.Result.map((n: number) => n * 2))();
	expect(result).toStrictEqual({ kind: "Ok", value: 10 });
});

test("Task.Result.map passes through Err unchanged", async () => {
	const result = await pipe(Task.Result.err<string, number>("error"), Task.Result.map((n: number) => n * 2))();
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

test("Task.Result.map can change the value type", async () => {
	const result = await pipe(Task.Result.ok<string, number>(42), Task.Result.map((n: number) => `num: ${n}`))();
	expect(result).toStrictEqual({ kind: "Ok", value: "num: 42" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("Task.Result.mapError transforms Err value", async () => {
	const result = await pipe(
		Task.Result.err<string, number>("oops"),
		Task.Result.mapError((e: string) => e.toUpperCase()),
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "OOPS" });
});

test("Task.Result.mapError passes through Ok unchanged", async () => {
	const result = await pipe(Task.Result.ok<string, number>(5), Task.Result.mapError((e: string) => e.toUpperCase()))();
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Task.Result.chain applies function when Ok", async () => {
	const validatePositive = (n: number): Task.Result<string, number> =>
		n > 0 ? Task.Result.ok(n) : Task.Result.err("Must be positive");

	const result = await pipe(Task.Result.ok<string, number>(5), Task.Result.chain(validatePositive))();
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("taskResult.chain returns Err when function returns Err", async () => {
	const validatePositive = (n: number): Task.Result<string, number> =>
		n > 0 ? Task.Result.ok(n) : Task.Result.err("Must be positive");

	const result = await pipe(Task.Result.ok<string, number>(-1), Task.Result.chain(validatePositive))();
	expect(result).toStrictEqual({ kind: "Err", error: "Must be positive" });
});

test("taskResult.chain propagates Err without calling function", async () => {
	let called = false;
	const result = await pipe(
		Task.Result.err<string, number>("error"),
		Task.Result.chain((_n: number) => {
			called = true;
			return Task.Result.ok<string, number>(_n);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

test("Task.Result.chain composes multiple async steps", async () => {
	const result = await pipe(
		Task.Result.ok<string, number>(1),
		Task.Result.chain((n: number) => Task.Result.ok<string, number>(n + 1)),
		Task.Result.chain((n: number) => Task.Result.ok<string, number>(n * 10)),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 20 });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Task.Result.fold calls onOk for Ok", async () => {
	const result = await pipe(
		Task.Result.ok<string, number>(5),
		Task.Result.fold((e: string) => `Error: ${e}`, (n: number) => `Value: ${n}`),
	)();
	expect(result).toBe("Value: 5");
});

test("Task.Result.fold calls onErr for Err", async () => {
	const result = await pipe(
		Task.Result.err<string, number>("bad"),
		Task.Result.fold((e: string) => `Error: ${e}`, (n: number) => `Value: ${n}`),
	)();
	expect(result).toBe("Error: bad");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("Task.Result.match calls ok handler for Ok", async () => {
	const result = await pipe(
		Task.Result.ok<string, number>(5),
		Task.Result.match({ ok: (n: number) => `got ${n}`, err: (e: string) => `failed: ${e}` }),
	)();
	expect(result).toBe("got 5");
});

test("Task.Result.match calls err handler for Err", async () => {
	const result = await pipe(
		Task.Result.err<string, number>("bad"),
		Task.Result.match({ ok: (n: number) => `got ${n}`, err: (e: string) => `failed: ${e}` }),
	)();
	expect(result).toBe("failed: bad");
});

test("taskResult.match is data-last (returns a function first)", async () => {
	const handler = Task.Result.match<string, number, string>({ ok: (n) => `val: ${n}`, err: (e) => `err: ${e}` });
	const okResult = await handler(Task.Result.ok<string, number>(3))();
	expect(okResult).toBe("val: 3");
	const errResult = await handler(Task.Result.err<string, number>("x"))();
	expect(errResult).toBe("err: x");
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("taskResult.recover returns original Ok without calling fallback", async () => {
	let called = false;
	const result = await pipe(
		Task.Result.ok<string, number>(5),
		Task.Result.recover((_e: string) => {
			called = true;
			return Task.Result.ok<string, number>(99);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("Task.Result.recover provides fallback for Err", async () => {
	const result = await pipe(
		Task.Result.err<string, number>("error"),
		Task.Result.recover((_e: string) => Task.Result.ok<string, number>(99)),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 99 });
});

test("taskResult.recover widens to Task.Result<E, A | B> when fallback returns a different type", async () => {
	const result = await pipe(Task.Result.err("error"), Task.Result.recover((_e) => Task.Result.ok("recovered")))();
	expect(result).toStrictEqual({ kind: "Ok", value: "recovered" });
});

test("Task.Result.recover preserves Ok typed as Task.Result<E, A | B>", async () => {
	const result = await pipe(Task.Result.ok(5), Task.Result.recover((_e) => Task.Result.ok("recovered")))();
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("taskResult.recover passes the error to the fallback function", async () => {
	let receivedError = "";
	await pipe(
		Task.Result.err<string, number>("original error"),
		Task.Result.recover((e: string) => {
			receivedError = e;
			return Task.Result.ok<string, number>(0);
		}),
	)();
	expect(receivedError).toBe("original error");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Task.Result.getOrElse returns value for Ok", async () => {
	const result = await pipe(Task.Result.ok<string, number>(5), Task.Result.getOrElse(() => 0))();
	expect(result).toBe(5);
});

test("Task.Result.getOrElse returns default for Err", async () => {
	const result = await pipe(Task.Result.err<string, number>("error"), Task.Result.getOrElse(() => 0))();
	expect(result).toBe(0);
});

test("Task.Result.getOrElse widens return type to A | B when default is a different type", async () => {
	const result = await pipe(Task.Result.err("error"), Task.Result.getOrElse(() => null))();
	expect(result).toBeNull();
});

test("Task.Result.getOrElse returns Ok value typed as A | B when Ok", async () => {
	const result = await pipe(Task.Result.ok(5), Task.Result.getOrElse(() => null))();
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("taskResult.tap executes side effect on Ok and returns original", async () => {
	let sideEffect = 0;
	const result = await pipe(
		Task.Result.ok<string, number>(5),
		Task.Result.tap((n: number) => {
			sideEffect = n;
		}),
	)();
	expect(sideEffect).toBe(5);
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("Task.Result.tap does not execute side effect on Err", async () => {
	let called = false;
	const result = await pipe(
		Task.Result.err<string, number>("error"),
		Task.Result.tap((_n: number) => {
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
		Task.Result.ok<string, number>(5),
		Task.Result.map((n: number) => n * 2),
		Task.Result.chain((n: number) =>
			n > 5 ? Task.Result.ok<string, number>(n) : Task.Result.err<string, number>("Too small")
		),
		Task.Result.getOrElse(() => 0),
	)();
	expect(result).toBe(10);
});

test("taskResult pipe short-circuits on Err", async () => {
	const result = await pipe(
		Task.Result.ok<string, number>(2),
		Task.Result.map((n: number) => n * 2),
		Task.Result.chain((n: number) =>
			n > 5 ? Task.Result.ok<string, number>(n) : Task.Result.err<string, number>("Too small")
		),
		Task.Result.getOrElse(() => 0),
	)();
	expect(result).toBe(0);
});

test("taskResult tryCatch integrates with pipe chain", async () => {
	const result = await pipe(
		Task.Result.tryCatch(() => Promise.resolve(42), (e) => `Error: ${e}`),
		Task.Result.map((n: number) => n + 8),
		Task.Result.getOrElse(() => 0),
	)();
	expect(result).toBe(50);
});

// ---------------------------------------------------------------------------
// tryCatch — signal threading
// ---------------------------------------------------------------------------

test("Task.Result.tryCatch receives the AbortSignal from the call site", async () => {
	const controller = new AbortController();
	let receivedSignal: AbortSignal | undefined;
	const task = Task.Result.tryCatch((signal) => {
		receivedSignal = signal;
		return Promise.resolve(42);
	}, String);
	await task(controller.signal);
	expect(receivedSignal).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// composition scenarios
// ---------------------------------------------------------------------------

test("Task.Result.recover value flows into subsequent map steps", async () => {
	const result = await pipe(
		Task.Result.err<string, number>("not found"),
		Task.Result.recover((_e: string) => Task.Result.ok<string, number>(0)),
		Task.Result.map((n: number) => n + 1),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 1 });
});

test("Task.Result.mapError normalizes the error type before recover acts on it", async () => {
	type ApiError = { code: number; msg: string; };
	const result = await pipe(
		Task.Result.tryCatch(() => Promise.reject(new Error("service unavailable")), (e) => (e as Error).message),
		Task.Result.mapError((msg: string): ApiError => ({ code: 503, msg })),
		Task.Result.recover((e: ApiError) =>
			e.code >= 500 ? Task.Result.ok<ApiError, string>("cached") : Task.Result.err<ApiError, string>(e)
		),
		Task.Result.getOrElse(() => "none"),
	)();
	expect(result).toBe("cached");
});

test("Task.Result.tap runs its side effect at the correct point in the chain", async () => {
	const log: number[] = [];
	const result = await pipe(
		Task.Result.ok<string, number>(5),
		Task.Result.tap((n: number) => log.push(n)),
		Task.Result.chain((n: number) => Task.Result.ok<string, number>(n * 2)),
		Task.Result.map((n: number) => n + 1),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 11 });
	expect(log).toStrictEqual([5]); // tap sees the pre-chain value
});

test("Task.Result.match handles the ok path at the end of a composed chain", async () => {
	const result = await pipe(
		Task.Result.tryCatch(() => Promise.resolve(10), String),
		Task.Result.map((n: number) => n * 2),
		Task.Result.chain((n: number) =>
			n > 15 ? Task.Result.ok<string, number>(n) : Task.Result.err<string, number>("too small")
		),
		Task.Result.match({ ok: (n: number) => `val:${n}`, err: (e: string) => `err:${e}` }),
	)();
	expect(result).toBe("val:20");
});

test("Task.Result.match handles the err path at the end of a composed chain", async () => {
	const result = await pipe(
		Task.Result.tryCatch(() => Promise.resolve(5), String),
		Task.Result.map((n: number) => n * 2),
		Task.Result.chain((n: number) =>
			n > 15 ? Task.Result.ok<string, number>(n) : Task.Result.err<string, number>("too small")
		),
		Task.Result.match({ ok: (n: number) => `val:${n}`, err: (e: string) => `err:${e}` }),
	)();
	expect(result).toBe("err:too small");
});

test("Task.Result.fold receives the transformed error from a prior mapError", async () => {
	const result = await pipe(
		Task.Result.tryCatch(() => Promise.reject(new Error("boom")), (e: unknown) => (e as Error).message),
		Task.Result.mapError((msg: string) => msg.toUpperCase()),
		Task.Result.fold((e: string) => `error: ${e}`, (_: number) => "ok"),
	)();
	expect(result).toBe("error: BOOM");
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("Task.Result.ap applies Ok function to Ok value", async () => {
	const result = await pipe(
		Task.Result.ok<string, (n: number) => number>((n) => n * 3),
		Task.Result.ap(Task.Result.ok<string, number>(4)),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 12 });
});

test("Task.Result.ap propagates the error if function is Error", async () => {
	const result = await pipe(
		Task.Result.err<string, (n: number) => number>("error fn"),
		Task.Result.ap(Task.Result.ok<string, number>(4)),
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "error fn" });
});

test("Task.Result.ap propagates the error if value is Error", async () => {
	const result = await pipe(
		Task.Result.ok<string, (n: number) => number>((n) => n * 3),
		Task.Result.ap(Task.Result.err<string, number>("error val")),
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "error val" });
});

test("Task.Result.ap propagates the first error if both are Error", async () => {
	const result = await pipe(
		Task.Result.err<string, (n: number) => number>("error fn"),
		Task.Result.ap(Task.Result.err<string, number>("error val")),
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "error fn" });
});

test("Task.Result.ap propagates the AbortSignal down to both sides in parallel", async () => {
	let signalLeft: AbortSignal | undefined;
	let signalRight: AbortSignal | undefined;

	const left: Task.Result<string, (n: number) => number> = (signal) => {
		signalLeft = signal;
		return Deferred.fromPromise(Promise.resolve(Result.ok((n: number) => n * 3)));
	};
	const right: Task.Result<string, number> = (signal) => {
		signalRight = signal;
		return Deferred.fromPromise(Promise.resolve(Result.ok(4)));
	};

	const controller = new AbortController();
	const result = await pipe(left, Task.Result.ap(right))(controller.signal);

	expect(result).toStrictEqual({ kind: "Ok", value: 12 });
	expect(signalLeft).toBe(controller.signal);
	expect(signalRight).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// tapError
// ---------------------------------------------------------------------------

test("Task.Result.tapError calls side effect with error on Err", async () => {
	let captured: string | undefined;
	await pipe(
		Task.Result.err<string, number>("oops"),
		Task.Result.tapError((e) => {
			captured = e;
		}),
	)();
	expect(captured).toBe("oops");
});

test("Task.Result.tapError does not call side effect on Ok", async () => {
	let called = false;
	await pipe(
		Task.Result.ok<string, number>(1),
		Task.Result.tapError(() => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
});

test("Task.Result.tapError returns original Err result unchanged", async () => {
	const result = await pipe(Task.Result.err<string, number>("oops"), Task.Result.tapError(() => {}))();
	expect(result).toStrictEqual({ kind: "Err", error: "oops" });
});

test("Task.Result.tapError returns original Ok result unchanged", async () => {
	const result = await pipe(Task.Result.ok<string, number>(42), Task.Result.tapError(() => {}))();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

test("Task.Result.run executes the task and returns the Result", async () => {
	const result = await pipe(Task.Result.ok<string, number>(42), Task.Result.run());
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("Task.Result.run passes the signal to the task", async () => {
	const controller = new AbortController();
	let receivedSignal: AbortSignal | undefined;
	const task: Task.Result<never, void> = (signal) => {
		receivedSignal = signal;
		return Deferred.fromPromise(Promise.resolve(Result.ok(undefined)));
	};
	await pipe(task, Task.Result.run(controller.signal));
	expect(receivedSignal).toBe(controller.signal);
});

// --- fromNullable ---

test("Task.Result.fromNullable returns Ok for non-null value", async () => {
	const result = await Task.Result.fromNullable(() => "is null")(42)();
	expect(result).toStrictEqual(Result.ok(42));
});

test("Task.Result.fromNullable returns Err for null", async () => {
	const result = await Task.Result.fromNullable(() => "is null")(null)();
	expect(result).toStrictEqual(Result.err("is null"));
});

test("Task.Result.fromNullable returns Err for undefined", async () => {
	const result = await Task.Result.fromNullable(() => "is null")(undefined)();
	expect(result).toStrictEqual(Result.err("is null"));
});

// --- fromMaybe ---

test("Task.Result.fromMaybe returns Ok for Some", async () => {
	const result = await Task.Result.fromMaybe(() => "is none")(Maybe.some(42))();
	expect(result).toStrictEqual(Result.ok(42));
});

test("Task.Result.fromMaybe returns Err for None", async () => {
	const result = await Task.Result.fromMaybe(() => "is none")(Maybe.none())();
	expect(result).toStrictEqual(Result.err("is none"));
});

// --- fromResult ---

test("Task.Result.fromResult returns Ok for Ok", async () => {
	const result = await Task.Result.fromResult(Result.ok(42))();
	expect(result).toStrictEqual(Result.ok(42));
});

test("Task.Result.fromResult returns Err for Err", async () => {
	const result = await Task.Result.fromResult(Result.err("bad"))();
	expect(result).toStrictEqual(Result.err("bad"));
});

// --- fromThrowable ---

test("Task.Result.fromThrowable returns Ok when it succeeds", async () => {
	const parse = Task.Result.fromThrowable((s: string) => Promise.resolve(JSON.parse(s)), () => "parse error");
	const result = await parse('{"a":1}')();
	expect(result).toStrictEqual(Result.ok({ a: 1 }));
});

test("Task.Result.fromThrowable returns Err when it throws", async () => {
	const fetch = Task.Result.fromThrowable(
		(_url: string) => Promise.reject(new Error("network error")),
		(e) => (e as Error).message,
	);
	const result = await fetch("/api")();
	expect(result).toStrictEqual(Result.err("network error"));
});

// --- bindTo ---

test("Task.Result.bindTo wraps a value in an accumulator object", async () => {
	const task = pipe(Task.Result.ok<string, number>(2), Task.Result.bindTo("a"));
	expectTypeOf(task).toEqualTypeOf<Task.Result<string, { a: number; }>>();

	const result = await task();
	expect(result).toStrictEqual(Result.ok({ a: 2 }));
});

// --- bind ---

test("Task.Result.bind accumulates values key-by-key in a pipeline", async () => {
	const task = pipe(
		Task.Result.ok<string, number>(2),
		Task.Result.bindTo("a"),
		Task.Result.bind("b", ({ a }) => Task.Result.ok<string, number>(a * 3)),
		Task.Result.bind("c", ({ a, b }) => Task.Result.ok<string, number>(a + b)),
	);
	expectTypeOf(task).toEqualTypeOf<Task.Result<string, { a: number; } & { b: number; } & { c: number; }>>();

	const result = await task();
	expect(result).toStrictEqual(Result.ok({ a: 2, b: 6, c: 8 }));
});

test("Task.Result.bind short-circuits on Err", async () => {
	let called = false;
	const task = pipe(
		Task.Result.ok<string, number>(2),
		Task.Result.bindTo("a"),
		Task.Result.bind("b", () => Task.Result.err<string, number>("fail")),
		Task.Result.bind("c", ({ b }) => {
			called = true;
			return Task.Result.ok<string, number>(b);
		}),
	);
	expectTypeOf(task).toEqualTypeOf<Task.Result<string, { a: number; } & { b: number; } & { c: number; }>>();

	const result = await task();
	expect(called).toBe(false);
	expect(result).toStrictEqual(Result.err("fail"));
});

// --- struct ---

test("Task.Result.struct combines a record of Ok values into a single Ok record", async () => {
	const res = await Task.Result.struct({
		a: Task.Result.ok<string, number>(1),
		b: Task.Result.ok<string, string>("hello"),
	})();
	expect(res).toStrictEqual(Result.ok({ a: 1, b: "hello" }));
});

test("Task.Result.struct short-circuits on the first Err encountered", async () => {
	const res = await Task.Result.struct({
		a: Task.Result.ok<string, number>(1),
		b: Task.Result.err<string, string>("first fail"),
		c: Task.Result.err<string, number>("second fail"),
	})();
	expect(res).toStrictEqual(Result.err("first fail"));
});

test("Task.Result.struct propagates AbortSignal and executes in parallel", async () => {
	let signalA: AbortSignal | undefined;
	let signalB: AbortSignal | undefined;

	const taskA: Task.Result<string, number> = (signal) => {
		signalA = signal;
		return Deferred.fromPromise(Promise.resolve(Result.ok(1)));
	};
	const taskB: Task.Result<string, string> = (signal) => {
		signalB = signal;
		return Deferred.fromPromise(Promise.resolve(Result.ok("hello")));
	};

	const controller = new AbortController();
	const res = await Task.Result.struct({ a: taskA, b: taskB })(controller.signal);

	expect(res).toStrictEqual(Result.ok({ a: 1, b: "hello" }));
	expect(signalA).toBe(controller.signal);
	expect(signalB).toBe(controller.signal);
});

test("Task.Result.struct composes in a pipe pipeline", async () => {
	const res = await pipe(
		Task.Result.ok<string, { name: string; }>({ name: "Alice" }),
		Task.Result.map((u) => u.name),
		Task.Result.chain((name) =>
			Task.Result.struct({
				name: Task.Result.ok<string, string>(name),
				valid: Task.Result.fromResult(Result.fromPredicate((n: string) => n.length > 0, () => "invalid")(name)),
			})
		),
	)();
	expect(res).toStrictEqual(Result.ok({ name: "Alice", valid: "Alice" }));
});

test("Task.Result.struct returns ok({}) when given an empty object", async () => {
	const res = await Task.Result.struct({})();
	expect(res).toStrictEqual(Result.ok({}));
});
