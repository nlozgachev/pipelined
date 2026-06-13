import { Maybe as CoreMaybe, None as CoreNone, Result as CoreResult, Some as CoreSome } from "#core";
import { type NonEmptyArr } from "#internal";

declare const _nonEmptyRecord: unique symbol;

/**
 * A branded type representing a record with at least one key-value pair.
 */
export type NonEmptyRecord<A> = Readonly<Record<string, A>> & { readonly [_nonEmptyRecord]: true; };

const _isNonEmpty = <A>(data: Readonly<Record<string, A>>): data is NonEmptyRecord<A> => Object.keys(data).length > 0;

namespace RecMaybe {
	/**
	 * Map a function that returns a `Maybe` over each value of a record,
	 * and combine the results into a single `Maybe` containing the updated record.
	 * If any value results in `None`, the entire operation returns `None` (short-circuits).
	 *
	 * @example
	 * ```ts
	 * const parseNum = (s: string) => s === "NaN" ? Maybe.none() : Maybe.some(Number(s));
	 * pipe({ a: "1", b: "2" }, Rec.Maybe.traverse(parseNum)); // Some({ a: 1, b: 2 })
	 * pipe({ a: "1", b: "NaN" }, Rec.Maybe.traverse(parseNum)); // None
	 * ```
	 */
	export const traverse =
		<A, B>(f: (a: A) => CoreMaybe<B>) => (data: Readonly<Record<string, A>>): CoreMaybe<Readonly<Record<string, B>>> => {
			const recordKeys = Object.keys(data);
			const result: Record<string, B> = {};
			for (let i = 0; i < recordKeys.length; i++) {
				const key = recordKeys[i];
				const maybeVal = f(data[key]);
				if (maybeVal.kind === "None") {
					return maybeVal;
				}
				Object.defineProperty(result, key, { value: maybeVal.value, writable: true, enumerable: true, configurable: true });
			}
			return { kind: "Some", value: result };
		};

	/**
	 * Sequence a record of `Maybe` values into a `Maybe` of a record.
	 * If any key contains `None`, the entire operation returns `None`.
	 *
	 * @example
	 * ```ts
	 * Rec.Maybe.sequence({ a: Maybe.some(1), b: Maybe.some(2) }); // Some({ a: 1, b: 2 })
	 * Rec.Maybe.sequence({ a: Maybe.some(1), b: Maybe.none() }); // None
	 * ```
	 */
	export const sequence = <A>(data: Readonly<Record<string, CoreMaybe<A>>>): CoreMaybe<Readonly<Record<string, A>>> =>
		traverse<CoreMaybe<A>, A>((a) => a)(data);
}

namespace RecResult {
	/**
	 * Map a function that returns a `Result` over each value of a record,
	 * and combine the results into a single `Result` containing the updated record.
	 * If any value results in an `Err`, the entire operation returns that `Err` (short-circuits).
	 *
	 * @example
	 * ```ts
	 * const checkPositive = (n: number) => n < 0 ? Result.err("negative") : Result.ok(n);
	 * pipe({ a: 1, b: 2 }, Rec.Result.traverse(checkPositive)); // Ok({ a: 1, b: 2 })
	 * pipe({ a: 1, b: -2 }, Rec.Result.traverse(checkPositive)); // Err("negative")
	 * ```
	 */
	export const traverse =
		<E, A, B>(f: (a: A) => CoreResult<E, B>) =>
		(data: Readonly<Record<string, A>>): CoreResult<E, Readonly<Record<string, B>>> => {
			const recordKeys = Object.keys(data);
			const result: Record<string, B> = {};
			for (let i = 0; i < recordKeys.length; i++) {
				const key = recordKeys[i];
				const res = f(data[key]);
				if (res.kind === "Err") {
					return res;
				}
				Object.defineProperty(result, key, { value: res.value, writable: true, enumerable: true, configurable: true });
			}
			return { kind: "Ok", value: result };
		};

	/**
	 * Sequence a record of `Result` values into a `Result` of a record.
	 * If any key contains an `Err`, the entire operation returns that `Err`.
	 *
	 * @example
	 * ```ts
	 * Rec.Result.sequence({ a: Result.ok(1), b: Result.ok(2) }); // Ok({ a: 1, b: 2 })
	 * Rec.Result.sequence({ a: Result.ok(1), b: Result.err("oops") }); // Err("oops")
	 * ```
	 */
	export const sequence = <E, A>(
		data: Readonly<Record<string, CoreResult<E, A>>>,
	): CoreResult<E, Readonly<Record<string, A>>> => traverse<E, CoreResult<E, A>, A>((a) => a)(data);
}

namespace RecNonEmpty {
	/**
	 * Creates a NonEmpty record from a single key-value pair.
	 *
	 * @example
	 * ```ts
	 * Rec.NonEmpty.singleton("a", 1); // { a: 1 }
	 * ```
	 */
	export const singleton = <A>(key: string, value: A): NonEmptyRecord<A> =>
		({ [key]: value }) as unknown as NonEmptyRecord<A>;

	/**
	 * Creates a NonEmpty record from a standard record if it is not empty.
	 *
	 * @example
	 * ```ts
	 * Rec.NonEmpty.fromRecord({ a: 1 }); // Some({ a: 1 })
	 * Rec.NonEmpty.fromRecord({});      // None
	 * ```
	 */
	export const fromRecord = <A>(data: Readonly<Record<string, A>>): CoreMaybe<NonEmptyRecord<A>> =>
		_isNonEmpty(data) ? CoreMaybe.some(data) : CoreMaybe.none();

	/**
	 * Returns a non-empty array of keys for a NonEmpty record.
	 *
	 * @example
	 * ```ts
	 * Rec.NonEmpty.keys(Rec.NonEmpty.singleton("a", 1)); // ["a"]
	 * ```
	 */
	export const keys = <A>(data: NonEmptyRecord<A>): NonEmptyArr<string> =>
		Object.keys(data) as unknown as NonEmptyArr<string>;

	/**
	 * Returns a non-empty array of values for a NonEmpty record.
	 *
	 * @example
	 * ```ts
	 * Rec.NonEmpty.values(Rec.NonEmpty.singleton("a", 1)); // [1]
	 * ```
	 */
	export const values = <A>(data: NonEmptyRecord<A>): NonEmptyArr<A> => Object.values(data) as unknown as NonEmptyArr<A>;

	/**
	 * Returns a non-empty array of entry tuples for a NonEmpty record.
	 *
	 * @example
	 * ```ts
	 * Rec.NonEmpty.entries(Rec.NonEmpty.singleton("a", 1)); // [["a", 1]]
	 * ```
	 */
	export const entries = <A>(data: NonEmptyRecord<A>): NonEmptyArr<readonly [string, A]> =>
		Object.entries(data) as unknown as NonEmptyArr<readonly [string, A]>;

	/**
	 * Reduces a NonEmpty record's values from the left without an initial value.
	 *
	 * @example
	 * ```ts
	 * pipe(Rec.NonEmpty.singleton("a", 1), Rec.NonEmpty.reduce((a, b) => a + b)); // 1
	 * ```
	 */
	export const reduce = <A>(f: (acc: A, a: A) => A) => (data: NonEmptyRecord<A>): A => {
		const recordVals = Object.values(data) as unknown as NonEmptyArr<A>;
		return recordVals.reduce(f);
	};
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
export namespace Rec {
	/**
	 * A branded type representing a record with at least one key-value pair.
	 */
	export type NonEmpty<A> = NonEmptyRecord<A>;

	/**
	 * Type guard to check if a record is non-empty.
	 */
	export const isNonEmpty = _isNonEmpty;

	/**
	 * Transforms each value in a record.
	 *
	 * @example
	 * ```ts
	 * pipe({ a: 1, b: 2 }, Rec.map(n => n * 2)); // { a: 2, b: 4 }
	 * ```
	 */
	export const map = <A, B>(f: (a: A) => B) =>
		((data: Readonly<Record<string, A>>) => {
			const recordKeys = Object.keys(data);
			const recordValues = Object.values(data);
			const result: Record<string, B> = Object.create(Object.getPrototypeOf(data));
			for (let i = 0; i < recordKeys.length; i++) {
				Object.defineProperty(result, recordKeys[i], {
					value: f(recordValues[i]),
					writable: true,
					enumerable: true,
					configurable: true,
				});
			}
			return result;
		}) as { (data: NonEmpty<A>): NonEmpty<B>; (data: Readonly<Record<string, A>>): Readonly<Record<string, B>>; };

	export const filterMap =
		<A, B>(f: (a: A) => CoreMaybe<B>) => (data: Readonly<Record<string, A>>): Readonly<Record<string, B>> => {
			const recordKeys = Object.keys(data);
			const recordValues = Object.values(data);
			const result: Record<string, B> = Object.create(Object.getPrototypeOf(data));
			for (let i = 0; i < recordKeys.length; i++) {
				const maybeVal = f(recordValues[i]);
				if (maybeVal.kind === "Some") {
					Object.defineProperty(result, recordKeys[i], {
						value: maybeVal.value,
						writable: true,
						enumerable: true,
						configurable: true,
					});
				}
			}
			return result;
		};

	/**
	 * Transforms each value in a record, also receiving the key.
	 *
	 * @example
	 * ```ts
	 * pipe({ a: 1, b: 2 }, Rec.mapWithKey((k, v) => `${k}:${v}`));
	 * // { a: "a:1", b: "b:2" }
	 * ```
	 */
	export const mapWithKey = <A, B>(f: (key: string, a: A) => B) =>
		((data: Readonly<Record<string, A>>) => {
			const recordKeys = Object.keys(data);
			const recordValues = Object.values(data);
			const result: Record<string, B> = Object.create(Object.getPrototypeOf(data));
			for (let i = 0; i < recordKeys.length; i++) {
				Object.defineProperty(result, recordKeys[i], {
					value: f(recordKeys[i], recordValues[i]),
					writable: true,
					enumerable: true,
					configurable: true,
				});
			}
			return result;
		}) as { (data: NonEmpty<A>): NonEmpty<B>; (data: Readonly<Record<string, A>>): Readonly<Record<string, B>>; };

	/**
	 * Filters values in a record by a predicate.
	 *
	 * @example
	 * ```ts
	 * pipe({ a: 1, b: 2, c: 3 }, Rec.filter(n => n > 1)); // { b: 2, c: 3 }
	 * ```
	 */
	export const filter =
		<A>(predicate: (a: A) => boolean) => (data: Readonly<Record<string, A>>): Readonly<Record<string, A>> => {
			const recordKeys = Object.keys(data);
			const recordValues = Object.values(data);
			const result: Record<string, A> = Object.create(Object.getPrototypeOf(data));
			for (let i = 0; i < recordKeys.length; i++) {
				if (predicate(recordValues[i])) {
					Object.defineProperty(result, recordKeys[i], {
						value: recordValues[i],
						writable: true,
						enumerable: true,
						configurable: true,
					});
				}
			}
			return result;
		};

	/**
	 * Filters values in a record by a predicate that also receives the key.
	 *
	 * @example
	 * ```ts
	 * pipe({ a: 1, b: 2, c: 3 }, Rec.filterWithKey((k, v) => k !== "a" && v > 0));
	 * // { b: 2 }
	 * ```
	 */
	export const filterWithKey =
		<A>(predicate: (key: string, a: A) => boolean) => (
			data: Readonly<Record<string, A>>,
		): Readonly<Record<string, A>> => {
			const result: Record<string, A> = {};
			for (const [k, v] of Object.entries(data)) {
				if (predicate(k, v)) {
					Object.defineProperty(result, k, { value: v, writable: true, enumerable: true, configurable: true });
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
	export const lookup = <K extends string>(key: K) => <V>(data: Record<string, V>): CoreMaybe<V> =>
		Object.hasOwn(data, key) ? { kind: "Some", value: data[key] } as CoreSome<V> : { kind: "None" } as CoreNone;

	/**
	 * Returns all keys of a record.
	 */
	export const keys = <T extends Record<string, unknown>>(data: T): readonly (keyof T & string)[] =>
		Object.keys(data) as (keyof T & string)[];

	/**
	 * Returns all values of a record.
	 */
	export const values = <T extends Record<string, unknown>>(data: T): readonly T[keyof T & string][] =>
		Object.values(data) as T[keyof T & string][];

	/**
	 * Returns all key-value pairs of a record.
	 */
	export const entries = <T extends Record<string, unknown>>(data: T): readonly (readonly [keyof T, T[keyof T]])[] =>
		Object.entries(data) as unknown as (readonly [keyof T, T[keyof T]])[];

	/**
	 * Creates a record from key-value pairs.
	 *
	 * @example
	 * ```ts
	 * Rec.fromEntries([["a", 1], ["b", 2]]); // { a: 1, b: 2 }
	 * ```
	 */
	export const fromEntries = <A>(data: readonly (readonly [string, A])[]): Readonly<Record<string, A>> =>
		Object.fromEntries(data);

	/**
	 * Groups elements of an array into a record keyed by the result of `keyFn`. Each key maps to
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
	export const groupBy =
		<A>(keyFn: (a: A) => string) => (items: readonly A[]): Readonly<Record<string, readonly A[]>> => {
			const result: Record<string, A[]> = {};
			for (const item of items) {
				const key = keyFn(item);
				if (Object.hasOwn(result, key)) {
					result[key].push(item);
				} else {
					Object.defineProperty(result, key, { value: [item], writable: true, enumerable: true, configurable: true });
				}
			}
			return result;
		};

	/**
	 * Picks specific keys from a record.
	 *
	 * @example
	 * ```ts
	 * pipe({ a: 1, b: 2, c: 3 }, Rec.pick("a", "c")); // { a: 1, c: 3 }
	 * ```
	 */
	export const pick = <K extends string>(...pickedKeys: K[]) => <A extends Record<K, unknown>>(data: A): Pick<A, K> => {
		const result = {} as Pick<A, K>;
		for (const key of pickedKeys) {
			if (Object.hasOwn(data, key)) {
				Object.defineProperty(result, key, { value: data[key], writable: true, enumerable: true, configurable: true });
			}
		}
		return result;
	};

	/**
	 * Omits specific keys from a record.
	 *
	 * @example
	 * ```ts
	 * pipe({ a: 1, b: 2, c: 3 }, Rec.omit("b")); // { a: 1, c: 3 }
	 * ```
	 */
	export const omit = <K extends string>(...omittedKeys: K[]) => <A extends Record<K, unknown>>(data: A): Omit<A, K> => {
		const omitSet = new Set<string>(omittedKeys);
		const result = {} as Record<string, unknown>;
		for (const key of Object.keys(data)) {
			if (!omitSet.has(key)) {
				Object.defineProperty(result, key, {
					value: (data as Record<string, unknown>)[key],
					writable: true,
					enumerable: true,
					configurable: true,
				});
			}
		}
		return result as Omit<A, K>;
	};

	/**
	 * Merges two records. Values from the second record take precedence.
	 *
	 * @example
	 * ```ts
	 * pipe({ a: 1, b: 2 }, Rec.merge({ b: 3, c: 4 })); // { a: 1, b: 3, c: 4 }
	 * ```
	 */
	export const merge =
		<A>(other: Readonly<Record<string, A>>) => (data: Readonly<Record<string, A>>): Readonly<Record<string, A>> => ({
			...data,
			...other,
		});

	/**
	 * Returns true if the record has no keys.
	 */
	export const isEmpty = <A>(data: Readonly<Record<string, A>>): boolean => Object.keys(data).length === 0;

	/**
	 * Returns the number of keys in a record.
	 */
	export const size = <A>(data: Readonly<Record<string, A>>): number => Object.keys(data).length;

	/**
	 * Transforms each key while preserving values.
	 * If two keys map to the same new key, the last one wins.
	 *
	 * @example
	 * ```ts
	 * pipe({ firstName: "Alice", lastName: "Smith" }, Rec.mapKeys(k => k.toUpperCase()));
	 * // { FIRSTNAME: "Alice", LASTNAME: "Smith" }
	 * ```
	 */
	export const mapKeys =
		(f: (key: string) => string) => <A>(data: Readonly<Record<string, A>>): Readonly<Record<string, A>> => {
			const result: Record<string, A> = {};
			for (const [k, v] of Object.entries(data)) {
				Object.defineProperty(result, f(k), { value: v, writable: true, enumerable: true, configurable: true });
			}
			return result;
		};

	/**
	 * Removes all `None` values from a `Record<string, Maybe<A>>`, returning a plain `Record<string, A>`.
	 * Useful when building records from fallible lookups.
	 *
	 * @example
	 * ```ts
	 * Rec.compact({ a: Maybe.some(1), b: Maybe.none(), c: Maybe.some(3) });
	 * // { a: 1, c: 3 }
	 * ```
	 */
	export const compact = <A>(data: Readonly<Record<string, CoreMaybe<A>>>): Readonly<Record<string, A>> => {
		const result: Record<string, A> = {};
		for (const [k, v] of Object.entries(data)) {
			if (v.kind === "Some") {
				Object.defineProperty(result, k, { value: v.value, writable: true, enumerable: true, configurable: true });
			}
		}
		return result;
	};

	export const Maybe = RecMaybe;
	export const Result = RecResult;
	export const NonEmpty = RecNonEmpty;
}
