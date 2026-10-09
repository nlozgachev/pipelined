// =============================================================================
// Imports
// =============================================================================
import { type Maybe, Maybe as CoreMaybe, type Validation, Validation as CoreValidation } from "#core";
import type { NonEmptyArr, WithError, WithKind, WithValue } from "#internal";

// =============================================================================
// Types
// =============================================================================
/**
 * Result represents a value that can be one of two types: a success (Ok) or a failure (Err).
 * Use Result when an operation can fail with a meaningful error value.
 *
 * @example
 * ```ts
 * const divide = (a: number, b: number): Result<string, number> =>
 *   b === 0 ? Result.make.err("Division by zero") : Result.make.ok(a / b);
 *
 * pipe(
 *   divide(10, 2),
 *   Result.map(n => n * 2),
 *   Result.getOrElse(() => 0)
 * ); // 10
 * ```
 */
export type Result<E, A> = Result.Ok<A> | Result.Err<E>;

export namespace Result {
	export type Ok<A> = WithKind<"Ok"> & WithValue<A>;
	export type Err<E> = WithKind<"Err"> & WithError<E>;
}

// =============================================================================
// Private Helpers & Variant Constructors
// =============================================================================
const makeOk = <A>(value: A): Result.Ok<A> => ({ kind: "Ok", value });
const makeErr = <E>(error: E): Result.Err<E> => ({ kind: "Err", error });

const isOk = <E, A>(result: Result<E, A>): result is Result.Ok<A> => result.kind === "Ok";
const isErr = <E, A>(result: Result<E, A>): result is Result.Err<E> => result.kind === "Err";

// =============================================================================
// Public Export
// =============================================================================
export const Result = {
	make: {
		/**
		 * Creates a successful Result with the given value.
		 *
		 * @example
		 * ```ts
		 * Result.make.ok(42); // Ok(42)
		 * ```
		 */
		ok: makeOk,

		/**
		 * Creates a failed Result with the given error.
		 *
		 * @example
		 * ```ts
		 * Result.make.err("Error message"); // Err("Error message")
		 * ```
		 */
		err: makeErr,
	},

	is: {
		/**
		 * Type guard that checks if a Result is Ok.
		 *
		 * @see {@link Result.is.err} to check if a Result is an Err failure.
		 *
		 * @example
		 * ```ts
		 * const res = Result.make.ok(42);
		 * if (Result.is.ok(res)) {
		 *   console.log(res.value); // 42
		 * }
		 * ```
		 */
		ok: isOk,

		/**
		 * Type guard that checks if a Result is Err.
		 *
		 * @see {@link Result.is.ok} to check if a Result is an Ok success.
		 *
		 * @example
		 * ```ts
		 * const res = Result.make.err("failed");
		 * if (Result.is.err(res)) {
		 *   console.log(res.error); // "failed"
		 * }
		 * ```
		 */
		err: isErr,
	},

	/**
	 * Creates a Result from a synchronous thunk that may throw.
	 * Catches any errors and transforms them using the `onError` function.
	 *
	 * @example
	 * ```ts
	 * const result = Result.tryCatch(
	 *   () => JSON.parse(rawString),
	 *   { onError: (error) => `Parse error: ${error}` }
	 * );
	 * ```
	 */
	tryCatch: <E, A>(fn: () => A, options: { onError: (error: unknown) => E; }): Result<E, A> => {
		try {
			return makeOk(fn());
		} catch (error) {
			return makeErr(options.onError(error));
		}
	},

	/**
	 * Transforms the success value inside a Result.
	 *
	 * @see {@link Result.chain} to sequence operations that themselves return a Result.
	 * @see {@link Result.mapError} to transform the error value instead of the success value.
	 *
	 * @example
	 * ```ts
	 * pipe(Result.make.ok(5), Result.map(n => n * 2)); // Ok(10)
	 * pipe(Result.make.err("error"), Result.map(n => n * 2)); // Err("error")
	 * ```
	 */
	map: <E, A, B>(transform: (value: A) => B) => (result: Result<E, A>): Result<E, B> =>
		isOk(result) ? makeOk(transform(result.value)) : result,

	/**
	 * Transforms the error value inside a Result.
	 *
	 * @see {@link Result.map} to transform the success value instead of the error value.
	 *
	 * @example
	 * ```ts
	 * pipe(Result.make.err("oops"), Result.mapError(e => e.toUpperCase())); // Err("OOPS")
	 * ```
	 */
	mapError: <E, F, A>(transform: (error: E) => F) => (result: Result<E, A>): Result<F, A> =>
		isErr(result) ? makeErr(transform(result.error)) : result,

	/**
	 * Chains Result computations. If the first is Ok, passes the value to transform.
	 * If the first is Err, propagates the error.
	 *
	 * @see {@link Result.map} to transform the inner value without returning a new Result.
	 *
	 * @example
	 * ```ts
	 * const validatePositive = (n: number): Result<string, number> =>
	 *   n > 0 ? Result.make.ok(n) : Result.make.err("Must be positive");
	 *
	 * pipe(Result.make.ok(5), Result.chain(validatePositive)); // Ok(5)
	 * pipe(Result.make.ok(-1), Result.chain(validatePositive)); // Err("Must be positive")
	 * ```
	 */
	chain: <E2, A, B>(transform: (value: A) => Result<E2, B>) => <E1 = never>(result: Result<E1, A>): Result<E1 | E2, B> =>
		isOk(result) ? transform(result.value) : result,

	/**
	 * Extracts the value from a Result by providing handlers for both cases.
	 *
	 * @see {@link Result.match} for named-case pattern matching with an object literal.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Result.make.ok(5),
	 *   Result.fold(
	 *     error => `Error: ${error}`,
	 *     value => `Value: ${value}`
	 *   )
	 * ); // "Value: 5"
	 * ```
	 */
	fold: <E, A, B>(onErr: (error: E) => B, onOk: (value: A) => B) => (result: Result<E, A>): B =>
		isOk(result) ? onOk(result.value) : onErr((result as Result.Err<E>).error),

	/**
	 * Pattern matches on a Result, returning the result of the matching case.
	 *
	 * @see {@link Result.fold} for positional argument pattern matching.
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
	match: <E, A, B>(cases: { ok: (value: A) => B; err: (error: E) => B; }) => (result: Result<E, A>): B =>
		isOk(result) ? cases.ok(result.value) : cases.err((result as Result.Err<E>).error),

	/**
	 * Returns the success value or a default value if the Result is an error.
	 * The default is a thunk `() => B` — evaluated only when the Result is Err.
	 * The default can be a different type, widening the result to `A | B`.
	 *
	 * @see {@link Result.fold} to handle both the Ok and Err cases.
	 *
	 * @example
	 * ```ts
	 * pipe(Result.make.ok(5), Result.getOrElse(() => 0)); // 5
	 * pipe(Result.make.err("error"), Result.getOrElse(() => 0)); // 0
	 * pipe(Result.make.err("error"), Result.getOrElse(() => null)); // null — typed as number | null
	 * ```
	 */
	getOrElse: <B>(fallback: () => B) => <E, A>(result: Result<E, A>): A | B => isOk(result) ? result.value : fallback(),

	/**
	 * Executes a side effect on the success value without changing the Result.
	 * Useful for logging or debugging.
	 *
	 * @see {@link Result.tapError} to perform a side effect on the error value.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Result.make.ok(5),
	 *   Result.tap(n => console.log("Value:", n)),
	 *   Result.map(n => n * 2)
	 * );
	 * ```
	 */
	tap: <E, A>(sideEffect: (value: A) => void) => (result: Result<E, A>): Result<E, A> => {
		if (isOk(result)) { sideEffect(result.value); }
		return result;
	},

	/**
	 * Executes a side effect on the error value without changing the Result.
	 * Useful for logging or reporting errors.
	 *
	 * @see {@link Result.tap} to perform a side effect on the success value.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Result.make.err("not found"),
	 *   Result.tapError(e => console.error("validation failed:", e)),
	 *   Result.chain(save),
	 * )
	 * ```
	 */
	tapError: <E, A>(sideEffect: (error: E) => void) => (result: Result<E, A>): Result<E, A> => {
		if (isErr(result)) { sideEffect(result.error); }
		return result;
	},

	// --- from ---
	from: {
		/**
		 * Creates a Result from a predicate applied to a value.
		 * Returns Ok if the predicate passes, Err from onFalse otherwise.
		 *
		 * @example
		 * ```ts
		 * pipe(5, Result.from.Predicate(n => n > 0, n => `${n} is not positive`));  // Ok(5)
		 * pipe(-1, Result.from.Predicate(n => n > 0, n => `${n} is not positive`)); // Err("-1 is not positive")
		 * pipe("", Result.from.Predicate(s => s.length > 0, () => "empty string")); // Err("empty string")
		 * ```
		 */
		Predicate: <E, A>(predicate: (value: A) => boolean, onFalse: (value: A) => E) => (value: A): Result<E, A> =>
			predicate(value) ? makeOk(value) : makeErr(onFalse(value)),

		/**
		 * Creates a Result from a nullable value.
		 * Returns Ok if the value is not null or undefined, error from onNull otherwise.
		 *
		 * @example
		 * ```ts
		 * pipe(null, Result.from.nullable(() => "is null")); // Err("is null")
		 * pipe(42, Result.from.nullable(() => "is null"));   // Ok(42)
		 * ```
		 */
		nullable: <E>(onNull: () => E) => <A>(value: A | null | undefined): Result<E, A> =>
			value === null || value === undefined ? makeErr(onNull()) : makeOk(value),

		/**
		 * Creates a Result from a Maybe.
		 * Some becomes Ok, None becomes error from onNone.
		 *
		 * @example
		 * ```ts
		 * pipe(Maybe.make.none(), Result.from.Maybe(() => "is none")); // Err("is none")
		 * pipe(Maybe.make.some(42), Result.from.Maybe(() => "is none")); // Ok(42)
		 * ```
		 */
		Maybe: <E>(onNone: () => E) => <A>(maybe: Maybe<A>): Result<E, A> =>
			CoreMaybe.is.none(maybe) ? makeErr(onNone()) : makeOk(maybe.value),

		/**
		 * Converts a `Validation` to a `Result`, combining accumulated errors using `combineErrors`.
		 * `Passed(a)` becomes `Ok(a)`; `Failed(errors)` becomes `Err(combineErrors(errors))`.
		 *
		 * @example
		 * ```ts
		 * Result.from.Validation((errors) => errors.join(", "))(Validation.make.failed("error1")); // Err("error1")
		 * ```
		 */
		Validation:
			<E1, E2, A>(combineErrors: (errors: NonEmptyArr<E1>) => E2) => (validation: Validation<E1, A>): Result<E2, A> =>
				CoreValidation.is.passed(validation) ? makeOk(validation.value) : makeErr(combineErrors(validation.errors)),
	},

	/**
	 * Recovers from an error by providing a fallback Result.
	 * The fallback can produce a different success type or resolve with a different error type.
	 *
	 * @see {@link Result.recoverUnless} to conditionally recover based on the error value.
	 */
	recover: <E1, E2, B>(fallback: (error: E1) => Result<E2, B>) => <A>(result: Result<E1, A>): Result<E2, A | B> =>
		isOk(result) ? result : fallback((result as Result.Err<E1>).error),

	/**
	 * Recovers from an error unless the predicate `isBlocked` returns true for that error.
	 * The fallback can produce a different success type, widening the result to `Result<E1 | E2, A | B>`.
	 *
	 * @see {@link Result.recover} for unconditional error recovery.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Result.make.err(new Error("not found")),
	 *   Result.recoverUnless(e => e.message === "fatal", () => Result.make.ok(0))
	 * ); // Ok(0)
	 * ```
	 */
	recoverUnless:
		<E1, E2, B>(isBlocked: (error: E1) => boolean, fallback: (error: E1) => Result<E2, B>) =>
		<A>(result: Result<E1, A>): Result<E1 | E2, A | B> =>
			isErr(result) && !isBlocked(result.error) ? fallback(result.error) : result,

	// --- to ---
	to: {
		/**
		 * Converts a Result to a Maybe.
		 * Ok becomes Some, Err becomes None (the error is discarded).
		 *
		 * @example
		 * ```ts
		 * Result.to.Maybe(Result.make.ok(42)); // Some(42)
		 * Result.to.Maybe(Result.make.err("oops")); // None
		 * ```
		 */
		Maybe: <E, A>(result: Result<E, A>): Maybe<A> =>
			isOk(result) ? CoreMaybe.make.some(result.value) : CoreMaybe.make.none(),
		/**
		 * Converts a `Result` to a `Validation`. `Ok(a)` becomes `Passed(a)`; `Err(e)` becomes `Failed([e])`.
		 *
		 * @example
		 * ```ts
		 * Result.to.Validation(Result.make.ok(42));     // Passed(42)
		 * Result.to.Validation(Result.make.err("bad")); // Failed(["bad"])
		 * ```
		 */
		Validation: <E, A>(result: Result<E, A>): Validation<E, A> => CoreValidation.from.Result(result),
	},

	// --- sequence ---
	sequence: {
		/**
		 * Swaps the outer `Result` and inner `Maybe` context.
		 * `Ok(Some(a))` becomes `Some(Ok(a))`, `Ok(None)` becomes `None`, and `Err(e)` becomes `Some(Err(e))`.
		 *
		 * @example
		 * ```ts
		 * Result.sequence.Maybe(Result.make.ok(Maybe.make.some(42))); // Some(Ok(42))
		 * Result.sequence.Maybe(Result.make.ok(Maybe.make.none()));   // None
		 * Result.sequence.Maybe(Result.make.err("error"));           // Some(Err("error"))
		 * ```
		 */
		Maybe: <E, A>(result: Result<E, Maybe<A>>): Maybe<Result<E, A>> =>
			isErr(result)
				? CoreMaybe.make.some(result)
				: (CoreMaybe.is.some(result.value) ? CoreMaybe.make.some(makeOk(result.value.value)) : CoreMaybe.make.none()),
	},

	/**
	 * Applies a function wrapped in a Result to a value wrapped in a Result.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Result.make.ok(add),
	 *   Result.apply(Result.make.ok(5)),
	 *   Result.apply(Result.make.ok(3))
	 * ); // Ok(8)
	 * ```
	 */
	apply: <E2, A>(arg: Result<E2, A>) => <E1, B>(result: Result<E1, (value: A) => B>): Result<E1 | E2, B> =>
		isOk(result) && isOk(arg) ? makeOk(result.value(arg.value)) : (isErr(result) ? result : (arg as Result.Err<E2>)),

	/**
	 * Converts a Result value into an object containing a single property.
	 * Initiates the pipeline accumulator record.
	 *
	 * @example
	 * ```ts
	 * pipe(Result.make.ok(42), Result.bindTo("value")); // Ok({ value: 42 })
	 * ```
	 */
	bindTo: <K extends string>(key: K) => <E, A>(result: Result<E, A>): Result<E, { [P in K]: A; }> =>
		isOk(result) ? makeOk({ [key]: result.value } as { [P in K]: A; }) : result,

	/**
	 * Evaluates a new Result using the current accumulator and attaches the output to a new key.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Result.make.ok({ a: 1 }),
	 *   Result.bind("b", ({ a }) => Result.make.ok(a + 1))
	 * ); // Ok({ a: 1, b: 2 })
	 * ```
	 */
	bind:
		<K extends string, E2, A, B>(key: K, transform: (value: A) => Result<E2, B>) =>
		<E1 = never>(result: Result<E1, A>): Result<E1 | E2, A & { [P in K]: B; }> => {
			if (!isOk(result)) { return result; }
			const res = transform(result.value);
			return isOk(res) ? makeOk({ ...(result.value as any), [key]: res.value } as A & { [P in K]: B; }) : res;
		},

	/**
	 * Combines a record of Results into a single Result of a record.
	 * Evaluates fields in key order and short-circuits on the first failure.
	 *
	 * @example
	 * ```ts
	 * Result.struct({
	 *   name: Result.make.ok("Alice"),
	 *   age: Result.make.ok(30)
	 * }); // Ok({ name: "Alice", age: 30 })
	 * ```
	 */
	struct: <E, R extends Record<string, any>>(fields: { [K in keyof R]: Result<E, R[K]>; }): Result<E, R> => {
		const result = {} as R;
		for (const key in fields) {
			if (Object.hasOwn(fields, key)) {
				const res = fields[key];
				if (isErr(res)) {
					return res;
				}
				result[key] = res.value;
			}
		}
		return makeOk(result);
	},

	/**
	 * Narrows an `Ok` value with a predicate, converting to `Err(onFail(value))` if the predicate returns false.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Result.make.ok(15),
	 *   Result.ensure((n) => n >= 18, (n) => `Age ${n} is below 18`)
	 * ); // Err("Age 15 is below 18")
	 * ```
	 */
	ensure:
		<A, E2>(predicate: (value: A) => boolean, onFail: (value: A) => E2) =>
		<E1 = never>(result: Result<E1, A>): Result<E1 | E2, A> =>
			isErr(result) ? result : (predicate(result.value) ? result : makeErr(onFail(result.value))),

	/**
	 * Transforms both branches of a Result simultaneously.
	 * Applies `onErr` to `Err` values and `onOk` to `Ok` values.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Result.make.ok(5),
	 *   Result.bimap(
	 *     (e) => `Error: ${e}`,
	 *     (n) => n * 2
	 *   )
	 * ); // Ok(10)
	 * ```
	 */
	bimap: <E1, E2, A, B>(onErr: (error: E1) => E2, onOk: (value: A) => B) => (result: Result<E1, A>): Result<E2, B> =>
		isOk(result) ? makeOk(onOk(result.value)) : makeErr(onErr(result.error)),
};
