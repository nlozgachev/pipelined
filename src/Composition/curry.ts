/**
 * Converts a multi-argument function into a curried function.
 * The inverse of `uncurry`.
 *
 * @example
 * ```ts
 * const add = (a: number, b: number) => a + b;
 * const curriedAdd = curry(add);
 * curriedAdd(1)(2); // 3
 *
 * // Partial application
 * const addTen = curriedAdd(10);
 * addTen(5); // 15
 * ```
 *
 * @see {@link uncurry} for the inverse operation
 * @see {@link curry3} for 3-argument functions
 * @see {@link curry4} for 4-argument functions
 */
export const curry = <A, B, C>(f: (a: A, b: B) => C) => (a: A) => (b: B): C => f(a, b);

/**
 * Converts a 3-argument function into a curried function.
 *
 * @example
 * ```ts
 * const add3 = (a: number, b: number, c: number) => a + b + c;
 * const curriedAdd3 = curry3(add3);
 * curriedAdd3(1)(2)(3); // 6
 * ```
 */
export const curry3 = <A, B, C, D>(f: (a: A, b: B, c: C) => D) => (a: A) => (b: B) => (c: C): D => f(a, b, c);

/**
 * Converts a 4-argument function into a curried function.
 *
 * @example
 * ```ts
 * const add4 = (a: number, b: number, c: number, d: number) => a + b + c + d;
 * const curriedAdd4 = curry4(add4);
 * curriedAdd4(1)(2)(3)(4); // 10
 * ```
 */
export const curry4 = <A, B, C, D, E>(f: (a: A, b: B, c: C, d: D) => E) => (a: A) => (b: B) => (c: C) => (d: D): E =>
	f(a, b, c, d);
