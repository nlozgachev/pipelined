/**
 * Converts a curried function into a multi-argument function.
 * Useful when you want to call a curried function with all arguments at once.
 *
 * Handles functions with 0, 1, or 2 curried arguments.
 *
 * @example
 * ```ts
 * // Thunks: () => () => C becomes () => C
 * const nested = () => () => 42;
 * uncurry(nested)(); // 42
 *
 * // Original curried function
 * Maybe.map((n: number) => n * 2)(Maybe.make.some(5)); // Some(10)
 *
 * // Uncurried - all arguments at once
 * const mapUncurried = uncurry(Maybe.map);
 * mapUncurried((n: number) => n * 2, Maybe.make.some(5)); // Some(10)
 *
 * // Combined with flip for data-first uncurried
 * const mapDataFirst = uncurry(flip(Maybe.map));
 * mapDataFirst(Maybe.make.some(5), (n: number) => n * 2); // Some(10)
 * ```
 *
 * @see {@link flip} for reversing curried argument order
 */
export function uncurry<C>(f: () => () => C): () => C;
export function uncurry<A, C>(f: (a: A) => () => C): (a: A) => C;
export function uncurry<A, B, C, D, E>(f: (a: A) => (b: B) => (c: C) => (d: D) => E): (a: A, b: B, c: C, d: D) => E;
export function uncurry<A, B, C, D>(f: (a: A) => (b: B) => (c: C) => D): (a: A, b: B, c: C) => D;
export function uncurry<A, B, C>(f: (a: A) => (b: B) => C): (a: A, b: B) => C;
export function uncurry(f: (...args: any[]) => any) {
	return (...args: any[]) => {
		if (args.length === 0) {
			return f()();
		}
		let result = f;
		for (let i = 0; i < args.length; i++) {
			result = result(args[i]);
		}
		return typeof result === "function" && result.length === 0 ? result() : result;
	};
}
