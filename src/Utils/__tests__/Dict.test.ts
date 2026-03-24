import { pipe } from "#composition/pipe.ts";
import { Maybe } from "#core/Maybe.ts";
import { expect, test } from "vitest";
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

test("Dict.fromEntries creates a map from key-value pairs", () => {
	const m = Dict.fromEntries([["a", 1], ["b", 2]]);
	expect(m.size).toBe(2);
	expect(m.get("a")).toBe(1);
	expect(m.get("b")).toBe(2);
});

test("Dict.fromEntries returns empty map for empty array", () => {
	expect(Dict.fromEntries([]).size).toBe(0);
});

// ---------------------------------------------------------------------------
// fromRecord
// ---------------------------------------------------------------------------

test("Dict.fromRecord creates a map from a plain object", () => {
	const m = Dict.fromRecord({ x: 10, y: 20 });
	expect(m.get("x")).toBe(10);
	expect(m.get("y")).toBe(20);
});

// ---------------------------------------------------------------------------
// groupBy
// ---------------------------------------------------------------------------

test("Dict.groupBy groups items by key function", () => {
	const m = pipe([1, 2, 3, 4, 5], Dict.groupBy((n) => n % 2 === 0 ? "even" : "odd"));
	expect([...m.get("odd")!]).toEqual([1, 3, 5]);
	expect([...m.get("even")!]).toEqual([2, 4]);
});

test("Dict.groupBy returns empty map for empty array", () => {
	expect(pipe([], Dict.groupBy((n: number) => n % 2)).size).toBe(0);
});

test("Dict.groupBy all elements map to same key", () => {
	const m = pipe([1, 2, 3], Dict.groupBy(() => "all"));
	expect(m.size).toBe(1);
	expect([...m.get("all")!]).toEqual([1, 2, 3]);
});

test("Dict.groupBy each element maps to a unique key", () => {
	const m = pipe([1, 2, 3], Dict.groupBy((n) => n));
	expect(m.size).toBe(3);
	expect([...m.get(1)!]).toEqual([1]);
});

test("Dict.groupBy preserves insertion order within each group", () => {
	const items = ["banana", "avocado", "blueberry", "apricot"];
	const m = pipe(items, Dict.groupBy((s) => s[0]));
	expect([...m.get("b")!]).toEqual(["banana", "blueberry"]);
	expect([...m.get("a")!]).toEqual(["avocado", "apricot"]);
});

// ---------------------------------------------------------------------------
// has
// ---------------------------------------------------------------------------

test("Dict.has returns true when key exists", () => {
	const m = Dict.fromEntries([["a", 1]]);
	expect(pipe(m, Dict.has("a"))).toBe(true);
});

test("Dict.has returns false when key does not exist", () => {
	const m = Dict.fromEntries([["a", 1]]);
	expect(pipe(m, Dict.has("b"))).toBe(false);
});

test("Dict.has returns false on empty map", () => {
	expect(pipe(Dict.empty<string, number>(), Dict.has("a"))).toBe(false);
});

// ---------------------------------------------------------------------------
// lookup
// ---------------------------------------------------------------------------

test("Dict.lookup returns Some when key exists", () => {
	const m = Dict.fromEntries([["a", 42]]);
	expect(pipe(m, Dict.lookup("a"))).toEqual(Maybe.some(42));
});

test("Dict.lookup returns None when key does not exist", () => {
	const m = Dict.fromEntries([["a", 42]]);
	expect(pipe(m, Dict.lookup("b"))).toEqual(Maybe.none());
});

test("Dict.lookup returns None on empty map", () => {
	expect(pipe(Dict.empty<string, number>(), Dict.lookup("a"))).toEqual(Maybe.none());
});

// ---------------------------------------------------------------------------
// size
// ---------------------------------------------------------------------------

test("Dict.size returns the number of entries", () => {
	expect(Dict.size(Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]]))).toBe(3);
	expect(Dict.size(Dict.empty())).toBe(0);
});

// ---------------------------------------------------------------------------
// isEmpty
// ---------------------------------------------------------------------------

test("Dict.isEmpty returns true for an empty map", () => {
	expect(Dict.isEmpty(Dict.empty())).toBe(true);
});

test("Dict.isEmpty returns false for a non-empty map", () => {
	expect(Dict.isEmpty(Dict.singleton("a", 1))).toBe(false);
});

// ---------------------------------------------------------------------------
// keys / values / entries
// ---------------------------------------------------------------------------

test("Dict.keys returns all keys in insertion order", () => {
	expect(Dict.keys(Dict.fromEntries([["b", 2], ["a", 1]]))).toEqual(["b", "a"]);
});

test("Dict.values returns all values in insertion order", () => {
	expect(Dict.values(Dict.fromEntries([["a", 1], ["b", 2]]))).toEqual([1, 2]);
});

test("Dict.entries returns all key-value pairs in insertion order", () => {
	expect(Dict.entries(Dict.fromEntries([["a", 1], ["b", 2]]))).toEqual([["a", 1], ["b", 2]]);
});

// ---------------------------------------------------------------------------
// insert
// ---------------------------------------------------------------------------

test("Dict.insert adds a new key", () => {
	const m = pipe(Dict.fromEntries([["a", 1]]), Dict.insert("b", 2));
	expect(m.size).toBe(2);
	expect(m.get("b")).toBe(2);
});

test("Dict.insert replaces an existing key", () => {
	const m = pipe(Dict.fromEntries([["a", 1]]), Dict.insert("a", 99));
	expect(m.size).toBe(1);
	expect(m.get("a")).toBe(99);
});

test("Dict.insert does not mutate the original", () => {
	const original = Dict.fromEntries([["a", 1]]);
	pipe(original, Dict.insert("b", 2));
	expect(original.size).toBe(1);
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

test("Dict.remove removes an existing key", () => {
	const m = pipe(Dict.fromEntries([["a", 1], ["b", 2]]), Dict.remove("a"));
	expect(m.size).toBe(1);
	expect(m.has("a")).toBe(false);
});

test("Dict.remove returns original when key does not exist", () => {
	const original = Dict.fromEntries([["a", 1]]);
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
	const m = pipe(Dict.fromEntries([["a", 1], ["b", 2]]), Dict.map((n) => n * 10));
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
	const m = pipe(
		Dict.fromEntries([["a", 1], ["b", 2]]),
		Dict.mapWithKey((k, v) => `${k}:${v}`),
	);
	expect(m.get("a")).toBe("a:1");
	expect(m.get("b")).toBe("b:2");
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("Dict.filter keeps entries matching predicate", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1], ["b", 3], ["c", 0]]),
		Dict.filter((n) => n > 0),
	);
	expect(m.size).toBe(2);
	expect(m.has("c")).toBe(false);
});

test("Dict.filter returns empty map when nothing matches", () => {
	expect(pipe(Dict.fromEntries([["a", 1]]), Dict.filter(() => false)).size).toBe(0);
});

// ---------------------------------------------------------------------------
// filterWithKey
// ---------------------------------------------------------------------------

test("Dict.filterWithKey receives key and value", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]]),
		Dict.filterWithKey((k, v) => k !== "b" && v < 3),
	);
	expect(m.size).toBe(1);
	expect(m.get("a")).toBe(1);
});

// ---------------------------------------------------------------------------
// compact
// ---------------------------------------------------------------------------

test("Dict.compact removes None values and unwraps Some values", () => {
	const m = Dict.compact(
		Dict.fromEntries<string, Maybe<number>>([
			["a", Maybe.some(1)],
			["b", Maybe.none()],
			["c", Maybe.some(3)],
		]),
	);
	expect(m.size).toBe(2);
	expect(m.get("a")).toBe(1);
	expect(m.has("b")).toBe(false);
	expect(m.get("c")).toBe(3);
});

test("Dict.compact returns empty map when all values are None", () => {
	const m = Dict.compact(
		Dict.fromEntries<string, Maybe<number>>([["a", Maybe.none()], ["b", Maybe.none()]]),
	);
	expect(m.size).toBe(0);
});

// ---------------------------------------------------------------------------
// union
// ---------------------------------------------------------------------------

test("Dict.union merges two maps with other taking precedence", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1], ["b", 2]]),
		Dict.union(Dict.fromEntries([["b", 99], ["c", 3]])),
	);
	expect(m.get("a")).toBe(1);
	expect(m.get("b")).toBe(99);
	expect(m.get("c")).toBe(3);
});

test("Dict.union with empty other returns equivalent map", () => {
	const base = Dict.fromEntries([["a", 1]]);
	const result = pipe(base, Dict.union(Dict.empty<string, number>()));
	expect(Dict.entries(result)).toEqual(Dict.entries(base));
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

test("Dict.intersection keeps only common keys with left values", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]]),
		Dict.intersection(Dict.fromEntries([["b", 99], ["c", 0], ["d", 4]])),
	);
	expect(m.size).toBe(2);
	expect(m.get("b")).toBe(2);
	expect(m.get("c")).toBe(3);
});

test("Dict.intersection returns empty map when no common keys", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1]]),
		Dict.intersection(Dict.fromEntries([["b", 2]])),
	);
	expect(m.size).toBe(0);
});

// ---------------------------------------------------------------------------
// difference
// ---------------------------------------------------------------------------

test("Dict.difference removes keys present in other", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]]),
		Dict.difference(Dict.fromEntries([["b", 0]])),
	);
	expect(m.size).toBe(2);
	expect(m.has("b")).toBe(false);
	expect(m.get("a")).toBe(1);
});

test("Dict.difference returns unchanged map when other is empty", () => {
	const base = Dict.fromEntries([["a", 1], ["b", 2]]);
	const result = pipe(base, Dict.difference(Dict.empty<string, number>()));
	expect(result.size).toBe(2);
});

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

test("Dict.reduce folds all values", () => {
	const sum = Dict.reduce(0, (acc: number, v: number) => acc + v)(
		Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]]),
	);
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
	})(
		Dict.fromEntries([["a", 1], ["b", 2]]),
	);
	expect(keys).toEqual(["a", "b"]);
});

test("Dict.reduceWithKey folds using both key and value", () => {
	const result = Dict.reduceWithKey("", (acc, v: number, k: string) => `${acc}${k}:${v} `)(
		Dict.fromEntries([["a", 1], ["b", 2]]),
	);
	expect(result).toBe("a:1 b:2 ");
});

// ---------------------------------------------------------------------------
// toRecord
// ---------------------------------------------------------------------------

test("Dict.toRecord converts to plain object", () => {
	expect(Dict.toRecord(Dict.fromEntries([["a", 1], ["b", 2]]))).toEqual({ a: 1, b: 2 });
});

test("Dict.toRecord returns empty object for empty map", () => {
	expect(Dict.toRecord(Dict.empty())).toEqual({});
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Dict pipe composition — fromRecord, filter, map, reduce", () => {
	const result = pipe(
		Dict.fromRecord({ alice: 85, bob: 92, carol: 60, dave: 77 }),
		Dict.filter((score) => score >= 75),
		Dict.map((score) => score + 5),
		Dict.reduce(0, (acc, score) => acc + score),
	);
	// alice: 90, bob: 97, dave: 82 → 269
	expect(result).toBe(269);
});
