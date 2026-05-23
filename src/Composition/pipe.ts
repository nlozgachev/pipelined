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
 * const doubledPlusOne = pipe(
 *   5,
 *   n => n * 2,
 *   n => n + 1
 * ); // 11
 *
 * // With library functions
 * const greeting = pipe(
 *   Maybe.some("Alice"),
 *   Maybe.map(name => name.toUpperCase()),
 *   Maybe.map(name => `Hello, ${name}!`),
 *   Maybe.getOrElse(() => "Hello!")
 * ); // "Hello, ALICE!"
 *
 * // Error handling with Result
 * const parsed = pipe(
 *   Result.tryCatch(() => JSON.parse('{"value": 42}'), () => "Invalid JSON"),
 *   Result.map((data: { value: number }) => data.value),
 *   Result.getOrElse(() => null)
 * ); // 42
 * ```
 *
 * @see {@link flow} for creating reusable pipelines without an initial value
 */
export function pipe<A>(a: A): A;
export function pipe<A, B>(a: A, ab: (a: A) => B): B;
export function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B, C, D>(a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D): D;
export function pipe<A, B, C, D, E>(a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D, de: (d: D) => E): E;
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
	switch (arguments.length) {
		case 1: {
			return a;
		}
		case 2: {
			return ab!(a);
		}
		case 3: {
			return bc!(ab!(a));
		}
		case 4: {
			return cd!(bc!(ab!(a)));
		}
		case 5: {
			return de!(cd!(bc!(ab!(a))));
		}
		case 6: {
			return ef!(de!(cd!(bc!(ab!(a)))));
		}
		case 7: {
			return fg!(ef!(de!(cd!(bc!(ab!(a))))));
		}
		case 8: {
			return gh!(fg!(ef!(de!(cd!(bc!(ab!(a)))))));
		}
		case 9: {
			return hi!(gh!(fg!(ef!(de!(cd!(bc!(ab!(a))))))));
		}
		case 10: {
			return ij!(hi!(gh!(fg!(ef!(de!(cd!(bc!(ab!(a)))))))));
		}
		case 11: {
			return jk!(ij!(hi!(gh!(fg!(ef!(de!(cd!(bc!(ab!(a))))))))));
		}
	}
}

const when = <A>(predicate: (a: A) => boolean, onTrue: (a: A) => A) => (a: A): A => predicate(a) ? onTrue(a) : a;

const unless = <A>(predicate: (a: A) => boolean, onFalse: (a: A) => A) => (a: A): A => predicate(a) ? a : onFalse(a);

const either = <A, B>(predicate: (a: A) => boolean, onTrue: (a: A) => B, onFalse: (a: A) => B) => (a: A): B =>
	predicate(a) ? onTrue(a) : onFalse(a);

const struct = <A, R extends Record<string, unknown>>(fields: { [K in keyof R]: (a: A) => R[K]; }) => (a: A): R => {
	const result = {} as any;
	for (const key of Object.keys(fields)) {
		result[key] = fields[key](a);
	}
	return result;
};

function safe<A>(a: A): A;
function safe<A, B>(a: A, ab: (a: NonNullable<A>) => B): B | Extract<A, null | undefined>;
function safe<A, B, C>(
	a: A,
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
): C | Extract<A | B, null | undefined>;
function safe<A, B, C, D>(
	a: A,
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
): D | Extract<A | B | C, null | undefined>;
function safe<A, B, C, D, E>(
	a: A,
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
): E | Extract<A | B | C | D, null | undefined>;
function safe<A, B, C, D, E, F>(
	a: A,
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
	ef: (e: NonNullable<E>) => F,
): F | Extract<A | B | C | D | E, null | undefined>;
function safe<A, B, C, D, E, F, G>(
	a: A,
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
	ef: (e: NonNullable<E>) => F,
	fg: (f: NonNullable<F>) => G,
): G | Extract<A | B | C | D | E | F, null | undefined>;
function safe<A, B, C, D, E, F, G, H>(
	a: A,
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
	ef: (e: NonNullable<E>) => F,
	fg: (f: NonNullable<F>) => G,
	gh: (g: NonNullable<G>) => H,
): H | Extract<A | B | C | D | E | F | G, null | undefined>;
function safe<A, B, C, D, E, F, G, H, I>(
	a: A,
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
	ef: (e: NonNullable<E>) => F,
	fg: (f: NonNullable<F>) => G,
	gh: (g: NonNullable<G>) => H,
	hi: (h: NonNullable<H>) => I,
): I | Extract<A | B | C | D | E | F | G | H, null | undefined>;
function safe<A, B, C, D, E, F, G, H, I, J>(
	a: A,
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
	ef: (e: NonNullable<E>) => F,
	fg: (f: NonNullable<F>) => G,
	gh: (g: NonNullable<G>) => H,
	hi: (h: NonNullable<H>) => I,
	ij: (i: NonNullable<I>) => J,
): J | Extract<A | B | C | D | E | F | G | H | I, null | undefined>;
function safe<A, B, C, D, E, F, G, H, I, J, K>(
	a: A,
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
	ef: (e: NonNullable<E>) => F,
	fg: (f: NonNullable<F>) => G,
	gh: (g: NonNullable<G>) => H,
	hi: (h: NonNullable<H>) => I,
	ij: (i: NonNullable<I>) => J,
	jk: (j: J) => K,
): K | Extract<A | B | C | D | E | F | G | H | I | J, null | undefined>;
function safe(a: unknown, ...fns: ReadonlyArray<(x: unknown) => unknown>): unknown {
	let result = a;
	if (result === null || result === undefined) {
		return result;
	}
	for (const fn of fns) {
		result = fn(result);
		if (result === null || result === undefined) {
			return result;
		}
	}
	return result;
}

function async<A>(a: A | Promise<A>): Promise<A>;
function async<A, B>(a: A | Promise<A>, ab: (a: A) => B | Promise<B>): Promise<B>;
function async<A, B, C>(a: A | Promise<A>, ab: (a: A) => B | Promise<B>, bc: (b: B) => C | Promise<C>): Promise<C>;
function async<A, B, C, D>(
	a: A | Promise<A>,
	ab: (a: A) => B | Promise<B>,
	bc: (b: B) => C | Promise<C>,
	cd: (c: C) => D | Promise<D>,
): Promise<D>;
function async<A, B, C, D, E>(
	a: A | Promise<A>,
	ab: (a: A) => B | Promise<B>,
	bc: (b: B) => C | Promise<C>,
	cd: (c: C) => D | Promise<D>,
	de: (d: D) => E | Promise<E>,
): Promise<E>;
function async<A, B, C, D, E, F>(
	a: A | Promise<A>,
	ab: (a: A) => B | Promise<B>,
	bc: (b: B) => C | Promise<C>,
	cd: (c: C) => D | Promise<D>,
	de: (d: D) => E | Promise<E>,
	ef: (e: E) => F | Promise<F>,
): Promise<F>;
function async<A, B, C, D, E, F, G>(
	a: A | Promise<A>,
	ab: (a: A) => B | Promise<B>,
	bc: (b: B) => C | Promise<C>,
	cd: (c: C) => D | Promise<D>,
	de: (d: D) => E | Promise<E>,
	ef: (e: E) => F | Promise<F>,
	fg: (f: F) => G | Promise<G>,
): Promise<G>;
function async<A, B, C, D, E, F, G, H>(
	a: A | Promise<A>,
	ab: (a: A) => B | Promise<B>,
	bc: (b: B) => C | Promise<C>,
	cd: (c: C) => D | Promise<D>,
	de: (d: D) => E | Promise<E>,
	ef: (e: E) => F | Promise<F>,
	fg: (f: F) => G | Promise<G>,
	gh: (g: G) => H | Promise<H>,
): Promise<H>;
function async<A, B, C, D, E, F, G, H, I>(
	a: A | Promise<A>,
	ab: (a: A) => B | Promise<B>,
	bc: (b: B) => C | Promise<C>,
	cd: (c: C) => D | Promise<D>,
	de: (d: D) => E | Promise<E>,
	ef: (e: E) => F | Promise<F>,
	fg: (f: F) => G | Promise<G>,
	gh: (g: G) => H | Promise<H>,
	hi: (h: H) => I | Promise<I>,
): Promise<I>;
function async<A, B, C, D, E, F, G, H, I, J>(
	a: A | Promise<A>,
	ab: (a: A) => B | Promise<B>,
	bc: (b: B) => C | Promise<C>,
	cd: (c: C) => D | Promise<D>,
	de: (d: D) => E | Promise<E>,
	ef: (e: E) => F | Promise<F>,
	fg: (f: F) => G | Promise<G>,
	gh: (g: G) => H | Promise<H>,
	hi: (h: H) => I | Promise<I>,
	ij: (i: I) => J,
): Promise<J>;
function async<A, B, C, D, E, F, G, H, I, J, K>(
	a: A | Promise<A>,
	ab: (a: A) => B | Promise<B>,
	bc: (b: B) => C | Promise<C>,
	cd: (c: C) => D | Promise<D>,
	de: (d: D) => E | Promise<E>,
	ef: (e: E) => F | Promise<F>,
	fg: (f: F) => G | Promise<G>,
	gh: (g: G) => H | Promise<H>,
	hi: (h: H) => I | Promise<I>,
	ij: (i: I) => J | Promise<J>,
	jk: (j: J) => K | Promise<K>,
): Promise<K>;
async function async(a: unknown, ...fns: ReadonlyArray<(x: unknown) => unknown | Promise<unknown>>): Promise<unknown> {
	let result = await a;
	for (const fn of fns) {
		result = await fn(result);
	}
	return result;
}

export interface pipe {
	/**
	 * Executes a function on the piped value if a predicate is met, otherwise returns the value unchanged.
	 */
	readonly when: <A>(predicate: (a: A) => boolean, onTrue: (a: A) => A) => (a: A) => A;

	/**
	 * Executes a function on the piped value if a predicate is NOT met, otherwise returns the value unchanged.
	 */
	readonly unless: <A>(predicate: (a: A) => boolean, onFalse: (a: A) => A) => (a: A) => A;

	/**
	 * Executes one of two functions based on a predicate, acting as a functional if-else/ternary helper.
	 */
	readonly either: <A, B>(predicate: (a: A) => boolean, onTrue: (a: A) => B, onFalse: (a: A) => B) => (a: A) => B;

	/**
	 * Creates a pipeline step that wraps a throwing function in a try/catch, returning a fallback value if an error occurs.
	 */
	readonly try: <A, B, C>(f: (a: A) => B, onError: (error: unknown, value: A) => C) => (a: A) => B | C;

	/**
	 * Builds an object by applying a record of field-level transformer functions to the piped input.
	 */
	readonly struct: <A, R extends Record<string, unknown>>(fields: { [K in keyof R]: (a: A) => R[K]; }) => (a: A) => R;

	/**
	 * Pipes a value through a sequence of operations, short-circuiting and propagating
	 * null or undefined immediately if any intermediate step evaluates to nil.
	 */
	readonly safe: typeof safe;

	/**
	 * Pipes a value through a sequence of operations, supporting asynchronous transitions at any step.
	 */
	readonly async: typeof async;
}

pipe.when = when;
pipe.unless = unless;
pipe.either = either;
pipe.struct = struct;
pipe.safe = safe;
pipe.async = async;
pipe.try = <A, B, C>(f: (a: A) => B, onError: (error: unknown, value: A) => C) => (a: A): B | C => {
	try {
		return f(a);
	} catch (error) {
		return onError(error, a);
	}
};
