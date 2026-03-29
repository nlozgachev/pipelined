import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { TaskResult } from "../TaskResult.ts";

// ---------------------------------------------------------------------------
// of
// ---------------------------------------------------------------------------

test("TaskResult.ok creates a Task that resolves to Ok", async () => {
	const result = await TaskResult.ok<string, number>(42)();
	expect(result).toEqual({ kind: "Ok", value: 42 });
});

// ---------------------------------------------------------------------------
// fail
// ---------------------------------------------------------------------------

test("TaskResult.err creates a Task that resolves to Err", async () => {
	const result = await TaskResult.err<string, number>("error")();
	expect(result).toEqual({ kind: "Error", error: "error" });
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("TaskResult.tryCatch returns Ok when Promise resolves", async () => {
	const result = await TaskResult.tryCatch(
		() => Promise.resolve(42),
		(e) => `Error: ${e}`,
	)();
	expect(result).toEqual({ kind: "Ok", value: 42 });
});

test("TaskResult.tryCatch returns Err when Promise rejects", async () => {
	const result = await TaskResult.tryCatch(
		() => Promise.reject(new Error("boom")),
		(e) => (e as Error).message,
	)();
	expect(result).toEqual({ kind: "Error", error: "boom" });
});

test(
	"TaskResult.tryCatch catches synchronous throws in async functions",
	async () => {
		const result = await TaskResult.tryCatch(
			// oxlint-disable-next-line require-await
			async () => {
				throw new Error("sync throw");
			},
			(e) => (e as Error).message,
		)();
		expect(result).toEqual({ kind: "Error", error: "sync throw" });
	},
);

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("TaskResult.map transforms Ok value", async () => {
	const result = await pipe(
		TaskResult.ok<string, number>(5),
		TaskResult.map((n: number) => n * 2),
	)();
	expect(result).toEqual({ kind: "Ok", value: 10 });
});

test("TaskResult.map passes through Err unchanged", async () => {
	const result = await pipe(
		TaskResult.err<string, number>("error"),
		TaskResult.map((n: number) => n * 2),
	)();
	expect(result).toEqual({ kind: "Error", error: "error" });
});

test("TaskResult.map can change the value type", async () => {
	const result = await pipe(
		TaskResult.ok<string, number>(42),
		TaskResult.map((n: number) => `num: ${n}`),
	)();
	expect(result).toEqual({ kind: "Ok", value: "num: 42" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("TaskResult.mapError transforms Err value", async () => {
	const result = await pipe(
		TaskResult.err<string, number>("oops"),
		TaskResult.mapError((e: string) => e.toUpperCase()),
	)();
	expect(result).toEqual({ kind: "Error", error: "OOPS" });
});

test("TaskResult.mapError passes through Ok unchanged", async () => {
	const result = await pipe(
		TaskResult.ok<string, number>(5),
		TaskResult.mapError((e: string) => e.toUpperCase()),
	)();
	expect(result).toEqual({ kind: "Ok", value: 5 });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("TaskResult.chain applies function when Ok", async () => {
	const validatePositive = (n: number): TaskResult<string, number> =>
		n > 0 ? TaskResult.ok(n) : TaskResult.err("Must be positive");

	const result = await pipe(
		TaskResult.ok<string, number>(5),
		TaskResult.chain(validatePositive),
	)();
	expect(result).toEqual({ kind: "Ok", value: 5 });
});

test(
	"TaskResult.chain returns Err when function returns Err",
	async () => {
		const validatePositive = (n: number): TaskResult<string, number> =>
			n > 0 ? TaskResult.ok(n) : TaskResult.err("Must be positive");

		const result = await pipe(
			TaskResult.ok<string, number>(-1),
			TaskResult.chain(validatePositive),
		)();
		expect(result).toEqual({ kind: "Error", error: "Must be positive" });
	},
);

test(
	"TaskResult.chain propagates Err without calling function",
	async () => {
		let called = false;
		const result = await pipe(
			TaskResult.err<string, number>("error"),
			TaskResult.chain((_n: number) => {
				called = true;
				return TaskResult.ok<string, number>(_n);
			}),
		)();
		expect(called).toBe(false);
		expect(result).toEqual({ kind: "Error", error: "error" });
	},
);

test("TaskResult.chain composes multiple async steps", async () => {
	const result = await pipe(
		TaskResult.ok<string, number>(1),
		TaskResult.chain((n: number) => TaskResult.ok<string, number>(n + 1)),
		TaskResult.chain((n: number) => TaskResult.ok<string, number>(n * 10)),
	)();
	expect(result).toEqual({ kind: "Ok", value: 20 });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("TaskResult.fold calls onOk for Ok", async () => {
	const result = await pipe(
		TaskResult.ok<string, number>(5),
		TaskResult.fold(
			(e: string) => `Error: ${e}`,
			(n: number) => `Value: ${n}`,
		),
	)();
	expect(result).toBe("Value: 5");
});

test("TaskResult.fold calls onErr for Err", async () => {
	const result = await pipe(
		TaskResult.err<string, number>("bad"),
		TaskResult.fold(
			(e: string) => `Error: ${e}`,
			(n: number) => `Value: ${n}`,
		),
	)();
	expect(result).toBe("Error: bad");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("TaskResult.match calls ok handler for Ok", async () => {
	const result = await pipe(
		TaskResult.ok<string, number>(5),
		TaskResult.match({
			ok: (n: number) => `got ${n}`,
			err: (e: string) => `failed: ${e}`,
		}),
	)();
	expect(result).toBe("got 5");
});

test("TaskResult.match calls err handler for Err", async () => {
	const result = await pipe(
		TaskResult.err<string, number>("bad"),
		TaskResult.match({
			ok: (n: number) => `got ${n}`,
			err: (e: string) => `failed: ${e}`,
		}),
	)();
	expect(result).toBe("failed: bad");
});

test(
	"TaskResult.match is data-last (returns a function first)",
	async () => {
		const handler = TaskResult.match<string, number, string>({
			ok: (n) => `val: ${n}`,
			err: (e) => `err: ${e}`,
		});
		const okResult = await handler(TaskResult.ok<string, number>(3))();
		expect(okResult).toBe("val: 3");
		const errResult = await handler(TaskResult.err<string, number>("x"))();
		expect(errResult).toBe("err: x");
	},
);

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test(
	"TaskResult.recover returns original Ok without calling fallback",
	async () => {
		let called = false;
		const result = await pipe(
			TaskResult.ok<string, number>(5),
			TaskResult.recover((_e: string) => {
				called = true;
				return TaskResult.ok<string, number>(99);
			}),
		)();
		expect(called).toBe(false);
		expect(result).toEqual({ kind: "Ok", value: 5 });
	},
);

test("TaskResult.recover provides fallback for Err", async () => {
	const result = await pipe(
		TaskResult.err<string, number>("error"),
		TaskResult.recover((_e: string) => TaskResult.ok<string, number>(99)),
	)();
	expect(result).toEqual({ kind: "Ok", value: 99 });
});

test(
	"TaskResult.recover widens to TaskResult<E, A | B> when fallback returns a different type",
	async () => {
		const result = await pipe(
			TaskResult.err("error"),
			TaskResult.recover((_e) => TaskResult.ok("recovered")),
		)();
		expect(result).toEqual({ kind: "Ok", value: "recovered" });
	},
);

test("TaskResult.recover preserves Ok typed as TaskResult<E, A | B>", async () => {
	const result = await pipe(
		TaskResult.ok(5),
		TaskResult.recover((_e) => TaskResult.ok("recovered")),
	)();
	expect(result).toEqual({ kind: "Ok", value: 5 });
});

test(
	"TaskResult.recover passes the error to the fallback function",
	async () => {
		let receivedError = "";
		await pipe(
			TaskResult.err<string, number>("original error"),
			TaskResult.recover((e: string) => {
				receivedError = e;
				return TaskResult.ok<string, number>(0);
			}),
		)();
		expect(receivedError).toBe("original error");
	},
);

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("TaskResult.getOrElse returns value for Ok", async () => {
	const result = await pipe(
		TaskResult.ok<string, number>(5),
		TaskResult.getOrElse(() => 0),
	)();
	expect(result).toBe(5);
});

test("TaskResult.getOrElse returns default for Err", async () => {
	const result = await pipe(
		TaskResult.err<string, number>("error"),
		TaskResult.getOrElse(() => 0),
	)();
	expect(result).toBe(0);
});

test("TaskResult.getOrElse widens return type to A | B when default is a different type", async () => {
	const result = await pipe(
		TaskResult.err("error"),
		TaskResult.getOrElse(() => null),
	)();
	expect(result).toBeNull();
});

test("TaskResult.getOrElse returns Ok value typed as A | B when Ok", async () => {
	const result = await pipe(
		TaskResult.ok(5),
		TaskResult.getOrElse(() => null),
	)();
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test(
	"TaskResult.tap executes side effect on Ok and returns original",
	async () => {
		let sideEffect = 0;
		const result = await pipe(
			TaskResult.ok<string, number>(5),
			TaskResult.tap((n: number) => {
				sideEffect = n;
			}),
		)();
		expect(sideEffect).toBe(5);
		expect(result).toEqual({ kind: "Ok", value: 5 });
	},
);

test("TaskResult.tap does not execute side effect on Err", async () => {
	let called = false;
	const result = await pipe(
		TaskResult.err<string, number>("error"),
		TaskResult.tap((_n: number) => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
	expect(result).toEqual({ kind: "Error", error: "error" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("TaskResult composes well in a pipe chain", async () => {
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

test("TaskResult pipe short-circuits on Err", async () => {
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

test("TaskResult tryCatch integrates with pipe chain", async () => {
	const result = await pipe(
		TaskResult.tryCatch(
			() => Promise.resolve(42),
			(e) => `Error: ${e}`,
		),
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
	expect(result).toEqual({ kind: "Ok", value: 1 });
});

test("TaskResult.mapError normalizes the error type before recover acts on it", async () => {
	type ApiError = { code: number; msg: string; };
	const result = await pipe(
		TaskResult.tryCatch(
			() => Promise.reject(new Error("service unavailable")),
			(e) => (e as Error).message,
		),
		TaskResult.mapError((msg: string): ApiError => ({ code: 503, msg })),
		TaskResult.recover((e: ApiError) =>
			e.code >= 500
				? TaskResult.ok<ApiError, string>("cached")
				: TaskResult.err<ApiError, string>(e)
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
	expect(result).toEqual({ kind: "Ok", value: 11 });
	expect(log).toEqual([5]); // tap sees the pre-chain value
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
		TaskResult.tryCatch(
			() => Promise.reject(new Error("boom")),
			(e: unknown) => (e as Error).message,
		),
		TaskResult.mapError((msg: string) => msg.toUpperCase()),
		TaskResult.fold(
			(e: string) => `error: ${e}`,
			(_: number) => "ok",
		),
	)();
	expect(result).toBe("error: BOOM");
});
