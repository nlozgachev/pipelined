/**
 * Composes functions from left to right, returning a new function.
 * Unlike `pipe`, `flow` doesn't take an initial value - it creates
 * a reusable pipeline that can be called later with arguments.
 *
 * Use `flow` when you want to create a named, reusable transformation.
 * Use `pipe` when you want to immediately transform a value.
 *
 * Fully typed for up to 10 steps. Beyond that TypeScript raises a compile error — split into named
 * intermediate functions or use a cast.
 *
 * @example
 * ```ts
 * // Create a reusable transformation
 * const processUser = flow(
 *   (user: User) => user.name,
 *   name => name.toUpperCase(),
 *   name => `Hello, ${name}!`
 * );
 *
 * processUser({ name: "Alice" }); // "Hello, ALICE!"
 * processUser({ name: "Bob" }); // "Hello, BOB!"
 *
 * // Compare with pipe (one-time use):
 * pipe(
 *   user,
 *   u => u.name,
 *   name => name.toUpperCase()
 * );
 *
 * // flow creates a function, pipe applies immediately:
 * const double = flow((n: number) => n * 2);
 * double(5); // 10
 *
 * pipe(5, n => n * 2); // 10 (immediate result)
 * ```
 *
 * @see {@link pipe} for immediate value transformation
 */
export function flow<A extends ReadonlyArray<unknown>, B>(
	ab: (...a: A) => B,
): (...a: A) => B;
export function flow<A extends ReadonlyArray<unknown>, B, C>(
	ab: (...a: A) => B,
	bc: (b: B) => C,
): (...a: A) => C;
export function flow<A extends ReadonlyArray<unknown>, B, C, D>(
	ab: (...a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
): (...a: A) => D;
export function flow<A extends ReadonlyArray<unknown>, B, C, D, E>(
	ab: (...a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
): (...a: A) => E;
export function flow<A extends ReadonlyArray<unknown>, B, C, D, E, F>(
	ab: (...a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
): (...a: A) => F;
export function flow<A extends ReadonlyArray<unknown>, B, C, D, E, F, G>(
	ab: (...a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
): (...a: A) => G;
export function flow<A extends ReadonlyArray<unknown>, B, C, D, E, F, G, H>(
	ab: (...a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
	gh: (g: G) => H,
): (...a: A) => H;
export function flow<A extends ReadonlyArray<unknown>, B, C, D, E, F, G, H, I>(
	ab: (...a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
	gh: (g: G) => H,
	hi: (h: H) => I,
): (...a: A) => I;
export function flow<
	A extends ReadonlyArray<unknown>,
	B,
	C,
	D,
	E,
	F,
	G,
	H,
	I,
	J,
>(
	ab: (...a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
	gh: (g: G) => H,
	hi: (h: H) => I,
	ij: (i: I) => J,
): (...a: A) => J;
export function flow<
	A extends ReadonlyArray<unknown>,
	B,
	C,
	D,
	E,
	F,
	G,
	H,
	I,
	J,
	K,
>(
	ab: (...a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
	gh: (g: G) => H,
	hi: (h: H) => I,
	ij: (i: I) => J,
	jk: (j: J) => K,
): (...a: A) => K;

/* oxlint-disable prefer-rest-params, func-names */
export function flow(
	ab: (...args: ReadonlyArray<unknown>) => unknown,
	bc?: (b: unknown) => unknown,
	cd?: (b: unknown) => unknown,
	de?: (b: unknown) => unknown,
	ef?: (b: unknown) => unknown,
	fg?: (b: unknown) => unknown,
	gh?: (b: unknown) => unknown,
	hi?: (b: unknown) => unknown,
	ij?: (b: unknown) => unknown,
	jk?: (b: unknown) => unknown,
): unknown {
	const len = arguments.length;
	switch (len) {
		case 0:
			return function(...args: unknown[]) {
				return args[0];
			};
		case 1:
			return ab;
		case 2:
			return function(this: unknown) {
				return bc!(ab.apply(this, arguments as any));
			};
		case 3:
			return function(this: unknown) {
				return cd!(bc!(ab.apply(this, arguments as any)));
			};
		case 4:
			return function(this: unknown) {
				return de!(cd!(bc!(ab.apply(this, arguments as any))));
			};
		case 5:
			return function(this: unknown) {
				return ef!(de!(cd!(bc!(ab.apply(this, arguments as any)))));
			};
		case 6:
			return function(this: unknown) {
				return fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments as any))))));
			};
		case 7:
			return function(this: unknown) {
				return gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments as any)))))));
			};
		case 8:
			return function(this: unknown) {
				return hi!(gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments as any))))))));
			};
		case 9:
			return function(this: unknown) {
				return ij!(hi!(gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments as any)))))))));
			};
		case 10:
			return function(this: unknown) {
				return jk!(ij!(hi!(gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments as any))))))))));
			};
	}
}
/* oxlint-enable prefer-rest-params, func-names */
