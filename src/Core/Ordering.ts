/**
 * A function that orders two values of type `A`. Returns a negative number when `a` comes before
 * `b`, a positive number when `a` comes after `b`, and `0` when they are equal.
 *
 * Compatible with `Array.prototype.sort` and `Arr.sortWith`.
 *
 * @example
 * ```ts
 * type Employee = { name: string; salary: number };
 *
 * const byName   = pipe(Ordering.string, Ordering.by((e: Employee) => e.name));
 * const bySalary = pipe(Ordering.number, Ordering.by((e: Employee) => e.salary));
 *
 * pipe(employees, Arr.sortWith(pipe(byName, Ordering.thenBy(bySalary))));
 * ```
 */
export type Ordering<A> = (a: A, b: A) => number;

export namespace Ordering {
	/**
	 * Alphabetical ordering for strings.
	 *
	 * @example
	 * ```ts
	 * Ordering.string("apple", "banana"); // negative
	 * ```
	 */
	export const string: Ordering<string> = (a, b) => (a < b ? -1 : (a > b ? 1 : 0));

	/**
	 * Numeric ordering. Equivalent to `(a, b) => a - b`.
	 *
	 * @example
	 * ```ts
	 * pipe([3, 1, 2], Arr.sortWith(Ordering.number)); // [1, 2, 3]
	 * ```
	 */
	export const number: Ordering<number> = (a, b) => a - b;

	/**
	 * Ordering for `Date` values by numeric time value.
	 *
	 * @example
	 * ```ts
	 * pipe(dates, Arr.sortWith(Ordering.date)); // earliest first
	 * ```
	 */
	export const date: Ordering<Date> = (a, b) => a.getTime() - b.getTime();

	/**
	 * Flips the direction of an ordering.
	 *
	 * @example
	 * ```ts
	 * pipe([3, 1, 2], Arr.sortWith(Ordering.reverse(Ordering.number))); // [3, 2, 1]
	 * ```
	 */
	export const reverse = <A>(ord: Ordering<A>): Ordering<A> => (a, b) => ord(b, a);

	/**
	 * Chains two orderings: the second is used only when the first returns `0`.
	 * Data-last: the first ordering is the data being piped.
	 *
	 * @example
	 * ```ts
	 * const byDeptThenSalary = pipe(byDept, Ordering.thenBy(bySalary));
	 * ```
	 */
	export const thenBy = <A>(ord2: Ordering<A>) => (ord1: Ordering<A>): Ordering<A> => (a, b) => {
		const r = ord1(a, b);
		return r !== 0 ? r : ord2(a, b);
	};

	/**
	 * Adapts an ordering for type `A` into an ordering for type `B` by extracting a field.
	 * Read as "ordering by this field": `pipe(Ordering.number, Ordering.by(p => p.price))`.
	 *
	 * @example
	 * ```ts
	 * type Product = { name: string; price: number };
	 * const byPrice = pipe(Ordering.number, Ordering.by((p: Product) => p.price));
	 * pipe(products, Arr.sortWith(byPrice));
	 * ```
	 */
	export const by = <A, B>(f: (b: B) => A) => (ord: Ordering<A>): Ordering<B> => (a, b) => ord(f(a), f(b));
}
