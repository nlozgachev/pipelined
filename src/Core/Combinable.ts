import { Maybe } from "./Maybe.ts";

/**
 * A type that can combine two values of type `A` into one, with a neutral starting value.
 * `empty` is the identity: `combine(empty)(a) === a` and `combine(a)(empty) === a`.
 * `combine(next)(accumulated)` appends `next` onto `accumulated`.
 *
 * @example
 * ```ts
 * pipe(["hello", ", ", "world"], Combinable.combineAll(Combinable.string)); // "hello, world"
 * pipe([1, 2, 3, 4, 5], Combinable.combineAll(Combinable.sum));            // 15
 * ```
 */
export type Combinable<A> = { readonly empty: A; readonly combine: (next: A) => (accumulated: A) => A; };

const stringCombinable: Combinable<string> = { empty: "", combine: (next) => (accumulated) => accumulated + next };
const sumCombinable: Combinable<number> = { empty: 0, combine: (next) => (accumulated) => accumulated + next };
const productCombinable: Combinable<number> = { empty: 1, combine: (next) => (accumulated) => accumulated * next };
const allCombinable: Combinable<boolean> = { empty: true, combine: (next) => (accumulated) => accumulated && next };
const anyCombinable: Combinable<boolean> = { empty: false, combine: (next) => (accumulated) => accumulated || next };

export const Combinable = {
	/**
	 * Combines strings by concatenation. Empty string is the neutral element.
	 *
	 * @see {@link Combinable.combineAll} to concatenate arrays of strings.
	 *
	 * @example
	 * ```ts
	 * pipe(["a", "b", "c"], Combinable.combineAll(Combinable.string)); // "abc"
	 * ```
	 */
	string: stringCombinable,

	/**
	 * Combines numbers by addition. `0` is the neutral element.
	 *
	 * @see {@link Combinable.product} for multiplicative numeric accumulation.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2, 3], Combinable.combineAll(Combinable.sum)); // 6
	 * ```
	 */
	sum: sumCombinable,

	/**
	 * Combines numbers by multiplication. `1` is the neutral element.
	 *
	 * @see {@link Combinable.sum} for additive numeric accumulation.
	 *
	 * @example
	 * ```ts
	 * pipe([2, 3, 4], Combinable.combineAll(Combinable.product)); // 24
	 * ```
	 */
	product: productCombinable,

	/**
	 * Combines booleans with logical AND. `true` is the neutral element.
	 *
	 * @see {@link Combinable.any} for logical OR disjunction.
	 *
	 * @example
	 * ```ts
	 * pipe([true, true, false], Combinable.combineAll(Combinable.all)); // false
	 * ```
	 */
	all: allCombinable,

	/**
	 * Combines booleans with logical OR. `false` is the neutral element.
	 *
	 * @see {@link Combinable.all} for logical AND conjunction.
	 *
	 * @example
	 * ```ts
	 * pipe([false, false, true], Combinable.combineAll(Combinable.any)); // true
	 * ```
	 */
	any: anyCombinable,

	/**
	 * Combines arrays by concatenation. Empty array is the neutral element.
	 *
	 * @see {@link Combinable.combineAll} to flatten and concatenate nested collections.
	 *
	 * @example
	 * ```ts
	 * pipe([[1, 2], [3], [4, 5]], Combinable.combineAll(Combinable.array<number>())); // [1, 2, 3, 4, 5]
	 * ```
	 */
	array: <A>(): Combinable<readonly A[]> => ({
		empty: [],
		combine: (next) => (accumulated) => [...accumulated, ...next],
	}),

	/**
	 * Lifts a `Combinable<A>` to `Combinable<Maybe<A>>`. `None` is the neutral element —
	 * combining with `None` on either side returns the other value unchanged.
	 * Two `Some` values combine their inner values using the inner `Combinable`.
	 *
	 * @see {@link Combinable.combineAll} to reduce collections of optional values.
	 *
	 * @example
	 * ```ts
	 * const c = Combinable.maybe(Combinable.sum);
	 * c.combine(Maybe.make.some(3))(Maybe.make.some(2)); // Some(5)
	 * c.combine(Maybe.make.none())(Maybe.make.some(5));  // Some(5)
	 * ```
	 */
	maybe: <A>(inner: Combinable<A>): Combinable<Maybe<A>> => ({
		empty: Maybe.make.none(),
		combine: (next) => (accumulated): Maybe<A> =>
			Maybe.is.none(accumulated)
				? next
				: (Maybe.is.none(next) ? accumulated : Maybe.make.some(inner.combine(next.value)(accumulated.value))),
	}),

	/**
	 * Combines an array of elements into a single value using the `Combinable`'s `empty` as the starting point.
	 *
	 * @see {@link Combinable.struct} to combine structured records.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2, 3, 4, 5], Combinable.combineAll(Combinable.sum)); // 15
	 * pipe([], Combinable.combineAll(Combinable.sum));               // 0
	 * ```
	 */
	combineAll: <A>(combinable: Combinable<A>) => (items: readonly A[]): A => {
		let accumulated = combinable.empty;
		for (let i = 0; i < items.length; i++) {
			accumulated = combinable.combine(items[i])(accumulated);
		}
		return accumulated;
	},

	/**
	 * Derives a `Combinable` for a record of fields from field-level `Combinable` instances.
	 *
	 * @see {@link Combinable.combineAll} to fold arrays of structured records.
	 *
	 * @example
	 * ```ts
	 * const StatsCombinable = Combinable.struct({
	 *   count: Combinable.sum,
	 *   tags: Combinable.array<string>(),
	 * });
	 * ```
	 */
	struct: <R extends Record<string, unknown>>(fields: { [K in keyof R]: Combinable<R[K]>; }): Combinable<R> => {
		const keys = Object.keys(fields) as (keyof R)[];
		const len = keys.length;
		const empty = {} as R;
		for (let i = 0; i < len; i++) {
			const key = keys[i];
			empty[key] = fields[key].empty;
		}
		return {
			empty,
			combine: (next) => (accumulated) => {
				const result = {} as R;
				for (let i = 0; i < len; i++) {
					const key = keys[i];
					result[key] = fields[key].combine(next[key])(accumulated[key]);
				}
				return result;
			},
		};
	},
};
