import type { Awaitable } from "#internal";

/**
 * Pipes a value through a sequence of operations, supporting asynchronous transitions at any step.
 * Awaits promises at each step before passing the resolved value to the next function.
 *
 * @example
 * ```ts
 * await pipeAsync(
 *   42,
 *   n => Promise.resolve(`user-${n}`),
 *   name => name.toUpperCase()
 * ); // "USER-42"
 * ```
 *
 * @see {@link flowAsync} for creating reusable async pipelines
 * @see {@link pipe} for synchronous pipelines
 */
export function pipeAsync<A>(a: Awaitable<A>): Promise<A>;
export function pipeAsync<A, B>(a: Awaitable<A>, ab: (a: A) => Awaitable<B>): Promise<B>;
export function pipeAsync<A, B, C>(a: Awaitable<A>, ab: (a: A) => Awaitable<B>, bc: (b: B) => Awaitable<C>): Promise<C>;
export function pipeAsync<A, B, C, D>(
	a: Awaitable<A>,
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
): Promise<D>;
export function pipeAsync<A, B, C, D, E>(
	a: Awaitable<A>,
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
): Promise<E>;
export function pipeAsync<A, B, C, D, E, F>(
	a: Awaitable<A>,
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
): Promise<F>;
export function pipeAsync<A, B, C, D, E, F, G>(
	a: Awaitable<A>,
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
	fg: (f: F) => Awaitable<G>,
): Promise<G>;
export function pipeAsync<A, B, C, D, E, F, G, H>(
	a: Awaitable<A>,
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
	fg: (f: F) => Awaitable<G>,
	gh: (g: G) => Awaitable<H>,
): Promise<H>;
export function pipeAsync<A, B, C, D, E, F, G, H, I>(
	a: Awaitable<A>,
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
	fg: (f: F) => Awaitable<G>,
	gh: (g: G) => Awaitable<H>,
	hi: (h: H) => Awaitable<I>,
): Promise<I>;
export function pipeAsync<A, B, C, D, E, F, G, H, I, J>(
	a: Awaitable<A>,
	ab: (a: A) => Awaitable<B>,
	bc: (b: B) => Awaitable<C>,
	cd: (c: C) => Awaitable<D>,
	de: (d: D) => Awaitable<E>,
	ef: (e: E) => Awaitable<F>,
	fg: (f: F) => Awaitable<G>,
	gh: (g: G) => Awaitable<H>,
	hi: (h: H) => Awaitable<I>,
	ij: (i: I) => J,
): Promise<J>;
export function pipeAsync<A, B, C, D, E, F, G, H, I, J, K>(
	a: Awaitable<A>,
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
): Promise<K>;
export async function pipeAsync(
	a: unknown,
	...fns: ReadonlyArray<(x: unknown) => Awaitable<unknown>>
): Promise<unknown> {
	let result = await a;
	for (const fn of fns) {
		result = await fn(result);
	}
	return result;
}
