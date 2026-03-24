import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Result } from "../Result.ts";
import { Task } from "../Task.ts";
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
// retry
// ---------------------------------------------------------------------------

test("TaskResult.retry returns Ok without retrying", async () => {
	let calls = 0;
	const task: TaskResult<string, number> = () => {
		calls++;
		return TaskResult.ok<string, number>(42)();
	};
	const result = await pipe(task, TaskResult.retry({ attempts: 3 }))();
	expect(result).toEqual({ kind: "Ok", value: 42 });
	expect(calls).toBe(1);
});

test(
	"TaskResult.retry retries on Err and returns Ok on eventual success",
	async () => {
		let calls = 0;
		const task: TaskResult<string, number> = () => {
			calls++;
			return calls < 3 ? TaskResult.err<string, number>("fail")() : TaskResult.ok<string, number>(42)();
		};
		const result = await pipe(task, TaskResult.retry({ attempts: 3 }))();
		expect(result).toEqual({ kind: "Ok", value: 42 });
		expect(calls).toBe(3);
	},
);

test(
	"TaskResult.retry returns last Err after exhausting all attempts",
	async () => {
		let calls = 0;
		const task: TaskResult<string, number> = () => {
			calls++;
			return TaskResult.err<string, number>("boom")();
		};
		const result = await pipe(task, TaskResult.retry({ attempts: 3 }))();
		expect(result).toEqual({ kind: "Error", error: "boom" });
		expect(calls).toBe(3);
	},
);

test("TaskResult.retry with attempts: 1 does not retry", async () => {
	let calls = 0;
	const task: TaskResult<string, number> = () => {
		calls++;
		return TaskResult.err<string, number>("boom")();
	};
	const result = await pipe(task, TaskResult.retry({ attempts: 1 }))();
	expect(result).toEqual({ kind: "Error", error: "boom" });
	expect(calls).toBe(1);
});

test(
	"TaskResult.retry when predicate stops retry on non-matching error",
	async () => {
		let calls = 0;
		const task: TaskResult<string, number> = () => {
			calls++;
			return TaskResult.err<string, number>("auth-error")();
		};
		const result = await pipe(
			task,
			TaskResult.retry({ attempts: 3, when: (e) => e !== "auth-error" }),
		)();
		expect(result).toEqual({ kind: "Error", error: "auth-error" });
		expect(calls).toBe(1);
	},
);

test(
	"TaskResult.retry when predicate allows retry on matching error",
	async () => {
		let calls = 0;
		const task: TaskResult<string, number> = () => {
			calls++;
			return calls < 3 ? TaskResult.err<string, number>("network-error")() : TaskResult.ok<string, number>(42)();
		};
		const result = await pipe(
			task,
			TaskResult.retry({ attempts: 3, when: (e) => e === "network-error" }),
		)();
		expect(result).toEqual({ kind: "Ok", value: 42 });
		expect(calls).toBe(3);
	},
);

test(
	"TaskResult.retry calls backoff function with retry attempt number",
	async () => {
		const recorded: number[] = [];
		const task: TaskResult<string, number> = () => TaskResult.err<string, number>("fail")();
		await pipe(
			task,
			TaskResult.retry({
				attempts: 3,
				backoff: (n) => {
					recorded.push(n);
					return 0;
				},
			}),
		)();
		expect(recorded).toEqual([1, 2]);
	},
);

test("TaskResult.retry applies fixed numeric backoff between retries", async () => {
	let calls = 0;
	const task: TaskResult<string, number> = () => {
		calls++;
		return TaskResult.err<string, number>("fail")();
	};
	const result = await pipe(
		task,
		TaskResult.retry({ attempts: 2, backoff: 1 }),
	)();
	expect(result).toEqual({ kind: "Error", error: "fail" });
	expect(calls).toBe(2);
});

// ---------------------------------------------------------------------------
// timeout
// ---------------------------------------------------------------------------

test(
	"TaskResult.timeout returns Ok when task resolves before timeout",
	async () => {
		const result = await pipe(
			TaskResult.ok<string, number>(42),
			TaskResult.timeout(100, () => "timed out"),
		)();
		expect(result).toEqual({ kind: "Ok", value: 42 });
	},
);

test("TaskResult.timeout returns Err when task exceeds timeout", async () => {
	const slow = Task.from(
		() => new Promise<Result<string, number>>((r) => setTimeout(() => r({ kind: "Ok", value: 42 }), 200)),
	);
	const start = Date.now();
	const result = await pipe(
		slow,
		TaskResult.timeout(10, () => "timed out"),
	)();
	expect(Date.now() - start).toBeLessThan(100);
	expect(result).toEqual({ kind: "Error", error: "timed out" });
});

test(
	"TaskResult.timeout passes Err through if task resolves to Err before timeout",
	async () => {
		const result = await pipe(
			TaskResult.err<string, number>("original error"),
			TaskResult.timeout(100, () => "timed out"),
		)();
		expect(result).toEqual({ kind: "Error", error: "original error" });
	},
);

test("TaskResult.timeout uses the onTimeout return value as the error", async () => {
	const slow = Task.from(
		() => new Promise<Result<string, number>>((r) => setTimeout(() => r({ kind: "Ok", value: 42 }), 200)),
	);
	const start = Date.now();
	const result = await pipe(
		slow,
		TaskResult.timeout(10, () => "request timed out"),
	)();
	expect(Date.now() - start).toBeLessThan(100);
	expect(result).toEqual({ kind: "Error", error: "request timed out" });
});

// ---------------------------------------------------------------------------
// pollUntil
// ---------------------------------------------------------------------------

test("TaskResult.pollUntil returns Ok immediately when predicate is satisfied on first run", async () => {
	let calls = 0;
	const task: TaskResult<string, number> = () => {
		calls++;
		return TaskResult.ok<string, number>(42)();
	};
	const result = await pipe(task, TaskResult.pollUntil({ when: (n) => n === 42 }))();
	expect(result).toEqual({ kind: "Ok", value: 42 });
	expect(calls).toBe(1);
});

test("TaskResult.pollUntil keeps polling until predicate is satisfied", async () => {
	let calls = 0;
	const task: TaskResult<string, number> = () => {
		calls++;
		return TaskResult.ok<string, number>(calls)();
	};
	const result = await pipe(task, TaskResult.pollUntil({ when: (n) => n >= 3 }))();
	expect(result).toEqual({ kind: "Ok", value: 3 });
	expect(calls).toBe(3);
});

test("TaskResult.pollUntil stops immediately on Err without retrying", async () => {
	let calls = 0;
	const task: TaskResult<string, number> = () => {
		calls++;
		return TaskResult.err<string, number>("fail")();
	};
	const result = await pipe(task, TaskResult.pollUntil({ when: (n) => n === 1 }))();
	expect(result).toEqual({ kind: "Error", error: "fail" });
	expect(calls).toBe(1);
});

test("TaskResult.pollUntil with fixed delay polls multiple times", async () => {
	let calls = 0;
	const task: TaskResult<string, number> = () => {
		calls++;
		return TaskResult.ok<string, number>(calls)();
	};
	const result = await pipe(task, TaskResult.pollUntil({ when: (n) => n >= 2, delay: 1 }))();
	expect(result).toEqual({ kind: "Ok", value: 2 });
	expect(calls).toBe(2);
});

test("TaskResult.pollUntil with function delay receives attempt number", async () => {
	const recorded: number[] = [];
	let calls = 0;
	const task: TaskResult<string, number> = () => {
		calls++;
		return TaskResult.ok<string, number>(calls)();
	};
	await pipe(
		task,
		TaskResult.pollUntil({
			when: (n) => n >= 3,
			delay: (n) => {
				recorded.push(n);
				return 0;
			},
		}),
	)();
	expect(recorded).toEqual([1, 2]);
	expect(calls).toBe(3);
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
// retry — signal threading and early stop
// ---------------------------------------------------------------------------

test("TaskResult.retry stops before the next attempt when signal is already aborted", async () => {
	const controller = new AbortController();
	let calls = 0;
	const task: TaskResult<string, number> = (signal) => {
		calls++;
		// Abort after the first attempt
		if (calls === 1) controller.abort();
		return TaskResult.err<string, number>("fail")(signal);
	};
	const result = await pipe(task, TaskResult.retry({ attempts: 3 }))(controller.signal);
	expect(result).toEqual({ kind: "Error", error: "fail" });
	// Should stop after first attempt because signal was aborted
	expect(calls).toBe(1);
});

test("TaskResult.retry cancellable delay resolves early on abort", async () => {
	const controller = new AbortController();
	let calls = 0;
	const task: TaskResult<string, number> = () => {
		calls++;
		return TaskResult.err<string, number>("fail")();
	};
	// Use a long backoff that should be cancelled
	const start = Date.now();
	const promise = pipe(task, TaskResult.retry({ attempts: 3, backoff: 500 }))(controller.signal);
	// Abort shortly after the first attempt fires
	setTimeout(() => controller.abort(), 20);
	await promise;
	const elapsed = Date.now() - start;
	// Should finish well before 500ms (the full backoff)
	expect(elapsed).toBeLessThan(400);
	expect(calls).toBeLessThanOrEqual(2);
});

test("TaskResult.retry threads signal to each attempt", async () => {
	const controller = new AbortController();
	const signals: Array<AbortSignal | undefined> = [];
	const task: TaskResult<string, number> = (signal) => {
		signals.push(signal);
		return TaskResult.err<string, number>("fail")(signal);
	};
	await pipe(task, TaskResult.retry({ attempts: 2 }))(controller.signal);
	expect(signals.every((s) => s === controller.signal)).toBe(true);
});

// ---------------------------------------------------------------------------
// pollUntil — signal threading and early stop
// ---------------------------------------------------------------------------

test("TaskResult.pollUntil stops before the next poll when signal is already aborted", async () => {
	const controller = new AbortController();
	let calls = 0;
	const task: TaskResult<string, number> = (signal) => {
		calls++;
		if (calls === 1) controller.abort();
		return TaskResult.ok<string, number>(calls)(signal);
	};
	const result = await pipe(task, TaskResult.pollUntil({ when: (n) => n >= 5 }))(controller.signal);
	expect(calls).toBe(1);
	expect(result).toEqual({ kind: "Ok", value: 1 });
});

test("TaskResult.pollUntil cancellable delay resolves early on abort", async () => {
	const controller = new AbortController();
	let calls = 0;
	const task: TaskResult<string, number> = () => {
		calls++;
		return TaskResult.ok<string, number>(calls)();
	};
	const start = Date.now();
	const promise = pipe(task, TaskResult.pollUntil({ when: (n) => n >= 10, delay: 500 }))(controller.signal);
	setTimeout(() => controller.abort(), 20);
	await promise;
	const elapsed = Date.now() - start;
	expect(elapsed).toBeLessThan(400);
	expect(calls).toBeLessThanOrEqual(2);
});

// ---------------------------------------------------------------------------
// timeout — inner task receives AbortSignal
// ---------------------------------------------------------------------------

test("TaskResult.timeout aborts the inner task when the deadline fires", async () => {
	let innerSignal: AbortSignal | undefined;
	const slow = Task.from((signal) => {
		innerSignal = signal;
		return new Promise<Result<string, number>>((r) => setTimeout(() => r({ kind: "Ok", value: 42 }), 200));
	});
	await pipe(slow, TaskResult.timeout(10, () => "timed out"))();
	expect(innerSignal?.aborted).toBe(true);
});

test("TaskResult.timeout wires the outer signal to the inner task", async () => {
	const outerController = new AbortController();
	let innerSignal: AbortSignal | undefined;
	const slow = Task.from((signal) => {
		innerSignal = signal;
		return new Promise<Result<string, number>>((r) => setTimeout(() => r({ kind: "Ok", value: 42 }), 200));
	});
	const composed = pipe(slow, TaskResult.timeout(500, () => "timed out"));
	const running = composed(outerController.signal);
	outerController.abort();
	await running;
	expect(innerSignal?.aborted).toBe(true);
});

// ---------------------------------------------------------------------------
// abortable
// ---------------------------------------------------------------------------

test("TaskResult.abortable returns a task and an abort function", () => {
	const { task, abort } = TaskResult.abortable(() => Promise.resolve(42), String);
	expectTypeOf(task).toBeFunction();
	expectTypeOf(abort).toBeFunction();
});

test("TaskResult.abortable task resolves to Ok when not aborted", async () => {
	const { task } = TaskResult.abortable(() => Promise.resolve(42), String);
	const result = await task();
	expect(result).toEqual({ kind: "Ok", value: 42 });
});

test("TaskResult.abortable abort() causes the task to resolve to Err via onError", async () => {
	const { task, abort } = TaskResult.abortable(
		(signal) =>
			new Promise<number>((_, reject) => {
				signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
			}),
		(e) => (e as Error).message,
	);
	const promise = task(); // start before aborting so the listener is registered
	abort();
	const result = await promise;
	expect(result).toEqual({ kind: "Error", error: "aborted" });
});

test("TaskResult.abortable passes the controller signal to the factory", async () => {
	let receivedSignal: AbortSignal | undefined;
	const { task } = TaskResult.abortable((signal) => {
		receivedSignal = signal;
		return Promise.resolve(1);
	}, String);
	await task();
	expect(receivedSignal).toBeInstanceOf(AbortSignal);
});

// oxlint-disable-next-line require-await
test("TaskResult.abortable wires outer signal to the internal controller", async () => {
	const outerController = new AbortController();
	let capturedSignal: AbortSignal | undefined;
	const { task } = TaskResult.abortable((signal) => {
		capturedSignal = signal;
		return new Promise<number>((r) => setTimeout(() => r(1), 100));
	}, String);
	task(outerController.signal); // start but don't await
	outerController.abort();
	expect(capturedSignal?.aborted).toBe(true);
});

test("TaskResult.abortable aborts the inner controller immediately when outer signal is already aborted", () => {
	const outerController = new AbortController();
	outerController.abort();
	let capturedSignal: AbortSignal | undefined;
	const { task } = TaskResult.abortable((signal) => {
		capturedSignal = signal;
		return Promise.resolve(1);
	}, String);
	task(outerController.signal);
	expect(capturedSignal?.aborted).toBe(true);
});

test("TaskResult.timeout removes the outer signal listener after normal completion", async () => {
	const outerController = new AbortController();
	let innerSignal: AbortSignal | undefined;
	const fast = Task.from((signal) => {
		innerSignal = signal;
		return Promise.resolve<Result<string, number>>({ kind: "Ok", value: 42 });
	});
	await pipe(fast, TaskResult.timeout(500, () => "timed out"))(outerController.signal);
	// Task completed before the deadline — listener should have been removed
	outerController.abort();
	expect(innerSignal?.aborted).toBe(false);
});

test("TaskResult.pollUntil composes in a pipe chain", async () => {
	let calls = 0;
	const task: TaskResult<string, { status: string; value: number; }> = () => {
		calls++;
		return TaskResult.ok<string, { status: string; value: number; }>(
			calls < 3 ? { status: "pending", value: 0 } : { status: "done", value: 99 },
		)();
	};
	const result = await pipe(
		task,
		TaskResult.pollUntil({ when: (r) => r.status === "done" }),
		TaskResult.map((r) => r.value),
	)();
	expect(result).toEqual({ kind: "Ok", value: 99 });
	expect(calls).toBe(3);
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

test("TaskResult.timeout fires before retry exhausts all attempts", async () => {
	let calls = 0;
	const slow: TaskResult<string, number> = Task.from(() => {
		calls++;
		return new Promise<Result<string, number>>((r) => setTimeout(() => r(Result.err("fail")), 100));
	});
	const result = await pipe(
		slow,
		TaskResult.retry({ attempts: 5, backoff: 0 }),
		TaskResult.timeout(50, () => "timed out"),
	)();
	expect(result).toEqual({ kind: "Error", error: "timed out" });
	expect(calls).toBeLessThan(5);
});

test("TaskResult.abortable task can be piped through retry and match", async () => {
	let calls = 0;
	const { task } = TaskResult.abortable(
		() => {
			calls++;
			return calls < 3 ? Promise.reject(new Error("not yet")) : Promise.resolve(99);
		},
		(e) => (e as Error).message,
	);
	const result = await pipe(
		task,
		TaskResult.retry({ attempts: 5 }),
		TaskResult.match({
			ok: (n: number) => `ok:${n}`,
			err: (e: string) => `err:${e}`,
		}),
	)();
	expect(result).toBe("ok:99");
	expect(calls).toBe(3);
});

test("TaskResult two stacked timeouts — the shorter outer fires first", async () => {
	const slow: TaskResult<string, number> = Task.from(() =>
		new Promise<Result<string, number>>((r) => setTimeout(() => r(Result.ok(42)), 400))
	);
	const result = await pipe(
		slow,
		TaskResult.timeout(300, () => "inner timeout"),
		TaskResult.timeout(100, () => "outer timeout"),
	)();
	expect(result).toEqual({ kind: "Error", error: "outer timeout" });
});

test("TaskResult two stacked retries multiply the total attempt count", async () => {
	let calls = 0;
	const task: TaskResult<string, number> = Task.from((): Promise<Result<string, number>> => {
		calls++;
		return calls < 5
			? Promise.resolve(Result.err("fail"))
			: Promise.resolve(Result.ok(42));
	});
	// inner retry(2): up to 2 attempts per outer round
	// outer retry(3): up to 3 rounds
	// round 1 -> calls 1,2 -> Err; round 2 -> calls 3,4 -> Err; round 3 -> call 5 -> Ok
	const result = await pipe(
		task,
		TaskResult.retry({ attempts: 2 }),
		TaskResult.retry({ attempts: 3 }),
	)();
	expect(result).toEqual({ kind: "Ok", value: 42 });
	expect(calls).toBe(5);
});

test("TaskResult timeout terminates a pollUntil that would never complete", async () => {
	let calls = 0;
	const task: TaskResult<string, { status: string; }> = Task.from(
		(): Promise<Result<string, { status: string; }>> => {
			calls++;
			return Promise.resolve(Result.ok({ status: "pending" }));
		},
	);
	const result = await pipe(
		task,
		TaskResult.pollUntil({ when: (r) => r.status === "done", delay: 10 }),
		TaskResult.timeout(80, () => "deadline exceeded"),
	)();
	expect(result).toEqual({ kind: "Error", error: "deadline exceeded" });
	expect(calls).toBeGreaterThan(1);
});

test("TaskResult retry wrapping pollUntil restarts the entire poll sequence on Err", async () => {
	let calls = 0;
	const task: TaskResult<string, { status: string; }> = () => {
		calls++;
		// call 1 -> Err  (pollUntil stops, retry round 1 fails)
		// calls 2,3 -> Ok(pending); call 4 -> Err  (retry round 2 fails)
		// call 5 -> Ok(done)
		if (calls === 1 || calls === 4) return TaskResult.err<string, { status: string; }>("network error")();
		const done = calls === 5;
		return TaskResult.ok<string, { status: string; }>({ status: done ? "done" : "pending" })();
	};
	const result = await pipe(
		task,
		TaskResult.pollUntil({ when: (r) => r.status === "done", delay: 0 }),
		TaskResult.retry({ attempts: 3 }),
	)();
	expect(result).toEqual({ kind: "Ok", value: { status: "done" } });
	expect(calls).toBe(5);
});

test("TaskResult abortable abort() before the timeout deadline resolves via onError not timeout", async () => {
	const { task, abort } = TaskResult.abortable(
		(signal) =>
			new Promise<number>((_, reject) => {
				signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
			}),
		(e) => (e as Error).message,
	);
	const composed = pipe(task, TaskResult.timeout(500, () => "timed out"));
	const promise = composed();
	abort();
	const result = await promise;
	// abort fires before 500ms — factory rejects, timeout timer is cleared, Err comes from onError
	expect(result).toEqual({ kind: "Error", error: "cancelled" });
});

test("TaskResult pollUntil + retry + timeout — timeout is the global backstop", async () => {
	let calls = 0;
	const task: TaskResult<string, { status: string; }> = Task.from(
		(): Promise<Result<string, { status: string; }>> => {
			calls++;
			return Promise.resolve(Result.ok({ status: "pending" }));
		},
	);
	// poll never satisfies predicate; retry(10) would restart on Err but poll never errors;
	// timeout(80ms) is the only exit
	const result = await pipe(
		task,
		TaskResult.pollUntil({ when: (r) => r.status === "done", delay: 10 }),
		TaskResult.retry({ attempts: 10 }),
		TaskResult.timeout(80, () => "global timeout"),
	)();
	expect(result).toEqual({ kind: "Error", error: "global timeout" });
	expect(calls).toBeGreaterThan(3);
});

test("TaskResult full request lifecycle: tryCatch -> retry -> tap -> map -> recover -> getOrElse", async () => {
	let calls = 0;
	const tapped: number[] = [];
	const result = await pipe(
		TaskResult.tryCatch(
			() => {
				calls++;
				return calls < 3 ? Promise.reject(new Error("transient")) : Promise.resolve(42);
			},
			(e) => (e as Error).message,
		),
		TaskResult.retry({ attempts: 3 }),
		TaskResult.tap((n: number) => tapped.push(n)),
		TaskResult.map((n: number) => n * 2),
		TaskResult.recover((_e: string) => TaskResult.ok<string, number>(0)),
		TaskResult.getOrElse(() => -1),
	)();
	expect(result).toBe(84);
	expect(calls).toBe(3);
	expect(tapped).toEqual([42]); // tap fires once, after retry succeeds, before map
});
