/* eslint-disable no-shadow-restricted-names */
import { type Result, Result as CoreResult } from "#core";
import { WithKind, WithValue } from "#internal";

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
export type Maybe<T> = Some<T> | None;

export type Some<A> = WithKind<"Some"> & WithValue<A>;
export type None = WithKind<"None">;

const _none: None = { kind: "None" };

export namespace Maybe {
	export namespace make {
		/**
		 * Creates a Some containing the given value.
		 *
		 * @example
		 * ```ts
		 * Maybe.make.some(42); // Some(42)
		 * ```
		 */
		export const some = <A>(value: A): Some<A> => ({ kind: "Some", value });

		/**
		 * Creates a None (empty Maybe).
		 *
		 * @example
		 * ```ts
		 * Maybe.make.none(); // None
		 * ```
		 */
		export const none = (): None => _none;
	}

	export namespace is {
		/**
		 * Type guard that checks if a Maybe is Some.
		 *
		 * @example
		 * ```ts
		 * const value = Maybe.make.some(42);
		 * if (Maybe.is.some(value)) {
		 *   console.log(value.value); // 42
		 * }
		 * ```
		 */
		export const some = <A>(data: Maybe<A>): data is Some<A> => data.kind === "Some";

		/**
		 * Type guard that checks if a Maybe is None.
		 *
		 * @example
		 * ```ts
		 * const value = Maybe.make.none();
		 * if (Maybe.is.none(value)) {
		 *   console.log("No value present");
		 * }
		 * ```
		 */
		export const none = <A>(data: Maybe<A>): data is None => data.kind === "None";
	}

	// --- to ---
	export namespace to {
		/**
		 * Extracts the value from a Maybe, returning null if None.
		 *
		 * @example
		 * ```ts
		 * Maybe.to.nullable(Maybe.make.some(42)); // 42
		 * Maybe.to.nullable(Maybe.make.none());   // null
		 * ```
		 */
		export const nullable = <A>(data: Maybe<A>): A | null => is.some(data) ? data.value : null;

		/**
		 * Extracts the value from a Maybe, returning undefined if None.
		 *
		 * @example
		 * ```ts
		 * Maybe.to.undefined(Maybe.make.some(42)); // 42
		 * Maybe.to.undefined(Maybe.make.none());   // undefined
		 * ```
		 */
		export const undefined = <A>(data: Maybe<A>): A | undefined => is.some(data) ? data.value : globalThis.undefined;

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
		export const Result = <E>(onNone: () => E) => <A>(data: Maybe<A>): Result<E, A> =>
			is.some(data) ? CoreResult.make.ok(data.value) : CoreResult.make.err(onNone());
	}

	// --- from ---
	export namespace from {
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
		export const nullable = <A>(value: A | null | undefined): Maybe<A> =>
			value === null || value === undefined ? make.none() : make.some(value);

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
		export const Predicate = <A>(pred: (a: A) => boolean) => (a: A): Maybe<A> => pred(a) ? make.some(a) : make.none();

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
		export const Result = <E, A>(data: Result<E, A>): Maybe<A> =>
			CoreResult.is.ok(data) ? make.some(data.value) : make.none();
	}

	/**
	 * Transforms the value inside a Maybe if it exists.
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.make.some(5), Maybe.map(n => n * 2)); // Some(10)
	 * pipe(Maybe.make.none(), Maybe.map(n => n * 2)); // None
	 * ```
	 */
	export const map = <A, B>(f: (a: A) => B) => (data: Maybe<A>): Maybe<B> =>
		is.some(data) ? make.some(f(data.value)) : data;

	/**
	 * Chains Maybe computations. If the first is Some, passes the value to f.
	 * If the first is None, propagates None.
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
	export const chain = <A, B>(f: (a: A) => Maybe<B>) => (data: Maybe<A>): Maybe<B> =>
		is.some(data) ? f(data.value) : data;

	/**
	 * Extracts the value from a Maybe by providing handlers for both cases.
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
	export const fold = <A, B>(onNone: () => B, onSome: (a: A) => B) => (data: Maybe<A>): B =>
		is.some(data) ? onSome(data.value) : onNone();

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
		is.some(data) ? cases.some(data.value) : cases.none();

	/**
	 * Returns the value inside a Maybe, or a default value if None.
	 * The default is a thunk `() => B` — evaluated only when the Maybe is None.
	 * The default can be a different type, widening the result to `A | B`.
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.make.some(5), Maybe.getOrElse(() => 0)); // 5
	 * pipe(Maybe.make.none(), Maybe.getOrElse(() => 0)); // 0
	 * pipe(Maybe.make.none<string>(), Maybe.getOrElse(() => null)); // null — typed as string | null
	 * ```
	 */
	export const getOrElse = <B>(defaultValue: () => B) => <A>(data: Maybe<A>): A | B =>
		is.some(data) ? data.value : defaultValue();

	/**
	 * Executes a side effect on the value without changing the Maybe.
	 * Useful for logging or debugging.
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
	export const tap = <A>(f: (a: A) => void) => (data: Maybe<A>): Maybe<A> => {
		if (is.some(data)) { f(data.value); }
		return data;
	};

	/**
	 * Filters a Maybe based on a predicate.
	 * Returns None if the predicate returns false or if the Maybe is already None.
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.make.some(5), Maybe.filter(n => n > 3)); // Some(5)
	 * pipe(Maybe.make.some(2), Maybe.filter(n => n > 3)); // None
	 * ```
	 */
	export const filter = <A>(predicate: (a: A) => boolean) => (data: Maybe<A>): Maybe<A> =>
		is.some(data) ? (predicate(data.value) ? data : make.none()) : data;

	/**
	 * Recovers from a None by providing a fallback Maybe.
	 * The fallback can produce a different type, widening the result to `Maybe<A | B>`.
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.make.none(), Maybe.recover(() => Maybe.make.some(42))); // Some(42)
	 * pipe(Maybe.make.some(10), Maybe.recover(() => Maybe.make.some(42))); // Some(10)
	 * ```
	 */
	export const recover = <B>(fallback: () => Maybe<B>) => <A>(data: Maybe<A>): Maybe<A | B> =>
		is.some(data) ? data : fallback();

	/**
	 * Applies a function wrapped in a Maybe to a value wrapped in a Maybe.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Maybe.make.some(add),
	 *   Maybe.ap(Maybe.make.some(5)),
	 *   Maybe.ap(Maybe.make.some(3))
	 * ); // Some(8)
	 * ```
	 */
	export const ap = <A>(arg: Maybe<A>) => <B>(data: Maybe<(a: A) => B>): Maybe<B> =>
		is.some(data) && is.some(arg) ? make.some(data.value(arg.value)) : make.none();

	/**
	 * Converts a Maybe value into an object containing a single property.
	 * Initiates the pipeline accumulator record.
	 *
	 * @example
	 * ```ts
	 * pipe(Maybe.make.some(42), Maybe.bindTo("value")); // Some({ value: 42 })
	 * ```
	 */
	export const bindTo = <K extends string>(key: K) => <A>(data: Maybe<A>): Maybe<{ [P in K]: A; }> =>
		map<A, { [P in K]: A; }>((a) => ({ [key]: a } as { [P in K]: A; }))(data);

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
	export const bind =
		<K extends string, A, B>(key: K, f: (a: A) => Maybe<B>) => (data: Maybe<A>): Maybe<A & { [P in K]: B; }> =>
			chain<A, A & { [P in K]: B; }>((a) =>
				map<B, A & { [P in K]: B; }>((b) => ({ ...(a as any), [key]: b } as A & { [P in K]: B; }))(f(a))
			)(data);

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
	export const struct = <R extends Record<string, any>>(fields: { [K in keyof R]: Maybe<R[K]>; }): Maybe<R> => {
		const result = {} as R;
		for (const key in fields) {
			if (Object.hasOwn(fields, key)) {
				const res = fields[key];
				if (is.none(res)) {
					return res;
				}
				result[key] = res.value;
			}
		}
		return make.some(result);
	};

	/**
	 * Swaps the outer `Maybe` and inner `Result` context.
	 * `Some(Ok(a))` becomes `Ok(Some(a))`, `Some(Err(e))` becomes `Err(e)`, and `None` becomes `Ok(None)`.
	 *
	 * @example
	 * ```ts
	 * Maybe.transposeResult(Maybe.make.some(Result.make.ok(42)));  // Ok(Some(42))
	 * Maybe.transposeResult(Maybe.make.some(Result.make.err("e"))); // Err("e")
	 * Maybe.transposeResult(Maybe.make.none());                     // Ok(None)
	 * ```
	 */
	export const transposeResult = <E, A>(data: Maybe<Result<E, A>>): Result<E, Maybe<A>> =>
		is.none(data)
			? CoreResult.make.ok(make.none())
			: (CoreResult.is.ok(data.value)
				? CoreResult.make.ok(make.some(data.value.value))
				: CoreResult.make.err(data.value.error));
}
