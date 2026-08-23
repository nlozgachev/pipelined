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
 *   { key: (opts) => opts.id }
 * );
 * // With bounded cache size (LRU eviction)
 * const bounded = memoize(
 *   (n: number) => n * 2,
 *   { maxSize: 100 }
 * );
 * ```
 */
export const memoize = <A, B>(f: (a: A) => B, options?: {
	readonly key?: (a: A) => unknown;
	/**
	 * Maximum number of entries to store in the cache before evicting the least recently used (LRU) entry.
	 */
	readonly maxSize?: number;
}): (a: A) => B => {
	const cache = new Map<unknown, B>();
	const keyFn = options?.key ?? ((a) => a);
	const maxSize = options?.maxSize;

	return (a: A): B => {
		const key = keyFn(a);

		if (cache.has(key)) {
			const cached = cache.get(key)!;
			if (maxSize !== undefined) {
				cache.delete(key);
				cache.set(key, cached);
			}
			return cached;
		}

		const result = f(a);
		cache.set(key, result);

		if (maxSize !== undefined && cache.size > maxSize) {
			const firstKey = cache.keys().next().value;
			if (firstKey !== undefined) {
				cache.delete(firstKey);
			}
		}

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
 * type User = { id: number; name: string };
 * const expensiveOperation = (u: User) => u.name.toUpperCase();
 *
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
