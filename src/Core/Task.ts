import { Duration } from "../Types/Duration.ts";
import { Deferred } from "./Deferred.ts";
import { Result } from "./Result.ts";

/**
 * A lazy async computation that always resolves.
 *
 * Two guarantees:
 * - **Lazy** — nothing starts until you call it.
 * - **Infallible** — it never rejects. If failure is possible, encode it in the
 *   return type using `TaskResult<E, A>` instead.
 *
 * An optional `AbortSignal` can be passed at the call site. Combinators like
 * `retry`, `pollUntil`, and `timeout` thread it automatically to every inner
 * operation. Existing tasks that ignore the signal continue to work unchanged.
 *
 * Calling a Task returns a `Deferred<A>` — a one-shot async value that supports
 * `await` but has no `.catch()`, `.finally()`, or chainable `.then()`.
 *
 * **Consuming a Task:**
 *
 * Use `await task()` to run it and get the value directly:
 * ```ts
 * const value: number = await task();
 * ```
 *
 * When you need an explicit `Promise<A>` (e.g. for a third-party API), convert
 * the `Deferred` with `Deferred.toPromise`:
 * ```ts
 * const p: Promise<number> = Deferred.toPromise(task());
 * ```
 *
 * @example
 * ```ts
 * const getTimestamp: Task<number> = Task.resolve(Date.now());
 *
 * // Nothing runs yet — getTimestamp is just a description
 * const formatted = pipe(
 *   getTimestamp,
 *   Task.map(ts => new Date(ts).toISOString())
 * );
 *
 * // Execute when ready
 * const result = await formatted();
 * ```
 */
export type Task<A> = (signal?: AbortSignal) => Deferred<A>;

// Internal helper — not exported. Runs a Task and converts the result to a Promise
// so that combinators can use Promise chaining (.then, Promise.all, Promise.race, etc.)
// internally without leaking that primitive through the public API.
const toPromise = <A>(task: Task<A>, signal?: AbortSignal): Promise<A> => Deferred.toPromise(task(signal));

const getMs = (duration: Duration): number => Duration.toMilliseconds(duration);

export namespace Task {
	/**
	 * Creates a Task that immediately resolves to the given value.
	 *
	 * @example
	 * ```ts
	 * const task = Task.resolve(42);
	 * const value = await task(); // 42
	 * ```
	 */
	export const resolve = <A>(value: A): Task<A> => () => Deferred.fromPromise(Promise.resolve(value));

	/**
	 * Creates a Task from a function that returns a Promise.
	 * The factory optionally receives an `AbortSignal` forwarded from the call site.
	 *
	 * @example
	 * ```ts
	 * const getTimestamp = Task.from(() => Promise.resolve(Date.now()));
	 * ```
	 */
	export const from = <A>(f: (signal?: AbortSignal) => Promise<A>): Task<A> => (signal?: AbortSignal) =>
		Deferred.fromPromise(f(signal));

	/**
	 * Creates a Task from a lazy synchronous thunk.
	 * Unlike `Task.resolve(f())`, `fromSync` does not evaluate `f` until the Task is called.
	 *
	 * @example
	 * ```ts
	 * const t = Task.fromSync(() => Date.now()); // Date.now() not called yet
	 * const ts = await t(); // called here, every time
	 * ```
	 */
	export const fromSync = <A>(f: () => A): Task<A> => () => Deferred.fromPromise(Promise.resolve(f()));

	/**
	 * Transforms the value inside a Task.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.resolve(5),
	 *   Task.map(n => n * 2)
	 * )(); // Deferred<10>
	 * ```
	 */
	export const map = <A, B>(f: (a: A) => B) => (data: Task<A>): Task<B> =>
		from((signal) => toPromise(data, signal).then(f));

	/**
	 * Chains Task computations. Passes the resolved value of the first Task to f.
	 *
	 * @example
	 * ```ts
	 * const readUserId: Task<string> = Task.resolve(session.userId);
	 * const loadPrefs = (id: string): Task<Preferences> =>
	 *   Task.resolve(prefsCache.get(id));
	 *
	 * pipe(
	 *   readUserId,
	 *   Task.chain(loadPrefs)
	 * )(); // Deferred<Preferences>
	 * ```
	 */
	export const chain = <A, B>(f: (a: A) => Task<B>) => (data: Task<A>): Task<B> =>
		from((signal) => toPromise(data, signal).then((a) => toPromise(f(a), signal)));

	/**
	 * Applies a function wrapped in a Task to a value wrapped in a Task.
	 * Both Tasks run in parallel.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Task.resolve(add),
	 *   Task.ap(Task.resolve(5)),
	 *   Task.ap(Task.resolve(3))
	 * )(); // Deferred<8>
	 * ```
	 */
	export const ap = <A>(arg: Task<A>) => <B>(data: Task<(a: A) => B>): Task<B> =>
		from((signal) => Promise.all([toPromise(data, signal), toPromise(arg, signal)]).then(([f, a]) => f(a)));

	/**
	 * Executes a side effect on the value without changing the Task.
	 * Useful for logging or debugging.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   loadConfig,
	 *   Task.tap(cfg => console.log("Config:", cfg)),
	 *   Task.map(buildReport)
	 * );
	 * ```
	 */
	export const tap = <A>(f: (a: A) => void) => (data: Task<A>): Task<A> =>
		from((signal) =>
			toPromise(data, signal).then((a) => {
				f(a);
				return a;
			})
		);

	/**
	 * Runs multiple Tasks in parallel and collects their results.
	 *
	 * @example
	 * ```ts
	 * Task.all([loadConfig, detectLocale, loadTheme])();
	 * // Deferred<[Config, string, Theme]>
	 * ```
	 */
	export const all = <T extends readonly Task<unknown>[]>(
		tasks: T,
	): Task<{ [K in keyof T]: T[K] extends Task<infer A> ? A : never; }> =>
		from((signal) =>
			Promise.all(tasks.map((t) => toPromise(t, signal))) as Promise<
				{ [K in keyof T]: T[K] extends Task<infer A> ? A : never; }
			>
		);

	/**
	 * Delays the execution of a Task by the specified duration.
	 * Useful for debouncing or rate limiting.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.resolve(42),
	 *   Task.delay(Duration.seconds(1))
	 * )(); // Resolves after 1 second
	 * ```
	 */
	export const delay = (duration: Duration) => <A>(data: Task<A>): Task<A> =>
		from((signal) =>
			new Promise<A>((res) => {
				// eslint-disable-next-line prefer-const
				let timerId: ReturnType<typeof setTimeout> | undefined;
				const onAbort = () => {
					if (timerId !== undefined) {
						clearTimeout(timerId);
					}
					res(toPromise(data, signal));
				};

				if (signal) {
					if (signal.aborted) {
						return res(toPromise(data, signal));
					}
					signal.addEventListener("abort", onAbort, { once: true });
				}

				timerId = setTimeout(() => {
					signal?.removeEventListener("abort", onAbort);
					res(toPromise(data, signal));
				}, getMs(duration));
			})
		);

	/**
	 * Runs a Task a fixed number of times sequentially, collecting all results into an array.
	 * An optional delay duration can be inserted between runs.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   pollSensor,
	 *   Task.repeat({ times: 5, delay: Duration.seconds(1) })
	 * )(); // Task<Reading[]> — 5 readings, one per second
	 * ```
	 */
	export const repeat = (options: { times: number; delay?: Duration; }) => <A>(task: Task<A>): Task<readonly A[]> =>
		from((signal) => {
			const { times, delay: delayDuration } = options;
			if (times <= 0) { return Promise.resolve([]); }
			const results: A[] = [];
			const wait = (): Promise<void> => {
				if (signal?.aborted) { return Promise.resolve(); }
				return new Promise((r) => {
					// eslint-disable-next-line prefer-const
					let timerId: ReturnType<typeof setTimeout> | undefined;
					const onAbort = () => {
						if (timerId !== undefined) {
							clearTimeout(timerId);
						}
						r();
					};
					if (signal) {
						signal.addEventListener("abort", onAbort, { once: true });
					}
					timerId = setTimeout(() => {
						signal?.removeEventListener("abort", onAbort);
						r();
					}, delayDuration ? getMs(delayDuration) : 0);
				});
			};
			const run = (left: number): Promise<A[]> => {
				if (signal?.aborted) {
					return Promise.resolve(results);
				}
				return toPromise(task, signal).then((a) => {
					results.push(a);
					if (left <= 1 || signal?.aborted) { return results; }
					return wait().then(() => run(left - 1));
				});
			};
			return run(times);
		});

	/**
	 * Runs a Task repeatedly until the result satisfies a predicate, returning that result.
	 * An optional delay duration can be inserted between runs.
	 * An optional `maxAttempts` cap stops the loop after N calls — the last value is returned
	 * regardless of whether the predicate was satisfied.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   checkStatus,
	 *   Task.repeatUntil({ when: (s) => s === "ready", delay: Duration.milliseconds(500) })
	 * )(); // polls every 500ms until status is "ready"
	 * ```
	 */
	export const repeatUntil =
		<A>(options: { when: (a: A) => boolean; delay?: Duration; maxAttempts?: number; }) => (task: Task<A>): Task<A> =>
			from((signal) => {
				const { when: predicate, delay: delayDuration, maxAttempts } = options;
				const wait = (): Promise<void> => {
					if (signal?.aborted) { return Promise.resolve(); }
					return new Promise((r) => {
						// eslint-disable-next-line prefer-const
						let timerId: ReturnType<typeof setTimeout> | undefined;
						const onAbort = () => {
							if (timerId !== undefined) {
								clearTimeout(timerId);
							}
							r();
						};
						if (signal) {
							signal.addEventListener("abort", onAbort, { once: true });
						}
						timerId = setTimeout(() => {
							signal?.removeEventListener("abort", onAbort);
							r();
						}, delayDuration ? getMs(delayDuration) : 0);
					});
				};
				const run = (attempt: number, lastValue?: A): Promise<A> => {
					if (signal?.aborted && lastValue !== undefined) {
						return Promise.resolve(lastValue);
					}
					return toPromise(task, signal).then((a) => {
						if (predicate(a)) { return a; }
						if (maxAttempts !== undefined && attempt >= maxAttempts) { return a; }
						if (signal?.aborted) { return a; }
						return wait().then(() => run(attempt + 1, a));
					});
				};
				return run(1);
			});

	/**
	 * Resolves with the value of the first Task to complete. All Tasks start
	 * immediately. When one resolves, the other tasks are cancelled (aborted)
	 * downstream.
	 *
	 * @example
	 * ```ts
	 * const fast = Task.from(() => new Promise<string>(r => setTimeout(() => r("fast"), 10)));
	 * const slow = Task.from(() => new Promise<string>(r => setTimeout(() => r("slow"), 200)));
	 *
	 * await Task.race([fast, slow])(); // "fast"
	 * ```
	 */
	export const race = <A>(tasks: ReadonlyArray<Task<A>>): Task<A> => {
		if (tasks.length === 0) {
			return () => Deferred.fromPromise(new Promise(() => {}));
		}
		return from((outerSignal) => {
			const controllers = tasks.map(() => new AbortController());
			const onOuterAbort = () => {
				for (const ctrl of controllers) { ctrl.abort(); }
			};
			if (outerSignal) {
				if (outerSignal.aborted) {
					onOuterAbort();
				} else {
					outerSignal.addEventListener("abort", onOuterAbort, { once: true });
				}
			}
			const promises = tasks.map((task, idx) => {
				const ctrl = controllers[idx];
				return toPromise(task, ctrl.signal).then((result) => {
					for (let i = 0; i < controllers.length; i++) {
						if (i !== idx) {
							controllers[i].abort();
						}
					}
					outerSignal?.removeEventListener("abort", onOuterAbort);
					return result;
				});
			});
			return Promise.race(promises);
		});
	};

	/**
	 * Runs an array of Tasks concurrently and collects their results in an array.
	 * Forward-propagates the call site's AbortSignal to all subtasks concurrently.
	 *
	 * @example
	 * ```ts
	 * Task.sequence([loadConfig, detectLocale, loadTheme])();
	 * // Deferred<[Config, string, Theme]>
	 * ```
	 */
	export const sequence = <A>(tasks: ReadonlyArray<Task<A>>): Task<ReadonlyArray<A>> =>
		from((signal) => Promise.all(tasks.map((t) => toPromise(t, signal))));

	/**
	 * Runs an array of Tasks one at a time in order, collecting all results.
	 * Each Task starts only after the previous one resolves.
	 *
	 * @example
	 * ```ts
	 * let log: number[] = [];
	 * const makeTask = (n: number) => Task.from(() => {
	 *   log.push(n);
	 *   return Promise.resolve(n);
	 * });
	 *
	 * await Task.sequential([makeTask(1), makeTask(2), makeTask(3)])();
	 * // log = [1, 2, 3] — tasks ran in order
	 * ```
	 */
	export const sequential = <A>(tasks: ReadonlyArray<Task<A>>): Task<ReadonlyArray<A>> =>
		from(async (signal) => {
			const results: A[] = [];
			for (const task of tasks) {
				if (signal?.aborted) {
					break;
				}
				// eslint-disable-next-line no-await-in-loop
				results.push(await toPromise(task, signal));
			}
			return results;
		});

	/**
	 * Converts a `Task<A>` into a `Task<Result<E, A>>`, resolving to `Err` if the
	 * Task does not complete within the given duration. The inner Task receives an
	 * `AbortSignal` that fires when the deadline passes, so asynchronous operations
	 * that accept a signal are cancelled rather than left dangling.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   heavyComputation,
	 *   Task.timeout(Duration.seconds(5), () => "timed out"),
	 *   TaskResult.chain(processResult)
	 * );
	 * ```
	 */
	export const timeout = <E>(duration: Duration, onTimeout: () => E) => <A>(task: Task<A>): Task<Result<E, A>> =>
		from((outerSignal) => {
			const controller = new AbortController();
			let timerId: ReturnType<typeof setTimeout> | undefined;

			function cleanUp() {
				if (timerId !== undefined) {
					clearTimeout(timerId);
				}
				// eslint-disable-next-line no-use-before-define
				outerSignal?.removeEventListener("abort", onOuterAbort);
			}

			function onOuterAbort() {
				cleanUp();
				controller.abort();
			}

			if (outerSignal) {
				if (outerSignal.aborted) {
					controller.abort();
				} else {
					outerSignal.addEventListener("abort", onOuterAbort, { once: true });
				}
			}

			return Promise.race([
				toPromise(task, controller.signal).then((a): Result<E, A> => {
					cleanUp();
					return Result.ok(a);
				}),
				new Promise<Result<E, A>>((res) => {
					timerId = setTimeout(() => {
						controller.abort();
						cleanUp();
						res(Result.err(onTimeout()));
					}, getMs(duration));
				}),
			]);
		});

	/**
	 * Creates a Task paired with an `abort` handle. Calling `abort()` cancels the
	 * current in-flight call immediately. Unlike a one-shot abort, calling `task()`
	 * again after `abort()` starts a fresh call with a new signal.
	 *
	 * Each invocation of `task()` automatically cancels the previous in-flight call,
	 * making it safe to call repeatedly (e.g. on user input) without leaking promises.
	 *
	 * If an outer signal is also present (passed at the call site), aborting it
	 * propagates into the internal controller.
	 *
	 * @example
	 * ```ts
	 * const { task: poll, abort } = Task.abortable(
	 *   (signal) => waitForEvent(bus, "ready", { signal }),
	 * );
	 *
	 * onUnmount(abort);
	 * await poll();
	 * ```
	 */
	export const abortable = <A>(factory: (signal: AbortSignal) => Promise<A>): { task: Task<A>; abort: () => void; } => {
		let currentController: AbortController | null = null;

		const abort = () => currentController?.abort();

		const task: Task<A> = (outerSignal?: AbortSignal) => {
			// Cancel any previous in-flight call before starting a new one.
			currentController?.abort();
			currentController = new AbortController();
			const controller = currentController;

			if (outerSignal) {
				if (outerSignal.aborted) {
					controller.abort(outerSignal.reason);
				} else {
					outerSignal.addEventListener("abort", () => controller.abort(outerSignal.reason), { once: true });
				}
			}

			return Deferred.fromPromise(factory(controller.signal));
		};

		return { task, abort };
	};

	/**
	 * Executes a task with an optional signal. Use as a terminal step in a `pipe` chain.
	 *
	 * @example
	 * ```ts
	 * const name = await pipe(
	 *     loadConfig,
	 *     Task.map(config => config.name),
	 *     Task.run(),
	 * );
	 * ```
	 */
	export const run = (signal?: AbortSignal) => <A>(task: Task<A>): Promise<A> => Deferred.toPromise(task(signal));
}
