// =============================================================================
// Imports
// =============================================================================
import { Maybe } from "#core";

// =============================================================================
// Private Helpers
// =============================================================================
const sumFn = (ns: readonly number[]): number => {
	let result = 0;
	for (let i = 0; i < ns.length; i++) {
		result += ns[i];
	}
	return result;
};

// =============================================================================
// Public Export
// =============================================================================
export const Num = {
	is: {
		/**
		 * Returns `true` when the number is equal to zero.
		 *
		 * @example
		 * ```ts
		 * Num.is.zero(0); // true
		 * Num.is.zero(5); // false
		 * ```
		 */
		zero: (n: number): boolean => n === 0,

		/**
		 * Returns `true` when the number is a whole integer.
		 *
		 * @example
		 * ```ts
		 * Num.is.integer(5);    // true
		 * Num.is.integer(3.14); // false
		 * ```
		 */
		integer: (n: number): boolean => Number.isInteger(n),

		/**
		 * Returns `true` when the number is a finite float (fractional number).
		 *
		 * @example
		 * ```ts
		 * Num.is.float(3.14); // true
		 * Num.is.float(5);    // false
		 * ```
		 */
		float: (n: number): boolean => Number.isFinite(n) && !Number.isInteger(n),

		/**
		 * Returns `true` when the number is finite (not `Infinity`, `-Infinity`, or `NaN`).
		 *
		 * @example
		 * ```ts
		 * Num.is.finite(42);       // true
		 * Num.is.finite(Infinity); // false
		 * ```
		 */
		finite: (n: number): boolean => Number.isFinite(n),

		/**
		 * Returns `true` when the value is `NaN`.
		 *
		 * @example
		 * ```ts
		 * Num.is.nan(NaN); // true
		 * Num.is.nan(42);  // false
		 * ```
		 */
		nan: (n: number): boolean => Number.isNaN(n),

		/**
		 * Returns `true` when the number is an even integer.
		 *
		 * @example
		 * ```ts
		 * Num.is.even(4);   // true
		 * Num.is.even(3);   // false
		 * Num.is.even(2.5); // false
		 * ```
		 */
		even: (n: number): boolean => Number.isInteger(n) && n % 2 === 0,

		/**
		 * Returns `true` when the number is an odd integer.
		 *
		 * @example
		 * ```ts
		 * Num.is.odd(3);   // true
		 * Num.is.odd(4);   // false
		 * Num.is.odd(2.5); // false
		 * ```
		 */
		odd: (n: number): boolean => Number.isInteger(n) && n % 2 !== 0,

		/**
		 * Returns `true` when the number is strictly greater than zero.
		 *
		 * @example
		 * ```ts
		 * Num.is.positive(5);  // true
		 * Num.is.positive(0);  // false
		 * Num.is.positive(-5); // false
		 * ```
		 */
		positive: (n: number): boolean => n > 0,

		/**
		 * Returns `true` when the number is strictly less than zero.
		 *
		 * @example
		 * ```ts
		 * Num.is.negative(-5); // true
		 * Num.is.negative(0);  // false
		 * Num.is.negative(5);  // false
		 * ```
		 */
		negative: (n: number): boolean => n < 0,
	},

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
	range: (from: number, to: number, step = 1): readonly number[] => {
		if (step <= 0 || from > to) { return []; }
		const count = Math.floor((to - from) / step) + 1;
		const result = new Array<number>(count);
		for (let i = 0; i < count; i++) {
			result[i] = from + i * step;
		}
		return result;
	},

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
	clamp: (min: number, max: number) => (n: number): number => Math.min(Math.max(n, min), max),

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
	between: (min: number, max: number) => (n: number): boolean => n >= min && n <= max,

	/**
	 * Returns `true` when the number is in the range `[start, end)` (inclusive of `start`, exclusive of `end`).
	 *
	 * @example
	 * ```ts
	 * pipe(5, Num.inRange(1, 10));  // true
	 * pipe(1, Num.inRange(1, 10));  // true
	 * pipe(10, Num.inRange(1, 10)); // false
	 * ```
	 */
	inRange: (start: number, end: number) => (n: number): boolean => n >= start && n < end,

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
	parse: (s: string): Maybe<number> => {
		if (s.trim() === "") { return Maybe.make.none(); }
		const n = Number(s);
		return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	},

	/**
	 * Adds `b` to a number. Data-last: use in `pipe` or `Arr.map`.
	 *
	 * @example
	 * ```ts
	 * pipe(5, Num.add(3));                   // 8
	 * pipe([1, 2, 3], Arr.map(Num.add(10))); // [11, 12, 13]
	 * ```
	 */
	add: (b: number) => (a: number): number => a + b,

	/**
	 * Subtracts `b` from a number. Data-last: `subtract(b)(a)` = `a - b`.
	 *
	 * @example
	 * ```ts
	 * pipe(10, Num.subtract(3));                  // 7
	 * pipe([5, 10, 15], Arr.map(Num.subtract(2))); // [3, 8, 13]
	 * ```
	 */
	subtract: (b: number) => (a: number): number => a - b,

	/**
	 * Multiplies a number by `b`. Data-last: use in `pipe` or `Arr.map`.
	 *
	 * @example
	 * ```ts
	 * pipe(6, Num.multiply(7));                    // 42
	 * pipe([1, 2, 3], Arr.map(Num.multiply(100))); // [100, 200, 300]
	 * ```
	 */
	multiply: (b: number) => (a: number): number => a * b,

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
	divide: (b: number) => (a: number): Maybe<number> => b === 0 ? Maybe.make.none() : Maybe.make.some(a / b),

	/**
	 * Returns the absolute value of a number.
	 *
	 * @example
	 * ```ts
	 * pipe(-5, Num.abs); // 5
	 * pipe(5, Num.abs);  // 5
	 * ```
	 */
	abs: (n: number): number => Math.abs(n),

	/**
	 * Negates a number (arithmetic negation).
	 *
	 * @example
	 * ```ts
	 * pipe(5, Num.negate);  // -5
	 * pipe(-5, Num.negate); // 5
	 * ```
	 */
	negate: (n: number): number => -n,

	/**
	 * Rounds a number to the nearest integer.
	 *
	 * @example
	 * ```ts
	 * pipe(3.5, Num.round); // 4
	 * pipe(3.4, Num.round); // 3
	 * ```
	 */
	round: (n: number): number => Math.round(n),

	/**
	 * Rounds a number down to the nearest integer.
	 *
	 * @example
	 * ```ts
	 * pipe(3.9, Num.floor); // 3
	 * pipe(-3.2, Num.floor); // -4
	 * ```
	 */
	floor: (n: number): number => Math.floor(n),

	/**
	 * Rounds a number up to the nearest integer.
	 *
	 * @example
	 * ```ts
	 * pipe(3.1, Num.ceil); // 4
	 * pipe(-3.9, Num.ceil); // -3
	 * ```
	 */
	ceil: (n: number): number => Math.ceil(n),

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
	remainder: (divisor: number) => (n: number): Maybe<number> =>
		divisor === 0 ? Maybe.make.none() : Maybe.make.some(n % divisor),

	/**
	 * Computes the sum of a list of numbers. Returns `0` if the list is empty.
	 *
	 * @example
	 * ```ts
	 * Num.sum([1, 2, 3]); // 6
	 * Num.sum([]);        // 0
	 * ```
	 */
	sum: sumFn,

	/**
	 * Computes the mean of a list of numbers. Returns `None` if the list is empty.
	 *
	 * @example
	 * ```ts
	 * Num.mean([1, 2, 3]); // Some(2)
	 * Num.mean([]);        // None
	 * ```
	 */
	mean: (ns: readonly number[]): Maybe<number> =>
		ns.length === 0 ? Maybe.make.none() : Maybe.make.some(sumFn(ns) / ns.length),

	/**
	 * Computes the minimum of a list of numbers. Returns `None` if the list is empty.
	 *
	 * @example
	 * ```ts
	 * Num.min([5, 1, 3]); // Some(1)
	 * Num.min([]);        // None
	 * ```
	 */
	min: (ns: readonly number[]): Maybe<number> => {
		if (ns.length === 0) { return Maybe.make.none(); }
		let [result] = ns;
		for (let i = 1; i < ns.length; i++) {
			if (ns[i] < result) { result = ns[i]; }
		}
		return Maybe.make.some(result);
	},

	/**
	 * Computes the maximum of a list of numbers. Returns `None` if the list is empty.
	 *
	 * @example
	 * ```ts
	 * Num.max([1, 5, 3]); // Some(5)
	 * Num.max([]);        // None
	 * ```
	 */
	max: (ns: readonly number[]): Maybe<number> => {
		if (ns.length === 0) { return Maybe.make.none(); }
		let [result] = ns;
		for (let i = 1; i < ns.length; i++) {
			if (ns[i] > result) { result = ns[i]; }
		}
		return Maybe.make.some(result);
	},

	/**
	 * Formats a number using `Intl.NumberFormat`. Returns `None` when `n` is `NaN` or non-finite.
	 * Data-last curried signature.
	 *
	 * @example
	 * ```ts
	 * const formatCurrency = Num.format({ style: "currency", currency: "USD" }, "en-US");
	 * pipe(1234.5, formatCurrency); // Some("$1,234.50")
	 * pipe(NaN, formatCurrency);    // None
	 * ```
	 */
	format: (options?: Intl.NumberFormatOptions, locales?: string | string[]) => (n: number): Maybe<string> =>
		!Number.isFinite(n) ? Maybe.make.none() : Maybe.make.some(new Intl.NumberFormat(locales, options).format(n)),
};
