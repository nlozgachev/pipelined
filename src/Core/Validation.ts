import { NonEmptyList } from "#types/NonEmptyList.ts";
import { WithErrors, WithKind, WithValue } from "./InternalTypes.ts";
import { Maybe } from "./Maybe.ts";
import { Result } from "./Result.ts";

/**
 * Validation represents a value that is either passed with a success value,
 * or failed with accumulated errors.
 * Unlike Result, Validation can accumulate multiple errors instead of short-circuiting.
 *
 * Use Validation when you need to collect all errors (e.g., form validation).
 * Use Result when you want to fail fast on the first error.
 *
 * @example
 * ```ts
 * const validateName = (name: string): Validation<string, string> =>
 *   name.length > 0 ? Validation.passed(name) : Validation.failed("Name is required");
 *
 * const validateAge = (age: number): Validation<string, number> =>
 *   age >= 0 ? Validation.passed(age) : Validation.failed("Age must be positive");
 *
 * // Accumulates all errors using ap
 * pipe(
 *   Validation.passed((name: string) => (age: number) => ({ name, age })),
 *   Validation.ap(validateName("")),
 *   Validation.ap(validateAge(-1))
 * );
 * // Failed(["Name is required", "Age must be positive"])
 * ```
 */
export type Validation<E, A> = Passed<A> | Failed<E>;

export type Passed<A> = WithKind<"Passed"> & WithValue<A>;
export type Failed<E> = WithKind<"Failed"> & WithErrors<E>;

export namespace Validation {
	/**
	 * Wraps a value in a passed Validation.
	 *
	 * @example
	 * ```ts
	 * Validation.passed(42); // Passed(42)
	 * ```
	 */
	export const passed = <E, A>(value: A): Validation<E, A> => ({ kind: "Passed", value });

	/**
	 * Creates a failed Validation from a single error.
	 *
	 * @example
	 * ```ts
	 * Validation.failed("Invalid input");
	 * ```
	 */
	export const failed = <E>(error: E): Failed<E> => ({ kind: "Failed", errors: [error] });

	/**
	 * Creates a failed Validation from multiple errors.
	 *
	 * @example
	 * ```ts
	 * Validation.failedAll(["Invalid input"]);
	 * ```
	 */
	export const failedAll = <E>(errors: NonEmptyList<E>): Failed<E> => ({ kind: "Failed", errors });

	/**
	 * Type guard that checks if a Validation is passed.
	 */
	export const isPassed = <E, A>(data: Validation<E, A>): data is Passed<A> => data.kind === "Passed";

	/**
	 * Type guard that checks if a Validation is failed.
	 */
	export const isFailed = <E, A>(data: Validation<E, A>): data is Failed<E> => data.kind === "Failed";

	/**
	 * Creates a Validation from a predicate applied to a value.
	 * Returns Passed if the predicate passes, Failed from `onFalse` otherwise.
	 *
	 * @example
	 * ```ts
	 * const validateName = Validation.fromPredicate(
	 *   (s: string) => s.length > 0,
	 *   () => "Name is required"
	 * );
	 *
	 * validateName("Alice"); // Passed("Alice")
	 * validateName("");      // Failed(["Name is required"])
	 * ```
	 */
	export const fromPredicate = <E, A>(pred: (a: A) => boolean, onFalse: (a: A) => E) => (a: A): Validation<E, A> =>
		pred(a) ? passed(a) : failed(onFalse(a));

	/**
	 * Creates a Validation from a nullable value.
	 * If the value is null or undefined, returns Failed with the error from onNull.
	 * Otherwise, returns Passed.
	 *
	 * @example
	 * ```ts
	 * pipe(null, Validation.fromNullable(() => "is null")); // Failed(["is null"])
	 * pipe(42, Validation.fromNullable(() => "is null"));   // Passed(42)
	 * ```
	 */
	export const fromNullable = <E>(onNull: () => E) => <A>(value: A | null | undefined): Validation<E, A> =>
		value === null || value === undefined ? failed(onNull()) : passed(value);

	/**
	 * Creates a Validation from a Maybe.
	 * If the Maybe is None, returns Failed with the error from onNone.
	 * Otherwise, returns Passed.
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.none(), Validation.fromMaybe(() => "is none")); // Failed(["is none"])
	 * pipe(Maybe.some(42), Validation.fromMaybe(() => "is none")); // Passed(42)
	 * ```
	 */
	export const fromMaybe = <E>(onNone: () => E) => <A>(maybe: Maybe<A>): Validation<E, A> =>
		Maybe.isNone(maybe) ? failed(onNone()) : passed(maybe.value);

	/**
	 * Transforms the success value inside a Validation.
	 *
	 * @example
	 * ```ts
	 * pipe(Validation.passed(5), Validation.map(n => n * 2)); // Passed(10)
	 * pipe(Validation.failed("oops"), Validation.map(n => n * 2)); // Failed(["oops"])
	 * ```
	 */
	export const map = <A, B>(f: (a: A) => B) => <E>(data: Validation<E, A>): Validation<E, B> =>
		isPassed(data) ? passed(f(data.value)) : data;

	/**
	 * Transforms the error list inside a Validation.
	 *
	 * @example
	 * ```ts
	 * pipe(Validation.failed("oops"), Validation.mapError(e => e.toUpperCase())); // Failed(["OOPS"])
	 * ```
	 */
	export const mapError = <E, F, A>(f: (e: E) => F) => (data: Validation<E, A>): Validation<F, A> =>
		isFailed(data) ? failedAll(data.errors.map(f) as unknown as NonEmptyList<F>) : data;

	/**
	 * Applies a function wrapped in a Validation to a value wrapped in a Validation.
	 * Accumulates errors from both sides.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Validation.passed(add),
	 *   Validation.ap(Validation.passed(5)),
	 *   Validation.ap(Validation.passed(3))
	 * ); // Passed(8)
	 *
	 * pipe(
	 *   Validation.passed(add),
	 *   Validation.ap(Validation.failed<string, number>("bad a")),
	 *   Validation.ap(Validation.failed<string, number>("bad b"))
	 * ); // Failed(["bad a", "bad b"])
	 * ```
	 */
	export const ap = <E, A>(arg: Validation<E, A>) => <B>(data: Validation<E, (a: A) => B>): Validation<E, B> => {
		if (isPassed(data) && isPassed(arg)) { return passed(data.value(arg.value)); }
		const errors = [...(isFailed(data) ? data.errors : []), ...(isFailed(arg) ? arg.errors : [])] as NonEmptyList<E>;
		return failedAll(errors);
	};

	/**
	 * Extracts the value from a Validation by providing handlers for both cases.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Validation.passed(42),
	 *   Validation.fold(
	 *     errors => `Errors: ${errors.join(", ")}`,
	 *     value => `Value: ${value}`
	 *   )
	 * );
	 * ```
	 */
	export const fold =
		<E, A, B>(onFailed: (errors: NonEmptyList<E>) => B, onPassed: (a: A) => B) => (data: Validation<E, A>): B =>
			isPassed(data) ? onPassed(data.value) : onFailed(data.errors);

	/**
	 * Pattern matches on a Validation, returning the result of the matching case.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   validation,
	 *   Validation.match({
	 *     passed: value => `Got ${value}`,
	 *     failed: errors => `Failed: ${errors.join(", ")}`
	 *   })
	 * );
	 * ```
	 */
	export const match =
		<E, A, B>(cases: { passed: (a: A) => B; failed: (errors: NonEmptyList<E>) => B; }) => (data: Validation<E, A>): B =>
			isPassed(data) ? cases.passed(data.value) : cases.failed(data.errors);

	/**
	 * Returns the success value or a default value if the Validation is failed.
	 * The default can be a different type, widening the result to `A | B`.
	 *
	 * @example
	 * ```ts
	 * pipe(Validation.passed(5), Validation.getOrElse(() => 0)); // 5
	 * pipe(Validation.failed("oops"), Validation.getOrElse(() => 0)); // 0
	 * pipe(Validation.failed("oops"), Validation.getOrElse(() => null)); // null — typed as number | null
	 * ```
	 */
	export const getOrElse = <E, A, B>(defaultValue: () => B) => (data: Validation<E, A>): A | B =>
		isPassed(data) ? data.value : defaultValue();

	/**
	 * Executes a side effect on the success value without changing the Validation.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Validation.passed(5),
	 *   Validation.tap(n => console.log("Value:", n)),
	 *   Validation.map(n => n * 2)
	 * );
	 * ```
	 */
	export const tap = <E, A>(f: (a: A) => void) => (data: Validation<E, A>): Validation<E, A> => {
		if (isPassed(data)) { f(data.value); }
		return data;
	};

	/**
	 * Executes a side effect on the accumulated errors without changing the Validation.
	 * Useful for logging or reporting validation failures.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Validation.failed("Name required"),
	 *   Validation.tapError(errors => console.error("validation failed:", errors)),
	 *   Validation.map(toUser)
	 * );
	 * ```
	 */
	export const tapError = <E, A>(f: (errors: NonEmptyList<E>) => void) => (data: Validation<E, A>): Validation<E, A> => {
		if (isFailed(data)) { f(data.errors); }
		return data;
	};

	/**
	 * Recovers from a Failed state by providing a fallback Validation.
	 * The fallback receives the accumulated error list so callers can inspect which errors occurred.
	 * The fallback can produce a different success type, widening the result to `Validation<E, A | B>`.
	 */
	export const recover =
		<E, A, B>(fallback: (errors: NonEmptyList<E>) => Validation<E, B>) =>
		(data: Validation<E, A>): Validation<E, A | B> => isPassed(data) ? data : fallback(data.errors);

	/**
	 * Recovers from a Failed state unless `isBlocked` returns true for any of the accumulated errors.
	 * The fallback can produce a different success type, widening the result to `Validation<E, A | B>`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Validation.failed("field-error"),
	 *   Validation.recoverUnless(e => e === "fatal", () => Validation.passed(0))
	 * ); // Passed(0)
	 * ```
	 */
	export const recoverUnless =
		<E, A, B>(isBlocked: (e: E) => boolean, fallback: () => Validation<E, B>) =>
		(data: Validation<E, A>): Validation<E, A | B> => isFailed(data) && !data.errors.some(isBlocked) ? fallback() : data;

	/**
	 * Converts a Validation to a Result.
	 * Passed becomes Ok, Failed becomes Err with the accumulated error list.
	 *
	 * @example
	 * ```ts
	 * Validation.toResult(Validation.passed(42));        // Ok(42)
	 * Validation.toResult(Validation.failed("oops"));  // Err(["oops"])
	 * ```
	 */
	export const toResult = <E, A>(data: Validation<E, A>): Result<NonEmptyList<E>, A> =>
		isPassed(data) ? Result.ok(data.value) : Result.err(data.errors);

	/**
	 * Converts a Validation to a Maybe. `Passed` becomes `Some`; `Failed` becomes `None`
	 * (errors are discarded).
	 *
	 * @example
	 * ```ts
	 * Validation.toMaybe(Validation.passed(42));       // Some(42)
	 * Validation.toMaybe(Validation.failed("bad"));  // None
	 * ```
	 */
	export const toMaybe = <E, A>(data: Validation<E, A>): Maybe<A> =>
		isPassed(data) ? Maybe.some(data.value) : Maybe.none();

	/**
	 * Converts a `Result` to a `Validation`. `Ok` becomes `Passed`; `Err(e)` becomes `Failed([e])`.
	 *
	 * Useful when bridging from error-short-circuiting `Result` pipelines into
	 * error-accumulating `Validation` pipelines.
	 *
	 * @example
	 * ```ts
	 * Validation.fromResult(Result.ok(42));       // Passed(42)
	 * Validation.fromResult(Result.err("bad"));   // Failed(["bad"])
	 * ```
	 */
	export const fromResult = <E, A>(data: Result<E, A>): Validation<E, A> =>
		data.kind === "Ok" ? passed(data.value) : failed(data.error);

	/**
	 * Combines two independent Validation instances into a tuple.
	 * If both are Passed, returns Passed with both values as a tuple.
	 * If either is Failed, accumulates errors from both sides.
	 *
	 * @example
	 * ```ts
	 * Validation.product(
	 *   Validation.passed("alice"),
	 *   Validation.passed(30)
	 * ); // Passed(["alice", 30])
	 *
	 * Validation.product(
	 *   Validation.failed("Name required"),
	 *   Validation.failed("Age must be >= 0")
	 * ); // Failed(["Name required", "Age must be >= 0"])
	 * ```
	 */
	export const product = <E, A, B>(
		first: Validation<E, A>,
		second: Validation<E, B>,
	): Validation<E, readonly [A, B]> => {
		if (isPassed(first) && isPassed(second)) {
			return passed([first.value, second.value]);
		}
		const errors = [...(isFailed(first) ? first.errors : []), ...(isFailed(second) ? second.errors : [])] as NonEmptyList<
			E
		>;
		return failedAll(errors);
	};

	/**
	 * Combines a non-empty list of Validation instances, accumulating all errors.
	 * If all are Passed, returns Passed with all values collected into an array.
	 * If any are Failed, returns Failed with all accumulated errors.
	 *
	 * @example
	 * ```ts
	 * Validation.productAll([
	 *   validateName(name),
	 *   validateEmail(email),
	 *   validateAge(age)
	 * ]);
	 * // Passed([name, email, age]) or Failed([...all errors])
	 * ```
	 */
	export const productAll = <E, A>(data: NonEmptyList<Validation<E, A>>): Validation<E, readonly A[]> => {
		const values: A[] = [];
		const errors: E[] = [];
		for (const v of data) {
			if (isPassed(v)) { values.push(v.value); }
			else { errors.push(...v.errors); }
		}
		return errors.length > 0 ? failedAll(errors as unknown as NonEmptyList<E>) : passed(values);
	};
}
