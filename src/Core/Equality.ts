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
export type Equality<A> = (first: A, second: A) => boolean;

const stringEq: Equality<string> = (first, second) => first === second;
const numberEq: Equality<number> = (first, second) => first === second;
const booleanEq: Equality<boolean> = (first, second) => first === second;
const dateEq: Equality<Date> = (first, second) => first.getTime() === second.getTime();

export const Equality = {
	/**
	 * Equality for strings. Case-sensitive.
	 *
	 * @see {@link Equality.by} to adapt equality checks to object properties.
	 *
	 * @example
	 * ```ts
	 * Equality.string("hello", "hello"); // true
	 * Equality.string("hello", "Hello"); // false
	 * ```
	 */
	string: stringEq,

	/**
	 * Equality for numbers. Uses strict equality.
	 *
	 * @see {@link Equality.date} for chronological timestamp equality.
	 *
	 * @example
	 * ```ts
	 * Equality.number(42, 42); // true
	 * ```
	 */
	number: numberEq,

	/**
	 * Equality for booleans.
	 *
	 * @see {@link Equality.string} for primitive string equality.
	 *
	 * @example
	 * ```ts
	 * Equality.boolean(true, true); // true
	 * ```
	 */
	boolean: booleanEq,

	/**
	 * Equality for `Date` values. Compares by numeric time value.
	 *
	 * @see {@link Equality.number} for numeric value equality.
	 *
	 * @example
	 * ```ts
	 * Equality.date(new Date("2024-01-01"), new Date("2024-01-01")); // true
	 * ```
	 */
	date: dateEq,

	/**
	 * Lifts an element equality into an array equality. Two arrays are equal if they have the
	 * same length and every element pair is equal under `itemEquality`.
	 *
	 * @see {@link Equality.tuple} for fixed-length positional array equality.
	 *
	 * @example
	 * ```ts
	 * Equality.array(Equality.number)([1, 2, 3], [1, 2, 3]); // true
	 * ```
	 */
	array: <A>(itemEquality: Equality<A>): Equality<readonly A[]> => (first, second) => {
		if (first.length !== second.length) {
			return false;
		}
		for (let i = 0; i < first.length; i++) {
			if (!itemEquality(first[i], second[i])) {
				return false;
			}
		}
		return true;
	},

	/**
	 * Adapts an equality for type `A` into an equality for type `B` by extracting a field.
	 * Read as "equality by this field": `pipe(Equality.string, Equality.by(u => u.name))`.
	 *
	 * @see {@link Equality.and} to combine multiple equality checks.
	 * @see {@link Equality.struct} to check equality across multiple record fields.
	 *
	 * @example
	 * ```ts
	 * type Product = { id: string; price: number };
	 * const byId = pipe(Equality.string, Equality.by((p: Product) => p.id));
	 * byId({ id: "p1", price: 9 }, { id: "p1", price: 12 }); // true
	 * ```
	 */
	by: <A, B>(extract: (value: B) => A) => (equality: Equality<A>): Equality<B> => (first, second) =>
		equality(extract(first), extract(second)),

	/**
	 * Combines two equalities with logical AND. Both must pass for two values to be considered equal.
	 * Data-last: the first equality is the data being piped.
	 *
	 * @see {@link Equality.by} to project equality checks onto specific fields.
	 * @see {@link Equality.struct} for record-wide structural equality.
	 *
	 * @example
	 * ```ts
	 * const exact = pipe(byName, Equality.and(byRole));
	 * exact(userA, userB); // true only if name AND role match
	 * ```
	 */
	and: <A>(other: Equality<A>) => (equality: Equality<A>): Equality<A> => (first, second) =>
		equality(first, second) && other(first, second),

	/**
	 * Derives deep equality for a record from field-level `Equality` checkers.
	 *
	 * @see {@link Equality.tuple} for positional tuple equality.
	 * @see {@link Equality.by} to compare single record fields.
	 *
	 * @example
	 * ```ts
	 * const userEq = Equality.struct({
	 *   id: Equality.string,
	 *   age: Equality.number,
	 * });
	 * ```
	 */
	struct: <R extends Record<string, unknown>>(fields: { [K in keyof R]: Equality<R[K]>; }): Equality<R> => {
		const keys = Object.keys(fields) as (keyof R)[];
		const len = keys.length;
		return (first, second) => {
			for (let i = 0; i < len; i++) {
				const key = keys[i];
				if (!fields[key](first[key], second[key])) {
					return false;
				}
			}
			return true;
		};
	},

	/**
	 * Derives element-wise equality for a tuple from positional `Equality` checkers.
	 *
	 * @see {@link Equality.struct} for record structural equality.
	 * @see {@link Equality.array} for variable-length collection equality.
	 *
	 * @example
	 * ```ts
	 * const pairEq = Equality.tuple(Equality.string, Equality.number);
	 * pairEq(["a", 1], ["a", 1]); // true
	 * ```
	 */
	tuple:
		<T extends readonly unknown[]>(...equalities: { [K in keyof T]: Equality<T[K]>; }): Equality<T> => (
			first,
			second,
		) => {
			if (first.length !== second.length) {
				return false;
			}
			for (let i = 0; i < equalities.length; i++) {
				if (!equalities[i](first[i], second[i])) {
					return false;
				}
			}
			return true;
		},
};
