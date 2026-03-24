import { Deferred } from "./Deferred.ts";
import { Result } from "./Result.ts";
import { Task } from "./Task.ts";

/**
 * A Task that can fail with an error of type E or succeed with a value of type A.
 * Combines async operations with typed error handling.
 *
 * @example
 * ```ts
 * const fetchUser = (id: string): TaskResult<Error, User> =>
 *   TaskResult.tryCatch(
 *     () => fetch(`/users/${id}`).then(r => r.json()),
 *     (e) => new Error(`Failed to fetch user: ${e}`)
 *   );
 * ```
 */
export type TaskResult<E, A> = Task<Result<E, A>>;

export namespace TaskResult {
	/**
	 * Wraps a value in a successful TaskResult.
	 */
	export const ok = <E, A>(value: A): TaskResult<E, A> => Task.resolve(Result.ok(value));

	/**
	 * Creates a failed TaskResult with the given error.
	 */
	export const err = <E, A>(error: E): TaskResult<E, A> => Task.resolve(Result.err(error));

	/**
	 * Creates a TaskResult from a function that may throw.
	 * Catches any errors and transforms them using the onError function.
	 *
	 * @example
	 * ```ts
	 * const parseJson = (s: string): TaskResult<string, unknown> =>
	 *   TaskResult.tryCatch(
	 *     async () => JSON.parse(s),
	 *     (e) => `Parse error: ${e}`
	 *   );
	 * ```
	 */
	export const tryCatch = <E, A>(
		f: () => Promise<A>,
		onError: (e: unknown) => E,
	): TaskResult<E, A> =>
		Task.from(() =>
			f()
				.then(Result.ok)
				.catch((e) => Result.err(onError(e)))
		);

	/**
	 * Transforms the success value inside a TaskResult.
	 */
	export const map = <E, A, B>(f: (a: A) => B) => (data: TaskResult<E, A>): TaskResult<E, B> =>
		Task.map(Result.map<E, A, B>(f))(data);

	/**
	 * Transforms the error value inside a TaskResult.
	 */
	export const mapError = <E, F, A>(f: (e: E) => F) => (data: TaskResult<E, A>): TaskResult<F, A> =>
		Task.map(Result.mapError<E, F, A>(f))(data);

	/**
	 * Chains TaskResult computations. If the first succeeds, passes the value to f.
	 * If the first fails, propagates the error.
	 */
	export const chain = <E, A, B>(f: (a: A) => TaskResult<E, B>) => (data: TaskResult<E, A>): TaskResult<E, B> =>
		Task.chain((result: Result<E, A>) => Result.isOk(result) ? f(result.value) : Task.resolve(Result.err(result.error)))(
			data,
		);

	/**
	 * Extracts the value from a TaskResult by providing handlers for both cases.
	 */
	export const fold = <E, A, B>(onErr: (e: E) => B, onOk: (a: A) => B) => (data: TaskResult<E, A>): Task<B> =>
		Task.map(Result.fold(onErr, onOk))(data);

	/**
	 * Pattern matches on a TaskResult, returning a Task of the result.
	 */
	export const match = <E, A, B>(cases: { err: (e: E) => B; ok: (a: A) => B; }) => (data: TaskResult<E, A>): Task<B> =>
		Task.map(Result.match<E, A, B>(cases))(data);

	/**
	 * Recovers from an error by providing a fallback TaskResult.
	 * The fallback can produce a different success type, widening the result to `TaskResult<E, A | B>`.
	 */
	export const recover =
		<E, A, B>(fallback: (e: E) => TaskResult<E, B>) => (data: TaskResult<E, A>): TaskResult<E, A | B> =>
			Task.chain((result: Result<E, A>) =>
				Result.isErr(result) ? fallback(result.error) : Task.resolve(result as Result<E, A | B>)
			)(data);

	/**
	 * Returns the success value or a default value if the TaskResult is an error.
	 * The default can be a different type, widening the result to `Task<A | B>`.
	 */
	export const getOrElse = <E, A, B>(defaultValue: () => B) => (data: TaskResult<E, A>): Task<A | B> =>
		Task.map(Result.getOrElse<E, A, B>(defaultValue))(data);

	/**
	 * Executes a side effect on the success value without changing the TaskResult.
	 * Useful for logging or debugging.
	 */
	export const tap = <E, A>(f: (a: A) => void) => (data: TaskResult<E, A>): TaskResult<E, A> =>
		Task.map(Result.tap<E, A>(f))(data);

	/**
	 * Re-runs a TaskResult on `Err` with configurable attempts, backoff, and retry condition.
	 *
	 * @param options.attempts - Total number of attempts (1 = no retry, 3 = up to 3 tries)
	 * @param options.backoff - Fixed delay in ms, or a function `(attempt) => ms` for computed delay
	 * @param options.when - Only retry when this returns true; defaults to always retry on Err
	 *
	 * @example
	 * ```ts
	 * // Retry up to 3 times with exponential backoff
	 * pipe(
	 *   fetchUser,
	 *   TaskResult.retry({ attempts: 3, backoff: n => n * 1000 })
	 * );
	 *
	 * // Only retry on network errors, not auth errors
	 * pipe(
	 *   fetchUser,
	 *   TaskResult.retry({ attempts: 3, when: e => e instanceof NetworkError })
	 * );
	 * ```
	 */
	export const retry = <E>(options: {
		attempts: number;
		backoff?: number | ((attempt: number) => number);
		when?: (error: E) => boolean;
	}) =>
	<A>(data: TaskResult<E, A>): TaskResult<E, A> =>
		Task.from(() => {
			const { attempts, backoff, when: shouldRetry } = options;
			const getDelay = (n: number): number =>
				backoff === undefined ? 0 : typeof backoff === "function" ? backoff(n) : backoff;

			const run = (left: number): Promise<Result<E, A>> =>
				Deferred.toPromise(data()).then((result) => {
					if (Result.isOk(result)) return result;
					if (left <= 1) return result;
					if (shouldRetry !== undefined && !shouldRetry(result.error)) {
						return result;
					}
					const ms = getDelay(attempts - left + 1);
					return (
						ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve()
					).then(() => run(left - 1));
				});

			return run(attempts);
		});

	/**
	 * Polls a TaskResult repeatedly until the success value satisfies a predicate.
	 * Stops immediately and returns `Err` if the task fails.
	 *
	 * `delay` accepts a fixed number of milliseconds or a function `(attempt) => ms`
	 * for a computed delay — useful for starting fast and slowing down over time.
	 *
	 * @example
	 * ```ts
	 * const checkJob = (id: string): TaskResult<string, { status: "pending" | "done" }> =>
	 *   TaskResult.tryCatch(() => fetch(`/jobs/${id}`).then(r => r.json()), String);
	 *
	 * // Fixed delay: poll every 2s
	 * pipe(
	 *   checkJob(jobId),
	 *   TaskResult.pollUntil({ when: job => job.status === "done", delay: 2000 }),
	 * );
	 *
	 * // Computed delay: 1s, 2s, 3s, ...
	 * pipe(
	 *   checkJob(jobId),
	 *   TaskResult.pollUntil({ when: job => job.status === "done", delay: n => n * 1000 }),
	 * );
	 * ```
	 */
	export const pollUntil =
		<A>(options: { when: (a: A) => boolean; delay?: number | ((attempt: number) => number) }) =>
		<E>(task: TaskResult<E, A>): TaskResult<E, A> =>
			Task.from(() => {
				const { when: predicate, delay } = options;
				const getDelay = (attempt: number): number =>
					delay === undefined ? 0 : typeof delay === "function" ? delay(attempt) : delay;
				const run = (attempt: number): Promise<Result<E, A>> =>
					Deferred.toPromise(task()).then((result) => {
						if (Result.isErr(result)) return result;
						if (predicate(result.value)) return result;
						const ms = getDelay(attempt);
						return (
							ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve()
						).then(() => run(attempt + 1));
					});
				return run(1);
			});

	/**
	 * Fails a TaskResult with a typed error if it does not resolve within the given time.
	 * Uses `Promise.race` — the underlying operation keeps running after the timeout fires.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   fetchUser,
	 *   TaskResult.timeout(5000, () => new TimeoutError("fetch user timed out"))
	 * );
	 * ```
	 */
	export const timeout = <E>(ms: number, onTimeout: () => E) => <A>(data: TaskResult<E, A>): TaskResult<E, A> =>
		Task.from(() => {
			let timerId: ReturnType<typeof setTimeout>;
			return Promise.race([
				Deferred.toPromise(data()).then((result) => {
					clearTimeout(timerId);
					return result;
				}),
				new Promise<Result<E, A>>((resolve) => {
					timerId = setTimeout(() => resolve(Result.err(onTimeout())), ms);
				}),
			]);
		});
}
