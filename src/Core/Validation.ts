// =============================================================================
// Imports
// =============================================================================
import { isNonEmptyArr, type NonEmptyArr, type WithErrors, type WithKind, type WithValue } from "#internal";
import { type Maybe, Maybe as CoreMaybe } from "./Maybe.ts";
import { type Result, Result as CoreResult } from "./Result.ts";

// =============================================================================
// Types
// =============================================================================
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
 * // Accumulates all errors using apply
 * pipe(
 *   Validation.make.passed((name: string) => (age: number) => ({ name, age })),
 *   Validation.apply(validateName("")),
 *   Validation.apply(validateAge(-1))
 * );
 * // Failed(["Name is required", "Age must be positive"])
 * ```
 */
export type Validation<E, A> = Validation.Passed<A> | Validation.Failed<E>;

export namespace Validation {
	export type Passed<A> = WithKind<"Passed"> & WithValue<A>;
	export type Failed<E> = WithKind<"Failed"> & WithErrors<E>;
	export type KeyedErrors<T, E = unknown> = { readonly [K in keyof T]?: NonEmptyArr<E>; };
	export type KeyedResult<T, E> = { readonly [K in keyof T]: Validation<E, T[K]>; };
}

// =============================================================================
// Private Helpers & Variant Constructors
// =============================================================================
const makePassed = <A>(value: A): Validation.Passed<A> => ({ kind: "Passed", value });
const makeFailed = <E>(error: E): Validation.Failed<E> => ({ kind: "Failed", errors: [error] });
const makeFailedAll = <E>(errors: NonEmptyArr<E>): Validation.Failed<E> => ({ kind: "Failed", errors });

const isPassed = <E, A>(validation: Validation<E, A>): validation is Validation.Passed<A> =>
	validation.kind === "Passed";
const isFailed = <E, A>(validation: Validation<E, A>): validation is Validation.Failed<E> =>
	validation.kind === "Failed";

const setProperty = <T extends Record<string, unknown>>(target: T, key: string, value: unknown): void => {
	if (key === "__proto__") {
		Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
	} else {
		(target as Record<string, unknown>)[key] = value;
	}
};

// =============================================================================
// Combinators
// =============================================================================
function toResult<E1, E2, A>(
	combineErrors: (errors: NonEmptyArr<E1>) => E2,
): (validation: Validation<E1, A>) => CoreResult<E2, A>;
function toResult<E, A>(validation: Validation<E, A>): CoreResult<NonEmptyArr<E>, A>;
function toResult<E1, E2, A>(
	arg: ((errors: NonEmptyArr<E1>) => E2) | Validation<E1, A>,
): ((validation: Validation<E1, A>) => CoreResult<E2, A>) | CoreResult<NonEmptyArr<E1>, A> {
	if (typeof arg === "function") {
		const combine = arg;
		return (validation: Validation<E1, A>): CoreResult<E2, A> =>
			isPassed(validation) ? CoreResult.make.ok(validation.value) : CoreResult.make.err(combine(validation.errors));
	}
	return isPassed(arg) ? CoreResult.make.ok(arg.value) : CoreResult.make.err(arg.errors);
}

function apply<E2 = never, A = unknown>(
	arg: Validation<E2, A>,
): <B, E1 = never>(validation: Validation<E1, (value: A) => B>) => Validation<E1 | E2, B>;
function apply<E1, E2, A, E3>(
	arg: Validation<E2, A>,
	options: { combineErrors: (e1: NonEmptyArr<E1>, e2: NonEmptyArr<E2>) => NonEmptyArr<E3>; },
): <B>(validation: Validation<E1, (value: A) => B>) => Validation<E3, B>;
function apply<E2 = never, A = unknown, E3 = never>(
	arg: Validation<E2, A>,
	options?: { combineErrors?: (e1: NonEmptyArr<unknown>, e2: NonEmptyArr<E2>) => NonEmptyArr<E3>; },
): <B, E1 = never>(validation: Validation<E1, (value: A) => B>) => Validation<[E3] extends [never] ? E1 | E2 : E3, B> {
	return <B, E1 = never>(
		validation: Validation<E1, (value: A) => B>,
	): Validation<[E3] extends [never] ? E1 | E2 : E3, B> => {
		if (isPassed(validation)) {
			return isPassed(arg)
				? makePassed(validation.value(arg.value))
				: makeFailedAll(arg.errors as unknown as NonEmptyArr<[E3] extends [never] ? E1 | E2 : E3>);
		}
		if (isPassed(arg)) {
			return makeFailedAll(validation.errors as unknown as NonEmptyArr<[E3] extends [never] ? E1 | E2 : E3>);
		}
		const combined = options?.combineErrors
			? options.combineErrors(validation.errors as unknown as NonEmptyArr<unknown>, arg.errors)
			: ([...validation.errors, ...arg.errors] as unknown as NonEmptyArr<[E3] extends [never] ? E1 | E2 : E3>);
		return makeFailedAll(combined as NonEmptyArr<[E3] extends [never] ? E1 | E2 : E3>);
	};
}

// =============================================================================
// Public Export
// =============================================================================
export const Validation = {
	make: {
		/**
		 * Wraps a value in a passed Validation.
		 *
		 * @example
		 * ```ts
		 * Validation.make.passed(42); // Passed(42)
		 * ```
		 */
		passed: makePassed,

		/**
		 * Creates a failed Validation from a single error.
		 *
		 * @example
		 * ```ts
		 * Validation.make.failed("Invalid input");
		 * ```
		 */
		failed: makeFailed,

		/**
		 * Creates a failed Validation from multiple errors.
		 *
		 * @example
		 * ```ts
		 * Validation.make.failedAll(["Invalid input"]);
		 * ```
		 */
		failedAll: makeFailedAll,
	},

	is: {
		/**
		 * Type guard that checks if a Validation is passed.
		 *
		 * @see {@link Validation.is.failed} to check if a Validation is failed.
		 *
		 * @example
		 * ```ts
		 * const v = Validation.make.passed(42);
		 * if (Validation.is.passed(v)) {
		 *   console.log(v.value); // 42
		 * }
		 * ```
		 */
		passed: isPassed,

		/**
		 * Type guard that checks if a Validation is failed.
		 *
		 * @see {@link Validation.is.passed} to check if a Validation is passed.
		 *
		 * @example
		 * ```ts
		 * const v = Validation.make.failed("invalid");
		 * if (Validation.is.failed(v)) {
		 *   console.log(v.errors); // ["invalid"]
		 * }
		 * ```
		 */
		failed: isFailed,
	},

	/**
	 * Creates a Validation from a synchronous thunk that may throw.
	 * Catches any errors and transforms them using the `onError` function into a Failed validation.
	 *
	 * @example
	 * ```ts
	 * const result = Validation.tryCatch(
	 *   () => JSON.parse(rawString),
	 *   { onError: (error) => `Parse error: ${error}` }
	 * );
	 * ```
	 */
	tryCatch: <E, A>(fn: () => A, options: { onError: (error: unknown) => E; }): Validation<E, A> => {
		try {
			return makePassed(fn());
		} catch (error) {
			return makeFailed(options.onError(error));
		}
	},

	// --- from ---
	from: {
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
		Predicate:
			(<A, B extends A, E>(predicate: (value: A) => boolean, onFalse: (value: A) => E) => (value: A): Validation<E, B> =>
				predicate(value) ? makePassed(value as unknown as B) : makeFailed(onFalse(value))) as {
					<A, B extends A, E>(
						refinement: (value: A) => value is B,
						onFalse: (value: A) => E,
					): (value: A) => Validation<E, B>;
					<A, E>(predicate: (value: A) => boolean, onFalse: (value: A) => E): (value: A) => Validation<E, A>;
				},

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
		nullable: <E>(onNull: () => E) => <A>(value: A | null | undefined): Validation<E, A> =>
			value === null || value === undefined ? makeFailed(onNull()) : makePassed(value),

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
		Maybe: <E>(onNone: () => E) => <A>(maybe: Maybe<A>): Validation<E, A> =>
			CoreMaybe.is.none(maybe) ? makeFailed(onNone()) : makePassed(maybe.value),

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
		Result: <E, A>(result: Result<E, A>): Validation<E, A> =>
			result.kind === "Ok" ? makePassed(result.value) : makeFailed(result.error),
	},

	/**
	 * Transforms the success value inside a Validation.
	 *
	 * @see {@link Validation.mapError} to transform accumulated errors.
	 * @see {@link Validation.apply} to combine multiple validations.
	 *
	 * @example
	 * ```ts
	 * pipe(Validation.make.passed(5), Validation.map(n => n * 2)); // Passed(10)
	 * pipe(Validation.make.failed("oops"), Validation.map(n => n * 2)); // Failed(["oops"])
	 * ```
	 */
	map: <A, B>(transform: (value: A) => B) => <E = never>(validation: Validation<E, A>): Validation<E, B> =>
		isPassed(validation) ? makePassed(transform(validation.value)) : validation,

	/**
	 * Transforms the error list inside a Validation.
	 *
	 * @see {@link Validation.map} to transform the success value.
	 *
	 * @example
	 * ```ts
	 * pipe(Validation.make.failed("oops"), Validation.mapError(e => e.toUpperCase())); // Failed(["OOPS"])
	 * ```
	 */
	mapError: <E, F>(transform: (error: E) => F) => <A = never>(validation: Validation<E, A>): Validation<F, A> => {
		if (isFailed(validation)) {
			const { errors } = validation;
			const len = errors.length;
			const mapped = new Array<F>(len);
			for (let i = 0; i < len; i++) {
				mapped[i] = transform(errors[i]);
			}
			return makeFailedAll(mapped as unknown as NonEmptyArr<F>);
		}
		return validation;
	},

	/**
	 * Applies a function wrapped in a Validation to a value wrapped in a Validation.
	 * Accumulates errors from both sides if both fail, using optional `combineErrors`
	 * or default concatenation.
	 *
	 * @see {@link Validation.struct} to combine record validations.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Validation.make.passed(add),
	 *   Validation.apply(Validation.make.passed(5)),
	 *   Validation.apply(Validation.make.passed(3))
	 * ); // Passed(8)
	 *
	 * pipe(
	 *   Validation.make.passed(add),
	 *   Validation.apply(Validation.make.failed<string>("bad a")),
	 *   Validation.apply(Validation.make.failed<string>("bad b"))
	 * ); // Failed(["bad a", "bad b"])
	 *
	 * // Custom error combination:
	 * pipe(
	 *   Validation.make.passed(add),
	 *   Validation.apply(Validation.make.failed("err"), {
	 *     combineErrors: (e1, e2) => [...e1, ...e2],
	 *   })
	 * );
	 * ```
	 */
	apply,

	/**
	 * Pattern matches on a Validation, returning the result of the matching case.
	 *
	 * @see {@link Validation.getOrElse} to extract the success value with a default fallback.
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
	match:
		<E, A, B>(cases: { passed: (value: A) => B; failed: (errors: NonEmptyArr<E>) => B; }) =>
		(validation: Validation<E, A>): B =>
			isPassed(validation) ? cases.passed(validation.value) : cases.failed(validation.errors),

	/**
	 * Returns the success value or a default value if the Validation is failed.
	 * The default can be a different type, widening the result to `A | B`.
	 *
	 * @see {@link Validation.match} to handle both the passed and failed cases.
	 *
	 * @example
	 * ```ts
	 * pipe(Validation.make.passed(5), Validation.getOrElse(() => 0)); // 5
	 * pipe(Validation.make.failed("oops"), Validation.getOrElse(() => 0)); // 0
	 * pipe(Validation.make.failed("oops"), Validation.getOrElse(() => null)); // null — typed as number | null
	 * ```
	 */
	getOrElse: <B>(fallback: () => B) => <A, E = never>(validation: Validation<E, A>): A | B =>
		isPassed(validation) ? validation.value : fallback(),

	/**
	 * Executes a side effect on the success value without changing the Validation.
	 *
	 * @see {@link Validation.tapError} to perform a side effect on accumulated errors.
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
	tap: <A>(sideEffect: (value: A) => void) => <E = never>(validation: Validation<E, A>): Validation<E, A> => {
		if (isPassed(validation)) { sideEffect(validation.value); }
		return validation;
	},

	/**
	 * Executes a side effect on the accumulated errors without changing the Validation.
	 * Useful for logging or reporting validation failures.
	 *
	 * @see {@link Validation.tap} to perform a side effect on the success value.
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
	tapError:
		<E>(sideEffect: (errors: NonEmptyArr<E>) => void) => <A = never>(validation: Validation<E, A>): Validation<E, A> => {
			if (isFailed(validation)) { sideEffect(validation.errors); }
			return validation;
		},

	/**
	 * Recovers from a Failed state by providing a fallback Validation.
	 * The fallback receives the accumulated error list so callers can inspect which errors occurred.
	 * The fallback can produce a different success type or resolve with a different error type.
	 *
	 * @see {@link Validation.recoverUnless} to conditionally recover based on accumulated errors.
	 */
	recover:
		<E1, E2, B>(fallback: (errors: NonEmptyArr<E1>) => Validation<E2, B>) =>
		<A = never>(validation: Validation<E1, A>): Validation<E2, A | B> =>
			isPassed(validation) ? validation : fallback(validation.errors),

	/**
	 * Recovers from a Failed state unless `isBlocked` returns true for any of the accumulated errors.
	 * The fallback can produce a different success type, widening the result to `Validation<E1 | E2, A | B>`.
	 *
	 * @see {@link Validation.recover} for unconditional error recovery.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Validation.make.failed("field-error"),
	 *   Validation.recoverUnless(e => e === "fatal", () => Validation.make.passed(0))
	 * ); // Passed(0)
	 * ```
	 */
	recoverUnless:
		<E1, E2, B>(isBlocked: (error: E1) => boolean, fallback: (errors: NonEmptyArr<E1>) => Validation<E2, B>) =>
		<A = never>(validation: Validation<E1, A>): Validation<E1 | E2, A | B> => {
			if (isFailed(validation)) {
				const { errors } = validation;
				const len = errors.length;
				let blocked = false;
				for (let i = 0; i < len; i++) {
					if (isBlocked(errors[i])) {
						blocked = true;
						break;
					}
				}
				if (!blocked) {
					return fallback(errors);
				}
			}
			return validation;
		},

	// --- to ---
	to: {
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
		Result: toResult,

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
		Maybe: <E, A>(validation: Validation<E, A>): Maybe<A> =>
			isPassed(validation) ? CoreMaybe.make.some(validation.value) : CoreMaybe.make.none(),
	},

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
	struct: <T extends Record<string, Validation<unknown, unknown>>>(
		fields: T,
	): Validation<
		T[keyof T] extends Validation<infer E, unknown> ? E : never,
		{ [K in keyof T]: T[K] extends Validation<unknown, infer A> ? A : never; }
	> => {
		type ErrUnion = T[keyof T] extends Validation<infer Err, unknown> ? Err : never;
		type Out = { [K in keyof T]: T[K] extends Validation<unknown, infer Val> ? Val : never; };
		const record = {} as Out;
		const errors: ErrUnion[] = [];
		for (const key in fields) {
			if (Object.hasOwn(fields, key)) {
				const val = fields[key];
				if (isPassed(val)) {
					setProperty(record as Record<string, unknown>, key, val.value);
				} else {
					for (let i = 0; i < val.errors.length; i++) {
						errors.push(val.errors[i] as ErrUnion);
					}
				}
			}
		}
		return isNonEmptyArr(errors) ? makeFailedAll(errors) : makePassed(record);
	},

	keyed: {
		/**
		 * Creates a keyed validator function from a schema of field validators.
		 * Evaluates each validator against its corresponding field in the input object,
		 * returning a record where every key holds its own Validation outcome.
		 *
		 * @example
		 * ```ts
		 * const validateUser = Validation.keyed.make({
		 *   name: (s: string) => s.length > 0 ? Validation.make.passed(s) : Validation.make.failed("Name required"),
		 *   age: (n: number) => n >= 18 ? Validation.make.passed(n) : Validation.make.failed("Must be 18+"),
		 * });
		 *
		 * const result = validateUser({ name: "", age: 16 });
		 * // { name: Failed(["Name required"]), age: Failed(["Must be 18+"]) }
		 * ```
		 */
		make:
			<T extends Record<string, unknown>, E = unknown>(
				validators: { readonly [K in keyof T]: (val: T[K]) => Validation<E, T[K]>; },
			) =>
			(input: T): Validation.KeyedResult<T, E> => {
				const out = {} as { [K in keyof T]: Validation<E, T[K]>; };
				for (const key in validators) {
					if (Object.hasOwn(validators, key)) {
						out[key] = validators[key](input[key]);
					}
				}
				return out;
			},

		is: {
			/**
			 * Type guard checking if every keyed field is Passed.
			 *
			 * @see {@link Validation.keyed.is.failed} to check if any keyed field failed.
			 *
			 * @example
			 * ```ts
			 * if (Validation.keyed.is.passed(results)) {
			 *   // results.name is Passed<string>, results.age is Passed<number>
			 * }
			 * ```
			 */
			passed: <T extends Record<string, unknown>, E>(
				keyed: { readonly [K in keyof T]: Validation<E, T[K]>; },
			): keyed is { readonly [K in keyof T]: Validation.Passed<T[K]>; } => {
				for (const key in keyed) {
					if (Object.hasOwn(keyed, key) && keyed[key].kind !== "Passed") {
						return false;
					}
				}
				return true;
			},

			/**
			 * Checks if at least one keyed field is Failed.
			 *
			 * @see {@link Validation.keyed.is.passed} to check if all keyed fields passed.
			 *
			 * @example
			 * ```ts
			 * if (Validation.keyed.is.failed(results)) {
			 *   console.log("Validation errors occurred");
			 * }
			 * ```
			 */
			failed: <T extends Record<string, unknown>, E>(
				keyed: { readonly [K in keyof T]: Validation<E, T[K]>; },
			): boolean => {
				for (const key in keyed) {
					if (Object.hasOwn(keyed, key) && keyed[key].kind === "Failed") {
						return true;
					}
				}
				return false;
			},
		},

		/**
		 * Extracts all validated field values if every field passed.
		 * Returns `Some(data)` if all passed, `None` if any field failed.
		 *
		 * @see {@link Validation.keyed.getErrors} to extract keyed field errors when failures occur.
		 *
		 * @example
		 * ```ts
		 * const passed = Validation.keyed.getPassed(results);
		 * // Some({ name: "Alice", age: 30 }) or None
		 * ```
		 */
		getPassed: <T extends Record<string, unknown>, E>(
			keyed: { readonly [K in keyof T]: Validation<E, T[K]>; },
		): Maybe<T> => {
			const out = {} as T;
			for (const key in keyed) {
				if (Object.hasOwn(keyed, key)) {
					const v = keyed[key];
					if (v.kind !== "Passed") {
						return CoreMaybe.make.none();
					}
					out[key] = v.value;
				}
			}
			return CoreMaybe.make.some(out);
		},

		/**
		 * Extracts keyed field errors if any field failed.
		 * Symmetrical to `getPassed`: returns `Some(errors)` when there are failures,
		 * or `None` if every field passed.
		 *
		 * @see {@link Validation.keyed.getPassed} to extract keyed values when all fields pass.
		 *
		 * @example
		 * ```ts
		 * const errors = Validation.keyed.getErrors(results);
		 * // Some({ name: ["Name required"] }) or None
		 * ```
		 */
		getErrors: <T extends Record<string, unknown>, E>(
			keyed: { readonly [K in keyof T]: Validation<E, T[K]>; },
		): Maybe<Validation.KeyedErrors<T, E>> => {
			let hasFailed = false;
			const out: { [K in keyof T]?: NonEmptyArr<E>; } = {};
			for (const key in keyed) {
				if (Object.hasOwn(keyed, key)) {
					const v = keyed[key];
					if (v.kind === "Failed") {
						hasFailed = true;
						out[key] = v.errors;
					}
				}
			}
			return hasFailed ? CoreMaybe.make.some(out) : CoreMaybe.make.none();
		},
	},
};
