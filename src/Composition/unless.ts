/**
 * Executes a function on the piped value if a predicate is NOT met, otherwise returns the value unchanged.
 *
 * @example
 * ```ts
 * pipe(
 *   5,
 *   unless(n => n % 2 === 0, n => n * 2)
 * ); // 10
 *
 * pipe(
 *   4,
 *   unless(n => n % 2 === 0, n => n * 2)
 * ); // 4
 * ```
 *
 * @see {@link when} for executing when a predicate is met
 * @see {@link either} for branching based on a predicate
 */
export const unless = <A>(predicate: (value: A) => boolean, onFalse: (value: A) => A) => (value: A): A =>
	predicate(value) ? value : onFalse(value);
