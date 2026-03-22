/**
 * Negates a predicate function.
 * Returns a new predicate that returns true when the original returns false, and vice versa.
 *
 * @example
 * ```ts
 * const isEven = (n: number) => n % 2 === 0;
 * const isOdd = not(isEven);
 *
 * isOdd(3); // true
 * isOdd(4); // false
 *
 * // With array methods
 * const numbers = [1, 2, 3, 4, 5];
 * numbers.filter(not(isEven)); // [1, 3, 5]
 *
 * // In pipelines
 * pipe(
 *   users,
 *   Array.filter(not(isAdmin)),
 *   Array.map(u => u.name)
 * );
 * ```
 */
export const not = <A extends ReadonlyArray<unknown>>(predicate: (...args: A) => boolean) => (...args: A): boolean =>
	!predicate(...args);
