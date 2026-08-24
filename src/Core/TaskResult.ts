import type { Thenable } from "#internal";
import { Duration, type RetryPolicy } from "#types";
import { Deferred } from "./Deferred.ts";
import { type Maybe, Maybe as CoreMaybe } from "./Maybe.ts";
import { type Result, Result as CoreResult } from "./Result.ts";
import { Task } from "./Task.ts";

const makeOk = <E = never, A = unknown>(value: A): Task.Result<E, A> => Task.resolve(CoreResult.make.ok(value));
const makeErr = <E, A = never>(error: E): Task.Result<E, A> => Task.resolve(CoreResult.make.err(error));

const mapTaskResult = <E, A, B>(f: (a: A) => B) => (data: Task.Result<E, A>): Task.Result<E, B> =>
	Task.map(CoreResult.map<E, A, B>(f))(data);

const chainTaskResult =
	<E2, A, B>(f: (a: A) => Task.Result<E2, B>) => <E1 = never>(data: Task.Result<E1, A>): Task.Result<E1 | E2, B> =>
		Task.chain((result: Result<E1, A>) =>
			CoreResult.is.ok(result) ? f(result.value) : Task.resolve(CoreResult.make.err(result.error) as Result<E1 | E2, B>)
		)(data);

export const TaskResult = {
	make: {
		/**
		 * Wraps a value in a successful Task.Result.
		 *
		 * @example
		 * ```ts
		 * const task = Task.Result.make.ok(42);
		 * const res = await task(); // Ok(42)
		 * ```
		 */
		ok: makeOk,

		/**
		 * Creates a failed Task.Result with the given error.
		 *
		 * @example
		 * ```ts
		 * const task = Task.Result.make.err("failed");
		 * const res = await task(); // Err("failed")
		 * ```
		 */
		err: makeErr,
	},

	// --- from ---
	from: {
		/**
		 * Creates a Task.Result from a nullable value.
		 * Returns Ok if the value is not null or undefined, err from onNull otherwise.
		 *
		 * @example
		 * ```ts
		 * Task.Result.from.nullable(() => "missing")(42);   // resolves to Ok(42)
		 * Task.Result.from.nullable(() => "missing")(null); // resolves to Err("missing")
		 * ```
		 */
		nullable: <E>(onNull: () => E) => <A>(value: A | null | undefined): Task.Result<E, A> =>
			Task.resolve(value === null || value === undefined ? CoreResult.make.err(onNull()) : CoreResult.make.ok(value)),

		/**
		 * Creates a Task.Result from a Maybe.
		 * Some becomes Ok, None becomes err from onNone.
		 *
		 * @example
		 * ```ts
		 * Task.Result.from.Maybe(() => "empty")(Maybe.make.some(42)); // resolves to Ok(42)
		 * Task.Result.from.Maybe(() => "empty")(Maybe.make.none());   // resolves to Err("empty")
		 * ```
		 */
		Maybe: <E>(onNone: () => E) => <A>(maybe: Maybe<A>): Task.Result<E, A> =>
			Task.resolve(CoreMaybe.is.none(maybe) ? CoreResult.make.err(onNone()) : CoreResult.make.ok(maybe.value)),

		/**
		 * Lifts a Result into a Task.Result.
		 *
		 * @example
		 * ```ts
		 * Task.Result.from.Result(Result.make.ok(42)); // resolves to Ok(42)
		 * ```
		 */
		Result: <E, A>(result: Result<E, A>): Task.Result<E, A> => Task.resolve(result),
	},

	// --- to ---
	to: {
		/**
		 * Converts a Task.Result to a Task.Maybe, dropping the error value on Err.
		 *
		 * @example
		 * ```ts
		 * const taskResult = Task.Result.make.ok(42);
		 * const taskMaybe = pipe(taskResult, Task.Result.to.Maybe);
		 * ```
		 */
		Maybe: <E, A>(data: Task.Result<E, A>): Task.Maybe<A> => Task.map(CoreResult.to.Maybe)(data),
	},

	/**
	 * Creates a Task.Result from a Promise-returning thunk that may throw or reject.
	 * Catches any errors and transforms them using the `onError` function into an `Err`.
	 * The thunk optionally receives an `AbortSignal` forwarded from the call site.
	 *
	 * @example
	 * ```ts
	 * const loadUser = Task.Result.tryCatch(
	 *   (signal) => userStore.get("u_123", { signal }),
	 *   { onError: (e) => new DbError(e) }
	 * );
	 * ```
	 */
	tryCatch:
		<E, A>(f: (signal?: AbortSignal) => Thenable<A>, options: { onError: (error: unknown) => E; }): Task.Result<E, A> =>
		(signal) =>
			Deferred.from.Promise(
				// oxlint-disable-next-line require-await
				globalThis.Promise.resolve().then(async () => f(signal)).then(CoreResult.make.ok).catch((error) =>
					CoreResult.make.err(options.onError(error))
				),
			),

	/**
	 * Transforms the success value inside a Task.Result.
	 */
	map: mapTaskResult,

	/**
	 * Transforms the error value inside a Task.Result.
	 */
	mapError: <E, F, A>(f: (e: E) => F) => (data: Task.Result<E, A>): Task.Result<F, A> =>
		Task.map(CoreResult.mapError<E, F, A>(f))(data),

	/**
	 * Chains Task.Result computations. If the first succeeds, passes the value to f.
	 * If the first fails, propagates the error.
	 */
	chain: chainTaskResult,

	/**
	 * Extracts the value from a Task.Result by providing handlers for both cases.
	 */
	fold: <E, A, B>(onErr: (e: E) => B, onOk: (a: A) => B) => (data: Task.Result<E, A>): Task<B> =>
		Task.map(CoreResult.fold(onErr, onOk))(data),

	/**
	 * Pattern matches on a Task.Result, returning a Task of the result.
	 */
	match: <E, A, B>(cases: { err: (e: E) => B; ok: (a: A) => B; }) => (data: Task.Result<E, A>): Task<B> =>
		Task.map(CoreResult.match<E, A, B>(cases))(data),

	/**
	 * Recovers from an error by providing a fallback Task.Result.
	 * The fallback can produce a different success type, widening the result to `Task.Result<E, A | B>`.
	 */
	recover: <E, B>(fallback: (e: E) => Task.Result<E, B>) => <A>(data: Task.Result<E, A>): Task.Result<E, A | B> =>
		Task.chain((result: Result<E, A>) =>
			CoreResult.is.err(result) ? fallback(result.error) : Task.resolve(result as Result<E, A | B>)
		)(data),

	/**
	 * Recovers from an error unless the predicate `isBlocked` returns true for that error.
	 * The fallback can produce a different success type, widening the result to `Task.Result<E, A | B>`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   fetchTask,
	 *   Task.Result.recoverUnless(
	 *     (e) => e === "fatal",
	 *     () => Task.Result.make.ok("fallback")
	 *   )
	 * );
	 * ```
	 */
	recoverUnless:
		<E, B>(isBlocked: (e: E) => boolean, fallback: (e: E) => Task.Result<E, B>) =>
		<A>(data: Task.Result<E, A>): Task.Result<E, A | B> =>
			Task.chain((result: Result<E, A>) =>
				CoreResult.is.err(result) && !isBlocked(result.error)
					? fallback(result.error)
					: Task.resolve(result as Result<E, A | B>)
			)(data),

	/**
	 * Returns the success value or a default value if the Task.Result is an error.
	 * The default can be a different type, widening the result to `Task<A | B>`.
	 */
	getOrElse: <B>(defaultValue: () => B) => <E, A>(data: Task.Result<E, A>): Task<A | B> =>
		Task.map(CoreResult.getOrElse<B>(defaultValue))(data),

	/**
	 * Executes a side effect on the success value without changing the Task.Result.
	 * Useful for logging or debugging.
	 */
	tap: <E, A>(f: (a: A) => void) => (data: Task.Result<E, A>): Task.Result<E, A> =>
		Task.map(CoreResult.tap<E, A>(f))(data),

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
	tapError: <E, A>(f: (e: E) => void) => (data: Task.Result<E, A>): Task.Result<E, A> =>
		Task.map(CoreResult.tapError<E, A>(f))(data),

	/**
	 * Applies a function wrapped in a Task.Result to a value wrapped in a Task.Result.
	 * Both Tasks run in parallel.
	 */
	ap: <E, A>(arg: Task.Result<E, A>) => <B>(data: Task.Result<E, (a: A) => B>): Task.Result<E, B> => (signal) =>
		Deferred.from.Promise(
			Promise.all([Deferred.to.Promise(data(signal)), Deferred.to.Promise(arg(signal))]).then(([of_, oa]) =>
				CoreResult.ap(oa)(of_)
			),
		),

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
	run: (signal?: AbortSignal) => <E, A>(task: Task.Result<E, A>): Deferred<Result<E, A>> => task(signal),

	/**
	 * Converts a Task.Result value into an object containing a single property.
	 * Initiates the pipeline accumulator record.
	 *
	 * @example
	 * ```ts
	 * pipe(Task.Result.make.ok(42), Task.Result.bindTo("value")); // Task.Result({ value: 42 })
	 * ```
	 */
	bindTo: <K extends string>(key: K) => <E, A>(data: Task.Result<E, A>): Task.Result<E, { [P in K]: A; }> =>
		mapTaskResult<E, A, { [P in K]: A; }>((a) => ({ [key]: a } as { [P in K]: A; }))(data),

	/**
	 * Evaluates a new Task.Result using the current accumulator and attaches the output to a new key.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Result.make.ok({ a: 1 }),
	 *   Task.Result.bind("b", ({ a }) => Task.Result.make.ok(a + 1))
	 * ); // Task.Result({ a: 1, b: 2 })
	 * ```
	 */
	bind:
		<K extends string, E, A, B>(key: K, f: (a: A) => Task.Result<E, B>) =>
		(data: Task.Result<E, A>): Task.Result<E, A & { [P in K]: B; }> =>
			chainTaskResult<E, A, A & { [P in K]: B; }>((a) =>
				mapTaskResult<E, B, A & { [P in K]: B; }>((b) => ({ ...(a as any), [key]: b } as A & { [P in K]: B; }))(f(a))
			)(data),

	/**
	 * Combines a record of Task.Results into a single Task.Result of a record.
	 * Evaluates all tasks in parallel, forwarding the AbortSignal down to each sub-task.
	 * Returns the first Err encountered in key order.
	 *
	 * @example
	 * ```ts
	 * Task.Result.struct({
	 *   name: Task.Result.make.ok("Alice"),
	 *   age: Task.Result.make.ok(30)
	 * }); // Task.Result({ name: "Alice", age: 30 })
	 * ```
	 */
	struct:
		<E, R extends Record<string, any>>(fields: { [K in keyof R]: Task.Result<E, R[K]>; }): Task.Result<E, R> =>
		(signal) =>
			Deferred.from.Promise((() => {
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
			})()),

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
	retry: (policy: RetryPolicy) => <E, A>(task: Task.Result<E, A>): Task.Result<E, A> => (signal) =>
		Deferred.from.Promise((() => {
			const { attempts } = policy;

			const wait = (duration: Duration): Promise<void> =>
				new Promise((res) => {
					// oxlint-disable-next-line prefer-const
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
		})()),

	/**
	 * Creates a memoized version of a Task.Result. The task is executed at most once on first call,
	 * and its resolved Result is cached for all subsequent calls.
	 *
	 * @example
	 * ```ts
	 * const loadConfig = Task.Result.memoize(fetchConfigTask);
	 * ```
	 */
	memoize: <E, A>(task: Task.Result<E, A>): Task.Result<E, A> => Task.memoize(task),

	/**
	 * Times out a fallible task, resolving to `Err(onTimeout())` if the duration elapses
	 * before the task completes.
	 *
	 * @example
	 * ```ts
	 * const fetchWithTimeout = pipe(
	 *   fetchTask,
	 *   Task.Result.timeout({ duration: Duration.seconds(5), onTimeout: () => "Request timed out" })
	 * );
	 * ```
	 */
	timeout:
		<E2>(options: { duration: Duration; onTimeout: () => E2; }) =>
		<E1 = never, A = unknown>(task: Task.Result<E1, A>): Task.Result<E1 | E2, A> =>
		(signal) =>
			Deferred.from.Promise(
				new Promise<Result<E1 | E2, A>>((resolve) => {
					const ms = Duration.to.milliseconds(options.duration);
					// oxlint-disable-next-line prefer-const
					let timerId: ReturnType<typeof setTimeout> | undefined;
					const onAbort = () => {
						clearTimeout(timerId);
					};

					if (signal) {
						if (signal.aborted) {
							return Deferred.to.Promise(task(signal)).then(resolve);
						}
						signal.addEventListener("abort", onAbort, { once: true });
					}

					timerId = setTimeout(() => {
						signal?.removeEventListener("abort", onAbort);
						resolve(CoreResult.make.err(options.onTimeout()));
					}, ms);

					Deferred.to.Promise(task(signal)).then((res) => {
						clearTimeout(timerId);
						signal?.removeEventListener("abort", onAbort);
						resolve(res);
					});
				}),
			),

	/**
	 * Runs a list of fallible tasks in parallel and collects all outcomes (`Ok` and `Err`)
	 * without short-circuiting on failure.
	 *
	 * @example
	 * ```ts
	 * const results = await Task.Result.allSettled([task1, task2, task3])();
	 * // [Ok(val1), Err(err2), Ok(val3)]
	 * ```
	 */
	allSettled: <E, A>(tasks: ReadonlyArray<Task.Result<E, A>>): Task<ReadonlyArray<Result<E, A>>> => (signal) =>
		Deferred.from.Promise(Promise.all(tasks.map((task) => Deferred.to.Promise(task(signal))))),
};
