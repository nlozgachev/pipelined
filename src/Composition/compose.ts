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
 * Fully typed for up to 10 steps. Beyond that TypeScript raises a compile error —
 * use a cast or split the pipeline into named intermediate functions.
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
export function compose<A, B, C, D, E, F, G, H, I, J, K>(
	jk: (j: J) => K,
	ij: (i: I) => J,
	hi: (h: H) => I,
	gh: (g: G) => H,
	fg: (f: F) => G,
	ef: (e: E) => F,
	de: (d: D) => E,
	cd: (c: C) => D,
	bc: (b: B) => C,
	ab: (a: A) => B,
): (a: A) => K;

/* oxlint-disable prefer-rest-params, func-names */
export function compose(
	f0: (a: unknown) => unknown,
	f1?: (a: unknown) => unknown,
	f2?: (a: unknown) => unknown,
	f3?: (a: unknown) => unknown,
	f4?: (a: unknown) => unknown,
	f5?: (a: unknown) => unknown,
	f6?: (a: unknown) => unknown,
	f7?: (a: unknown) => unknown,
	f8?: (a: unknown) => unknown,
	f9?: (a: unknown) => unknown,
): unknown {
	const len = arguments.length;
	switch (len) {
		case 1:
			return f0;
		case 2:
			return function(this: unknown) {
				return f0(f1!.apply(this, arguments as any));
			};
		case 3:
			return function(this: unknown) {
				return f0(f1!(f2!.apply(this, arguments as any)));
			};
		case 4:
			return function(this: unknown) {
				return f0(f1!(f2!(f3!.apply(this, arguments as any))));
			};
		case 5:
			return function(this: unknown) {
				return f0(f1!(f2!(f3!(f4!.apply(this, arguments as any)))));
			};
		case 6:
			return function(this: unknown) {
				return f0(f1!(f2!(f3!(f4!(f5!.apply(this, arguments as any))))));
			};
		case 7:
			return function(this: unknown) {
				return f0(f1!(f2!(f3!(f4!(f5!(f6!.apply(this, arguments as any)))))));
			};
		case 8:
			return function(this: unknown) {
				return f0(f1!(f2!(f3!(f4!(f5!(f6!(f7!.apply(this, arguments as any))))))));
			};
		case 9:
			return function(this: unknown) {
				return f0(f1!(f2!(f3!(f4!(f5!(f6!(f7!(f8!.apply(this, arguments as any)))))))));
			};
		case 10:
			return function(this: unknown) {
				return f0(f1!(f2!(f3!(f4!(f5!(f6!(f7!(f8!(f9!.apply(this, arguments as any))))))))));
			};
	}
}
/* oxlint-enable prefer-rest-params, func-names */
