/**
 * Converts a multi-argument function into a curried function.
 * Supports 2, 3, or 4 argument functions.
 * The inverse of `uncurry`.
 *
 * @example
 * ```ts
 * const add = (a: number, b: number) => a + b;
 * const curriedAdd = curry(add);
 * curriedAdd(1)(2); // 3
 *
 * // 3-argument function
 * const add3 = (a: number, b: number, c: number) => a + b + c;
 * const curriedAdd3 = curry(add3);
 * curriedAdd3(1)(2)(3); // 6
 *
 * // Partial application
 * const addTen = curriedAdd(10);
 * addTen(5); // 15
 * ```
 *
 * @see {@link uncurry} for the inverse operation
 */
export function curry<A, B, C>(f: (a: A, b: B) => C): (a: A) => (b: B) => C;
export function curry<A, B, C, D>(f: (a: A, b: B, c: C) => D): (a: A) => (b: B) => (c: C) => D;
export function curry<A, B, C, D, E>(f: (a: A, b: B, c: C, d: D) => E): (a: A) => (b: B) => (c: C) => (d: D) => E;
export function curry(f: (...args: any[]) => any) {
	return (a: any) => (b: any) => {
		if (f.length <= 2) {
			return f(a, b);
		}
		return (c: any) => {
			if (f.length === 3) {
				return f(a, b, c);
			}
			return (d: any) => f(a, b, c, d);
		};
	};
}
