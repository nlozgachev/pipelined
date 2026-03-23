/**
 * Pipes a value through a series of functions from left to right.
 * Each function receives the output of the previous function.
 *
 * `pipe` is the primary way to compose operations in this library.
 * It makes code read top-to-bottom, left-to-right, which is more
 * intuitive for developers coming from imperative backgrounds.
 *
 * Fully typed for up to 10 steps. Beyond that TypeScript raises a compile error — split into named
 * intermediate functions or use a cast.
 *
 * @example
 * ```ts
 * // Basic usage
 * const result = pipe(
 *   5,
 *   n => n * 2,
 *   n => n + 1
 * ); // 11
 *
 * // With library functions
 * const greeting = pipe(
 *   Option.some("Alice"),
 *   Option.map(name => name.toUpperCase()),
 *   Option.map(name => `Hello, ${name}!`),
 *   Option.getOrElse("Hello!")
 * ); // "Hello, ALICE!"
 *
 * // Error handling with Result
 * const result = pipe(
 *   Result.tryCatch(() => JSON.parse(input), e => "Invalid JSON"),
 *   Result.map(data => data.value),
 *   Result.getOrElse(null)
 * );
 * ```
 *
 * @see {@link flow} for creating reusable pipelines without an initial value
 */
export function pipe<A>(a: A): A;
export function pipe<A, B>(a: A, ab: (a: A) => B): B;
export function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B, C, D>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
): D;
export function pipe<A, B, C, D, E>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
): F;
export function pipe<A, B, C, D, E, F, G>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
): G;
export function pipe<A, B, C, D, E, F, G, H>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
	gh: (g: G) => H,
): H;
export function pipe<A, B, C, D, E, F, G, H, I>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
	gh: (g: G) => H,
	hi: (h: H) => I,
): I;
export function pipe<A, B, C, D, E, F, G, H, I, J>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
	gh: (g: G) => H,
	hi: (h: H) => I,
	ij: (i: I) => J,
): J;
export function pipe<A, B, C, D, E, F, G, H, I, J, K>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
	gh: (g: G) => H,
	hi: (h: H) => I,
	ij: (i: I) => J,
	jk: (j: J) => K,
): K;

export function pipe(
	a: unknown,
	ab?: (a: unknown) => unknown,
	bc?: (a: unknown) => unknown,
	cd?: (a: unknown) => unknown,
	de?: (a: unknown) => unknown,
	ef?: (a: unknown) => unknown,
	fg?: (a: unknown) => unknown,
	gh?: (a: unknown) => unknown,
	hi?: (a: unknown) => unknown,
	ij?: (a: unknown) => unknown,
	jk?: (a: unknown) => unknown,
): unknown {
	const len = arguments.length;
	// oxlint-disable-next-line prefer-rest-params
	switch (len) {
		case 1:
			return a;
		case 2:
			return ab!(a);
		case 3:
			return bc!(ab!(a));
		case 4:
			return cd!(bc!(ab!(a)));
		case 5:
			return de!(cd!(bc!(ab!(a))));
		case 6:
			return ef!(de!(cd!(bc!(ab!(a)))));
		case 7:
			return fg!(ef!(de!(cd!(bc!(ab!(a))))));
		case 8:
			return gh!(fg!(ef!(de!(cd!(bc!(ab!(a)))))));
		case 9:
			return hi!(gh!(fg!(ef!(de!(cd!(bc!(ab!(a))))))));
		case 10:
			return ij!(hi!(gh!(fg!(ef!(de!(cd!(bc!(ab!(a)))))))));
		case 11:
			return jk!(ij!(hi!(gh!(fg!(ef!(de!(cd!(bc!(ab!(a))))))))));
	}
}
