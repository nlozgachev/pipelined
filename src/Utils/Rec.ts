import { Option } from "#core/Option.ts";

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
	 * Transforms each value in a record.
	 *
	 * @example
	 * ```ts
	 * pipe({ a: 1, b: 2 }, Rec.map(n => n * 2)); // { a: 2, b: 4 }
	 * ```
	 */
	export const map = <A, B>(f: (a: A) => B) => (data: Readonly<Record<string, A>>): Readonly<Record<string, B>> => {
		const keys = Object.keys(data);
		const vals = Object.values(data);
		const result: Record<string, B> = {};
		for (let i = 0; i < keys.length; i++) {
			result[keys[i]] = f(vals[i]);
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
	export const mapWithKey =
		<A, B>(f: (key: string, a: A) => B) => (data: Readonly<Record<string, A>>): Readonly<Record<string, B>> => {
			const keys = Object.keys(data);
			const vals = Object.values(data);
			const result: Record<string, B> = {};
			for (let i = 0; i < keys.length; i++) {
				result[keys[i]] = f(keys[i], vals[i]);
			}
			return result;
		};

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
			const keys = Object.keys(data);
			const vals = Object.values(data);
			const result: Record<string, A> = {};
			for (let i = 0; i < keys.length; i++) {
				if (predicate(vals[i])) result[keys[i]] = vals[i];
			}
			return result;
		};

	/**
	 * Filters values in a record by a predicate that also receives the key.
	 *
	 * @example
	 * ```ts
	 * pipe({ a: 1, b: 2 }, Rec.filterWithKey((k, v) => k !== "a" && v > 0));
	 * // { b: 2 }
	 * ```
	 */
	export const filterWithKey =
		<A>(predicate: (key: string, a: A) => boolean) =>
		(data: Readonly<Record<string, A>>): Readonly<Record<string, A>> => {
			const keys = Object.keys(data);
			const vals = Object.values(data);
			const result: Record<string, A> = {};
			for (let i = 0; i < keys.length; i++) {
				if (predicate(keys[i], vals[i])) result[keys[i]] = vals[i];
			}
			return result;
		};

	/**
	 * Looks up a value by key, returning Option.
	 *
	 * @example
	 * ```ts
	 * pipe({ a: 1, b: 2 }, Rec.lookup("a")); // Some(1)
	 * pipe({ a: 1, b: 2 }, Rec.lookup("c")); // None
	 * ```
	 */
	export const lookup = (key: string) => <A>(data: Readonly<Record<string, A>>): Option<A> =>
		Object.prototype.hasOwnProperty.call(data, key) ? Option.some(data[key]) : Option.none();

	/**
	 * Returns all keys of a record.
	 */
	export const keys = <A>(data: Readonly<Record<string, A>>): readonly string[] => Object.keys(data);

	/**
	 * Returns all values of a record.
	 */
	export const values = <A>(data: Readonly<Record<string, A>>): readonly A[] => Object.values(data);

	/**
	 * Returns all key-value pairs of a record.
	 */
	export const entries = <A>(
		data: Readonly<Record<string, A>>,
	): readonly (readonly [string, A])[] => Object.entries(data);

	/**
	 * Creates a record from key-value pairs.
	 *
	 * @example
	 * ```ts
	 * Rec.fromEntries([["a", 1], ["b", 2]]); // { a: 1, b: 2 }
	 * ```
	 */
	export const fromEntries = <A>(
		data: readonly (readonly [string, A])[],
	): Readonly<Record<string, A>> => Object.fromEntries(data);

	/**
	 * Picks specific keys from a record.
	 *
	 * @example
	 * ```ts
	 * pipe({ a: 1, b: 2, c: 3 }, Rec.pick("a", "c")); // { a: 1, c: 3 }
	 * ```
	 */
	export const pick = <K extends string>(...pickedKeys: K[]) =>
	<A extends Record<K, unknown>>(
		data: A,
	): Pick<A, K> => {
		const result = {} as Pick<A, K>;
		for (const key of pickedKeys) {
			if (Object.prototype.hasOwnProperty.call(data, key)) {
				result[key] = data[key];
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
	export const omit =
		<K extends string>(...omittedKeys: K[]) => <A extends Record<K, unknown>>(data: A): Omit<A, K> => {
			const omitSet = new Set<string>(omittedKeys);
			const result = {} as Record<string, unknown>;
			for (const key of Object.keys(data)) {
				if (!omitSet.has(key)) {
					result[key] = (data as Record<string, unknown>)[key];
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
			const keys = Object.keys(data);
			const vals = Object.values(data);
			const result: Record<string, A> = {};
			for (let i = 0; i < keys.length; i++) {
				result[f(keys[i])] = vals[i];
			}
			return result;
		};

	/**
	 * Removes all `None` values from a `Record<string, Option<A>>`, returning a plain `Record<string, A>`.
	 * Useful when building records from fallible lookups.
	 *
	 * @example
	 * ```ts
	 * Rec.compact({ a: Option.some(1), b: Option.none(), c: Option.some(3) });
	 * // { a: 1, c: 3 }
	 * ```
	 */
	export const compact = <A>(
		data: Readonly<Record<string, Option<A>>>,
	): Readonly<Record<string, A>> => {
		const keys = Object.keys(data);
		const vals = Object.values(data);
		const result: Record<string, A> = {};
		for (let i = 0; i < keys.length; i++) {
			const v = vals[i];
			if (v.kind === "Some") result[keys[i]] = v.value;
		}
		return result;
	};
}
