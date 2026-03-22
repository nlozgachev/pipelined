/**
 * Returns the value unchanged. The identity function.
 *
 * @example
 * ```ts
 * identity(42); // 42
 * pipe(Option.some(5), Option.fold(() => 0, identity)); // 5
 * ```
 */
export const identity = <A>(a: A): A => a;

/**
 * Creates a function that always returns the given value, ignoring its argument.
 *
 * @example
 * ```ts
 * const always42 = constant(42);
 * always42(); // 42
 * [1, 2, 3].map(constant("x")); // ["x", "x", "x"]
 * ```
 */
export const constant = <A>(a: A) => (): A => a;

/** Always returns `true`. */
export const constTrue = (): true => true;

/** Always returns `false`. */
export const constFalse = (): false => false;

/** Always returns `null`. */
export const constNull = (): null => null;

/** Always returns `undefined`. */
export const constUndefined = (): undefined => undefined;

/** Always returns `void`. */
export const constVoid = (): void => {};

/**
 * Combines two predicates with logical AND.
 *
 * @example
 * ```ts
 * const isPositive = (n: number) => n > 0;
 * const isEven = (n: number) => n % 2 === 0;
 * const isPositiveEven = and(isPositive, isEven);
 *
 * isPositiveEven(4); // true
 * isPositiveEven(-2); // false
 * isPositiveEven(3); // false
 * ```
 */
export const and = <A extends ReadonlyArray<unknown>>(
	p1: (...args: A) => boolean,
	p2: (...args: A) => boolean,
) =>
(...args: A): boolean => p1(...args) && p2(...args);

/**
 * Combines two predicates with logical OR.
 *
 * @example
 * ```ts
 * const isNegative = (n: number) => n < 0;
 * const isZero = (n: number) => n === 0;
 * const isNonPositive = or(isNegative, isZero);
 *
 * isNonPositive(-1); // true
 * isNonPositive(0); // true
 * isNonPositive(1); // false
 * ```
 */
export const or = <A extends ReadonlyArray<unknown>>(
	p1: (...args: A) => boolean,
	p2: (...args: A) => boolean,
) =>
(...args: A): boolean => p1(...args) || p2(...args);

/**
 * Creates a function that executes at most once.
 * Subsequent calls return the cached result from the first execution.
 *
 * @example
 * ```ts
 * let count = 0;
 * const initOnce = once(() => { count++; return "initialized"; });
 *
 * initOnce(); // "initialized", count === 1
 * initOnce(); // "initialized", count === 1 (not called again)
 * ```
 */
export const once = <A>(f: () => A): () => A => {
	let called = false;
	let result: A;
	return () => {
		if (!called) {
			result = f();
			called = true;
		}
		return result;
	};
};
