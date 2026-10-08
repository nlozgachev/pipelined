// =============================================================================
// Imports
// =============================================================================
import { Maybe } from "#core";
import { type NonEmpty as InternalNonEmpty, type NonEmptyArr } from "#internal";
import type { Brand } from "#types";

// =============================================================================
// Types
// =============================================================================
/**
 * A branded type representing a key-value dictionary with at least one entry.
 */
export type NonEmptyMap<K, V> = Brand<InternalNonEmpty<"Dict">, ReadonlyMap<K, V>>;

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

const empty = <K, V>(): ReadonlyMap<K, V> => new globalThis.Map<K, V>();

const singleton = <K, V>(key: K, value: V): ReadonlyMap<K, V> => new globalThis.Map<K, V>([[key, value]]);

const DictFrom = {
	entries: <K, V>(entries: readonly (readonly [K, V])[]): ReadonlyMap<K, V> =>
		new globalThis.Map<K, V>(entries as (readonly [K, V])[]),

	record: <K extends string, V>(record: Readonly<Record<K, V>>): ReadonlyMap<K, V> =>
		new globalThis.Map<K, V>(Object.entries(record) as unknown as (readonly [K, V])[]),

	nullable: <K, V>(dict: ReadonlyMap<K, V> | null | undefined): Maybe<ReadonlyMap<K, V>> =>
		dict === null || dict === undefined ? Maybe.make.none() : Maybe.make.some(dict),
};

const DictTo = {
	record: <K extends string, V>(dict: ReadonlyMap<K, V>): Readonly<Record<K, V>> => {
		const result = {} as Record<K, V>;
		for (const [k, v] of dict) {
			result[k] = v;
		}
		return result;
	},
};

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
const has = <K, V>(key: K) => (dict: ReadonlyMap<K, V>): boolean => dict.has(key);

/**
 * Retrieves the value associated with a key wrapped in a `Maybe`.
 *
 * @see {@link has} for checking key existence without retrieving the value.
 */
const lookup = <K, V>(key: K) => (dict: ReadonlyMap<K, V>): Maybe<V> => {
	const val = dict.get(key);
	return val !== undefined || dict.has(key) ? Maybe.make.some(val as V) : Maybe.make.none();
};

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
const remove = <K, V>(key: K) => (dict: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
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
const map = <A, B>(transform: (value: A) => B) => <K>(dict: ReadonlyMap<K, A>): ReadonlyMap<K, B> => {
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
const filter = <A>(predicate: (value: A) => boolean) => <K>(dict: ReadonlyMap<K, A>): ReadonlyMap<K, A> => {
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
const filterMap = <A, B>(transform: (value: A) => Maybe<B>) => <K>(dict: ReadonlyMap<K, A>): ReadonlyMap<K, B> => {
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

const reduce = <B, V>(initial: B, reducer: (accumulator: B, value: V) => B) => <K>(dict: ReadonlyMap<K, V>): B => {
	let acc = initial;
	for (const [, v] of dict) {
		acc = reducer(acc, v);
	}
	return acc;
};

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
 */
function mergeWith<V>(
	combine: (first: V, second: V) => V,
): {
	<K>(first: ReadonlyMap<K, V>, second: ReadonlyMap<K, V>): ReadonlyMap<K, V>;
	<K>(second: ReadonlyMap<K, V>): (first: ReadonlyMap<K, V>) => ReadonlyMap<K, V>;
} {
	return ((arg1: any, arg2?: any): any => {
		if (arg2 !== undefined) {
			const res = new globalThis.Map<any, V>(arg1);
			for (const [k, v] of arg2) {
				if (res.has(k)) {
					res.set(k, combine(res.get(k)!, v));
				} else {
					res.set(k, v);
				}
			}
			return res;
		}
		return (first: ReadonlyMap<any, V>): ReadonlyMap<any, V> => {
			const second = arg1;
			const res = new globalThis.Map<any, V>(first);
			for (const [k, v] of second) {
				if (res.has(k)) {
					res.set(k, combine(res.get(k)!, v));
				} else {
					res.set(k, v);
				}
			}
			return res;
		};
	}) as any;
}

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

const _nonEmptyReduce = <V>(reducer: (accumulator: V, value: V) => V) => <K>(dict: NonEmptyMap<K, V>): V =>
	_nonEmptyValues(dict).reduce(reducer);

const _nonEmptyMap = <A, B>(transform: (value: A) => B) => <K>(dict: NonEmptyMap<K, A>): NonEmptyMap<K, B> =>
	map(transform)(dict) as unknown as NonEmptyMap<K, B>;

const _nonEmptyMapWithKey =
	<K, A, B>(transform: (key: K, value: A) => B) => (dict: NonEmptyMap<K, A>): NonEmptyMap<K, B> =>
		mapWithKey(transform)(dict) as unknown as NonEmptyMap<K, B>;

const DictNonEmptyConst = {
	singleton: _nonEmptySingleton,
	from: { map: _nonEmptyFromMap },
	keys: _nonEmptyKeys,
	values: _nonEmptyValues,
	entries: _nonEmptyEntries,
	reduce: _nonEmptyReduce,
	map: _nonEmptyMap,
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
	NonEmpty: DictNonEmptyConst,
};

export namespace Dict {
	/**
	 * A branded type representing a key-value dictionary with at least one entry.
	 */
	export type NonEmpty<K, V> = NonEmptyMap<K, V>;
}
