import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Task } from "../Task.ts";

// ---------------------------------------------------------------------------
// of
// ---------------------------------------------------------------------------

test(
	"Task.resolve creates a Task that resolves to the given value",
	async () => {
		const result = await Task.resolve(42)();
		expect(result).toBe(42);
	},
);

// ---------------------------------------------------------------------------
// from
// ---------------------------------------------------------------------------

test(
	"Task.from creates a Task from a function returning a Promise",
	async () => {
		const task = Task.from(() => Promise.resolve(99));
		const result = await task();
		expect(result).toBe(99);
	},
);

test("Task.from is lazy - does not execute until called", async () => {
	let executed = false;
	const task = Task.from(() => {
		executed = true;
		return Promise.resolve(1);
	});
	expect(executed).toBe(false);
	await task();
	expect(executed).toBe(true);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Task.map transforms the resolved value", async () => {
	const result = await pipe(
		Task.resolve(5),
		Task.map((n: number) => n * 2),
	)();
	expect(result).toBe(10);
});

test("Task.map can change the type", async () => {
	const result = await pipe(
		Task.resolve(42),
		Task.map((n: number) => `num: ${n}`),
	)();
	expect(result).toBe("num: 42");
});

test("Task.map chains multiple transformations", async () => {
	const result = await pipe(
		Task.resolve(2),
		Task.map((n: number) => n + 3),
		Task.map((n: number) => n * 10),
	)();
	expect(result).toBe(50);
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Task.chain sequences async computations", async () => {
	const double = (n: number): Task<number> => Task.resolve(n * 2);
	const result = await pipe(Task.resolve(5), Task.chain(double))();
	expect(result).toBe(10);
});

test(
	"Task.chain can create new Tasks based on previous result",
	async () => {
		const fetchById = (id: number): Task<string> => Task.resolve(`item-${id}`);

		const result = await pipe(Task.resolve(42), Task.chain(fetchById))();
		expect(result).toBe("item-42");
	},
);

test("Task.chain composes multiple async steps", async () => {
	const result = await pipe(
		Task.resolve(1),
		Task.chain((n: number) => Task.resolve(n + 1)),
		Task.chain((n: number) => Task.resolve(n * 10)),
	)();
	expect(result).toBe(20);
});

// ---------------------------------------------------------------------------
// ap (value first, function second)
// ---------------------------------------------------------------------------

test("Task.ap applies a Task function to a Task value", async () => {
	const add = (a: number) => (b: number) => a + b;
	const result = await pipe(
		Task.resolve(add),
		Task.ap(Task.resolve(5)),
		Task.ap(Task.resolve(3)),
	)();
	expect(result).toBe(8);
});

test("Task.ap runs Tasks in parallel", async () => {
	const start = Date.now();
	const slowValue = Task.from(
		() => new Promise<number>((resolve) => setTimeout(() => resolve(10), 50)),
	);
	const slowFn = Task.from(
		() => new Promise<(n: number) => number>((resolve) => setTimeout(() => resolve((n: number) => n * 2), 50)),
	);

	const result = await pipe(slowFn, Task.ap(slowValue))();
	const elapsed = Date.now() - start;

	expect(result).toBe(20);
	// Both should run in parallel, so total time should be around 50ms, not 100ms
	// Using 90ms as a generous upper bound
	expect(elapsed).toBeLessThan(90);
});

test("Task.ap with single argument function", async () => {
	const double = (n: number) => n * 2;
	const result = await pipe(Task.resolve(double), Task.ap(Task.resolve(7)))();
	expect(result).toBe(14);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test(
	"Task.tap executes side effect and returns original value",
	async () => {
		let sideEffect = 0;
		const result = await pipe(
			Task.resolve(5),
			Task.tap((n: number) => {
				sideEffect = n;
			}),
		)();
		expect(sideEffect).toBe(5);
		expect(result).toBe(5);
	},
);

test("Task.tap does not alter the resolved value", async () => {
	const result = await pipe(
		Task.resolve("hello"),
		Task.tap(() => {
			// side effect that doesn't affect the value
		}),
		Task.map((s: string) => s.toUpperCase()),
	)();
	expect(result).toBe("HELLO");
});

// ---------------------------------------------------------------------------
// all
// ---------------------------------------------------------------------------

test(
	"Task.all runs multiple Tasks in parallel and collects results",
	async () => {
		const result = await Task.all(
			[
				Task.resolve(1),
				Task.resolve("two"),
				Task.resolve(true),
			] as const,
		)();
		expect(result).toEqual([1, "two", true]);
	},
);

test("Task.all with empty array returns empty array", async () => {
	const result = await Task.all([] as const)();
	expect(result).toEqual([]);
});

test(
	"Task.all preserves order regardless of completion time",
	async () => {
		const slow = Task.from(
			() => new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 50)),
		);
		const fast = Task.from(
			() => new Promise<string>((resolve) => setTimeout(() => resolve("fast"), 10)),
		);

		const result = await Task.all([slow, fast] as const)();
		expect(result).toEqual(["slow", "fast"]);
	},
);

test("Task.all runs Tasks in parallel (not sequentially)", async () => {
	const start = Date.now();
	const t1 = Task.from(
		() => new Promise<number>((resolve) => setTimeout(() => resolve(1), 50)),
	);
	const t2 = Task.from(
		() => new Promise<number>((resolve) => setTimeout(() => resolve(2), 50)),
	);
	const t3 = Task.from(
		() => new Promise<number>((resolve) => setTimeout(() => resolve(3), 50)),
	);

	const result = await Task.all([t1, t2, t3] as const)();
	const elapsed = Date.now() - start;

	expect(result).toEqual([1, 2, 3]);
	// All 3 should run in ~50ms parallel, not 150ms sequential
	expect(elapsed).toBeLessThan(100);
});

// ---------------------------------------------------------------------------
// delay
// ---------------------------------------------------------------------------

test("Task.delay delays the execution of a Task", async () => {
	const start = Date.now();
	const result = await pipe(Task.resolve(42), Task.delay(50))();
	const elapsed = Date.now() - start;

	expect(result).toBe(42);
	expect(elapsed).toBeGreaterThanOrEqual(40); // allow small timing variance
});

test("Task.delay with 0ms behaves like setTimeout(fn, 0)", async () => {
	const result = await pipe(Task.resolve("instant"), Task.delay(0))();
	expect(result).toBe("instant");
});

test("Task.delay preserves the Task value after delay", async () => {
	const result = await pipe(
		Task.resolve(5),
		Task.delay(30),
		Task.map((n: number) => n * 2),
	)();
	expect(result).toBe(10);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Task composes well in a pipe chain", async () => {
	const result = await pipe(
		Task.resolve(5),
		Task.map((n: number) => n * 2),
		Task.chain((n: number) => Task.resolve(n + 1)),
		Task.map((n: number) => `result: ${n}`),
	)();
	expect(result).toBe("result: 11");
});

test("Task is lazy and only executes when invoked", () => {
	let executed = false;
	const _task = pipe(
		Task.resolve(1),
		Task.map((_n: number) => {
			executed = true;
			return _n;
		}),
	);
	// Task not invoked yet
	expect(executed).toBe(false);
	// Clean up: don't actually invoke it
});

// ---------------------------------------------------------------------------
// race
// ---------------------------------------------------------------------------

test("Task.race resolves with the fastest Task", async () => {
	const fast = Task.from<string>(
		() => new Promise((r) => setTimeout(() => r("fast"), 10)),
	);
	const slow = Task.from<string>(
		() => new Promise((r) => setTimeout(() => r("slow"), 100)),
	);
	const result = await Task.race([fast, slow])();
	expect(result).toBe("fast");
});

test("Task.race resolves immediately when a resolved Task is included", async () => {
	const immediate = Task.resolve("immediate");
	const slow = Task.from<string>(
		() => new Promise((r) => setTimeout(() => r("slow"), 100)),
	);
	const result = await Task.race([slow, immediate])();
	expect(result).toBe("immediate");
});

test("Task.race with a single Task resolves to its value", async () => {
	const result = await Task.race([Task.resolve(42)])();
	expect(result).toBe(42);
});

test("Task.race starts all Tasks immediately (parallel, not sequential)", async () => {
	const start = Date.now();
	const t1 = Task.from<number>(
		() => new Promise((r) => setTimeout(() => r(1), 50)),
	);
	const t2 = Task.from<number>(
		() => new Promise((r) => setTimeout(() => r(2), 10)),
	);
	const result = await Task.race([t1, t2])();
	const elapsed = Date.now() - start;
	expect(result).toBe(2);
	expect(elapsed).toBeLessThan(45); // would be ~50ms if sequential
});

// ---------------------------------------------------------------------------
// sequential
// ---------------------------------------------------------------------------

test("Task.sequential runs Tasks in order and collects results", async () => {
	const result = await Task.sequential([
		Task.resolve(1),
		Task.resolve(2),
		Task.resolve(3),
	])();
	expect(result).toEqual([1, 2, 3]);
});

test("Task.sequential with empty array returns empty array", async () => {
	const result = await Task.sequential([])();
	expect(result).toEqual([]);
});

test("Task.sequential executes each Task only after the previous resolves", async () => {
	const order: number[] = [];
	const makeTask = (n: number, ms: number) =>
		Task.from<number>(() =>
			new Promise((r) =>
				setTimeout(() => {
					order.push(n);
					r(n);
				}, ms)
			)
		);

	await Task.sequential([
		makeTask(1, 30),
		makeTask(2, 10),
		makeTask(3, 20),
	])();
	expect(order).toEqual([1, 2, 3]);
});

test("Task.sequential with a single Task returns single-element array", async () => {
	const result = await Task.sequential([Task.resolve(99)])();
	expect(result).toEqual([99]);
});

// ---------------------------------------------------------------------------
// timeout
// ---------------------------------------------------------------------------

test(
	"Task.timeout returns Ok when task resolves before timeout",
	async () => {
		const result = await pipe(
			Task.resolve(42),
			Task.timeout(100, () => "timed out"),
		)();
		expect(result).toEqual({ kind: "Ok", value: 42 });
	},
);

test("Task.timeout returns Err when task exceeds timeout", async () => {
	const slow = Task.from<number>(
		() => new Promise((r) => setTimeout(() => r(42), 200)),
	);
	const result = await pipe(
		slow,
		Task.timeout(10, () => "timed out"),
	)();
	expect(result).toEqual({ kind: "Error", error: "timed out" });
});

test("Task.timeout uses the onTimeout return value as the error", async () => {
	const slow = Task.from<number>(
		() => new Promise((r) => setTimeout(() => r(42), 200)),
	);
	const error = new Error("request timed out");
	const result = await pipe(
		slow,
		Task.timeout(10, () => error),
	)();
	expect(result).toEqual({ kind: "Error", error });
});

// ---------------------------------------------------------------------------
// repeat
// ---------------------------------------------------------------------------

test("Task.repeat runs the task the given number of times", async () => {
	let calls = 0;
	const task = Task.from(() => {
		calls++;
		return Promise.resolve(calls);
	});
	const result = await pipe(task, Task.repeat({ times: 3 }))();
	expect(result).toEqual([1, 2, 3]);
	expect(calls).toBe(3);
});

test(
	"Task.repeat with times: 1 runs once and returns single-element array",
	async () => {
		const result = await pipe(Task.resolve(42), Task.repeat({ times: 1 }))();
		expect(result).toEqual([42]);
	},
);

test(
	"Task.repeat with times: 0 returns empty array without running",
	async () => {
		let calls = 0;
		const task = Task.from(() => {
			calls++;
			return Promise.resolve(42);
		});
		const result = await pipe(task, Task.repeat({ times: 0 }))();
		expect(result).toEqual([]);
		expect(calls).toBe(0);
	},
);

test("Task.repeat collects results in order", async () => {
	let n = 0;
	const task = Task.from(() => Promise.resolve(n++));
	const result = await pipe(task, Task.repeat({ times: 4 }))();
	expect(result).toEqual([0, 1, 2, 3]);
});

test(
	"Task.repeat inserts delay between runs but not after the last",
	async () => {
		const start = Date.now();
		await pipe(Task.resolve(1), Task.repeat({ times: 3, delay: 30 }))();
		const elapsed = Date.now() - start;
		// 3 runs = 2 delays = ~60ms; allow generous bounds
		expect(elapsed).toBeGreaterThanOrEqual(50);
		expect(elapsed).toBeLessThan(120);
	},
);

// ---------------------------------------------------------------------------
// repeatUntil
// ---------------------------------------------------------------------------

test(
	"Task.repeatUntil returns immediately when predicate holds on first run",
	async () => {
		let calls = 0;
		const task = Task.from(() => {
			calls++;
			return Promise.resolve(42);
		});
		const result = await pipe(
			task,
			Task.repeatUntil({ when: (n) => n === 42 }),
		)();
		expect(result).toBe(42);
		expect(calls).toBe(1);
	},
);

test("Task.repeatUntil keeps running until predicate holds", async () => {
	let calls = 0;
	const task = Task.from(() => {
		calls++;
		return Promise.resolve(calls);
	});
	const result = await pipe(task, Task.repeatUntil({ when: (n) => n === 3 }))();
	expect(result).toBe(3);
	expect(calls).toBe(3);
});

test(
	"Task.repeatUntil returns the value that satisfied the predicate",
	async () => {
		const values = ["a", "b", "stop", "c"];
		let i = 0;
		const task = Task.from(() => Promise.resolve(values[i++]));
		const result = await pipe(
			task,
			Task.repeatUntil({ when: (s) => s === "stop" }),
		)();
		expect(result).toBe("stop");
	},
);

test("Task.repeatUntil inserts delay between runs", async () => {
	let calls = 0;
	const task = Task.from(() => {
		calls++;
		return Promise.resolve(calls);
	});
	const start = Date.now();
	await pipe(task, Task.repeatUntil({ when: (n) => n === 3, delay: 30 }))();
	const elapsed = Date.now() - start;
	// 3 runs = 2 delays = ~60ms
	expect(elapsed).toBeGreaterThanOrEqual(50);
	expect(elapsed).toBeLessThan(120);
});
