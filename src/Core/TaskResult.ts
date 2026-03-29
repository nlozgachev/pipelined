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
}
