import { Maybe as CoreMaybe, Result as CoreResult } from "#core";

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
 *   Refinement.from.predicate(s => s.length > 0);
 *
 * pipe(
 *   "hello",
 *   Refinement.to.Maybe(isNonEmpty)
 * ); // Some("hello")
 * ```
 */
export type Refinement<A, B extends A> = (a: A) => a is B;

const fromPredicate = <A, B extends A>(f: (a: A) => boolean): Refinement<A, B> => f as Refinement<A, B>;

export const Refinement = {
	// --- from ---
	from: {
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
		 *   Refinement.from.predicate(n => n > 0);
		 * ```
		 */
		predicate: fromPredicate,
	},

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
	 *   Refinement.from.predicate(s => s.length > 0);
	 * const isTrimmed: Refinement<NonEmptyString, TrimmedString> =
	 *   Refinement.from.predicate(s => s === s.trim());
	 *
	 * const isNonEmptyTrimmed: Refinement<string, TrimmedString> = pipe(
	 *   isNonEmpty,
	 *   Refinement.compose(isTrimmed)
	 * );
	 * ```
	 */
	compose:
		<A, B extends A, C extends B>(bc: Refinement<B, C>) => (ab: Refinement<A, B>): Refinement<A, C> => (a): a is C =>
			ab(a) && bc(a),

	/**
	 * Intersects two refinements: the result narrows `A` to `B & C`, passing only
	 * when both refinements hold simultaneously.
	 *
	 * Data-last — the first refinement is the data being piped.
	 *
	 * @example
	 * ```ts
	 * const isString: Refinement<unknown, string> = Refinement.from.predicate(x => typeof x === "string");
	 * const isNonEmpty: Refinement<unknown, { length: number }> =
	 *   Refinement.from.predicate(x => (x as any).length > 0);
	 *
	 * const isNonEmptyString = pipe(isString, Refinement.and(isNonEmpty));
	 * isNonEmptyString("hi");  // true
	 * isNonEmptyString("");    // false
	 * ```
	 */
	and:
		<A, C extends A>(second: Refinement<A, C>) =>
		<B extends A>(first: Refinement<A, B>): Refinement<A, B & C> =>
		(a): a is B & C => first(a) && second(a),

	/**
	 * Unions two refinements: the result narrows `A` to `B | C`, passing when either
	 * refinement holds.
	 *
	 * Data-last — the first refinement is the data being piped.
	 *
	 * @example
	 * ```ts
	 * const isString:  Refinement<unknown, string>  = Refinement.from.predicate(x => typeof x === "string");
	 * const isNumber:  Refinement<unknown, number>  = Refinement.from.predicate(x => typeof x === "number");
	 *
	 * const isStringOrNumber = pipe(isString, Refinement.or(isNumber));
	 * isStringOrNumber("hi"); // true
	 * isStringOrNumber(42);   // true
	 * isStringOrNumber(true); // false
	 * ```
	 */
	or:
		<A, C extends A>(second: Refinement<A, C>) =>
		<B extends A>(first: Refinement<A, B>): Refinement<A, B | C> =>
		(a): a is B | C => first(a) || second(a),

	// --- to ---
	to: {
		/**
		 * Converts a `Refinement<A, B>` into a function `(a: A) => Maybe<B>`.
		 *
		 * Returns `Some(a)` when the refinement holds, `None` otherwise. Useful for
		 * integrating runtime validation into a `Maybe`-based pipeline.
		 *
		 * @example
		 * ```ts
		 * type PositiveNumber = number & { readonly _tag: "Positive" };
		 * const isPositive: Refinement<number, PositiveNumber> =
		 *   Refinement.from.predicate(n => n > 0);
		 *
		 * pipe(-1, Refinement.to.Maybe(isPositive)); // None
		 * pipe(42, Refinement.to.Maybe(isPositive)); // Some(42)
		 * ```
		 */
		Maybe: <A, B extends A>(r: Refinement<A, B>) => (a: A): CoreMaybe<B> =>
			r(a) ? CoreMaybe.make.some(a) : CoreMaybe.make.none(),

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
		 *   Refinement.from.predicate(s => s.length > 0);
		 *
		 * pipe("", Refinement.to.Result(isNonEmpty, () => "must not be empty")); // Err(...)
		 * pipe("hi", Refinement.to.Result(isNonEmpty, () => "must not be empty")); // Ok("hi")
		 * ```
		 */
		Result: <A, B extends A, E>(r: Refinement<A, B>, onFail: (a: A) => E) => (a: A): CoreResult<E, B> =>
			r(a) ? CoreResult.make.ok(a) : CoreResult.make.err(onFail(a)),
	},
};
