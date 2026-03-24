import { Deferred } from "./Deferred.ts";
import { Maybe } from "./Maybe.ts";
import { Task } from "./Task.ts";
import { TaskResult } from "./TaskResult.ts";

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
	 * Lifts a Task into a TaskMaybe by wrapping its result in Some.
	 */
	export const fromTask = <A>(task: Task<A>): TaskMaybe<A> => Task.map(Maybe.some)(task);

	/**
	 * Creates a TaskMaybe from a Promise-returning function.
	 * Returns Some if the promise resolves, None if it rejects.
	 *
	 * @example
	 * ```ts
	 * const fetchUser = TaskMaybe.tryCatch(() =>
	 *   fetch("/user/1").then(r => r.json())
	 * );
	 * ```
	 */
	export const tryCatch = <A>(f: () => Promise<A>): TaskMaybe<A> =>
		Task.from(() =>
			f()
				.then(Maybe.some)
				.catch(() => Maybe.none())
		);

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
		Task.from(() =>
			Promise.all([
				Deferred.toPromise(data()),
				Deferred.toPromise(arg()),
			]).then(([of_, oa]) => Maybe.ap(oa)(of_))
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
	 * Converts a TaskMaybe to a TaskResult, using onNone to produce the error value.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   findUser("123"),
	 *   TaskMaybe.toTaskResult(() => "User not found")
	 * );
	 * ```
	 */
	export const toTaskResult = <E>(onNone: () => E) => <A>(data: TaskMaybe<A>): TaskResult<E, A> =>
		Task.map(Maybe.toResult(onNone))(data);
}
