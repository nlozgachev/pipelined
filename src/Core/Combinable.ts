import { Maybe } from "#core";

/**
 * A type that can combine two values of type `A` into one, with a neutral starting value.
 * `empty` is the identity: `combine(empty)(a) === a` and `combine(a)(empty) === a`.
 * `combine(b)(a)` appends `b` onto `a` — `a` is the accumulated value, `b` is the new element.
 *
 * @example
 * ```ts
 * pipe(["hello", ", ", "world"], Combinable.fold(Combinable.string)); // "hello, world"
 * pipe([1, 2, 3, 4, 5], Combinable.fold(Combinable.sum));            // 15
 * ```
 */
export type Combinable<A> = { readonly empty: A; readonly combine: (b: A) => (a: A) => A; };

export namespace Combinable {
	/**
	 * Combines strings by concatenation. Empty string is the neutral element.
	 *
	 * @example
	 * ```ts
	 * pipe(["a", "b", "c"], Combinable.fold(Combinable.string)); // "abc"
	 * ```
	 */
	export const string: Combinable<string> = { empty: "", combine: (b) => (a) => a + b };

	/**
	 * Combines numbers by addition. `0` is the neutral element.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2, 3], Combinable.fold(Combinable.sum)); // 6
	 * ```
	 */
	export const sum: Combinable<number> = { empty: 0, combine: (b) => (a) => a + b };

	/**
	 * Combines numbers by multiplication. `1` is the neutral element.
	 *
	 * @example
	 * ```ts
	 * pipe([2, 3, 4], Combinable.fold(Combinable.product)); // 24
	 * ```
	 */
	export const product: Combinable<number> = { empty: 1, combine: (b) => (a) => a * b };

	/**
	 * Combines booleans with logical AND. `true` is the neutral element.
	 *
	 * @example
	 * ```ts
	 * pipe([true, true, false], Combinable.fold(Combinable.all)); // false
	 * ```
	 */
	export const all: Combinable<boolean> = { empty: true, combine: (b) => (a) => a && b };

	/**
	 * Combines booleans with logical OR. `false` is the neutral element.
	 *
	 * @example
	 * ```ts
	 * pipe([false, false, true], Combinable.fold(Combinable.any)); // true
	 * ```
	 */
	export const any: Combinable<boolean> = { empty: false, combine: (b) => (a) => a || b };

	/**
	 * Combines arrays by concatenation. Empty array is the neutral element.
	 *
	 * @example
	 * ```ts
	 * pipe([[1, 2], [3], [4, 5]], Combinable.fold(Combinable.array<number>())); // [1, 2, 3, 4, 5]
	 * ```
	 */
	export const array = <A>(): Combinable<readonly A[]> => ({ empty: [], combine: (b) => (a) => [...a, ...b] });

	/**
	 * Lifts a `Combinable<A>` to `Combinable<Maybe<A>>`. `None` is the neutral element —
	 * combining with `None` on either side returns the other value unchanged.
	 * Two `Some` values combine their inner values using the inner `Combinable`.
	 *
	 * @example
	 * ```ts
	 * const c = Combinable.maybe(Combinable.sum);
	 * c.combine(Maybe.some(3))(Maybe.some(2)); // Some(5)
	 * c.combine(Maybe.none())(Maybe.some(5));  // Some(5)
	 * ```
	 */
	export const maybe = <A>(inner: Combinable<A>): Combinable<Maybe<A>> => ({
		empty: Maybe.none(),
		combine: (b) => (a): Maybe<A> =>
			Maybe.isNone(a) ? b : (Maybe.isNone(b) ? a : Maybe.some(inner.combine(b.value)(a.value))),
	});

	/**
	 * Folds an array into a single value using the `Combinable`'s `empty` as the starting point.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2, 3, 4, 5], Combinable.fold(Combinable.sum)); // 15
	 * pipe([], Combinable.fold(Combinable.sum));               // 0
	 * ```
	 */
	export const fold = <A>(c: Combinable<A>) => (data: readonly A[]): A =>
		data.reduce((acc, x) => c.combine(x)(acc), c.empty);
}
