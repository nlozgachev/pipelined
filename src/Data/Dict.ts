/* eslint-disable no-use-before-define, no-shadow */
import { Maybe } from "#core";
import { type NonEmpty, type NonEmptyArr } from "#internal";
import type { Brand } from "#types";

/**
 * A branded type representing a key-value dictionary with at least one entry.
 */
export type NonEmptyMap<K, V> = Brand<NonEmpty<"Dict">, ReadonlyMap<K, V>>;

/**
 * Functional utilities for key-value dictionaries (`ReadonlyMap<K, V>`). All functions are pure
 * and data-last — they compose naturally with `pipe`.
 *
 * Unlike plain objects (`Rec`), dictionaries support any key type, preserve insertion order, and
 * make membership checks explicit via `lookup` returning `Maybe`.
 *
 * @example
 * ```ts
 * import { Dict } from "@nlozgachev/pipelined/data";
 * import { pipe } from "@nlozgachev/pipelined/composition";
 *
 * const scores = pipe(
 *   Dict.from.entries([["alice", 10], ["bob", 8], ["carol", 10]] as const),
 *   Dict.filter(n => n >= 10),
 *   Dict.map(n => `${n} points`),
 * );
 * // ReadonlyMap { "alice" => "10 points", "carol" => "10 points" }
 * ```
 */
namespace DictNonEmpty {
	/**
	 * Creates a NonEmptyMap containing a single key-value entry.
	 *
	 * @example
	 * ```ts
	 * Dict.NonEmpty.singleton("name", "Alice"); // ReadonlyMap { "name" => "Alice" }
	 * ```
	 */
	export const singleton = <K, V>(key: K, value: V): NonEmptyMap<K, V> =>
		new globalThis.Map([[key, value]]) as unknown as NonEmptyMap<K, V>;

	// --- from ---
	export namespace from {
		/**
		 * Returns Some containing NonEmptyMap if the map is not empty, None otherwise.
		 *
		 * @example
		 * ```ts
		 * Dict.NonEmpty.from.Map(Dict.from.entries([["a", 1]])); // Some(ReadonlyMap { "a" => 1 })
		 * Dict.NonEmpty.from.Map(Dict.empty());                 // None
		 * ```
		 */
		export const Map = <K, V>(m: ReadonlyMap<K, V>): Maybe<NonEmptyMap<K, V>> =>
			m.size > 0 ? Maybe.make.some(m as NonEmptyMap<K, V>) : Maybe.make.none();
	}

	/**
	 * Returns a non-empty array of keys, in insertion order.
	 *
	 * @example
	 * ```ts
	 * Dict.NonEmpty.keys(Dict.NonEmpty.singleton("a", 1)); // ["a"]
	 * ```
	 */
	export const keys = <K, V>(m: NonEmptyMap<K, V>): NonEmptyArr<K> => Dict.keys(m) as unknown as NonEmptyArr<K>;

	/**
	 * Returns a non-empty array of values, in insertion order.
	 *
	 * @example
	 * ```ts
	 * Dict.NonEmpty.values(Dict.NonEmpty.singleton("a", 1)); // [1]
	 * ```
	 */
	export const values = <K, V>(m: NonEmptyMap<K, V>): NonEmptyArr<V> => Dict.values(m) as unknown as NonEmptyArr<V>;

	/**
	 * Returns a non-empty array of entry tuples, in insertion order.
	 *
	 * @example
	 * ```ts
	 * Dict.NonEmpty.entries(Dict.NonEmpty.singleton("a", 1)); // [["a", 1]]
	 * ```
	 */
	export const entries = <K, V>(m: NonEmptyMap<K, V>): NonEmptyArr<readonly [K, V]> =>
		Dict.entries(m) as unknown as NonEmptyArr<readonly [K, V]>;

	/**
	 * Reduces a NonEmptyMap's values from the left without an initial seed value.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.NonEmpty.singleton("a", 1), Dict.NonEmpty.reduce((a, b) => a + b)); // 1
	 * ```
	 */
	export const reduce = <V>(f: (acc: V, value: V) => V) => <K>(m: NonEmptyMap<K, V>): V => values(m).reduce(f);

	/**
	 * Transforms each value in the non-empty dictionary.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.NonEmpty.singleton("a", 1), Dict.NonEmpty.map(n => n * 2));
	 * // ReadonlyMap { "a" => 2 }
	 * ```
	 */
	export const map = <A, B>(f: (a: A) => B) => <K>(m: NonEmptyMap<K, A>): NonEmptyMap<K, B> =>
		Dict.map(f)(m) as unknown as NonEmptyMap<K, B>;

	/**
	 * Transforms each value in the non-empty dictionary, also receiving the key.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.NonEmpty.singleton("a", 1), Dict.NonEmpty.mapWithKey((k, v) => `${k}:${v}`));
	 * // ReadonlyMap { "a" => "a:1" }
	 * ```
	 */
	export const mapWithKey = <K, A, B>(f: (key: K, a: A) => B) => (m: NonEmptyMap<K, A>): NonEmptyMap<K, B> =>
		Dict.mapWithKey(f)(m) as unknown as NonEmptyMap<K, B>;
}

export namespace Dict {
	/**
	 * A branded type representing a key-value dictionary with at least one entry.
	 */
	export type NonEmpty<K, V> = NonEmptyMap<K, V>;

	export namespace is {
		/**
		 * Returns `true` if the dictionary has no entries.
		 *
		 * @example
		 * ```ts
		 * Dict.is.empty(Dict.empty()); // true
		 * ```
		 */
		export const empty = <K, V>(m: ReadonlyMap<K, V>): boolean => m.size === 0;

		/**
		 * Type guard to check if a dictionary is non-empty.
		 *
		 * @example
		 * ```ts
		 * Dict.is.nonEmpty(Dict.from.entries([["a", 1]])); // true
		 * Dict.is.nonEmpty(Dict.empty());                 // false
		 * ```
		 */
		export const nonEmpty = <K, V>(m: ReadonlyMap<K, V>): m is NonEmpty<K, V> => m.size > 0;
	}

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

	// --- from ---
	export namespace from {
		/**
		 * Creates a dictionary from an array of key-value pairs.
		 *
		 * @example
		 * ```ts
		 * Dict.from.entries([["a", 1], ["b", 2]]); // ReadonlyMap { "a" => 1, "b" => 2 }
		 * ```
		 */
		export const entries = <K, V>(entries: readonly (readonly [K, V])[]): ReadonlyMap<K, V> =>
			new globalThis.Map(entries as [K, V][]);

		/**
		 * Creates a dictionary from a plain object. Keys are always strings.
		 *
		 * @example
		 * ```ts
		 * Dict.from.Record({ a: 1, b: 2 }); // ReadonlyMap { "a" => 1, "b" => 2 }
		 * ```
		 */
		export const Record = <V>(rec: Readonly<Record<string, V>>): ReadonlyMap<string, V> =>
			new globalThis.Map(Object.entries(rec));
	}

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
			if (arr !== undefined) { arr.push(item); }
			else { result.set(key, [item]); }
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
	 * pipe(Dict.from.entries([["a", 1]]), Dict.has("a")); // true
	 * pipe(Dict.from.entries([["a", 1]]), Dict.has("b")); // false
	 * ```
	 */
	export const has = <K>(key: K) => <V>(m: ReadonlyMap<K, V>): boolean => m.has(key);

	/**
	 * Looks up a value by key, returning `Some(value)` if found and `None` if not.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.from.entries([["a", 1]]), Dict.lookup("a")); // Some(1)
	 * pipe(Dict.from.entries([["a", 1]]), Dict.lookup("b")); // None
	 * ```
	 */
	export const lookup = <K>(key: K) => <V>(m: ReadonlyMap<K, V>): Maybe<V> =>
		m.has(key) ? Maybe.make.some(m.get(key) as V) : Maybe.make.none();

	/**
	 * Returns the number of entries in the dictionary.
	 *
	 * @example
	 * ```ts
	 * Dict.size(Dict.from.entries([["a", 1], ["b", 2]])); // 2
	 * ```
	 */
	export const size = <K, V>(m: ReadonlyMap<K, V>): number => m.size;

	/**
	 * Returns all keys as a readonly array, in insertion order.
	 *
	 * @example
	 * ```ts
	 * Dict.keys(Dict.from.entries([["a", 1], ["b", 2]])); // ["a", "b"]
	 * ```
	 */
	export const keys = <K, V>(m: ReadonlyMap<K, V>): readonly K[] => [...m.keys()];

	/**
	 * Returns all values as a readonly array, in insertion order.
	 *
	 * @example
	 * ```ts
	 * Dict.values(Dict.from.entries([["a", 1], ["b", 2]])); // [1, 2]
	 * ```
	 */
	export const values = <K, V>(m: ReadonlyMap<K, V>): readonly V[] => [...m.values()];

	/**
	 * Returns all key-value pairs as a readonly array of tuples, in insertion order.
	 *
	 * @example
	 * ```ts
	 * Dict.entries(Dict.from.entries([["a", 1], ["b", 2]])); // [["a", 1], ["b", 2]]
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
	 * pipe(Dict.from.entries([["a", 1]]), Dict.insert("b", 2));
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
	 * pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.remove("a"));
	 * // ReadonlyMap { "b" => 2 }
	 * ```
	 */
	export const remove = <K, V>(key: K) => (m: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
		if (!m.has(key)) { return m; }
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
	 * const increment = (opt: Maybe<number>) => pipe(opt, Maybe.getOrElse(() => 0)) + 1;
	 * pipe(Dict.from.entries([["views", 5]]), Dict.upsert("views", increment)); // { views: 6 }
	 * pipe(Dict.from.entries([["views", 5]]), Dict.upsert("likes", increment)); // { views: 5, likes: 1 }
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
	 * pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.map(n => n * 2));
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
	 * pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.mapWithKey((k, v) => `${k}:${v}`));
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
	 * pipe(Dict.from.entries([["a", 1], ["b", 3], ["c", 0]]), Dict.filter(n => n > 0));
	 * // ReadonlyMap { "a" => 1, "b" => 3 }
	 * ```
	 */
	export const filter = <A>(predicate: (a: A) => boolean) => <K>(m: ReadonlyMap<K, A>): ReadonlyMap<K, A> => {
		const result = new globalThis.Map<K, A>();
		for (const [k, v] of m) {
			if (predicate(v)) { result.set(k, v); }
		}
		return result;
	};

	/**
	 * Returns a new dictionary containing only the entries for which the predicate returns `true`.
	 * The predicate also receives the key.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.filterWithKey((k, v) => k !== "a" && v > 0));
	 * // ReadonlyMap { "b" => 2 }
	 * ```
	 */
	export const filterWithKey =
		<K, A>(predicate: (key: K, a: A) => boolean) => (m: ReadonlyMap<K, A>): ReadonlyMap<K, A> => {
			const result = new globalThis.Map<K, A>();
			for (const [k, v] of m) {
				if (predicate(k, v)) { result.set(k, v); }
			}
			return result;
		};

	/**
	 * Removes all `None` values from a `ReadonlyMap<K, Maybe<A>>`, returning a plain
	 * `ReadonlyMap<K, A>`. Useful when building dictionaries from fallible lookups.
	 *
	 * @example
	 * ```ts
	 * Dict.compact(Dict.from.entries<string, Maybe<number>>([
	 *   ["a", Maybe.make.some(1)],
	 *   ["b", Maybe.make.none()],
	 *   ["c", Maybe.make.some(3)],
	 * ]));
	 * // ReadonlyMap { "a" => 1, "c" => 3 }
	 * ```
	 */
	export const compact = <K, A>(m: ReadonlyMap<K, Maybe<A>>): ReadonlyMap<K, A> => {
		const result = new globalThis.Map<K, A>();
		for (const [k, v] of m) {
			if (v.kind === "Some") { result.set(k, v.value); }
		}
		return result;
	};

	/**
	 * Applies `f` to each value. Entries where `f` returns `None` are removed; entries where
	 * `f` returns `Some` are kept with the unwrapped value. Combines map and filter in one pass.
	 *
	 * @example
	 * ```ts
	 * const parse = (s: string): Maybe<number> => {
	 *     const n = Number(s);
	 *     return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	 * };
	 * Dict.filterMap(parse)(Dict.from.Record({ a: "1", b: "two", c: "3" }));
	 * // ReadonlyMap { "a" => 1, "c" => 3 }
	 * ```
	 */
	export const filterMap = <A, B>(f: (a: A) => Maybe<B>) => <K>(m: ReadonlyMap<K, A>): ReadonlyMap<K, B> => {
		const result = new globalThis.Map<K, B>();
		for (const [key, value] of m) {
			const mapped = f(value);
			if (mapped.kind === "Some") { result.set(key, mapped.value); }
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
	 *   Dict.from.entries([["a", 1], ["b", 2]]),
	 *   Dict.union(Dict.from.entries([["b", 3], ["c", 4]])),
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
	 *   Dict.from.entries([["a", 1], ["b", 2], ["c", 3]]),
	 *   Dict.intersection(Dict.from.entries([["b", 99], ["c", 0]])),
	 * );
	 * // ReadonlyMap { "b" => 2, "c" => 3 }
	 * ```
	 */
	export const intersection = <K, V>(other: ReadonlyMap<K, unknown>) => (m: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
		const result = new globalThis.Map<K, V>();
		for (const [k, v] of m) {
			if (other.has(k)) { result.set(k, v); }
		}
		return result;
	};

	/**
	 * Returns a new dictionary containing only the entries whose keys do not appear in `other`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Dict.from.entries([["a", 1], ["b", 2], ["c", 3]]),
	 *   Dict.difference(Dict.from.entries([["b", 0]])),
	 * );
	 * // ReadonlyMap { "a" => 1, "c" => 3 }
	 * ```
	 */
	export const difference = <K, V>(other: ReadonlyMap<K, unknown>) => (m: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
		const result = new globalThis.Map<K, V>();
		for (const [k, v] of m) {
			if (!other.has(k)) { result.set(k, v); }
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
	 * Dict.reduce(0, (acc, value: number) => acc + value)(
	 *   Dict.from.entries([["a", 1], ["b", 2], ["c", 3]])
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
	 *   Dict.from.entries([["a", 1], ["b", 2]])
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

	/**
	 * Merges two maps using a custom combination function on key collisions.
	 * Supports both uncurried `Dict.mergeWith(combine)(first, second)` and curried `pipe(first, Dict.mergeWith(combine)(second))`.
	 *
	 * @example
	 * ```ts
	 * const combineStats = Dict.mergeWith((a: number, b: number) => a + b);
	 * const map1 = Dict.from.entries([["a", 1], ["b", 2]]);
	 * const map2 = Dict.from.entries([["b", 3], ["c", 4]]);
	 * combineStats(map1, map2);
	 * pipe(map1, combineStats(map2));
	 * ```
	 */
	export function mergeWith<K, V>(
		combine: (a: V, b: V) => V,
	): {
		(second: ReadonlyMap<K, V>): (first: ReadonlyMap<K, V>) => ReadonlyMap<K, V>;
		(first: ReadonlyMap<K, V>, second: ReadonlyMap<K, V>): ReadonlyMap<K, V>;
	};
	export function mergeWith<K, V>(
		combine: (a: V, b: V) => V,
	): (arg1: ReadonlyMap<K, V>, arg2?: ReadonlyMap<K, V>) => any {
		return (arg1: ReadonlyMap<K, V>, arg2?: ReadonlyMap<K, V>): any => {
			if (arg2 !== undefined) {
				const first = arg1;
				const second = arg2;
				const res = new globalThis.Map<K, V>(first);
				for (const [k, v] of second) {
					if (res.has(k)) {
						res.set(k, combine(res.get(k)!, v));
					} else {
						res.set(k, v);
					}
				}
				return res;
			}
			const second = arg1;
			return (first: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
				const res = new globalThis.Map<K, V>(first);
				for (const [k, v] of second) {
					if (res.has(k)) {
						res.set(k, combine(res.get(k)!, v));
					} else {
						res.set(k, v);
					}
				}
				return res;
			};
		};
	}

	// ---------------------------------------------------------------------------
	// Convert
	// ---------------------------------------------------------------------------

	// --- to ---
	export namespace to {
		/**
		 * Converts a `ReadonlyMap<string, V>` to a plain object. Only meaningful when keys are strings.
		 *
		 * @example
		 * ```ts
		 * Dict.to.Record(Dict.from.entries([["a", 1], ["b", 2]])); // { a: 1, b: 2 }
		 * ```
		 */
		export const Record = <V>(m: ReadonlyMap<string, V>): Readonly<Record<string, V>> => Object.fromEntries(m);
	}

	/**
	 * Transforms key and value pairs simultaneously into a new ReadonlyMap.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Dict.from.entries([["a", 1], ["b", 2]]),
	 *   Dict.mapEntries((k, v) => [k.toUpperCase(), v * 10])
	 * ); // Map { "A" => 10, "B" => 20 }
	 * ```
	 */
	export const mapEntries =
		<K1, V1, K2, V2>(f: (key: K1, value: V1) => readonly [K2, V2]) => (
			data: ReadonlyMap<K1, V1>,
		): ReadonlyMap<K2, V2> => {
			const res = new globalThis.Map<K2, V2>();
			for (const [k, v] of data) {
				const [nk, nv] = f(k, v);
				res.set(nk, nv);
			}
			return res;
		};

	/**
	 * Transforms keys of a ReadonlyMap while preserving values.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Dict.from.entries([["a", 1], ["b", 2]]),
	 *   Dict.mapKeys((k) => k.toUpperCase())
	 * ); // Map { "A" => 1, "B" => 2 }
	 * ```
	 */
	export const mapKeys = <K1, K2, V>(f: (key: K1) => K2) => (data: ReadonlyMap<K1, V>): ReadonlyMap<K2, V> => {
		const res = new globalThis.Map<K2, V>();
		for (const [k, v] of data) {
			res.set(f(k), v);
		}
		return res;
	};

	export const NonEmpty = DictNonEmpty;
}
