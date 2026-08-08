import { Deferred, Maybe, Maybe as CoreMaybe, Result, Result as CoreResult, type Task, Task as CoreTask } from "#core";
import { type Thenable } from "#internal";

/**
 * TaskMaybe represents a lazy, infallible async operation that resolves to a `Maybe<A>`.
 * It is a type alias for `Task<Maybe<A>>`.
 *
 * Use Task.Maybe for async operations that can result in a missing value (e.g. database lookups).
 *
 * @example
 * ```ts
 * const findUser = (id: string): Task.Maybe<User> =>
 *   Task.Maybe.tryCatch((signal) =>
 *     fetch(`/users/${id}`, { signal }).then(r => r.ok ? r.json() : null)
 *   );
 * ```
 */
export type TaskMaybe<A> = Task<Maybe<A>>;

export namespace TaskMaybe {
	/**
	 * Wraps a value in a Some inside a Task.
	 *
	 * @example
	 * ```ts
	 * const task = Task.Maybe.some(42);
	 * const res = await task(); // Some(42)
	 * ```
	 */
	export const some = <A>(value: A): TaskMaybe<A> => CoreTask.resolve(CoreMaybe.make.some(value));

	/**
	 * Creates a Task.Maybe that resolves to None.
	 *
	 * @example
	 * ```ts
	 * const task = Task.Maybe.none();
	 * const res = await task(); // None
	 * ```
	 */
	export const none = <A = never>(): TaskMaybe<A> => CoreTask.resolve(CoreMaybe.make.none());

	// --- from ---
	export namespace from {
		/**
		 * Lifts a Maybe into a Task.Maybe.
		 *
		 * @example
		 * ```ts
		 * Task.Maybe.from.Maybe(Maybe.make.some(42));
		 * ```
		 */
		export const Maybe = <A>(option: Maybe<A>): TaskMaybe<A> => CoreTask.resolve(option);

		/**
		 * Creates a Task.Maybe from a nullable value.
		 * Returns Some if the value is not null or undefined, None otherwise.
		 *
		 * @example
		 * ```ts
		 * Task.Maybe.from.nullable(42);   // resolves to Some(42)
		 * Task.Maybe.from.nullable(null); // resolves to None
		 * ```
		 */
		export const nullable = <A>(value: A | null | undefined): TaskMaybe<A> =>
			CoreTask.resolve(CoreMaybe.from.nullable(value));

		/**
		 * Creates a Task.Maybe from a Result.
		 * Ok becomes Some, Error becomes None (the error value is discarded).
		 *
		 * @example
		 * ```ts
		 * Task.Maybe.from.Result(Result.make.ok(42)); // resolves to Some(42)
		 * Task.Maybe.from.Result(Result.make.err("e")); // resolves to None
		 * ```
		 */
		export const Result = <E, A>(result: Result<E, A>): TaskMaybe<A> => CoreTask.resolve(CoreResult.to.Maybe(result));

		/**
		 * Lifts a Task into a Task.Maybe by wrapping its result in Some.
		 *
		 * @example
		 * ```ts
		 * Task.Maybe.from.Task(Task.resolve(42)); // resolves to Some(42)
		 * ```
		 */
		export const Task = <A>(task: Task<A>): TaskMaybe<A> => CoreTask.map(CoreMaybe.make.some)(task);
	}

	/**
	 * Creates a Task.Maybe from a Promise-returning function.
	 * Returns Some if the promise resolves, None if it rejects.
	 * The factory optionally receives an `AbortSignal` forwarded from the call site.
	 *
	 * @example
	 * ```ts
	 * const fetchUser = Task.Maybe.tryCatch((signal) =>
	 *   fetch("/user/1", { signal }).then(r => r.json())
	 * );
	 * ```
	 */
	export const tryCatch = <A>(f: (signal?: AbortSignal) => Thenable<A>): TaskMaybe<A> =>
		CoreTask.from.Promise((signal) =>
			Promise.resolve(f(signal)).then(CoreMaybe.make.some).catch(() => CoreMaybe.make.none())
		);

	/**
	 * Transforms the value inside a Task.Maybe.
	 */
	export const map = <A, B>(f: (a: A) => B) => (data: TaskMaybe<A>): TaskMaybe<B> =>
		CoreTask.map(CoreMaybe.map(f))(data);

	/**
	 * Chains Task.Maybe computations. If the first resolves to Some, passes the
	 * value to f. If the first resolves to None, propagates None.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   findUser("123"),
	 *   Task.Maybe.chain(user => findOrg(user.orgId))
	 * )();
	 * ```
	 */
	export const chain = <A, B>(f: (a: A) => TaskMaybe<B>) => (data: TaskMaybe<A>): TaskMaybe<B> =>
		CoreTask.chain((option: Maybe<A>) =>
			CoreMaybe.is.some(option) ? f(option.value) : CoreTask.resolve(CoreMaybe.make.none())
		)(data);

	/**
	 * Applies a function wrapped in a Task.Maybe to a value wrapped in a Task.Maybe.
	 * Both Tasks run in parallel.
	 */
	export const ap = <A>(arg: TaskMaybe<A>) => <B>(data: TaskMaybe<(a: A) => B>): TaskMaybe<B> =>
		CoreTask.from.Promise((signal) =>
			Promise.all([Deferred.to.Promise(data(signal)), Deferred.to.Promise(arg(signal))]).then(([of_, oa]) =>
				CoreMaybe.ap(oa)(of_)
			)
		);

	/**
	 * Extracts a value from a Task.Maybe by providing handlers for both cases.
	 */
	export const fold = <A, B>(onNone: () => B, onSome: (a: A) => B) => (data: TaskMaybe<A>): Task<B> =>
		CoreTask.map(CoreMaybe.fold(onNone, onSome))(data);

	/**
	 * Pattern matches on a Task.Maybe, returning a Task of the result.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   findUser("123"),
	 *   Task.Maybe.match({
	 *     some: user => `Hello, ${user.name}`,
	 *     none: () => "User not found"
	 *   })
	 * )();
	 * ```
	 */
	export const match = <A, B>(cases: { none: () => B; some: (a: A) => B; }) => (data: TaskMaybe<A>): Task<B> =>
		CoreTask.map(CoreMaybe.match(cases))(data);

	/**
	 * Returns the value or a default if the Task.Maybe resolves to None.
	 * The default can be a different type, widening the result to `Task<A | B>`.
	 */
	export const getOrElse = <A, B>(defaultValue: () => B) => (data: TaskMaybe<A>): Task<A | B> =>
		CoreTask.map(CoreMaybe.getOrElse<A, B>(defaultValue))(data);

	/**
	 * Executes a side effect on the value without changing the Task.Maybe.
	 * Useful for logging or debugging.
	 */
	export const tap = <A>(f: (a: A) => void) => (data: TaskMaybe<A>): TaskMaybe<A> =>
		CoreTask.map(CoreMaybe.tap(f))(data);

	/**
	 * Filters the value inside a Task.Maybe. Returns None if the predicate fails.
	 */
	export const filter = <A>(predicate: (a: A) => boolean) => (data: TaskMaybe<A>): TaskMaybe<A> =>
		CoreTask.map(CoreMaybe.filter(predicate))(data);

	// --- to ---
	export namespace to {
		/**
		 * Converts a Task.Maybe to a Task.Result, using onNone to produce the error value.
		 *
		 * @example
		 * ```ts
		 * pipe(
		 *   findUser("123"),
		 *   Task.Maybe.to.Result(() => "User not found")
		 * );
		 * ```
		 */
		export const Result = <E>(onNone: () => E) => <A>(data: TaskMaybe<A>): Task.Result<E, A> =>
			CoreTask.map(CoreMaybe.to.Result(onNone))(data);
	}

	/**
	 * Lifts a Task.Maybe value into an accumulator object.
	 *
	 * @example
	 * ```ts
	 * pipe(Task.Maybe.some(42), Task.Maybe.bindTo("value")); // Task.Maybe({ value: 42 })
	 * ```
	 */
	export const bindTo = <K extends string>(key: K) => <A>(data: TaskMaybe<A>): TaskMaybe<{ [P in K]: A; }> =>
		map<A, { [P in K]: A; }>((a) => ({ [key]: a } as { [P in K]: A; }))(data);

	/**
	 * Evaluates a new Task.Maybe using the current accumulator and attaches the output to a new key.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Maybe.some({ a: 1 }),
	 *   Task.Maybe.bind("b", ({ a }) => Task.Maybe.some(a + 1))
	 * ); // Task.Maybe({ a: 1, b: 2 })
	 * ```
	 */
	export const bind =
		<K extends string, A, B>(key: K, f: (a: A) => TaskMaybe<B>) =>
		(data: TaskMaybe<A>): TaskMaybe<A & { [P in K]: B; }> =>
			chain<A, A & { [P in K]: B; }>((a) =>
				map<B, A & { [P in K]: B; }>((b) => ({ ...(a as any), [key]: b } as A & { [P in K]: B; }))(f(a))
			)(data);

	/**
	 * Recovers from a None state by providing a fallback Task.Maybe.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Maybe.none(),
	 *   Task.Maybe.recover(() => Task.Maybe.some(42))
	 * ); // Task.Maybe(42)
	 * ```
	 */
	export const recover = <A, B>(fallback: () => TaskMaybe<B>) => (data: TaskMaybe<A>): TaskMaybe<A | B> =>
		CoreTask.chain<Maybe<A>, Maybe<A | B>>((maybe) => (CoreMaybe.is.none(maybe) ? fallback() : CoreTask.resolve(maybe)))(
			data,
		);

	/**
	 * Combines a record of Task.Maybes into a single Task.Maybe of a record.
	 * Evaluates fields in parallel and returns None if any task resolves to None.
	 *
	 * @example
	 * ```ts
	 * Task.Maybe.struct({
	 *   name: Task.Maybe.some("Alice"),
	 *   age: Task.Maybe.some(30)
	 * }); // Task.Maybe({ name: "Alice", age: 30 })
	 * ```
	 */
	export const struct = <R extends Record<string, any>>(fields: { [K in keyof R]: TaskMaybe<R[K]>; }): TaskMaybe<R> =>
		CoreTask.from.Promise((signal) => {
			const keys = Object.keys(fields);
			const promises = keys.map((key) => Deferred.to.Promise(fields[key](signal)));
			return Promise.all(promises).then((results) => {
				const record = {} as R;
				for (let i = 0; i < keys.length; i++) {
					const res = results[i] as Maybe<any>;
					if (CoreMaybe.is.none(res)) {
						return res;
					}
					record[keys[i] as keyof R] = res.value;
				}
				return CoreMaybe.make.some(record);
			});
		});
}
