/**
 * Applies a projection to both arguments of a binary function before calling it.
 * Most useful for building comparators and equality checks over projected values.
 *
 * @example
 * ```ts
 * const byLength = on((a: number, b: number) => a - b, (s: string) => s.length);
 *
 * ["banana", "fig", "apple"].sort(byLength); // ["fig", "apple", "banana"]
 * ```
 */
export const on = <A, B, C>(f: (b1: B, b2: B) => C, g: (a: A) => B) => (a: A, b: A): C => f(g(a), g(b));
