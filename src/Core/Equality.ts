/**
 * A function that checks whether two values of type `A` are equal.
 * Use built-in instances (`Equality.string`, `Equality.number`, etc.) as starting points,
 * then adapt them with `Equality.by` and combine them with `Equality.and`.
 *
 * @example
 * ```ts
 * type User = { id: string; name: string };
 * const byId = pipe(Equality.string, Equality.by((u: User) => u.id));
 *
 * pipe(users, Arr.uniqWith(byId));
 * ```
 */
export type Equality<A> = (a: A, b: A) => boolean;

export namespace Equality {
	/**
	 * Equality for strings. Case-sensitive.
	 *
	 * @example
	 * ```ts
	 * Equality.string("hello", "hello"); // true
	 * Equality.string("hello", "Hello"); // false
	 * ```
	 */
	export const string: Equality<string> = (a, b) => a === b;

	/**
	 * Equality for numbers. Uses strict equality.
	 *
	 * @example
	 * ```ts
	 * Equality.number(42, 42); // true
	 * ```
	 */
	export const number: Equality<number> = (a, b) => a === b;

	/**
	 * Equality for booleans.
	 *
	 * @example
	 * ```ts
	 * Equality.boolean(true, true); // true
	 * ```
	 */
	export const boolean: Equality<boolean> = (a, b) => a === b;

	/**
	 * Equality for `Date` values. Compares by numeric time value.
	 *
	 * @example
	 * ```ts
	 * Equality.date(new Date("2024-01-01"), new Date("2024-01-01")); // true
	 * ```
	 */
	export const date: Equality<Date> = (a, b) => a.getTime() === b.getTime();

	/**
	 * Lifts an element equality into an array equality. Two arrays are equal if they have the
	 * same length and every element pair is equal under `eq`.
	 *
	 * @example
	 * ```ts
	 * Equality.array(Equality.number)([1, 2, 3], [1, 2, 3]); // true
	 * ```
	 */
	export const array = <A>(eq: Equality<A>): Equality<readonly A[]> => (a, b) =>
		a.length === b.length && a.every((x, i) => eq(x, b[i]));

	/**
	 * Adapts an equality for type `A` into an equality for type `B` by extracting a field.
	 * Read as "equality by this field": `pipe(Equality.string, Equality.by(u => u.name))`.
	 *
	 * @example
	 * ```ts
	 * type Product = { id: string; price: number };
	 * const byId = pipe(Equality.string, Equality.by((p: Product) => p.id));
	 * byId({ id: "p1", price: 9 }, { id: "p1", price: 12 }); // true
	 * ```
	 */
	export const by = <A, B>(f: (b: B) => A) => (eq: Equality<A>): Equality<B> => (a, b) => eq(f(a), f(b));

	/**
	 * Combines two equalities with logical AND. Both must pass for two values to be considered equal.
	 * Data-last: the first equality is the data being piped.
	 *
	 * @example
	 * ```ts
	 * const exact = pipe(byName, Equality.and(byRole));
	 * exact(userA, userB); // true only if name AND role match
	 * ```
	 */
	export const and = <A>(eq2: Equality<A>) => (eq1: Equality<A>): Equality<A> => (a, b) => eq1(a, b) && eq2(a, b);
}
