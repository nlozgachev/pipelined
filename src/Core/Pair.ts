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
 * const entry = Pair.make("alice", 42);
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
const makeArray = <A, B>(items: readonly [A, B]): Pair<A, B> => items;

export const Pair = {
	/**
	 * Creates a Pair from two values.
	 *
	 * @example
	 * ```ts
	 * Pair.make("Paris", 2_161_000); // ["Paris", 2161000]
	 * ```
	 */
	make: makePair,

	// --- from ---
	from: {
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
	 * Pair.first(Pair.make("Paris", 2_161_000)); // "Paris"
	 * ```
	 */
	first: <A, B>(pair: Pair<A, B>): A => pair[0],

	/**
	 * Returns the second value from the pair.
	 *
	 * @example
	 * ```ts
	 * Pair.second(Pair.make("Paris", 2_161_000)); // 2161000
	 * ```
	 */
	second: <A, B>(pair: Pair<A, B>): B => pair[1],

	/**
	 * Transforms the first value, leaving the second unchanged.
	 *
	 * @see {@link Pair.mapSecond} to transform the second element instead.
	 * @see {@link Pair.mapBoth} to transform both elements at once.
	 *
	 * @example
	 * ```ts
	 * pipe(Pair.make("alice", 42), Pair.mapFirst((s) => s.toUpperCase())); // ["ALICE", 42]
	 * ```
	 */
	mapFirst: <A, C>(transform: (first: A) => C) => <B>(pair: Pair<A, B>): Pair<C, B> => [transform(pair[0]), pair[1]],

	/**
	 * Transforms the second value, leaving the first unchanged.
	 *
	 * @see {@link Pair.mapFirst} to transform the first element instead.
	 * @see {@link Pair.mapBoth} to transform both elements at once.
	 *
	 * @example
	 * ```ts
	 * pipe(Pair.make("alice", 42), Pair.mapSecond((n) => n * 2)); // ["alice", 84]
	 * ```
	 */
	mapSecond: <B, D>(transform: (second: B) => D) => <A>(pair: Pair<A, B>): Pair<A, D> => [pair[0], transform(pair[1])],

	/**
	 * Transforms both values independently in a single step.
	 *
	 * @see {@link Pair.mapFirst} to transform only the first element.
	 * @see {@link Pair.mapSecond} to transform only the second element.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Pair.make("alice", 42),
	 *   Pair.mapBoth(
	 *     (name) => name.toUpperCase(),
	 *     (score) => score * 2,
	 *   ),
	 * ); // ["ALICE", 84]
	 * ```
	 */
	mapBoth:
		<A, C, B, D>(onFirst: (first: A) => C, onSecond: (second: B) => D) => (pair: Pair<A, B>): Pair<C, D> => [
			onFirst(pair[0]),
			onSecond(pair[1]),
		],

	/**
	 * Applies a binary function to both values, collapsing the pair into a single value.
	 * Useful as the final step when consuming a pair in a pipeline.
	 *
	 * @example
	 * ```ts
	 * pipe(Pair.make("Alice", 100), Pair.fold((name, score) => `${name}: ${score}`));
	 * // "Alice: 100"
	 * ```
	 */
	fold: <A, B, C>(reducer: (first: A, second: B) => C) => (pair: Pair<A, B>): C => reducer(pair[0], pair[1]),

	/**
	 * Swaps the two values: `[A, B]` becomes `[B, A]`.
	 *
	 * @example
	 * ```ts
	 * Pair.swap(Pair.make("key", 1)); // [1, "key"]
	 * ```
	 */
	swap: <A, B>(pair: Pair<A, B>): Pair<B, A> => [pair[1], pair[0]],

	// --- to ---
	to: {
		/**
		 * Converts the pair to a heterogeneous readonly array `readonly (A | B)[]`.
		 *
		 * @example
		 * ```ts
		 * Pair.to.array(Pair.make("hello", 42)); // ["hello", 42]
		 * ```
		 */
		array: <A, B>(pair: Pair<A, B>): readonly (A | B)[] => [...pair],
	},

	/**
	 * Runs a side effect with both values without changing the pair.
	 * Useful for logging or debugging in the middle of a pipeline.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Pair.make("Paris", 2_161_000),
	 *   Pair.tap((city, pop) => console.log(`${city}: ${pop}`)),
	 *   Pair.mapSecond((n) => n / 1_000_000),
	 * ); // logs "Paris: 2161000", returns ["Paris", 2.161]
	 * ```
	 */
	tap: <A, B>(sideEffect: (first: A, second: B) => void) => (pair: Pair<A, B>): Pair<A, B> => {
		sideEffect(pair[0], pair[1]);
		return pair;
	},
};
