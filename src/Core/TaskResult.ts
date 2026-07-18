import {
	Deferred,
	type Maybe,
	Maybe as CoreMaybe,
	type Result,
	Result as CoreResult,
	type Task,
	Task as CoreTask,
} from "#core";
import type { Thenable } from "#internal";
import { Duration, type RetryPolicy } from "#types";

/**
 * A Task that can fail with an error of type E or succeed with a value of type A.
 * Combines async operations with typed error handling.
 *
 * @example
 * ```ts
 * const fetchUser = (id: string): Task.Result<Error, User> =>
 *   Task.Result.tryCatch(
 *     (signal) => fetch(`/users/${id}`, { signal }).then(r => r.json()),
 *     { onError: (e) => new Error(`Failed to fetch user: ${e}`) }
 *   );
 * ```
 */
export type TaskResult<E, A> = Task<Result<E, A>>;

export namespace TaskResult {
	/**
	 * Wraps a value in a successful Task.Result.
	 */
	export const ok = <E, A>(value: A): TaskResult<E, A> => CoreTask.resolve(CoreResult.make.ok(value));

	/**
	 * Creates a failed Task.Result with the given error.
	 */
	export const err = <E, A>(error: E): TaskResult<E, A> => CoreTask.resolve(CoreResult.make.err(error));

	// --- from ---
	export namespace from {
		/**
		 * Creates a Task.Result from a nullable value.
		 * Returns Ok if the value is not null or undefined, err from onNull otherwise.
		 */
		export const nullable = <E>(onNull: () => E) => <A>(value: A | null | undefined): TaskResult<E, A> =>
			CoreTask.resolve(value === null || value === undefined ? CoreResult.make.err(onNull()) : CoreResult.make.ok(value));

		/**
		 * Creates a Task.Result from a Maybe.
		 * Some becomes Ok, None becomes err from onNone.
		 */
		export const Maybe = <E>(onNone: () => E) => <A>(maybe: Maybe<A>): TaskResult<E, A> =>
			CoreTask.resolve(CoreMaybe.is.none(maybe) ? CoreResult.make.err(onNone()) : CoreResult.make.ok(maybe.value));

		/**
		 * Lifts a Result into a Task.Result.
		 */
		export const Result = <E, A>(result: Result<E, A>): TaskResult<E, A> => CoreTask.resolve(result);

		/**
		 * Wraps a Promise-returning function of any arguments, returning a new function
		 * that catches rejections and returns a Task.Result.
		 */
		export const throwable =
			<Args extends readonly unknown[], A, E>(
				f: (...args: Args) => Promise<A>,
				options: { onError: (e: unknown) => E; },
			) =>
			(...args: Args): TaskResult<E, A> =>
				CoreTask.from.Promise(() =>
					f(...args).then(CoreResult.make.ok).catch((error) => CoreResult.make.err(options.onError(error)))
				);
	}

	/**
	 * Creates a Task.Result from a function that may throw.
	 * Catches any errors and transforms them using the onError function.
	 * The factory optionally receives an `AbortSignal` forwarded from the call site.
	 *
	 * @example
	 * ```ts
	 * const fetchUser = (id: string): Task.Result<string, User> =>
	 *   Task.Result.tryCatch(
	 *     (signal) => fetch(`/users/${id}`, { signal }).then(r => r.json()),
	 *     { onError: String }
	 *   );
	 * ```
	 */
	export const tryCatch = <E, A>(
		f: (signal?: AbortSignal) => Thenable<A>,
		options: { onError: (e: unknown) => E; },
	): TaskResult<E, A> =>
		CoreTask.from.Promise((signal) =>
			Promise.resolve(f(signal)).then(CoreResult.make.ok).catch((error) => CoreResult.make.err(options.onError(error)))
		);

	/**
	 * Transforms the success value inside a Task.Result.
	 */
	export const map = <E, A, B>(f: (a: A) => B) => (data: TaskResult<E, A>): TaskResult<E, B> =>
		CoreTask.map(CoreResult.map<E, A, B>(f))(data);

	/**
	 * Transforms the error value inside a Task.Result.
	 */
	export const mapError = <E, F, A>(f: (e: E) => F) => (data: TaskResult<E, A>): TaskResult<F, A> =>
		CoreTask.map(CoreResult.mapError<E, F, A>(f))(data);

	/**
	 * Chains Task.Result computations. If the first succeeds, passes the value to f.
	 * If the first fails, propagates the error.
	 */
	export const chain = <E, A, B>(f: (a: A) => TaskResult<E, B>) => (data: TaskResult<E, A>): TaskResult<E, B> =>
		CoreTask.chain((result: Result<E, A>) =>
			CoreResult.is.ok(result) ? f(result.value) : CoreTask.resolve(CoreResult.make.err(result.error))
		)(data);

	/**
	 * Extracts the value from a Task.Result by providing handlers for both cases.
	 */
	export const fold = <E, A, B>(onErr: (e: E) => B, onOk: (a: A) => B) => (data: TaskResult<E, A>): Task<B> =>
		CoreTask.map(CoreResult.fold(onErr, onOk))(data);

	/**
	 * Pattern matches on a Task.Result, returning a Task of the result.
	 */
	export const match = <E, A, B>(cases: { err: (e: E) => B; ok: (a: A) => B; }) => (data: TaskResult<E, A>): Task<B> =>
		CoreTask.map(CoreResult.match<E, A, B>(cases))(data);

	/**
	 * Recovers from an error by providing a fallback Task.Result.
	 * The fallback can produce a different success type, widening the result to `Task.Result<E, A | B>`.
	 */
	export const recover =
		<E, A, B>(fallback: (e: E) => TaskResult<E, B>) => (data: TaskResult<E, A>): TaskResult<E, A | B> =>
			CoreTask.chain((result: Result<E, A>) =>
				CoreResult.is.err(result) ? fallback(result.error) : CoreTask.resolve(result as Result<E, A | B>)
			)(data);

	/**
	 * Returns the success value or a default value if the Task.Result is an error.
	 * The default can be a different type, widening the result to `Task<A | B>`.
	 */
	export const getOrElse = <E, A, B>(defaultValue: () => B) => (data: TaskResult<E, A>): Task<A | B> =>
		CoreTask.map(CoreResult.getOrElse<E, A, B>(defaultValue))(data);

	/**
	 * Executes a side effect on the success value without changing the Task.Result.
	 * Useful for logging or debugging.
	 */
	export const tap = <E, A>(f: (a: A) => void) => (data: TaskResult<E, A>): TaskResult<E, A> =>
		CoreTask.map(CoreResult.tap<E, A>(f))(data);

	/**
	 * Executes a side effect on the error value without changing the Task.Result.
	 * Useful for logging or reporting async errors.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   fetchUser(id),
	 *   Task.Result.tapError(e => console.error("fetch failed:", e)),
	 *   Task.Result.chain(saveToCache),
	 * )
	 * ```
	 */
	export const tapError = <E, A>(f: (e: E) => void) => (data: TaskResult<E, A>): TaskResult<E, A> =>
		CoreTask.map(CoreResult.tapError<E, A>(f))(data);

	/**
	 * Applies a function wrapped in a Task.Result to a value wrapped in a Task.Result.
	 * Both Tasks run in parallel.
	 */
	export const ap = <E, A>(arg: TaskResult<E, A>) => <B>(data: TaskResult<E, (a: A) => B>): TaskResult<E, B> =>
		CoreTask.from.Promise((signal) =>
			Promise.all([Deferred.to.Promise(data(signal)), Deferred.to.Promise(arg(signal))]).then(([of_, oa]) =>
				CoreResult.ap(oa)(of_)
			)
		);

	/**
	 * Executes a `Task.Result` with an optional signal, returning `Promise<Result<E, A>>`.
	 * Use as a terminal step in a `pipe` chain.
	 *
	 * @example
	 * ```ts
	 * const controller = new AbortController();
	 * const result = await pipe(
	 *     fetchUser("42"),
	 *     Task.Result.chain(user => fetchPosts(user.id)),
	 *     Task.Result.run(controller.signal),
	 * );
	 * if (Result.is.ok(result)) render(result.value);
	 * ```
	 */
	export const run = (signal?: AbortSignal) => <E, A>(task: TaskResult<E, A>): Deferred<Result<E, A>> => task(signal);

	/**
	 * Converts a Task.Result value into an object containing a single property.
	 * Initiates the pipeline accumulator record.
	 *
	 * @example
	 * ```ts
	 * pipe(Task.Result.ok(42), Task.Result.bindTo("value")); // Task.Result({ value: 42 })
	 * ```
	 */
	export const bindTo = <K extends string>(key: K) => <E, A>(data: TaskResult<E, A>): TaskResult<E, { [P in K]: A; }> =>
		map<E, A, { [P in K]: A; }>((a) => ({ [key]: a } as { [P in K]: A; }))(data);

	/**
	 * Evaluates a new Task.Result using the current accumulator and attaches the output to a new key.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Result.ok({ a: 1 }),
	 *   Task.Result.bind("b", ({ a }) => Task.Result.ok(a + 1))
	 * ); // Task.Result({ a: 1, b: 2 })
	 * ```
	 */
	export const bind =
		<K extends string, E, A, B>(key: K, f: (a: A) => TaskResult<E, B>) =>
		(data: TaskResult<E, A>): TaskResult<E, A & { [P in K]: B; }> =>
			chain<E, A, A & { [P in K]: B; }>((a) =>
				map<E, B, A & { [P in K]: B; }>((b) => ({ ...(a as any), [key]: b } as A & { [P in K]: B; }))(f(a))
			)(data);

	/**
	 * Combines a record of Task.Results into a single Task.Result of a record.
	 * Evaluates all tasks in parallel, forwarding the AbortSignal down to each sub-task.
	 * Returns the first Err encountered in key order.
	 *
	 * @example
	 * ```ts
	 * Task.Result.struct({
	 *   name: Task.Result.ok("Alice"),
	 *   age: Task.Result.ok(30)
	 * }); // Task.Result({ name: "Alice", age: 30 })
	 * ```
	 */
	export const struct = <E, R extends Record<string, any>>(
		fields: { [K in keyof R]: TaskResult<E, R[K]>; },
	): TaskResult<E, R> =>
		CoreTask.from.Promise((signal) => {
			const keys = Object.keys(fields);
			const promises = keys.map((key) => Deferred.to.Promise(fields[key](signal)));
			return Promise.all(promises).then((results) => {
				const record = {} as R;
				for (let i = 0; i < keys.length; i++) {
					const res = results[i];
					if (CoreResult.is.err(res)) {
						return res;
					}
					record[keys[i] as keyof R] = res.value;
				}
				return CoreResult.make.ok(record);
			});
		});

	/**
	 * Retries a fallible Task.Result according to a RetryPolicy.
	 * If the task succeeds, returns Ok immediately.
	 * If the task fails, retries up to policy.attempts times with delays generated by policy.
	 *
	 * @example
	 * ```ts
	 * const policy = RetryPolicy.exponential({ attempts: 3, initial: Duration.milliseconds(100) });
	 * const retryableFetch = pipe(fetchData, Task.Result.retry(policy));
	 * ```
	 */
	export const retry = (policy: RetryPolicy) => <E, A>(task: TaskResult<E, A>): TaskResult<E, A> =>
		CoreTask.from.Promise((signal) => {
			const { attempts } = policy;

			const wait = (duration: Duration): Promise<void> =>
				new Promise((res) => {
					// eslint-disable-next-line prefer-const
					let timerId: ReturnType<typeof setTimeout> | undefined;
					const onAbort = () => {
						clearTimeout(timerId);
						res();
					};
					if (signal) {
						if (signal.aborted) { return res(); }
						signal.addEventListener("abort", onAbort, { once: true });
					}
					timerId = setTimeout(() => {
						signal?.removeEventListener("abort", onAbort);
						res();
					}, Duration.to.milliseconds(duration));
				});

			const executeAttempt = (attempt: number): Promise<Result<E, A>> =>
				Deferred.to.Promise(task(signal)).then((res) => {
					if (CoreResult.is.ok(res) || attempt >= attempts || signal?.aborted) {
						return res;
					}
					const delay = policy.getDelay(attempt);
					return wait(delay).then(() => executeAttempt(attempt + 1));
				});

			return executeAttempt(1);
		});

	/**
	 * Creates a memoized version of a Task.Result. The task is executed at most once on first call,
	 * and its resolved Result is cached for all subsequent calls.
	 *
	 * @example
	 * ```ts
	 * const loadConfig = Task.Result.memoize(fetchConfigTask);
	 * ```
	 */
	export const memoize = <E, A>(task: TaskResult<E, A>): TaskResult<E, A> => CoreTask.memoize(task);
}
