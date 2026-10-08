import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../../Types/Duration.ts";
import { Deferred } from "../Deferred.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Task } from "../Task.ts";
import { Validation } from "../Validation.ts";

const fromPromise = <A>(f: (signal?: AbortSignal) => Promise<A>): Task<A> => (signal?: AbortSignal) =>
	Deferred.from.Promise(f(signal));

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("make: resolves to given value", async () => {
	const result = await Task.make(42)();
	expect(result).toBe(42);
});

// ---------------------------------------------------------------------------
// from / tryCatch
// ---------------------------------------------------------------------------

test("tryCatch: does not execute until called", async () => {
	let executed = false;
	const task = Task.tryCatch(() => {
		executed = true;
		return Promise.resolve(1);
	}, { onError: () => 0 });
	expect(executed).toBe(false);
	await task();
	expect(executed).toBe(true);
});

test("tryCatch: traps rejections and resolves to fallback value", async () => {
	const taskSuccess = Task.tryCatch(() => Promise.resolve(42), { onError: () => 0 });
	const okVal = await taskSuccess();
	expectTypeOf(okVal).toEqualTypeOf<number>();
	expect(okVal).toBe(42);

	const taskFail = Task.tryCatch(() => Promise.reject(new Error("network error")), { onError: () => 0 });
	const fallbackVal = await taskFail();
	expect(fallbackVal).toBe(0);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: transforms resolved value", async () => {
	const result = await pipe(Task.make(5), Task.map((n: number) => n * 2))();
	expect(result).toBe(10);
});

test("map: can change type", async () => {
	const result = await pipe(Task.make(42), Task.map((n: number) => `num: ${n}`))();
	expect(result).toBe("num: 42");
});

test("map: chains multiple transformations", async () => {
	const result = await pipe(Task.make(2), Task.map((n: number) => n + 3), Task.map((n: number) => n * 10))();
	expect(result).toBe(50);
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("chain: sequences async computations", async () => {
	const double = (n: number): Task<number> => Task.make(n * 2);
	const result = await pipe(Task.make(5), Task.chain(double))();
	expect(result).toBe(10);
});

test("chain: creates new Tasks based on previous result", async () => {
	const fetchById = (id: number): Task<string> => Task.make(`item-${id}`);

	const result = await pipe(Task.make(42), Task.chain(fetchById))();
	expect(result).toBe("item-42");
});

test("chain: composes multiple async steps", async () => {
	const result = await pipe(
		Task.make(1),
		Task.chain((n: number) => Task.make(n + 1)),
		Task.chain((n: number) => Task.make(n * 10)),
	)();
	expect(result).toBe(20);
});

// ---------------------------------------------------------------------------
// apply (value first, function second)
// ---------------------------------------------------------------------------

test("apply: applies function to value", async () => {
	const add = (a: number) => (b: number) => a + b;
	const result = await pipe(Task.make(add), Task.apply(Task.make(5)), Task.apply(Task.make(3)))();
	expect(result).toBe(8);
});

test("apply: runs Tasks in parallel", async () => {
	const start = Date.now();
	const slowValue = fromPromise(() => new Promise<number>((resolve) => setTimeout(() => resolve(10), 50)));
	const slowFn = fromPromise(() =>
		new Promise<(n: number) => number>((resolve) => setTimeout(() => resolve((n: number) => n * 2), 50))
	);

	const result = await pipe(slowFn, Task.apply(slowValue))();
	const elapsed = Date.now() - start;

	expect(result).toBe(20);
	// Both should run in parallel, so total time should be around 50ms, not 100ms
	// Using 90ms as a generous upper bound
	expect(elapsed).toBeLessThan(90);
});

test("apply: works with single-argument function", async () => {
	const double = (n: number) => n * 2;
	const result = await pipe(Task.make(double), Task.apply(Task.make(7)))();
	expect(result).toBe(14);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("tap: executes side effect and returns original value", async () => {
	let sideEffect = 0;
	const result = await pipe(
		Task.make(5),
		Task.tap((n: number) => {
			sideEffect = n;
		}),
	)();
	expect(sideEffect).toBe(5);
	expect(result).toBe(5);
});

test("tap: does not alter resolved value", async () => {
	const result = await pipe(
		Task.make("hello"),
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

test("all: runs multiple Tasks in parallel and collects results", async () => {
	const result = await Task.all([Task.make(1), Task.make("two"), Task.make(true)] as const)();
	expect(result).toStrictEqual([1, "two", true]);
});

test("all: returns empty array for empty input", async () => {
	const result = await Task.all([] as const)();
	expect(result).toStrictEqual([]);
});

test("all: preserves order regardless of completion time", async () => {
	const slow = fromPromise(() => new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 50)));
	const fast = fromPromise(() => new Promise<string>((resolve) => setTimeout(() => resolve("fast"), 10)));

	const result = await Task.all([slow, fast] as const)();
	expect(result).toStrictEqual(["slow", "fast"]);
});

test("all: runs Tasks in parallel not sequentially", async () => {
	const start = Date.now();
	const t1 = fromPromise(() => new Promise<number>((resolve) => setTimeout(() => resolve(1), 50)));
	const t2 = fromPromise(() => new Promise<number>((resolve) => setTimeout(() => resolve(2), 50)));
	const t3 = fromPromise(() => new Promise<number>((resolve) => setTimeout(() => resolve(3), 50)));

	const result = await Task.all([t1, t2, t3] as const)();
	const elapsed = Date.now() - start;

	expect(result).toStrictEqual([1, 2, 3]);
	// All 3 should run in ~50ms parallel, not 150ms sequential
	expect(elapsed).toBeLessThan(100);
});

test("all: limits concurrent executions when concurrency option is provided", async () => {
	let active = 0;
	let maxActive = 0;

	const makeTask = (value: number) =>
		fromPromise(() =>
			new Promise<number>((resolve) => {
				active++;
				if (active > maxActive) {
					maxActive = active;
				}
				setTimeout(() => {
					active--;
					resolve(value);
				}, 20);
			})
		);

	const tasks = [makeTask(1), makeTask(2), makeTask(3), makeTask(4), makeTask(5)] as const;
	const result = await Task.all(tasks, { concurrency: 2 })();

	expect(result).toStrictEqual([1, 2, 3, 4, 5]);
	expect(maxActive).toBe(2);
});

test("all: preserves order when concurrency option is provided", async () => {
	const t1 = fromPromise(() => new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 40)));
	const t2 = fromPromise(() => new Promise<string>((resolve) => setTimeout(() => resolve("fast"), 10)));
	const t3 = fromPromise(() => new Promise<string>((resolve) => setTimeout(() => resolve("medium"), 20)));

	const result = await Task.all([t1, t2, t3] as const, { concurrency: 2 })();
	expect(result).toStrictEqual(["slow", "fast", "medium"]);
});

// ---------------------------------------------------------------------------
// delay
// ---------------------------------------------------------------------------

test("delay: delays execution of Task", async () => {
	const start = Date.now();
	const result = await pipe(Task.make(42), Task.delay(Duration.milliseconds(50)))();
	const elapsed = Date.now() - start;

	expect(result).toBe(42);
	expect(elapsed).toBeGreaterThanOrEqual(40); // allow small timing variance
});

test("delay: handles 0ms delay", async () => {
	const result = await pipe(Task.make("instant"), Task.delay(Duration.milliseconds(0)))();
	expect(result).toBe("instant");
});

test("delay: preserves value after delay", async () => {
	const result = await pipe(Task.make(5), Task.delay(Duration.milliseconds(30)), Task.map((n: number) => n * 2))();
	expect(result).toBe(10);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes well in a pipeline", async () => {
	const result = await pipe(
		Task.make(5),
		Task.map((n: number) => n * 2),
		Task.chain((n: number) => Task.make(n + 1)),
		Task.map((n: number) => `result: ${n}`),
	)();
	expect(result).toBe("result: 11");
});

test("lazy: only executes when invoked", () => {
	let executed = false;
	const _task = pipe(
		Task.make(1),
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

test("race: resolves with fastest Task", async () => {
	const fast = fromPromise<string>(() => new Promise((r) => setTimeout(() => r("fast"), 10)));
	const slow = fromPromise<string>(() => new Promise((r) => setTimeout(() => r("slow"), 100)));
	const result = await Task.race([fast, slow])();
	expect(result).toBe("fast");
});

test("race: resolves immediately when resolved Task is included", async () => {
	const immediate = Task.make("immediate");
	const slow = fromPromise<string>(() => new Promise((r) => setTimeout(() => r("slow"), 100)));
	const result = await Task.race([slow, immediate])();
	expect(result).toBe("immediate");
});

test("race: resolves to value with single Task", async () => {
	const result = await Task.race([Task.make(42)])();
	expect(result).toBe(42);
});

test("race: starts all Tasks immediately in parallel", async () => {
	const start = Date.now();
	const t1 = fromPromise<number>(() => new Promise((r) => setTimeout(() => r(1), 50)));
	const t2 = fromPromise<number>(() => new Promise((r) => setTimeout(() => r(2), 10)));
	const result = await Task.race([t1, t2])();
	const elapsed = Date.now() - start;
	expect(result).toBe(2);
	expect(elapsed).toBeLessThan(45); // would be ~50ms if sequential
});

test("race: returns Task that never resolves for empty array", () => {
	const task = Task.race<number>([]);
	expectTypeOf(task).toBeFunction();
	// Invoke to cover the never-resolving branch; it is intentionally not awaited.
	const deferred = task();
	expect(deferred).toBeDefined();
});

test("race: aborts all subtasks when already-aborted outer signal is passed", async () => {
	const controller = new AbortController();
	controller.abort();
	const seen: AbortSignal[] = [];
	const makeTask = (n: number) =>
		fromPromise<number>((signal) => {
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

test("race: aborts remaining subtasks when outer signal aborts mid-flight", async () => {
	const controller = new AbortController();
	const seen: AbortSignal[] = [];
	const makeTask = (n: number) =>
		fromPromise<number>((signal) => {
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

test("sequential: runs Tasks in order and collects results", async () => {
	const result = await Task.sequential([Task.make(1), Task.make(2), Task.make(3)])();
	expect(result).toStrictEqual([1, 2, 3]);
});

test("sequential: returns empty array for empty array", async () => {
	const result = await Task.sequential([])();
	expect(result).toStrictEqual([]);
});

test("sequential: executes each Task only after previous resolves", async () => {
	const order: number[] = [];
	const makeTask = (n: number, ms: number) =>
		fromPromise<number>(() =>
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

test("sequential: returns single-element array for single Task", async () => {
	const result = await Task.sequential([Task.make(99)])();
	expect(result).toStrictEqual([99]);
});

test("sequential: short-circuits early when signal is aborted", async () => {
	const order: number[] = [];
	const controller = new AbortController();

	const makeTask = (n: number) =>
		fromPromise<number>(() => {
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

test("timeout: returns Ok when task resolves before timeout", async () => {
	const result = await pipe(
		Task.make(42),
		Task.timeout({ duration: Duration.milliseconds(100), onTimeout: () => "timed out" }),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("timeout: returns Err when task exceeds timeout", async () => {
	const slow = fromPromise<number>(() => new Promise((r) => setTimeout(() => r(42), 200)));
	const result = await pipe(slow, Task.timeout({ duration: Duration.milliseconds(10), onTimeout: () => "timed out" }))();
	expect(result).toStrictEqual({ kind: "Err", error: "timed out" });
});

test("timeout: uses onTimeout return value as error", async () => {
	const slow = fromPromise<number>(() => new Promise((r) => setTimeout(() => r(42), 200)));
	const error = new Error("request timed out");
	const result = await pipe(slow, Task.timeout({ duration: Duration.milliseconds(10), onTimeout: () => error }))();
	expect(result).toStrictEqual({ kind: "Err", error });
});

// ---------------------------------------------------------------------------
// repeat
// ---------------------------------------------------------------------------

test("repeat: runs task the given number of times", async () => {
	let calls = 0;
	const task = fromPromise(() => {
		calls++;
		return Promise.resolve(calls);
	});
	const result = await pipe(task, Task.repeat({ times: 3 }))();
	expect(result).toStrictEqual([1, 2, 3]);
	expect(calls).toBe(3);
});

test("repeat: runs once and returns single-element array when times is 1", async () => {
	const result = await pipe(Task.make(42), Task.repeat({ times: 1 }))();
	expect(result).toStrictEqual([42]);
});

test("repeat: returns empty array without running when times is 0", async () => {
	let calls = 0;
	const task = fromPromise(() => {
		calls++;
		return Promise.resolve(42);
	});
	const result = await pipe(task, Task.repeat({ times: 0 }))();
	expect(result).toStrictEqual([]);
	expect(calls).toBe(0);
});

test("repeat: collects results in order", async () => {
	let n = 0;
	const task = fromPromise(() => Promise.resolve(n++));
	const result = await pipe(task, Task.repeat({ times: 4 }))();
	expect(result).toStrictEqual([0, 1, 2, 3]);
});

test("repeat: inserts delay between runs but not after last", async () => {
	const start = Date.now();
	await pipe(Task.make(1), Task.repeat({ times: 3, delay: Duration.milliseconds(30) }))();
	const elapsed = Date.now() - start;
	// 3 runs = 2 delays = ~60ms; allow generous bounds
	expect(elapsed).toBeGreaterThanOrEqual(50);
	expect(elapsed).toBeLessThan(120);
});

// ---------------------------------------------------------------------------
// poll
// ---------------------------------------------------------------------------

test("poll: returns immediately when predicate holds on first run", async () => {
	let calls = 0;
	const task = fromPromise(() => {
		calls++;
		return Promise.resolve(42);
	});
	const result = await pipe(task, Task.poll({ until: (n) => n === 42 }))();
	expect(result).toBe(42);
	expect(calls).toBe(1);
});

test("poll: keeps running until predicate holds", async () => {
	let calls = 0;
	const task = fromPromise(() => {
		calls++;
		return Promise.resolve(calls);
	});
	const result = await pipe(task, Task.poll({ until: (n) => n === 3 }))();
	expect(result).toBe(3);
	expect(calls).toBe(3);
});

test("poll: returns value that satisfied predicate", async () => {
	const values = ["a", "b", "stop", "c"];
	let i = 0;
	const task = fromPromise(() => Promise.resolve(values[i++]));
	const result = await pipe(task, Task.poll({ until: (s) => s === "stop" }))();
	expect(result).toBe("stop");
});

test("poll: inserts delay between runs", async () => {
	let calls = 0;
	const task = fromPromise(() => {
		calls++;
		return Promise.resolve(calls);
	});
	const start = Date.now();
	await pipe(task, Task.poll({ until: (n) => n === 3, delay: Duration.milliseconds(30) }))();
	const elapsed = Date.now() - start;
	// 3 runs = 2 delays = ~60ms
	expect(elapsed).toBeGreaterThanOrEqual(50);
	expect(elapsed).toBeLessThan(120);
});

test("poll: stops after attempts even if predicate never holds", async () => {
	let count = 0;
	const task = Task.from.sync(() => ++count);
	const result = await pipe(task, Task.poll({ until: (n) => n > 100, attempts: 3 }))();
	expect(result).toBe(3);
	expect(count).toBe(3);
});

test("poll: stops when signal aborts during a run", async () => {
	const controller = new AbortController();
	let count = 0;
	const task = fromPromise(() => {
		count++;
		if (count === 2) { controller.abort(); }
		return Promise.resolve(count);
	});
	const result = await pipe(task, Task.poll({ until: (n) => n > 100 }))(controller.signal);
	expect(result).toBe(2);
	expect(count).toBe(2);
});

// ---------------------------------------------------------------------------
// AbortSignal threading
// ---------------------------------------------------------------------------

test("from: receives AbortSignal from call site", async () => {
	const controller = new AbortController();
	let receivedSignal: AbortSignal | undefined;
	const task = fromPromise((signal) => {
		receivedSignal = signal;
		return Promise.resolve(1);
	});
	await task(controller.signal);
	expect(receivedSignal).toBe(controller.signal);
});

test("from: receives undefined when called without signal", async () => {
	let receivedSignal: AbortSignal | undefined;
	const task = fromPromise((signal) => {
		receivedSignal = signal;
		return Promise.resolve(1);
	});
	await task();
	expect(receivedSignal).toBeUndefined();
});

test("map: threads signal to inner task", async () => {
	const controller = new AbortController();
	let receivedSignal: AbortSignal | undefined;
	const base = fromPromise((signal) => {
		receivedSignal = signal;
		return Promise.resolve(1);
	});
	await pipe(base, Task.map((n: number) => n * 2))(controller.signal);
	expect(receivedSignal).toBe(controller.signal);
});

test("chain: threads signal to both tasks", async () => {
	const controller = new AbortController();
	const signals: Array<AbortSignal | undefined> = [];
	const t1 = fromPromise((signal) => {
		signals.push(signal);
		return Promise.resolve(1);
	});
	const t2 = (n: number) =>
		fromPromise((signal) => {
			signals.push(signal);
			return Promise.resolve(n + 1);
		});
	await pipe(t1, Task.chain(t2))(controller.signal);
	expect(signals).toStrictEqual([controller.signal, controller.signal]);
});

// ---------------------------------------------------------------------------
// timeout — inner task receives AbortSignal
// ---------------------------------------------------------------------------

test("timeout: aborts inner task when deadline fires", async () => {
	let innerSignal: AbortSignal | undefined;
	const slow = fromPromise((signal) => {
		innerSignal = signal;
		return new Promise<number>((r) => setTimeout(() => r(42), 200));
	});
	await pipe(slow, Task.timeout({ duration: Duration.milliseconds(10), onTimeout: () => "timed out" }))();
	expect(innerSignal?.aborted).toBe(true);
});

test("timeout: wires outer signal to inner task", async () => {
	const outerController = new AbortController();
	let innerSignal: AbortSignal | undefined;
	const slow = fromPromise((signal) => {
		innerSignal = signal;
		return new Promise<number>((r) => setTimeout(() => r(42), 200));
	});
	const composed = pipe(slow, Task.timeout({ duration: Duration.milliseconds(500), onTimeout: () => "timed out" }));
	const running = composed(outerController.signal);
	// Abort via the outer signal before the deadline
	outerController.abort();
	await running;
	expect(innerSignal?.aborted).toBe(true);
});

// ---------------------------------------------------------------------------
// abortable
// ---------------------------------------------------------------------------

test("abortable: returns a task and an abort function", () => {
	const { task, abort } = Task.abortable(() => Promise.resolve(42));
	expectTypeOf(task).toBeFunction();
	expectTypeOf(abort).toBeFunction();
});

test("abortable: resolves normally when not aborted", async () => {
	const { task } = Task.abortable(() => Promise.resolve(42));
	const result = await task();
	expect(result).toBe(42);
});

test("abortable: passes controller signal to factory", async () => {
	let receivedSignal: AbortSignal | undefined;
	const { task } = Task.abortable((signal) => {
		receivedSignal = signal;
		return Promise.resolve(1);
	});
	await task();
	expect(receivedSignal).toBeInstanceOf(AbortSignal);
});

// oxlint-disable-next-line require-await
test("abortable: abort cancels signal passed to factory", async () => {
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
test("abortable: wires outer signal to internal controller", async () => {
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

test("abortable: aborts inner controller immediately when outer signal is already aborted", () => {
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

test("abortable: abort cancels current call but next call starts fresh", async () => {
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

test("abortable: second call cancels first in-flight call", async () => {
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

test("timeout: removes outer signal listener after normal completion", async () => {
	const outerController = new AbortController();
	let innerSignal: AbortSignal | undefined;
	const fast = fromPromise((signal) => {
		innerSignal = signal;
		return Promise.resolve(42);
	});
	await pipe(fast, Task.timeout({ duration: Duration.milliseconds(500), onTimeout: () => "timed out" }))(
		outerController.signal,
	);
	// Task completed before the deadline — listener should have been removed
	outerController.abort();
	expect(innerSignal?.aborted).toBe(false);
});

// ---------------------------------------------------------------------------
// fromSync
// ---------------------------------------------------------------------------

test("from.sync: does not call f until task is called", async () => {
	let called = false;
	const t = Task.from.sync(() => {
		called = true;
		return 42;
	});
	expect(called).toBe(false);
	await t();
	expect(called).toBe(true);
});

test("from.sync: resolves to return value of f", async () => {
	const t = Task.from.sync(() => "hello");
	await expect(t()).resolves.toBe("hello");
});

test("from.sync: composes with map in pipeline", async () => {
	const result = await pipe(Task.from.sync(() => 5), Task.map((n) => n * 2))();
	expect(result).toBe(10);
});

test("from.sync: re-evaluates f on each call", async () => {
	let count = 0;
	const t = Task.from.sync(() => ++count);
	await expect(t()).resolves.toBe(1);
	await expect(t()).resolves.toBe(2);
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

test("run: executes task and resolves with value", async () => {
	const task: Task<number> = () => Deferred.from.Promise(Promise.resolve(42));
	const result = await pipe(task, Task.run());
	expect(result).toBe(42);
});

test("run: passes signal to task", async () => {
	const controller = new AbortController();
	let receivedSignal: AbortSignal | undefined;
	const task: Task<void> = (signal) => {
		receivedSignal = signal;
		return Deferred.from.Promise(Promise.resolve());
	};
	await pipe(task, Task.run(controller.signal));
	expect(receivedSignal).toBe(controller.signal);
});

test("run: works without signal", async () => {
	const task: Task<string> = () => Deferred.from.Promise(Promise.resolve("ok"));
	const result = await pipe(task, Task.run());
	expect(result).toBe("ok");
});

// ---------------------------------------------------------------------------
// AbortSignal responsiveness for delay, repeat, poll
// ---------------------------------------------------------------------------

test("delay: resolves early when signal is aborted", async () => {
	const start = Date.now();
	const controller = new AbortController();

	const task = pipe(Task.make(42), Task.delay(Duration.milliseconds(500)));

	setTimeout(() => controller.abort(), 10);

	const result = await task(controller.signal);
	const elapsed = Date.now() - start;

	expect(result).toBe(42);
	expect(elapsed).toBeLessThan(100);
});

test("repeat: resolves early with accumulated results if aborted", async () => {
	const controller = new AbortController();
	let count = 0;
	const task = fromPromise(() => {
		count++;
		return Promise.resolve(count);
	});

	const repeated = pipe(task, Task.repeat({ times: 5, delay: Duration.milliseconds(50) }));

	setTimeout(() => controller.abort(), 75);

	const result = await repeated(controller.signal);
	expect(result).toStrictEqual([1, 2]);
});

test("poll: resolves early with last value if aborted", async () => {
	const controller = new AbortController();
	let count = 0;
	const task = fromPromise(() => {
		count++;
		return Promise.resolve(count);
	});

	const repeated = pipe(task, Task.poll({ until: (n) => n === 5, delay: Duration.milliseconds(50) }));

	setTimeout(() => controller.abort(), 75);

	const result = await repeated(controller.signal);
	expect(result).toBe(2);
});

test("delay: resolves immediately when signal is already aborted", async () => {
	const controller = new AbortController();
	controller.abort();
	const start = Date.now();
	const result = await pipe(Task.make(42), Task.delay(Duration.milliseconds(500)))(controller.signal);
	expect(result).toBe(42);
	expect(Date.now() - start).toBeLessThan(100);
});

test("timeout: aborts inner task when outer signal is already aborted", async () => {
	const controller = new AbortController();
	controller.abort();
	let innerSignal: AbortSignal | undefined;
	const task = fromPromise((signal) => {
		innerSignal = signal;
		return Promise.resolve(42);
	});
	const result = await pipe(task, Task.timeout({ duration: Duration.milliseconds(500), onTimeout: () => "timed out" }))(
		controller.signal,
	);
	expect(innerSignal?.aborted).toBe(true);
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

// ---------------------------------------------------------------------------
// sequence
// ---------------------------------------------------------------------------

test("sequence: runs tasks concurrently and collects results", async () => {
	const order: number[] = [];
	const t1 = fromPromise<number>(() =>
		new Promise((r) =>
			setTimeout(() => {
				order.push(1);
				r(1);
			}, 30)
		)
	);
	const t2 = fromPromise<number>(() =>
		new Promise((r) =>
			setTimeout(() => {
				order.push(2);
				r(2);
			}, 10)
		)
	);
	const t3 = fromPromise<number>(() =>
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

test("sequence: returns empty array for empty input", async () => {
	const result = await Task.sequence([])();
	expect(result).toStrictEqual([]);
});

test("sequence: forwards AbortSignal to all tasks", async () => {
	const controller = new AbortController();
	const signals: Array<AbortSignal | undefined> = [];

	const makeTask = () =>
		fromPromise<number>((signal) => {
			signals.push(signal);
			return Promise.resolve(1);
		});

	await Task.sequence([makeTask(), makeTask(), makeTask()])(controller.signal);

	expect(signals).toStrictEqual([controller.signal, controller.signal, controller.signal]);
});

// --- bindTo ---

test("bindTo: wraps value in accumulator object", async () => {
	const result = await pipe(Task.make(2), Task.bindTo("a"))();
	expect(result).toStrictEqual({ a: 2 });
});

// --- bind ---

test("bind: accumulates values key-by-key in pipeline", async () => {
	const result = await pipe(
		Task.make(2),
		Task.bindTo("a"),
		Task.bind("b", ({ a }) => Task.make(a * 3)),
		Task.bind("c", ({ a, b }) => Task.make(a + b)),
	)();
	expect(result).toStrictEqual({ a: 2, b: 6, c: 8 });
});

// --- memoize ---

test("memoize: executes task only once across multiple calls", async () => {
	let calls = 0;
	const task: Task<number> = () => {
		calls++;
		return Deferred.from.Promise(Promise.resolve(calls));
	};
	const memoized = Task.memoize(task);

	const v1 = await memoized();
	const v2 = await memoized();

	expect(v1).toBe(1);
	expect(v2).toBe(1);
	expect(calls).toBe(1);
});

// --- withProgress ---

test("withProgress: calls progress callback with 0 and 1", async () => {
	const progress: number[] = [];
	const task = pipe(Task.make(42), Task.withProgress((ratio) => progress.push(ratio)));

	const res = await task();
	expect(res).toBe(42);
	expect(progress).toStrictEqual([0, 1]);
});

// --- withLabel ---

test("withLabel: attaches read-only label property to task function", async () => {
	const task = pipe(Task.make(100), Task.withLabel("myCustomTask"));

	expect(task.label).toBe("myCustomTask");
	const res = await task();
	expect(res).toBe(100);
});

// ---------------------------------------------------------------------------
// Type-level tests: Task-family namespace types & structural equivalence
// ---------------------------------------------------------------------------

test("Result: is structurally equivalent to Task<Result<E, A>>", async () => {
	expectTypeOf<Task.Result<string, number>>().toEqualTypeOf<Task<Result<string, number>>>();
	expectTypeOf<Task<Result<string, number>>>().toEqualTypeOf<Task.Result<string, number>>();

	const okTask = Task.Result.make.ok(42);
	expectTypeOf(okTask).toEqualTypeOf<Task.Result<never, number>>();
	expectTypeOf(okTask).toEqualTypeOf<Task<Result<never, number>>>();

	const res = await okTask();
	expect(res).toStrictEqual({ kind: "Ok", value: 42 });
});

test("Maybe: is structurally equivalent to Task<Maybe<A>>", async () => {
	expectTypeOf<Task.Maybe<string>>().toEqualTypeOf<Task<Maybe<string>>>();
	expectTypeOf<Task<Maybe<string>>>().toEqualTypeOf<Task.Maybe<string>>();

	const someTask = Task.Maybe.make.some("hello");
	expectTypeOf(someTask).toEqualTypeOf<Task.Maybe<string>>();
	expectTypeOf(someTask).toEqualTypeOf<Task<Maybe<string>>>();

	const res = await someTask();
	expect(res).toStrictEqual({ kind: "Some", value: "hello" });
});

test("Validation: is structurally equivalent to Task<Validation<E, A>>", async () => {
	expectTypeOf<Task.Validation<string, number>>().toEqualTypeOf<Task<Validation<string, number>>>();
	expectTypeOf<Task<Validation<string, number>>>().toEqualTypeOf<Task.Validation<string, number>>();

	const passedTask = Task.Validation.make.passed(true);
	expectTypeOf(passedTask).toEqualTypeOf<Task.Validation<never, boolean>>();
	expectTypeOf(passedTask).toEqualTypeOf<Task<Validation<never, boolean>>>();

	const res = await passedTask();
	expect(res).toStrictEqual({ kind: "Passed", value: true });
});
