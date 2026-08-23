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
	empty: <K, V>(m: ReadonlyMap<K, V>): boolean => m.size === 0,
	nonEmpty: <K, V>(m: ReadonlyMap<K, V>): m is NonEmptyMap<K, V> => m.size > 0,
};

const empty = <K, V>(): ReadonlyMap<K, V> => new globalThis.Map<K, V>();

const singleton = <K, V>(key: K, value: V): ReadonlyMap<K, V> => new globalThis.Map<K, V>([[key, value]]);

const DictFrom = {
	entries: <K, V>(entries: readonly (readonly [K, V])[]): ReadonlyMap<K, V> =>
		new globalThis.Map<K, V>(entries as (readonly [K, V])[]),

	Record: <K extends string, V>(record: Readonly<Record<K, V>>): ReadonlyMap<K, V> =>
		new globalThis.Map<K, V>(Object.entries(record) as unknown as (readonly [K, V])[]),

	Array: <K, V>(data: readonly (readonly [K, V])[]): ReadonlyMap<K, V> =>
		new globalThis.Map<K, V>(data as (readonly [K, V])[]),

	nullable: <K, V>(data: ReadonlyMap<K, V> | null | undefined): Maybe<ReadonlyMap<K, V>> =>
		data === null || data === undefined ? Maybe.make.none() : Maybe.make.some(data),
};

const DictTo = {
	Record: <K extends string, V>(map: ReadonlyMap<K, V>): Readonly<Record<K, V>> => {
		const result = {} as Record<K, V>;
		for (const [k, v] of map) {
			result[k] = v;
		}
		return result;
	},
};

const groupBy = <A, K>(f: (a: A) => K) => (as: readonly A[]): ReadonlyMap<K, NonEmptyArr<A>> => {
	const result = new globalThis.Map<K, A[]>();
	for (const a of as) {
		const k = f(a);
		const existing = result.get(k);
		if (existing !== undefined) {
			existing.push(a);
		} else {
			result.set(k, [a]);
		}
	}
	return result as unknown as ReadonlyMap<K, NonEmptyArr<A>>;
};

const has = <K, V>(key: K) => (data: ReadonlyMap<K, V>): boolean => data.has(key);

const lookup = <K, V>(key: K) => (data: ReadonlyMap<K, V>): Maybe<V> => {
	const val = data.get(key);
	return val !== undefined || data.has(key) ? Maybe.make.some(val as V) : Maybe.make.none();
};

const size = <K, V>(data: ReadonlyMap<K, V>): number => data.size;

const keys = <K, V>(data: ReadonlyMap<K, V>): readonly K[] => Array.from(data.keys());

const values = <K, V>(data: ReadonlyMap<K, V>): readonly V[] => Array.from(data.values());

const entries = <K, V>(data: ReadonlyMap<K, V>): readonly (readonly [K, V])[] => Array.from(data.entries());

const insert = <K, V>(key: K, value: V) => (data: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
	const res = new globalThis.Map(data);
	res.set(key, value);
	return res;
};

const remove = <K, V>(key: K) => (data: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
	if (!data.has(key)) {
		return data;
	}
	const res = new globalThis.Map(data);
	res.delete(key);
	return res;
};

const upsert = <K, V>(key: K, f: (existing: Maybe<V>) => V) => (data: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
	const res = new globalThis.Map(data);
	const existing = data.has(key) ? Maybe.make.some(data.get(key) as V) : Maybe.make.none();
	res.set(key, f(existing));
	return res;
};

const map = <A, B>(f: (a: A) => B) => <K>(data: ReadonlyMap<K, A>): ReadonlyMap<K, B> => {
	const res = new globalThis.Map<K, B>();
	for (const [k, v] of data) {
		res.set(k, f(v));
	}
	return res;
};

const mapWithKey = <K, A, B>(f: (key: K, value: A) => B) => (data: ReadonlyMap<K, A>): ReadonlyMap<K, B> => {
	const res = new globalThis.Map<K, B>();
	for (const [k, v] of data) {
		res.set(k, f(k, v));
	}
	return res;
};

const filter = <A>(predicate: (a: A) => boolean) => <K>(data: ReadonlyMap<K, A>): ReadonlyMap<K, A> => {
	const res = new globalThis.Map<K, A>();
	for (const [k, v] of data) {
		if (predicate(v)) {
			res.set(k, v);
		}
	}
	return res;
};

const filterWithKey =
	<K, A>(predicate: (key: K, value: A) => boolean) => (data: ReadonlyMap<K, A>): ReadonlyMap<K, A> => {
		const res = new globalThis.Map<K, A>();
		for (const [k, v] of data) {
			if (predicate(k, v)) {
				res.set(k, v);
			}
		}
		return res;
	};

const compact = <K, A>(data: ReadonlyMap<K, Maybe<A>>): ReadonlyMap<K, A> => {
	const res = new globalThis.Map<K, A>();
	for (const [k, v] of data) {
		if (v.kind === "Some") {
			res.set(k, v.value);
		}
	}
	return res;
};

const filterMap = <A, B>(f: (a: A) => Maybe<B>) => <K>(data: ReadonlyMap<K, A>): ReadonlyMap<K, B> => {
	const res = new globalThis.Map<K, B>();
	for (const [k, v] of data) {
		const mb = f(v);
		if (mb.kind === "Some") {
			res.set(k, mb.value);
		}
	}
	return res;
};

const union = <K, V>(other: ReadonlyMap<K, V>) => (data: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
	if (data.size === 0) {
		return other;
	}
	if (other.size === 0) {
		return data;
	}
	const res = new globalThis.Map(data);
	for (const [k, v] of other) {
		res.set(k, v);
	}
	return res;
};

const intersection = <K, V>(other: ReadonlyMap<K, V>) => (data: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
	const res = new globalThis.Map<K, V>();
	for (const [k, v] of data) {
		if (other.has(k)) {
			res.set(k, v);
		}
	}
	return res;
};

const difference = <K, V>(other: ReadonlyMap<K, V>) => (data: ReadonlyMap<K, V>): ReadonlyMap<K, V> => {
	if (other.size === 0) {
		return data;
	}
	const res = new globalThis.Map<K, V>();
	for (const [k, v] of data) {
		if (!other.has(k)) {
			res.set(k, v);
		}
	}
	return res;
};

const reduce = <B, V>(init: B, f: (acc: B, value: V) => B) => <K>(data: ReadonlyMap<K, V>): B => {
	let acc = init;
	for (const [, v] of data) {
		acc = f(acc, v);
	}
	return acc;
};

const reduceWithKey = <B, K, V>(init: B, f: (acc: B, value: V, key: K) => B) => (data: ReadonlyMap<K, V>): B => {
	let acc = init;
	for (const [k, v] of data) {
		acc = f(acc, v, k);
	}
	return acc;
};

function mergeWith<V>(
	combine: (a: V, b: V) => V,
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
	<K1, V1, K2, V2>(f: (key: K1, value: V1) => readonly [K2, V2]) => (data: ReadonlyMap<K1, V1>): ReadonlyMap<K2, V2> => {
		const res = new globalThis.Map<K2, V2>();
		for (const [k, v] of data) {
			const [nk, nv] = f(k, v);
			res.set(nk, nv);
		}
		return res;
	};

const mapKeys = <K1, K2, V>(f: (key: K1) => K2) => (data: ReadonlyMap<K1, V>): ReadonlyMap<K2, V> => {
	const res = new globalThis.Map<K2, V>();
	for (const [k, v] of data) {
		res.set(f(k), v);
	}
	return res;
};

// --- NonEmpty helpers ---
const _nonEmptySingleton = <K, V>(key: K, value: V): NonEmptyMap<K, V> =>
	new globalThis.Map([[key, value]]) as unknown as NonEmptyMap<K, V>;

const _nonEmptyFromMap = <K, V>(m: ReadonlyMap<K, V>): Maybe<NonEmptyMap<K, V>> =>
	m.size > 0 ? Maybe.make.some(m as NonEmptyMap<K, V>) : Maybe.make.none();

const _nonEmptyKeys = <K, V>(m: NonEmptyMap<K, V>): NonEmptyArr<K> => keys(m) as unknown as NonEmptyArr<K>;

const _nonEmptyValues = <K, V>(m: NonEmptyMap<K, V>): NonEmptyArr<V> => values(m) as unknown as NonEmptyArr<V>;

const _nonEmptyEntries = <K, V>(m: NonEmptyMap<K, V>): NonEmptyArr<readonly [K, V]> =>
	entries(m) as unknown as NonEmptyArr<readonly [K, V]>;

const _nonEmptyReduce = <V>(f: (acc: V, value: V) => V) => <K>(m: NonEmptyMap<K, V>): V => _nonEmptyValues(m).reduce(f);

const _nonEmptyMap = <A, B>(f: (a: A) => B) => <K>(m: NonEmptyMap<K, A>): NonEmptyMap<K, B> =>
	map(f)(m) as unknown as NonEmptyMap<K, B>;

const _nonEmptyMapWithKey = <K, A, B>(f: (key: K, a: A) => B) => (m: NonEmptyMap<K, A>): NonEmptyMap<K, B> =>
	mapWithKey(f)(m) as unknown as NonEmptyMap<K, B>;

const DictNonEmptyConst = {
	singleton: _nonEmptySingleton,
	from: { Map: _nonEmptyFromMap },
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
