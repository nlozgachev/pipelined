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
 *     (signal) => fetch(`/users/${id}`, { signal }).then(r => r.json()),
 *     (e) => new Error(`Failed to fetch user: ${e}`)
 *   );
 * ```
 */
export type TaskResult<E, A> = Task<Result<E, A>>;

// Waits for `ms` milliseconds, resolving early if the signal fires.
// Resolving (not rejecting) on abort keeps Task infallibility intact.
const cancellableWait = (ms: number, signal?: AbortSignal): Promise<void> => {
	if (ms <= 0) return Promise.resolve();
	if (!signal) return new Promise<void>((r) => setTimeout(r, ms));
	return new Promise<void>((resolve) => {
		const id = setTimeout(resolve, ms);
		signal.addEventListener("abort", () => {
			clearTimeout(id);
			resolve();
		}, { once: true });
	});
};

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
	 * The factory optionally receives an `AbortSignal` forwarded from the call site.
	 *
	 * @example
	 * ```ts
	 * const fetchUser = (id: string): TaskResult<string, User> =>
	 *   TaskResult.tryCatch(
	 *     (signal) => fetch(`/users/${id}`, { signal }).then(r => r.json()),
	 *     String
	 *   );
	 * ```
	 */
	export const tryCatch = <E, A>(
		f: (signal?: AbortSignal) => Promise<A>,
		onError: (e: unknown) => E,
	): TaskResult<E, A> =>
		Task.from((signal) =>
			f(signal)
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
	 * An `AbortSignal` passed at the call site is forwarded to each attempt; the loop also
	 * checks the signal before starting a new attempt so cancellation stops the loop promptly.
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
		Task.from((signal) => {
			const { attempts, backoff, when: shouldRetry } = options;
			const getDelay = (n: number): number =>
				backoff === undefined ? 0 : typeof backoff === "function" ? backoff(n) : backoff;

			const run = (left: number): Promise<Result<E, A>> =>
				Deferred.toPromise(data(signal)).then((result) => {
					if (Result.isOk(result)) return result;
					if (left <= 1) return result;
					if (shouldRetry !== undefined && !shouldRetry(result.error)) {
						return result;
					}
					if (signal?.aborted) return result;
					const ms = getDelay(attempts - left + 1);
					return cancellableWait(ms, signal).then(() => {
						if (signal?.aborted) return result;
						return run(left - 1);
					});
				});

			return run(attempts);
		});

	/**
	 * Polls a TaskResult repeatedly until the success value satisfies a predicate.
	 * Stops immediately and returns `Err` if the task fails.
	 * An `AbortSignal` passed at the call site is forwarded to each attempt; the loop
	 * also checks the signal before starting a new poll so cancellation stops promptly.
	 *
	 * `delay` accepts a fixed number of milliseconds or a function `(attempt) => ms`
	 * for a computed delay — useful for starting fast and slowing down over time.
	 *
	 * @example
	 * ```ts
	 * const checkJob = (id: string): TaskResult<string, { status: "pending" | "done" }> =>
	 *   TaskResult.tryCatch(
	 *     (signal) => fetch(`/jobs/${id}`, { signal }).then(r => r.json()),
	 *     String
	 *   );
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
		<A>(options: { when: (a: A) => boolean; delay?: number | ((attempt: number) => number); }) =>
		<E>(task: TaskResult<E, A>): TaskResult<E, A> =>
			Task.from((signal) => {
				const { when: predicate, delay } = options;
				const getDelay = (attempt: number): number =>
					delay === undefined ? 0 : typeof delay === "function" ? delay(attempt) : delay;
				const run = (attempt: number): Promise<Result<E, A>> =>
					Deferred.toPromise(task(signal)).then((result) => {
						if (Result.isErr(result)) return result;
						if (predicate(result.value)) return result;
						if (signal?.aborted) return result;
						const ms = getDelay(attempt);
						return cancellableWait(ms, signal).then(() => {
							if (signal?.aborted) return result;
							return run(attempt + 1);
						});
					});
				return run(1);
			});

	/**
	 * Fails a TaskResult with a typed error if it does not resolve within the given time.
	 * The inner task receives an `AbortSignal` that fires when the deadline passes —
	 * operations like `fetch` that accept a signal are cancelled rather than left dangling.
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
		Task.from((outerSignal) => {
			const controller = new AbortController();
			const onOuterAbort = () => controller.abort();
			outerSignal?.addEventListener("abort", onOuterAbort, { once: true });

			let timerId: ReturnType<typeof setTimeout>;

			return Promise.race([
				Deferred.toPromise(data(controller.signal)).then((result) => {
					clearTimeout(timerId);
					outerSignal?.removeEventListener("abort", onOuterAbort);
					return result;
				}),
				new Promise<Result<E, A>>((resolve) => {
					timerId = setTimeout(() => {
						controller.abort();
						outerSignal?.removeEventListener("abort", onOuterAbort);
						resolve(Result.err(onTimeout()));
					}, ms);
				}),
			]);
		});

	/**
	 * Creates a TaskResult paired with an `abort` handle. When `abort()` is called the
	 * `AbortSignal` passed to the factory is fired, cancelling any in-flight operation.
	 * The abort error is transformed by `onError` into a typed `Err`.
	 *
	 * If an outer signal is also present (passed at the call site), aborting it
	 * propagates into the internal controller.
	 *
	 * @example
	 * ```ts
	 * const { task: req, abort } = TaskResult.abortable(
	 *   (signal) => fetch(`/users/${id}`, { signal }).then(r => r.json()),
	 *   String,
	 * );
	 *
	 * const result = pipe(req, TaskResult.retry({ attempts: 3 }));
	 *
	 * onCancel(abort);
	 * await result();
	 * ```
	 */
	export const abortable = <E, A>(
		factory: (signal: AbortSignal) => Promise<A>,
		onError: (e: unknown) => E,
	): { task: TaskResult<E, A>; abort: () => void; } => {
		const controller = new AbortController();
		const task: TaskResult<E, A> = (outerSignal?: AbortSignal) => {
			if (outerSignal) {
				if (outerSignal.aborted) {
					controller.abort(outerSignal.reason);
				} else {
					outerSignal.addEventListener("abort", () => controller.abort(outerSignal.reason), { once: true });
				}
			}
			return Deferred.fromPromise(
				factory(controller.signal)
					.then(Result.ok)
					.catch((e) => Result.err(onError(e))),
			);
		};
		return { task, abort: () => controller.abort() };
	};
}
