// =============================================================================
// Imports
// =============================================================================
import { type Result, Result as CoreResult, type Validation, Validation as CoreValidation } from "#core";
import { WithKind, WithValue } from "#internal";

// =============================================================================
// Types
// =============================================================================
/**
 * Maybe represents an optional value: every Maybe is either Some (contains a value) or None (empty).
 * Use Maybe instead of null/undefined to make optionality explicit and composable.
 *
 * @example
 * ```ts
 * const user = { name: "Alice", email: Maybe.make.some("alice@example.com") };
 *
 * pipe(
 *   user.email,
 *   Maybe.map(email => email.toUpperCase()),
 *   Maybe.getOrElse(() => "NO EMAIL")
 * ); // "ALICE@EXAMPLE.COM"
 * ```
 */
export type Maybe<T> = Maybe.Some<T> | Maybe.None;

export namespace Maybe {
	export type Some<A> = WithKind<"Some"> & WithValue<A>;
	export type None = WithKind<"None">;
}

// =============================================================================
// Private Helpers & Variant Constructors
// =============================================================================
const _none: Maybe.None = { kind: "None" };

const makeSome = <A>(value: A): Maybe.Some<A> => ({ kind: "Some", value });
const makeNone = (): Maybe.None => _none;

const isSome = <A>(data: Maybe<A>): data is Maybe.Some<A> => data.kind === "Some";
const isNone = <A>(data: Maybe<A>): data is Maybe.None => data.kind === "None";

// =============================================================================
// Public Export
// =============================================================================
export const Maybe = {
	make: {
		/**
		 * Creates a Some containing the given value.
		 *
		 * @example
		 * ```ts
		 * Maybe.make.some(42); // Some(42)
		 * ```
		 */
		some: makeSome,

		/**
		 * Creates a None (empty Maybe).
		 *
		 * @example
		 * ```ts
		 * Maybe.make.none(); // None
		 * ```
		 */
		none: makeNone,
	},

	is: {
		/**
		 * Type guard that checks if a Maybe is Some.
		 *
		 * @see {@link Maybe.is.none}
		 *
		 * @example
		 * ```ts
		 * const value = Maybe.make.some(42);
		 * if (Maybe.is.some(value)) {
		 *   console.log(value.value); // 42
		 * }
		 * ```
		 */
		some: isSome,

		/**
		 * Type guard that checks if a Maybe is None.
		 *
		 * @see {@link Maybe.is.some}
		 *
		 * @example
		 * ```ts
		 * const value = Maybe.make.none();
		 * if (Maybe.is.none(value)) {
		 *   console.log("No value present");
		 * }
		 * ```
		 */
		none: isNone,
	},

	// --- to ---
	to: {
		/**
		 * Extracts the value from a Maybe, returning null if None.
		 *
		 * @example
		 * ```ts
		 * Maybe.to.nullable(Maybe.make.some(42)); // 42
		 * Maybe.to.nullable(Maybe.make.none());   // null
		 * ```
		 */
		nullable: <A>(data: Maybe<A>): A | null => (isSome(data) ? data.value : null),

		/**
		 * Extracts the value from a Maybe, returning undefined if None.
		 *
		 * @example
		 * ```ts
		 * Maybe.to.undefined(Maybe.make.some(42)); // 42
		 * Maybe.to.undefined(Maybe.make.none());   // undefined
		 * ```
		 */
		undefined: <A>(data: Maybe<A>): A | undefined => (isSome(data) ? data.value : globalThis.undefined),

		/**
		 * Converts a Maybe to a Result.
		 * Some becomes Ok, None becomes Err with the provided error.
		 *
		 * @example
		 * ```ts
		 * pipe(
		 *   Maybe.make.some(42),
		 *   Maybe.to.Result(() => "Value was missing")
		 * ); // Ok(42)
		 *
		 * pipe(
		 *   Maybe.make.none(),
		 *   Maybe.to.Result(() => "Value was missing")
		 * ); // Err("Value was missing")
		 * ```
		 */
		Result: <E>(onNone: () => E) => <A>(data: Maybe<A>): Result<E, A> =>
			isSome(data) ? CoreResult.make.ok(data.value) : CoreResult.make.err(onNone()),

		/**
		 * Converts a Maybe to a Validation.
		 * Some becomes Passed, None becomes Failed with error produced by `onNone`.
		 *
		 * @example
		 * ```ts
		 * pipe(Maybe.make.some(42), Maybe.to.Validation(() => "missing")); // Passed(42)
		 * pipe(Maybe.make.none(), Maybe.to.Validation(() => "missing"));   // Failed(["missing"])
		 * ```
		 */
		Validation: <E>(onNone: () => E) => <A>(data: Maybe<A>): Validation<E, A> =>
			isSome(data) ? CoreValidation.make.passed(data.value) : CoreValidation.make.failed(onNone()),
	},

	// --- from ---
	from: {
		/**
		 * Creates a Maybe from a nullable value.
		 * Returns None if the value is null or undefined, Some otherwise.
		 *
		 * @example
		 * ```ts
		 * Maybe.from.nullable(null); // None
		 * Maybe.from.nullable(42); // Some(42)
		 * ```
		 */
		nullable: <A>(value: A | null | undefined): Maybe<A> =>
			value === null || value === undefined ? makeNone() : makeSome(value),

		/**
		 * Creates a Maybe from a predicate applied to a value.
		 * Returns Some if the predicate passes, None otherwise.
		 *
		 * @example
		 * ```ts
		 * Maybe.from.Predicate((n: number) => n >= 18)(21); // Some(21)
		 * Maybe.from.Predicate((n: number) => n >= 18)(15); // None
		 *
		 * pipe("hello", Maybe.from.Predicate((s: string) => s.length > 0)); // Some("hello")
		 * pipe("", Maybe.from.Predicate((s: string) => s.length > 0));      // None
		 * ```
		 */
		Predicate: <A>(pred: (a: A) => boolean) => (a: A): Maybe<A> => (pred(a) ? makeSome(a) : makeNone()),

		/**
		 * Creates a Maybe from a Result.
		 * Ok becomes Some, Err becomes None (the error is discarded).
		 *
		 * @example
		 * ```ts
		 * Maybe.from.Result(Result.make.ok(42)); // Some(42)
		 * Maybe.from.Result(Result.make.err("oops")); // None
		 * ```
		 */
		Result: <E, A>(data: Result<E, A>): Maybe<A> => (CoreResult.is.ok(data) ? makeSome(data.value) : makeNone()),
	},

	/**
	 * Wraps a synchronous operation that may throw, returning a `Maybe<A>`.
	 * Returns `Some(value)` if successful, or `None` if an exception is thrown.
	 *
	 * @example
	 * ```ts
	 * const safeParse = (s: string) => Maybe.tryCatch(() => JSON.parse(s));
	 * safeParse('{"a": 1}'); // Some({ a: 1 })
	 * safeParse('invalid');   // None
	 * ```
	 */
	tryCatch: <A>(f: () => A): Maybe<A> => {
		try {
			return makeSome(f());
		} catch {
			return makeNone();
		}
	},

	/**
	 * Transforms the value inside a Maybe if it exists.
	 *
	 * @see {@link Maybe.chain} for functions that return a Maybe.
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.make.some(5), Maybe.map(n => n * 2)); // Some(10)
	 * pipe(Maybe.make.none(), Maybe.map(n => n * 2)); // None
	 * ```
	 */
	map: <A, B>(transform: (value: A) => B) => (maybe: Maybe<A>): Maybe<B> =>
		isSome(maybe) ? makeSome(transform(maybe.value)) : maybe,

	/**
	 * Chains Maybe computations. If the first is Some, passes the value to `transform`.
	 * If the first is None, propagates None.
	 *
	 * @see {@link Maybe.map} for transforming with plain non-optional functions.
	 *
	 * @example
	 * ```ts
	 * const parseNumber = (s: string): Maybe<number> => {
	 *   const n = parseInt(s, 10);
	 *   return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	 * };
	 *
	 * pipe(Maybe.make.some("42"), Maybe.chain(parseNumber)); // Some(42)
	 * pipe(Maybe.make.some("abc"), Maybe.chain(parseNumber)); // None
	 * ```
	 */
	chain: <A, B>(transform: (value: A) => Maybe<B>) => (maybe: Maybe<A>): Maybe<B> =>
		isSome(maybe) ? transform(maybe.value) : maybe,

	/**
	 * Extracts the value from a Maybe by providing handlers for both cases.
	 *
	 * @see {@link Maybe.match} for named-case handling using an object.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Maybe.make.some(5),
	 *   Maybe.fold(
	 *     () => "No value",
	 *     n => `Value: ${n}`
	 *   )
	 * ); // "Value: 5"
	 * ```
	 */
	fold: <A, B>(onNone: () => B, onSome: (value: A) => B) => (maybe: Maybe<A>): B =>
		isSome(maybe) ? onSome(maybe.value) : onNone(),

	/**
	 * Pattern matches on a Maybe, returning the result of the matching case.
	 *
	 * @see {@link Maybe.fold} for positional arguments (onNone, onSome).
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
	match: <A, B>(cases: { none: () => B; some: (value: A) => B; }) => (maybe: Maybe<A>): B =>
		isSome(maybe) ? cases.some(maybe.value) : cases.none(),

	/**
	 * Returns the value inside a Maybe, or a default value if None.
	 * The default is a thunk `() => B` — evaluated only when the Maybe is None.
	 * The default can be a different type, widening the result to `A | B`.
	 *
	 * @see {@link Maybe.match}
	 * @see {@link Maybe.to.nullable}
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.make.some(5), Maybe.getOrElse(() => 0)); // 5
	 * pipe(Maybe.make.none(), Maybe.getOrElse(() => 0)); // 0
	 * pipe(Maybe.make.none<string>(), Maybe.getOrElse(() => null)); // null — typed as string | null
	 * ```
	 */
	getOrElse: <B>(defaultValue: () => B) => <A>(maybe: Maybe<A>): A | B => isSome(maybe) ? maybe.value : defaultValue(),

	/**
	 * Executes a side effect on the value without changing the Maybe.
	 * Useful for logging or debugging.
	 *
	 * @see {@link Maybe.tapNone} for running side effects on None.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Maybe.make.some(5),
	 *   Maybe.tap(n => console.log("Value:", n)),
	 *   Maybe.map(n => n * 2)
	 * );
	 * ```
	 */
	tap: <A>(sideEffect: (value: A) => void) => (maybe: Maybe<A>): Maybe<A> => {
		if (isSome(maybe)) {
			sideEffect(maybe.value);
		}
		return maybe;
	},

	/**
	 * Executes a side effect when the Maybe is None, without changing the Maybe.
	 *
	 * @see {@link Maybe.tap} for running side effects on Some.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Maybe.make.none(),
	 *   Maybe.tapNone(() => console.log("Value missing")),
	 * );
	 * ```
	 */
	tapNone: (sideEffect: () => void) => <A>(maybe: Maybe<A>): Maybe<A> => {
		if (isNone(maybe)) {
			sideEffect();
		}
		return maybe;
	},

	/**
	 * Filters a Maybe based on a predicate or type guard.
	 * Returns None if the predicate returns false or if the Maybe is already None.
	 *
	 * @see {@link Maybe.map}
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.make.some(5), Maybe.filter(n => n > 3)); // Some(5)
	 * pipe(Maybe.make.some(2), Maybe.filter(n => n > 3)); // None
	 * pipe(Maybe.make.some("hi"), Maybe.filter((x): x is string => typeof x === "string")); // Some("hi")
	 * ```
	 */
	filter:
		(<A, B extends A>(predicate: (value: A) => boolean) => (maybe: Maybe<A>): Maybe<B> =>
			isSome(maybe)
				? (predicate(maybe.value) ? (maybe as unknown as Maybe<B>) : makeNone())
				: (maybe as unknown as Maybe<B>)) as {
				<A, B extends A>(refinement: (value: A) => value is B): (maybe: Maybe<A>) => Maybe<B>;
				<A>(predicate: (value: A) => boolean): (maybe: Maybe<A>) => Maybe<A>;
			},

	/**
	 * Recovers from a None by providing a fallback Maybe.
	 * The fallback can produce a different type, widening the result to `Maybe<A | B>`.
	 *
	 * @see {@link Maybe.getOrElse}
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.make.none(), Maybe.recover(() => Maybe.make.some(42))); // Some(42)
	 * pipe(Maybe.make.some(10), Maybe.recover(() => Maybe.make.some(42))); // Some(10)
	 * ```
	 */
	recover: <B>(fallback: () => Maybe<B>) => <A>(maybe: Maybe<A>): Maybe<A | B> => (isSome(maybe) ? maybe : fallback()),

	/**
	 * Applies a function wrapped in a Maybe to a value wrapped in a Maybe.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Maybe.make.some(add),
	 *   Maybe.apply(Maybe.make.some(5)),
	 *   Maybe.apply(Maybe.make.some(3))
	 * ); // Some(8)
	 * ```
	 */
	apply: <A>(arg: Maybe<A>) => <B>(data: Maybe<(a: A) => B>): Maybe<B> =>
		isSome(data) && isSome(arg) ? makeSome(data.value(arg.value)) : makeNone(),

	/**
	 * Converts a Maybe value into an object containing a single property.
	 * Initiates the pipeline accumulator record.
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.make.some(42), Maybe.bindTo("value")); // Some({ value: 42 })
	 * ```
	 */
	bindTo: <K extends string>(key: K) => <A>(data: Maybe<A>): Maybe<{ [P in K]: A; }> =>
		isSome(data) ? makeSome({ [key]: data.value } as { [P in K]: A; }) : data,

	/**
	 * Evaluates a new Maybe using the current accumulator and attaches the output to a new key.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Maybe.make.some({ a: 1 }),
	 *   Maybe.bind("b", ({ a }) => Maybe.make.some(a + 1))
	 * ); // Some({ a: 1, b: 2 })
	 * ```
	 */
	bind: <K extends string, A, B>(key: K, f: (a: A) => Maybe<B>) => (data: Maybe<A>): Maybe<A & { [P in K]: B; }> => {
		if (!isSome(data)) {
			return data;
		}
		const mb = f(data.value);
		return isSome(mb) ? makeSome({ ...(data.value as any), [key]: mb.value } as A & { [P in K]: B; }) : mb;
	},

	/**
	 * Combines a record of Maybes into a single Maybe of a record.
	 * Evaluates fields in key order and short-circuits on the first None.
	 *
	 * @example
	 * ```ts
	 * Maybe.struct({
	 *   name: Maybe.make.some("Alice"),
	 *   age: Maybe.make.some(30)
	 * }); // Some({ name: "Alice", age: 30 })
	 * ```
	 */
	struct: <R extends Record<string, any>>(fields: { [K in keyof R]: Maybe<R[K]>; }): Maybe<R> => {
		const result = {} as R;
		for (const key in fields) {
			if (Object.hasOwn(fields, key)) {
				const res = fields[key];
				if (isNone(res)) {
					return res;
				}
				result[key] = res.value;
			}
		}
		return makeSome(result);
	},

	// --- sequence ---
	sequence: {
		/**
		 * Swaps the outer `Maybe` and inner `Result` context.
		 * `Some(Ok(a))` becomes `Ok(Some(a))`, `Some(Err(e))` becomes `Err(e)`, and `None` becomes `Ok(None)`.
		 *
		 * @example
		 * ```ts
		 * Maybe.sequence.Result(Maybe.make.some(Result.make.ok(42)));  // Ok(Some(42))
		 * Maybe.sequence.Result(Maybe.make.some(Result.make.err("e"))); // Err("e")
		 * Maybe.sequence.Result(Maybe.make.none());                     // Ok(None)
		 * ```
		 */
		Result: <E, A>(data: Maybe<Result<E, A>>): Result<E, Maybe<A>> =>
			isNone(data)
				? CoreResult.make.ok(makeNone())
				: CoreResult.is.ok(data.value)
				? CoreResult.make.ok(makeSome(data.value.value))
				: CoreResult.make.err(data.value.error),
	},
};
