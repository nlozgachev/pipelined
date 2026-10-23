/**
 * Executes a function on the piped value if a predicate is met, otherwise returns the value unchanged.
 *
 * @example
 * ```ts
 * pipe(
 *   4,
 *   when(n => n % 2 === 0, n => n * 2)
 * ); // 8
 *
 * pipe(
 *   3,
 *   when(n => n % 2 === 0, n => n * 2)
 * ); // 3
 * ```
 *
 * @see {@link unless} for executing when a predicate is not met
 */
export const when =
	<A, B = A>(predicate: (value: A) => boolean, onTrue: (value: A) => B) => (
		value: A,
	): A | B => (predicate(value) ? onTrue(value) : value);
