/**
 * A synchronous memoized computation. The factory function runs exactly once —
 * on the first call to `Lazy.evaluate` — and the result is cached for all subsequent calls.
 *
 * @example
 * ```ts
 * const config = Lazy.from(() => parseConfig(rawInput));
 *
 * pipe(
 *   config,
 *   Lazy.map(cfg => cfg.port),
 *   Lazy.evaluate,
 * ); // parseConfig ran once; cfg.port returned
 * ```
 */
export type Lazy<A> = { readonly get: () => A; };

export namespace Lazy {
	/**
	 * Wraps a thunk in a `Lazy`. The thunk runs exactly once, on first `evaluate`.
	 *
	 * @example
	 * ```ts
	 * const expensive = Lazy.from(() => computeExpensiveValue(input));
	 * ```
	 */
	export const from = <A>(f: () => A): Lazy<A> => {
		let done = false;
		let cache: A;
		return {
			get: () => {
				if (!done) {
					cache = f();
					done = true;
				}
				return cache;
			},
		};
	};

	/**
	 * Forces evaluation and returns the cached result. Safe to call multiple times.
	 *
	 * @example
	 * ```ts
	 * const value = Lazy.evaluate(Lazy.from(() => 42)); // 42
	 * ```
	 */
	export const evaluate = <A>(lazy: Lazy<A>): A => lazy.get();

	/**
	 * Transforms the result of a `Lazy` without triggering evaluation.
	 *
	 * @example
	 * ```ts
	 * pipe(Lazy.from(() => loadConfig()), Lazy.map(cfg => cfg.port));
	 * ```
	 */
	export const map = <A, B>(f: (a: A) => B) => (lazy: Lazy<A>): Lazy<B> => Lazy.from(() => f(lazy.get()));

	/**
	 * Chains a `Lazy`-returning transformation without triggering evaluation.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Lazy.from(() => loadConfig()),
	 *   Lazy.chain(cfg => Lazy.from(() => openConnection(cfg.dbUrl))),
	 * );
	 * ```
	 */
	export const chain = <A, B>(f: (a: A) => Lazy<B>) => (lazy: Lazy<A>): Lazy<B> => Lazy.from(() => f(lazy.get()).get());

	/**
	 * Runs a side effect on the value without changing it. Fires once, on first `evaluate`.
	 *
	 * @example
	 * ```ts
	 * pipe(Lazy.from(() => compute()), Lazy.tap(v => console.log("computed:", v)));
	 * ```
	 */
	export const tap = <A>(f: (a: A) => void) => (lazy: Lazy<A>): Lazy<A> =>
		Lazy.from(() => {
			const v = lazy.get();
			f(v);
			return v;
		});
}
