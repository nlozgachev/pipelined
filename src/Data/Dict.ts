// =============================================================================
// Imports
// =============================================================================
import { Maybe } from "../Core/Maybe.ts";
import { type NonEmpty as InternalNonEmpty, type NonEmptyArr } from "../internal/InternalTypes";
import type { Brand } from "../Types/Brand.ts";

// =============================================================================
// Types
// =============================================================================
/**
 * A branded type representing a key-value dictionary with at least one entry.
 */
type NonEmptyMap<K, V> = Brand<InternalNonEmpty<"Dict">, ReadonlyMap<K, V>>;

// =============================================================================
// Private Helpers & Combinator Implementations
// =============================================================================

const DictIs = {
	/**
	 * Returns `true` when the dictionary contains zero entries.
	 *
	 * @see {@link nonEmpty} for checking if a dictionary contains entries.
	 */
	empty: <K, V>(dict: ReadonlyMap<K, V>): boolean => dict.size === 0,

	/**
	 * Returns `true` when the dictionary contains at least one entry.
	 *
	 * @see {@link empty} for checking if a dictionary is empty.
	 */
	nonEmpty: <K, V>(dict: ReadonlyMap<K, V>): dict is NonEmptyMap<K, V> => dict.size > 0,
};

/**
 * Creates an empty dictionary.
 *
 * @example
 * ```ts
 * const dict = Dict.empty<string, number>(); // ReadonlyMap {}
 * ```
 */
const empty = <K, V>(): ReadonlyMap<K, V> => new globalThis.Map<K, V>();

/**
 * Creates a dictionary with a single key-value entry.
 *
 * @example
 * ```ts
 * Dict.singleton("key", 42); // ReadonlyMap { "key" => 42 }
 * ```
 */
const singleton = <K, V>(key: K, value: V): ReadonlyMap<K, V> => new globalThis.Map<K, V>([[key, value]]);

const DictFrom = {
	/**
	 * Creates a dictionary from an array of key-value tuples.
	 *
	 * @example
	 * ```ts
	 * Dict.from.entries([["a", 1], ["b", 2]]); // ReadonlyMap { "a" => 1, "b" => 2 }
	 * ```
	 */
	entries: <K, V>(entries: readonly (readonly [K, V])[]): ReadonlyMap<K, V> =>
		new globalThis.Map<K, V>(entries as (readonly [K, V])[]),

	/**
	 * Creates a dictionary from a plain record.
	 *
	 * @example
	 * ```ts
	 * Dict.from.record({ a: 1, b: 2 }); // ReadonlyMap { "a" => 1, "b" => 2 }
	 * ```
	 */
	record: <K extends string, V>(record: Readonly<Record<K, V>>): ReadonlyMap<K, V> =>
		new globalThis.Map<K, V>(Object.entries(record) as unknown as (readonly [K, V])[]),

	/**
	 * Lifts a nullable dictionary into a `Maybe`. Returns `None` if null or undefined.
	 *
	 * @example
	 * ```ts
	 * Dict.from.nullable(new Map([["a", 1]])); // Some(ReadonlyMap)
	 * Dict.from.nullable(null);                 // None
	 * ```
	 */
	nullable: <K, V>(dict: ReadonlyMap<K, V> | null | undefined): Maybe<ReadonlyMap<K, V>> =>
		dict === null || dict === undefined ? Maybe.make.none() : Maybe.make.some(dict),
};

const DictTo = {
	/**
	 * Converts a dictionary to a plain record.
	 * Protects against prototype pollution when keys equal `__proto__`.
	 *
	 * @example
	 * ```ts
	 * Dict.to.record(Dict.from.entries([["a", 1], ["b", 2]])); // { a: 1, b: 2 }
	 * ```
	 */
	record: <K extends string, V>(dict: ReadonlyMap<K, V>): Readonly<Record<K, V>> => {
		const result = {} as Record<K, V>;
		for (const [k, v] of dict) {
			if (k === "__proto__") {
				Object.defineProperty(result, k, { value: v, writable: true, enumerable: true, configurable: true });
			} else {
				result[k] = v;
			}
		}
		return result;
	},
};

/**
 * Groups elements of an array into a dictionary using a key selector function.
 * Each key maps to a non-empty array of items that produced it.
 *
 * @example
 * ```ts
 * pipe(["apple", "avocado", "banana"], Dict.groupBy(s => s[0]));
 * // ReadonlyMap { "a" => ["apple", "avocado"], "b" => ["banana"] }
 * ```
 */
const groupBy = <A, K>(keySelector: (item: A) => K) => (items: readonly A[]): ReadonlyMap<K, NonEmptyArr<A>> => {
	const result = new globalThis.Map<K, A[]>();
	for (const item of items) {
		const k = keySelector(item);
		const existing = result.get(k);
		if (existing !== undefined) {
			existing.push(item);
		} else {
			result.set(k, [item]);
		}
	}
	return result as unknown as ReadonlyMap<K, NonEmptyArr<A>>;
};

/**
 * Returns `true` when the dictionary contains the specified key.
 *
 * @see {@link lookup} for retrieving the value associated with a key.
 */
const has = <K>(key: K) => <V = unknown>(dict: ReadonlyMap<K, V>): boolean => dict.has(key);

/**
 * Retrieves the value associated with a key wrapped in a `Maybe`.
 *
 * @see {@link has} for checking key existence without retrieving the value.
 */
const lookup = <K>(key: K) => <V = unknown>(dict: ReadonlyMap<K, V>): Maybe<V> => {
	const val = dict.get(key);
	return val !== undefined || dict.has(key) ? Maybe.make.some(val as V) : Maybe.make.none();
};

/**
 * Returns the number of entries in the dictionary.
 *
 * @example
 * ```ts
 * Dict.size(Dict.singleton("a", 1)); // 1
 * ```
 */
const size = <K, V>(dict: ReadonlyMap<K, V>): number => dict.size;

/**
 * Returns all keys of a dictionary.
 *
 * @see {@link values} for extracting dictionary values.
 * @see {@link entries} for extracting key-value pairs.
 */
const keys = <K, V>(dict: ReadonlyMap<K, V>): readonly K[] => Array.from(dict.keys());

/**
 * Returns all values of a dictionary.
 *
 * @see {@link keys} for extracting dictionary keys.
 * @see {@link entries} for extracting key-value pairs.
 */
const values = <K, V>(dict: ReadonlyMap<K, V>): readonly V[] => Array.from(dict.values());

/**
 * Returns all key-value pairs of a dictionary.
 *
 * @see {@link keys} for extracting dictionary keys.
 * @see {@link values} for extracting dictionary values.
 */
const entries = <K, V>(dict: ReadonlyMap<K, V>): readonly (readonly [K, V])[] => Array.from(dict.entries());

/**
 * Returns a new dictionary with the key set to value.
 *
 * @see {@link remove} for deleting a key from a dictionary.
 * @see {@link upsert} for conditional insertion/update.
 */
const insert = <K, V>(key: K, value: V) => (dict: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
	const res = new globalThis.Map(dict);
	res.set(key, value);
	return res;
};

/**
 * Returns a new dictionary with the specified key removed.
 *
 * @see {@link insert} for adding or replacing a key in a dictionary.
 */
const remove = <K>(key: K) => <V = unknown>(dict: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
	if (!dict.has(key)) {
		return dict;
	}
	const res = new globalThis.Map(dict);
	res.delete(key);
	return res;
};

/**
 * Inserts or updates a key using a callback that receives the existing value if present.
 *
 * @see {@link insert} for unconditional key setting.
 */
const upsert = <K, V>(key: K, update: (existing: Maybe<V>) => V) => (dict: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
	const res = new globalThis.Map(dict);
	const existing = dict.has(key) ? Maybe.make.some(dict.get(key) as V) : Maybe.make.none();
	res.set(key, update(existing));
	return res;
};

/**
 * Transforms each value in the dictionary.
 *
 * @see {@link mapWithKey} for transforming values with key access.
 */
const map = <A, B>(transform: (value: A) => B) => <K = unknown>(dict: ReadonlyMap<K, A>): ReadonlyMap<K, B> => {
	const res = new globalThis.Map<K, B>();
	for (const [k, v] of dict) {
		res.set(k, transform(v));
	}
	return res;
};

/**
 * Transforms each value in the dictionary, also receiving the key.
 *
 * @see {@link map} for transforming values without key access.
 */
const mapWithKey = <K, A, B>(transform: (key: K, value: A) => B) => (dict: ReadonlyMap<K, A>): ReadonlyMap<K, B> => {
	const res = new globalThis.Map<K, B>();
	for (const [k, v] of dict) {
		res.set(k, transform(k, v));
	}
	return res;
};

/**
 * Filters dictionary entries by a predicate on values.
 *
 * @see {@link filterWithKey} for filtering with key access.
 */
const filter = <A>(predicate: (value: A) => boolean) => <K = unknown>(dict: ReadonlyMap<K, A>): ReadonlyMap<K, A> => {
	const res = new globalThis.Map<K, A>();
	for (const [k, v] of dict) {
		if (predicate(v)) {
			res.set(k, v);
		}
	}
	return res;
};

/**
 * Filters dictionary entries by a predicate that also receives the key.
 *
 * @see {@link filter} for filtering values without key access.
 */
const filterWithKey =
	<K, A>(predicate: (key: K, value: A) => boolean) => (dict: ReadonlyMap<K, A>): ReadonlyMap<K, A> => {
		const res = new globalThis.Map<K, A>();
		for (const [k, v] of dict) {
			if (predicate(k, v)) {
				res.set(k, v);
			}
		}
		return res;
	};

/**
 * Removes all `None` values from a dictionary, unwrapping `Some` values.
 */
const compact = <K, A>(dict: ReadonlyMap<K, Maybe<A>>): ReadonlyMap<K, A> => {
	const res = new globalThis.Map<K, A>();
	for (const [k, v] of dict) {
		if (v.kind === "Some") {
			res.set(k, v.value);
		}
	}
	return res;
};

/**
 * Transforms values with a function returning `Maybe`, keeping only `Some` values.
 *
 * @see {@link filter} for filtering without transformation.
 */
const filterMap =
	<A, B>(transform: (value: A) => Maybe<B>) => <K = unknown>(dict: ReadonlyMap<K, A>): ReadonlyMap<K, B> => {
		const res = new globalThis.Map<K, B>();
		for (const [k, v] of dict) {
			const mb = transform(v);
			if (mb.kind === "Some") {
				res.set(k, mb.value);
			}
		}
		return res;
	};

/**
 * Combines two dictionaries, preferring entries from `other` on key collisions.
 *
 * @see {@link intersection} for keeping only common keys.
 * @see {@link difference} for removing keys present in the other dictionary.
 */
const union = <K, V>(other: ReadonlyMap<K, V>) => (dict: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
	if (dict.size === 0) {
		return other;
	}
	if (other.size === 0) {
		return dict;
	}
	const res = new globalThis.Map(dict);
	for (const [k, v] of other) {
		res.set(k, v);
	}
	return res;
};

/**
 * Returns a new dictionary containing only keys present in both dictionaries.
 *
 * @see {@link union} for combining all keys from both dictionaries.
 * @see {@link difference} for subtracting keys.
 */
const intersection = <K, V>(other: ReadonlyMap<K, V>) => (dict: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
	const res = new globalThis.Map<K, V>();
	for (const [k, v] of dict) {
		if (other.has(k)) {
			res.set(k, v);
		}
	}
	return res;
};

/**
 * Returns a new dictionary containing keys from `dict` that are not in `other`.
 *
 * @see {@link union} for combining all keys.
 * @see {@link intersection} for keeping only common keys.
 */
const difference = <K, V>(other: ReadonlyMap<K, V>) => (dict: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
	if (other.size === 0) {
		return dict;
	}
	const res = new globalThis.Map<K, V>();
	for (const [k, v] of dict) {
		if (!other.has(k)) {
			res.set(k, v);
		}
	}
	return res;
};

/**
 * Reduces dictionary values from an initial value.
 *
 * @example
 * ```ts
 * pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.reduce(0, (acc, n) => acc + n)); // 3
 * ```
 */
const reduce =
	<B, V>(initial: B, reducer: (accumulator: B, value: V) => B) => <K = unknown>(dict: ReadonlyMap<K, V>): B => {
		let acc = initial;
		for (const [, v] of dict) {
			acc = reducer(acc, v);
		}
		return acc;
	};

/**
 * Reduces dictionary entries from an initial value, passing value and key to the reducer.
 *
 * @example
 * ```ts
 * pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.reduceWithKey("", (acc, v, k) => `${acc}${k}${v}`)); // "a1b2"
 * ```
 */
const reduceWithKey =
	<B, K, V>(initial: B, reducer: (accumulator: B, value: V, key: K) => B) => (dict: ReadonlyMap<K, V>): B => {
		let acc = initial;
		for (const [k, v] of dict) {
			acc = reducer(acc, v, k);
		}
		return acc;
	};

/**
 * Merges two dictionaries using a combination function on collisions.
 * Supports both uncurried `(first, second)` and curried `(second)(first)` invocation.
 *
 * @example
 * ```ts
 * const mergeAdd = Dict.mergeWith((a: number, b: number) => a + b);
 * const d1 = Dict.from.entries([["a", 1], ["b", 2]]);
 * const d2 = Dict.from.entries([["b", 3], ["c", 4]]);
 * mergeAdd(d1, d2); // ReadonlyMap { "a" => 1, "b" => 5, "c" => 4 }
 * pipe(d1, mergeAdd(d2)); // ReadonlyMap { "a" => 1, "b" => 5, "c" => 4 }
 * ```
 */
function mergeWith<V>(
	combine: (first: V, second: V) => V,
): {
	<K>(first: ReadonlyMap<K, V>, second: ReadonlyMap<K, V>): ReadonlyMap<K, V>;
	<K>(second: ReadonlyMap<K, V>): (first: ReadonlyMap<K, V>) => ReadonlyMap<K, V>;
} {
	return (<K>(arg1: ReadonlyMap<K, V>, arg2?: ReadonlyMap<K, V>) => {
		if (arg2 !== undefined) {
			const res = new globalThis.Map<K, V>(arg1);
			for (const [k, v] of arg2) {
				const existing = res.get(k);
				res.set(k, res.has(k) ? combine(existing as V, v) : v);
			}
			return res;
		}
		return (first: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
			const second = arg1;
			const res = new globalThis.Map<K, V>(first);
			for (const [k, v] of second) {
				const existing = res.get(k);
				res.set(k, res.has(k) ? combine(existing as V, v) : v);
			}
			return res;
		};
	}) as {
		<K>(first: ReadonlyMap<K, V>, second: ReadonlyMap<K, V>): ReadonlyMap<K, V>;
		<K>(second: ReadonlyMap<K, V>): (first: ReadonlyMap<K, V>) => ReadonlyMap<K, V>;
	};
}

/**
 * Transforms key and value pairs simultaneously into a new dictionary.
 *
 * @example
 * ```ts
 * pipe(
 *   Dict.from.entries([["a", 1]]),
 *   Dict.mapEntries((k, v) => [k.toUpperCase(), v * 10])
 * ); // ReadonlyMap { "A" => 10 }
 * ```
 */
const mapEntries =
	<K1, V1, K2, V2>(transform: (key: K1, value: V1) => readonly [K2, V2]) =>
	(dict: ReadonlyMap<K1, V1>): ReadonlyMap<K2, V2> => {
		const res = new globalThis.Map<K2, V2>();
		for (const [k, v] of dict) {
			const [nk, nv] = transform(k, v);
			res.set(nk, nv);
		}
		return res;
	};

/**
 * Transforms dictionary keys while preserving values.
 *
 * @example
 * ```ts
 * pipe(
 *   Dict.from.entries([["a", 1]]),
 *   Dict.mapKeys(k => k.toUpperCase())
 * ); // ReadonlyMap { "A" => 1 }
 * ```
 */
const mapKeys = <K1, K2, V>(transform: (key: K1) => K2) => (dict: ReadonlyMap<K1, V>): ReadonlyMap<K2, V> => {
	const res = new globalThis.Map<K2, V>();
	for (const [k, v] of dict) {
		res.set(transform(k), v);
	}
	return res;
};

// --- NonEmpty helpers ---
const _nonEmptySingleton = <K, V>(key: K, value: V): NonEmptyMap<K, V> =>
	new globalThis.Map([[key, value]]) as unknown as NonEmptyMap<K, V>;

const _nonEmptyFromMap = <K, V>(dict: ReadonlyMap<K, V>): Maybe<NonEmptyMap<K, V>> =>
	dict.size > 0 ? Maybe.make.some(dict as NonEmptyMap<K, V>) : Maybe.make.none();

const _nonEmptyKeys = <K, V>(dict: NonEmptyMap<K, V>): NonEmptyArr<K> => keys(dict) as unknown as NonEmptyArr<K>;

const _nonEmptyValues = <K, V>(dict: NonEmptyMap<K, V>): NonEmptyArr<V> => values(dict) as unknown as NonEmptyArr<V>;

const _nonEmptyEntries = <K, V>(dict: NonEmptyMap<K, V>): NonEmptyArr<readonly [K, V]> =>
	entries(dict) as unknown as NonEmptyArr<readonly [K, V]>;

const _nonEmptyReduce = <V>(reducer: (accumulator: V, value: V) => V) => <K>(dict: NonEmptyMap<K, V>): V => {
	const vals = Array.from(dict.values());
	let [acc] = vals;
	for (let i = 1; i < vals.length; i++) {
		acc = reducer(acc, vals[i]);
	}
	return acc;
};

const _nonEmptyMap = <A, B>(transform: (value: A) => B) => <K>(dict: NonEmptyMap<K, A>): NonEmptyMap<K, B> =>
	map(transform)(dict) as unknown as NonEmptyMap<K, B>;

const _nonEmptyMapWithKey =
	<K, A, B>(transform: (key: K, value: A) => B) => (dict: NonEmptyMap<K, A>): NonEmptyMap<K, B> =>
		mapWithKey(transform)(dict) as unknown as NonEmptyMap<K, B>;

const DictNonEmptyConst = {
	/**
	 * Creates a NonEmptyMap containing a single entry.
	 *
	 * @example
	 * ```ts
	 * Dict.NonEmpty.singleton("a", 1); // NonEmptyMap { "a" => 1 }
	 * ```
	 */
	singleton: _nonEmptySingleton,

	from: {
		/**
		 * Refines a standard Map to a NonEmptyMap, returning `Some` if size > 0, `None` otherwise.
		 *
		 * @example
		 * ```ts
		 * Dict.NonEmpty.from.map(new Map([["a", 1]])); // Some(NonEmptyMap)
		 * Dict.NonEmpty.from.map(new Map());           // None
		 * ```
		 */
		map: _nonEmptyFromMap,
	},

	/**
	 * Returns all keys of a non-empty dictionary as a NonEmptyArr.
	 *
	 * @example
	 * ```ts
	 * Dict.NonEmpty.keys(Dict.NonEmpty.singleton("a", 1)); // ["a"]
	 * ```
	 */
	keys: _nonEmptyKeys,

	/**
	 * Returns all values of a non-empty dictionary as a NonEmptyArr.
	 *
	 * @example
	 * ```ts
	 * Dict.NonEmpty.values(Dict.NonEmpty.singleton("a", 1)); // [1]
	 * ```
	 */
	values: _nonEmptyValues,

	/**
	 * Returns all entries of a non-empty dictionary as a NonEmptyArr.
	 *
	 * @example
	 * ```ts
	 * Dict.NonEmpty.entries(Dict.NonEmpty.singleton("a", 1)); // [["a", 1]]
	 * ```
	 */
	entries: _nonEmptyEntries,

	/**
	 * Reduces values of a non-empty dictionary using the first value as initial accumulator.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.NonEmpty.singleton("a", 5), Dict.NonEmpty.reduce((a, b) => a + b)); // 5
	 * ```
	 */
	reduce: _nonEmptyReduce,

	/**
	 * Transforms each value of a non-empty dictionary, preserving non-emptiness.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.NonEmpty.singleton("a", 1), Dict.NonEmpty.map(n => n * 2)); // NonEmptyMap { "a" => 2 }
	 * ```
	 */
	map: _nonEmptyMap,

	/**
	 * Transforms each value with key access, preserving non-emptiness.
	 *
	 * @example
	 * ```ts
	 * pipe(Dict.NonEmpty.singleton("a", 1), Dict.NonEmpty.mapWithKey((k, v) => `${k}:${v}`));
	 * // NonEmptyMap { "a" => "a:1" }
	 * ```
	 */
	mapWithKey: _nonEmptyMapWithKey,
};

// =============================================================================
// Public Export
// =============================================================================
export const Dict = {
	is: DictIs,
	empty,
	singleton,
	from: DictFrom,
	to: DictTo,
	groupBy,
	has,
	lookup,
	size,
	keys,
	values,
	entries,
	insert,
	remove,
	upsert,
	map,
	mapWithKey,
	filter,
	filterWithKey,
	compact,
	filterMap,
	union,
	intersection,
	difference,
	reduce,
	reduceWithKey,
	mergeWith,
	mapEntries,
	mapKeys,
	/**
	 * Utilities for working with guaranteed non-empty dictionaries (`NonEmptyMap`).
	 */
	NonEmpty: DictNonEmptyConst,
};

export namespace Dict {
	/**
	 * A branded type representing a key-value dictionary with at least one entry.
	 */
	export type NonEmpty<K, V> = NonEmptyMap<K, V>;
}
