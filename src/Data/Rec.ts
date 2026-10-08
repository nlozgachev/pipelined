// =============================================================================
// Imports
// =============================================================================
import { Maybe as CoreMaybe, None as CoreNone, Result as CoreResult, Some as CoreSome } from "#core";
import { type NonEmpty as InternalNonEmpty, type NonEmptyArr } from "#internal";
import type { Brand } from "#types";

// =============================================================================
// Types
// =============================================================================
/**
 * A branded type representing a record with at least one key-value pair.
 */
export type NonEmptyRecord<A, K extends string = string> = Brand<InternalNonEmpty<"Rec">, Readonly<Record<K, A>>>;

// =============================================================================
// Private Helpers & Traverse/Sequence Implementations
// =============================================================================
const _isNonEmpty = <A, K extends string>(record: Readonly<Record<K, A>>): record is NonEmptyRecord<A, K> =>
	Object.keys(record).length > 0;

const _setKey = <A>(record: Record<string, A>, key: string, value: A): void => {
	if (key === "__proto__") {
		Object.defineProperty(record, key, { value, writable: true, enumerable: true, configurable: true });
	} else {
		record[key] = value;
	}
};

namespace RecMaybe {
	/**
	 * Map a function that returns a `Maybe` over each value of a record,
	 * and combine the results into a single `Maybe` containing the updated record.
	 * If any value results in `None`, the entire operation returns `None` (short-circuits).
	 *
	 * @see {@link sequence} for collecting an existing record of Maybe values.
	 *
	 * @example
	 * ```ts
	 * const parseNum = (s: string) => s === "NaN" ? Maybe.make.none() : Maybe.make.some(Number(s));
	 * pipe({ a: "1", b: "2" }, Rec.traverse.Maybe(parseNum)); // Some({ a: 1, b: 2 })
	 * pipe({ a: "1", b: "NaN" }, Rec.traverse.Maybe(parseNum)); // None
	 * ```
	 */
	export const traverse =
		<A, B>(transform: (value: A) => CoreMaybe<B>) =>
		(record: Readonly<Record<string, A>>): CoreMaybe<Readonly<Record<string, B>>> => {
			const recordKeys = Object.keys(record);
			if (recordKeys.length === 0) {
				return { kind: "Some", value: {} };
			}
			const result: Record<string, B> = {};
			for (let i = 0; i < recordKeys.length; i++) {
				const key = recordKeys[i];
				const maybeVal = transform(record[key]);
				if (maybeVal.kind === "None") {
					return maybeVal;
				}
				_setKey(result, key, maybeVal.value);
			}
			return { kind: "Some", value: result };
		};

	/**
	 * Sequence a record of `Maybe` values into a `Maybe` of a record.
	 * If any key contains `None`, the entire operation returns `None`.
	 *
	 * @see {@link traverse} for mapping record values to Maybe instances and collecting them.
	 *
	 * @example
	 * ```ts
	 * Rec.sequence.Maybe({ a: Maybe.make.some(1), b: Maybe.make.some(2) }); // Some({ a: 1, b: 2 })
	 * Rec.sequence.Maybe({ a: Maybe.make.some(1), b: Maybe.make.none() }); // None
	 * ```
	 */
	export const sequence = <A>(record: Readonly<Record<string, CoreMaybe<A>>>): CoreMaybe<Readonly<Record<string, A>>> =>
		traverse<CoreMaybe<A>, A>((value) => value)(record);
}

namespace RecResult {
	/**
	 * Map a function that returns a `Result` over each value of a record,
	 * and combine the results into a single `Result` containing the updated record.
	 * If any value results in an `Err`, the entire operation returns that `Err` (short-circuits).
	 *
	 * @see {@link sequence} for collecting an existing record of Result values.
	 *
	 * @example
	 * ```ts
	 * const checkPositive = (n: number) => n < 0 ? Result.make.err("negative") : Result.make.ok(n);
	 * pipe({ a: 1, b: 2 }, Rec.traverse.Result(checkPositive)); // Ok({ a: 1, b: 2 })
	 * pipe({ a: 1, b: -2 }, Rec.traverse.Result(checkPositive)); // Err("negative")
	 * ```
	 */
	export const traverse =
		<E, A, B>(transform: (value: A) => CoreResult<E, B>) =>
		(record: Readonly<Record<string, A>>): CoreResult<E, Readonly<Record<string, B>>> => {
			const recordKeys = Object.keys(record);
			const result: Record<string, B> = {};
			for (let i = 0; i < recordKeys.length; i++) {
				const key = recordKeys[i];
				const res = transform(record[key]);
				if (res.kind === "Err") {
					return res;
				}
				_setKey(result, key, res.value);
			}
			return { kind: "Ok", value: result };
		};

	/**
	 * Sequence a record of `Result` values into a `Result` of a record.
	 * If any key contains an `Err`, the entire operation returns that `Err`.
	 *
	 * @see {@link traverse} for mapping record values to Result instances and collecting them.
	 *
	 * @example
	 * ```ts
	 * Rec.sequence.Result({ a: Result.make.ok(1), b: Result.make.ok(2) }); // Ok({ a: 1, b: 2 })
	 * Rec.sequence.Result({ a: Result.make.ok(1), b: Result.make.err("oops") }); // Err("oops")
	 * ```
	 */
	export const sequence = <E, A>(
		record: Readonly<Record<string, CoreResult<E, A>>>,
	): CoreResult<E, Readonly<Record<string, A>>> => traverse<E, CoreResult<E, A>, A>((value) => value)(record);
}

/**
 * Functional record/object utilities that compose well with pipe.
 * All functions are data-last and curried where applicable.
 *
 * @example
 * ```ts
 * pipe(
 *   { a: 1, b: 2, c: 3 },
 *   Rec.filter(n => n > 1),
 *   Rec.map(n => n * 10)
 * ); // { b: 20, c: 30 }
 * ```
 */
// --- Rec Module ---
/**
 * A branded type representing a record with at least one key-value pair.
 */

const RecIs = {
	/**
	 * Returns true if the record has no keys.
	 *
	 * @see {@link nonEmpty} for checking if a record has keys.
	 *
	 * @example
	 * ```ts
	 * Rec.is.empty({});       // true
	 * Rec.is.empty({ a: 1 }); // false
	 * ```
	 */
	empty: <A>(record: Readonly<Record<string, A>>): boolean => Object.keys(record).length === 0,

	/**
	 * Type guard to check if a record is non-empty.
	 *
	 * @see {@link empty} for checking if a record has no keys.
	 *
	 * @example
	 * ```ts
	 * Rec.is.nonEmpty({ a: 1 }); // true
	 * Rec.is.nonEmpty({});       // false
	 * ```
	 */
	nonEmpty: _isNonEmpty,
};

/**
 * Transforms each value in a record.
 *
 * @see {@link mapWithKey} for transforming values with key access.
 * @see {@link mapKeys} for transforming keys while preserving values.
 * @see {@link mapEntries} for transforming keys and values simultaneously.
 *
 * @example
 * ```ts
 * pipe({ a: 1, b: 2 }, Rec.map(n => n * 2)); // { a: 2, b: 4 }
 * ```
 */
const map =
	<A, B>(transform: (value: A) => B) => <K extends string>(record: Readonly<Record<K, A>>): Readonly<Record<K, B>> => {
		const recordKeys = Object.keys(record);
		const recordValues = Object.values(record) as readonly A[];
		const result: Record<string, B> = Object.create(Object.getPrototypeOf(record));
		for (let i = 0; i < recordKeys.length; i++) {
			const key = recordKeys[i];
			if (key === "__proto__") {
				Object.defineProperty(result, "__proto__", {
					value: transform(recordValues[i]),
					writable: true,
					enumerable: true,
					configurable: true,
				});
			} else {
				result[key] = transform(recordValues[i]);
			}
		}
		return result as unknown as Readonly<Record<K, B>>;
	};

/**
 * Maps each value in a record with a function returning a `Maybe`, keeping only `Some` values.
 *
 * @see {@link filter} for filtering with a boolean predicate.
 *
 * @example
 * ```ts
 * pipe(
 *   { a: 1, b: 2, c: 3 },
 *   Rec.filterMap((n) => (n % 2 === 0 ? Maybe.make.some(n * 10) : Maybe.make.none()))
 * ); // { b: 20 }
 * ```
 */
const filterMap =
	<A, B>(transform: (value: A) => CoreMaybe<B>) => (
		record: Readonly<Record<string, A>>,
	): Readonly<Record<string, B>> => {
		const recordKeys = Object.keys(record);
		const recordValues = Object.values(record);
		const result: Record<string, B> = Object.create(Object.getPrototypeOf(record));
		for (let i = 0; i < recordKeys.length; i++) {
			const maybeVal = transform(recordValues[i]);
			if (maybeVal.kind === "Some") {
				_setKey(result, recordKeys[i], maybeVal.value);
			}
		}
		return result;
	};

/**
 * Transforms each value in a record, also receiving the key.
 *
 * @see {@link map} for transforming values without key access.
 *
 * @example
 * ```ts
 * pipe({ a: 1, b: 2 }, Rec.mapWithKey((k, v) => `${k}:${v}`));
 * // { a: "a:1", b: "b:2" }
 * ```
 */
const mapWithKey =
	<A, B>(transform: (key: string, value: A) => B) =>
	<K extends string>(record: Readonly<Record<K, A>>): Readonly<Record<K, B>> => {
		const recordKeys = Object.keys(record);
		const recordValues = Object.values(record) as readonly A[];
		const result: Record<string, B> = Object.create(Object.getPrototypeOf(record));
		for (let i = 0; i < recordKeys.length; i++) {
			const key = recordKeys[i];
			_setKey(result, key, transform(key, recordValues[i]));
		}
		return result as unknown as Readonly<Record<K, B>>;
	};

/**
 * Filters values in a record by a predicate.
 *
 * @see {@link filterWithKey} for filtering values with key access.
 * @see {@link filterMap} for filtering and mapping in a single pass.
 *
 * @example
 * ```ts
 * pipe({ a: 1, b: 2, c: 3 }, Rec.filter(n => n > 1)); // { b: 2, c: 3 }
 * ```
 */
const filter =
	<A>(predicate: (value: A) => boolean) => (record: Readonly<Record<string, A>>): Readonly<Record<string, A>> => {
		const recordKeys = Object.keys(record);
		const recordValues = Object.values(record);
		const result: Record<string, A> = Object.create(Object.getPrototypeOf(record));
		for (let i = 0; i < recordKeys.length; i++) {
			if (predicate(recordValues[i])) {
				_setKey(result, recordKeys[i], recordValues[i]);
			}
		}
		return result;
	};

/**
 * Filters values in a record by a predicate that also receives the key.
 *
 * @see {@link filter} for filtering values without key access.
 *
 * @example
 * ```ts
 * pipe({ a: 1, b: 2, c: 3 }, Rec.filterWithKey((k, v) => k !== "a" && v > 0));
 * // { b: 2 }
 * ```
 */
const filterWithKey =
	<A>(predicate: (key: string, value: A) => boolean) =>
	(record: Readonly<Record<string, A>>): Readonly<Record<string, A>> => {
		const result: Record<string, A> = {};
		for (const [k, v] of Object.entries(record)) {
			if (predicate(k, v)) {
				_setKey(result, k, v);
			}
		}
		return result;
	};

/**
 * Looks up a value by key, returning Maybe.
 *
 * @example
 * ```ts
 * pipe({ a: 1, b: 2 }, Rec.lookup("a")); // Some(1)
 * pipe({ a: 1, b: 2 }, Rec.lookup("c")); // None
 * ```
 */
const lookup = <K extends string>(key: K) => <V>(record: Record<string, V>): CoreMaybe<V> =>
	Object.hasOwn(record, key) ? { kind: "Some", value: record[key] } as CoreSome<V> : { kind: "None" } as CoreNone;

/**
 * Returns all keys of a record.
 *
 * @see {@link values} for extracting record values.
 * @see {@link entries} for extracting key-value pairs.
 *
 * @example
 * ```ts
 * Rec.keys({ a: 1, b: 2 }); // ["a", "b"]
 * ```
 */
const keys = <T extends Record<string, unknown>>(record: T): readonly (keyof T & string)[] =>
	Object.keys(record) as (keyof T & string)[];

/**
 * Returns all values of a record.
 *
 * @see {@link keys} for extracting record keys.
 * @see {@link entries} for extracting key-value pairs.
 *
 * @example
 * ```ts
 * Rec.values({ a: 1, b: 2 }); // [1, 2]
 * ```
 */
const values = <T extends Record<string, unknown>>(record: T): readonly T[keyof T & string][] =>
	Object.values(record) as T[keyof T & string][];

/**
 * Returns all key-value pairs of a record.
 *
 * @see {@link keys} for extracting record keys.
 * @see {@link values} for extracting record values.
 *
 * @example
 * ```ts
 * Rec.entries({ a: 1, b: 2 }); // [["a", 1], ["b", 2]]
 * ```
 */
const entries = <T extends Record<string, unknown>>(record: T): readonly (readonly [keyof T, T[keyof T]])[] =>
	Object.entries(record) as unknown as (readonly [keyof T, T[keyof T]])[];

// --- from ---
const RecFrom = {
	/**
	 * Creates a record from key-value pairs.
	 *
	 * @example
	 * ```ts
	 * Rec.from.entries([["a", 1], ["b", 2]]); // { a: 1, b: 2 }
	 * ```
	 */
	entries: <A>(pairs: readonly (readonly [string, A])[]): Readonly<Record<string, A>> => Object.fromEntries(pairs),
};

/**
 * Groups elements of an array into a record keyed by the result of `keySelector`. Each key maps to
 * the array of elements that produced it, in insertion order.
 *
 * Unlike `Dict.groupBy`, keys are always strings. Use `Dict.groupBy` when you need non-string
 * keys or want to avoid the plain-object prototype chain.
 *
 * @example
 * ```ts
 * pipe(
 *   ["apple", "avocado", "banana", "blueberry"],
 *   Rec.groupBy(s => s[0]),
 * ); // { a: ["apple", "avocado"], b: ["banana", "blueberry"] }
 * ```
 */
const groupBy =
	<A>(keySelector: (item: A) => string) => (items: readonly A[]): Readonly<Record<string, readonly A[]>> => {
		const result: Record<string, A[]> = {};
		for (const item of items) {
			const key = keySelector(item);
			if (Object.hasOwn(result, key)) {
				result[key].push(item);
			} else {
				_setKey(result, key, [item]);
			}
		}
		return result;
	};

/**
 * Picks specific keys from a record.
 *
 * @see {@link omit} for removing specific keys from a record.
 *
 * @example
 * ```ts
 * pipe({ a: 1, b: 2, c: 3 }, Rec.pick("a", "c")); // { a: 1, c: 3 }
 * ```
 */
const pick = <K extends string>(...pickedKeys: K[]) => <A extends Record<K, unknown>>(record: A): Pick<A, K> => {
	const result = {} as Pick<A, K>;
	for (const key of pickedKeys) {
		if (Object.hasOwn(record, key)) {
			_setKey(result, key, record[key]);
		}
	}
	return result;
};

/**
 * Omits specific keys from a record.
 *
 * @see {@link pick} for retaining only specific keys from a record.
 *
 * @example
 * ```ts
 * pipe({ a: 1, b: 2, c: 3 }, Rec.omit("b")); // { a: 1, c: 3 }
 * ```
 */
const omit = <K extends string>(...omittedKeys: K[]) => <A extends Record<K, unknown>>(record: A): Omit<A, K> => {
	const omitSet = new Set<string>(omittedKeys);
	const result = {} as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		if (!omitSet.has(key)) {
			_setKey(result, key, (record as Record<string, unknown>)[key]);
		}
	}
	return result as Omit<A, K>;
};

/**
 * Merges two records. Values from the second record take precedence.
 *
 * @see {@link mergeWith} for merging records with custom collision resolution.
 *
 * @example
 * ```ts
 * pipe({ a: 1, b: 2 }, Rec.merge({ b: 3, c: 4 })); // { a: 1, b: 3, c: 4 }
 * ```
 */
const merge =
	<A>(other: Readonly<Record<string, A>>) => (record: Readonly<Record<string, A>>): Readonly<Record<string, A>> => ({
		...record,
		...other,
	});

/**
 * Merges two records using a custom combination function on key collisions.
 * Supports both uncurried `Rec.mergeWith(combine)(first, second)` and curried `pipe(first, Rec.mergeWith(combine)(second))`.
 *
 * @see {@link merge} for shallow merging with right-precedence.
 *
 * @example
 * ```ts
 * const combineStats = Rec.mergeWith((a: number, b: number) => a + b);
 * combineStats({ a: 1, b: 2 }, { b: 3, c: 4 }); // { a: 1, b: 5, c: 4 }
 * pipe({ a: 1, b: 2 }, combineStats({ b: 3, c: 4 })); // { a: 1, b: 5, c: 4 }
 * ```
 */
function mergeWith<A>(
	combine: (first: A, second: A) => A,
): {
	(second: Readonly<Record<string, A>>): (first: Readonly<Record<string, A>>) => Readonly<Record<string, A>>;
	(first: Readonly<Record<string, A>>, second: Readonly<Record<string, A>>): Readonly<Record<string, A>>;
};
function mergeWith<A>(
	combine: (first: A, second: A) => A,
): (arg1: Readonly<Record<string, A>>, arg2?: Readonly<Record<string, A>>) => any {
	return (arg1: Readonly<Record<string, A>>, arg2?: Readonly<Record<string, A>>): any => {
		if (arg2 !== undefined) {
			const first = arg1;
			const second = arg2;
			const result: Record<string, A> = { ...first };
			for (const [k, v] of Object.entries(second)) {
				if (Object.hasOwn(result, k)) {
					result[k] = combine(result[k], v);
				} else {
					result[k] = v;
				}
			}
			return result;
		}
		const second = arg1;
		return (first: Readonly<Record<string, A>>): Readonly<Record<string, A>> => {
			const result: Record<string, A> = { ...first };
			for (const [k, v] of Object.entries(second)) {
				if (Object.hasOwn(result, k)) {
					result[k] = combine(result[k], v);
				} else {
					result[k] = v;
				}
			}
			return result;
		};
	};
}

/**
 * Returns the number of keys in a record.
 *
 * @example
 * ```ts
 * Rec.size({ a: 1, b: 2 }); // 2
 * ```
 */
const size = <A>(record: Readonly<Record<string, A>>): number => Object.keys(record).length;

/**
 * Transforms each key while preserving values.
 * If two keys map to the same new key, the last one wins.
 *
 * @see {@link map} for transforming values.
 * @see {@link mapEntries} for transforming keys and values simultaneously.
 *
 * @example
 * ```ts
 * pipe({ firstName: "Alice", lastName: "Smith" }, Rec.mapKeys(k => k.toUpperCase()));
 * // { FIRSTNAME: "Alice", LASTNAME: "Smith" }
 * ```
 */
const mapKeys =
	(transform: (key: string) => string) => <A>(record: Readonly<Record<string, A>>): Readonly<Record<string, A>> => {
		const recKeys = Object.keys(record);
		if (recKeys.length === 0) {
			return record;
		}
		const result: Record<string, A> = {};
		for (let i = 0; i < recKeys.length; i++) {
			const k = recKeys[i];
			_setKey(result, transform(k), record[k]);
		}
		return result;
	};

/**
 * Removes all `None` values from a `Record<string, Maybe<A>>`, returning a plain `Record<string, A>`.
 * Useful when building records from fallible lookups.
 *
 * @example
 * ```ts
 * Rec.compact({ a: Maybe.make.some(1), b: Maybe.make.none(), c: Maybe.make.some(3) });
 * // { a: 1, c: 3 }
 * ```
 */
const compact = <A>(record: Readonly<Record<string, CoreMaybe<A>>>): Readonly<Record<string, A>> => {
	const recKeys = Object.keys(record);
	if (recKeys.length === 0) {
		return {};
	}
	const result: Record<string, A> = {};
	for (let i = 0; i < recKeys.length; i++) {
		const k = recKeys[i];
		const v = record[k];
		if (v.kind === "Some") {
			_setKey(result, k, v.value);
		}
	}
	return result;
};

/**
 * Transforms key and value pairs simultaneously.
 *
 * @see {@link map} for transforming values.
 * @see {@link mapKeys} for transforming keys.
 *
 * @example
 * ```ts
 * pipe(
 *   { a: 1, b: 2 },
 *   Rec.mapEntries((k, v) => [k.toUpperCase(), v * 10])
 * ); // { A: 10, B: 20 }
 * ```
 */
const mapEntries =
	<A, K2 extends string, B>(transform: (key: string, value: A) => readonly [K2, B]) =>
	(record: Readonly<Record<string, A>>): Readonly<Record<K2, B>> => {
		const recKeys = Object.keys(record);
		if (recKeys.length === 0) {
			return {} as Record<K2, B>;
		}
		const result = {} as Record<K2, B>;
		for (let i = 0; i < recKeys.length; i++) {
			const k = recKeys[i];
			const [newKey, newVal] = transform(k, record[k]);
			_setKey(result, newKey, newVal);
		}
		return result;
	};

/**
 * Immutably updates a value at a deep nested path inside a record.
 *
 * @example
 * ```ts
 * pipe(
 *   { user: { profile: { age: 30 } } },
 *   Rec.updateIn(["user", "profile", "age"], (n: number) => n + 1)
 * ); // { user: { profile: { age: 31 } } }
 * ```
 */
const updateIn =
	<T>(path: readonly [string, ...string[]], transform: (value: T) => T) =>
	(record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => {
		const updateNode = (obj: any, pathKeys: readonly string[]): any => {
			const [head, ...tail] = pathKeys;
			if (tail.length === 0) {
				return { ...obj, [head]: transform(obj?.[head]) };
			}
			const child = obj && typeof obj === "object" && head in obj ? obj[head] : {};
			return { ...obj, [head]: updateNode(child, tail) };
		};
		return updateNode(record, path);
	};

const RecTo = {
	Dict: <A, K extends string = string>(record: Readonly<Record<K, A>>): ReadonlyMap<K, A> =>
		new globalThis.Map<K, A>(Object.entries(record) as unknown as (readonly [K, A])[]),
};

const RecNonEmpty = {
	singleton: <K extends string, A>(key: K, value: A): NonEmptyRecord<A, K> =>
		({ [key]: value }) as unknown as NonEmptyRecord<A, K>,
	from: {
		record: <K extends string, A>(record: Readonly<Record<K, A>>): CoreMaybe<NonEmptyRecord<A, K>> =>
			_isNonEmpty(record) ? CoreMaybe.make.some(record) : CoreMaybe.make.none(),
	},
	keys: <K extends string, A>(record: NonEmptyRecord<A, K>): NonEmptyArr<K> => keys(record) as unknown as NonEmptyArr<K>,
	values: <K extends string, A>(record: NonEmptyRecord<A, K>): NonEmptyArr<A> =>
		values(record) as unknown as NonEmptyArr<A>,
	entries: <K extends string, A>(record: NonEmptyRecord<A, K>): NonEmptyArr<readonly [K, A]> =>
		entries(record) as unknown as NonEmptyArr<readonly [K, A]>,
	reduce: <A>(reducer: (accumulator: A, value: A) => A) => <K extends string>(record: NonEmptyRecord<A, K>): A =>
		(values(record) as readonly A[]).reduce(reducer),
	map: <A, B>(transform: (value: A) => B) => <K extends string>(record: NonEmptyRecord<A, K>): NonEmptyRecord<B, K> =>
		map(transform)(record) as unknown as NonEmptyRecord<B, K>,
	mapWithKey:
		<A, B>(transform: (key: string, value: A) => B) =>
		<K extends string>(record: NonEmptyRecord<A, K>): NonEmptyRecord<B, K> =>
			mapWithKey(transform)(record) as unknown as NonEmptyRecord<B, K>,
};

// =============================================================================
// Public Export
// =============================================================================
export const Rec = {
	is: RecIs,
	from: RecFrom,
	to: RecTo,
	map,
	filterMap,
	mapWithKey,
	filter,
	filterWithKey,
	lookup,
	keys,
	values,
	entries,
	groupBy,
	pick,
	omit,
	merge,
	mergeWith,
	size,
	mapKeys,
	compact,
	mapEntries,
	updateIn,
	traverse: { Maybe: RecMaybe.traverse, Result: RecResult.traverse },
	sequence: { Maybe: RecMaybe.sequence, Result: RecResult.sequence },
	NonEmpty: RecNonEmpty,
};

export namespace Rec {
	export type NonEmpty<A, K extends string = string> = NonEmptyRecord<A, K>;
}
