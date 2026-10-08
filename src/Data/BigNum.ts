import { Maybe } from "#core";

/**
 * Safe conversion and arithmetic utilities for arbitrary-precision integers (`bigint`).
 * All functions are pure and data-last to compose cleanly with `pipe`.
 *
 * @example
 * ```ts
 * import { BigNum } from "@nlozgachev/pipelined/data";
 * import { pipe } from "@nlozgachev/pipelined/composition";
 *
 * const result = pipe(
 *   BigNum.from.string("100"),
 *   Maybe.map(BigNum.add(50n))
 * ); // Some(150n)
 * ```
 */
export const BigNum = {
	is: {
		/**
		 * Returns `true` when the bigint is equal to zero (`0n`).
		 *
		 * @example
		 * ```ts
		 * BigNum.is.zero(0n); // true
		 * BigNum.is.zero(5n); // false
		 * ```
		 */
		zero: (value: bigint): boolean => value === 0n,

		/**
		 * Returns `true` when the bigint is an even integer.
		 *
		 * @see {@link BigNum.is.odd} to check if a bigint is odd.
		 *
		 * @example
		 * ```ts
		 * BigNum.is.even(4n); // true
		 * BigNum.is.even(3n); // false
		 * ```
		 */
		even: (value: bigint): boolean => value % 2n === 0n,

		/**
		 * Returns `true` when the bigint is an odd integer.
		 *
		 * @see {@link BigNum.is.even} to check if a bigint is even.
		 *
		 * @example
		 * ```ts
		 * BigNum.is.odd(3n); // true
		 * BigNum.is.odd(4n); // false
		 * ```
		 */
		odd: (value: bigint): boolean => value % 2n !== 0n,

		/**
		 * Returns `true` when the bigint is strictly greater than zero (`0n`).
		 *
		 * @see {@link BigNum.is.negative} to check if a bigint is less than zero.
		 *
		 * @example
		 * ```ts
		 * BigNum.is.positive(5n);  // true
		 * BigNum.is.positive(0n);  // false
		 * BigNum.is.positive(-5n); // false
		 * ```
		 */
		positive: (value: bigint): boolean => value > 0n,

		/**
		 * Returns `true` when the bigint is strictly less than zero (`0n`).
		 *
		 * @see {@link BigNum.is.positive} to check if a bigint is greater than zero.
		 *
		 * @example
		 * ```ts
		 * BigNum.is.negative(-5n); // true
		 * BigNum.is.negative(0n);  // false
		 * BigNum.is.negative(5n);  // false
		 * ```
		 */
		negative: (value: bigint): boolean => value < 0n,
	},

	// --- from ---
	from: {
		/**
		 * Safely parses a string into a `bigint`. Returns `None` if parsing fails.
		 *
		 * @example
		 * ```ts
		 * BigNum.from.string("123"); // Some(123n)
		 * BigNum.from.string("abc"); // None
		 * ```
		 */
		string: (text: string): Maybe<bigint> => {
			try {
				if (text.trim() === "") { return Maybe.make.none(); }
				return Maybe.make.some(BigInt(text));
			} catch {
				return Maybe.make.none();
			}
		},

		/**
		 * Safely converts a number into a `bigint`. Returns `None` for floats, `NaN`, or non-safe integers.
		 *
		 * @example
		 * ```ts
		 * BigNum.from.number(42);   // Some(42n)
		 * BigNum.from.number(3.14); // None
		 * ```
		 */
		number: (value: number): Maybe<bigint> => {
			if (!Number.isInteger(value) || value < Number.MIN_SAFE_INTEGER || value > Number.MAX_SAFE_INTEGER) {
				return Maybe.make.none();
			}
			return Maybe.make.some(BigInt(value));
		},
	},

	// --- to ---
	to: {
		/**
		 * Safely converts a `bigint` to a `number`. Returns `None` if the value is outside JavaScript's safe integer range.
		 *
		 * @example
		 * ```ts
		 * BigNum.to.number(42n);                    // Some(42)
		 * BigNum.to.number(9007199254740993n);      // None
		 * ```
		 */
		number: (value: bigint): Maybe<number> => {
			if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
				return Maybe.make.none();
			}
			return Maybe.make.some(Number(value));
		},
	},

	/**
	 * Adds `amount` to `value`. Data-last curried signature: `add(amount)(value)` = `value + amount`.
	 *
	 * @see {@link BigNum.subtract} to subtract an amount from a bigint.
	 *
	 * @example
	 * ```ts
	 * pipe(10n, BigNum.add(5n)); // 15n
	 * ```
	 */
	add: (amount: bigint) => (value: bigint): bigint => value + amount,

	/**
	 * Subtracts `amount` from `from`. Data-last curried signature: `subtract(amount)(from)` = `from - amount`.
	 *
	 * @see {@link BigNum.add} to add an amount to a bigint.
	 *
	 * @example
	 * ```ts
	 * pipe(10n, BigNum.subtract(3n)); // 7n
	 * ```
	 */
	subtract: (amount: bigint) => (from: bigint): bigint => from - amount,

	/**
	 * Multiplies `value` by `factor`. Data-last curried signature: `multiply(factor)(value)` = `value * factor`.
	 *
	 * @see {@link BigNum.divide} to divide a bigint by a divisor.
	 *
	 * @example
	 * ```ts
	 * pipe(6n, BigNum.multiply(7n)); // 42n
	 * ```
	 */
	multiply: (factor: bigint) => (value: bigint): bigint => value * factor,

	/**
	 * Divides `dividend` by `divisor`. Returns `None` if `divisor` is `0n`.
	 *
	 * @see {@link BigNum.multiply} to multiply a bigint by a factor.
	 * @see {@link BigNum.remainder} to compute the division remainder.
	 *
	 * @example
	 * ```ts
	 * pipe(20n, BigNum.divide(4n)); // Some(5n)
	 * pipe(5n, BigNum.divide(0n));  // None
	 * ```
	 */
	divide: (divisor: bigint) => (dividend: bigint): Maybe<bigint> =>
		divisor === 0n ? Maybe.make.none() : Maybe.make.some(dividend / divisor),

	/**
	 * Computes remainder of `dividend / divisor`. Returns `None` if `divisor` is `0n`.
	 *
	 * @see {@link BigNum.divide} for full division.
	 *
	 * @example
	 * ```ts
	 * pipe(10n, BigNum.remainder(3n)); // Some(1n)
	 * pipe(5n, BigNum.remainder(0n));  // None
	 * ```
	 */
	remainder: (divisor: bigint) => (dividend: bigint): Maybe<bigint> =>
		divisor === 0n ? Maybe.make.none() : Maybe.make.some(dividend % divisor),

	/**
	 * Clamps `value` between `min` and `max` (inclusive).
	 *
	 * @example
	 * ```ts
	 * pipe(150n, BigNum.clamp(0n, 100n)); // 100n
	 * ```
	 */
	clamp: (min: bigint, max: bigint) => (value: bigint): bigint => (value < min ? min : (value > max ? max : value)),

	/**
	 * Returns `true` when the bigint is between `min` and `max` (both inclusive).
	 *
	 * @see {@link BigNum.inRange} for half-open range checking [start, end).
	 *
	 * @example
	 * ```ts
	 * pipe(5n, BigNum.between(1n, 10n)); // true
	 * pipe(0n, BigNum.between(1n, 10n)); // false
	 * ```
	 */
	between: (min: bigint, max: bigint) => (value: bigint): boolean => value >= min && value <= max,

	/**
	 * Returns `true` if `value` is in the range `[start, end)` (inclusive start, exclusive end).
	 *
	 * @see {@link BigNum.between} for fully closed range checking [min, max].
	 *
	 * @example
	 * ```ts
	 * pipe(5n, BigNum.inRange(1n, 10n)); // true
	 * ```
	 */
	inRange: (start: bigint, end: bigint) => (value: bigint): boolean => value >= start && value < end,

	/**
	 * Returns absolute value of a `bigint`.
	 *
	 * @example
	 * ```ts
	 * BigNum.abs(-42n); // 42n
	 * ```
	 */
	abs: (value: bigint): bigint => (value < 0n ? -value : value),

	/**
	 * Returns the minimum of `value` and `other`.
	 *
	 * @see {@link BigNum.max} to determine the maximum value.
	 *
	 * @example
	 * ```ts
	 * pipe(10n, BigNum.min(5n)); // 5n
	 * ```
	 */
	min: (other: bigint) => (value: bigint): bigint => (value < other ? value : other),

	/**
	 * Returns the maximum of `value` and `other`.
	 *
	 * @see {@link BigNum.min} to determine the minimum value.
	 *
	 * @example
	 * ```ts
	 * pipe(10n, BigNum.max(5n)); // 10n
	 * ```
	 */
	max: (other: bigint) => (value: bigint): bigint => (value > other ? value : other),
};
