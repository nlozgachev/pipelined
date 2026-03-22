/**
 * Functional utilities for unique-value collections (`ReadonlySet<A>`). All functions are pure
 * and data-last — they compose naturally with `pipe`.
 *
 * Every "mutating" operation returns a new set; the original is never changed.
 *
 * @example
 * ```ts
 * import { Uniq } from "@nlozgachev/pipelined/utils";
 * import { pipe } from "@nlozgachev/pipelined/composition";
 *
 * const active = pipe(
 *   Uniq.fromArray(["alice", "bob", "alice", "carol"]),
 *   Uniq.remove("bob"),
 *   Uniq.map(name => name.toUpperCase()),
 * );
 * // ReadonlySet { "ALICE", "CAROL" }
 * ```
 */
export namespace Uniq {
	// ---------------------------------------------------------------------------
	// Constructors
	// ---------------------------------------------------------------------------

	/**
	 * Creates an empty unique collection.
	 *
	 * @example
	 * ```ts
	 * Uniq.empty<number>(); // ReadonlySet {}
	 * ```
	 */
	export const empty = <A>(): ReadonlySet<A> => new globalThis.Set<A>();

	/**
	 * Creates a unique collection containing a single item.
	 *
	 * @example
	 * ```ts
	 * Uniq.singleton(42); // ReadonlySet { 42 }
	 * ```
	 */
	export const singleton = <A>(item: A): ReadonlySet<A> => new globalThis.Set([item]);

	/**
	 * Creates a unique collection from an array, automatically discarding duplicates.
	 *
	 * @example
	 * ```ts
	 * Uniq.fromArray([1, 2, 2, 3, 3, 3]); // ReadonlySet { 1, 2, 3 }
	 * Uniq.fromArray([]);                  // ReadonlySet {}
	 * ```
	 */
	export const fromArray = <A>(arr: readonly A[]): ReadonlySet<A> => new globalThis.Set(arr);

	// ---------------------------------------------------------------------------
	// Query
	// ---------------------------------------------------------------------------

	/**
	 * Returns `true` if the collection contains the given item.
	 *
	 * @example
	 * ```ts
	 * pipe(Uniq.fromArray([1, 2, 3]), Uniq.has(2)); // true
	 * pipe(Uniq.fromArray([1, 2, 3]), Uniq.has(4)); // false
	 * ```
	 */
	export const has = <A>(item: A) => (s: ReadonlySet<A>): boolean => s.has(item);

	/**
	 * Returns the number of items in the collection.
	 *
	 * @example
	 * ```ts
	 * Uniq.size(Uniq.fromArray([1, 2, 3])); // 3
	 * ```
	 */
	export const size = <A>(s: ReadonlySet<A>): number => s.size;

	/**
	 * Returns `true` if the collection has no items.
	 *
	 * @example
	 * ```ts
	 * Uniq.isEmpty(Uniq.empty()); // true
	 * ```
	 */
	export const isEmpty = <A>(s: ReadonlySet<A>): boolean => s.size === 0;

	/**
	 * Returns `true` if every item in `set` also exists in `other`.
	 *
	 * @example
	 * ```ts
	 * pipe(Uniq.fromArray([1, 2]), Uniq.isSubsetOf(Uniq.fromArray([1, 2, 3]))); // true
	 * pipe(Uniq.fromArray([1, 4]), Uniq.isSubsetOf(Uniq.fromArray([1, 2, 3]))); // false
	 * pipe(Uniq.empty<number>(), Uniq.isSubsetOf(Uniq.fromArray([1, 2, 3])));   // true
	 * ```
	 */
	export const isSubsetOf = <A>(other: ReadonlySet<A>) => (s: ReadonlySet<A>): boolean => {
		const set = s as Set<A>;
		if (typeof set.isSubsetOf === "function") return set.isSubsetOf(other as Set<A>);
		for (const item of s) if (!other.has(item)) return false;
		return true;
	};

	// ---------------------------------------------------------------------------
	// Modification
	// ---------------------------------------------------------------------------

	/**
	 * Returns a new collection with the item added. If the item is already present, returns the
	 * original collection unchanged.
	 *
	 * @example
	 * ```ts
	 * pipe(Uniq.fromArray([1, 2]), Uniq.insert(3)); // ReadonlySet { 1, 2, 3 }
	 * pipe(Uniq.fromArray([1, 2]), Uniq.insert(2)); // ReadonlySet { 1, 2 } — unchanged
	 * ```
	 */
	export const insert = <A>(item: A) => (s: ReadonlySet<A>): ReadonlySet<A> => {
		if (s.has(item)) return s;
		const result = new globalThis.Set(s);
		result.add(item);
		return result;
	};

	/**
	 * Returns a new collection with the item removed. If the item is not present, returns the
	 * original collection unchanged.
	 *
	 * @example
	 * ```ts
	 * pipe(Uniq.fromArray([1, 2, 3]), Uniq.remove(2)); // ReadonlySet { 1, 3 }
	 * pipe(Uniq.fromArray([1, 2, 3]), Uniq.remove(4)); // ReadonlySet { 1, 2, 3 } — unchanged
	 * ```
	 */
	export const remove = <A>(item: A) => (s: ReadonlySet<A>): ReadonlySet<A> => {
		if (!s.has(item)) return s;
		const result = new globalThis.Set(s);
		result.delete(item);
		return result;
	};

	// ---------------------------------------------------------------------------
	// Transform
	// ---------------------------------------------------------------------------

	/**
	 * Applies `f` to each item, returning a new collection of the results. Duplicate results are
	 * automatically merged.
	 *
	 * @example
	 * ```ts
	 * pipe(Uniq.fromArray([1, 2, 3, 4]), Uniq.map(n => n % 3)); // ReadonlySet { 1, 2, 0 }
	 * ```
	 */
	export const map = <A, B>(f: (a: A) => B) => (s: ReadonlySet<A>): ReadonlySet<B> => {
		const result = new globalThis.Set<B>();
		for (const item of s) {
			result.add(f(item));
		}
		return result;
	};

	/**
	 * Returns a new collection containing only the items for which the predicate returns `true`.
	 *
	 * @example
	 * ```ts
	 * pipe(Uniq.fromArray([1, 2, 3, 4, 5]), Uniq.filter(n => n % 2 === 0));
	 * // ReadonlySet { 2, 4 }
	 * ```
	 */
	export const filter = <A>(predicate: (a: A) => boolean) => (s: ReadonlySet<A>): ReadonlySet<A> => {
		const result = new globalThis.Set<A>();
		for (const item of s) {
			if (predicate(item)) result.add(item);
		}
		return result;
	};

	// ---------------------------------------------------------------------------
	// Set operations
	// ---------------------------------------------------------------------------

	/**
	 * Returns a new collection containing all items from both collections.
	 *
	 * @example
	 * ```ts
	 * pipe(Uniq.fromArray([1, 2, 3]), Uniq.union(Uniq.fromArray([2, 3, 4])));
	 * // ReadonlySet { 1, 2, 3, 4 }
	 * ```
	 */
	export const union = <A>(other: ReadonlySet<A>) => (s: ReadonlySet<A>): ReadonlySet<A> => {
		const set = s as Set<A>;
		if (typeof set.union === "function") return set.union(other as Set<A>);
		const result = new globalThis.Set(s);
		for (const item of other) result.add(item);
		return result;
	};

	/**
	 * Returns a new collection containing only the items that appear in both collections.
	 *
	 * @example
	 * ```ts
	 * pipe(Uniq.fromArray([1, 2, 3]), Uniq.intersection(Uniq.fromArray([2, 3, 4])));
	 * // ReadonlySet { 2, 3 }
	 * ```
	 */
	export const intersection = <A>(other: ReadonlySet<A>) => (s: ReadonlySet<A>): ReadonlySet<A> => {
		const set = s as Set<A>;
		if (typeof set.intersection === "function") return set.intersection(other as Set<A>);
		const result = new globalThis.Set<A>();
		for (const item of s) if (other.has(item)) result.add(item);
		return result;
	};

	/**
	 * Returns a new collection containing only the items from `set` that do not appear in `other`.
	 *
	 * @example
	 * ```ts
	 * pipe(Uniq.fromArray([1, 2, 3, 4]), Uniq.difference(Uniq.fromArray([2, 4])));
	 * // ReadonlySet { 1, 3 }
	 * ```
	 */
	export const difference = <A>(other: ReadonlySet<A>) => (s: ReadonlySet<A>): ReadonlySet<A> => {
		const set = s as Set<A>;
		if (typeof set.difference === "function") return set.difference(other as Set<A>);
		const result = new globalThis.Set<A>();
		for (const item of s) if (!other.has(item)) result.add(item);
		return result;
	};

	// ---------------------------------------------------------------------------
	// Fold
	// ---------------------------------------------------------------------------

	/**
	 * Folds the collection into a single value by applying `f` to each item in insertion order.
	 *
	 * @example
	 * ```ts
	 * Uniq.reduce(0, (acc, n) => acc + n)(Uniq.fromArray([1, 2, 3])); // 6
	 * ```
	 */
	export const reduce = <A, B>(init: B, f: (acc: B, a: A) => B) => (s: ReadonlySet<A>): B => {
		let acc = init;
		for (const item of s) {
			acc = f(acc, item);
		}
		return acc;
	};

	// ---------------------------------------------------------------------------
	// Convert
	// ---------------------------------------------------------------------------

	/**
	 * Converts the collection to a readonly array in insertion order.
	 *
	 * @example
	 * ```ts
	 * Uniq.toArray(Uniq.fromArray([3, 1, 2])); // [3, 1, 2]
	 * ```
	 */
	export const toArray = <A>(s: ReadonlySet<A>): readonly A[] => [...s];
}
