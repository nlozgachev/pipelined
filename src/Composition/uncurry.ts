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
 * Option.map(n => n * 2)(Option.some(5)); // Some(10)
 *
 * // Uncurried - all arguments at once
 * const mapUncurried = uncurry(Option.map);
 * mapUncurried(n => n * 2, Option.some(5)); // Some(10)
 *
 * // Combined with flip for data-first uncurried
 * const mapDataFirst = uncurry(flip(Option.map));
 * mapDataFirst(Option.some(5), n => n * 2); // Some(10)
 * ```
 *
 * @see {@link flip} for reversing curried argument order
 * @see {@link uncurry3} for 3-argument curried functions
 * @see {@link uncurry4} for 4-argument curried functions
 */
export function uncurry<C>(f: () => () => C): () => C;
export function uncurry<A, C>(f: (a: A) => () => C): (a: A) => C;
export function uncurry<A, B, C>(f: (a: A) => (b: B) => C): (a: A, b: B) => C;
// deno-lint-ignore no-explicit-any
export function uncurry(f: (...args: any[]) => (...args: any[]) => any) {
	// f.length determines the outer arity; inner.length determines the inner arity.
	// The typed overloads guarantee these are 0, 1, or 2 total args.
	// deno-lint-ignore no-explicit-any
	return (...args: any[]) => {
		const inner = f(...args.slice(0, f.length));
		return inner.length === 0 ? inner() : inner(...args.slice(f.length));
	};
}

/**
 * Converts a curried 3-argument function into a multi-argument function.
 *
 * @example
 * ```ts
 * const curriedAdd3 = (a: number) => (b: number) => (c: number) => a + b + c;
 * const add3 = uncurry3(curriedAdd3);
 * add3(1, 2, 3); // 6
 * ```
 */
export const uncurry3 = <A, B, C, D>(f: (a: A) => (b: B) => (c: C) => D) => (a: A, b: B, c: C): D => f(a)(b)(c);

/**
 * Converts a curried 4-argument function into a multi-argument function.
 *
 * @example
 * ```ts
 * const curriedAdd4 = (a: number) => (b: number) => (c: number) => (d: number) => a + b + c + d;
 * const add4 = uncurry4(curriedAdd4);
 * add4(1, 2, 3, 4); // 10
 * ```
 */
export const uncurry4 = <A, B, C, D, E>(f: (a: A) => (b: B) => (c: C) => (d: D) => E) => (a: A, b: B, c: C, d: D): E =>
	f(a)(b)(c)(d);
