/**
 * Pair<A, B> represents a pair of two values that are always both present.
 * It is a typed alias for `readonly [A, B]`.
 *
 * Use Pair when two values always travel together through a pipeline and you
 * want to transform either or both sides without destructuring.
 *
 * @example
 * ```ts
 * import { Pair } from "@nlozgachev/pipelined/core";
 * import { pipe } from "@nlozgachev/pipelined/composition";
 *
 * const entry = Pair.from.pair("alice", 42);
 *
 * pipe(
 *   entry,
 *   Pair.mapFirst((name) => name.toUpperCase()),
 *   Pair.mapSecond((score) => score * 2),
 *   Pair.fold((name, score) => `${name}: ${score}`),
 * ); // "ALICE: 84"
 * ```
 */
export type Pair<A, B> = readonly [A, B];

const makePair = <A, B>(first: A, second: B): Pair<A, B> => [first, second];
const makeArray = <A, B>(arr: readonly [A, B]): Pair<A, B> => arr;

export const Pair = {
	// --- from ---
	from: {
		/**
		 * Creates a Pair from two values.
		 *
		 * @example
		 * ```ts
		 * Pair.from.pair("Paris", 2_161_000); // ["Paris", 2161000]
		 * ```
		 */
		pair: makePair,

		/**
		 * Creates a Pair from a two-element array.
		 *
		 * @example
		 * ```ts
		 * Pair.from.array(["Paris", 2_161_000] as const); // ["Paris", 2161000]
		 * ```
		 */
		array: makeArray,
	},

	/**
	 * Returns the first value from the pair.
	 *
	 * @example
	 * ```ts
	 * Pair.first(Pair.from.pair("Paris", 2_161_000)); // "Paris"
	 * ```
	 */
	first: <A, B>(p: Pair<A, B>): A => p[0],

	/**
	 * Returns the second value from the pair.
	 *
	 * @example
	 * ```ts
	 * Pair.second(Pair.from.pair("Paris", 2_161_000)); // 2161000
	 * ```
	 */
	second: <A, B>(p: Pair<A, B>): B => p[1],

	/**
	 * Transforms the first value, leaving the second unchanged.
	 *
	 * @example
	 * ```ts
	 * pipe(Pair.from.pair("alice", 42), Pair.mapFirst((s) => s.toUpperCase())); // ["ALICE", 42]
	 * ```
	 */
	mapFirst: <A, C>(f: (a: A) => C) => <B>(p: Pair<A, B>): Pair<C, B> => [f(p[0]), p[1]],

	/**
	 * Transforms the second value, leaving the first unchanged.
	 *
	 * @example
	 * ```ts
	 * pipe(Pair.from.pair("alice", 42), Pair.mapSecond((n) => n * 2)); // ["alice", 84]
	 * ```
	 */
	mapSecond: <B, D>(f: (b: B) => D) => <A>(p: Pair<A, B>): Pair<A, D> => [p[0], f(p[1])],

	/**
	 * Transforms both values independently in a single step.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Pair.from.pair("alice", 42),
	 *   Pair.mapBoth(
	 *     (name) => name.toUpperCase(),
	 *     (score) => score * 2,
	 *   ),
	 * ); // ["ALICE", 84]
	 * ```
	 */
	mapBoth:
		<A, C, B, D>(onFirst: (a: A) => C, onSecond: (b: B) => D) => (p: Pair<A, B>): Pair<C, D> => [
			onFirst(p[0]),
			onSecond(p[1]),
		],

	/**
	 * Applies a binary function to both values, collapsing the pair into a single value.
	 * Useful as the final step when consuming a pair in a pipeline.
	 *
	 * @example
	 * ```ts
	 * pipe(Pair.from.pair("Alice", 100), Pair.fold((name, score) => `${name}: ${score}`));
	 * // "Alice: 100"
	 * ```
	 */
	fold: <A, B, C>(f: (a: A, b: B) => C) => (p: Pair<A, B>): C => f(p[0], p[1]),

	/**
	 * Swaps the two values: `[A, B]` becomes `[B, A]`.
	 *
	 * @example
	 * ```ts
	 * Pair.swap(Pair.from.pair("key", 1)); // [1, "key"]
	 * ```
	 */
	swap: <A, B>(p: Pair<A, B>): Pair<B, A> => [p[1], p[0]],

	// --- to ---
	to: {
		/**
		 * Converts the pair to a heterogeneous readonly array `readonly (A | B)[]`.
		 *
		 * @example
		 * ```ts
		 * Pair.to.Array(Pair.from.pair("hello", 42)); // ["hello", 42]
		 * ```
		 */
		Array: <A, B>(p: Pair<A, B>): readonly (A | B)[] => [...p],
	},

	/**
	 * Runs a side effect with both values without changing the pair.
	 * Useful for logging or debugging in the middle of a pipeline.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Pair.from.pair("Paris", 2_161_000),
	 *   Pair.tap((city, pop) => console.log(`${city}: ${pop}`)),
	 *   Pair.mapSecond((n) => n / 1_000_000),
	 * ); // logs "Paris: 2161000", returns ["Paris", 2.161]
	 * ```
	 */
	tap: <A, B>(f: (a: A, b: B) => void) => (p: Pair<A, B>): Pair<A, B> => {
		f(p[0], p[1]);
		return p;
	},
};
