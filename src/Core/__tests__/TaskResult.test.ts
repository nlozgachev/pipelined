import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../../Types/Duration.ts";
import { RetryPolicy } from "../../Types/RetryPolicy.ts";
import { Deferred } from "../Deferred.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Task } from "../Task.ts";

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("make.ok: creates a Task that resolves to Ok", async () => {
	const result = await Task.Result.make.ok<string, number>(42)();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("make.err: creates a Task that resolves to Err", async () => {
	const result = await Task.Result.make.err<string, number>("error")();
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("tryCatch: returns Ok when Promise resolves", async () => {
	const result = await Task.Result.tryCatch(() => Promise.resolve(42), { onError: (e) => `Error: ${e}` })();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("tryCatch: returns Err when Promise rejects", async () => {
	const result = await Task.Result.tryCatch(() => Promise.reject(new Error("boom")), {
		onError: (e: unknown) => (e as Error).message,
	})();
	expect(result).toStrictEqual({ kind: "Err", error: "boom" });
});

test("tryCatch: catches synchronous throws in async functions", async () => {
	const result = await Task.Result.tryCatch(
		// oxlint-disable-next-line require-await
		async () => {
			throw new Error("sync throw");
		},
		{ onError: (e) => (e as Error).message },
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "sync throw" });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: transforms Ok value", async () => {
	const result = await pipe(Task.Result.make.ok<string, number>(5), Task.Result.map((n: number) => n * 2))();
	expect(result).toStrictEqual({ kind: "Ok", value: 10 });
});

test("map: passes through Err unchanged", async () => {
	const result = await pipe(Task.Result.make.err<string, number>("error"), Task.Result.map((n: number) => n * 2))();
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

test("map: can change value type", async () => {
	const result = await pipe(Task.Result.make.ok<string, number>(42), Task.Result.map((n: number) => `num: ${n}`))();
	expect(result).toStrictEqual({ kind: "Ok", value: "num: 42" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("mapError: transforms Err value", async () => {
	const result = await pipe(
		Task.Result.make.err<string, number>("oops"),
		Task.Result.mapError((e: string) => e.toUpperCase()),
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "OOPS" });
});

test("mapError: passes through Ok unchanged", async () => {
	const result = await pipe(
		Task.Result.make.ok<string, number>(5),
		Task.Result.mapError((e: string) => e.toUpperCase()),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("chain: applies function when Ok", async () => {
	const validatePositive = (n: number): Task.Result<string, number> =>
		n > 0 ? Task.Result.make.ok(n) : Task.Result.make.err("Must be positive");

	const result = await pipe(Task.Result.make.ok<string, number>(5), Task.Result.chain(validatePositive))();
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("chain: returns Err when function returns Err", async () => {
	const validatePositive = (n: number): Task.Result<string, number> =>
		n > 0 ? Task.Result.make.ok(n) : Task.Result.make.err("Must be positive");

	const result = await pipe(Task.Result.make.ok<string, number>(-1), Task.Result.chain(validatePositive))();
	expect(result).toStrictEqual({ kind: "Err", error: "Must be positive" });
});

test("chain: propagates Err without calling function", async () => {
	let called = false;
	const result = await pipe(
		Task.Result.make.err<string, number>("error"),
		Task.Result.chain((_n: number) => {
			called = true;
			return Task.Result.make.ok<string, number>(_n);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

test("chain: composes multiple async steps", async () => {
	const result = await pipe(
		Task.Result.make.ok<string, number>(1),
		Task.Result.chain((n: number) => Task.Result.make.ok<string, number>(n + 1)),
		Task.Result.chain((n: number) => Task.Result.make.ok<string, number>(n * 10)),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 20 });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("fold: calls onOk for Ok", async () => {
	const result = await pipe(
		Task.Result.make.ok<string, number>(5),
		Task.Result.fold((e: string) => `Error: ${e}`, (n: number) => `Value: ${n}`),
	)();
	expect(result).toBe("Value: 5");
});

test("fold: calls onErr for Err", async () => {
	const result = await pipe(
		Task.Result.make.err<string, number>("bad"),
		Task.Result.fold((e: string) => `Error: ${e}`, (n: number) => `Value: ${n}`),
	)();
	expect(result).toBe("Error: bad");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("match: calls ok handler for Ok", async () => {
	const result = await pipe(
		Task.Result.make.ok<string, number>(5),
		Task.Result.match({ ok: (n: number) => `got ${n}`, err: (e: string) => `failed: ${e}` }),
	)();
	expect(result).toBe("got 5");
});

test("match: calls err handler for Err", async () => {
	const result = await pipe(
		Task.Result.make.err<string, number>("bad"),
		Task.Result.match({ ok: (n: number) => `got ${n}`, err: (e: string) => `failed: ${e}` }),
	)();
	expect(result).toBe("failed: bad");
});

test("match: is data-last (returns a function first)", async () => {
	const handler = Task.Result.match<string, number, string>({ ok: (n) => `val: ${n}`, err: (e) => `err: ${e}` });
	const okResult = await handler(Task.Result.make.ok<string, number>(3))();
	expect(okResult).toBe("val: 3");
	const errResult = await handler(Task.Result.make.err<string, number>("x"))();
	expect(errResult).toBe("err: x");
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("recover: returns original Ok without calling fallback", async () => {
	let called = false;
	const result = await pipe(
		Task.Result.make.ok<string, number>(5),
		Task.Result.recover((_e: string) => {
			called = true;
			return Task.Result.make.ok<string, number>(99);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("recover: provides fallback for Err", async () => {
	const result = await pipe(
		Task.Result.make.err<string, number>("error"),
		Task.Result.recover((_e: string) => Task.Result.make.ok<string, number>(99)),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 99 });
});

test("recover: widens return type when fallback returns different type", async () => {
	const result = await pipe(
		Task.Result.make.err("error"),
		Task.Result.recover((_e) => Task.Result.make.ok("recovered")),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: "recovered" });
});

test("recover: preserves Ok typed as union", async () => {
	const result = await pipe(Task.Result.make.ok(5), Task.Result.recover((_e) => Task.Result.make.ok("recovered")))();
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("recover: passes error to fallback function", async () => {
	let receivedError = "";
	await pipe(
		Task.Result.make.err<string, number>("original error"),
		Task.Result.recover((e: string) => {
			receivedError = e;
			return Task.Result.make.ok<string, number>(0);
		}),
	)();
	expect(receivedError).toBe("original error");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("getOrElse: returns value for Ok", async () => {
	const result = await pipe(Task.Result.make.ok<string, number>(5), Task.Result.getOrElse(() => 0))();
	expect(result).toBe(5);
});

test("getOrElse: returns default for Err", async () => {
	const result = await pipe(Task.Result.make.err<string, number>("error"), Task.Result.getOrElse(() => 0))();
	expect(result).toBe(0);
});

test("getOrElse: widens return type to union when default is different type", async () => {
	const result = await pipe(Task.Result.make.err("error"), Task.Result.getOrElse(() => null))();
	expect(result).toBeNull();
});

test("getOrElse: returns Ok value typed as union when Ok", async () => {
	const result = await pipe(Task.Result.make.ok(5), Task.Result.getOrElse(() => null))();
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("tap: executes side effect on Ok and returns original", async () => {
	let sideEffect = 0;
	const result = await pipe(
		Task.Result.make.ok<string, number>(5),
		Task.Result.tap((n: number) => {
			sideEffect = n;
		}),
	)();
	expect(sideEffect).toBe(5);
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("tap: does not execute side effect on Err", async () => {
	let called = false;
	const result = await pipe(
		Task.Result.make.err<string, number>("error"),
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

test("pipe: composes well in a pipeline", async () => {
	const result = await pipe(
		Task.Result.make.ok<string, number>(5),
		Task.Result.map((n: number) => n * 2),
		Task.Result.chain((n: number) =>
			n > 5 ? Task.Result.make.ok<string, number>(n) : Task.Result.make.err<string, number>("Too small")
		),
		Task.Result.getOrElse(() => 0),
	)();
	expect(result).toBe(10);
});

test("pipe: short-circuits on Err", async () => {
	const result = await pipe(
		Task.Result.make.ok<string, number>(2),
		Task.Result.map((n: number) => n * 2),
		Task.Result.chain((n: number) =>
			n > 5 ? Task.Result.make.ok<string, number>(n) : Task.Result.make.err<string, number>("Too small")
		),
		Task.Result.getOrElse(() => 0),
	)();
	expect(result).toBe(0);
});

test("tryCatch: integrates with pipe chain", async () => {
	const result = await pipe(
		Task.Result.tryCatch(() => Promise.resolve(42), { onError: (e) => `Error: ${e}` }),
		Task.Result.map((n: number) => n + 8),
		Task.Result.getOrElse(() => 0),
	)();
	expect(result).toBe(50);
});

// ---------------------------------------------------------------------------
// tryCatch — signal threading
// ---------------------------------------------------------------------------

test("tryCatch: receives AbortSignal from call site", async () => {
	const controller = new AbortController();
	let receivedSignal: AbortSignal | undefined;
	const task = Task.Result.tryCatch((signal) => {
		receivedSignal = signal;
		return Promise.resolve(42);
	}, { onError: String });
	await task(controller.signal);
	expect(receivedSignal).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// composition scenarios
// ---------------------------------------------------------------------------

test("recover: value flows into subsequent map steps", async () => {
	const result = await pipe(
		Task.Result.make.err<string, number>("not found"),
		Task.Result.recover((_e: string) => Task.Result.make.ok<string, number>(0)),
		Task.Result.map((n: number) => n + 1),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 1 });
});

test("mapError: normalizes error type before recover acts on it", async () => {
	type ApiError = { code: number; msg: string; };
	const result = await pipe(
		Task.Result.tryCatch(() => Promise.reject(new Error("service unavailable")), {
			onError: (e) => (e as Error).message,
		}),
		Task.Result.mapError((msg: string): ApiError => ({ code: 503, msg })),
		Task.Result.recover((e: ApiError) =>
			e.code >= 500 ? Task.Result.make.ok<ApiError, string>("cached") : Task.Result.make.err<ApiError, string>(e)
		),
		Task.Result.getOrElse(() => "none"),
	)();
	expect(result).toBe("cached");
});

test("tap: runs side effect at correct point in chain", async () => {
	const log: number[] = [];
	const result = await pipe(
		Task.Result.make.ok<string, number>(5),
		Task.Result.tap((n: number) => log.push(n)),
		Task.Result.chain((n: number) => Task.Result.make.ok<string, number>(n * 2)),
		Task.Result.map((n: number) => n + 1),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 11 });
	expect(log).toStrictEqual([5]); // tap sees the pre-chain value
});

test("match: handles ok path at end of composed chain", async () => {
	const result = await pipe(
		Task.Result.tryCatch(() => Promise.resolve(10), { onError: String }),
		Task.Result.map((n: number) => n * 2),
		Task.Result.chain((n: number) =>
			n > 15 ? Task.Result.make.ok<string, number>(n) : Task.Result.make.err<string, number>("too small")
		),
		Task.Result.match({ ok: (n: number) => `val:${n}`, err: (e: string) => `err:${e}` }),
	)();
	expect(result).toBe("val:20");
});

test("match: handles err path at end of composed chain", async () => {
	const result = await pipe(
		Task.Result.tryCatch(() => Promise.resolve(5), { onError: String }),
		Task.Result.map((n: number) => n * 2),
		Task.Result.chain((n: number) =>
			n > 15 ? Task.Result.make.ok<string, number>(n) : Task.Result.make.err<string, number>("too small")
		),
		Task.Result.match({ ok: (n: number) => `val:${n}`, err: (e: string) => `err:${e}` }),
	)();
	expect(result).toBe("err:too small");
});

test("fold: receives transformed error from prior mapError", async () => {
	const result = await pipe(
		Task.Result.tryCatch(() => Promise.reject(new Error("boom")), { onError: (e: unknown) => (e as Error).message }),
		Task.Result.mapError((msg: string) => msg.toUpperCase()),
		Task.Result.fold((e: string) => `error: ${e}`, (_: number) => "ok"),
	)();
	expect(result).toBe("error: BOOM");
});

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

test("apply: applies Ok function to Ok value", async () => {
	const result = await pipe(
		Task.Result.make.ok<string, (n: number) => number>((n) => n * 3),
		Task.Result.apply(Task.Result.make.ok<string, number>(4)),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 12 });
});

test("apply: propagates error if function is Error", async () => {
	const result = await pipe(
		Task.Result.make.err<string, (n: number) => number>("error fn"),
		Task.Result.apply(Task.Result.make.ok<string, number>(4)),
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "error fn" });
});

test("apply: propagates error if value is Error", async () => {
	const result = await pipe(
		Task.Result.make.ok<string, (n: number) => number>((n) => n * 3),
		Task.Result.apply(Task.Result.make.err<string, number>("error val")),
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "error val" });
});

test("apply: propagates first error if both are Error", async () => {
	const result = await pipe(
		Task.Result.make.err<string, (n: number) => number>("error fn"),
		Task.Result.apply(Task.Result.make.err<string, number>("error val")),
	)();
	expect(result).toStrictEqual({ kind: "Err", error: "error fn" });
});

test("apply: widens error types from function and argument", async () => {
	const fnTask: Task.Result<"ERR_FN", (n: number) => string> = Task.Result.make.ok((n: number) => String(n));
	const argTask: Task.Result<"ERR_ARG", number> = Task.Result.make.err("ERR_ARG");
	const result = await pipe(fnTask, Task.Result.apply(argTask))();
	expectTypeOf(result).toEqualTypeOf<Result<"ERR_FN" | "ERR_ARG", string>>();
	expect(result).toStrictEqual({ kind: "Err", error: "ERR_ARG" });
});

test("apply: propagates AbortSignal down to both sides in parallel", async () => {
	let signalLeft: AbortSignal | undefined;
	let signalRight: AbortSignal | undefined;

	const left: Task.Result<string, (n: number) => number> = (signal) => {
		signalLeft = signal;
		return Deferred.from.Promise(Promise.resolve(Result.make.ok((n: number) => n * 3)));
	};
	const right: Task.Result<string, number> = (signal) => {
		signalRight = signal;
		return Deferred.from.Promise(Promise.resolve(Result.make.ok(4)));
	};

	const controller = new AbortController();
	const result = await pipe(left, Task.Result.apply(right))(controller.signal);

	expect(result).toStrictEqual({ kind: "Ok", value: 12 });
	expect(signalLeft).toBe(controller.signal);
	expect(signalRight).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// tapError
// ---------------------------------------------------------------------------

test("tapError: calls side effect with error on Err", async () => {
	let captured: string | undefined;
	await pipe(
		Task.Result.make.err<string, number>("oops"),
		Task.Result.tapError((e) => {
			captured = e;
		}),
	)();
	expect(captured).toBe("oops");
});

test("tapError: does not call side effect on Ok", async () => {
	let called = false;
	await pipe(
		Task.Result.make.ok<string, number>(1),
		Task.Result.tapError(() => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
});

test("tapError: returns original Err result unchanged", async () => {
	const result = await pipe(Task.Result.make.err<string, number>("oops"), Task.Result.tapError(() => {}))();
	expect(result).toStrictEqual({ kind: "Err", error: "oops" });
});

test("tapError: returns original Ok result unchanged", async () => {
	const result = await pipe(Task.Result.make.ok<string, number>(42), Task.Result.tapError(() => {}))();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

test("run: executes task and returns Result", async () => {
	const result = await pipe(Task.Result.make.ok<string, number>(42), Task.Result.run());
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("run: passes signal to task", async () => {
	const controller = new AbortController();
	let receivedSignal: AbortSignal | undefined;
	const task: Task.Result<never, void> = (signal) => {
		receivedSignal = signal;
		return Deferred.from.Promise(Promise.resolve(Result.make.ok(undefined)));
	};
	await pipe(task, Task.Result.run(controller.signal));
	expect(receivedSignal).toBe(controller.signal);
});

// --- from.nullable ---

test("from.nullable: returns Ok for non-null value", async () => {
	const result = await Task.Result.from.nullable(() => "is null")(42)();
	expect(result).toStrictEqual(Result.make.ok(42));
});

test("from.nullable: returns Err for null", async () => {
	const result = await Task.Result.from.nullable(() => "is null")(null)();
	expect(result).toStrictEqual(Result.make.err("is null"));
});

test("from.nullable: returns Err for undefined", async () => {
	const result = await Task.Result.from.nullable(() => "is null")(undefined)();
	expect(result).toStrictEqual(Result.make.err("is null"));
});

// --- fromMaybe ---

test("from.Maybe: returns Ok for Some", async () => {
	const result = await Task.Result.from.Maybe(() => "is none")(Maybe.make.some(42))();
	expect(result).toStrictEqual(Result.make.ok(42));
});

test("from.Maybe: returns Err for None", async () => {
	const result = await Task.Result.from.Maybe(() => "is none")(Maybe.make.none())();
	expect(result).toStrictEqual(Result.make.err("is none"));
});

// --- fromResult ---

test("from.Result: returns Ok for Ok", async () => {
	const result = await Task.Result.from.Result(Result.make.ok(42))();
	expect(result).toStrictEqual(Result.make.ok(42));
});

test("from.Result: returns Err for Err", async () => {
	const result = await Task.Result.from.Result(Result.make.err("bad"))();
	expect(result).toStrictEqual(Result.make.err("bad"));
});

// --- bindTo ---

test("bindTo: wraps value in accumulator object", async () => {
	const task = pipe(Task.Result.make.ok<string, number>(2), Task.Result.bindTo("a"));
	expectTypeOf(task).toEqualTypeOf<Task.Result<string, { a: number; }>>();

	const result = await task();
	expect(result).toStrictEqual(Result.make.ok({ a: 2 }));
});

// --- bind ---

test("bind: accumulates values key-by-key in pipeline", async () => {
	const task = pipe(
		Task.Result.make.ok<string, number>(2),
		Task.Result.bindTo("a"),
		Task.Result.bind("b", ({ a }) => Task.Result.make.ok<string, number>(a * 3)),
		Task.Result.bind("c", ({ a, b }) => Task.Result.make.ok<string, number>(a + b)),
	);
	expectTypeOf(task).toEqualTypeOf<Task.Result<string, { a: number; } & { b: number; } & { c: number; }>>();

	const result = await task();
	expect(result).toStrictEqual(Result.make.ok({ a: 2, b: 6, c: 8 }));
});

test("bind: short-circuits on Err", async () => {
	let called = false;
	const task = pipe(
		Task.Result.make.ok<string, number>(2),
		Task.Result.bindTo("a"),
		Task.Result.bind("b", () => Task.Result.make.err<string, number>("fail")),
		Task.Result.bind("c", ({ b }) => {
			called = true;
			return Task.Result.make.ok<string, number>(b);
		}),
	);
	expectTypeOf(task).toEqualTypeOf<Task.Result<string, { a: number; } & { b: number; } & { c: number; }>>();

	const result = await task();
	expect(called).toBe(false);
	expect(result).toStrictEqual(Result.make.err("fail"));
});

// --- struct ---

test("struct: combines record of Ok values into single Ok record", async () => {
	const res = await Task.Result.struct({
		a: Task.Result.make.ok<string, number>(1),
		b: Task.Result.make.ok<string, string>("hello"),
	})();
	expect(res).toStrictEqual(Result.make.ok({ a: 1, b: "hello" }));
});

test("struct: short-circuits on first Err encountered", async () => {
	const res = await Task.Result.struct({
		a: Task.Result.make.ok<string, number>(1),
		b: Task.Result.make.err<string, string>("first fail"),
		c: Task.Result.make.err<string, number>("second fail"),
	})();
	expect(res).toStrictEqual(Result.make.err("first fail"));
});

test("struct: propagates AbortSignal and executes in parallel", async () => {
	let signalA: AbortSignal | undefined;
	let signalB: AbortSignal | undefined;

	const taskA: Task.Result<string, number> = (signal) => {
		signalA = signal;
		return Deferred.from.Promise(Promise.resolve(Result.make.ok(1)));
	};
	const taskB: Task.Result<string, string> = (signal) => {
		signalB = signal;
		return Deferred.from.Promise(Promise.resolve(Result.make.ok("hello")));
	};

	const controller = new AbortController();
	const res = await Task.Result.struct({ a: taskA, b: taskB })(controller.signal);

	expect(res).toStrictEqual(Result.make.ok({ a: 1, b: "hello" }));
	expect(signalA).toBe(controller.signal);
	expect(signalB).toBe(controller.signal);
});

test("struct: composes in pipeline", async () => {
	const res = await pipe(
		Task.Result.make.ok<string, { name: string; }>({ name: "Alice" }),
		Task.Result.map((u) => u.name),
		Task.Result.chain((name) =>
			Task.Result.struct({
				name: Task.Result.make.ok<string, string>(name),
				valid: Task.Result.from.Result(Result.from.Predicate((n: string) => n.length > 0, () => "invalid")(name)),
			})
		),
	)();
	expect(res).toStrictEqual(Result.make.ok({ name: "Alice", valid: "Alice" }));
});

test("struct: returns ok({}) when given empty object", async () => {
	const res = await Task.Result.struct({})();
	expect(res).toStrictEqual(Result.make.ok({}));
});

// --- retry ---

test("retry: returns Ok on first attempt without retrying", async () => {
	let calls = 0;
	const task: Task.Result<string, number> = () => {
		calls++;
		return Deferred.from.Promise(Promise.resolve(Result.make.ok(42)));
	};
	const policy = RetryPolicy.constant({ attempts: 3, delay: Duration.milliseconds(10) });
	const result = await pipe(task, Task.Result.retry(policy))();

	expect(result).toStrictEqual(Result.make.ok(42));
	expect(calls).toBe(1);
});

test("retry: retries on Err until success", async () => {
	let calls = 0;
	const task: Task.Result<string, number> = () => {
		calls++;
		return Deferred.from.Promise(
			Promise.resolve(calls < 3 ? Result.make.err(`attempt ${calls} failed`) : Result.make.ok(42)),
		);
	};
	const policy = RetryPolicy.constant({ attempts: 3, delay: Duration.milliseconds(1) });
	const result = await pipe(task, Task.Result.retry(policy))();

	expect(result).toStrictEqual(Result.make.ok(42));
	expect(calls).toBe(3);
});

test("retry: returns final Err after exhausting attempts", async () => {
	let calls = 0;
	const task: Task.Result<string, number> = () => {
		calls++;
		return Deferred.from.Promise(Promise.resolve(Result.make.err(`attempt ${calls} failed`)));
	};
	const policy = RetryPolicy.constant({ attempts: 3, delay: Duration.milliseconds(1) });
	const result = await pipe(task, Task.Result.retry(policy))();

	expect(result).toStrictEqual(Result.make.err("attempt 3 failed"));
	expect(calls).toBe(3);
});

test("retry: stops early when call site AbortSignal is aborted", async () => {
	let calls = 0;
	const controller = new AbortController();
	const task: Task.Result<string, number> = () => {
		calls++;
		if (calls === 1) {
			controller.abort();
		}
		return Deferred.from.Promise(Promise.resolve(Result.make.err("failed")));
	};
	const policy = RetryPolicy.constant({ attempts: 5, delay: Duration.milliseconds(50) });
	const result = await pipe(task, Task.Result.retry(policy))(controller.signal);

	expect(result).toStrictEqual(Result.make.err("failed"));
	expect(calls).toBe(1);
});

// --- memoize ---

test("memoize: executes task only once across multiple invocations", async () => {
	let calls = 0;
	const task: Task.Result<string, number> = () => {
		calls++;
		return Deferred.from.Promise(Promise.resolve(Result.make.ok(calls)));
	};
	const memoized = Task.Result.memoize(task);

	const res1 = await memoized();
	const res2 = await memoized();

	expect(res1).toStrictEqual(Result.make.ok(1));
	expect(res2).toStrictEqual(Result.make.ok(1));
	expect(calls).toBe(1);
});

// --- timeout ---

test("timeout: resolves to task Ok when task finishes before duration", async () => {
	const task: Task.Result<string, number> = () => Deferred.from.Promise(Promise.resolve(Result.make.ok(42)));
	const res = await pipe(
		task,
		Task.Result.timeout({ duration: Duration.milliseconds(100), onTimeout: () => "timed_out" }),
	)();

	expect(res).toStrictEqual(Result.make.ok(42));
});

test("timeout: resolves to Err(onTimeout()) when task exceeds duration", async () => {
	const task: Task.Result<string, number> = () =>
		Deferred.from.Promise(new Promise((resolve) => setTimeout(() => resolve(Result.make.ok(42)), 100)));
	const res = await pipe(
		task,
		Task.Result.timeout({ duration: Duration.milliseconds(10), onTimeout: () => "timed_out" }),
	)();

	expect(res).toStrictEqual(Result.make.err("timed_out"));
});

test("timeout: handles pre-aborted signal", async () => {
	const controller = new AbortController();
	controller.abort();
	const task: Task.Result<string, number> = (sig) =>
		Deferred.from.Promise(Promise.resolve(sig?.aborted ? Result.make.err("aborted") : Result.make.ok(42)));

	const res = await pipe(
		task,
		Task.Result.timeout({ duration: Duration.milliseconds(100), onTimeout: () => "timed_out" }),
	)(controller.signal);

	expect(res).toStrictEqual(Result.make.err("aborted"));
});

test("timeout: handles signal aborted during execution", async () => {
	const controller = new AbortController();
	const task: Task.Result<string, number> = () => {
		setTimeout(() => controller.abort(), 10);
		return Deferred.from.Promise(new Promise((resolve) => setTimeout(() => resolve(Result.make.ok(42)), 50)));
	};

	const res = await pipe(
		task,
		Task.Result.timeout({ duration: Duration.milliseconds(100), onTimeout: () => "timed_out" }),
	)(controller.signal);

	expect(res).toStrictEqual(Result.make.ok(42));
});

test("retry: aborts during wait delay", async () => {
	const controller = new AbortController();
	let attempts = 0;
	const failingTask: Task.Result<string, number> = () => {
		attempts++;
		if (attempts === 1) {
			setTimeout(() => controller.abort(), 10);
		}
		return Deferred.from.Promise(Promise.resolve(Result.make.err("fail")));
	};

	const policy = RetryPolicy.constant({ attempts: 3, delay: Duration.milliseconds(100) });
	const res = await pipe(failingTask, Task.Result.retry(policy))(controller.signal);
	expect(res).toStrictEqual(Result.make.err("fail"));
});

// --- allSettled ---

test("allSettled: collects all Ok and Err results in parallel", async () => {
	const t1: Task.Result<string, number> = () => Deferred.from.Promise(Promise.resolve(Result.make.ok(1)));
	const t2: Task.Result<string, number> = () => Deferred.from.Promise(Promise.resolve(Result.make.err("e2")));
	const t3: Task.Result<string, number> = () => Deferred.from.Promise(Promise.resolve(Result.make.ok(3)));

	const res = await Task.Result.allSettled([t1, t2, t3])();

	expect(res).toStrictEqual([Result.make.ok(1), Result.make.err("e2"), Result.make.ok(3)]);
});

test("make: creates ok and err tasks", async () => {
	const okTask = Task.Result.make.ok(42);
	const errTask = Task.Result.make.err("failed");

	await expect(okTask()).resolves.toStrictEqual(Result.make.ok(42));
	await expect(errTask()).resolves.toStrictEqual(Result.make.err("failed"));
});

test("chain: supports error union widening", async () => {
	const step1: Task.Result<"ERR_A", number> = Task.Result.make.ok(42);
	const step2 = (_n: number): Task.Result<"ERR_B", string> => Task.Result.make.err("ERR_B");

	const res: Result<"ERR_A" | "ERR_B", string> = await pipe(step1, Task.Result.chain(step2))();
	expect(res).toStrictEqual({ kind: "Err", error: "ERR_B" });
});

test("chain: infers exact error union without collapsing to unknown", async () => {
	const step1 = Task.Result.make.err("ERR_A" as const);
	const step2 = (_: unknown) => Task.Result.make.err("ERR_B" as const);

	const taskRes = pipe(step1, Task.Result.chain(step2));
	expectTypeOf(taskRes).toEqualTypeOf<Task.Result<"ERR_A" | "ERR_B", never>>();
	const res = await taskRes();

	expectTypeOf(res).toMatchTypeOf<Result<"ERR_A" | "ERR_B", never>>();
	expect(res).toStrictEqual({ kind: "Err", error: "ERR_A" });
});

test("timeout: infers exact error union without collapsing to unknown", async () => {
	const step1: Task.Result<"ERR_A", number> = Task.Result.make.ok(42);
	const taskRes = pipe(
		step1,
		Task.Result.timeout({ duration: Duration.milliseconds(100), onTimeout: () => "TIMEOUT" as const }),
	);

	const res = await taskRes();
	expectTypeOf(res).toEqualTypeOf<Result<"ERR_A" | "TIMEOUT", number>>();
});

test("to.Maybe: converts Ok to Some and Err to None", async () => {
	const okTask = Task.Result.make.ok<string, number>(42);
	const errTask = Task.Result.make.err<string, number>("oops");

	await expect(Task.Result.to.Maybe(okTask)()).resolves.toStrictEqual({ kind: "Some", value: 42 });
	await expect(Task.Result.to.Maybe(errTask)()).resolves.toStrictEqual({ kind: "None" });
});

type TestErr = { code: "NOT_FOUND" | "TIMEOUT"; };
type TestVal = { id: number; };

test("make.ok: defaults error generic to never, allowing ternary error union inference", async () => {
	const step = (): Task.Result<TestErr, TestVal[]> => Task.Result.make.ok([{ id: 42 }]);

	const task = pipe(
		step(),
		Task.Result.chain((vals) =>
			vals.length === 0 ? Task.Result.make.err({ code: "NOT_FOUND" as const }) : Task.Result.make.ok(vals)
		),
		Task.Result.map((v) => String(v[0]?.id)),
	);

	const res = await task();
	expectTypeOf(res).toMatchTypeOf<Result<TestErr, string>>();
	expect(res).toStrictEqual(Result.make.ok("42"));
});

test("tryCatch: lifts async operations into Task.Result", async () => {
	const asyncOp = (): Promise<TestVal> => Promise.resolve({ id: 100 });
	const task: Task.Result<TestErr, TestVal> = Task.Result.tryCatch(() => asyncOp(), {
		onError: () => ({ code: "NOT_FOUND" }),
	});

	const res = await task();
	expectTypeOf(res).toMatchTypeOf<Result<TestErr, TestVal>>();
	expect(res).toStrictEqual(Result.make.ok({ id: 100 }));
});

// --- recoverUnless ---

test("recoverUnless: recovers from Err when not blocked", async () => {
	const task = pipe(
		Task.Result.make.err<string, number>("transient"),
		Task.Result.recoverUnless((e) => e === "fatal", () => Task.Result.make.ok(99)),
	);
	const res = await task();
	expect(res).toStrictEqual(Result.make.ok(99));
});

test("recoverUnless: preserves Err when blocked", async () => {
	const task = pipe(
		Task.Result.make.err<string, number>("fatal"),
		Task.Result.recoverUnless((e) => e === "fatal", () => Task.Result.make.ok(99)),
	);
	const res = await task();
	expect(res).toStrictEqual(Result.make.err("fatal"));
});

test("retry: returns early when signal is already aborted before backoff wait", async () => {
	const controller = new AbortController();
	controller.abort();
	const policy = RetryPolicy.constant({ attempts: 3, delay: Duration.milliseconds(100) });

	const task: Task.Result<string, number> = Task.Result.make.err("err");
	const res = await pipe(task, Task.Result.retry(policy))(controller.signal);
	expect(res).toStrictEqual(Result.make.err("err"));
});

test("retry: returns early when signal aborts during backoff wait delay", async () => {
	const controller = new AbortController();
	const policy = RetryPolicy.constant({ attempts: 5, delay: Duration.milliseconds(200) });

	let attempts = 0;
	const task: Task.Result<string, number> = (signal) => {
		attempts++;
		if (attempts === 1) {
			setTimeout(() => controller.abort(), 50);
		}
		return Task.Result.make.err<string, number>("err")(signal);
	};

	const res = await pipe(task, Task.Result.retry(policy))(controller.signal);
	expect(res).toStrictEqual(Result.make.err("err"));
	expect(attempts).toBeLessThanOrEqual(2);
});

test("retry: selectively retries only matching errors with when filter", async () => {
	type HttpError = { status: number; };
	const isHttpError = (err: unknown): err is HttpError => typeof err === "object" && err !== null && "status" in err;

	let calls = 0;
	const nonRetryableTask: Task.Result<HttpError, string> = () => {
		calls++;
		return Deferred.from.Promise(Promise.resolve(Result.make.err({ status: 400 })));
	};

	const policy = RetryPolicy.constant({ attempts: 3, delay: Duration.milliseconds(1) });
	const res = await pipe(
		nonRetryableTask,
		Task.Result.retry(policy, { when: (err) => isHttpError(err) && err.status >= 500 }),
	)();

	expect(res).toStrictEqual(Result.make.err({ status: 400 }));
	expect(calls).toBe(1); // not retried because status is 400
});

// --- ensure ---

test("ensure: leaves Ok untouched when predicate passes", async () => {
	let called = false;
	const task = pipe(
		Task.Result.make.ok(42),
		Task.Result.ensure((n) => n > 10, () => {
			called = true;
			return "too small";
		}),
	);
	const res = await task();
	expect(res).toStrictEqual(Result.make.ok(42));
	expect(called).toBe(false);
});

test("ensure: converts Ok to Err when predicate fails", async () => {
	const task = pipe(Task.Result.make.ok(5), Task.Result.ensure((n) => n > 10, (n) => `${n} is too small`));
	const res = await task();
	expect(res).toStrictEqual(Result.make.err("5 is too small"));
});

test("ensure: propagates existing Err without invoking predicate", async () => {
	let predicateCalled = false;
	const task = pipe(
		Task.Result.make.err<string, number>("original error"),
		Task.Result.ensure((n) => {
			predicateCalled = true;
			return n > 10;
		}, () => "should not be called"),
	);
	const res = await task();
	expect(res).toStrictEqual(Result.make.err("original error"));
	expect(predicateCalled).toBe(false);
});

// --- bimap ---

test("bimap: transforms Ok value and leaves Err branch untouched", async () => {
	let errCalled = false;
	const task = pipe(
		Task.Result.make.ok(10),
		Task.Result.bimap((err) => {
			errCalled = true;
			return `wrapped ${err}`;
		}, (n) => n * 2),
	);
	const res = await task();
	expect(res).toStrictEqual(Result.make.ok(20));
	expect(errCalled).toBe(false);
});

test("bimap: transforms Err value and leaves Ok branch untouched", async () => {
	let okCalled = false;
	const task = pipe(
		Task.Result.make.err<string, number>("network failure"),
		Task.Result.bimap((err) => new Error(err), (n) => {
			okCalled = true;
			return n * 2;
		}),
	);
	const res = await task();
	expect(res).toStrictEqual(Result.make.err(new Error("network failure")));
	expect(okCalled).toBe(false);
});
