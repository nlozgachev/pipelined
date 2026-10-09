/**
 * Executes one of two functions based on a predicate, acting as a functional if-else / ternary helper.
 *
 * @example
 * ```ts
 * pipe(
 *   5,
 *   either(n => n >= 0, n => `+${n}`, n => `${n}`)
 * ); // "+5"
 *
 * pipe(
 *   -3,
 *   either(n => n >= 0, n => `+${n}`, n => `${n}`)
 * ); // "-3"
 * ```
 *
 * @see {@link when} for conditional execution returning the same type
 * @see {@link unless} for negative conditional execution
 */
export const either =
	<A, B>(predicate: (value: A) => boolean, onTrue: (value: A) => B, onFalse: (value: A) => B) => (value: A): B =>
		predicate(value) ? onTrue(value) : onFalse(value);
