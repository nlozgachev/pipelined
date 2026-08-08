import { type Maybe, Maybe as CoreMaybe, type Result, Result as CoreResult } from "#core";
import { isNonEmptyArr, type NonEmptyArr, type WithErrors, type WithKind, type WithValue } from "#internal";

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
 *   name.length > 0 ? Validation.make.passed(name) : Validation.make.failed("Name is required");
 *
 * const validateAge = (age: number): Validation<string, number> =>
 *   age >= 0 ? Validation.make.passed(age) : Validation.make.failed("Age must be positive");
 *
 * // Accumulates all errors using ap
 * pipe(
 *   Validation.make.passed((name: string) => (age: number) => ({ name, age })),
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
	export namespace make {
		/**
		 * Wraps a value in a passed Validation.
		 *
		 * @example
		 * ```ts
		 * Validation.make.passed(42); // Passed(42)
		 * ```
		 */
		export const passed = <E, A>(value: A): Validation<E, A> => ({ kind: "Passed", value });

		/**
		 * Creates a failed Validation from a single error.
		 *
		 * @example
		 * ```ts
		 * Validation.make.failed("Invalid input");
		 * ```
		 */
		export const failed = <E>(error: E): Failed<E> => ({ kind: "Failed", errors: [error] });

		/**
		 * Creates a failed Validation from multiple errors.
		 *
		 * @example
		 * ```ts
		 * Validation.make.failedAll(["Invalid input"]);
		 * ```
		 */
		export const failedAll = <E>(errors: NonEmptyArr<E>): Failed<E> => ({ kind: "Failed", errors });
	}

	export namespace is {
		/**
		 * Type guard that checks if a Validation is passed.
		 *
		 * @example
		 * ```ts
		 * const v = Validation.make.passed(42);
		 * if (Validation.is.passed(v)) {
		 *   console.log(v.value); // 42
		 * }
		 * ```
		 */
		export const passed = <E, A>(data: Validation<E, A>): data is Passed<A> => data.kind === "Passed";

		/**
		 * Type guard that checks if a Validation is failed.
		 *
		 * @example
		 * ```ts
		 * const v = Validation.make.failed("invalid");
		 * if (Validation.is.failed(v)) {
		 *   console.log(v.errors); // ["invalid"]
		 * }
		 * ```
		 */
		export const failed = <E, A>(data: Validation<E, A>): data is Failed<E> => data.kind === "Failed";
	}

	/**
	 * Creates a Validation from a function that may throw.
	 * Catches any errors and transforms them using the onError function into a Failed validation.
	 *
	 * @example
	 * ```ts
	 * const parseJson = (s: string): Validation<string, unknown> =>
	 *   Validation.tryCatch(
	 *     () => JSON.parse(s),
	 *     { onError: (e) => `Parse error: ${e}` }
	 *   );
	 * ```
	 */
	export const tryCatch = <E, A>(f: () => A, options: { onError: (e: unknown) => E; }): Validation<E, A> => {
		try {
			return make.passed(f());
		} catch (error) {
			return make.failed(options.onError(error));
		}
	};

	// --- from ---
	export namespace from {
		/**
		 * Creates a Validation from a predicate applied to a value.
		 * Returns Passed if the predicate passes, Failed from `onFalse` otherwise.
		 *
		 * @example
		 * ```ts
		 * const validateName = Validation.from.Predicate(
		 *   (s: string) => s.length > 0,
		 *   () => "Name is required"
		 * );
		 *
		 * validateName("Alice"); // Passed("Alice")
		 * validateName("");      // Failed(["Name is required"])
		 * ```
		 */
		export const Predicate = <E, A>(pred: (a: A) => boolean, onFalse: (a: A) => E) => (a: A): Validation<E, A> =>
			pred(a) ? make.passed(a) : make.failed(onFalse(a));

		/**
		 * Creates a Validation from a nullable value.
		 * If the value is null or undefined, returns Failed with the error from onNull.
		 * Otherwise, returns Passed.
		 *
		 * @example
		 * ```ts
		 * pipe(null, Validation.from.nullable(() => "is null")); // Failed(["is null"])
		 * pipe(42, Validation.from.nullable(() => "is null"));   // Passed(42)
		 * ```
		 */
		export const nullable = <E>(onNull: () => E) => <A>(value: A | null | undefined): Validation<E, A> =>
			value === null || value === undefined ? make.failed(onNull()) : make.passed(value);

		/**
		 * Creates a Validation from a Maybe.
		 * If the Maybe is None, returns Failed with the error from onNone.
		 * Otherwise, returns Passed.
		 *
		 * @example
		 * ```ts
		 * pipe(Maybe.make.none(), Validation.from.Maybe(() => "is none")); // Failed(["is none"])
		 * pipe(Maybe.make.some(42), Validation.from.Maybe(() => "is none")); // Passed(42)
		 * ```
		 */
		export const Maybe = <E>(onNone: () => E) => <A>(maybe: Maybe<A>): Validation<E, A> =>
			CoreMaybe.is.none(maybe) ? make.failed(onNone()) : make.passed(maybe.value);

		/**
		 * Converts a `Result` to a `Validation`. `Ok` becomes `Passed`; `Err(e)` becomes `Failed([e])`.
		 *
		 * Useful when bridging from error-short-circuiting `Result` pipelines into
		 * error-accumulating `Validation` pipelines.
		 *
		 * @example
		 * ```ts
		 * Validation.from.Result(Result.make.ok(42));       // Passed(42)
		 * Validation.from.Result(Result.make.err("bad"));   // Failed(["bad"])
		 * ```
		 */
		export const Result = <E, A>(data: Result<E, A>): Validation<E, A> =>
			data.kind === "Ok" ? make.passed(data.value) : make.failed(data.error);
	}

	/**
	 * Transforms the success value inside a Validation.
	 *
	 * @example
	 * ```ts
	 * pipe(Validation.make.passed(5), Validation.map(n => n * 2)); // Passed(10)
	 * pipe(Validation.make.failed("oops"), Validation.map(n => n * 2)); // Failed(["oops"])
	 * ```
	 */
	export const map = <A, B>(f: (a: A) => B) => <E>(data: Validation<E, A>): Validation<E, B> =>
		is.passed(data) ? make.passed(f(data.value)) : data;

	/**
	 * Transforms the error list inside a Validation.
	 *
	 * @example
	 * ```ts
	 * pipe(Validation.make.failed("oops"), Validation.mapError(e => e.toUpperCase())); // Failed(["OOPS"])
	 * ```
	 */
	export const mapError = <E, F, A>(f: (e: E) => F) => (data: Validation<E, A>): Validation<F, A> =>
		is.failed(data) ? make.failedAll(data.errors.map(f) as unknown as NonEmptyArr<F>) : data;

	/**
	 * Applies a function wrapped in a Validation to a value wrapped in a Validation.
	 * Accumulates errors from both sides.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Validation.make.passed(add),
	 *   Validation.ap(Validation.make.passed(5)),
	 *   Validation.ap(Validation.make.passed(3))
	 * ); // Passed(8)
	 *
	 * pipe(
	 *   Validation.make.passed(add),
	 *   Validation.ap(Validation.make.failed<string>("bad a")),
	 *   Validation.ap(Validation.make.failed<string>("bad b"))
	 * ); // Failed(["bad a", "bad b"])
	 * ```
	 */
	export const ap = <E, A>(arg: Validation<E, A>) => <B>(data: Validation<E, (a: A) => B>): Validation<E, B> => {
		if (is.passed(data)) {
			return is.passed(arg) ? make.passed(data.value(arg.value)) : make.failedAll(arg.errors);
		}
		return is.passed(arg)
			? make.failedAll(data.errors)
			: make.failedAll([...data.errors, ...arg.errors] as NonEmptyArr<E>);
	};

	/**
	 * Applies a function wrapped in a Validation to a value wrapped in a Validation,
	 * using a custom error concatenator function when both sides fail.
	 *
	 * @example
	 * ```ts
	 * const concat = (e1: NonEmptyArr<string>, e2: NonEmptyArr<string>): NonEmptyArr<string> =>
	 *   [...e1, ...e2];
	 * pipe(fnVal, Validation.apCustom(concat)(argVal));
	 * ```
	 */
	export const apCustom =
		<E1, E2, E3>(concat: (e1: NonEmptyArr<E1>, e2: NonEmptyArr<E2>) => NonEmptyArr<E3>) =>
		<A>(arg: Validation<E2, A>) =>
		<B>(data: Validation<E1, (a: A) => B>): Validation<E3, B> => {
			if (is.passed(data)) {
				return is.passed(arg)
					? make.passed(data.value(arg.value))
					: make.failedAll(arg.errors as unknown as NonEmptyArr<E3>);
			}
			return is.passed(arg)
				? make.failedAll(data.errors as unknown as NonEmptyArr<E3>)
				: make.failedAll(concat(data.errors, arg.errors));
		};

	/**
	 * Extracts the value from a Validation by providing handlers for both cases.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Validation.make.passed(42),
	 *   Validation.fold(
	 *     errors => `Errors: ${errors.join(", ")}`,
	 *     value => `Value: ${value}`
	 *   )
	 * );
	 * ```
	 */
	export const fold =
		<E, A, B>(onFailed: (errors: NonEmptyArr<E>) => B, onPassed: (a: A) => B) => (data: Validation<E, A>): B =>
			is.passed(data) ? onPassed(data.value) : onFailed(data.errors);

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
		<E, A, B>(cases: { passed: (a: A) => B; failed: (errors: NonEmptyArr<E>) => B; }) => (data: Validation<E, A>): B =>
			is.passed(data) ? cases.passed(data.value) : cases.failed(data.errors);

	/**
	 * Returns the success value or a default value if the Validation is failed.
	 * The default can be a different type, widening the result to `A | B`.
	 *
	 * @example
	 * ```ts
	 * pipe(Validation.make.passed(5), Validation.getOrElse(() => 0)); // 5
	 * pipe(Validation.make.failed("oops"), Validation.getOrElse(() => 0)); // 0
	 * pipe(Validation.make.failed("oops"), Validation.getOrElse(() => null)); // null — typed as number | null
	 * ```
	 */
	export const getOrElse = <E, A, B>(defaultValue: () => B) => (data: Validation<E, A>): A | B =>
		is.passed(data) ? data.value : defaultValue();

	/**
	 * Executes a side effect on the success value without changing the Validation.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Validation.make.passed(5),
	 *   Validation.tap(n => console.log("Value:", n)),
	 *   Validation.map(n => n * 2)
	 * );
	 * ```
	 */
	export const tap = <E, A>(f: (a: A) => void) => (data: Validation<E, A>): Validation<E, A> => {
		if (is.passed(data)) { f(data.value); }
		return data;
	};

	/**
	 * Executes a side effect on the accumulated errors without changing the Validation.
	 * Useful for logging or reporting validation failures.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Validation.make.failed("Name required"),
	 *   Validation.tapError(errors => console.error("validation failed:", errors)),
	 *   Validation.map(toUser)
	 * );
	 * ```
	 */
	export const tapError = <E, A>(f: (errors: NonEmptyArr<E>) => void) => (data: Validation<E, A>): Validation<E, A> => {
		if (is.failed(data)) { f(data.errors); }
		return data;
	};

	/**
	 * Recovers from a Failed state by providing a fallback Validation.
	 * The fallback receives the accumulated error list so callers can inspect which errors occurred.
	 * The fallback can produce a different success type, widening the result to `Validation<E, A | B>`.
	 */
	export const recover =
		<E, A, B>(fallback: (errors: NonEmptyArr<E>) => Validation<E, B>) => (data: Validation<E, A>): Validation<E, A | B> =>
			is.passed(data) ? data : fallback(data.errors);

	/**
	 * Recovers from a Failed state unless `isBlocked` returns true for any of the accumulated errors.
	 * The fallback can produce a different success type, widening the result to `Validation<E, A | B>`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Validation.make.failed("field-error"),
	 *   Validation.recoverUnless(e => e === "fatal", () => Validation.make.passed(0))
	 * ); // Passed(0)
	 * ```
	 */
	export const recoverUnless =
		<E, A, B>(isBlocked: (e: E) => boolean, fallback: () => Validation<E, B>) =>
		(data: Validation<E, A>): Validation<E, A | B> => is.failed(data) && !data.errors.some(isBlocked) ? fallback() : data;

	// --- to ---
	export namespace to {
		/**
		 * Converts a Validation to a Result.
		 * Passed becomes Ok.
		 * Direct call converts Failed to Err with accumulated error list `NonEmptyArr<E>`.
		 * Curried call converts Failed to Err with combined error `E2` via `combineErrors`.
		 *
		 * @example
		 * ```ts
		 * Validation.to.Result(Validation.make.passed(42));        // Ok(42)
		 * Validation.to.Result(Validation.make.failed("oops"));  // Err(["oops"])
		 * pipe(Validation.make.failed("oops"), Validation.to.Result(errors => errors.join(", "))); // Err("oops")
		 * ```
		 */
		export function Result<E1, E2, A>(
			combineErrors: (errors: NonEmptyArr<E1>) => E2,
		): (val: Validation<E1, A>) => CoreResult<E2, A>;
		export function Result<E, A>(data: Validation<E, A>): CoreResult<NonEmptyArr<E>, A>;
		export function Result<E1, E2, A>(arg: ((errors: NonEmptyArr<E1>) => E2) | Validation<E1, A>): any {
			if (typeof arg === "function") {
				const combine = arg;
				return (val: Validation<E1, A>): CoreResult<E2, A> =>
					is.passed(val) ? CoreResult.make.ok(val.value) : CoreResult.make.err(combine(val.errors));
			}
			return is.passed(arg) ? CoreResult.make.ok(arg.value) : CoreResult.make.err(arg.errors);
		}

		/**
		 * Converts a Validation to a Maybe. `Passed` becomes `Some`; `Failed` becomes `None`
		 * (errors are discarded).
		 *
		 * @example
		 * ```ts
		 * Validation.to.Maybe(Validation.make.passed(42));       // Some(42)
		 * Validation.to.Maybe(Validation.make.failed("bad"));  // None
		 * ```
		 */
		export const Maybe = <E, A>(data: Validation<E, A>): Maybe<A> =>
			is.passed(data) ? CoreMaybe.make.some(data.value) : CoreMaybe.make.none();
	}

	/**
	 * Combines two independent Validation instances into a tuple.
	 * If both are Passed, returns Passed with both values as a tuple.
	 * If either is Failed, accumulates errors from both sides.
	 *
	 * @example
	 * ```ts
	 * Validation.product(
	 *   Validation.make.passed("alice"),
	 *   Validation.make.passed(30)
	 * ); // Passed(["alice", 30])
	 *
	 * Validation.product(
	 *   Validation.make.failed("Name required"),
	 *   Validation.make.failed("Age must be >= 0")
	 * ); // Failed(["Name required", "Age must be >= 0"])
	 * ```
	 */
	export const product = <E, A, B>(
		first: Validation<E, A>,
		second: Validation<E, B>,
	): Validation<E, readonly [A, B]> => {
		if (is.passed(first)) {
			return is.passed(second) ? make.passed([first.value, second.value]) : make.failedAll(second.errors);
		}
		return is.passed(second)
			? make.failedAll(first.errors)
			: make.failedAll([...first.errors, ...second.errors] as NonEmptyArr<E>);
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
	export const productAll = <E, A>(data: NonEmptyArr<Validation<E, A>>): Validation<E, readonly A[]> => {
		const values: A[] = [];
		const errors: E[] = [];
		for (const v of data) {
			if (is.passed(v)) { values.push(v.value); }
			else { errors.push(...v.errors); }
		}
		return isNonEmptyArr(errors) ? make.failedAll(errors) : make.passed(values);
	};

	/**
	 * Combines a record of Validations into a single Validation of a record.
	 * Accumulates all failed branches' errors.
	 *
	 * @example
	 * ```ts
	 * Validation.struct({
	 *   name: Validation.make.passed("Alice"),
	 *   age: Validation.make.passed(30)
	 * }); // Passed({ name: "Alice", age: 30 })
	 *
	 * Validation.struct({
	 *   name: Validation.make.failed("Name required"),
	 *   age: Validation.make.failed("Age must be >= 0")
	 * }); // Failed(["Name required", "Age must be >= 0"])
	 * ```
	 */
	export const struct = <E, R extends Record<string, any>>(
		fields: { [K in keyof R]: Validation<E, R[K]>; },
	): Validation<E, R> => {
		const record = {} as R;
		const errors: E[] = [];
		for (const key in fields) {
			if (Object.hasOwn(fields, key)) {
				const val = fields[key];
				if (is.passed(val)) {
					record[key] = val.value;
				} else {
					errors.push(...val.errors);
				}
			}
		}
		return isNonEmptyArr(errors) ? make.failedAll(errors) : make.passed(record);
	};
}
