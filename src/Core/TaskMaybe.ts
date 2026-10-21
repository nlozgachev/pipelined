import { type Thenable } from "#internal";
import { Deferred } from "./Deferred.ts";
import { type Maybe, Maybe as CoreMaybe } from "./Maybe.ts";
import { type Result, Result as CoreResult } from "./Result.ts";
import { Task } from "./Task.ts";

const makeSome = <A>(value: A): Task.Maybe<A> => Task.make(CoreMaybe.make.some(value));
const makeNone = <A = never>(): Task.Maybe<A> => Task.make(CoreMaybe.make.none());

const mapTaskMaybe = <A, B>(transform: (value: A) => B) => (task: Task.Maybe<A>): Task.Maybe<B> =>
	Task.map(CoreMaybe.map(transform))(task);

const chainTaskMaybe = <A, B>(transform: (value: A) => Task.Maybe<B>) => (task: Task.Maybe<A>): Task.Maybe<B> =>
	Task.chain((
		maybe: Maybe<A>,
	) => (CoreMaybe.is.some(maybe) ? transform(maybe.value) : Task.make(CoreMaybe.make.none())))(task);

export const TaskMaybe = {
	/**
	 * Wraps a value in a Some inside a Task.
	 *
	 * @example
	 * ```ts
	 * const task = Task.Maybe.make.some(42);
	 * const res = await task(); // Some(42)
	 * ```
	 */
	make: {
		/**
		 * Creates a Task.Maybe that resolves to Some(value).
		 *
		 * @example
		 * ```ts
		 * const task = Task.Maybe.make.some(42);
		 * const res = await task(); // Some(42)
		 * ```
		 */
		some: makeSome,

		/**
		 * Creates a Task.Maybe that resolves to None.
		 *
		 * @example
		 * ```ts
		 * const task = Task.Maybe.make.none();
		 * const res = await task(); // None
		 * ```
		 */
		none: makeNone,
	},

	// --- from ---
	from: {
		/**
		 * Lifts a Maybe into a Task.Maybe.
		 *
		 * @example
		 * ```ts
		 * Task.Maybe.from.Maybe(Maybe.make.some(42));
		 * ```
		 */
		Maybe: <A>(maybe: Maybe<A>): Task.Maybe<A> => Task.make(maybe),

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
		nullable: <A>(value: A | null | undefined): Task.Maybe<A> => Task.make(CoreMaybe.from.nullable(value)),

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
		Result: <E, A>(result: Result<E, A>): Task.Maybe<A> => Task.make(CoreResult.to.Maybe(result)),

		/**
		 * Lifts a Task into a Task.Maybe by wrapping its result in Some.
		 *
		 * @example
		 * ```ts
		 * Task.Maybe.from.Task(Task.make(42)); // resolves to Some(42)
		 * ```
		 */
		Task: <A>(task: Task<A>): Task.Maybe<A> => Task.map(CoreMaybe.make.some)(task),
	},

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
	tryCatch: <A>(fn: (signal?: AbortSignal) => Thenable<A>): Task.Maybe<A> => (signal) =>
		Deferred.from.Promise(Promise.resolve(fn(signal)).then(CoreMaybe.make.some).catch(() => CoreMaybe.make.none())),

	/**
	 * Transforms the value inside a Task.Maybe.
	 *
	 * @see {@link Task.Maybe.chain} to sequence operations that themselves return a Task.Maybe.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Maybe.make.some(5),
	 *   Task.Maybe.map(n => n * 2),
	 * ); // Task.Maybe resolving to Some(10)
	 * ```
	 */
	map: mapTaskMaybe,

	/**
	 * Chains Task.Maybe computations. If the first resolves to Some, passes the
	 * value to transform. If the first resolves to None, propagates None.
	 *
	 * @see {@link Task.Maybe.map} to transform the inner value without returning a new Task.Maybe.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   findUser("123"),
	 *   Task.Maybe.chain(user => findOrg(user.orgId))
	 * )();
	 * ```
	 */
	chain: chainTaskMaybe,

	/**
	 * Applies a function wrapped in a Task.Maybe to a value wrapped in a Task.Maybe.
	 * Both Tasks run in parallel.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Task.Maybe.make.some(add),
	 *   Task.Maybe.apply(Task.Maybe.make.some(5)),
	 *   Task.Maybe.apply(Task.Maybe.make.some(3)),
	 * ); // Task.Maybe resolving to Some(8)
	 * ```
	 */
	apply: <A>(arg: Task.Maybe<A>) => <B>(task: Task.Maybe<(value: A) => B>): Task.Maybe<B> => (signal) =>
		Deferred.from.Promise(
			Promise.all([Deferred.to.Promise(task(signal)), Deferred.to.Promise(arg(signal))]).then(([of_, oa]) =>
				CoreMaybe.apply(oa)(of_)
			),
		),

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
	match: <A, B>(cases: { none: () => B; some: (value: A) => B; }) => (task: Task.Maybe<A>): Task<B> =>
		Task.map(CoreMaybe.match(cases))(task),

	/**
	 * Returns the value or a default if the Task.Maybe resolves to None.
	 * The default can be a different type, widening the result to `Task<A | B>`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Maybe.make.none(),
	 *   Task.Maybe.getOrElse(() => 0),
	 * ); // Task resolving to 0
	 * ```
	 */
	getOrElse: <B>(fallback: () => B) => <A>(task: Task.Maybe<A>): Task<A | B> =>
		Task.map(CoreMaybe.getOrElse<B>(fallback))(task),

	/**
	 * Executes a side effect on the value without changing the Task.Maybe.
	 * Useful for logging or debugging.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Maybe.make.some(42),
	 *   Task.Maybe.tap(n => console.log("Value:", n)),
	 * );
	 * ```
	 */
	tap: <A>(sideEffect: (value: A) => void) => (task: Task.Maybe<A>): Task.Maybe<A> =>
		Task.map(CoreMaybe.tap(sideEffect))(task),

	/**
	 * Filters the value inside a Task.Maybe. Returns None if the predicate fails.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Maybe.make.some(42),
	 *   Task.Maybe.filter(n => n > 50),
	 * ); // Task.Maybe resolving to None
	 * ```
	 */
	filter: <A>(predicate: (value: A) => boolean) => (task: Task.Maybe<A>): Task.Maybe<A> =>
		Task.map(CoreMaybe.filter(predicate))(task),

	/**
	 * Executes a `Task.Maybe` with an optional signal, returning `Deferred<Maybe<A>>`.
	 * Use as a terminal step in a `pipe` chain.
	 *
	 * @example
	 * ```ts
	 * const result = await pipe(
	 *   Task.Maybe.make.some(42),
	 *   Task.Maybe.run(),
	 * );
	 * ```
	 */
	run: (signal?: AbortSignal) => <A>(task: Task.Maybe<A>): Deferred<Maybe<A>> => task(signal),

	// --- to ---
	to: {
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
		Result: <E>(onNone: () => E) => <A>(task: Task.Maybe<A>): Task.Result<E, A> =>
			Task.map(CoreMaybe.to.Result(onNone))(task),
	},

	/**
	 * Lifts a Task.Maybe value into an accumulator object.
	 *
	 * @example
	 * ```ts
	 * pipe(Task.Maybe.make.some(42), Task.Maybe.bindTo("value")); // Task.Maybe({ value: 42 })
	 * ```
	 */
	bindTo: <K extends string>(key: K) => <A>(task: Task.Maybe<A>): Task.Maybe<{ [P in K]: A; }> =>
		mapTaskMaybe<A, { [P in K]: A; }>((value) => ({ [key]: value } as { [P in K]: A; }))(task),

	/**
	 * Evaluates a new Task.Maybe using the current accumulator and attaches the output to a new key.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Maybe.make.some({ a: 1 }),
	 *   Task.Maybe.bind("b", ({ a }) => Task.Maybe.make.some(a + 1))
	 * ); // Task.Maybe({ a: 1, b: 2 })
	 * ```
	 */
	bind:
		<K extends string, A, B>(key: K, transform: (value: A) => Task.Maybe<B>) =>
		(task: Task.Maybe<A>): Task.Maybe<A & { [P in K]: B; }> =>
			chainTaskMaybe<A, A & { [P in K]: B; }>((acc) =>
				mapTaskMaybe<B, A & { [P in K]: B; }>((val) => ({ ...(acc as any), [key]: val } as A & { [P in K]: B; }))(
					transform(acc),
				)
			)(task),

	/**
	 * Recovers from a None state by providing a fallback Task.Maybe.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Maybe.make.none(),
	 *   Task.Maybe.recover(() => Task.Maybe.make.some(42))
	 * ); // Task.Maybe(42)
	 * ```
	 */
	recover: <B>(fallback: () => Task.Maybe<B>) => <A>(task: Task.Maybe<A>): Task.Maybe<A | B> =>
		Task.chain<Maybe<A>, Maybe<A | B>>((maybe) => (CoreMaybe.is.none(maybe) ? fallback() : Task.make(maybe)))(task),

	/**
	 * Combines a record of Task.Maybes into a single Task.Maybe of a record.
	 * Evaluates fields in parallel and returns None if any task resolves to None.
	 *
	 * @example
	 * ```ts
	 * Task.Maybe.struct({
	 *   name: Task.Maybe.make.some("Alice"),
	 *   age: Task.Maybe.make.some(30)
	 * }); // Task.Maybe({ name: "Alice", age: 30 })
	 * ```
	 */
	struct:
		<R extends Record<string, unknown>>(fields: { [K in keyof R]: Task.Maybe<R[K]>; }): Task.Maybe<R> => (signal) =>
			Deferred.from.Promise((() => {
				const keys = Object.keys(fields);
				const len = keys.length;
				const promises = new Array<Promise<Maybe<unknown>>>(len);
				for (let i = 0; i < len; i++) {
					promises[i] = Deferred.to.Promise(fields[keys[i]](signal));
				}
				return Promise.all(promises).then((results) => {
					const record = {} as R;
					for (let i = 0; i < len; i++) {
						const res = results[i] as Maybe<unknown>;
						if (CoreMaybe.is.none(res)) {
							return res;
						}
						record[keys[i] as keyof R] = res.value as R[keyof R];
					}
					return CoreMaybe.make.some(record);
				});
			})()),

	/**
	 * Creates a memoized version of a Task.Maybe. The task is executed at most once on first call,
	 * and its resolved Maybe is cached for all subsequent calls.
	 *
	 * @example
	 * ```ts
	 * const loadUser = Task.Maybe.memoize(fetchUserMaybeTask);
	 * ```
	 */
	memoize: <A>(task: Task.Maybe<A>): Task.Maybe<A> => Task.memoize(task),
};
