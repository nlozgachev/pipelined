import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../../Types/Duration.ts";
import { Deferred } from "../Deferred.ts";
import { Task } from "../Task.ts";

// ---------------------------------------------------------------------------
// of
// ---------------------------------------------------------------------------

test("task.resolve creates a Task that resolves to the given value", async () => {
	const result = await Task.resolve(42)();
	expect(result).toBe(42);
});

// ---------------------------------------------------------------------------
// from
// ---------------------------------------------------------------------------

test("task.from creates a Task from a function returning a Promise", async () => {
	const task = Task.from(() => Promise.resolve(99));
	const result = await task();
	expect(result).toBe(99);
});

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
	const result = await pipe(Task.resolve(5), Task.map((n: number) => n * 2))();
	expect(result).toBe(10);
});

test("Task.map can change the type", async () => {
	const result = await pipe(Task.resolve(42), Task.map((n: number) => `num: ${n}`))();
	expect(result).toBe("num: 42");
});

test("Task.map chains multiple transformations", async () => {
	const result = await pipe(Task.resolve(2), Task.map((n: number) => n + 3), Task.map((n: number) => n * 10))();
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

test("task.chain can create new Tasks based on previous result", async () => {
	const fetchById = (id: number): Task<string> => Task.resolve(`item-${id}`);

	const result = await pipe(Task.resolve(42), Task.chain(fetchById))();
	expect(result).toBe("item-42");
});

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
	const result = await pipe(Task.resolve(add), Task.ap(Task.resolve(5)), Task.ap(Task.resolve(3)))();
	expect(result).toBe(8);
});

test("Task.ap runs Tasks in parallel", async () => {
	const start = Date.now();
	const slowValue = Task.from(() => new Promise<number>((resolve) => setTimeout(() => resolve(10), 50)));
	const slowFn = Task.from(() =>
		new Promise<(n: number) => number>((resolve) => setTimeout(() => resolve((n: number) => n * 2), 50))
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

test("task.tap executes side effect and returns original value", async () => {
	let sideEffect = 0;
	const result = await pipe(
		Task.resolve(5),
		Task.tap((n: number) => {
			sideEffect = n;
		}),
	)();
	expect(sideEffect).toBe(5);
	expect(result).toBe(5);
});

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

test("task.all runs multiple Tasks in parallel and collects results", async () => {
	const result = await Task.all([Task.resolve(1), Task.resolve("two"), Task.resolve(true)] as const)();
	expect(result).toStrictEqual([1, "two", true]);
});

test("Task.all with empty array returns empty array", async () => {
	const result = await Task.all([] as const)();
	expect(result).toStrictEqual([]);
});

test("task.all preserves order regardless of completion time", async () => {
	const slow = Task.from(() => new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 50)));
	const fast = Task.from(() => new Promise<string>((resolve) => setTimeout(() => resolve("fast"), 10)));

	const result = await Task.all([slow, fast] as const)();
	expect(result).toStrictEqual(["slow", "fast"]);
});

test("Task.all runs Tasks in parallel (not sequentially)", async () => {
	const start = Date.now();
	const t1 = Task.from(() => new Promise<number>((resolve) => setTimeout(() => resolve(1), 50)));
	const t2 = Task.from(() => new Promise<number>((resolve) => setTimeout(() => resolve(2), 50)));
	const t3 = Task.from(() => new Promise<number>((resolve) => setTimeout(() => resolve(3), 50)));

	const result = await Task.all([t1, t2, t3] as const)();
	const elapsed = Date.now() - start;

	expect(result).toStrictEqual([1, 2, 3]);
	// All 3 should run in ~50ms parallel, not 150ms sequential
	expect(elapsed).toBeLessThan(100);
});

// ---------------------------------------------------------------------------
// delay
// ---------------------------------------------------------------------------

test("Task.delay delays the execution of a Task", async () => {
	const start = Date.now();
	const result = await pipe(Task.resolve(42), Task.delay(Duration.milliseconds(50)))();
	const elapsed = Date.now() - start;

	expect(result).toBe(42);
	expect(elapsed).toBeGreaterThanOrEqual(40); // allow small timing variance
});

test("Task.delay with 0ms behaves like setTimeout(fn, 0)", async () => {
	const result = await pipe(Task.resolve("instant"), Task.delay(Duration.milliseconds(0)))();
	expect(result).toBe("instant");
});

test("Task.delay preserves the Task value after delay", async () => {
	const result = await pipe(Task.resolve(5), Task.delay(Duration.milliseconds(30)), Task.map((n: number) => n * 2))();
	expect(result).toBe(10);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("task composes well in a pipe chain", async () => {
	const result = await pipe(
		Task.resolve(5),
		Task.map((n: number) => n * 2),
		Task.chain((n: number) => Task.resolve(n + 1)),
		Task.map((n: number) => `result: ${n}`),
	)();
	expect(result).toBe("result: 11");
});

test("task is lazy and only executes when invoked", () => {
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
	const fast = Task.from<string>(() => new Promise((r) => setTimeout(() => r("fast"), 10)));
	const slow = Task.from<string>(() => new Promise((r) => setTimeout(() => r("slow"), 100)));
	const result = await Task.race([fast, slow])();
	expect(result).toBe("fast");
});

test("Task.race resolves immediately when a resolved Task is included", async () => {
	const immediate = Task.resolve("immediate");
	const slow = Task.from<string>(() => new Promise((r) => setTimeout(() => r("slow"), 100)));
	const result = await Task.race([slow, immediate])();
	expect(result).toBe("immediate");
});

test("Task.race with a single Task resolves to its value", async () => {
	const result = await Task.race([Task.resolve(42)])();
	expect(result).toBe(42);
});

test("Task.race starts all Tasks immediately (parallel, not sequential)", async () => {
	const start = Date.now();
	const t1 = Task.from<number>(() => new Promise((r) => setTimeout(() => r(1), 50)));
	const t2 = Task.from<number>(() => new Promise((r) => setTimeout(() => r(2), 10)));
	const result = await Task.race([t1, t2])();
	const elapsed = Date.now() - start;
	expect(result).toBe(2);
	expect(elapsed).toBeLessThan(45); // would be ~50ms if sequential
});

test("Task.race with empty array returns a Task that never resolves", () => {
	const task = Task.race<number>([]);
	expectTypeOf(task).toBeFunction();
	// Invoke to cover the never-resolving branch; it is intentionally not awaited.
	const deferred = task();
	expect(deferred).toBeDefined();
});

test("Task.race aborts all subtasks when an already-aborted outer signal is passed", async () => {
	const controller = new AbortController();
	controller.abort();
	const seen: AbortSignal[] = [];
	const makeTask = (n: number) =>
		Task.from<number>((signal) => {
			if (signal) { seen.push(signal); }
			return new Promise<number>((r) => {
				const id = setTimeout(() => r(n), 500);
				signal?.addEventListener("abort", () => {
					clearTimeout(id);
					r(n);
				});
			});
		});
	const result = await Task.race([makeTask(1), makeTask(2)])(controller.signal);
	expect([1, 2]).toContain(result);
	expect(seen).toHaveLength(2);
	expect(seen.every((s) => s.aborted)).toBe(true);
});

test("Task.race aborts remaining subtasks when the outer signal aborts mid-flight", async () => {
	const controller = new AbortController();
	const seen: AbortSignal[] = [];
	const makeTask = (n: number) =>
		Task.from<number>((signal) => {
			if (signal) { seen.push(signal); }
			return new Promise<number>((r) => {
				const id = setTimeout(() => r(n), 500);
				signal?.addEventListener("abort", () => {
					clearTimeout(id);
					r(n);
				});
			});
		});
	const running = Task.race([makeTask(1), makeTask(2)])(controller.signal);
	setTimeout(() => controller.abort(), 10);
	const result = await running;
	expect([1, 2]).toContain(result);
	expect(seen.every((s) => s.aborted)).toBe(true);
});

// ---------------------------------------------------------------------------
// sequential
// ---------------------------------------------------------------------------

test("Task.sequential runs Tasks in order and collects results", async () => {
	const result = await Task.sequential([Task.resolve(1), Task.resolve(2), Task.resolve(3)])();
	expect(result).toStrictEqual([1, 2, 3]);
});

test("Task.sequential with empty array returns empty array", async () => {
	const result = await Task.sequential([])();
	expect(result).toStrictEqual([]);
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

	await Task.sequential([makeTask(1, 30), makeTask(2, 10), makeTask(3, 20)])();
	expect(order).toStrictEqual([1, 2, 3]);
});

test("Task.sequential with a single Task returns single-element array", async () => {
	const result = await Task.sequential([Task.resolve(99)])();
	expect(result).toStrictEqual([99]);
});

test("Task.sequential short-circuits early when the signal is aborted", async () => {
	const order: number[] = [];
	const controller = new AbortController();

	const makeTask = (n: number) =>
		Task.from<number>(() => {
			order.push(n);
			if (n === 2) {
				controller.abort();
			}
			return Promise.resolve(n);
		});

	const result = await Task.sequential([makeTask(1), makeTask(2), makeTask(3)])(controller.signal);

	expect(order).toStrictEqual([1, 2]);
	expect(result).toStrictEqual([1, 2]);
});

// ---------------------------------------------------------------------------
// timeout
// ---------------------------------------------------------------------------

test("task.timeout returns Ok when task resolves before timeout", async () => {
	const result = await pipe(Task.resolve(42), Task.timeout(Duration.milliseconds(100), () => "timed out"))();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("Task.timeout returns Err when task exceeds timeout", async () => {
	const slow = Task.from<number>(() => new Promise((r) => setTimeout(() => r(42), 200)));
	const result = await pipe(slow, Task.timeout(Duration.milliseconds(10), () => "timed out"))();
	expect(result).toStrictEqual({ kind: "Err", error: "timed out" });
});

test("Task.timeout uses the onTimeout return value as the error", async () => {
	const slow = Task.from<number>(() => new Promise((r) => setTimeout(() => r(42), 200)));
	const error = new Error("request timed out");
	const result = await pipe(slow, Task.timeout(Duration.milliseconds(10), () => error))();
	expect(result).toStrictEqual({ kind: "Err", error });
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
	expect(result).toStrictEqual([1, 2, 3]);
	expect(calls).toBe(3);
});

test("task.repeat with times: 1 runs once and returns single-element array", async () => {
	const result = await pipe(Task.resolve(42), Task.repeat({ times: 1 }))();
	expect(result).toStrictEqual([42]);
});

test("task.repeat with times: 0 returns empty array without running", async () => {
	let calls = 0;
	const task = Task.from(() => {
		calls++;
		return Promise.resolve(42);
	});
	const result = await pipe(task, Task.repeat({ times: 0 }))();
	expect(result).toStrictEqual([]);
	expect(calls).toBe(0);
});

test("Task.repeat collects results in order", async () => {
	let n = 0;
	const task = Task.from(() => Promise.resolve(n++));
	const result = await pipe(task, Task.repeat({ times: 4 }))();
	expect(result).toStrictEqual([0, 1, 2, 3]);
});

test("task.repeat inserts delay between runs but not after the last", async () => {
	const start = Date.now();
	await pipe(Task.resolve(1), Task.repeat({ times: 3, delay: Duration.milliseconds(30) }))();
	const elapsed = Date.now() - start;
	// 3 runs = 2 delays = ~60ms; allow generous bounds
	expect(elapsed).toBeGreaterThanOrEqual(50);
	expect(elapsed).toBeLessThan(120);
});

// ---------------------------------------------------------------------------
// repeatUntil
// ---------------------------------------------------------------------------

test("task.repeatUntil returns immediately when predicate holds on first run", async () => {
	let calls = 0;
	const task = Task.from(() => {
		calls++;
		return Promise.resolve(42);
	});
	const result = await pipe(task, Task.repeatUntil({ when: (n) => n === 42 }))();
	expect(result).toBe(42);
	expect(calls).toBe(1);
});

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

test("task.repeatUntil returns the value that satisfied the predicate", async () => {
	const values = ["a", "b", "stop", "c"];
	let i = 0;
	const task = Task.from(() => Promise.resolve(values[i++]));
	const result = await pipe(task, Task.repeatUntil({ when: (s) => s === "stop" }))();
	expect(result).toBe("stop");
});

test("Task.repeatUntil inserts delay between runs", async () => {
	let calls = 0;
	const task = Task.from(() => {
		calls++;
		return Promise.resolve(calls);
	});
	const start = Date.now();
	await pipe(task, Task.repeatUntil({ when: (n) => n === 3, delay: Duration.milliseconds(30) }))();
	const elapsed = Date.now() - start;
	// 3 runs = 2 delays = ~60ms
	expect(elapsed).toBeGreaterThanOrEqual(50);
	expect(elapsed).toBeLessThan(120);
});

test("Task.repeatUntil stops after maxAttempts even if predicate never holds", async () => {
	let count = 0;
	const task = Task.fromSync(() => ++count);
	const result = await pipe(task, Task.repeatUntil({ when: (n) => n > 100, maxAttempts: 3 }))();
	expect(result).toBe(3);
	expect(count).toBe(3);
});

test("Task.repeatUntil stops when the signal aborts during a run", async () => {
	const controller = new AbortController();
	let count = 0;
	const task = Task.from(() => {
		count++;
		if (count === 2) { controller.abort(); }
		return Promise.resolve(count);
	});
	const result = await pipe(task, Task.repeatUntil({ when: (n) => n > 100 }))(controller.signal);
	expect(result).toBe(2);
	expect(count).toBe(2);
});

// ---------------------------------------------------------------------------
// AbortSignal threading
// ---------------------------------------------------------------------------

test("Task.from receives the AbortSignal from the call site", async () => {
	const controller = new AbortController();
	let receivedSignal: AbortSignal | undefined;
	const task = Task.from((signal) => {
		receivedSignal = signal;
		return Promise.resolve(1);
	});
	await task(controller.signal);
	expect(receivedSignal).toBe(controller.signal);
});

test("Task.from called without signal receives undefined", async () => {
	let receivedSignal: AbortSignal | undefined;
	const task = Task.from((signal) => {
		receivedSignal = signal;
		return Promise.resolve(1);
	});
	await task();
	expect(receivedSignal).toBeUndefined();
});

test("Task.map threads signal to the inner task", async () => {
	const controller = new AbortController();
	let receivedSignal: AbortSignal | undefined;
	const base = Task.from((signal) => {
		receivedSignal = signal;
		return Promise.resolve(1);
	});
	await pipe(base, Task.map((n: number) => n * 2))(controller.signal);
	expect(receivedSignal).toBe(controller.signal);
});

test("Task.chain threads signal to both tasks", async () => {
	const controller = new AbortController();
	const signals: Array<AbortSignal | undefined> = [];
	const t1 = Task.from((signal) => {
		signals.push(signal);
		return Promise.resolve(1);
	});
	const t2 = (n: number) =>
		Task.from((signal) => {
			signals.push(signal);
			return Promise.resolve(n + 1);
		});
	await pipe(t1, Task.chain(t2))(controller.signal);
	expect(signals).toStrictEqual([controller.signal, controller.signal]);
});

// ---------------------------------------------------------------------------
// timeout — inner task receives AbortSignal
// ---------------------------------------------------------------------------

test("Task.timeout aborts the inner task when the deadline fires", async () => {
	let innerSignal: AbortSignal | undefined;
	const slow = Task.from((signal) => {
		innerSignal = signal;
		return new Promise<number>((r) => setTimeout(() => r(42), 200));
	});
	await pipe(slow, Task.timeout(Duration.milliseconds(10), () => "timed out"))();
	expect(innerSignal?.aborted).toBe(true);
});

test("Task.timeout wires the outer signal to the inner task", async () => {
	const outerController = new AbortController();
	let innerSignal: AbortSignal | undefined;
	const slow = Task.from((signal) => {
		innerSignal = signal;
		return new Promise<number>((r) => setTimeout(() => r(42), 200));
	});
	const composed = pipe(slow, Task.timeout(Duration.milliseconds(500), () => "timed out"));
	const running = composed(outerController.signal);
	// Abort via the outer signal before the deadline
	outerController.abort();
	await running;
	expect(innerSignal?.aborted).toBe(true);
});

// ---------------------------------------------------------------------------
// abortable
// ---------------------------------------------------------------------------

test("Task.abortable returns a task and an abort function", () => {
	const { task, abort } = Task.abortable(() => Promise.resolve(42));
	expectTypeOf(task).toBeFunction();
	expectTypeOf(abort).toBeFunction();
});

test("Task.abortable task resolves normally when not aborted", async () => {
	const { task } = Task.abortable(() => Promise.resolve(42));
	const result = await task();
	expect(result).toBe(42);
});

test("Task.abortable passes the controller signal to the factory", async () => {
	let receivedSignal: AbortSignal | undefined;
	const { task } = Task.abortable((signal) => {
		receivedSignal = signal;
		return Promise.resolve(1);
	});
	await task();
	expect(receivedSignal).toBeInstanceOf(AbortSignal);
});

// oxlint-disable-next-line require-await
test("Task.abortable abort() aborts the signal passed to the factory", async () => {
	let capturedSignal: AbortSignal | undefined;
	const { task, abort } = Task.abortable((signal) => {
		capturedSignal = signal;
		return new Promise<number>((r) => setTimeout(() => r(1), 100));
	});
	task(); // start but don't await
	abort();
	expect(capturedSignal?.aborted).toBe(true);
});

// oxlint-disable-next-line require-await
test("Task.abortable wires outer signal to the internal controller", async () => {
	const outerController = new AbortController();
	let capturedSignal: AbortSignal | undefined;
	const { task } = Task.abortable((signal) => {
		capturedSignal = signal;
		return new Promise<number>((r) => setTimeout(() => r(1), 100));
	});
	task(outerController.signal); // start but don't await
	outerController.abort();
	expect(capturedSignal?.aborted).toBe(true);
});

test("Task.abortable aborts the inner controller immediately when outer signal is already aborted", () => {
	const outerController = new AbortController();
	outerController.abort();
	let capturedSignal: AbortSignal | undefined;
	const { task } = Task.abortable((signal) => {
		capturedSignal = signal;
		return Promise.resolve(1);
	});
	task(outerController.signal);
	expect(capturedSignal?.aborted).toBe(true);
});

test("Task.abortable abort() cancels current call but next call starts fresh", async () => {
	let callCount = 0;
	const { task, abort } = Task.abortable((signal) => {
		callCount++;
		return new Promise<number>((resolve) => {
			const id = setTimeout(() => resolve(callCount), 100);
			signal.addEventListener("abort", () => clearTimeout(id));
		});
	});

	// Start first call and abort it immediately
	task(); // not awaited — fires but gets aborted
	abort();

	// Second call should work normally
	const second = await task();
	expect(second).toBe(2);
});

test("Task.abortable second call cancels first in-flight call", async () => {
	let firstSignalAborted = false;
	const { task } = Task.abortable((signal) => {
		signal.addEventListener("abort", () => {
			firstSignalAborted = true;
		});
		return new Promise<number>((resolve) => setTimeout(() => resolve(1), 100));
	});

	task(); // first call, not awaited
	await task(); // second call cancels first

	expect(firstSignalAborted).toBe(true);
});

test("Task.timeout removes the outer signal listener after normal completion", async () => {
	const outerController = new AbortController();
	let innerSignal: AbortSignal | undefined;
	const fast = Task.from((signal) => {
		innerSignal = signal;
		return Promise.resolve(42);
	});
	await pipe(fast, Task.timeout(Duration.milliseconds(500), () => "timed out"))(outerController.signal);
	// Task completed before the deadline — listener should have been removed
	outerController.abort();
	expect(innerSignal?.aborted).toBe(false);
});

// ---------------------------------------------------------------------------
// fromSync
// ---------------------------------------------------------------------------

test("Task.fromSync does not call f until the task is called", async () => {
	let called = false;
	const t = Task.fromSync(() => {
		called = true;
		return 42;
	});
	expect(called).toBe(false);
	await t();
	expect(called).toBe(true);
});

test("Task.fromSync resolves to the return value of f", async () => {
	const t = Task.fromSync(() => "hello");
	await expect(t()).resolves.toBe("hello");
});

test("task.fromSync composes with Task.map in pipe", async () => {
	const result = await pipe(Task.fromSync(() => 5), Task.map((n) => n * 2))();
	expect(result).toBe(10);
});

test("Task.fromSync re-evaluates f on each call", async () => {
	let count = 0;
	const t = Task.fromSync(() => ++count);
	await expect(t()).resolves.toBe(1);
	await expect(t()).resolves.toBe(2);
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

test("Task.run executes the task and resolves with the value", async () => {
	const task: Task<number> = () => Deferred.fromPromise(Promise.resolve(42));
	await expect(pipe(task, Task.run())).resolves.toBe(42);
});

test("Task.run passes the signal to the task", async () => {
	const controller = new AbortController();
	let receivedSignal: AbortSignal | undefined;
	const task: Task<void> = (signal) => {
		receivedSignal = signal;
		return Deferred.fromPromise(Promise.resolve());
	};
	await pipe(task, Task.run(controller.signal));
	expect(receivedSignal).toBe(controller.signal);
});

test("Task.run works without a signal", async () => {
	const task: Task<string> = () => Deferred.fromPromise(Promise.resolve("ok"));
	await expect(pipe(task, Task.run())).resolves.toBe("ok");
});

// ---------------------------------------------------------------------------
// AbortSignal responsiveness for delay, repeat, repeatUntil
// ---------------------------------------------------------------------------

test("Task.delay resolves early when the signal is aborted", async () => {
	const start = Date.now();
	const controller = new AbortController();

	const task = pipe(Task.resolve(42), Task.delay(Duration.milliseconds(500)));

	setTimeout(() => controller.abort(), 10);

	const result = await task(controller.signal);
	const elapsed = Date.now() - start;

	expect(result).toBe(42);
	expect(elapsed).toBeLessThan(100);
});

test("Task.repeat resolves early with accumulated results if aborted", async () => {
	const controller = new AbortController();
	let count = 0;
	const task = Task.from(() => {
		count++;
		return Promise.resolve(count);
	});

	const repeated = pipe(task, Task.repeat({ times: 5, delay: Duration.milliseconds(50) }));

	setTimeout(() => controller.abort(), 75);

	const result = await repeated(controller.signal);
	expect(result).toStrictEqual([1, 2]);
});

test("Task.repeatUntil resolves early with the last value if aborted", async () => {
	const controller = new AbortController();
	let count = 0;
	const task = Task.from(() => {
		count++;
		return Promise.resolve(count);
	});

	const repeated = pipe(task, Task.repeatUntil({ when: (n) => n === 5, delay: Duration.milliseconds(50) }));

	setTimeout(() => controller.abort(), 75);

	const result = await repeated(controller.signal);
	expect(result).toBe(2);
});

test("Task.delay resolves immediately when the signal is already aborted", async () => {
	const controller = new AbortController();
	controller.abort();
	const start = Date.now();
	const result = await pipe(Task.resolve(42), Task.delay(Duration.milliseconds(500)))(controller.signal);
	expect(result).toBe(42);
	expect(Date.now() - start).toBeLessThan(100);
});

test("Task.timeout aborts the inner task when the outer signal is already aborted", async () => {
	const controller = new AbortController();
	controller.abort();
	let innerSignal: AbortSignal | undefined;
	const task = Task.from((signal) => {
		innerSignal = signal;
		return Promise.resolve(42);
	});
	const result = await pipe(task, Task.timeout(Duration.milliseconds(500), () => "timed out"))(controller.signal);
	expect(innerSignal?.aborted).toBe(true);
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

// ---------------------------------------------------------------------------
// sequence
// ---------------------------------------------------------------------------

test("Task.sequence runs tasks concurrently and collects results", async () => {
	const order: number[] = [];
	const t1 = Task.from<number>(() =>
		new Promise((r) =>
			setTimeout(() => {
				order.push(1);
				r(1);
			}, 30)
		)
	);
	const t2 = Task.from<number>(() =>
		new Promise((r) =>
			setTimeout(() => {
				order.push(2);
				r(2);
			}, 10)
		)
	);
	const t3 = Task.from<number>(() =>
		new Promise((r) =>
			setTimeout(() => {
				order.push(3);
				r(3);
			}, 20)
		)
	);

	const result = await Task.sequence([t1, t2, t3])();

	// Results are in input order despite different completion times
	expect(result).toStrictEqual([1, 2, 3]);
	// Execution order proves concurrency — fastest finishes first
	expect(order).toStrictEqual([2, 3, 1]);
});

test("Task.sequence returns empty array for empty input", async () => {
	const result = await Task.sequence([])();
	expect(result).toStrictEqual([]);
});

test("Task.sequence forwards the AbortSignal to all tasks", async () => {
	const controller = new AbortController();
	const signals: Array<AbortSignal | undefined> = [];

	const makeTask = () =>
		Task.from<number>((signal) => {
			signals.push(signal);
			return Promise.resolve(1);
		});

	await Task.sequence([makeTask(), makeTask(), makeTask()])(controller.signal);

	expect(signals).toStrictEqual([controller.signal, controller.signal, controller.signal]);
});
