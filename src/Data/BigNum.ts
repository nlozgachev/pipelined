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
export namespace BigNum {
	// --- from ---
	export namespace from {
		/**
		 * Safely parses a string into a `bigint`. Returns `None` if parsing fails.
		 *
		 * @example
		 * ```ts
		 * BigNum.from.string("123"); // Some(123n)
		 * BigNum.from.string("abc"); // None
		 * ```
		 */
		export const string = (s: string): Maybe<bigint> => {
			try {
				if (s.trim() === "") { return Maybe.make.none(); }
				return Maybe.make.some(BigInt(s));
			} catch {
				return Maybe.make.none();
			}
		};

		/**
		 * Safely converts a number into a `bigint`. Returns `None` for floats, `NaN`, or non-safe integers.
		 *
		 * @example
		 * ```ts
		 * BigNum.from.number(42);   // Some(42n)
		 * BigNum.from.number(3.14); // None
		 * ```
		 */
		export const number = (n: number): Maybe<bigint> => {
			if (!Number.isInteger(n) || n < Number.MIN_SAFE_INTEGER || n > Number.MAX_SAFE_INTEGER) {
				return Maybe.make.none();
			}
			return Maybe.make.some(BigInt(n));
		};
	}

	// --- to ---
	export namespace to {
		/**
		 * Safely converts a `bigint` to a `number`. Returns `None` if the value is outside JavaScript's safe integer range.
		 *
		 * @example
		 * ```ts
		 * BigNum.to.number(42n);                    // Some(42)
		 * BigNum.to.number(9007199254740993n);      // None
		 * ```
		 */
		export const number = (b: bigint): Maybe<number> => {
			if (b < BigInt(Number.MIN_SAFE_INTEGER) || b > BigInt(Number.MAX_SAFE_INTEGER)) {
				return Maybe.make.none();
			}
			return Maybe.make.some(Number(b));
		};
	}

	/**
	 * Adds `b` to `a`. Data-last curried signature: `add(b)(a)` = `a + b`.
	 *
	 * @example
	 * ```ts
	 * pipe(10n, BigNum.add(5n)); // 15n
	 * ```
	 */
	export const add = (b: bigint) => (a: bigint): bigint => a + b;

	/**
	 * Subtracts `b` from `a`. Data-last curried signature: `sub(b)(a)` = `a - b`.
	 *
	 * @example
	 * ```ts
	 * pipe(10n, BigNum.sub(3n)); // 7n
	 * ```
	 */
	export const sub = (b: bigint) => (a: bigint): bigint => a - b;

	/**
	 * Multiplies `a` by `b`. Data-last curried signature: `mul(b)(a)` = `a * b`.
	 *
	 * @example
	 * ```ts
	 * pipe(6n, BigNum.mul(7n)); // 42n
	 * ```
	 */
	export const mul = (b: bigint) => (a: bigint): bigint => a * b;

	/**
	 * Divides `a` by `b`. Returns `None` if `b` is `0n`.
	 *
	 * @example
	 * ```ts
	 * pipe(20n, BigNum.div(4n)); // Some(5n)
	 * pipe(5n, BigNum.div(0n));  // None
	 * ```
	 */
	export const div = (b: bigint) => (a: bigint): Maybe<bigint> => b === 0n ? Maybe.make.none() : Maybe.make.some(a / b);

	/**
	 * Computes remainder of `a / b`. Returns `None` if `b` is `0n`.
	 *
	 * @example
	 * ```ts
	 * pipe(10n, BigNum.mod(3n)); // Some(1n)
	 * pipe(5n, BigNum.mod(0n));  // None
	 * ```
	 */
	export const mod = (b: bigint) => (a: bigint): Maybe<bigint> => b === 0n ? Maybe.make.none() : Maybe.make.some(a % b);

	/**
	 * Clamps `a` between `min` and `max` (inclusive).
	 *
	 * @example
	 * ```ts
	 * pipe(150n, BigNum.clamp(0n, 100n)); // 100n
	 * ```
	 */
	export const clamp = (min: bigint, max: bigint) => (a: bigint): bigint => a < min ? min : (a > max ? max : a);

	/**
	 * Returns `true` if `a` is in the range `[start, end)` (inclusive start, exclusive end).
	 *
	 * @example
	 * ```ts
	 * pipe(5n, BigNum.inRange(1n, 10n)); // true
	 * ```
	 */
	export const inRange = (start: bigint, end: bigint) => (a: bigint): boolean => a >= start && a < end;

	/**
	 * Returns absolute value of a `bigint`.
	 *
	 * @example
	 * ```ts
	 * BigNum.abs(-42n); // 42n
	 * ```
	 */
	export const abs = (a: bigint): bigint => (a < 0n ? -a : a);

	/**
	 * Returns the minimum of `a` and `b`.
	 *
	 * @example
	 * ```ts
	 * pipe(10n, BigNum.min(5n)); // 5n
	 * ```
	 */
	export const min = (b: bigint) => (a: bigint): bigint => (a < b ? a : b);

	/**
	 * Returns the maximum of `a` and `b`.
	 *
	 * @example
	 * ```ts
	 * pipe(10n, BigNum.max(5n)); // 10n
	 * ```
	 */
	export const max = (b: bigint) => (a: bigint): bigint => (a > b ? a : b);
}
