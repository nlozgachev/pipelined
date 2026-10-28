import { Refinement } from "./Refinement.ts";

/**
 * A boolean-valued function over a type `A`.
 *
 * A `Predicate<A>` is the simpler sibling of `Refinement<A, B>`: it tests whether a
 * value satisfies a condition at runtime but carries no compile-time narrowing guarantee.
 * Use it when you need to combine, negate, or adapt boolean checks as first-class values
 * and do not require the extra type information that a `Refinement` provides.
 *
 * Every `Refinement<A, B>` is a `Predicate<A>` — convert with `Predicate.from.Refinement`
 * when you want to compose a narrowing check alongside plain predicates.
 *
 * @example
 * ```ts
 * const isAdult: Predicate<number> = n => n >= 18;
 * const isRetired: Predicate<number> = n => n >= 65;
 *
 * const isWorkingAge: Predicate<number> = pipe(
 *   isAdult,
 *   Predicate.and(Predicate.not(isRetired))
 * );
 *
 * isWorkingAge(30);  // true
 * isWorkingAge(15);  // false
 * isWorkingAge(70);  // false
 * ```
 */
export type Predicate<A> = (a: A) => boolean;

const fromRefinement = <A, B extends A>(refinement: Refinement<A, B>): Predicate<A> => refinement;

export const Predicate = {
	/**
	 * Negates a predicate: the result passes exactly when the original fails.
	 *
	 * @example
	 * ```ts
	 * const isBlank: Predicate<string> = s => s.trim().length === 0;
	 * const isNotBlank = Predicate.not(isBlank);
	 *
	 * isNotBlank("hello");  // true
	 * isNotBlank("   ");    // false
	 * ```
	 */
	not: <A>(predicate: Predicate<A>): Predicate<A> => (value) => !predicate(value),

	/**
	 * Combines two predicates with logical AND: passes only when both hold.
	 *
	 * Data-last — the first predicate is the data being piped.
	 *
	 * @example
	 * ```ts
	 * const isPositive: Predicate<number> = n => n > 0;
	 * const isEven: Predicate<number> = n => n % 2 === 0;
	 *
	 * const isPositiveEven: Predicate<number> = pipe(isPositive, Predicate.and(isEven));
	 *
	 * isPositiveEven(4);   // true
	 * isPositiveEven(3);   // false — positive but odd
	 * isPositiveEven(-2);  // false — even but not positive
	 * ```
	 */
	and: <A>(that: Predicate<A>) => (predicate: Predicate<A>): Predicate<A> => (value) => predicate(value) && that(value),

	/**
	 * Combines two predicates with logical OR: passes when either holds.
	 *
	 * Data-last — the first predicate is the data being piped.
	 *
	 * @example
	 * ```ts
	 * const isChild: Predicate<number> = n => n < 13;
	 * const isSenior: Predicate<number> = n => n >= 65;
	 *
	 * const getsDiscount: Predicate<number> = pipe(isChild, Predicate.or(isSenior));
	 *
	 * getsDiscount(8);   // true
	 * getsDiscount(70);  // true
	 * getsDiscount(30);  // false
	 * ```
	 */
	or: <A>(that: Predicate<A>) => (predicate: Predicate<A>): Predicate<A> => (value) => predicate(value) || that(value),

	/**
	 * Adapts a `Predicate<A>` to work on a different input type `B` by applying `transform`
	 * to extract the relevant `A` from a `B` before running the check.
	 *
	 * Data-last — the predicate is the data being piped; `transform` is the extractor.
	 *
	 * @example
	 * ```ts
	 * type User = { name: string; age: number };
	 *
	 * const isAdult: Predicate<number> = n => n >= 18;
	 *
	 * // Lift isAdult to work on Users by extracting the age field
	 * const isAdultUser: Predicate<User> = pipe(
	 *   isAdult,
	 *   Predicate.using((u: User) => u.age)
	 * );
	 *
	 * isAdultUser({ name: "Alice", age: 30 });  // true
	 * isAdultUser({ name: "Bob",   age: 15 });  // false
	 * ```
	 */
	using: <A, B>(transform: (value: B) => A) => (predicate: Predicate<A>): Predicate<B> => (value) =>
		predicate(transform(value)),

	/**
	 * Combines an array of predicates with AND: passes only when every predicate holds.
	 * Returns `true` for an empty array (vacuous truth).
	 *
	 * @example
	 * ```ts
	 * const checks: Predicate<string>[] = [
	 *   s => s.length > 0,
	 *   s => s.length <= 100,
	 *   s => !s.includes("<"),
	 * ];
	 *
	 * Predicate.all(checks)("hello");  // true
	 * Predicate.all(checks)("");       // false — too short
	 * Predicate.all(checks)("<b>");    // false — contains "<"
	 * Predicate.all([])("anything");   // true
	 * ```
	 */
	all: <A>(predicates: ReadonlyArray<Predicate<A>>): Predicate<A> => (value) => {
		for (let i = 0; i < predicates.length; i++) {
			if (!predicates[i](value)) {
				return false;
			}
		}
		return true;
	},

	/**
	 * Combines an array of predicates with OR: passes when at least one holds.
	 * Returns `false` for an empty array.
	 *
	 * @example
	 * ```ts
	 * const acceptedFormats: Predicate<string>[] = [
	 *   s => s.endsWith(".jpg"),
	 *   s => s.endsWith(".png"),
	 *   s => s.endsWith(".webp"),
	 * ];
	 *
	 * Predicate.any(acceptedFormats)("photo.jpg");   // true
	 * Predicate.any(acceptedFormats)("photo.gif");   // false
	 * Predicate.any([])("anything");                 // false
	 * ```
	 */
	any: <A>(predicates: ReadonlyArray<Predicate<A>>): Predicate<A> => (value) => {
		for (let i = 0; i < predicates.length; i++) {
			if (predicates[i](value)) {
				return true;
			}
		}
		return false;
	},

	// --- from ---
	from: {
		/**
		 * Converts a `Refinement<A, B>` into a `Predicate<A>`, discarding the compile-time
		 * narrowing. Use this when you want to combine a type guard with plain predicates
		 * using `and`, `or`, or `all`.
		 *
		 * This is a zero-cost runtime type cast.
		 *
		 * @see {@link Refinement.to.Predicate} for the inverse converter under the Refinement namespace.
		 *
		 * @example
		 * ```ts
		 * type NonEmptyString = string & { readonly _tag: "NonEmpty" };
		 * const isNonEmpty: Refinement<string, NonEmptyString> =
		 *   Refinement.from.Predicate(s => s.length > 0);
		 *
		 * const isValidUsername: Predicate<string> = pipe(
		 *   Predicate.from.Refinement(isNonEmpty),
		 *   Predicate.and(s => s.length <= 20)
		 * );
		 *
		 * isValidUsername("alice");  // true
		 * isValidUsername("");       // false
		 * ```
		 */
		Refinement: fromRefinement,
	},

	/**
	 * Performs declarative conditional branching over `[predicate, handler]` pairs,
	 * returning the handler result of the first matching predicate or evaluating the fallback.
	 *
	 * @example
	 * ```ts
	 * const classifyNumber = Predicate.match(
	 *   [
	 *     [(n: number) => n < 0, () => "negative"],
	 *     [(n: number) => n === 0, () => "zero"],
	 *   ],
	 *   () => "positive",
	 * );
	 * classifyNumber(-5); // "negative"
	 * ```
	 */
	match:
		<A, B, C = B>(branches: ReadonlyArray<readonly [Predicate<A>, (value: A) => B]>, fallback: (value: A) => C) =>
		(value: A): B | C => {
			for (let i = 0; i < branches.length; i++) {
				const [predicate, handler] = branches[i];
				if (predicate(value)) {
					return handler(value);
				}
			}
			return fallback(value);
		},
};
