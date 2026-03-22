/**
 * Composes functions from right to left, returning a new function.
 * This is the traditional mathematical function composition: (f . g)(x) = f(g(x))
 *
 * Unlike `flow` which reads left-to-right, `compose` reads right-to-left,
 * matching how nested function calls would be written.
 *
 * @example
 * ```ts
 * const addOne = (n: number) => n + 1;
 * const double = (n: number) => n * 2;
 *
 * // compose: right-to-left (double first, then addOne)
 * const composed = compose(addOne, double);
 * composed(5); // 11 (5 * 2 + 1)
 *
 * // flow: left-to-right (addOne first, then double)
 * const flowed = flow(addOne, double);
 * flowed(5); // 12 ((5 + 1) * 2)
 * ```
 *
 * @see {@link flow} for left-to-right composition
 */
export function compose<A, B>(ab: (a: A) => B): (a: A) => B;
export function compose<A, B, C>(bc: (b: B) => C, ab: (a: A) => B): (a: A) => C;
export function compose<A, B, C, D>(
	cd: (c: C) => D,
	bc: (b: B) => C,
	ab: (a: A) => B,
): (a: A) => D;
export function compose<A, B, C, D, E>(
	de: (d: D) => E,
	cd: (c: C) => D,
	bc: (b: B) => C,
	ab: (a: A) => B,
): (a: A) => E;
export function compose<A, B, C, D, E, F>(
	ef: (e: E) => F,
	de: (d: D) => E,
	cd: (c: C) => D,
	bc: (b: B) => C,
	ab: (a: A) => B,
): (a: A) => F;
export function compose<A, B, C, D, E, F, G>(
	fg: (f: F) => G,
	ef: (e: E) => F,
	de: (d: D) => E,
	cd: (c: C) => D,
	bc: (b: B) => C,
	ab: (a: A) => B,
): (a: A) => G;
export function compose<A, B, C, D, E, F, G, H>(
	gh: (g: G) => H,
	fg: (f: F) => G,
	ef: (e: E) => F,
	de: (d: D) => E,
	cd: (c: C) => D,
	bc: (b: B) => C,
	ab: (a: A) => B,
): (a: A) => H;
export function compose<A, B, C, D, E, F, G, H, I>(
	hi: (h: H) => I,
	gh: (g: G) => H,
	fg: (f: F) => G,
	ef: (e: E) => F,
	de: (d: D) => E,
	cd: (c: C) => D,
	bc: (b: B) => C,
	ab: (a: A) => B,
): (a: A) => I;
export function compose<A, B, C, D, E, F, G, H, I, J>(
	ij: (i: I) => J,
	hi: (h: H) => I,
	gh: (g: G) => H,
	fg: (f: F) => G,
	ef: (e: E) => F,
	de: (d: D) => E,
	cd: (c: C) => D,
	bc: (b: B) => C,
	ab: (a: A) => B,
): (a: A) => J;

export function compose(
	...fns: ReadonlyArray<(arg: unknown) => unknown>
): (arg: unknown) => unknown {
	return (arg: unknown) => fns.reduceRight((acc, fn) => fn(acc), arg);
}
