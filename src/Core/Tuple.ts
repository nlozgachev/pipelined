/**
 * Tuple<A, B> represents a pair of two values that are always both present.
 * It is a typed alias for `readonly [A, B]`.
 *
 * Use Tuple when two values always travel together through a pipeline and you
 * want to transform either or both sides without destructuring.
 *
 * @example
 * ```ts
 * import { Tuple } from "@nlozgachev/pipelined/core";
 * import { pipe } from "@nlozgachev/pipelined/composition";
 *
 * const entry = Tuple.make("alice", 42);
 *
 * pipe(
 *   entry,
 *   Tuple.mapFirst((name) => name.toUpperCase()),
 *   Tuple.mapSecond((score) => score * 2),
 *   Tuple.fold((name, score) => `${name}: ${score}`),
 * ); // "ALICE: 84"
 * ```
 */
export type Tuple<A, B> = readonly [A, B];

export namespace Tuple {
	/**
	 * Creates a pair from two values.
	 *
	 * @example
	 * ```ts
	 * Tuple.make("Paris", 2_161_000); // ["Paris", 2161000]
	 * ```
	 */
	export const make = <A, B>(first: A, second: B): Tuple<A, B> => [first, second];

	/**
	 * Returns the first value from the pair.
	 *
	 * @example
	 * ```ts
	 * Tuple.first(Tuple.make("Paris", 2_161_000)); // "Paris"
	 * ```
	 */
	export const first = <A, B>(tuple: Tuple<A, B>): A => tuple[0];

	/**
	 * Returns the second value from the pair.
	 *
	 * @example
	 * ```ts
	 * Tuple.second(Tuple.make("Paris", 2_161_000)); // 2161000
	 * ```
	 */
	export const second = <A, B>(tuple: Tuple<A, B>): B => tuple[1];

	/**
	 * Transforms the first value, leaving the second unchanged.
	 *
	 * @example
	 * ```ts
	 * pipe(Tuple.make("alice", 42), Tuple.mapFirst((s) => s.toUpperCase())); // ["ALICE", 42]
	 * ```
	 */
	export const mapFirst = <A, C>(f: (a: A) => C) => <B>(tuple: Tuple<A, B>): Tuple<C, B> => [f(tuple[0]), tuple[1]];

	/**
	 * Transforms the second value, leaving the first unchanged.
	 *
	 * @example
	 * ```ts
	 * pipe(Tuple.make("alice", 42), Tuple.mapSecond((n) => n * 2)); // ["alice", 84]
	 * ```
	 */
	export const mapSecond = <B, D>(f: (b: B) => D) => <A>(tuple: Tuple<A, B>): Tuple<A, D> => [tuple[0], f(tuple[1])];

	/**
	 * Transforms both values independently in a single step.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Tuple.make("alice", 42),
	 *   Tuple.mapBoth(
	 *     (name) => name.toUpperCase(),
	 *     (score) => score * 2,
	 *   ),
	 * ); // ["ALICE", 84]
	 * ```
	 */
	export const mapBoth =
		<A, C, B, D>(onFirst: (a: A) => C, onSecond: (b: B) => D) => (tuple: Tuple<A, B>): Tuple<C, D> => [
			onFirst(tuple[0]),
			onSecond(tuple[1]),
		];

	/**
	 * Applies a binary function to both values, collapsing the pair into a single value.
	 * Useful as the final step when consuming a pair in a pipeline.
	 *
	 * @example
	 * ```ts
	 * pipe(Tuple.make("Alice", 100), Tuple.fold((name, score) => `${name}: ${score}`));
	 * // "Alice: 100"
	 * ```
	 */
	export const fold = <A, B, C>(f: (a: A, b: B) => C) => (tuple: Tuple<A, B>): C => f(tuple[0], tuple[1]);

	/**
	 * Swaps the two values: `[A, B]` becomes `[B, A]`.
	 *
	 * @example
	 * ```ts
	 * Tuple.swap(Tuple.make("key", 1)); // [1, "key"]
	 * ```
	 */
	export const swap = <A, B>(tuple: Tuple<A, B>): Tuple<B, A> => [tuple[1], tuple[0]];

	/**
	 * Converts the pair to a heterogeneous readonly array `readonly (A | B)[]`.
	 *
	 * @example
	 * ```ts
	 * Tuple.toArray(Tuple.make("hello", 42)); // ["hello", 42]
	 * ```
	 */
	export const toArray = <A, B>(tuple: Tuple<A, B>): readonly (A | B)[] => [...tuple];

	/**
	 * Runs a side effect with both values without changing the pair.
	 * Useful for logging or debugging in the middle of a pipeline.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Tuple.make("Paris", 2_161_000),
	 *   Tuple.tap((city, pop) => console.log(`${city}: ${pop}`)),
	 *   Tuple.mapSecond((n) => n / 1_000_000),
	 * ); // logs "Paris: 2161000", returns ["Paris", 2.161]
	 * ```
	 */
	export const tap = <A, B>(f: (a: A, b: B) => void) => (tuple: Tuple<A, B>): Tuple<A, B> => {
		f(tuple[0], tuple[1]);
		return tuple;
	};
}
