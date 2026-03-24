/**
 * Flips the order of arguments for a curried binary function.
 * Converts a data-last function to data-first.
 *
 * @example
 * ```ts
 * // Original data-last (for pipe)
 * pipe(
 *   Maybe.some(5),
 *   Maybe.map(n => n * 2)
 * ); // Some(10)
 *
 * // Flipped to data-first
 * const mapFirst = flip(Maybe.map);
 * mapFirst(Maybe.some(5))(n => n * 2); // Some(10)
 * ```
 *
 * @see {@link uncurry} for converting curried functions to multi-argument functions
 */
export const flip = <A, B, C>(f: (a: A) => (b: B) => C) => (b: B) => (a: A): C => f(a)(b);
