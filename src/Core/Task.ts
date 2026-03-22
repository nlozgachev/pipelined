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
export type Task<A> = () => Deferred<A>;

// Internal helper — not exported. Runs a Task and converts the result to a Promise
// so that combinators can use Promise chaining (.then, Promise.all, Promise.race, etc.)
// internally without leaking that primitive through the public API.
const toPromise = <A>(task: Task<A>): Promise<A> => Deferred.toPromise(task());

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
	 *
	 * @example
	 * ```ts
	 * const getTimestamp = Task.from(() => Promise.resolve(Date.now()));
	 * ```
	 */
	export const from = <A>(f: () => Promise<A>): Task<A> => () => Deferred.fromPromise(f());

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
	export const map = <A, B>(f: (a: A) => B) => (data: Task<A>): Task<B> => from(() => toPromise(data).then(f));

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
		from(() => toPromise(data).then((a) => toPromise(f(a))));

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
		from(() =>
			Promise.all([
				toPromise(data),
				toPromise(arg),
			]).then(([f, a]) => f(a))
		);

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
		from(() =>
			toPromise(data).then((a) => {
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
	): Task<{ [K in keyof T]: T[K] extends Task<infer A> ? A : never }> =>
		from(
			() =>
				Promise.all(tasks.map((t) => toPromise(t))) as Promise<
					{
						[K in keyof T]: T[K] extends Task<infer A> ? A : never;
					}
				>,
		);

	/**
	 * Delays the execution of a Task by the specified milliseconds.
	 * Useful for debouncing or rate limiting.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.resolve(42),
	 *   Task.delay(1000)
	 * )(); // Resolves after 1 second
	 * ```
	 */
	export const delay = (ms: number) => <A>(data: Task<A>): Task<A> =>
		from(
			() =>
				new Promise<A>((resolve) =>
					setTimeout(
						() => toPromise(data).then(resolve),
						ms,
					)
				),
		);

	/**
	 * Runs a Task a fixed number of times sequentially, collecting all results into an array.
	 * An optional delay (ms) can be inserted between runs.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   pollSensor,
	 *   Task.repeat({ times: 5, delay: 1000 })
	 * )(); // Task<Reading[]> — 5 readings, one per second
	 * ```
	 */
	export const repeat = (options: { times: number; delay?: number }) => <A>(task: Task<A>): Task<A[]> =>
		from(() => {
			const { times, delay: ms } = options;
			if (times <= 0) return Promise.resolve([]);
			const results: A[] = [];
			const wait = (): Promise<void> =>
				ms !== undefined && ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
			const run = (left: number): Promise<A[]> =>
				toPromise(task).then((a) => {
					results.push(a);
					if (left <= 1) return results;
					return wait().then(() => run(left - 1));
				});
			return run(times);
		});

	/**
	 * Runs a Task repeatedly until the result satisfies a predicate, returning that result.
	 * An optional delay (ms) can be inserted between runs.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   checkStatus,
	 *   Task.repeatUntil({ when: (s) => s === "ready", delay: 500 })
	 * )(); // polls every 500ms until status is "ready"
	 * ```
	 */
	export const repeatUntil = <A>(options: { when: (a: A) => boolean; delay?: number }) => (task: Task<A>): Task<A> =>
		from(() => {
			const { when: predicate, delay: ms } = options;
			const wait = (): Promise<void> =>
				ms !== undefined && ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
			const run = (): Promise<A> =>
				toPromise(task).then((a) => {
					if (predicate(a)) return a;
					return wait().then(run);
				});
			return run();
		});

	/**
	 * Resolves with the value of the first Task to complete. All Tasks start
	 * immediately; the rest are abandoned once one resolves.
	 *
	 * @example
	 * ```ts
	 * const fast = Task.from(() => new Promise<string>(r => setTimeout(() => r("fast"), 10)));
	 * const slow = Task.from(() => new Promise<string>(r => setTimeout(() => r("slow"), 200)));
	 *
	 * await Task.race([fast, slow])(); // "fast"
	 * ```
	 */
	export const race = <A>(tasks: ReadonlyArray<Task<A>>): Task<A> => from(() => Promise.race(tasks.map(toPromise)));

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
		from(async () => {
			const results: A[] = [];
			for (const task of tasks) {
				results.push(await toPromise(task));
			}
			return results;
		});

	/**
	 * Converts a `Task<A>` into a `Task<Result<E, A>>`, resolving to `Err` if the
	 * Task does not complete within the given time.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   heavyComputation,
	 *   Task.timeout(5000, () => "timed out"),
	 *   TaskResult.chain(processResult)
	 * );
	 * ```
	 */
	export const timeout = <E>(ms: number, onTimeout: () => E) => <A>(task: Task<A>): Task<Result<E, A>> =>
		from(() => {
			let timerId: ReturnType<typeof setTimeout>;
			return Promise.race([
				toPromise(task).then((a): Result<E, A> => {
					clearTimeout(timerId);
					return Result.ok(a);
				}),
				new Promise<Result<E, A>>((resolve) => {
					timerId = setTimeout(() => resolve(Result.err(onTimeout())), ms);
				}),
			]);
		});
}
