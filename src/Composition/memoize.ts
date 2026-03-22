/**
 * Creates a memoized version of a function that caches results.
 * Subsequent calls with the same argument return the cached result.
 *
 * By default, uses the argument directly as the cache key.
 * For complex arguments, provide a custom `keyFn` to generate cache keys.
 *
 * @example
 * ```ts
 * // Basic usage
 * const expensive = memoize((n: number) => {
 *   console.log("Computing...");
 *   return n * 2;
 * });
 *
 * expensive(5); // logs "Computing...", returns 10
 * expensive(5); // returns 10 (cached, no log)
 * expensive(3); // logs "Computing...", returns 6
 *
 * // With custom key function for objects
 * const fetchUser = memoize(
 *   (opts: { id: string }) => fetch(`/users/${opts.id}`),
 *   opts => opts.id
 * );
 * ```
 */
export const memoize = <A, B>(
	f: (a: A) => B,
	keyFn: (a: A) => unknown = (a) => a,
): (a: A) => B => {
	const cache = new Map<unknown, B>();

	return (a: A): B => {
		const key = keyFn(a);

		if (cache.has(key)) {
			return cache.get(key)!;
		}

		const result = f(a);
		cache.set(key, result);
		return result;
	};
};

/**
 * Creates a memoized version of a function using WeakMap.
 * Only works with object arguments, but allows garbage collection
 * of cached values when keys are no longer referenced.
 *
 * @example
 * ```ts
 * const processUser = memoizeWeak((user: User) => {
 *   return expensiveOperation(user);
 * });
 *
 * const user = { id: 1, name: "Alice" };
 * processUser(user); // computed
 * processUser(user); // cached
 * // When `user` is garbage collected, cached result is too
 * ```
 */
export const memoizeWeak = <A extends object, B>(f: (a: A) => B): (a: A) => B => {
	const cache = new WeakMap<A, B>();

	return (a: A): B => {
		if (cache.has(a)) {
			return cache.get(a)!;
		}

		const result = f(a);
		cache.set(a, result);
		return result;
	};
};
