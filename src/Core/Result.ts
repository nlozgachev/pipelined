import { WithError, WithKind, WithValue } from "./InternalTypes.ts";
import { Maybe } from "./Maybe.ts";

/**
 * Result represents a value that can be one of two types: a success (Ok) or a failure (Error).
 * Use Result when an operation can fail with a meaningful error value.
 *
 * @example
 * ```ts
 * const divide = (a: number, b: number): Result<string, number> =>
 *   b === 0 ? Result.error("Division by zero") : Result.ok(a / b);
 *
 * pipe(
 *   divide(10, 2),
 *   Result.map(n => n * 2),
 *   Result.getOrElse(() => 0)
 * ); // 10
 * ```
 */
export type Result<E, A> = Ok<A> | Error<E>;

export type Ok<A> = WithKind<"Ok"> & WithValue<A>;
export type Error<E> = WithKind<"Error"> & WithError<E>;

export namespace Result {
	/**
	 * Creates a successful Result with the given value.
	 */
	export const ok = <A>(value: A): Ok<A> => ({ kind: "Ok", value });

	/**
	 * Creates a failed Result with the given error.
	 */
	export const error = <E>(e: E): Error<E> => ({ kind: "Error", error: e });

	/**
	 * Type guard that checks if an Result is Ok.
	 */
	export const isOk = <E, A>(data: Result<E, A>): data is Ok<A> => data.kind === "Ok";

	/**
	 * Type guard that checks if an Result is Error.
	 */
	export const isError = <E, A>(data: Result<E, A>): data is Error<E> => data.kind === "Error";

	/**
	 * Creates an Result from a function that may throw.
	 * Catches any errors and transforms them using the onError function.
	 *
	 * @example
	 * ```ts
	 * const parseJson = (s: string): Result<string, unknown> =>
	 *   Result.tryCatch(
	 *     () => JSON.parse(s),
	 *     (e) => `Parse error: ${e}`
	 *   );
	 * ```
	 */
	export const tryCatch = <E, A>(
		f: () => A,
		onError: (e: unknown) => E,
	): Result<E, A> => {
		try {
			return ok(f());
		} catch (e) {
			return error(onError(e));
		}
	};

	/**
	 * Transforms the success value inside an Result.
	 *
	 * @example
	 * ```ts
	 * pipe(Result.ok(5), Result.map(n => n * 2)); // Ok(10)
	 * pipe(Result.error("error"), Result.map(n => n * 2)); // Error("error")
	 * ```
	 */
	export const map = <E, A, B>(f: (a: A) => B) => (data: Result<E, A>): Result<E, B> =>
		isOk(data) ? ok(f(data.value)) : data;

	/**
	 * Transforms the error value inside an Result.
	 *
	 * @example
	 * ```ts
	 * pipe(Result.error("oops"), Result.mapError(e => e.toUpperCase())); // Error("OOPS")
	 * ```
	 */
	export const mapError = <E, F, A>(f: (e: E) => F) => (data: Result<E, A>): Result<F, A> =>
		isError(data) ? error(f(data.error)) : data;

	/**
	 * Chains Result computations. If the first is Ok, passes the value to f.
	 * If the first is Err, propagates the error.
	 *
	 * @example
	 * ```ts
	 * const validatePositive = (n: number): Result<string, number> =>
	 *   n > 0 ? Result.ok(n) : Result.error("Must be positive");
	 *
	 * pipe(Result.ok(5), Result.chain(validatePositive)); // Ok(5)
	 * pipe(Result.ok(-1), Result.chain(validatePositive)); // Error("Must be positive")
	 * ```
	 */
	export const chain = <E, A, B>(f: (a: A) => Result<E, B>) => (data: Result<E, A>): Result<E, B> =>
		isOk(data) ? f(data.value) : data;

	/**
	 * Extracts the value from an Result by providing handlers for both cases.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Result.ok(5),
	 *   Result.fold(
	 *     e => `Error: ${e}`,
	 *     n => `Value: ${n}`
	 *   )
	 * ); // "Value: 5"
	 * ```
	 */
	export const fold = <E, A, B>(onErr: (e: E) => B, onOk: (a: A) => B) => (data: Result<E, A>): B =>
		isOk(data) ? onOk(data.value) : onErr((data as Error<E>).error);

	/**
	 * Pattern matches on a Result, returning the result of the matching case.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   result,
	 *   Result.match({
	 *     ok: value => `Got ${value}`,
	 *     err: error => `Failed: ${error}`
	 *   })
	 * );
	 * ```
	 */
	export const match = <E, A, B>(cases: { ok: (a: A) => B; err: (e: E) => B; }) => (data: Result<E, A>): B =>
		isOk(data) ? cases.ok(data.value) : cases.err((data as Error<E>).error);

	/**
	 * Returns the success value or a default value if the Result is an error.
	 * The default is a thunk `() => B` — evaluated only when the Result is Err.
	 * The default can be a different type, widening the result to `A | B`.
	 *
	 * @example
	 * ```ts
	 * pipe(Result.ok(5), Result.getOrElse(() => 0)); // 5
	 * pipe(Result.error("error"), Result.getOrElse(() => 0)); // 0
	 * pipe(Result.error("error"), Result.getOrElse(() => null)); // null — typed as number | null
	 * ```
	 */
	export const getOrElse = <E, A, B>(defaultValue: () => B) => (data: Result<E, A>): A | B =>
		isOk(data) ? data.value : defaultValue();

	/**
	 * Executes a side effect on the success value without changing the Result.
	 * Useful for logging or debugging.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Result.ok(5),
	 *   Result.tap(n => console.log("Value:", n)),
	 *   Result.map(n => n * 2)
	 * );
	 * ```
	 */
	export const tap = <E, A>(f: (a: A) => void) => (data: Result<E, A>): Result<E, A> => {
		if (isOk(data)) f(data.value);
		return data;
	};

	/**
	 * Executes a side effect on the error value without changing the Result.
	 * Useful for logging or reporting errors.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Result.error("not found"),
	 *   Result.tapError(e => console.error("validation failed:", e)),
	 *   Result.chain(save),
	 * )
	 * ```
	 */
	export const tapError = <E, A>(f: (e: E) => void) => (data: Result<E, A>): Result<E, A> => {
		if (isError(data)) f(data.error);
		return data;
	};

	/**
	 * Creates a Result from a predicate applied to a value.
	 * Returns Ok if the predicate passes, Err from onFalse otherwise.
	 *
	 * @example
	 * ```ts
	 * pipe(5, Result.fromPredicate(n => n > 0, n => `${n} is not positive`));  // Ok(5)
	 * pipe(-1, Result.fromPredicate(n => n > 0, n => `${n} is not positive`)); // Error("-1 is not positive")
	 * pipe("", Result.fromPredicate(s => s.length > 0, () => "empty string")); // Error("empty string")
	 * ```
	 */
	export const fromPredicate = <E, A>(
		pred: (a: A) => boolean,
		onFalse: (a: A) => E,
	) =>
	(a: A): Result<E, A> => pred(a) ? ok(a) : error(onFalse(a));

	/**
	 * Creates a Result from a nullable value.
	 * Returns Ok if the value is not null or undefined, error from onNull otherwise.
	 *
	 * @example
	 * ```ts
	 * pipe(null, Result.fromNullable(() => "is null")); // Error("is null")
	 * pipe(42, Result.fromNullable(() => "is null"));   // Ok(42)
	 * ```
	 */
	export const fromNullable = <E>(onNull: () => E) => <A>(value: A | null | undefined): Result<E, A> =>
		value === null || value === undefined ? error(onNull()) : ok(value);

	/**
	 * Creates a Result from a Maybe.
	 * Some becomes Ok, None becomes error from onNone.
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.none(), Result.fromMaybe(() => "is none")); // Error("is none")
	 * pipe(Maybe.some(42), Result.fromMaybe(() => "is none")); // Ok(42)
	 * ```
	 */
	export const fromMaybe = <E>(onNone: () => E) => <A>(maybe: Maybe<A>): Result<E, A> =>
		Maybe.isNone(maybe) ? error(onNone()) : ok(maybe.value);

	/**
	 * Wraps a throwing function of any arguments, returning a new function
	 * that catches errors and returns a Result.
	 *
	 * @example
	 * ```ts
	 * const safeParse = Result.fromThrowable(
	 *   (s: string) => JSON.parse(s),
	 *   (e) => new Error(`Parse error: ${e}`)
	 * );
	 *
	 * safeParse('{"a":1}'); // Ok({ a: 1 })
	 * safeParse('invalid');  // Error(Error)
	 * ```
	 */
	export const fromThrowable = <Args extends readonly unknown[], A, E>(
		f: (...args: Args) => A,
		onError: (e: unknown) => E,
	) =>
	(...args: Args): Result<E, A> => {
		try {
			return ok(f(...args));
		} catch (e) {
			return error(onError(e));
		}
	};

	/**
	 * Recovers from an error by providing a fallback Result.
	 * The fallback can produce a different success type, widening the result to `Result<E, A | B>`.
	 */
	export const recover = <E, A, B>(fallback: (e: E) => Result<E, B>) => (data: Result<E, A>): Result<E, A | B> =>
		isOk(data) ? data : fallback((data as Error<E>).error);

	/**
	 * Recovers from an error unless the predicate `isBlocked` returns true for that error.
	 * The fallback can produce a different success type, widening the result to `Result<E, A | B>`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Result.error(new Error("not found")),
	 *   Result.recoverUnless(e => e.message === "fatal", () => Result.ok(0))
	 * ); // Ok(0)
	 * ```
	 */
	export const recoverUnless =
		<E, A, B>(isBlocked: (e: E) => boolean, fallback: () => Result<E, B>) => (data: Result<E, A>): Result<E, A | B> =>
			isError(data) && !isBlocked(data.error) ? fallback() : data;

	/**
	 * Converts a Result to an Maybe.
	 * Ok becomes Some, Err becomes None (the error is discarded).
	 *
	 * @example
	 * ```ts
	 * Result.toMaybe(Result.ok(42)); // Some(42)
	 * Result.toMaybe(Result.error("oops")); // None
	 * ```
	 */
	export const toMaybe = <E, A>(data: Result<E, A>): Maybe<A> => isOk(data) ? Maybe.some(data.value) : Maybe.none();

	/**
	 * Applies a function wrapped in an Result to a value wrapped in an Result.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Result.ok(add),
	 *   Result.ap(Result.ok(5)),
	 *   Result.ap(Result.ok(3))
	 * ); // Ok(8)
	 * ```
	 */
	export const ap = <E, A>(arg: Result<E, A>) => <B>(data: Result<E, (a: A) => B>): Result<E, B> =>
		isOk(data) && isOk(arg) ? ok(data.value(arg.value)) : isError(data) ? data : (arg as Error<E>);
}
