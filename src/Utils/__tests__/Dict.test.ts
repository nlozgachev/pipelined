import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Dict } from "../Dict.ts";
import { Option } from "#core/Option.ts";
import { pipe } from "#composition/pipe.ts";

// ---------------------------------------------------------------------------
// empty
// ---------------------------------------------------------------------------

Deno.test("Dict.empty returns a ReadonlyMap with size 0", () => {
	const m = Dict.empty<string, number>();
	assertStrictEquals(m.size, 0);
});

// ---------------------------------------------------------------------------
// singleton
// ---------------------------------------------------------------------------

Deno.test("Dict.singleton returns a ReadonlyMap with one entry", () => {
	const m = Dict.singleton("a", 1);
	assertStrictEquals(m.size, 1);
	assertStrictEquals(m.get("a"), 1);
});

// ---------------------------------------------------------------------------
// fromEntries
// ---------------------------------------------------------------------------

Deno.test("Dict.fromEntries creates a map from key-value pairs", () => {
	const m = Dict.fromEntries([["a", 1], ["b", 2]]);
	assertStrictEquals(m.size, 2);
	assertStrictEquals(m.get("a"), 1);
	assertStrictEquals(m.get("b"), 2);
});

Deno.test("Dict.fromEntries returns empty map for empty array", () => {
	assertStrictEquals(Dict.fromEntries([]).size, 0);
});

// ---------------------------------------------------------------------------
// fromRecord
// ---------------------------------------------------------------------------

Deno.test("Dict.fromRecord creates a map from a plain object", () => {
	const m = Dict.fromRecord({ x: 10, y: 20 });
	assertStrictEquals(m.get("x"), 10);
	assertStrictEquals(m.get("y"), 20);
});

// ---------------------------------------------------------------------------
// groupBy
// ---------------------------------------------------------------------------

Deno.test("Dict.groupBy groups items by key function", () => {
	const m = pipe([1, 2, 3, 4, 5], Dict.groupBy((n) => n % 2 === 0 ? "even" : "odd"));
	assertEquals([...m.get("odd")!], [1, 3, 5]);
	assertEquals([...m.get("even")!], [2, 4]);
});

Deno.test("Dict.groupBy returns empty map for empty array", () => {
	assertStrictEquals(pipe([], Dict.groupBy((n: number) => n % 2)).size, 0);
});

Deno.test("Dict.groupBy all elements map to same key", () => {
	const m = pipe([1, 2, 3], Dict.groupBy(() => "all"));
	assertStrictEquals(m.size, 1);
	assertEquals([...m.get("all")!], [1, 2, 3]);
});

Deno.test("Dict.groupBy each element maps to a unique key", () => {
	const m = pipe([1, 2, 3], Dict.groupBy((n) => n));
	assertStrictEquals(m.size, 3);
	assertEquals([...m.get(1)!], [1]);
});

Deno.test("Dict.groupBy preserves insertion order within each group", () => {
	const items = ["banana", "avocado", "blueberry", "apricot"];
	const m = pipe(items, Dict.groupBy((s) => s[0]));
	assertEquals([...m.get("b")!], ["banana", "blueberry"]);
	assertEquals([...m.get("a")!], ["avocado", "apricot"]);
});

// ---------------------------------------------------------------------------
// has
// ---------------------------------------------------------------------------

Deno.test("Dict.has returns true when key exists", () => {
	const m = Dict.fromEntries([["a", 1]]);
	assertStrictEquals(pipe(m, Dict.has("a")), true);
});

Deno.test("Dict.has returns false when key does not exist", () => {
	const m = Dict.fromEntries([["a", 1]]);
	assertStrictEquals(pipe(m, Dict.has("b")), false);
});

Deno.test("Dict.has returns false on empty map", () => {
	assertStrictEquals(pipe(Dict.empty<string, number>(), Dict.has("a")), false);
});

// ---------------------------------------------------------------------------
// lookup
// ---------------------------------------------------------------------------

Deno.test("Dict.lookup returns Some when key exists", () => {
	const m = Dict.fromEntries([["a", 42]]);
	assertEquals(pipe(m, Dict.lookup("a")), Option.some(42));
});

Deno.test("Dict.lookup returns None when key does not exist", () => {
	const m = Dict.fromEntries([["a", 42]]);
	assertEquals(pipe(m, Dict.lookup("b")), Option.none());
});

Deno.test("Dict.lookup returns None on empty map", () => {
	assertEquals(pipe(Dict.empty<string, number>(), Dict.lookup("a")), Option.none());
});

// ---------------------------------------------------------------------------
// size
// ---------------------------------------------------------------------------

Deno.test("Dict.size returns the number of entries", () => {
	assertStrictEquals(Dict.size(Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]])), 3);
	assertStrictEquals(Dict.size(Dict.empty()), 0);
});

// ---------------------------------------------------------------------------
// isEmpty
// ---------------------------------------------------------------------------

Deno.test("Dict.isEmpty returns true for an empty map", () => {
	assertStrictEquals(Dict.isEmpty(Dict.empty()), true);
});

Deno.test("Dict.isEmpty returns false for a non-empty map", () => {
	assertStrictEquals(Dict.isEmpty(Dict.singleton("a", 1)), false);
});

// ---------------------------------------------------------------------------
// keys / values / entries
// ---------------------------------------------------------------------------

Deno.test("Dict.keys returns all keys in insertion order", () => {
	assertEquals(Dict.keys(Dict.fromEntries([["b", 2], ["a", 1]])), ["b", "a"]);
});

Deno.test("Dict.values returns all values in insertion order", () => {
	assertEquals(Dict.values(Dict.fromEntries([["a", 1], ["b", 2]])), [1, 2]);
});

Deno.test("Dict.entries returns all key-value pairs in insertion order", () => {
	assertEquals(Dict.entries(Dict.fromEntries([["a", 1], ["b", 2]])), [["a", 1], ["b", 2]]);
});

// ---------------------------------------------------------------------------
// insert
// ---------------------------------------------------------------------------

Deno.test("Dict.insert adds a new key", () => {
	const m = pipe(Dict.fromEntries([["a", 1]]), Dict.insert("b", 2));
	assertStrictEquals(m.size, 2);
	assertStrictEquals(m.get("b"), 2);
});

Deno.test("Dict.insert replaces an existing key", () => {
	const m = pipe(Dict.fromEntries([["a", 1]]), Dict.insert("a", 99));
	assertStrictEquals(m.size, 1);
	assertStrictEquals(m.get("a"), 99);
});

Deno.test("Dict.insert does not mutate the original", () => {
	const original = Dict.fromEntries([["a", 1]]);
	pipe(original, Dict.insert("b", 2));
	assertStrictEquals(original.size, 1);
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

Deno.test("Dict.remove removes an existing key", () => {
	const m = pipe(Dict.fromEntries([["a", 1], ["b", 2]]), Dict.remove("a"));
	assertStrictEquals(m.size, 1);
	assertStrictEquals(m.has("a"), false);
});

Deno.test("Dict.remove returns original when key does not exist", () => {
	const original = Dict.fromEntries([["a", 1]]);
	const result = pipe(original, Dict.remove("z"));
	assertStrictEquals(result, original);
});

// ---------------------------------------------------------------------------
// upsert
// ---------------------------------------------------------------------------

Deno.test("Dict.upsert inserts when key is missing", () => {
	const m = pipe(
		Dict.empty<string, number>(),
		Dict.upsert("count", (opt: Option<number>) => (opt.kind === "Some" ? opt.value : 0) + 1),
	);
	assertStrictEquals(m.get("count"), 1);
});

Deno.test("Dict.upsert updates when key exists", () => {
	const m = pipe(
		Dict.singleton("count", 5),
		Dict.upsert("count", (opt: Option<number>) => (opt.kind === "Some" ? opt.value : 0) + 1),
	);
	assertStrictEquals(m.get("count"), 6);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("Dict.map transforms all values", () => {
	const m = pipe(Dict.fromEntries([["a", 1], ["b", 2]]), Dict.map((n) => n * 10));
	assertStrictEquals(m.get("a"), 10);
	assertStrictEquals(m.get("b"), 20);
});

Deno.test("Dict.map returns empty map when input is empty", () => {
	assertStrictEquals(pipe(Dict.empty<string, number>(), Dict.map((n) => n * 2)).size, 0);
});

// ---------------------------------------------------------------------------
// mapWithKey
// ---------------------------------------------------------------------------

Deno.test("Dict.mapWithKey receives the key and value", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1], ["b", 2]]),
		Dict.mapWithKey((k, v) => `${k}:${v}`),
	);
	assertStrictEquals(m.get("a"), "a:1");
	assertStrictEquals(m.get("b"), "b:2");
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

Deno.test("Dict.filter keeps entries matching predicate", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1], ["b", 3], ["c", 0]]),
		Dict.filter((n) => n > 0),
	);
	assertStrictEquals(m.size, 2);
	assertStrictEquals(m.has("c"), false);
});

Deno.test("Dict.filter returns empty map when nothing matches", () => {
	assertStrictEquals(
		pipe(Dict.fromEntries([["a", 1]]), Dict.filter(() => false)).size,
		0,
	);
});

// ---------------------------------------------------------------------------
// filterWithKey
// ---------------------------------------------------------------------------

Deno.test("Dict.filterWithKey receives key and value", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]]),
		Dict.filterWithKey((k, v) => k !== "b" && v < 3),
	);
	assertStrictEquals(m.size, 1);
	assertStrictEquals(m.get("a"), 1);
});

// ---------------------------------------------------------------------------
// compact
// ---------------------------------------------------------------------------

Deno.test("Dict.compact removes None values and unwraps Some values", () => {
	const m = Dict.compact(
		Dict.fromEntries<string, Option<number>>([
			["a", Option.some(1)],
			["b", Option.none()],
			["c", Option.some(3)],
		]),
	);
	assertStrictEquals(m.size, 2);
	assertStrictEquals(m.get("a"), 1);
	assertStrictEquals(m.has("b"), false);
	assertStrictEquals(m.get("c"), 3);
});

Deno.test("Dict.compact returns empty map when all values are None", () => {
	const m = Dict.compact(
		Dict.fromEntries<string, Option<number>>([["a", Option.none()], ["b", Option.none()]]),
	);
	assertStrictEquals(m.size, 0);
});

// ---------------------------------------------------------------------------
// union
// ---------------------------------------------------------------------------

Deno.test("Dict.union merges two maps with other taking precedence", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1], ["b", 2]]),
		Dict.union(Dict.fromEntries([["b", 99], ["c", 3]])),
	);
	assertStrictEquals(m.get("a"), 1);
	assertStrictEquals(m.get("b"), 99);
	assertStrictEquals(m.get("c"), 3);
});

Deno.test("Dict.union with empty other returns equivalent map", () => {
	const base = Dict.fromEntries([["a", 1]]);
	const result = pipe(base, Dict.union(Dict.empty<string, number>()));
	assertEquals(Dict.entries(result), Dict.entries(base));
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

Deno.test("Dict.intersection keeps only common keys with left values", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]]),
		Dict.intersection(Dict.fromEntries([["b", 99], ["c", 0], ["d", 4]])),
	);
	assertStrictEquals(m.size, 2);
	assertStrictEquals(m.get("b"), 2);
	assertStrictEquals(m.get("c"), 3);
});

Deno.test("Dict.intersection returns empty map when no common keys", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1]]),
		Dict.intersection(Dict.fromEntries([["b", 2]])),
	);
	assertStrictEquals(m.size, 0);
});

// ---------------------------------------------------------------------------
// difference
// ---------------------------------------------------------------------------

Deno.test("Dict.difference removes keys present in other", () => {
	const m = pipe(
		Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]]),
		Dict.difference(Dict.fromEntries([["b", 0]])),
	);
	assertStrictEquals(m.size, 2);
	assertStrictEquals(m.has("b"), false);
	assertStrictEquals(m.get("a"), 1);
});

Deno.test("Dict.difference returns unchanged map when other is empty", () => {
	const base = Dict.fromEntries([["a", 1], ["b", 2]]);
	const result = pipe(base, Dict.difference(Dict.empty<string, number>()));
	assertStrictEquals(result.size, 2);
});

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

Deno.test("Dict.reduce folds all values", () => {
	const sum = Dict.reduce(0, (acc: number, v: number) => acc + v)(
		Dict.fromEntries([["a", 1], ["b", 2], ["c", 3]]),
	);
	assertStrictEquals(sum, 6);
});

Deno.test("Dict.reduce returns init for empty map", () => {
	assertStrictEquals(
		Dict.reduce(42, (acc: number, v: number) => acc + v)(Dict.empty()),
		42,
	);
});

// ---------------------------------------------------------------------------
// reduceWithKey
// ---------------------------------------------------------------------------

Deno.test("Dict.reduceWithKey receives key and value", () => {
	const keys: string[] = [];
	Dict.reduceWithKey(0, (acc, _v, k: string) => {
		keys.push(k);
		return acc;
	})(
		Dict.fromEntries([["a", 1], ["b", 2]]),
	);
	assertEquals(keys, ["a", "b"]);
});

Deno.test("Dict.reduceWithKey folds using both key and value", () => {
	const result = Dict.reduceWithKey("", (acc, v: number, k: string) => acc + k + ":" + v + " ")(
		Dict.fromEntries([["a", 1], ["b", 2]]),
	);
	assertStrictEquals(result, "a:1 b:2 ");
});

// ---------------------------------------------------------------------------
// toRecord
// ---------------------------------------------------------------------------

Deno.test("Dict.toRecord converts to plain object", () => {
	assertEquals(
		Dict.toRecord(Dict.fromEntries([["a", 1], ["b", 2]])),
		{ a: 1, b: 2 },
	);
});

Deno.test("Dict.toRecord returns empty object for empty map", () => {
	assertEquals(Dict.toRecord(Dict.empty()), {});
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("Dict pipe composition — fromRecord, filter, map, reduce", () => {
	const result = pipe(
		Dict.fromRecord({ alice: 85, bob: 92, carol: 60, dave: 77 }),
		Dict.filter((score) => score >= 75),
		Dict.map((score) => score + 5),
		Dict.reduce(0, (acc, score) => acc + score),
	);
	// alice: 90, bob: 97, dave: 82 → 269
	assertStrictEquals(result, 269);
});
