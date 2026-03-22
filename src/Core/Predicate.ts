import { Refinement } from "./Refinement.ts";

/**
 * A boolean-valued function over a type `A`.
 *
 * A `Predicate<A>` is the simpler sibling of `Refinement<A, B>`: it tests whether a
 * value satisfies a condition at runtime but carries no compile-time narrowing guarantee.
 * Use it when you need to combine, negate, or adapt boolean checks as first-class values
 * and do not require the extra type information that a `Refinement` provides.
 *
 * Every `Refinement<A, B>` is a `Predicate<A>` — convert with `Predicate.fromRefinement`
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

export namespace Predicate {
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
	export const not = <A>(p: Predicate<A>): Predicate<A> => (a) => !p(a);

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
	export const and = <A>(second: Predicate<A>) => (first: Predicate<A>): Predicate<A> => (a) => first(a) && second(a);

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
	export const or = <A>(second: Predicate<A>) => (first: Predicate<A>): Predicate<A> => (a) => first(a) || second(a);

	/**
	 * Adapts a `Predicate<A>` to work on a different input type `B` by applying `f`
	 * to extract the relevant `A` from a `B` before running the check.
	 *
	 * Data-last — the predicate is the data being piped; `f` is the extractor.
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
	export const using = <A, B>(f: (b: B) => A) => (p: Predicate<A>): Predicate<B> => (b) => p(f(b));

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
	export const all = <A>(predicates: ReadonlyArray<Predicate<A>>): Predicate<A> => (a) => predicates.every((p) => p(a));

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
	export const any = <A>(predicates: ReadonlyArray<Predicate<A>>): Predicate<A> => (a) => predicates.some((p) => p(a));

	/**
	 * Converts a `Refinement<A, B>` into a `Predicate<A>`, discarding the compile-time
	 * narrowing. Use this when you want to combine a type guard with plain predicates
	 * using `and`, `or`, or `all`.
	 *
	 * @example
	 * ```ts
	 * const isString: Refinement<unknown, string> =
	 *   Refinement.make(x => typeof x === "string");
	 *
	 * const isShortString: Predicate<unknown> = pipe(
	 *   Predicate.fromRefinement(isString),
	 *   Predicate.and(x => (x as string).length < 10)
	 * );
	 *
	 * isShortString("hi");            // true
	 * isShortString("a very long string that exceeds ten characters");  // false
	 * isShortString(42);              // false
	 * ```
	 */
	export const fromRefinement = <A, B extends A>(r: Refinement<A, B>): Predicate<A> => r;
}
