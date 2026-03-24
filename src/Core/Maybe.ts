import { WithKind, WithValue } from "./InternalTypes.ts";
import { Result } from "./Result.ts";

/**
 * Maybe represents an optional value: every Maybe is either Some (contains a value) or None (empty).
 * Use Maybe instead of null/undefined to make optionality explicit and composable.
 *
 * @example
 * ```ts
 * const findUser = (id: string): Maybe<User> =>
 *   users.has(id) ? Maybe.some(users.get(id)!) : Maybe.none();
 *
 * pipe(
 *   findUser("123"),
 *   Maybe.map(user => user.name),
 *   Maybe.getOrElse(() => "Unknown")
 * );
 * ```
 */
export type Maybe<T> = Some<T> | None;

export type Some<A> = WithKind<"Some"> & WithValue<A>;
export type None = WithKind<"None">;

const _none: None = { kind: "None" };

export namespace Maybe {
	/**
	 * Creates a Some containing the given value.
	 */
	export const some = <A>(value: A): Some<A> => ({ kind: "Some", value });

	/**
	 * Type guard that checks if a Maybe is Some.
	 */
	export const isSome = <A>(data: Maybe<A>): data is Some<A> => data.kind === "Some";

	/**
	 * Creates a None (empty Maybe).
	 */
	export const none = (): None => _none;

	/**
	 * Type guard that checks if a Maybe is None.
	 */
	export const isNone = <A>(data: Maybe<A>): data is None => data.kind === "None";

	/**
	 * Creates a Maybe from a nullable value.
	 * Returns None if the value is null or undefined, Some otherwise.
	 *
	 * @example
	 * ```ts
	 * Maybe.fromNullable(null); // None
	 * Maybe.fromNullable(42); // Some(42)
	 * ```
	 */
	export const fromNullable = <A>(value: A | null | undefined): Maybe<A> =>
		value === null || value === undefined ? none() : some(value);

	/**
	 * Extracts the value from a Maybe, returning null if None.
	 */
	export const toNullable = <A>(data: Maybe<A>): A | null => isSome(data) ? data.value : null;

	/**
	 * Extracts the value from a Maybe, returning undefined if None.
	 */
	export const toUndefined = <A>(data: Maybe<A>): A | undefined => isSome(data) ? data.value : undefined;

	/**
	 * Creates a Maybe from a possibly undefined value.
	 * Returns None if undefined, Some otherwise.
	 */
	export const fromUndefined = <A>(value: A | undefined): Maybe<A> => value === undefined ? none() : some(value);

	/**
	 * Converts an Maybe to a Result.
	 * Some becomes Ok, None becomes Err with the provided error.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Maybe.some(42),
	 *   Maybe.toResult(() => "Value was missing")
	 * ); // Ok(42)
	 *
	 * pipe(
	 *   Maybe.none(),
	 *   Maybe.toResult(() => "Value was missing")
	 * ); // Err("Value was missing")
	 * ```
	 */
	export const toResult = <E>(onNone: () => E) => <A>(data: Maybe<A>): Result<E, A> =>
		isSome(data) ? Result.ok(data.value) : Result.err(onNone());

	/**
	 * Creates an Maybe from a Result.
	 * Ok becomes Some, Err becomes None (the error is discarded).
	 *
	 * @example
	 * ```ts
	 * Maybe.fromResult(Result.ok(42)); // Some(42)
	 * Maybe.fromResult(Result.err("oops")); // None
	 * ```
	 */
	export const fromResult = <E, A>(data: Result<E, A>): Maybe<A> => Result.isOk(data) ? some(data.value) : none();

	/**
	 * Transforms the value inside a Maybe if it exists.
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.some(5), Maybe.map(n => n * 2)); // Some(10)
	 * pipe(Maybe.none(), Maybe.map(n => n * 2)); // None
	 * ```
	 */
	export const map = <A, B>(f: (a: A) => B) => (data: Maybe<A>): Maybe<B> => isSome(data) ? some(f(data.value)) : data;

	/**
	 * Chains Maybe computations. If the first is Some, passes the value to f.
	 * If the first is None, propagates None.
	 *
	 * @example
	 * ```ts
	 * const parseNumber = (s: string): Maybe<number> => {
	 *   const n = parseInt(s, 10);
	 *   return isNaN(n) ? Maybe.none() : Maybe.some(n);
	 * };
	 *
	 * pipe(Maybe.some("42"), Maybe.chain(parseNumber)); // Some(42)
	 * pipe(Maybe.some("abc"), Maybe.chain(parseNumber)); // None
	 * ```
	 */
	export const chain = <A, B>(f: (a: A) => Maybe<B>) => (data: Maybe<A>): Maybe<B> =>
		isSome(data) ? f(data.value) : data;

	/**
	 * Extracts the value from a Maybe by providing handlers for both cases.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Maybe.some(5),
	 *   Maybe.fold(
	 *     () => "No value",
	 *     n => `Value: ${n}`
	 *   )
	 * ); // "Value: 5"
	 * ```
	 */
	export const fold = <A, B>(onNone: () => B, onSome: (a: A) => B) => (data: Maybe<A>): B =>
		isSome(data) ? onSome(data.value) : onNone();

	/**
	 * Pattern matches on a Maybe, returning the result of the matching case.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   optionUser,
	 *   Maybe.match({
	 *     some: user => `Hello, ${user.name}`,
	 *     none: () => "Hello, stranger"
	 *   })
	 * );
	 * ```
	 */
	export const match = <A, B>(cases: { none: () => B; some: (a: A) => B; }) => (data: Maybe<A>): B =>
		isSome(data) ? cases.some(data.value) : cases.none();

	/**
	 * Returns the value inside an Maybe, or a default value if None.
	 * The default is a thunk `() => B` — evaluated only when the Maybe is None.
	 * The default can be a different type, widening the result to `A | B`.
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.some(5), Maybe.getOrElse(() => 0)); // 5
	 * pipe(Maybe.none(), Maybe.getOrElse(() => 0)); // 0
	 * pipe(Maybe.none<string>(), Maybe.getOrElse(() => null)); // null — typed as string | null
	 * ```
	 */
	export const getOrElse = <A, B>(defaultValue: () => B) => (data: Maybe<A>): A | B =>
		isSome(data) ? data.value : defaultValue();

	/**
	 * Executes a side effect on the value without changing the Maybe.
	 * Useful for logging or debugging.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Maybe.some(5),
	 *   Maybe.tap(n => console.log("Value:", n)),
	 *   Maybe.map(n => n * 2)
	 * );
	 * ```
	 */
	export const tap = <A>(f: (a: A) => void) => (data: Maybe<A>): Maybe<A> => {
		if (isSome(data)) f(data.value);
		return data;
	};

	/**
	 * Filters a Maybe based on a predicate.
	 * Returns None if the predicate returns false or if the Maybe is already None.
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.some(5), Maybe.filter(n => n > 3)); // Some(5)
	 * pipe(Maybe.some(2), Maybe.filter(n => n > 3)); // None
	 * ```
	 */
	export const filter = <A>(predicate: (a: A) => boolean) => (data: Maybe<A>): Maybe<A> =>
		isSome(data) ? (predicate(data.value) ? data : none()) : data;

	/**
	 * Recovers from a None by providing a fallback Maybe.
	 * The fallback can produce a different type, widening the result to `Maybe<A | B>`.
	 */
	export const recover = <A, B>(fallback: () => Maybe<B>) => (data: Maybe<A>): Maybe<A | B> =>
		isSome(data) ? data : fallback();

	/**
	 * Applies a function wrapped in a Maybe to a value wrapped in a Maybe.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Maybe.some(add),
	 *   Maybe.ap(Maybe.some(5)),
	 *   Maybe.ap(Maybe.some(3))
	 * ); // Some(8)
	 * ```
	 */
	export const ap = <A>(arg: Maybe<A>) => <B>(data: Maybe<(a: A) => B>): Maybe<B> =>
		isSome(data) && isSome(arg) ? some(data.value(arg.value)) : none();
}
