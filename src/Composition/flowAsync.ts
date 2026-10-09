import type { Awaitable } from "#internal";

/**
 * Composes asynchronous or synchronous functions from left to right, returning a reusable async function.
 *
 * @example
 * ```ts
 * const processId = flowAsync(
 *   (id: number) => Promise.resolve(`user-${id}`),
 *   name => name.toUpperCase()
 * );
 * await processId(42); // "USER-42"
 * ```
 *
 * @see {@link pipeAsync} for immediate async value pipeline execution
 * @see {@link flow} for synchronous function composition
 */
export function flowAsync<A, B>(ab: (a: A) => Awaitable<B>): (a: Awaitable<A>) => Promise<B>;
export function flowAsync<A, B, C>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
): (a: Awaitable<A>) => Promise<C>;
export function flowAsync<A, B, C, D>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
): (a: Awaitable<A>) => Promise<D>;
export function flowAsync<A, B, C, D, E>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
): (a: Awaitable<A>) => Promise<E>;
export function flowAsync<A, B, C, D, E, F>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
): (a: Awaitable<A>) => Promise<F>;
export function flowAsync<A, B, C, D, E, F, G>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
	fg: (f: F) => Awaitable<G>,
): (a: Awaitable<A>) => Promise<G>;
export function flowAsync<A, B, C, D, E, F, G, H>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
	fg: (f: F) => Awaitable<G>,
	gh: (g: G) => Awaitable<H>,
): (a: Awaitable<A>) => Promise<H>;
export function flowAsync<A, B, C, D, E, F, G, H, I>(
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
	fg: (f: F) => Awaitable<G>,
	gh: (g: G) => Awaitable<H>,
	hi: (h: H) => Awaitable<I>,
): (a: Awaitable<A>) => Promise<I>;
export function flowAsync<A, B, C, D, E, F, G, H, I, J>(
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
export function flowAsync<A, B, C, D, E, F, G, H, I, J, K>(
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
export function flowAsync(...fns: ReadonlyArray<(x: unknown) => Awaitable<unknown>>): (a: unknown) => Promise<unknown> {
	return async (a: unknown) => {
		let result = await a;
		for (const fn of fns) {
			result = await fn(result);
		}
		return result;
	};
}
