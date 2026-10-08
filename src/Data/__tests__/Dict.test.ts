import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Dict } from "../Dict.ts";

// ---------------------------------------------------------------------------
// empty
// ---------------------------------------------------------------------------

test("empty: returns ReadonlyMap with size 0", () => {
	const m = Dict.empty<string, number>();
	expect(m.size).toBe(0);
});

// ---------------------------------------------------------------------------
// singleton
// ---------------------------------------------------------------------------

test("singleton: returns ReadonlyMap with one entry", () => {
	const m = Dict.singleton("a", 1);
	expect(m.size).toBe(1);
	expect(m.get("a")).toBe(1);
});

// ---------------------------------------------------------------------------
// fromEntries
// ---------------------------------------------------------------------------

test("from.entries: creates map from key-value pairs", () => {
	const m = Dict.from.entries([["a", 1], ["b", 2]]);
	expect(m.size).toBe(2);
	expect(m.get("a")).toBe(1);
	expect(m.get("b")).toBe(2);
});

test("from.entries: returns empty map for empty array", () => {
	expect(Dict.from.entries([]).size).toBe(0);
});

// ---------------------------------------------------------------------------
// from.record
// ---------------------------------------------------------------------------

test("from.record: creates map from plain object", () => {
	const m = Dict.from.record({ x: 10, y: 20 });
	expect(m.get("x")).toBe(10);
	expect(m.get("y")).toBe(20);
});

// ---------------------------------------------------------------------------
// groupBy
// ---------------------------------------------------------------------------

test("groupBy: groups items by key function", () => {
	const m = pipe([1, 2, 3, 4, 5], Dict.groupBy((n) => n % 2 === 0 ? "even" : "odd"));
	expect([...m.get("odd")!]).toStrictEqual([1, 3, 5]);
	expect([...m.get("even")!]).toStrictEqual([2, 4]);
});

test("groupBy: returns empty map for empty array", () => {
	expect(pipe([], Dict.groupBy((n: number) => n % 2)).size).toBe(0);
});

test("groupBy: groups all elements when mapped to same key", () => {
	const m = pipe([1, 2, 3], Dict.groupBy(() => "all"));
	expect(m.size).toBe(1);
	expect([...m.get("all")!]).toStrictEqual([1, 2, 3]);
});

test("groupBy: creates individual groups when elements map to unique keys", () => {
	const m = pipe([1, 2, 3], Dict.groupBy((n) => n));
	expect(m.size).toBe(3);
	expect([...m.get(1)!]).toStrictEqual([1]);
});

test("groupBy: preserves insertion order within each group", () => {
	const items = ["banana", "avocado", "blueberry", "apricot"];
	const m = pipe(items, Dict.groupBy((s) => s[0]));
	expect([...m.get("b")!]).toStrictEqual(["banana", "blueberry"]);
	expect([...m.get("a")!]).toStrictEqual(["avocado", "apricot"]);
});

// ---------------------------------------------------------------------------
// has
// ---------------------------------------------------------------------------

test("has: returns true when key exists", () => {
	const m = Dict.from.entries([["a", 1]]);
	expect(pipe(m, Dict.has("a"))).toBe(true);
});

test("has: returns false when key does not exist", () => {
	const m = Dict.from.entries([["a", 1]]);
	expect(pipe(m, Dict.has("b"))).toBe(false);
});

test("has: returns false on empty map", () => {
	expect(pipe(Dict.empty<string, number>(), Dict.has("a"))).toBe(false);
});

// ---------------------------------------------------------------------------
// lookup
// ---------------------------------------------------------------------------

test("lookup: returns Some when key exists", () => {
	const m = Dict.from.entries([["a", 42]]);
	expect(pipe(m, Dict.lookup("a"))).toStrictEqual(Maybe.make.some(42));
});

test("lookup: returns None when key does not exist", () => {
	const m = Dict.from.entries([["a", 42]]);
	expect(pipe(m, Dict.lookup("b"))).toStrictEqual(Maybe.make.none());
});

test("lookup: returns None on empty map", () => {
	expect(pipe(Dict.empty<string, number>(), Dict.lookup("a"))).toStrictEqual(Maybe.make.none());
});

// ---------------------------------------------------------------------------
// size
// ---------------------------------------------------------------------------

test("size: returns number of entries", () => {
	expect(Dict.size(Dict.from.entries([["a", 1], ["b", 2], ["c", 3]]))).toBe(3);
	expect(Dict.size(Dict.empty())).toBe(0);
});

// ---------------------------------------------------------------------------
// isEmpty
// ---------------------------------------------------------------------------

test("is.empty: returns true for empty map", () => {
	expect(Dict.is.empty(Dict.empty())).toBe(true);
});

test("is.empty: returns false for non-empty map", () => {
	expect(Dict.is.empty(Dict.singleton("a", 1))).toBe(false);
});

// ---------------------------------------------------------------------------
// keys / values / entries
// ---------------------------------------------------------------------------

test("keys: returns all keys in insertion order", () => {
	expect(Dict.keys(Dict.from.entries([["b", 2], ["a", 1]]))).toStrictEqual(["b", "a"]);
});

test("values: returns all values in insertion order", () => {
	expect(Dict.values(Dict.from.entries([["a", 1], ["b", 2]]))).toStrictEqual([1, 2]);
});

test("entries: returns all key-value pairs in insertion order", () => {
	expect(Dict.entries(Dict.from.entries([["a", 1], ["b", 2]]))).toStrictEqual([["a", 1], ["b", 2]]);
});

// ---------------------------------------------------------------------------
// insert
// ---------------------------------------------------------------------------

test("insert: adds a new key", () => {
	const m = pipe(Dict.from.entries([["a", 1]]), Dict.insert("b", 2));
	expect(m.size).toBe(2);
	expect(m.get("b")).toBe(2);
});

test("insert: replaces an existing key", () => {
	const m = pipe(Dict.from.entries([["a", 1]]), Dict.insert("a", 99));
	expect(m.size).toBe(1);
	expect(m.get("a")).toBe(99);
});

test("insert: does not mutate original map", () => {
	const original = Dict.from.entries([["a", 1]]);
	pipe(original, Dict.insert("b", 2));
	expect(original.size).toBe(1);
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

test("remove: removes existing key", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.remove("a"));
	expect(m.size).toBe(1);
	expect(m.has("a")).toBe(false);
});

test("remove: returns original reference when key does not exist", () => {
	const original = Dict.from.entries([["a", 1]]);
	const result = pipe(original, Dict.remove("z"));
	expect(result).toBe(original);
});

// ---------------------------------------------------------------------------
// upsert
// ---------------------------------------------------------------------------

test("upsert: inserts when key is missing", () => {
	const m = pipe(
		Dict.empty<string, number>(),
		Dict.upsert("count", (opt: Maybe<number>) => (opt.kind === "Some" ? opt.value : 0) + 1),
	);
	expect(m.get("count")).toBe(1);
});

test("upsert: updates when key exists", () => {
	const m = pipe(
		Dict.singleton("count", 5),
		Dict.upsert("count", (opt: Maybe<number>) => (opt.kind === "Some" ? opt.value : 0) + 1),
	);
	expect(m.get("count")).toBe(6);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: transforms all values", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.map((n) => n * 10));
	expect(m.get("a")).toBe(10);
	expect(m.get("b")).toBe(20);
});

test("map: returns empty map when input is empty", () => {
	expect(pipe(Dict.empty<string, number>(), Dict.map((n) => n * 2)).size).toBe(0);
});

// ---------------------------------------------------------------------------
// mapWithKey
// ---------------------------------------------------------------------------

test("mapWithKey: receives key and value", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.mapWithKey((k, v) => `${k}:${v}`));
	expect(m.get("a")).toBe("a:1");
	expect(m.get("b")).toBe("b:2");
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("filter: keeps entries matching predicate", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 3], ["c", 0]]), Dict.filter((n) => n > 0));
	expect(m.size).toBe(2);
	expect(m.has("c")).toBe(false);
});

test("filter: returns empty map when nothing matches", () => {
	expect(pipe(Dict.from.entries([["a", 1]]), Dict.filter(() => false)).size).toBe(0);
});

// ---------------------------------------------------------------------------
// filterWithKey
// ---------------------------------------------------------------------------

test("filterWithKey: receives key and value", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 2], ["c", 3]]), Dict.filterWithKey((k, v) => k !== "b" && v < 3));
	expect(m.size).toBe(1);
	expect(m.get("a")).toBe(1);
});

// ---------------------------------------------------------------------------
// compact
// ---------------------------------------------------------------------------

test("compact: removes None values and unwraps Some values", () => {
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

test("compact: returns empty map when all values are None", () => {
	const m = Dict.compact(Dict.from.entries<string, Maybe<number>>([["a", Maybe.make.none()], ["b", Maybe.make.none()]]));
	expect(m.size).toBe(0);
});

// ---------------------------------------------------------------------------
// filterMap
// ---------------------------------------------------------------------------

test("filterMap: keeps entries where predicate returns Some", () => {
	const m = Dict.from.record({ a: "1", b: "two", c: "3" });
	const result = pipe(
		m,
		Dict.filterMap((s: string) => {
			const n = Number(s);
			return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
		}),
	);
	expect(Dict.to.record(result as ReadonlyMap<string, number>)).toStrictEqual({ a: 1, c: 3 });
});

test("filterMap: returns empty map when all entries return None", () => {
	const m = Dict.from.record({ a: "x", b: "y" });
	const result = pipe(m, Dict.filterMap((_: string): Maybe<number> => Maybe.make.none()));
	expect(result.size).toBe(0);
});

test("filterMap: preserves keys of matching entries", () => {
	const m = Dict.from.entries<number, number>([[1, 10], [2, -5], [3, 30]]);
	const result = pipe(m, Dict.filterMap((n: number) => n > 0 ? Maybe.make.some(n * 2) : Maybe.make.none()));
	expect([...result.entries()]).toStrictEqual([[1, 20], [3, 60]]);
});

// ---------------------------------------------------------------------------
// union
// ---------------------------------------------------------------------------

test("union: merges two maps with second map taking precedence", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.union(Dict.from.entries([["b", 99], ["c", 3]])));
	expect(m.get("a")).toBe(1);
	expect(m.get("b")).toBe(99);
	expect(m.get("c")).toBe(3);
});

test("union: returns equivalent map when second map is empty", () => {
	const base = Dict.from.entries([["a", 1]]);
	const result = pipe(base, Dict.union(Dict.empty<string, number>()));
	expect(Dict.entries(result)).toStrictEqual(Dict.entries(base));
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

test("intersection: keeps only common keys with left values", () => {
	const m = pipe(
		Dict.from.entries([["a", 1], ["b", 2], ["c", 3]]),
		Dict.intersection(Dict.from.entries([["b", 99], ["c", 0], ["d", 4]])),
	);
	expect(m.size).toBe(2);
	expect(m.get("b")).toBe(2);
	expect(m.get("c")).toBe(3);
});

test("intersection: returns empty map when no common keys", () => {
	const m = pipe(Dict.from.entries([["a", 1]]), Dict.intersection(Dict.from.entries([["b", 2]])));
	expect(m.size).toBe(0);
});

// ---------------------------------------------------------------------------
// difference
// ---------------------------------------------------------------------------

test("difference: removes keys present in second map", () => {
	const m = pipe(Dict.from.entries([["a", 1], ["b", 2], ["c", 3]]), Dict.difference(Dict.from.entries([["b", 0]])));
	expect(m.size).toBe(2);
	expect(m.has("b")).toBe(false);
	expect(m.get("a")).toBe(1);
});

test("difference: returns unchanged map when second map is empty", () => {
	const base = Dict.from.entries([["a", 1], ["b", 2]]);
	const result = pipe(base, Dict.difference(Dict.empty<string, number>()));
	expect(result.size).toBe(2);
});

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

test("reduce: folds all values", () => {
	const sum = Dict.reduce(0, (acc: number, v: number) => acc + v)(Dict.from.entries([["a", 1], ["b", 2], ["c", 3]]));
	expect(sum).toBe(6);
});

test("reduce: returns initial value for empty map", () => {
	expect(Dict.reduce(42, (acc: number, v: number) => acc + v)(Dict.empty())).toBe(42);
});

// ---------------------------------------------------------------------------
// reduceWithKey
// ---------------------------------------------------------------------------

test("reduceWithKey: receives key and value", () => {
	const keys: string[] = [];
	Dict.reduceWithKey(0, (acc, _v, k: string) => {
		keys.push(k);
		return acc;
	})(Dict.from.entries([["a", 1], ["b", 2]]));
	expect(keys).toStrictEqual(["a", "b"]);
});

test("reduceWithKey: folds using both key and value", () => {
	const result = Dict.reduceWithKey("", (acc, v: number, k: string) => `${acc}${k}:${v} `)(
		Dict.from.entries([["a", 1], ["b", 2]]),
	);
	expect(result).toBe("a:1 b:2 ");
});

// ---------------------------------------------------------------------------
// mergeWith
// ---------------------------------------------------------------------------

test("mergeWith: combines maps on key collisions", () => {
	const combine = Dict.mergeWith((a: number, b: number) => a + b);
	const map1 = Dict.from.entries([["a", 1], ["b", 2]]);
	const map2 = Dict.from.entries([["b", 3], ["c", 4]]);

	expect(combine(map1, map2)).toStrictEqual(Dict.from.entries([["a", 1], ["b", 5], ["c", 4]]));
	expect(pipe(map1, combine(map2))).toStrictEqual(Dict.from.entries([["a", 1], ["b", 5], ["c", 4]]));
});

// --- mapEntries & mapKeys ---

test("mapEntries: transforms keys and values simultaneously", () => {
	const res = pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.mapEntries((k, v) => [k.toUpperCase(), v * 10]));
	expect(res).toStrictEqual(Dict.from.entries([["A", 10], ["B", 20]]));
});

test("mapKeys: transforms keys while preserving values", () => {
	const res = pipe(Dict.from.entries([["a", 1], ["b", 2]]), Dict.mapKeys((k) => k.toUpperCase()));
	expect(res).toStrictEqual(Dict.from.entries([["A", 1], ["B", 2]]));
});

// ---------------------------------------------------------------------------
// toRecord
// ---------------------------------------------------------------------------

test("to.record: converts map to plain object", () => {
	expect(Dict.to.record(Dict.from.entries([["a", 1], ["b", 2]]))).toStrictEqual({ a: 1, b: 2 });
});

test("to.record: returns empty object for empty map", () => {
	expect(Dict.to.record(Dict.empty<string, unknown>())).toStrictEqual({});
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes from.record filter map and reduce", () => {
	const result = pipe(
		Dict.from.record({ alice: 85, bob: 92, carol: 60, dave: 77 }),
		Dict.filter((score) => score >= 75),
		Dict.map((score) => score + 5),
		Dict.reduce(0, (acc, score) => acc + score),
	);
	expect(result).toBe(269);
});

// ---------------------------------------------------------------------------
// Dict.NonEmpty
// ---------------------------------------------------------------------------

test("is.nonEmpty: returns true for non-empty map", () => {
	expect(Dict.is.nonEmpty(Dict.singleton("a", 1))).toBe(true);
});

test("is.nonEmpty: returns false for empty map", () => {
	expect(Dict.is.nonEmpty(Dict.empty())).toBe(false);
});

test("NonEmpty.singleton: creates single-entry map", () => {
	const result = Dict.NonEmpty.singleton("a", 1);
	expect(result.size).toBe(1);
	expect(result.get("a")).toBe(1);
	expectTypeOf(result).toEqualTypeOf<Dict.NonEmpty<string, number>>();
});

test("NonEmpty.from.map: returns Some for non-empty map", () => {
	const result = Dict.NonEmpty.from.map(Dict.singleton("a", 1));
	if (result.kind !== "Some") {
		throw new Error("Expected Some");
	}
	expect(result.value.size).toBe(1);
	expectTypeOf(result.value).toEqualTypeOf<Dict.NonEmpty<string, number>>();
});

test("NonEmpty.from.map: returns None for empty map", () => {
	const result = Dict.NonEmpty.from.map(Dict.empty());
	expect(result.kind).toBe("None");
});

test("NonEmpty.keys: returns non-empty array of keys", () => {
	const m = Dict.NonEmpty.singleton("a", 1);
	const keys = Dict.NonEmpty.keys(m);
	expect(keys).toStrictEqual(["a"]);
	expectTypeOf(keys).toEqualTypeOf<readonly [string, ...string[]]>();
});

test("NonEmpty.values: returns non-empty array of values", () => {
	const m = Dict.NonEmpty.singleton("a", 1);
	const values = Dict.NonEmpty.values(m);
	expect(values).toStrictEqual([1]);
	expectTypeOf(values).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("NonEmpty.entries: returns non-empty array of entries", () => {
	const m = Dict.NonEmpty.singleton("a", 1);
	const entries = Dict.NonEmpty.entries(m);
	expect(entries).toStrictEqual([["a", 1]]);
	expectTypeOf(entries).toEqualTypeOf<readonly [readonly [string, number], ...(readonly [string, number])[]]>();
});

test("NonEmpty.reduce: reduces non-empty map values without seed", () => {
	const m = Dict.NonEmpty.singleton("a", 10);
	const result = pipe(m, Dict.NonEmpty.reduce((a, b) => a + b));
	expect(result).toBe(10);
});

test("map: returns standard ReadonlyMap when called on NonEmpty", () => {
	const m = Dict.NonEmpty.singleton("a", 10);
	const mapped = Dict.map((n: number) => n * 2)(m);
	expect(mapped.get("a")).toBe(20);
	expectTypeOf(mapped).toEqualTypeOf<ReadonlyMap<string, number>>();
});

test("mapWithKey: returns standard ReadonlyMap when called on NonEmpty", () => {
	const m = Dict.NonEmpty.singleton("a", 10);
	const mapped = Dict.mapWithKey((k: string, v: number) => `${k}:${v}`)(m);
	expect(mapped.get("a")).toBe("a:10");
	expectTypeOf(mapped).toEqualTypeOf<ReadonlyMap<string, string>>();
});

test("NonEmpty.map: maps values and preserves NonEmpty type", () => {
	const m = Dict.NonEmpty.singleton("a", 10);
	const mapped = pipe(m, Dict.NonEmpty.map((n) => n * 2));
	expect(mapped.get("a")).toBe(20);
	expectTypeOf(mapped).toEqualTypeOf<Dict.NonEmpty<string, number>>();
});

test("NonEmpty.mapWithKey: maps values with key and preserves NonEmpty type", () => {
	const m = Dict.NonEmpty.singleton("a", 10);
	const mapped = pipe(m, Dict.NonEmpty.mapWithKey((k, v) => `${k}:${v}`));
	expect(mapped.get("a")).toBe("a:10");
	expectTypeOf(mapped).toEqualTypeOf<Dict.NonEmpty<string, string>>();
});

test("NonEmpty: composes in pipe workflow", () => {
	const result = pipe(Dict.NonEmpty.singleton("a", 5), Dict.NonEmpty.map((n) => n * 2), Dict.NonEmpty.keys);
	expect(result).toStrictEqual(["a"]);
	expectTypeOf(result).toEqualTypeOf<readonly [string, ...string[]]>();
});

test("from.nullable: handles nullable maps", () => {
	const m = Dict.from.entries([["a", 1], ["b", 2]]);
	expect(m.get("a")).toBe(1);

	expect(Dict.from.nullable(m)).toStrictEqual(Maybe.make.some(m));
	expect(Dict.from.nullable(null)).toStrictEqual(Maybe.make.none());
	expect(Dict.from.nullable(undefined)).toStrictEqual(Maybe.make.none());
});
