import { Option } from "./Option.ts";
import { Result } from "./Result.ts";

/**
 * A function from `A` to `A is B` — a type predicate paired with a runtime check.
 *
 * A `Refinement<A, B>` proves at compile time that a value of type `A` is actually
 * the narrower type `B extends A`, backed by a runtime boolean test. Use it to
 * express domain invariants (non-empty strings, positive numbers, valid emails) as
 * first-class, composable values rather than one-off type guards scattered across
 * the codebase.
 *
 * @example
 * ```ts
 * type NonEmptyString = string & { readonly _tag: "NonEmptyString" };
 *
 * const isNonEmpty: Refinement<string, NonEmptyString> =
 *   Refinement.make(s => s.length > 0);
 *
 * pipe(
 *   "hello",
 *   Refinement.toFilter(isNonEmpty)
 * ); // Some("hello")
 * ```
 */
export type Refinement<A, B extends A> = (a: A) => a is B;

export namespace Refinement {
	/**
	 * Creates a `Refinement<A, B>` from a plain boolean predicate.
	 *
	 * This is an unsafe cast — the caller is responsible for ensuring that the
	 * predicate truly characterises values of type `B`. Use this only when
	 * bootstrapping a new refinement; prefer `compose`, `and`, or `or` to build
	 * derived refinements from existing ones.
	 *
	 * @example
	 * ```ts
	 * type PositiveNumber = number & { readonly _tag: "PositiveNumber" };
	 *
	 * const isPositive: Refinement<number, PositiveNumber> =
	 *   Refinement.make(n => n > 0);
	 * ```
	 */
	export const make = <A, B extends A>(f: (a: A) => boolean): Refinement<A, B> => f as Refinement<A, B>;

	/**
	 * Chains two refinements: if `ab` narrows `A` to `B` and `bc` narrows `B` to `C`,
	 * the result narrows `A` directly to `C`.
	 *
	 * Data-last — the first refinement `ab` is the data being piped.
	 *
	 * @example
	 * ```ts
	 * type NonEmptyString = string & { readonly _tag: "NonEmpty" };
	 * type TrimmedString  = NonEmptyString & { readonly _tag: "Trimmed" };
	 *
	 * const isNonEmpty: Refinement<string, NonEmptyString> =
	 *   Refinement.make(s => s.length > 0);
	 * const isTrimmed: Refinement<NonEmptyString, TrimmedString> =
	 *   Refinement.make(s => s === s.trim());
	 *
	 * const isNonEmptyTrimmed: Refinement<string, TrimmedString> = pipe(
	 *   isNonEmpty,
	 *   Refinement.compose(isTrimmed)
	 * );
	 * ```
	 */
	export const compose =
		<A, B extends A, C extends B>(bc: Refinement<B, C>) => (ab: Refinement<A, B>): Refinement<A, C> => (a): a is C =>
			ab(a) && bc(a);

	/**
	 * Intersects two refinements: the result narrows `A` to `B & C`, passing only
	 * when both refinements hold simultaneously.
	 *
	 * Data-last — the first refinement is the data being piped.
	 *
	 * @example
	 * ```ts
	 * const isString: Refinement<unknown, string> = Refinement.make(x => typeof x === "string");
	 * const isNonEmpty: Refinement<unknown, { length: number }> =
	 *   Refinement.make(x => (x as any).length > 0);
	 *
	 * const isNonEmptyString = pipe(isString, Refinement.and(isNonEmpty));
	 * isNonEmptyString("hi");  // true
	 * isNonEmptyString("");    // false
	 * ```
	 */
	export const and =
		<A, C extends A>(second: Refinement<A, C>) =>
		<B extends A>(first: Refinement<A, B>): Refinement<A, B & C> =>
		(a): a is B & C => first(a) && second(a);

	/**
	 * Unions two refinements: the result narrows `A` to `B | C`, passing when either
	 * refinement holds.
	 *
	 * Data-last — the first refinement is the data being piped.
	 *
	 * @example
	 * ```ts
	 * const isString:  Refinement<unknown, string>  = Refinement.make(x => typeof x === "string");
	 * const isNumber:  Refinement<unknown, number>  = Refinement.make(x => typeof x === "number");
	 *
	 * const isStringOrNumber = pipe(isString, Refinement.or(isNumber));
	 * isStringOrNumber("hi"); // true
	 * isStringOrNumber(42);   // true
	 * isStringOrNumber(true); // false
	 * ```
	 */
	export const or =
		<A, C extends A>(second: Refinement<A, C>) =>
		<B extends A>(first: Refinement<A, B>): Refinement<A, B | C> =>
		(a): a is B | C => first(a) || second(a);

	/**
	 * Converts a `Refinement<A, B>` into a function `(a: A) => Option<B>`.
	 *
	 * Returns `Some(a)` when the refinement holds, `None` otherwise. Useful for
	 * integrating runtime validation into an `Option`-based pipeline.
	 *
	 * @example
	 * ```ts
	 * type PositiveNumber = number & { readonly _tag: "Positive" };
	 * const isPositive: Refinement<number, PositiveNumber> =
	 *   Refinement.make(n => n > 0);
	 *
	 * pipe(-1, Refinement.toFilter(isPositive)); // None
	 * pipe(42, Refinement.toFilter(isPositive)); // Some(42)
	 * ```
	 */
	export const toFilter = <A, B extends A>(r: Refinement<A, B>) => (a: A): Option<B> =>
		r(a) ? Option.some(a) : Option.none();

	/**
	 * Converts a `Refinement<A, B>` into a function `(a: A) => Result<E, B>`.
	 *
	 * Returns `Ok(a)` when the refinement holds, `Err(onFail(a))` otherwise. Use
	 * this to surface validation failures as typed errors inside a `Result` pipeline.
	 *
	 * @example
	 * ```ts
	 * type NonEmptyString = string & { readonly _tag: "NonEmpty" };
	 * const isNonEmpty: Refinement<string, NonEmptyString> =
	 *   Refinement.make(s => s.length > 0);
	 *
	 * pipe("", Refinement.toResult(isNonEmpty, () => "must not be empty")); // Err(...)
	 * pipe("hi", Refinement.toResult(isNonEmpty, () => "must not be empty")); // Ok("hi")
	 * ```
	 */
	export const toResult = <A, B extends A, E>(r: Refinement<A, B>, onFail: (a: A) => E) => (a: A): Result<E, B> =>
		r(a) ? Result.ok(a) : Result.err(onFail(a));
}
