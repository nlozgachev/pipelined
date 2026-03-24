import { Maybe } from "#core/Maybe.ts";

/**
 * Functional utilities for key-value dictionaries (`ReadonlyMap<K, V>`). All functions are pure
 * and data-last — they compose naturally with `pipe`.
 *
 * Unlike plain objects (`Rec`), dictionaries support any key type, preserve insertion order, and
 * make membership checks explicit via `lookup` returning `Maybe`.
 *
 * @example
 * ```ts
 * import { Dict } from "@nlozgachev/pipelined/utils";
 * import { pipe } from "@nlozgachev/pipelined/composition";
 *
 * const scores = pipe(
 *   Dict.fromEntries([["alice", 10], ["bob", 8], ["carol", 10]] as const),
 *   Dict.filter(n => n >= 10),
 *   Dict.map(n => `${n} points`),
 * );
 * // ReadonlyMap { "alice" => "10 points", "carol" => "10 points" }
 * ```
 */
export namespace Dict {
	// ---------------------------------------------------------------------------
	// Constructors
	// ---------------------------------------------------------------------------

	/**
	 * Creates an empty dictionary.
	 *
	 * @example
	 * ```ts
	 * Dict.empty<string, number>(); // ReadonlyMap {}
	 * ```
	 */
	export const empty = <K, V>(): ReadonlyMap<K, V> => new globalThis.Map<K, V>();

	/**
	 * Creates a dictionary with a single entry.
	 *
	 * @example
	 * ```ts
	 * Dict.singleton("name", "Alice"); // ReadonlyMap { "name" => "Alice" }
	 * ```
	 */
	export const singleton = <K, V>(key: K, value: V): ReadonlyMap<K, V> => new globalThis.Map<K, V>([[key, value]]);

	/**
	 * Creates a dictionary from an array of key-value pairs.
	 *
	 * @example
	 * ```ts
	 * Dict.fromEntries([["a", 1], ["b", 2]]); // ReadonlyMap { "a" => 1, "b" => 2 }
	 * ```
	 */
	export const fromEntries = <K, V>(entries: readonly (readonly [K, V])[]): ReadonlyMap<K, V> =>
		new globalThis.Map(entries as [K, V][]);

	/**
	 * Creates a dictionary from a plain object. Keys are always strings.
	 *
	 * @example
	 * ```ts
	 * Dict.fromRecord({ a: 1, b: 2 }); // ReadonlyMap { "a" => 1, "b" => 2 }
	 * ```
	 */
	export const fromRecord = <V>(rec: Readonly<Record<string, V>>): ReadonlyMap<string, V> =>
		new globalThis.Map(Object.entries(rec));

	/**
	 * Groups elements of an array into a dictionary keyed by the result of `keyFn`. Each key maps
	 * to the array of elements that produced it, in insertion order. Uses the native `Map.groupBy`
	 * when available, falling back to a manual loop in older environments.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   [{ name: "alice", role: "admin" }, { name: "bob", role: "viewer" }, { name: "carol", role: "admin" }],
	 *   Dict.groupBy(user => user.role),
	 * );
	 * // ReadonlyMap { "admin" => [alice, carol], "viewer" => [bob] }
	 * ```
	 */
	export const groupBy = <K, A>(keyFn: (a: A) => K) => (items: readonly A[]): ReadonlyMap<K, readonly A[]> => {
		const result = new globalThis.Map<K, A[]>();
		for (const item of items) {
			const key = keyFn(item);
			const arr = result.get(key);
			if (arr !== undefined) arr.push(item);
			else result.set(key, [item]);
		}
		return result;
	};

	// ---------------------------------------------------------------------------
	// Query
	// ---------------------------------------------------------------------------

	/**
	 * Returns `true` if the dictionary contains the given key.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.fromEntries([["a", 1]]), Dict.has("a")); // true
	 * pipe(Dict.fromEntries([["a", 1]]), Dict.has("b")); // false
	 * ```
	 */
	export const has = <K>(key: K) => <V>(m: ReadonlyMap<K, V>): boolean => m.has(key);

	/**
	 * Looks up a value by key, returning `Some(value)` if found and `None` if not.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.fromEntries([["a", 1]]), Dict.lookup("a")); // Some(1)
	 * pipe(Dict.fromEntries([["a", 1]]), Dict.lookup("b")); // None
	 * ```
	 */
	export const lookup = <K>(key: K) => <V>(m: ReadonlyMap<K, V>): Maybe<V> =>
		m.has(key) ? Maybe.some(m.get(key) as V) : Maybe.none();

	/**
	 * Returns the number of entries in the dictionary.
	 *
	 * @example
	 * ```ts
	 * Dict.size(Dict.fromEntries([["a", 1], ["b", 2]])); // 2
	 * ```
	 */
	export const size = <K, V>(m: ReadonlyMap<K, V>): number => m.size;

	/**
	 * Returns `true` if the dictionary has no entries.
	 *
	 * @example
	 * ```ts
	 * Dict.isEmpty(Dict.empty()); // true
	 * ```
	 */
	export const isEmpty = <K, V>(m: ReadonlyMap<K, V>): boolean => m.size === 0;

	/**
	 * Returns all keys as a readonly array, in insertion order.
	 *
	 * @example
	 * ```ts
	 * Dict.keys(Dict.fromEntries([["a", 1], ["b", 2]])); // ["a", "b"]
	 * ```
	 */
	export const keys = <K, V>(m: ReadonlyMap<K, V>): readonly K[] => [...m.keys()];

	/**
	 * Returns all values as a readonly array, in insertion order.
	 *
	 * @example
	 * ```ts
	 * Dict.values(Dict.fromEntries([["a", 1], ["b", 2]])); // [1, 2]
	 * ```
	 */
	export const values = <K, V>(m: ReadonlyMap<K, V>): readonly V[] => [...m.values()];

	/**
	 * Returns all key-value pairs as a readonly array of tuples, in insertion order.
	 *
	 * @example
	 * ```ts
	 * Dict.entries(Dict.fromEntries([["a", 1], ["b", 2]])); // [["a", 1], ["b", 2]]
	 * ```
	 */
	export const entries = <K, V>(m: ReadonlyMap<K, V>): readonly (readonly [K, V])[] => [...m.entries()];

	// ---------------------------------------------------------------------------
	// Modification
	// ---------------------------------------------------------------------------

	/**
	 * Returns a new dictionary with the given key set to the given value.
	 * If the key already exists, its value is replaced.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.fromEntries([["a", 1]]), Dict.insert("b", 2));
	 * // ReadonlyMap { "a" => 1, "b" => 2 }
	 * ```
	 */
	export const insert = <K, V>(key: K, value: V) => (m: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
		const result = new globalThis.Map(m);
		result.set(key, value);
		return result;
	};

	/**
	 * Returns a new dictionary with the given key removed.
	 * If the key does not exist, the dictionary is returned unchanged.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.fromEntries([["a", 1], ["b", 2]]), Dict.remove("a"));
	 * // ReadonlyMap { "b" => 2 }
	 * ```
	 */
	export const remove = <K, V>(key: K) => (m: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
		if (!m.has(key)) return m;
		const result = new globalThis.Map(m);
		result.delete(key);
		return result;
	};

	/**
	 * Returns a new dictionary with the value at `key` set by `f`. If the key does not exist,
	 * `f` receives `None`. If the key exists, `f` receives `Some(currentValue)`.
	 *
	 * Useful for incrementing counters, initialising defaults, or conditional updates.
	 *
	 * @example
	 * ```ts
	 * import { Maybe } from "@nlozgachev/pipelined/core";
	 *
	 * const increment = (opt: Maybe<number>) => Maybe.getOrElse(() => 0)(opt) + 1;
	 * pipe(Dict.fromEntries([["views", 5]]), Dict.upsert("views", increment)); // { views: 6 }
	 * pipe(Dict.fromEntries([["views", 5]]), Dict.upsert("likes", increment)); // { views: 5, likes: 1 }
	 * ```
	 */
	export const upsert = <K, V>(key: K, f: (existing: Maybe<V>) => V) => (m: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
		const result = new globalThis.Map(m);
		result.set(key, f(lookup(key)(m)));
		return result;
	};

	// ---------------------------------------------------------------------------
	// Transform
	// ---------------------------------------------------------------------------

	/**
	 * Transforms each value in the dictionary.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.fromEntries([["a", 1], ["b", 2]]), Dict.map(n => n * 2));
	 * // ReadonlyMap { "a" => 2, "b" => 4 }
	 * ```
	 */
	export const map = <A, B>(f: (a: A) => B) => <K>(m: ReadonlyMap<K, A>): ReadonlyMap<K, B> => {
		const result = new globalThis.Map<K, B>();
		for (const [k, v] of m) {
			result.set(k, f(v));
		}
		return result;
	};

	/**
	 * Transforms each value in the dictionary, also receiving the key.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.fromEntries([["a", 1], ["b", 2]]), Dict.mapWithKey((k, v) => `${k}:${v}`));
	 * // ReadonlyMap { "a" => "a:1", "b" => "b:2" }
	 * ```
	 */
	export const mapWithKey = <K, A, B>(f: (key: K, a: A) => B) => (m: ReadonlyMap<K, A>): ReadonlyMap<K, B> => {
		const result = new globalThis.Map<K, B>();
		for (const [k, v] of m) {
			result.set(k, f(k, v));
		}
		return result;
	};

	/**
	 * Returns a new dictionary containing only the entries for which the predicate returns `true`.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.fromEntries([["a", 1], ["b", 3], ["c", 0]]), Dict.filter(n => n > 0));
	 * // ReadonlyMap { "a" => 1, "b" => 3 }
	 * ```
	 */
	export const filter = <A>(predicate: (a: A) => boolean) => <K>(m: ReadonlyMap<K, A>): ReadonlyMap<K, A> => {
		const result = new globalThis.Map<K, A>();
		for (const [k, v] of m) {
			if (predicate(v)) result.set(k, v);
		}
		return result;
	};

	/**
	 * Returns a new dictionary containing only the entries for which the predicate returns `true`.
	 * The predicate also receives the key.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.fromEntries([["a", 1], ["b", 2]]), Dict.filterWithKey((k, v) => k !== "a" && v > 0));
	 * // ReadonlyMap { "b" => 2 }
	 * ```
	 */
	export const filterWithKey =
		<K, A>(predicate: (key: K, a: A) => boolean) => (m: ReadonlyMap<K, A>): ReadonlyMap<K, A> => {
			const result = new globalThis.Map<K, A>();
			for (const [k, v] of m) {
				if (predicate(k, v)) result.set(k, v);
			}
			return result;
		};

	/**
	 * Removes all `None` values from a `ReadonlyMap<K, Maybe<A>>`, returning a plain
	 * `ReadonlyMap<K, A>`. Useful when building dictionaries from fallible lookups.
	 *
	 * @example
	 * ```ts
	 * import { Maybe } from "@nlozgachev/pipelined/core";
	 *
	 * Dict.compact(Dict.fromEntries([
	 *   ["a", Maybe.some(1)],
	 *   ["b", Maybe.none()],
	 *   ["c", Maybe.some(3)],
	 * ]));
	 * // ReadonlyMap { "a" => 1, "c" => 3 }
	 * ```
	 */
	export const compact = <K, A>(m: ReadonlyMap<K, Maybe<A>>): ReadonlyMap<K, A> => {
		const result = new globalThis.Map<K, A>();
		for (const [k, v] of m) {
			if (v.kind === "Some") result.set(k, v.value);
		}
		return result;
	};

	// ---------------------------------------------------------------------------
	// Combine
	// ---------------------------------------------------------------------------

	/**
	 * Merges two dictionaries. When both contain the same key, the value from `other` takes
	 * precedence.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Dict.fromEntries([["a", 1], ["b", 2]]),
	 *   Dict.union(Dict.fromEntries([["b", 3], ["c", 4]])),
	 * );
	 * // ReadonlyMap { "a" => 1, "b" => 3, "c" => 4 }
	 * ```
	 */
	export const union = <K, V>(other: ReadonlyMap<K, V>) => (m: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
		const result = new globalThis.Map(m);
		for (const [k, v] of other) {
			result.set(k, v);
		}
		return result;
	};

	/**
	 * Returns a new dictionary containing only the entries whose keys appear in both dictionaries.
	 * Values are taken from the left (base) dictionary.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]]),
	 *   Dict.intersection(Dict.fromEntries([["b", 99], ["c", 0]])),
	 * );
	 * // ReadonlyMap { "b" => 2, "c" => 3 }
	 * ```
	 */
	export const intersection = <K, V>(other: ReadonlyMap<K, unknown>) => (m: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
		const result = new globalThis.Map<K, V>();
		for (const [k, v] of m) {
			if (other.has(k)) result.set(k, v);
		}
		return result;
	};

	/**
	 * Returns a new dictionary containing only the entries whose keys do not appear in `other`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]]),
	 *   Dict.difference(Dict.fromEntries([["b", 0]])),
	 * );
	 * // ReadonlyMap { "a" => 1, "c" => 3 }
	 * ```
	 */
	export const difference = <K, V>(other: ReadonlyMap<K, unknown>) => (m: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
		const result = new globalThis.Map<K, V>();
		for (const [k, v] of m) {
			if (!other.has(k)) result.set(k, v);
		}
		return result;
	};

	// ---------------------------------------------------------------------------
	// Fold
	// ---------------------------------------------------------------------------

	/**
	 * Folds the dictionary into a single value by applying `f` to each value in insertion order.
	 * When you also need the key, use `reduceWithKey`.
	 *
	 * @example
	 * ```ts
	 * Dict.reduce(0, (acc, value) => acc + value)(
	 *   Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]])
	 * ); // 6
	 * ```
	 */
	export const reduce = <A, B>(init: B, f: (acc: B, value: A) => B) => <K>(m: ReadonlyMap<K, A>): B => {
		let acc = init;
		for (const v of m.values()) {
			acc = f(acc, v);
		}
		return acc;
	};

	/**
	 * Folds the dictionary into a single value by applying `f` to each key-value pair in insertion
	 * order.
	 *
	 * @example
	 * ```ts
	 * Dict.reduceWithKey("", (acc, value, key) => acc + key + ":" + value + " ")(
	 *   Dict.fromEntries([["a", 1], ["b", 2]])
	 * ); // "a:1 b:2 "
	 * ```
	 */
	export const reduceWithKey = <K, A, B>(init: B, f: (acc: B, value: A, key: K) => B) => (m: ReadonlyMap<K, A>): B => {
		let acc = init;
		for (const [k, v] of m) {
			acc = f(acc, v, k);
		}
		return acc;
	};

	// ---------------------------------------------------------------------------
	// Convert
	// ---------------------------------------------------------------------------

	/**
	 * Converts a `ReadonlyMap<string, V>` to a plain object. Only meaningful when keys are strings.
	 *
	 * @example
	 * ```ts
	 * Dict.toRecord(Dict.fromEntries([["a", 1], ["b", 2]])); // { a: 1, b: 2 }
	 * ```
	 */
	export const toRecord = <V>(m: ReadonlyMap<string, V>): Readonly<Record<string, V>> => Object.fromEntries(m);
}
