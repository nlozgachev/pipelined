/**
 * Applies an input to several transformer functions independently, then passes all results to a
 * combining function.
 *
 * @example
 * ```ts
 * const toNameRecord = converge(
 *   (trimmed: string, initials: string) => ({ trimmed, initials }),
 *   [
 *     (name: string) => name.trim(),
 *     (name: string) => name.split(" ").map((w) => w[0]).join(""),
 *   ],
 * );
 *
 * toNameRecord("  Alice Bob  "); // { trimmed: "Alice Bob", initials: "AB" }
 * ```
 */
export function converge<A, B, C, R>(
	f: (b: B, c: C) => R,
	transformers: [(a: A) => B, (a: A) => C],
): (a: A) => R;
export function converge<A, B, C, D, R>(
	f: (b: B, c: C, d: D) => R,
	transformers: [(a: A) => B, (a: A) => C, (a: A) => D],
): (a: A) => R;
export function converge<A, B, C, D, E, R>(
	f: (b: B, c: C, d: D, e: E) => R,
	transformers: [(a: A) => B, (a: A) => C, (a: A) => D, (a: A) => E],
): (a: A) => R;
export function converge<A>(
	f: (...args: unknown[]) => unknown,
	transformers: ReadonlyArray<(a: A) => unknown>,
): (a: A) => unknown {
	return (a: A) => f(...transformers.map((t) => t(a)));
}
