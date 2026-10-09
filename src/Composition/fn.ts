/**
 * Returns the value unchanged. The identity function.
 *
 * @example
 * ```ts
 * identity(42); // 42
 * pipe(Maybe.make.some(5), Maybe.fold(() => 0, identity)); // 5
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

/**
 * Converts a function taking multiple arguments into a function taking a single tuple argument.
 *
 * @example
 * ```ts
 * const add = (a: number, b: number) => a + b;
 * const addTuple = tuple(add);
 * addTuple([2, 3]); // 5
 * ```
 */
export const tuple = <Args extends readonly unknown[], R>(f: (...args: Args) => R) => (args: Args): R => f(...args);

/**
 * Converts a function taking a single tuple argument into a function taking multiple arguments.
 *
 * @example
 * ```ts
 * const addTuple = ([a, b]: readonly [number, number]) => a + b;
 * const add = untuple(addTuple);
 * add(2, 3); // 5
 * ```
 */
export const untuple = <Args extends readonly unknown[], R>(f: (args: Args) => R) => (...args: Args): R => f(args);
