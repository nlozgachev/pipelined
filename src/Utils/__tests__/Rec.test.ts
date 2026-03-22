import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Rec } from "../Rec.ts";
import { Option } from "#core/Option.ts";
import { pipe } from "#composition/pipe.ts";

// =============================================================================
// Transform: map, mapWithKey, filter, filterWithKey
// =============================================================================

Deno.test("map - transforms each value in a record", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 },
		Rec.map((n) => n * 10),
	);
	assertEquals(result, { a: 10, b: 20, c: 30 });
});

Deno.test("map - returns empty record for empty input", () => {
	const result = pipe(
		{} as Record<string, number>,
		Rec.map((n) => n * 2),
	);
	assertEquals(result, {});
});

Deno.test("map - transforms value types", () => {
	const result = pipe(
		{ x: 1, y: 2 },
		Rec.map((n) => String(n)),
	);
	assertEquals(result, { x: "1", y: "2" });
});

Deno.test("mapWithKey - transforms values with access to key", () => {
	const result = pipe(
		{ a: 1, b: 2 },
		Rec.mapWithKey((k, v) => `${k}:${v}`),
	);
	assertEquals(result, { a: "a:1", b: "b:2" });
});

Deno.test("mapWithKey - returns empty record for empty input", () => {
	const result = pipe(
		{} as Record<string, number>,
		Rec.mapWithKey((k, v) => `${k}=${v}`),
	);
	assertEquals(result, {});
});

Deno.test("mapWithKey - key is available for logic", () => {
	const result = pipe(
		{ name: "Alice", age: "30" },
		Rec.mapWithKey((k, v) => (k === "name" ? v.toUpperCase() : v)),
	);
	assertEquals(result, { name: "ALICE", age: "30" });
});

Deno.test("filter - keeps values satisfying the predicate", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3, d: 4 },
		Rec.filter((n) => n > 2),
	);
	assertEquals(result, { c: 3, d: 4 });
});

Deno.test("filter - returns empty when nothing matches", () => {
	const result = pipe(
		{ a: 1, b: 2 },
		Rec.filter((n) => n > 10),
	);
	assertEquals(result, {});
});

Deno.test("filter - returns empty for empty input", () => {
	const result = pipe(
		{} as Record<string, number>,
		Rec.filter((_) => true),
	);
	assertEquals(result, {});
});

Deno.test("filter - keeps all when all match", () => {
	const result = pipe(
		{ a: 1, b: 2 },
		Rec.filter((n) => n > 0),
	);
	assertEquals(result, { a: 1, b: 2 });
});

Deno.test("filterWithKey - filters using both key and value", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 },
		Rec.filterWithKey((k, v) => k !== "b" && v > 0),
	);
	assertEquals(result, { a: 1, c: 3 });
});

Deno.test("filterWithKey - filters by key only", () => {
	const result = pipe(
		{ keep: 1, drop: 2, keep2: 3 },
		Rec.filterWithKey((k, _v) => k.startsWith("keep")),
	);
	assertEquals(result, { keep: 1, keep2: 3 });
});

Deno.test("filterWithKey - returns empty for empty input", () => {
	const result = pipe(
		{} as Record<string, number>,
		Rec.filterWithKey((_k, _v) => true),
	);
	assertEquals(result, {});
});

// =============================================================================
// Lookup
// =============================================================================

Deno.test("lookup - returns Some for existing key", () => {
	const result = pipe({ a: 1, b: 2, c: 3 }, Rec.lookup("b"));
	assertEquals(result, Option.some(2));
});

Deno.test("lookup - returns None for missing key", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.lookup("z"));
	assertEquals(result, Option.none());
});

Deno.test("lookup - returns None for empty record", () => {
	const result = pipe({} as Record<string, number>, Rec.lookup("a"));
	assertEquals(result, Option.none());
});

Deno.test("lookup - returns Some even if value is falsy (0)", () => {
	const result = pipe({ a: 0 }, Rec.lookup("a"));
	assertEquals(result, Option.some(0));
});

Deno.test("lookup - returns Some even if value is falsy (empty string)", () => {
	const result = pipe({ a: "" }, Rec.lookup("a"));
	assertEquals(result, Option.some(""));
});

Deno.test("lookup - returns Some even if value is falsy (false)", () => {
	const result = pipe({ a: false }, Rec.lookup("a"));
	assertEquals(result, Option.some(false));
});

Deno.test("lookup - does not find inherited properties", () => {
	const obj = Object.create({ inherited: 42 });
	obj.own = 1;
	const result = pipe(obj, Rec.lookup("inherited"));
	assertEquals(result, Option.none());
});

// =============================================================================
// Destructure: keys, values, entries, fromEntries
// =============================================================================

Deno.test("keys - returns all keys of a record", () => {
	const result = Rec.keys({ a: 1, b: 2, c: 3 });
	assertEquals(result, ["a", "b", "c"]);
});

Deno.test("keys - returns empty array for empty record", () => {
	const result = Rec.keys({});
	assertEquals(result, []);
});

Deno.test("values - returns all values of a record", () => {
	const result = Rec.values({ a: 10, b: 20, c: 30 });
	assertEquals(result, [10, 20, 30]);
});

Deno.test("values - returns empty array for empty record", () => {
	const result = Rec.values({});
	assertEquals(result, []);
});

Deno.test("entries - returns all key-value pairs", () => {
	const result = Rec.entries({ a: 1, b: 2 });
	assertEquals(result, [
		["a", 1],
		["b", 2],
	]);
});

Deno.test("entries - returns empty array for empty record", () => {
	const result = Rec.entries({});
	assertEquals(result, []);
});

Deno.test("fromEntries - creates record from key-value pairs", () => {
	const result = Rec.fromEntries([
		["a", 1],
		["b", 2],
		["c", 3],
	]);
	assertEquals(result, { a: 1, b: 2, c: 3 });
});

Deno.test("fromEntries - returns empty record for empty array", () => {
	const result = Rec.fromEntries([] as [string, number][]);
	assertEquals(result, {});
});

Deno.test("fromEntries - last entry wins for duplicate keys", () => {
	const result = Rec.fromEntries([
		["a", 1],
		["a", 2],
	]);
	assertEquals(result, { a: 2 });
});

Deno.test("entries and fromEntries are inverses", () => {
	const original = { x: 10, y: 20, z: 30 };
	const roundTripped = Rec.fromEntries(Rec.entries(original));
	assertEquals(roundTripped, original);
});

// =============================================================================
// Select: pick, omit
// =============================================================================

Deno.test("pick - selects specified keys", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 } as Record<string, number>,
		Rec.pick("a", "c"),
	);
	assertEquals(result, { a: 1, c: 3 });
});

Deno.test("pick - ignores keys not in record", () => {
	// @ts-expect-error 'x' does not exist on the record
	const result = pipe({ a: 1, b: 2 }, Rec.pick("x", "a"));
	assertEquals(result, { a: 1 });
});

Deno.test("pick - returns empty when no keys match", () => {
	const result = pipe(
		{ a: 1, b: 2 } as Record<string, number>,
		Rec.pick("x", "y"),
	);
	assertEquals(result, {} as typeof result);
});

Deno.test("pick - with single key", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 } as Record<string, number>,
		Rec.pick("b"),
	);
	assertEquals(result, { b: 2 });
});

Deno.test("omit - removes specified keys", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 } as Record<string, number>,
		Rec.omit("b"),
	);
	assertEquals(result, { a: 1, c: 3 });
});

Deno.test("omit - ignores keys not in record", () => {
	const result = pipe({ a: 1, b: 2 } as Record<string, number>, Rec.omit("z"));
	assertEquals(result, { a: 1, b: 2 });
});

Deno.test("omit - multiple keys", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3, d: 4 } as Record<string, number>,
		Rec.omit("a", "c"),
	);
	assertEquals(result, { b: 2, d: 4 });
});

Deno.test("omit - all keys results in empty record", () => {
	const result = pipe(
		{ a: 1, b: 2 } as Record<string, number>,
		Rec.omit("a", "b"),
	);
	assertEquals(result, {});
});

Deno.test("omit - empty record returns empty record", () => {
	const result = pipe({} as Record<string, number>, Rec.omit("a"));
	assertEquals(result, {});
});

// =============================================================================
// Combine: merge
// =============================================================================

Deno.test("merge - combines two records", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.merge({ c: 3, d: 4 }));
	assertEquals(result, { a: 1, b: 2, c: 3, d: 4 });
});

Deno.test("merge - second record overrides first on conflict", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.merge({ b: 99, c: 3 }));
	assertEquals(result, { a: 1, b: 99, c: 3 });
});

Deno.test("merge - merging with empty record returns original", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.merge({}));
	assertEquals(result, { a: 1, b: 2 });
});

Deno.test("merge - merging empty with non-empty returns second", () => {
	const result = pipe({} as Record<string, number>, Rec.merge({ a: 1 }));
	assertEquals(result, { a: 1 });
});

Deno.test("merge - both empty records returns empty record", () => {
	const result = pipe({} as Record<string, number>, Rec.merge({}));
	assertEquals(result, {});
});

Deno.test("merge - complete override when all keys conflict", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.merge({ a: 10, b: 20 }));
	assertEquals(result, { a: 10, b: 20 });
});

// =============================================================================
// Info: isEmpty, size
// =============================================================================

Deno.test("isEmpty - returns true for empty record", () => {
	assertStrictEquals(Rec.isEmpty({}), true);
});

Deno.test("isEmpty - returns false for non-empty record", () => {
	assertStrictEquals(Rec.isEmpty({ a: 1 }), false);
});

Deno.test("size - returns 0 for empty record", () => {
	assertStrictEquals(Rec.size({}), 0);
});

Deno.test("size - returns correct count for non-empty record", () => {
	assertStrictEquals(Rec.size({ a: 1, b: 2, c: 3 }), 3);
});

Deno.test("size - returns 1 for single-key record", () => {
	assertStrictEquals(Rec.size({ only: true }), 1);
});

// =============================================================================
// mapKeys
// =============================================================================

Deno.test("mapKeys - transforms keys while preserving values", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.mapKeys((k) => k.toUpperCase()));
	assertEquals(result, { A: 1, B: 2 });
});

Deno.test("mapKeys - returns empty record for empty input", () => {
	const result = pipe({} as Record<string, number>, Rec.mapKeys((k) => `prefix_${k}`));
	assertEquals(result, {});
});

Deno.test("mapKeys - later key wins when two keys map to the same new key", () => {
	const result = pipe({ a: 1, A: 2 }, Rec.mapKeys((k) => k.toUpperCase()));
	// Both "a" and "A" map to "A"; iteration order is insertion order
	assertStrictEquals(result["A"], 2);
});

Deno.test("mapKeys - prefix transformation", () => {
	const result = pipe({ name: "Alice", age: "30" }, Rec.mapKeys((k) => `user_${k}`));
	assertEquals(result, { user_name: "Alice", user_age: "30" });
});

// =============================================================================
// compact
// =============================================================================

Deno.test("compact - removes None values and unwraps Some values", () => {
	const result = Rec.compact({ a: Option.some(1), b: Option.none(), c: Option.some(3) });
	assertEquals(result, { a: 1, c: 3 });
});

Deno.test("compact - returns empty record when all values are None", () => {
	const data: Record<string, Option<number>> = { x: Option.none(), y: Option.none() };
	const result = Rec.compact(data);
	assertEquals(result, {});
});

Deno.test("compact - returns all values when none are None", () => {
	const result = Rec.compact({ a: Option.some(10), b: Option.some(20) });
	assertEquals(result, { a: 10, b: 20 });
});

Deno.test("compact - empty input returns empty output", () => {
	const result = Rec.compact({});
	assertEquals(result, {});
});

// =============================================================================
// Composition with pipe
// =============================================================================

Deno.test("pipe composition - filter then map", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 },
		Rec.filter((n) => n > 1),
		Rec.map((n) => n * 10),
	);
	assertEquals(result, { b: 20, c: 30 });
});

Deno.test("pipe composition - map then filter then size", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3, d: 4 },
		Rec.map((n) => n * 2),
		Rec.filter((n) => n > 4),
		Rec.size,
	);
	assertStrictEquals(result, 2);
});

Deno.test("pipe composition - merge then mapWithKey", () => {
	const result = pipe(
		{ greeting: "hello" },
		Rec.merge({ farewell: "goodbye" }),
		Rec.mapWithKey((k, v) => `${k}: ${v}`),
	);
	assertEquals(result, {
		greeting: "greeting: hello",
		farewell: "farewell: goodbye",
	});
});

Deno.test(
	"pipe composition - entries, transform, fromEntries round trip",
	() => {
		const result = pipe(
			{ a: 1, b: 2, c: 3 },
			Rec.entries,
			(es) => es.filter(([_k, v]) => v > 1),
			(es) => es.map(([k, v]) => [k, v * 100] as const),
			Rec.fromEntries,
		);
		assertEquals(result, { b: 200, c: 300 });
	},
);

Deno.test("pipe composition - pick then merge", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 } as Record<string, number>,
		Rec.pick("a", "b"),
		Rec.merge({ d: 4 }),
	);
	assertEquals(result, { a: 1, b: 2, d: 4 });
});

// =============================================================================
// groupBy
// =============================================================================

Deno.test("Rec.groupBy groups items by key function", () => {
	const result = pipe([1, 2, 3, 4, 5], Rec.groupBy((n) => n % 2 === 0 ? "even" : "odd"));
	assertEquals([...result["odd"]], [1, 3, 5]);
	assertEquals([...result["even"]], [2, 4]);
});

Deno.test("Rec.groupBy returns empty record for empty array", () => {
	assertStrictEquals(Object.keys(pipe([], Rec.groupBy((n: number) => String(n % 2)))).length, 0);
});

Deno.test("Rec.groupBy all elements map to same key", () => {
	const result = pipe([1, 2, 3], Rec.groupBy(() => "all"));
	assertEquals([...result["all"]], [1, 2, 3]);
});

Deno.test("Rec.groupBy each element maps to a unique key", () => {
	const result = pipe([1, 2, 3], Rec.groupBy((n) => String(n)));
	assertStrictEquals(Object.keys(result).length, 3);
	assertEquals([...result["1"]], [1]);
});

Deno.test("Rec.groupBy preserves insertion order within each group", () => {
	const items = ["banana", "avocado", "blueberry", "apricot"];
	const result = pipe(items, Rec.groupBy((s) => s[0]));
	assertEquals([...result["b"]], ["banana", "blueberry"]);
	assertEquals([...result["a"]], ["avocado", "apricot"]);
});
