import { Maybe } from "#core";

/**
 * Number utilities for common operations. All transformation functions are data-last
 * and curried so they compose naturally with `pipe` and `Arr.map`.
 *
 * @example
 * ```ts
 * import { Num } from "@nlozgachev/pipelined/utils";
 * import { pipe } from "@nlozgachev/pipelined/composition";
 *
 * pipe(
 *   Num.range(1, 6),
 *   Arr.map(Num.multiply(2)),
 *   Arr.filter(Num.between(4, 8))
 * ); // [4, 6, 8]
 * ```
 */
export namespace Num {
	/**
	 * Generates an array of numbers from `from` to `to` (both inclusive),
	 * stepping by `step` (default `1`). If `step` is negative or zero, or `from > to`,
	 * returns an empty array. When `step` does not land exactly on `to`, the last value
	 * is the largest reachable value that does not exceed `to`.
	 *
	 * @example
	 * ```ts
	 * Num.range(0, 5);       // [0, 1, 2, 3, 4, 5]
	 * Num.range(0, 10, 2);   // [0, 2, 4, 6, 8, 10]
	 * Num.range(0, 9, 2);    // [0, 2, 4, 6, 8]
	 * Num.range(5, 0);       // []
	 * Num.range(3, 3);       // [3]
	 * ```
	 */
	export const range = (from: number, to: number, step = 1): readonly number[] => {
		if (step <= 0 || from > to) { return []; }
		const count = Math.floor((to - from) / step) + 1;
		const result = new Array<number>(count);
		for (let i = 0; i < count; i++) {
			result[i] = from + i * step;
		}
		return result;
	};

	/**
	 * Clamps a number between `min` and `max` (both inclusive).
	 *
	 * @example
	 * ```ts
	 * pipe(150, Num.clamp(0, 100)); // 100
	 * pipe(-5, Num.clamp(0, 100));  // 0
	 * pipe(42, Num.clamp(0, 100));  // 42
	 * ```
	 */
	export const clamp = (min: number, max: number) => (n: number): number => Math.min(Math.max(n, min), max);

	/**
	 * Returns `true` when the number is between `min` and `max` (both inclusive).
	 *
	 * @example
	 * ```ts
	 * pipe(5, Num.between(1, 10));  // true
	 * pipe(0, Num.between(1, 10));  // false
	 * pipe(10, Num.between(1, 10)); // true
	 * ```
	 */
	export const between = (min: number, max: number) => (n: number): boolean => n >= min && n <= max;

	/**
	 * Parses a string as a number. Returns `None` when the result is `NaN`.
	 *
	 * @example
	 * ```ts
	 * Num.parse("42");   // Some(42)
	 * Num.parse("3.14"); // Some(3.14)
	 * Num.parse("abc");  // None
	 * Num.parse("");     // None
	 * ```
	 */
	export const parse = (s: string): Maybe<number> => {
		if (s.trim() === "") { return Maybe.none(); }
		const n = Number(s);
		return isNaN(n) ? Maybe.none() : Maybe.some(n);
	};

	/**
	 * Adds `b` to a number. Data-last: use in `pipe` or `Arr.map`.
	 *
	 * @example
	 * ```ts
	 * pipe(5, Num.add(3));                   // 8
	 * pipe([1, 2, 3], Arr.map(Num.add(10))); // [11, 12, 13]
	 * ```
	 */
	export const add = (b: number) => (a: number): number => a + b;

	/**
	 * Subtracts `b` from a number. Data-last: `subtract(b)(a)` = `a - b`.
	 *
	 * @example
	 * ```ts
	 * pipe(10, Num.subtract(3));                  // 7
	 * pipe([5, 10, 15], Arr.map(Num.subtract(2))); // [3, 8, 13]
	 * ```
	 */
	export const subtract = (b: number) => (a: number): number => a - b;

	/**
	 * Multiplies a number by `b`. Data-last: use in `pipe` or `Arr.map`.
	 *
	 * @example
	 * ```ts
	 * pipe(6, Num.multiply(7));                    // 42
	 * pipe([1, 2, 3], Arr.map(Num.multiply(100))); // [100, 200, 300]
	 * ```
	 */
	export const multiply = (b: number) => (a: number): number => a * b;

	/**
	 * Divides a number by `b`. Returns `None` when `b` is zero. Data-last: `divide(b)(a)` = `a / b`.
	 *
	 * @example
	 * ```ts
	 * pipe(20, Num.divide(4));                           // Some(5)
	 * pipe(5, Num.divide(0));                            // None
	 * pipe([10, 20, 30], Arr.filterMap(Num.divide(10))); // [1, 2, 3]
	 * ```
	 */
	export const divide = (b: number) => (a: number): Maybe<number> => b === 0 ? Maybe.none() : Maybe.some(a / b);

	/**
	 * Returns the absolute value of a number.
	 *
	 * @example
	 * ```ts
	 * pipe(-5, Num.abs); // 5
	 * pipe(5, Num.abs);  // 5
	 * ```
	 */
	export const abs = (n: number): number => Math.abs(n);

	/**
	 * Negates a number (arithmetic negation).
	 *
	 * @example
	 * ```ts
	 * pipe(5, Num.negate);  // -5
	 * pipe(-5, Num.negate); // 5
	 * ```
	 */
	export const negate = (n: number): number => -n;

	/**
	 * Rounds a number to the nearest integer.
	 *
	 * @example
	 * ```ts
	 * pipe(3.5, Num.round); // 4
	 * pipe(3.4, Num.round); // 3
	 * ```
	 */
	export const round = (n: number): number => Math.round(n);

	/**
	 * Rounds a number down to the nearest integer.
	 *
	 * @example
	 * ```ts
	 * pipe(3.9, Num.floor); // 3
	 * pipe(-3.2, Num.floor); // -4
	 * ```
	 */
	export const floor = (n: number): number => Math.floor(n);

	/**
	 * Rounds a number up to the nearest integer.
	 *
	 * @example
	 * ```ts
	 * pipe(3.1, Num.ceil); // 4
	 * pipe(-3.9, Num.ceil); // -3
	 * ```
	 */
	export const ceil = (n: number): number => Math.ceil(n);

	/**
	 * Returns the remainder of dividing a number by `divisor`. Returns `None` when `divisor` is zero.
	 * Data-last: `remainder(divisor)(a)` = `a % divisor`.
	 *
	 * @example
	 * ```ts
	 * pipe(10, Num.remainder(3));                           // Some(1)
	 * pipe(5, Num.remainder(0));                            // None
	 * pipe([10, 11, 12], Arr.filterMap(Num.remainder(3))); // [1, 2, 0]
	 * ```
	 */
	export const remainder = (divisor: number) => (n: number): Maybe<number> =>
		divisor === 0 ? Maybe.none() : Maybe.some(n % divisor);

	/**
	 * Computes the sum of a list of numbers. Returns `0` if the list is empty.
	 *
	 * @example
	 * ```ts
	 * Num.sum([1, 2, 3]); // 6
	 * Num.sum([]);        // 0
	 * ```
	 */
	export const sum = (ns: readonly number[]): number => {
		let result = 0;
		for (let i = 0; i < ns.length; i++) { result += ns[i]; }
		return result;
	};

	/**
	 * Computes the mean of a list of numbers. Returns `None` if the list is empty.
	 *
	 * @example
	 * ```ts
	 * Num.mean([1, 2, 3]); // Some(2)
	 * Num.mean([]);        // None
	 * ```
	 */
	export const mean = (ns: readonly number[]): Maybe<number> =>
		ns.length === 0 ? Maybe.none() : Maybe.some(sum(ns) / ns.length);

	/**
	 * Computes the minimum of a list of numbers. Returns `None` if the list is empty.
	 *
	 * @example
	 * ```ts
	 * Num.min([5, 1, 3]); // Some(1)
	 * Num.min([]);        // None
	 * ```
	 */
	export const min = (ns: readonly number[]): Maybe<number> => {
		if (ns.length === 0) { return Maybe.none(); }
		let [result] = ns;
		for (let i = 1; i < ns.length; i++) {
			if (ns[i] < result) { result = ns[i]; }
		}
		return Maybe.some(result);
	};

	/**
	 * Computes the maximum of a list of numbers. Returns `None` if the list is empty.
	 *
	 * @example
	 * ```ts
	 * Num.max([1, 5, 3]); // Some(5)
	 * Num.max([]);        // None
	 * ```
	 */
	export const max = (ns: readonly number[]): Maybe<number> => {
		if (ns.length === 0) { return Maybe.none(); }
		let [result] = ns;
		for (let i = 1; i < ns.length; i++) {
			if (ns[i] > result) { result = ns[i]; }
		}
		return Maybe.some(result);
	};
}
