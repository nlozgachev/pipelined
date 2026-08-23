import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Dict } from "../Dict.ts";

// ---------------------------------------------------------------------------
// empty
// ---------------------------------------------------------------------------

test("Dict.empty returns a ReadonlyMap with size 0", () => {
	const m = Dict.empty<string, number>();
	expect(m.size).toBe(0);
});

// ---------------------------------------------------------------------------
// singleton
// ---------------------------------------------------------------------------

test("Dict.singleton returns a ReadonlyMap with one entry", () => {
	const m = Dict.singleton("a", 1);
	expect(m.size).toBe(1);
	expect(m.get("a")).toBe(1);
});

// ---------------------------------------------------------------------------
// fromEntries
// ---------------------------------------------------------------------------

test("Dict.from.entries creates a map from key-value pairs", () => {
	const m = Dict.from.entries([["a", 1], ["b", 2]]);
	expect(m.size).toBe(2);
	expect(m.get("a")).toBe(1);
	expect(m.get("b")).toBe(2);
});

test("Dict.from.entries returns empty map for empty array", () => {
	expect(Dict.from.entries([]).size).toBe(0);
});

// ---------------------------------------------------------------------------
// fromRecord
// ---------------------------------------------------------------------------

test("Dict.from.Record creates a map from a plain object", () => {
	const m = Dict.from.Record({ x: 10, y: 20 });
	expect(m.get("x")).toBe(10);
	expect(m.get("y")).toBe(20);
});

// ---------------------------------------------------------------------------
// groupBy
// ---------------------------------------------------------------------------

test("Dict.groupBy groups items by key function", () => {
	const m = pipe([1, 2, 3, 4, 5], Dict.groupBy((n) => n % 2 === 0 ? "even" : "odd"));
	expect([...m.get("odd")!]).toStrictEqual([1, 3, 5]);
	expect([...m.get("even")!]).toStrictEqual([2, 4]);
});

test("Dict.groupBy returns empty map for empty array", () => {
	expect(pipe([], Dict.groupBy((n: number) => n % 2)).size).toBe(0);
});

test("Dict.groupBy all elements map to same key", () => {
	const m = pipe([1, 2, 3], Dict.groupBy(() => "all"));
	expect(m.size).toBe(1);
	expect([...m.get("all")!]).toStrictEqual([1, 2, 3]);
});

test("Dict.groupBy each element maps to a unique key", () => {
	const m = pipe([1, 2, 3], Dict.groupBy((n) => n));
	expect(m.size).toBe(3);
	expect([...m.get(1)!]).toStrictEqual([1]);
});

test("Dict.groupBy preserves insertion order within each group", () => {
	const items = ["banana", "avocado", "blueberry", "apricot"];
	const m = pipe(items, Dict.groupBy((s) => s[0]));
	expect([...m.get("b")!]).toStrictEqual(["banana", "blueberry"]);
	expect([...m.get("a")!]).toStrictEqual(["avocado", "apricot"]);
});

// ---------------------------------------------------------------------------
// has
// ---------------------------------------------------------------------------

test("Dict.has returns true when key exists", () => {
	const m = Dict.from.entries([["a", 1]]);
	expect(pipe(m, Dict.has("a"))).toBe(true);
});

test("Dict.has returns false when key does not exist", () => {
	const m = Dict.from.entries([["a", 1]]);
	expect(pipe(m, Dict.has("b"))).toBe(false);
});

test("Dict.has returns false on empty map", () => {
	expect(pipe(Dict.empty<string, number>(), Dict.has("a"))).toBe(false);
});

// ---------------------------------------------------------------------------
// lookup
// ---------------------------------------------------------------------------

test("Dict.lookup returns Some when key exists", () => {
	const m = Dict.from.entries([["a", 42]]);
	expect(pipe(m, Dict.lookup("a"))).toStrictEqual(Maybe.make.some(42));
});

test("Dict.lookup returns None when key does not exist", () => {
	const m = Dict.from.entries([["a", 42]]);
	expect(pipe(m, Dict.lookup("b"))).toStrictEqual(Maybe.make.none());
});

test("Dict.lookup returns None on empty map", () => {
	expect(pipe(Dict.empty<string, number>(), Dict.lookup("a"))).toStrictEqual(Maybe.make.none());
});

// ---------------------------------------------------------------------------
// size
// ---------------------------------------------------------------------------

test("Dict.size returns the number of entries", () => {
	expect(Dict.size(Dict.from.entries([["a", 1], ["b", 2], ["c", 3]]))).toBe(3);
	expect(Dict.size(Dict.empty())).toBe(0);
});

// ---------------------------------------------------------------------------
// isEmpty
// ---------------------------------------------------------------------------

test("Dict.is.empty returns true for an empty map", () => {
	expect(Dict.is.empty(Dict.empty())).toBe(true);
});

test("Dict.is.empty returns false for a non-empty map", () => {
	expect(Dict.is.empty(Dict.singleton("a", 1))).toBe(false);
});

// ---------------------------------------------------------------------------
// keys / values / entries
// ---------------------------------------------------------------------------

test("Dict.keys returns all keys in insertion order", () => {
	expect(Dict.keys(Dict.from.entries([["b", 2], ["a", 1]]))).toStrictEqual(["b", "a"]);
});

test("Dict.values returns all values in insertion order", () => {
	expect(Dict.values(Dict.from.entries([["a", 1], ["b", 2]]))).toStrictEqual([1, 2]);
});

test("Dict.entries returns all key-value pairs in insertion order", () => {
	expect(Dict.entries(Dict.from.entries([["a", 1], ["b", 2]]))).toStrictEqual([["a", 1], ["b", 2]]);
});

// ---------------------------------------------------------------------------
// insert
// ---------------------------------------------------------------------------

test("Dict.insert adds a new key", () => {
	const m = pipe(Dict.from.entries([["a", 1]]), Dict.insert("b", 2));
	expect(m.size).toBe(2);
	expect(m.get("b")).toBe(2);
});

test("Dict.insert replaces an existing key", () => {
	const m = pipe(Dict.from.entries([["a", 1]]), Dict.insert("a", 99));
	expect(m.size).toBe(1);
	expect(m.get("a")).toBe(99);
});

test("Dict.insert does not mutate the original", () => {
	const original = Dict.from.entries([["a", 1]]);
	pipe(original, Dict.insert("b", 2));
	expect(original.size).toBe(1);
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

test("Dict.remove removes an existing key", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.remove("a"));
	expect(m.size).toBe(1);
	expect(m.has("a")).toBe(false);
});

test("Dict.remove returns original when key does not exist", () => {
	const original = Dict.from.entries([["a", 1]]);
	const result = pipe(original, Dict.remove("z"));
	expect(result).toBe(original);
});

// ---------------------------------------------------------------------------
// upsert
// ---------------------------------------------------------------------------

test("Dict.upsert inserts when key is missing", () => {
	const m = pipe(
		Dict.empty<string, number>(),
		Dict.upsert("count", (opt: Maybe<number>) => (opt.kind === "Some" ? opt.value : 0) + 1),
	);
	expect(m.get("count")).toBe(1);
});

test("Dict.upsert updates when key exists", () => {
	const m = pipe(
		Dict.singleton("count", 5),
		Dict.upsert("count", (opt: Maybe<number>) => (opt.kind === "Some" ? opt.value : 0) + 1),
	);
	expect(m.get("count")).toBe(6);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Dict.map transforms all values", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.map((n) => n * 10));
	expect(m.get("a")).toBe(10);
	expect(m.get("b")).toBe(20);
});

test("Dict.map returns empty map when input is empty", () => {
	expect(pipe(Dict.empty<string, number>(), Dict.map((n) => n * 2)).size).toBe(0);
});

// ---------------------------------------------------------------------------
// mapWithKey
// ---------------------------------------------------------------------------

test("Dict.mapWithKey receives the key and value", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.mapWithKey((k, v) => `${k}:${v}`));
	expect(m.get("a")).toBe("a:1");
	expect(m.get("b")).toBe("b:2");
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("Dict.filter keeps entries matching predicate", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 3], ["c", 0]]), Dict.filter((n) => n > 0));
	expect(m.size).toBe(2);
	expect(m.has("c")).toBe(false);
});

test("Dict.filter returns empty map when nothing matches", () => {
	expect(pipe(Dict.from.entries([["a", 1]]), Dict.filter(() => false)).size).toBe(0);
});

// ---------------------------------------------------------------------------
// filterWithKey
// ---------------------------------------------------------------------------

test("Dict.filterWithKey receives key and value", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 2], ["c", 3]]), Dict.filterWithKey((k, v) => k !== "b" && v < 3));
	expect(m.size).toBe(1);
	expect(m.get("a")).toBe(1);
});

// ---------------------------------------------------------------------------
// compact
// ---------------------------------------------------------------------------

test("Dict.compact removes None values and unwraps Some values", () => {
	const m = Dict.compact(
		Dict.from.entries<string, Maybe<number>>([["a", Maybe.make.some(1)], ["b", Maybe.make.none()], [
			"c",
			Maybe.make.some(3),
		]]),
	);
	expect(m.size).toBe(2);
	expect(m.get("a")).toBe(1);
	expect(m.has("b")).toBe(false);
	expect(m.get("c")).toBe(3);
});

test("Dict.compact returns empty map when all values are None", () => {
	const m = Dict.compact(Dict.from.entries<string, Maybe<number>>([["a", Maybe.make.none()], ["b", Maybe.make.none()]]));
	expect(m.size).toBe(0);
});

// ---------------------------------------------------------------------------
// filterMap
// ---------------------------------------------------------------------------

test("Dict.filterMap keeps entries where f returns Some", () => {
	const m = Dict.from.Record({ a: "1", b: "two", c: "3" });
	const result = pipe(
		m,
		Dict.filterMap((s: string) => {
			const n = Number(s);
			return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
		}),
	);
	expect(Dict.to.Record(result as ReadonlyMap<string, number>)).toStrictEqual({ a: 1, c: 3 });
});

test("Dict.filterMap returns empty map when all entries return None", () => {
	const m = Dict.from.Record({ a: "x", b: "y" });
	const result = pipe(m, Dict.filterMap((_: string): Maybe<number> => Maybe.make.none()));
	expect(result.size).toBe(0);
});

test("Dict.filterMap preserves keys of matching entries", () => {
	const m = Dict.from.entries<number, number>([[1, 10], [2, -5], [3, 30]]);
	const result = pipe(m, Dict.filterMap((n: number) => n > 0 ? Maybe.make.some(n * 2) : Maybe.make.none()));
	expect([...result.entries()]).toStrictEqual([[1, 20], [3, 60]]);
});

// ---------------------------------------------------------------------------
// union
// ---------------------------------------------------------------------------

test("Dict.union merges two maps with other taking precedence", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.union(Dict.from.entries([["b", 99], ["c", 3]])));
	expect(m.get("a")).toBe(1);
	expect(m.get("b")).toBe(99);
	expect(m.get("c")).toBe(3);
});

test("Dict.union with empty other returns equivalent map", () => {
	const base = Dict.from.entries([["a", 1]]);
	const result = pipe(base, Dict.union(Dict.empty<string, number>()));
	expect(Dict.entries(result)).toStrictEqual(Dict.entries(base));
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

test("Dict.intersection keeps only common keys with left values", () => {
	const m = pipe(
		Dict.from.entries([["a", 1], ["b", 2], ["c", 3]]),
		Dict.intersection(Dict.from.entries([["b", 99], ["c", 0], ["d", 4]])),
	);
	expect(m.size).toBe(2);
	expect(m.get("b")).toBe(2);
	expect(m.get("c")).toBe(3);
});

test("Dict.intersection returns empty map when no common keys", () => {
	const m = pipe(Dict.from.entries([["a", 1]]), Dict.intersection(Dict.from.entries([["b", 2]])));
	expect(m.size).toBe(0);
});

// ---------------------------------------------------------------------------
// difference
// ---------------------------------------------------------------------------

test("Dict.difference removes keys present in other", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 2], ["c", 3]]), Dict.difference(Dict.from.entries([["b", 0]])));
	expect(m.size).toBe(2);
	expect(m.has("b")).toBe(false);
	expect(m.get("a")).toBe(1);
});

test("Dict.difference returns unchanged map when other is empty", () => {
	const base = Dict.from.entries([["a", 1], ["b", 2]]);
	const result = pipe(base, Dict.difference(Dict.empty<string, number>()));
	expect(result.size).toBe(2);
});

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

test("Dict.reduce folds all values", () => {
	const sum = Dict.reduce(0, (acc: number, v: number) => acc + v)(Dict.from.entries([["a", 1], ["b", 2], ["c", 3]]));
	expect(sum).toBe(6);
});

test("Dict.reduce returns init for empty map", () => {
	expect(Dict.reduce(42, (acc: number, v: number) => acc + v)(Dict.empty())).toBe(42);
});

// ---------------------------------------------------------------------------
// reduceWithKey
// ---------------------------------------------------------------------------

test("Dict.reduceWithKey receives key and value", () => {
	const keys: string[] = [];
	Dict.reduceWithKey(0, (acc, _v, k: string) => {
		keys.push(k);
		return acc;
	})(Dict.from.entries([["a", 1], ["b", 2]]));
	expect(keys).toStrictEqual(["a", "b"]);
});

test("Dict.reduceWithKey folds using both key and value", () => {
	const result = Dict.reduceWithKey("", (acc, v: number, k: string) => `${acc}${k}:${v} `)(
		Dict.from.entries([["a", 1], ["b", 2]]),
	);
	expect(result).toBe("a:1 b:2 ");
});

// ---------------------------------------------------------------------------
// mergeWith
// ---------------------------------------------------------------------------

test("Dict.mergeWith combines maps uncurried and curried on key collisions", () => {
	const combine = Dict.mergeWith((a: number, b: number) => a + b);
	const map1 = Dict.from.entries([["a", 1], ["b", 2]]);
	const map2 = Dict.from.entries([["b", 3], ["c", 4]]);

	expect(combine(map1, map2)).toStrictEqual(Dict.from.entries([["a", 1], ["b", 5], ["c", 4]]));
	expect(pipe(map1, combine(map2))).toStrictEqual(Dict.from.entries([["a", 1], ["b", 5], ["c", 4]]));
});

// --- mapEntries & mapKeys ---

test("Dict.mapEntries transforms keys and values simultaneously", () => {
	const res = pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.mapEntries((k, v) => [k.toUpperCase(), v * 10]));
	expect(res).toStrictEqual(Dict.from.entries([["A", 10], ["B", 20]]));
});

test("Dict.mapKeys transforms keys while preserving values", () => {
	const res = pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.mapKeys((k) => k.toUpperCase()));
	expect(res).toStrictEqual(Dict.from.entries([["A", 1], ["B", 2]]));
});

// ---------------------------------------------------------------------------
// toRecord
// ---------------------------------------------------------------------------

test("Dict.to.Record converts to plain object", () => {
	expect(Dict.to.Record(Dict.from.entries([["a", 1], ["b", 2]]))).toStrictEqual({ a: 1, b: 2 });
});

test("Dict.to.Record returns empty object for empty map", () => {
	expect(Dict.to.Record(Dict.empty<string, unknown>())).toStrictEqual({});
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("dict pipe composition — fromRecord, filter, map, reduce", () => {
	const result = pipe(
		Dict.from.Record({ alice: 85, bob: 92, carol: 60, dave: 77 }),
		Dict.filter((score) => score >= 75),
		Dict.map((score) => score + 5),
		Dict.reduce(0, (acc, score) => acc + score),
	);
	expect(result).toBe(269);
});

// ---------------------------------------------------------------------------
// Dict.NonEmpty
// ---------------------------------------------------------------------------

test("Dict.is.nonEmpty - returns true for non-empty map", () => {
	expect(Dict.is.nonEmpty(Dict.singleton("a", 1))).toBe(true);
});

test("Dict.is.nonEmpty - returns false for empty map", () => {
	expect(Dict.is.nonEmpty(Dict.empty())).toBe(false);
});

test("Dict.NonEmpty.singleton - creates a single-entry map", () => {
	const result = Dict.NonEmpty.singleton("a", 1);
	expect(result.size).toBe(1);
	expect(result.get("a")).toBe(1);
	expectTypeOf(result).toEqualTypeOf<Dict.NonEmpty<string, number>>();
});

test("Dict.NonEmpty.from.Map - returns Some for non-empty map", () => {
	const result = Dict.NonEmpty.from.Map(Dict.singleton("a", 1));
	if (result.kind !== "Some") {
		throw new Error("Expected Some");
	}
	expect(result.value.size).toBe(1);
	expectTypeOf(result.value).toEqualTypeOf<Dict.NonEmpty<string, number>>();
});

test("Dict.NonEmpty.from.Map - returns None for empty map", () => {
	const result = Dict.NonEmpty.from.Map(Dict.empty());
	expect(result.kind).toBe("None");
});

test("Dict.NonEmpty.keys - returns non-empty array of keys", () => {
	const m = Dict.NonEmpty.singleton("a", 1);
	const keys = Dict.NonEmpty.keys(m);
	expect(keys).toStrictEqual(["a"]);
	expectTypeOf(keys).toEqualTypeOf<readonly [string, ...string[]]>();
});

test("Dict.NonEmpty.values - returns non-empty array of values", () => {
	const m = Dict.NonEmpty.singleton("a", 1);
	const values = Dict.NonEmpty.values(m);
	expect(values).toStrictEqual([1]);
	expectTypeOf(values).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("Dict.NonEmpty.entries - returns non-empty array of entries", () => {
	const m = Dict.NonEmpty.singleton("a", 1);
	const entries = Dict.NonEmpty.entries(m);
	expect(entries).toStrictEqual([["a", 1]]);
	expectTypeOf(entries).toEqualTypeOf<readonly [readonly [string, number], ...(readonly [string, number])[]]>();
});

test("Dict.NonEmpty.reduce - reduces non-empty map's values without seed", () => {
	const m = Dict.NonEmpty.singleton("a", 10);
	const result = pipe(m, Dict.NonEmpty.reduce((a, b) => a + b));
	expect(result).toBe(10);
});

test("Dict.map on NonEmpty - returns standard ReadonlyMap", () => {
	const m = Dict.NonEmpty.singleton("a", 10);
	const mapped = Dict.map((n: number) => n * 2)(m);
	expect(mapped.get("a")).toBe(20);
	expectTypeOf(mapped).toEqualTypeOf<ReadonlyMap<string, number>>();
});

test("Dict.mapWithKey on NonEmpty - returns standard ReadonlyMap", () => {
	const m = Dict.NonEmpty.singleton("a", 10);
	const mapped = Dict.mapWithKey((k: string, v: number) => `${k}:${v}`)(m);
	expect(mapped.get("a")).toBe("a:10");
	expectTypeOf(mapped).toEqualTypeOf<ReadonlyMap<string, string>>();
});

test("Dict.NonEmpty.map - maps values and preserves NonEmpty type", () => {
	const m = Dict.NonEmpty.singleton("a", 10);
	const mapped = pipe(m, Dict.NonEmpty.map((n) => n * 2));
	expect(mapped.get("a")).toBe(20);
	expectTypeOf(mapped).toEqualTypeOf<Dict.NonEmpty<string, number>>();
});

test("Dict.NonEmpty.mapWithKey - maps values with key and preserves NonEmpty type", () => {
	const m = Dict.NonEmpty.singleton("a", 10);
	const mapped = pipe(m, Dict.NonEmpty.mapWithKey((k, v) => `${k}:${v}`));
	expect(mapped.get("a")).toBe("a:10");
	expectTypeOf(mapped).toEqualTypeOf<Dict.NonEmpty<string, string>>();
});

test("Dict.NonEmpty pipe composition", () => {
	const result = pipe(Dict.NonEmpty.singleton("a", 5), Dict.NonEmpty.map((n) => n * 2), Dict.NonEmpty.keys);
	expect(result).toStrictEqual(["a"]);
	expectTypeOf(result).toEqualTypeOf<readonly [string, ...string[]]>();
});

test("Dict.from.Array and Dict.from.nullable", () => {
	const m = Dict.from.Array([["a", 1], ["b", 2]]);
	expect(m.get("a")).toBe(1);

	expect(Dict.from.nullable(m)).toStrictEqual(Maybe.make.some(m));
	expect(Dict.from.nullable(null)).toStrictEqual(Maybe.make.none());
	expect(Dict.from.nullable(undefined)).toStrictEqual(Maybe.make.none());
});
