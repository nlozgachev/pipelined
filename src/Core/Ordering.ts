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

const stringOrd: Ordering<string> = (a, b) => (a < b ? -1 : (a > b ? 1 : 0));
const numberOrd: Ordering<number> = (a, b) => a - b;
const dateOrd: Ordering<Date> = (a, b) => a.getTime() - b.getTime();

export const Ordering = {
	/**
	 * Alphabetical ordering for strings.
	 *
	 * @example
	 * ```ts
	 * Ordering.string("apple", "banana"); // negative
	 * ```
	 */
	string: stringOrd,

	/**
	 * Numeric ordering. Equivalent to `(a, b) => a - b`.
	 *
	 * @example
	 * ```ts
	 * pipe([3, 1, 2], Arr.sortWith(Ordering.number)); // [1, 2, 3]
	 * ```
	 */
	number: numberOrd,

	/**
	 * Ordering for `Date` values by numeric time value.
	 *
	 * @example
	 * ```ts
	 * pipe(dates, Arr.sortWith(Ordering.date)); // earliest first
	 * ```
	 */
	date: dateOrd,

	/**
	 * Flips the direction of an ordering.
	 *
	 * @example
	 * ```ts
	 * pipe([3, 1, 2], Arr.sortWith(Ordering.reverse(Ordering.number))); // [3, 2, 1]
	 * ```
	 */
	reverse: <A>(ord: Ordering<A>): Ordering<A> => (a, b) => ord(b, a),

	/**
	 * Chains two orderings: the second is used only when the first returns `0`.
	 * Data-last: the first ordering is the data being piped.
	 *
	 * @example
	 * ```ts
	 * const byDeptThenSalary = pipe(byDept, Ordering.thenBy(bySalary));
	 * ```
	 */
	thenBy: <A>(ord2: Ordering<A>) => (ord1: Ordering<A>): Ordering<A> => (a, b) => {
		const r = ord1(a, b);
		return r !== 0 ? r : ord2(a, b);
	},

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
	by: <A, B>(f: (b: B) => A) => (ord: Ordering<A>): Ordering<B> => (a, b) => ord(f(a), f(b)),

	/**
	 * Combines a list of orderings into a single composite comparator.
	 * Evaluates each ordering in sequence until a non-zero comparison result is found.
	 *
	 * @example
	 * ```ts
	 * const byName = pipe(Ordering.string, Ordering.by((u: User) => u.name));
	 * const byAge  = pipe(Ordering.number, Ordering.by((u: User) => u.age));
	 * const sortUsers = Ordering.byFields([byName, byAge]);
	 * ```
	 */
	byFields: <A>(orderings: ReadonlyArray<Ordering<A>>): Ordering<A> => (a, b) => {
		for (let i = 0; i < orderings.length; i++) {
			const res = orderings[i](a, b);
			if (res !== 0) {
				return res;
			}
		}
		return 0;
	},

	/**
	 * Derives a lexicographical tuple ordering from positional `Ordering` comparators.
	 *
	 * @example
	 * ```ts
	 * const pairOrd = Ordering.tuple(Ordering.string, Ordering.number);
	 * pairOrd(["a", 1], ["a", 2]); // negative
	 * ```
	 */
	tuple: <T extends readonly unknown[]>(...orderings: { [K in keyof T]: Ordering<T[K]>; }): Ordering<T> => (a, b) => {
		const len = Math.min(a.length, b.length);
		for (let i = 0; i < len; i++) {
			const res = orderings[i](a[i], b[i]);
			if (res !== 0) {
				return res;
			}
		}
		return a.length - b.length;
	},
};
