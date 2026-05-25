import { Deferred, Maybe, Result, Task } from "#core";

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
	 * Creates a TaskResult from a nullable value.
	 * Returns Ok if the value is not null or undefined, err from onNull otherwise.
	 */
	export const fromNullable = <E>(onNull: () => E) => <A>(value: A | null | undefined): TaskResult<E, A> =>
		Task.resolve(value === null || value === undefined ? Result.err(onNull()) : Result.ok(value));

	/**
	 * Creates a TaskResult from a Maybe.
	 * Some becomes Ok, None becomes err from onNone.
	 */
	export const fromMaybe = <E>(onNone: () => E) => <A>(maybe: Maybe<A>): TaskResult<E, A> =>
		Task.resolve(Maybe.isNone(maybe) ? Result.err(onNone()) : Result.ok(maybe.value));

	/**
	 * Lifts a Result into a TaskResult.
	 */
	export const fromResult = <E, A>(result: Result<E, A>): TaskResult<E, A> => Task.resolve(result);

	/**
	 * Wraps a Promise-returning function of any arguments, returning a new function
	 * that catches rejections and returns a TaskResult.
	 */
	export const fromThrowable =
		<Args extends readonly unknown[], A, E>(f: (...args: Args) => Promise<A>, onError: (e: unknown) => E) =>
		(...args: Args): TaskResult<E, A> =>
			Task.from(() => f(...args).then(Result.ok).catch((error) => Result.err(onError(error))));

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
	): TaskResult<E, A> => Task.from((signal) => f(signal).then(Result.ok).catch((error) => Result.err(onError(error))));

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
	 * Executes a side effect on the error value without changing the TaskResult.
	 * Useful for logging or reporting async errors.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   fetchUser(id),
	 *   TaskResult.tapError(e => console.error("fetch failed:", e)),
	 *   TaskResult.chain(saveToCache),
	 * )
	 * ```
	 */
	export const tapError = <E, A>(f: (e: E) => void) => (data: TaskResult<E, A>): TaskResult<E, A> =>
		Task.map(Result.tapError<E, A>(f))(data);

	/**
	 * Applies a function wrapped in a TaskResult to a value wrapped in a TaskResult.
	 * Both Tasks run in parallel.
	 */
	export const ap = <E, A>(arg: TaskResult<E, A>) => <B>(data: TaskResult<E, (a: A) => B>): TaskResult<E, B> =>
		Task.from((signal) =>
			Promise.all([Deferred.toPromise(data(signal)), Deferred.toPromise(arg(signal))]).then(([of_, oa]) =>
				Result.ap(oa)(of_)
			)
		);

	/**
	 * Executes a `TaskResult` with an optional signal, returning `Promise<Result<E, A>>`.
	 * Use as a terminal step in a `pipe` chain.
	 *
	 * @example
	 * ```ts
	 * const controller = new AbortController();
	 * const result = await pipe(
	 *     fetchUser("42"),
	 *     TaskResult.chain(user => fetchPosts(user.id)),
	 *     TaskResult.run(controller.signal),
	 * );
	 * if (Result.isOk(result)) render(result.value);
	 * ```
	 */
	export const run = (signal?: AbortSignal) => <E, A>(task: TaskResult<E, A>): Promise<Result<E, A>> =>
		Deferred.toPromise(task(signal));

	/**
	 * Converts a TaskResult value into an object containing a single property.
	 * Initiates the pipeline accumulator record.
	 *
	 * @example
	 * ```ts
	 * pipe(TaskResult.ok(42), TaskResult.bindTo("value")); // TaskResult({ value: 42 })
	 * ```
	 */
	export const bindTo = <K extends string>(key: K) => <E, A>(data: TaskResult<E, A>): TaskResult<E, { [P in K]: A; }> =>
		map<E, A, { [P in K]: A; }>((a) => ({ [key]: a } as { [P in K]: A; }))(data);

	/**
	 * Evaluates a new TaskResult using the current accumulator and attaches the output to a new key.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   TaskResult.ok({ a: 1 }),
	 *   TaskResult.bind("b", ({ a }) => TaskResult.ok(a + 1))
	 * ); // TaskResult({ a: 1, b: 2 })
	 * ```
	 */
	export const bind =
		<K extends string, E, A, B>(key: K, f: (a: A) => TaskResult<E, B>) =>
		(data: TaskResult<E, A>): TaskResult<E, A & { [P in K]: B; }> =>
			chain<E, A, A & { [P in K]: B; }>((a) =>
				map<E, B, A & { [P in K]: B; }>((b) => ({ ...(a as any), [key]: b } as A & { [P in K]: B; }))(f(a))
			)(data);

	/**
	 * Combines a record of TaskResults into a single TaskResult of a record.
	 * Evaluates all tasks in parallel, forwarding the AbortSignal down to each sub-task.
	 * Returns the first Err encountered in key order.
	 *
	 * @example
	 * ```ts
	 * TaskResult.struct({
	 *   name: TaskResult.ok("Alice"),
	 *   age: TaskResult.ok(30)
	 * }); // TaskResult({ name: "Alice", age: 30 })
	 * ```
	 */
	export const struct = <E, R extends Record<string, any>>(
		fields: { [K in keyof R]: TaskResult<E, R[K]>; },
	): TaskResult<E, R> =>
		Task.from((signal) => {
			const keys = Object.keys(fields);
			const promises = keys.map((key) => Deferred.toPromise(fields[key](signal)));
			return Promise.all(promises).then((results) => {
				const record = {} as R;
				for (let i = 0; i < keys.length; i++) {
					const res = results[i];
					if (Result.isErr(res)) {
						return res;
					}
					record[keys[i] as keyof R] = res.value;
				}
				return Result.ok(record);
			});
		});
}
