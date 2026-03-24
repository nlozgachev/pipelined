import { expect, test } from "vitest";
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
	const result = await pipe(
		slow,
		TaskResult.timeout(10, () => "timed out"),
	)();
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
	const result = await pipe(
		slow,
		TaskResult.timeout(10, () => "request timed out"),
	)();
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

test("TaskResult.pollUntil composes in a pipe chain", async () => {
	let calls = 0;
	const task: TaskResult<string, { status: string; value: number }> = () => {
		calls++;
		return TaskResult.ok<string, { status: string; value: number }>(
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
