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
export type Result<E, A> = Ok<A> | Err<E>;

export type Ok<A> = WithKind<"Ok"> & WithValue<A>;
export type Err<E> = WithKind<"Err"> & WithError<E>;

// =============================================================================
// Private Helpers & Variant Constructors
// =============================================================================
const makeOk = <A>(value: A): Ok<A> => ({ kind: "Ok", value });
const makeErr = <E>(e: E): Err<E> => ({ kind: "Err", error: e });

const isOk = <E, A>(data: Result<E, A>): data is Ok<A> => data.kind === "Ok";
const isErr = <E, A>(data: Result<E, A>): data is Err<E> => data.kind === "Err";

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
	 *   { onError: (e) => `Parse error: ${e}` }
	 * );
	 * ```
	 */
	tryCatch: <E, A>(f: () => A, options: { onError: (e: unknown) => E; }): Result<E, A> => {
		try {
			return makeOk(f());
		} catch (error) {
			return makeErr(options.onError(error));
		}
	},

	/**
	 * Transforms the success value inside a Result.
	 *
	 * @example
	 * ```ts
	 * pipe(Result.make.ok(5), Result.map(n => n * 2)); // Ok(10)
	 * pipe(Result.make.err("error"), Result.map(n => n * 2)); // Err("error")
	 * ```
	 */
	map: <E, A, B>(f: (a: A) => B) => (data: Result<E, A>): Result<E, B> => isOk(data) ? makeOk(f(data.value)) : data,

	/**
	 * Transforms the error value inside a Result.
	 *
	 * @example
	 * ```ts
	 * pipe(Result.make.err("oops"), Result.mapError(e => e.toUpperCase())); // Err("OOPS")
	 * ```
	 */
	mapError: <E, F, A>(f: (e: E) => F) => (data: Result<E, A>): Result<F, A> =>
		isErr(data) ? makeErr(f(data.error)) : data,

	/**
	 * Chains Result computations. If the first is Ok, passes the value to f.
	 * If the first is Err, propagates the error.
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
	chain: <E2, A, B>(f: (a: A) => Result<E2, B>) => <E1 = never>(data: Result<E1, A>): Result<E1 | E2, B> =>
		isOk(data) ? f(data.value) : data,

	/**
	 * Extracts the value from a Result by providing handlers for both cases.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Result.make.ok(5),
	 *   Result.fold(
	 *     e => `Error: ${e}`,
	 *     n => `Value: ${n}`
	 *   )
	 * ); // "Value: 5"
	 * ```
	 */
	fold: <E, A, B>(onErr: (e: E) => B, onOk: (a: A) => B) => (data: Result<E, A>): B =>
		isOk(data) ? onOk(data.value) : onErr((data as Err<E>).error),

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
	match: <E, A, B>(cases: { ok: (a: A) => B; err: (e: E) => B; }) => (data: Result<E, A>): B =>
		isOk(data) ? cases.ok(data.value) : cases.err((data as Err<E>).error),

	/**
	 * Returns the success value or a default value if the Result is an error.
	 * The default is a thunk `() => B` — evaluated only when the Result is Err.
	 * The default can be a different type, widening the result to `A | B`.
	 *
	 * @example
	 * ```ts
	 * pipe(Result.make.ok(5), Result.getOrElse(() => 0)); // 5
	 * pipe(Result.make.err("error"), Result.getOrElse(() => 0)); // 0
	 * pipe(Result.make.err("error"), Result.getOrElse(() => null)); // null — typed as number | null
	 * ```
	 */
	getOrElse: <B>(defaultValue: () => B) => <E, A>(data: Result<E, A>): A | B => isOk(data) ? data.value : defaultValue(),

	/**
	 * Executes a side effect on the success value without changing the Result.
	 * Useful for logging or debugging.
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
	tap: <E, A>(f: (a: A) => void) => (data: Result<E, A>): Result<E, A> => {
		if (isOk(data)) { f(data.value); }
		return data;
	},

	/**
	 * Executes a side effect on the error value without changing the Result.
	 * Useful for logging or reporting errors.
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
	tapError: <E, A>(f: (e: E) => void) => (data: Result<E, A>): Result<E, A> => {
		if (isErr(data)) { f(data.error); }
		return data;
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
		Predicate: <E, A>(pred: (a: A) => boolean, onFalse: (a: A) => E) => (a: A): Result<E, A> =>
			pred(a) ? makeOk(a) : makeErr(onFalse(a)),

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
		Validation: <E1, E2, A>(combineErrors: (errors: NonEmptyArr<E1>) => E2) => (val: Validation<E1, A>): Result<E2, A> =>
			CoreValidation.is.passed(val) ? makeOk(val.value) : makeErr(combineErrors(val.errors)),
	},

	/**
	 * Recovers from an error by providing a fallback Result.
	 * The fallback can produce a different success type, widening the result to `Result<E, A | B>`.
	 */
	recover: <E, B>(fallback: (e: E) => Result<E, B>) => <A>(data: Result<E, A>): Result<E, A | B> =>
		isOk(data) ? data : fallback((data as Err<E>).error),

	/**
	 * Recovers from an error unless the predicate `isBlocked` returns true for that error.
	 * The fallback can produce a different success type, widening the result to `Result<E, A | B>`.
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
		<E, B>(isBlocked: (e: E) => boolean, fallback: () => Result<E, B>) => <A>(data: Result<E, A>): Result<E, A | B> =>
			isErr(data) && !isBlocked(data.error) ? fallback() : data,

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
		Maybe: <E, A>(data: Result<E, A>): Maybe<A> => isOk(data) ? CoreMaybe.make.some(data.value) : CoreMaybe.make.none(),
		/**
		 * Converts a `Result` to a `Validation`. `Ok(a)` becomes `Passed(a)`; `Err(e)` becomes `Failed([e])`.
		 *
		 * @example
		 * ```ts
		 * Result.to.Validation(Result.make.ok(42));     // Passed(42)
		 * Result.to.Validation(Result.make.err("bad")); // Failed(["bad"])
		 * ```
		 */
		Validation: <E, A>(data: Result<E, A>): Validation<E, A> => CoreValidation.from.Result(data),
	},

	/**
	 * Swaps the outer `Result` and inner `Maybe` context.
	 * `Ok(Some(a))` becomes `Some(Ok(a))`, `Ok(None)` becomes `None`, and `Err(e)` becomes `Some(Err(e))`.
	 *
	 * @example
	 * ```ts
	 * Result.transposeMaybe(Result.make.ok(Maybe.make.some(42))); // Some(Ok(42))
	 * Result.transposeMaybe(Result.make.ok(Maybe.make.none()));   // None
	 * Result.transposeMaybe(Result.make.err("error"));           // Some(Err("error"))
	 * ```
	 */
	transposeMaybe: <E, A>(data: Result<E, Maybe<A>>): Maybe<Result<E, A>> =>
		isErr(data)
			? CoreMaybe.make.some(data)
			: (CoreMaybe.is.some(data.value) ? CoreMaybe.make.some(makeOk(data.value.value)) : CoreMaybe.make.none()),

	/**
	 * Applies a function wrapped in a Result to a value wrapped in a Result.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Result.make.ok(add),
	 *   Result.ap(Result.make.ok(5)),
	 *   Result.ap(Result.make.ok(3))
	 * ); // Ok(8)
	 * ```
	 */
	ap: <E, A>(arg: Result<E, A>) => <B>(data: Result<E, (a: A) => B>): Result<E, B> =>
		isOk(data) && isOk(arg) ? makeOk(data.value(arg.value)) : (isErr(data) ? data : (arg as Err<E>)),

	/**
	 * Converts a Result value into an object containing a single property.
	 * Initiates the pipeline accumulator record.
	 *
	 * @example
	 * ```ts
	 * pipe(Result.make.ok(42), Result.bindTo("value")); // Ok({ value: 42 })
	 * ```
	 */
	bindTo: <K extends string>(key: K) => <E, A>(data: Result<E, A>): Result<E, { [P in K]: A; }> =>
		isOk(data) ? makeOk({ [key]: data.value } as { [P in K]: A; }) : data,

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
		<K extends string, E, A, B>(key: K, f: (a: A) => Result<E, B>) =>
		(data: Result<E, A>): Result<E, A & { [P in K]: B; }> => {
			if (!isOk(data)) { return data; }
			const res = f(data.value);
			return isOk(res) ? makeOk({ ...(data.value as any), [key]: res.value } as A & { [P in K]: B; }) : res;
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
	 * Narrows an `Ok` value with a predicate, converting to `Err(onFail(a))` if the predicate returns false.
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
		<A, E2>(predicate: (a: A) => boolean, onFail: (a: A) => E2) =>
		<E1 = never>(data: Result<E1, A>): Result<E1 | E2, A> =>
			isErr(data) ? data : (predicate(data.value) ? data : makeErr(onFail(data.value))),

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
	bimap: <E1, E2, A, B>(onErr: (e: E1) => E2, onOk: (a: A) => B) => (data: Result<E1, A>): Result<E2, B> =>
		isOk(data) ? makeOk(onOk(data.value)) : makeErr(onErr(data.error)),
};
