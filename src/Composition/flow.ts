import type { Awaitable } from "#internal";

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
 * const user: User = { name: "Alice" };
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
export function flow<A extends ReadonlyArray<unknown>, B>(ab: (...a: A) => B): (...a: A) => B;
export function flow<A extends ReadonlyArray<unknown>, B, C>(ab: (...a: A) => B, bc: (b: B) => C): (...a: A) => C;
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
export function flow<A extends ReadonlyArray<unknown>, B, C, D, E, F, G, H, I, J>(
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
export function flow<A extends ReadonlyArray<unknown>, B, C, D, E, F, G, H, I, J, K>(
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
		case 0: {
			return function(...args: unknown[]) {
				return args[0];
			};
		}
		case 1: {
			return ab;
		}
		case 2: {
			return function(this: unknown) {
				return bc!(ab.apply(this, arguments as any));
			};
		}
		case 3: {
			return function(this: unknown) {
				return cd!(bc!(ab.apply(this, arguments as any)));
			};
		}
		case 4: {
			return function(this: unknown) {
				return de!(cd!(bc!(ab.apply(this, arguments as any))));
			};
		}
		case 5: {
			return function(this: unknown) {
				return ef!(de!(cd!(bc!(ab.apply(this, arguments as any)))));
			};
		}
		case 6: {
			return function(this: unknown) {
				return fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments as any))))));
			};
		}
		case 7: {
			return function(this: unknown) {
				return gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments as any)))))));
			};
		}
		case 8: {
			return function(this: unknown) {
				return hi!(gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments as any))))))));
			};
		}
		case 9: {
			return function(this: unknown) {
				return ij!(hi!(gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments as any)))))))));
			};
		}
		case 10: {
			return function(this: unknown) {
				return jk!(ij!(hi!(gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments as any))))))))));
			};
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

function safe<A, B>(ab: (a: NonNullable<A>) => B): (a: A) => B | Extract<A, null | undefined>;
function safe<A, B, C>(
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
): (a: A) => C | Extract<A | B, null | undefined>;
function safe<A, B, C, D>(
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
): (a: A) => D | Extract<A | B | C, null | undefined>;
function safe<A, B, C, D, E>(
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
): (a: A) => E | Extract<A | B | C | D, null | undefined>;
function safe<A, B, C, D, E, F>(
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
	ef: (e: NonNullable<E>) => F,
): (a: A) => F | Extract<A | B | C | D | E, null | undefined>;
function safe<A, B, C, D, E, F, G>(
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
	ef: (e: NonNullable<E>) => F,
	fg: (f: NonNullable<F>) => G,
): (a: A) => G | Extract<A | B | C | D | E | F, null | undefined>;
function safe<A, B, C, D, E, F, G, H>(
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
	ef: (e: NonNullable<E>) => F,
	fg: (f: NonNullable<F>) => G,
	gh: (g: NonNullable<G>) => H,
): (a: A) => H | Extract<A | B | C | D | E | F | G, null | undefined>;
function safe<A, B, C, D, E, F, G, H, I>(
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
	ef: (e: NonNullable<E>) => F,
	fg: (f: NonNullable<F>) => G,
	gh: (g: NonNullable<G>) => H,
	hi: (h: NonNullable<H>) => I,
): (a: A) => I | Extract<A | B | C | D | E | F | G | H, null | undefined>;
function safe<A, B, C, D, E, F, G, H, I, J>(
	ab: (a: NonNullable<A>) => B,
	bc: (b: NonNullable<B>) => C,
	cd: (c: NonNullable<C>) => D,
	de: (d: NonNullable<D>) => E,
	ef: (e: NonNullable<E>) => F,
	fg: (f: NonNullable<F>) => G,
	gh: (g: NonNullable<G>) => H,
	hi: (h: NonNullable<H>) => I,
	ij: (i: NonNullable<I>) => J,
): (a: A) => J | Extract<A | B | C | D | E | F | G | H | I, null | undefined>;
function safe<A, B, C, D, E, F, G, H, I, J, K>(
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
): (a: A) => K | Extract<A | B | C | D | E | F | G | H | I | J, null | undefined>;
function safe(...fns: ReadonlyArray<(x: unknown) => unknown>): (a: unknown) => unknown {
	return (a: unknown) => {
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
	};
}

function async<A, B>(ab: (a: A) => Awaitable<B>): (a: Awaitable<A>) => Promise<B>;
function async<A, B, C>(ab: (a: A) => Awaitable<B>, bc: (b: B) => Awaitable<C>): (a: Awaitable<A>) => Promise<C>;
function async<A, B, C, D>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
): (a: Awaitable<A>) => Promise<D>;
function async<A, B, C, D, E>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
): (a: Awaitable<A>) => Promise<E>;
function async<A, B, C, D, E, F>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
): (a: Awaitable<A>) => Promise<F>;
function async<A, B, C, D, E, F, G>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
	fg: (f: F) => Awaitable<G>,
): (a: Awaitable<A>) => Promise<G>;
function async<A, B, C, D, E, F, G, H>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
	fg: (f: F) => Awaitable<G>,
	gh: (g: G) => Awaitable<H>,
): (a: Awaitable<A>) => Promise<H>;
function async<A, B, C, D, E, F, G, H, I>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
	fg: (f: F) => Awaitable<G>,
	gh: (g: G) => Awaitable<H>,
	hi: (h: H) => Awaitable<I>,
): (a: Awaitable<A>) => Promise<I>;
function async<A, B, C, D, E, F, G, H, I, J>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
	fg: (f: F) => Awaitable<G>,
	gh: (g: G) => Awaitable<H>,
	hi: (h: H) => Awaitable<I>,
	ij: (i: I) => J,
): (a: Awaitable<A>) => Promise<J>;
function async<A, B, C, D, E, F, G, H, I, J, K>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
	fg: (f: F) => Awaitable<G>,
	gh: (g: G) => Awaitable<H>,
	hi: (h: H) => Awaitable<I>,
	ij: (i: I) => Awaitable<J>,
	jk: (j: J) => Awaitable<K>,
): (a: Awaitable<A>) => Promise<K>;
/* eslint-disable no-await-in-loop */
function async(...fns: ReadonlyArray<(x: unknown) => Awaitable<unknown>>): (a: unknown) => Promise<unknown> {
	return async (a: unknown) => {
		let result = await a;
		for (const fn of fns) {
			result = await fn(result);
		}
		return result;
	};
}

export interface flow {
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

flow.when = when;
flow.unless = unless;
flow.either = either;
flow.struct = struct;
flow.safe = safe;
flow.async = async;
flow.try = <A, B, C>(f: (a: A) => B, onError: (error: unknown, value: A) => C) => (a: A): B | C => {
	try {
		return f(a);
	} catch (error) {
		return onError(error, a);
	}
};
