// =============================================================================
// Imports
// =============================================================================
import { Maybe } from "#core";

// =============================================================================
// Private Helpers
// =============================================================================
const sumFn = (numbers: readonly number[]): number => {
	let result = 0;
	for (let i = 0; i < numbers.length; i++) {
		result += numbers[i];
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
		zero: (value: number): boolean => value === 0,

		/**
		 * Returns `true` when the number is a whole integer.
		 *
		 * @see {@link Num.is.float} to check for fractional numbers.
		 *
		 * @example
		 * ```ts
		 * Num.is.integer(5);    // true
		 * Num.is.integer(3.14); // false
		 * ```
		 */
		integer: (value: number): boolean => Number.isInteger(value),

		/**
		 * Returns `true` when the number is a finite float (fractional number).
		 *
		 * @see {@link Num.is.integer} to check for whole numbers.
		 *
		 * @example
		 * ```ts
		 * Num.is.float(3.14); // true
		 * Num.is.float(5);    // false
		 * ```
		 */
		float: (value: number): boolean => Number.isFinite(value) && !Number.isInteger(value),

		/**
		 * Returns `true` when the number is finite (not `Infinity`, `-Infinity`, or `NaN`).
		 *
		 * @example
		 * ```ts
		 * Num.is.finite(42);       // true
		 * Num.is.finite(Infinity); // false
		 * ```
		 */
		finite: (value: number): boolean => Number.isFinite(value),

		/**
		 * Returns `true` when the value is `NaN`.
		 *
		 * @example
		 * ```ts
		 * Num.is.nan(NaN); // true
		 * Num.is.nan(42);  // false
		 * ```
		 */
		nan: (value: number): boolean => Number.isNaN(value),

		/**
		 * Returns `true` when the number is an even integer.
		 *
		 * @see {@link Num.is.odd} to check if a number is odd.
		 *
		 * @example
		 * ```ts
		 * Num.is.even(4);   // true
		 * Num.is.even(3);   // false
		 * Num.is.even(2.5); // false
		 * ```
		 */
		even: (value: number): boolean => Number.isInteger(value) && value % 2 === 0,

		/**
		 * Returns `true` when the number is an odd integer.
		 *
		 * @see {@link Num.is.even} to check if a number is even.
		 *
		 * @example
		 * ```ts
		 * Num.is.odd(3);   // true
		 * Num.is.odd(4);   // false
		 * Num.is.odd(2.5); // false
		 * ```
		 */
		odd: (value: number): boolean => Number.isInteger(value) && value % 2 !== 0,

		/**
		 * Returns `true` when the number is strictly greater than zero.
		 *
		 * @see {@link Num.is.negative} to check if a number is less than zero.
		 *
		 * @example
		 * ```ts
		 * Num.is.positive(5);  // true
		 * Num.is.positive(0);  // false
		 * Num.is.positive(-5); // false
		 * ```
		 */
		positive: (value: number): boolean => value > 0,

		/**
		 * Returns `true` when the number is strictly less than zero.
		 *
		 * @see {@link Num.is.positive} to check if a number is greater than zero.
		 *
		 * @example
		 * ```ts
		 * Num.is.negative(-5); // true
		 * Num.is.negative(0);  // false
		 * Num.is.negative(5);  // false
		 * ```
		 */
		negative: (value: number): boolean => value < 0,
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
	clamp: (min: number, max: number) => (value: number): number => Math.min(Math.max(value, min), max),

	/**
	 * Returns `true` when the number is between `min` and `max` (both inclusive).
	 *
	 * @see {@link Num.inRange} for half-open range checking [start, end).
	 *
	 * @example
	 * ```ts
	 * pipe(5, Num.between(1, 10));  // true
	 * pipe(0, Num.between(1, 10));  // false
	 * pipe(10, Num.between(1, 10)); // true
	 * ```
	 */
	between: (min: number, max: number) => (value: number): boolean => value >= min && value <= max,

	/**
	 * Returns `true` when the number is in the range `[start, end)` (inclusive of `start`, exclusive of `end`).
	 *
	 * @see {@link Num.between} for fully closed range checking [min, max].
	 *
	 * @example
	 * ```ts
	 * pipe(5, Num.inRange(1, 10));  // true
	 * pipe(1, Num.inRange(1, 10));  // true
	 * pipe(10, Num.inRange(1, 10)); // false
	 * ```
	 */
	inRange: (start: number, end: number) => (value: number): boolean => value >= start && value < end,

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
	parse: (text: string): Maybe<number> => {
		if (text.trim() === "") { return Maybe.make.none(); }
		const n = Number(text);
		return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	},

	/**
	 * Adds `amount` to a number. Data-last: use in `pipe` or `Arr.map`.
	 *
	 * @see {@link Num.subtract} to subtract an amount from a number.
	 *
	 * @example
	 * ```ts
	 * pipe(5, Num.add(3));                   // 8
	 * pipe([1, 2, 3], Arr.map(Num.add(10))); // [11, 12, 13]
	 * ```
	 */
	add: (amount: number) => (value: number): number => value + amount,

	/**
	 * Subtracts `amount` from a number. Data-last: `subtract(amount)(from)` = `from - amount`.
	 *
	 * @see {@link Num.add} to add an amount to a number.
	 *
	 * @example
	 * ```ts
	 * pipe(10, Num.subtract(3));                  // 7
	 * pipe([5, 10, 15], Arr.map(Num.subtract(2))); // [3, 8, 13]
	 * ```
	 */
	subtract: (amount: number) => (from: number): number => from - amount,

	/**
	 * Multiplies a number by `factor`. Data-last: use in `pipe` or `Arr.map`.
	 *
	 * @see {@link Num.divide} to divide a number by a divisor.
	 *
	 * @example
	 * ```ts
	 * pipe(6, Num.multiply(7));                    // 42
	 * pipe([1, 2, 3], Arr.map(Num.multiply(100))); // [100, 200, 300]
	 * ```
	 */
	multiply: (factor: number) => (value: number): number => value * factor,

	/**
	 * Divides a number by `divisor`. Returns `None` when `divisor` is zero. Data-last: `divide(divisor)(dividend)` = `dividend / divisor`.
	 *
	 * @see {@link Num.multiply} to multiply a number by a factor.
	 * @see {@link Num.remainder} to compute the division remainder.
	 *
	 * @example
	 * ```ts
	 * pipe(20, Num.divide(4));                           // Some(5)
	 * pipe(5, Num.divide(0));                            // None
	 * pipe([10, 20, 30], Arr.filterMap(Num.divide(10))); // [1, 2, 3]
	 * ```
	 */
	divide: (divisor: number) => (dividend: number): Maybe<number> =>
		divisor === 0 ? Maybe.make.none() : Maybe.make.some(dividend / divisor),

	/**
	 * Returns the absolute value of a number.
	 *
	 * @example
	 * ```ts
	 * pipe(-5, Num.abs); // 5
	 * pipe(5, Num.abs);  // 5
	 * ```
	 */
	abs: (value: number): number => Math.abs(value),

	/**
	 * Negates a number (arithmetic negation).
	 *
	 * @example
	 * ```ts
	 * pipe(5, Num.negate);  // -5
	 * pipe(-5, Num.negate); // 5
	 * ```
	 */
	negate: (value: number): number => -value,

	/**
	 * Rounds a number to the nearest integer.
	 *
	 * @see {@link Num.floor} to round down.
	 * @see {@link Num.ceil} to round up.
	 *
	 * @example
	 * ```ts
	 * pipe(3.5, Num.round); // 4
	 * pipe(3.4, Num.round); // 3
	 * ```
	 */
	round: (value: number): number => Math.round(value),

	/**
	 * Rounds a number down to the nearest integer.
	 *
	 * @see {@link Num.round} to round to nearest integer.
	 * @see {@link Num.ceil} to round up.
	 *
	 * @example
	 * ```ts
	 * pipe(3.9, Num.floor); // 3
	 * pipe(-3.2, Num.floor); // -4
	 * ```
	 */
	floor: (value: number): number => Math.floor(value),

	/**
	 * Rounds a number up to the nearest integer.
	 *
	 * @see {@link Num.round} to round to nearest integer.
	 * @see {@link Num.floor} to round down.
	 *
	 * @example
	 * ```ts
	 * pipe(3.1, Num.ceil); // 4
	 * pipe(-3.9, Num.ceil); // -3
	 * ```
	 */
	ceil: (value: number): number => Math.ceil(value),

	/**
	 * Returns the remainder of dividing a number by `divisor`. Returns `None` when `divisor` is zero.
	 * Data-last: `remainder(divisor)(dividend)` = `dividend % divisor`.
	 *
	 * @see {@link Num.divide} for full division.
	 *
	 * @example
	 * ```ts
	 * pipe(10, Num.remainder(3));                           // Some(1)
	 * pipe(5, Num.remainder(0));                            // None
	 * pipe([10, 11, 12], Arr.filterMap(Num.remainder(3))); // [1, 2, 0]
	 * ```
	 */
	remainder: (divisor: number) => (dividend: number): Maybe<number> =>
		divisor === 0 ? Maybe.make.none() : Maybe.make.some(dividend % divisor),

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
	mean: (numbers: readonly number[]): Maybe<number> =>
		numbers.length === 0 ? Maybe.make.none() : Maybe.make.some(sumFn(numbers) / numbers.length),

	/**
	 * Computes the minimum of a list of numbers. Returns `None` if the list is empty.
	 *
	 * @see {@link Num.max} to compute the maximum value.
	 *
	 * @example
	 * ```ts
	 * Num.min([5, 1, 3]); // Some(1)
	 * Num.min([]);        // None
	 * ```
	 */
	min: (numbers: readonly number[]): Maybe<number> => {
		if (numbers.length === 0) { return Maybe.make.none(); }
		let [result] = numbers;
		for (let i = 1; i < numbers.length; i++) {
			if (numbers[i] < result) { result = numbers[i]; }
		}
		return Maybe.make.some(result);
	},

	/**
	 * Computes the maximum of a list of numbers. Returns `None` if the list is empty.
	 *
	 * @see {@link Num.min} to compute the minimum value.
	 *
	 * @example
	 * ```ts
	 * Num.max([1, 5, 3]); // Some(5)
	 * Num.max([]);        // None
	 * ```
	 */
	max: (numbers: readonly number[]): Maybe<number> => {
		if (numbers.length === 0) { return Maybe.make.none(); }
		let [result] = numbers;
		for (let i = 1; i < numbers.length; i++) {
			if (numbers[i] > result) { result = numbers[i]; }
		}
		return Maybe.make.some(result);
	},

	/**
	 * Formats a number using `Intl.NumberFormat`. Returns `None` when `value` is `NaN` or non-finite.
	 * Data-last curried signature.
	 *
	 * @example
	 * ```ts
	 * const formatCurrency = Num.format({ style: "currency", currency: "USD" }, "en-US");
	 * pipe(1234.5, formatCurrency); // Some("$1,234.50")
	 * pipe(NaN, formatCurrency);    // None
	 * ```
	 */
	format: (options?: Intl.NumberFormatOptions, locales?: string | string[]) => (value: number): Maybe<string> =>
		!Number.isFinite(value) ? Maybe.make.none() : Maybe.make.some(new Intl.NumberFormat(locales, options).format(value)),
};
