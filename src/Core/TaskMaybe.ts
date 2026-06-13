import { Deferred, Maybe, Result, Task } from "#core";
import type { Thenable } from "#internal";

/**
 * A Task that resolves to an optional value.
 * Combines async operations with the Maybe type for values that may not exist.
 *
 * @example
 * ```ts
 * const findUser = (id: string): TaskMaybe<User> =>
 *   TaskMaybe.tryCatch(() => db.users.findById(id));
 *
 * pipe(
 *   findUser("123"),
 *   TaskMaybe.map(user => user.name),
 *   TaskMaybe.getOrElse(() => "Unknown")
 * )();
 * ```
 */
export type TaskMaybe<A> = Task<Maybe<A>>;

export namespace TaskMaybe {
	/**
	 * Wraps a value in a Some inside a Task.
	 */
	export const some = <A>(value: A): TaskMaybe<A> => Task.resolve(Maybe.some(value));

	/**
	 * Creates a TaskMaybe that resolves to None.
	 */
	export const none = <A = never>(): TaskMaybe<A> => Task.resolve(Maybe.none());

	/**
	 * Lifts an Option into a TaskMaybe.
	 */
	export const fromMaybe = <A>(option: Maybe<A>): TaskMaybe<A> => Task.resolve(option);

	/**
	 * Creates a TaskMaybe from a nullable value.
	 * Returns Some if the value is not null or undefined, None otherwise.
	 */
	export const fromNullable = <A>(value: A | null | undefined): TaskMaybe<A> => Task.resolve(Maybe.fromNullable(value));

	/**
	 * Creates a TaskMaybe from a Result.
	 * Ok becomes Some, Error becomes None (the error value is discarded).
	 */
	export const fromResult = <E, A>(result: Result<E, A>): TaskMaybe<A> => Task.resolve(Result.toMaybe(result));

	/**
	 * Lifts a Task into a TaskMaybe by wrapping its result in Some.
	 */
	export const fromTask = <A>(task: Task<A>): TaskMaybe<A> => Task.map(Maybe.some)(task);

	/**
	 * Creates a TaskMaybe from a Promise-returning function.
	 * Returns Some if the promise resolves, None if it rejects.
	 * The factory optionally receives an `AbortSignal` forwarded from the call site.
	 *
	 * @example
	 * ```ts
	 * const fetchUser = TaskMaybe.tryCatch((signal) =>
	 *   fetch("/user/1", { signal }).then(r => r.json())
	 * );
	 * ```
	 */
	export const tryCatch = <A>(f: (signal?: AbortSignal) => Thenable<A>): TaskMaybe<A> =>
		Task.from((signal) => Promise.resolve(f(signal)).then(Maybe.some).catch(() => Maybe.none()));

	/**
	 * Transforms the value inside a TaskMaybe.
	 */
	export const map = <A, B>(f: (a: A) => B) => (data: TaskMaybe<A>): TaskMaybe<B> => Task.map(Maybe.map(f))(data);

	/**
	 * Chains TaskMaybe computations. If the first resolves to Some, passes the
	 * value to f. If the first resolves to None, propagates None.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   findUser("123"),
	 *   TaskMaybe.chain(user => findOrg(user.orgId))
	 * )();
	 * ```
	 */
	export const chain = <A, B>(f: (a: A) => TaskMaybe<B>) => (data: TaskMaybe<A>): TaskMaybe<B> =>
		Task.chain((option: Maybe<A>) => Maybe.isSome(option) ? f(option.value) : Task.resolve(Maybe.none()))(data);

	/**
	 * Applies a function wrapped in a TaskMaybe to a value wrapped in a TaskMaybe.
	 * Both Tasks run in parallel.
	 */
	export const ap = <A>(arg: TaskMaybe<A>) => <B>(data: TaskMaybe<(a: A) => B>): TaskMaybe<B> =>
		Task.from((signal) =>
			Promise.all([Deferred.toPromise(data(signal)), Deferred.toPromise(arg(signal))]).then(([of_, oa]) =>
				Maybe.ap(oa)(of_)
			)
		);

	/**
	 * Extracts a value from a TaskMaybe by providing handlers for both cases.
	 */
	export const fold = <A, B>(onNone: () => B, onSome: (a: A) => B) => (data: TaskMaybe<A>): Task<B> =>
		Task.map(Maybe.fold(onNone, onSome))(data);

	/**
	 * Pattern matches on a TaskMaybe, returning a Task of the result.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   findUser("123"),
	 *   TaskMaybe.match({
	 *     some: user => `Hello, ${user.name}`,
	 *     none: () => "User not found"
	 *   })
	 * )();
	 * ```
	 */
	export const match = <A, B>(cases: { none: () => B; some: (a: A) => B; }) => (data: TaskMaybe<A>): Task<B> =>
		Task.map(Maybe.match(cases))(data);

	/**
	 * Returns the value or a default if the TaskMaybe resolves to None.
	 * The default can be a different type, widening the result to `Task<A | B>`.
	 */
	export const getOrElse = <A, B>(defaultValue: () => B) => (data: TaskMaybe<A>): Task<A | B> =>
		Task.map(Maybe.getOrElse<A, B>(defaultValue))(data);

	/**
	 * Executes a side effect on the value without changing the TaskMaybe.
	 * Useful for logging or debugging.
	 */
	export const tap = <A>(f: (a: A) => void) => (data: TaskMaybe<A>): TaskMaybe<A> => Task.map(Maybe.tap(f))(data);

	/**
	 * Filters the value inside a TaskMaybe. Returns None if the predicate fails.
	 */
	export const filter = <A>(predicate: (a: A) => boolean) => (data: TaskMaybe<A>): TaskMaybe<A> =>
		Task.map(Maybe.filter(predicate))(data);

	/**
	 * Converts a TaskMaybe to a Task.Result, using onNone to produce the error value.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   findUser("123"),
	 *   TaskMaybe.toResult(() => "User not found")
	 * );
	 * ```
	 */
	export const toResult = <E>(onNone: () => E) => <A>(data: TaskMaybe<A>): Task.Result<E, A> =>
		Task.map(Maybe.toResult(onNone))(data);

	/**
	 * Lifts a TaskMaybe value into an accumulator object.
	 *
	 * @example
	 * ```ts
	 * pipe(TaskMaybe.some(42), TaskMaybe.bindTo("value")); // TaskMaybe({ value: 42 })
	 * ```
	 */
	export const bindTo = <K extends string>(key: K) => <A>(data: TaskMaybe<A>): TaskMaybe<{ [P in K]: A; }> =>
		map<A, { [P in K]: A; }>((a) => ({ [key]: a } as { [P in K]: A; }))(data);

	/**
	 * Evaluates a new TaskMaybe using the current accumulator and attaches the output to a new key.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   TaskMaybe.some({ a: 1 }),
	 *   TaskMaybe.bind("b", ({ a }) => TaskMaybe.some(a + 1))
	 * ); // TaskMaybe({ a: 1, b: 2 })
	 * ```
	 */
	export const bind =
		<K extends string, A, B>(key: K, f: (a: A) => TaskMaybe<B>) =>
		(data: TaskMaybe<A>): TaskMaybe<A & { [P in K]: B; }> =>
			chain<A, A & { [P in K]: B; }>((a) =>
				map<B, A & { [P in K]: B; }>((b) => ({ ...(a as any), [key]: b } as A & { [P in K]: B; }))(f(a))
			)(data);

	/**
	 * Recovers from a None state by providing a fallback TaskMaybe.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   TaskMaybe.none(),
	 *   TaskMaybe.recover(() => TaskMaybe.some(42))
	 * ); // TaskMaybe(42)
	 * ```
	 */
	export const recover = <A, B>(fallback: () => TaskMaybe<B>) => (data: TaskMaybe<A>): TaskMaybe<A | B> =>
		Task.chain<Maybe<A>, Maybe<A | B>>((maybe) => (Maybe.isNone(maybe) ? fallback() : Task.resolve(maybe)))(data);

	/**
	 * Combines a record of TaskMaybes into a single TaskMaybe of a record.
	 * Evaluates fields in parallel and returns None if any task resolves to None.
	 *
	 * @example
	 * ```ts
	 * TaskMaybe.struct({
	 *   name: TaskMaybe.some("Alice"),
	 *   age: TaskMaybe.some(30)
	 * }); // TaskMaybe({ name: "Alice", age: 30 })
	 * ```
	 */
	export const struct = <R extends Record<string, any>>(fields: { [K in keyof R]: TaskMaybe<R[K]>; }): TaskMaybe<R> =>
		Task.from((signal) => {
			const keys = Object.keys(fields);
			const promises = keys.map((key) => Deferred.toPromise(fields[key](signal)));
			return Promise.all(promises).then((results) => {
				const record = {} as R;
				for (let i = 0; i < keys.length; i++) {
					const res = results[i] as Maybe<any>;
					if (Maybe.isNone(res)) {
						return res;
					}
					record[keys[i] as keyof R] = res.value;
				}
				return Maybe.some(record);
			});
		});
}
