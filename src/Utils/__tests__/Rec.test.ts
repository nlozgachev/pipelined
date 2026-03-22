import { pipe } from "#composition/pipe.ts";
import { Option } from "#core/Option.ts";
import { expect, test } from "vitest";
import { Rec } from "../Rec.ts";

// =============================================================================
// Transform: map, mapWithKey, filter, filterWithKey
// =============================================================================

test("map - transforms each value in a record", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 },
		Rec.map((n) => n * 10),
	);
	expect(result).toEqual({ a: 10, b: 20, c: 30 });
});

test("map - returns empty record for empty input", () => {
	const result = pipe(
		{} as Record<string, number>,
		Rec.map((n) => n * 2),
	);
	expect(result).toEqual({});
});

test("map - transforms value types", () => {
	const result = pipe(
		{ x: 1, y: 2 },
		Rec.map((n) => String(n)),
	);
	expect(result).toEqual({ x: "1", y: "2" });
});

test("mapWithKey - transforms values with access to key", () => {
	const result = pipe(
		{ a: 1, b: 2 },
		Rec.mapWithKey((k, v) => `${k}:${v}`),
	);
	expect(result).toEqual({ a: "a:1", b: "b:2" });
});

test("mapWithKey - returns empty record for empty input", () => {
	const result = pipe(
		{} as Record<string, number>,
		Rec.mapWithKey((k, v) => `${k}=${v}`),
	);
	expect(result).toEqual({});
});

test("mapWithKey - key is available for logic", () => {
	const result = pipe(
		{ name: "Alice", age: "30" },
		Rec.mapWithKey((k, v) => (k === "name" ? v.toUpperCase() : v)),
	);
	expect(result).toEqual({ name: "ALICE", age: "30" });
});

test("filter - keeps values satisfying the predicate", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3, d: 4 },
		Rec.filter((n) => n > 2),
	);
	expect(result).toEqual({ c: 3, d: 4 });
});

test("filter - returns empty when nothing matches", () => {
	const result = pipe(
		{ a: 1, b: 2 },
		Rec.filter((n) => n > 10),
	);
	expect(result).toEqual({});
});

test("filter - returns empty for empty input", () => {
	const result = pipe(
		{} as Record<string, number>,
		Rec.filter((_) => true),
	);
	expect(result).toEqual({});
});

test("filter - keeps all when all match", () => {
	const result = pipe(
		{ a: 1, b: 2 },
		Rec.filter((n) => n > 0),
	);
	expect(result).toEqual({ a: 1, b: 2 });
});

test("filterWithKey - filters using both key and value", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 },
		Rec.filterWithKey((k, v) => k !== "b" && v > 0),
	);
	expect(result).toEqual({ a: 1, c: 3 });
});

test("filterWithKey - filters by key only", () => {
	const result = pipe(
		{ keep: 1, drop: 2, keep2: 3 },
		Rec.filterWithKey((k, _v) => k.startsWith("keep")),
	);
	expect(result).toEqual({ keep: 1, keep2: 3 });
});

test("filterWithKey - returns empty for empty input", () => {
	const result = pipe(
		{} as Record<string, number>,
		Rec.filterWithKey((_k, _v) => true),
	);
	expect(result).toEqual({});
});

// =============================================================================
// Lookup
// =============================================================================

test("lookup - returns Some for existing key", () => {
	const result = pipe({ a: 1, b: 2, c: 3 }, Rec.lookup("b"));
	expect(result).toEqual(Option.some(2));
});

test("lookup - returns None for missing key", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.lookup("z"));
	expect(result).toEqual(Option.none());
});

test("lookup - returns None for empty record", () => {
	const result = pipe({} as Record<string, number>, Rec.lookup("a"));
	expect(result).toEqual(Option.none());
});

test("lookup - returns Some even if value is falsy (0)", () => {
	const result = pipe({ a: 0 }, Rec.lookup("a"));
	expect(result).toEqual(Option.some(0));
});

test("lookup - returns Some even if value is falsy (empty string)", () => {
	const result = pipe({ a: "" }, Rec.lookup("a"));
	expect(result).toEqual(Option.some(""));
});

test("lookup - returns Some even if value is falsy (false)", () => {
	const result = pipe({ a: false }, Rec.lookup("a"));
	expect(result).toEqual(Option.some(false));
});

test("lookup - does not find inherited properties", () => {
	const obj = Object.create({ inherited: 42 });
	obj.own = 1;
	const result = pipe(obj, Rec.lookup("inherited"));
	expect(result).toEqual(Option.none());
});

// =============================================================================
// Destructure: keys, values, entries, fromEntries
// =============================================================================

test("keys - returns all keys of a record", () => {
	const result = Rec.keys({ a: 1, b: 2, c: 3 });
	expect(result).toEqual(["a", "b", "c"]);
});

test("keys - returns empty array for empty record", () => {
	const result = Rec.keys({});
	expect(result).toEqual([]);
});

test("values - returns all values of a record", () => {
	const result = Rec.values({ a: 10, b: 20, c: 30 });
	expect(result).toEqual([10, 20, 30]);
});

test("values - returns empty array for empty record", () => {
	const result = Rec.values({});
	expect(result).toEqual([]);
});

test("entries - returns all key-value pairs", () => {
	const result = Rec.entries({ a: 1, b: 2 });
	expect(result).toEqual([
		["a", 1],
		["b", 2],
	]);
});

test("entries - returns empty array for empty record", () => {
	const result = Rec.entries({});
	expect(result).toEqual([]);
});

test("fromEntries - creates record from key-value pairs", () => {
	const result = Rec.fromEntries([
		["a", 1],
		["b", 2],
		["c", 3],
	]);
	expect(result).toEqual({ a: 1, b: 2, c: 3 });
});

test("fromEntries - returns empty record for empty array", () => {
	const result = Rec.fromEntries([] as [string, number][]);
	expect(result).toEqual({});
});

test("fromEntries - last entry wins for duplicate keys", () => {
	const result = Rec.fromEntries([
		["a", 1],
		["a", 2],
	]);
	expect(result).toEqual({ a: 2 });
});

test("entries and fromEntries are inverses", () => {
	const original = { x: 10, y: 20, z: 30 };
	const roundTripped = Rec.fromEntries(Rec.entries(original));
	expect(roundTripped).toEqual(original);
});

// =============================================================================
// Select: pick, omit
// =============================================================================

test("pick - selects specified keys", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 } as Record<string, number>,
		Rec.pick("a", "c"),
	);
	expect(result).toEqual({ a: 1, c: 3 });
});

test("pick - ignores keys not in record", () => {
	// @ts-expect-error 'x' does not exist on the record
	const result = pipe({ a: 1, b: 2 }, Rec.pick("x", "a"));
	expect(result).toEqual({ a: 1 });
});

test("pick - returns empty when no keys match", () => {
	const result = pipe(
		{ a: 1, b: 2 } as Record<string, number>,
		Rec.pick("x", "y"),
	);
	expect(result).toEqual({} as typeof result);
});

test("pick - with single key", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 } as Record<string, number>,
		Rec.pick("b"),
	);
	expect(result).toEqual({ b: 2 });
});

test("omit - removes specified keys", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 } as Record<string, number>,
		Rec.omit("b"),
	);
	expect(result).toEqual({ a: 1, c: 3 });
});

test("omit - ignores keys not in record", () => {
	const result = pipe({ a: 1, b: 2 } as Record<string, number>, Rec.omit("z"));
	expect(result).toEqual({ a: 1, b: 2 });
});

test("omit - multiple keys", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3, d: 4 } as Record<string, number>,
		Rec.omit("a", "c"),
	);
	expect(result).toEqual({ b: 2, d: 4 });
});

test("omit - all keys results in empty record", () => {
	const result = pipe(
		{ a: 1, b: 2 } as Record<string, number>,
		Rec.omit("a", "b"),
	);
	expect(result).toEqual({});
});

test("omit - empty record returns empty record", () => {
	const result = pipe({} as Record<string, number>, Rec.omit("a"));
	expect(result).toEqual({});
});

// =============================================================================
// Combine: merge
// =============================================================================

test("merge - combines two records", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.merge({ c: 3, d: 4 }));
	expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 });
});

test("merge - second record overrides first on conflict", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.merge({ b: 99, c: 3 }));
	expect(result).toEqual({ a: 1, b: 99, c: 3 });
});

test("merge - merging with empty record returns original", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.merge({}));
	expect(result).toEqual({ a: 1, b: 2 });
});

test("merge - merging empty with non-empty returns second", () => {
	const result = pipe({} as Record<string, number>, Rec.merge({ a: 1 }));
	expect(result).toEqual({ a: 1 });
});

test("merge - both empty records returns empty record", () => {
	const result = pipe({} as Record<string, number>, Rec.merge({}));
	expect(result).toEqual({});
});

test("merge - complete override when all keys conflict", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.merge({ a: 10, b: 20 }));
	expect(result).toEqual({ a: 10, b: 20 });
});

// =============================================================================
// Info: isEmpty, size
// =============================================================================

test("isEmpty - returns true for empty record", () => {
	expect(Rec.isEmpty({})).toBe(true);
});

test("isEmpty - returns false for non-empty record", () => {
	expect(Rec.isEmpty({ a: 1 })).toBe(false);
});

test("size - returns 0 for empty record", () => {
	expect(Rec.size({})).toBe(0);
});

test("size - returns correct count for non-empty record", () => {
	expect(Rec.size({ a: 1, b: 2, c: 3 })).toBe(3);
});

test("size - returns 1 for single-key record", () => {
	expect(Rec.size({ only: true })).toBe(1);
});

// =============================================================================
// mapKeys
// =============================================================================

test("mapKeys - transforms keys while preserving values", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.mapKeys((k) => k.toUpperCase()));
	expect(result).toEqual({ A: 1, B: 2 });
});

test("mapKeys - returns empty record for empty input", () => {
	const result = pipe({} as Record<string, number>, Rec.mapKeys((k) => `prefix_${k}`));
	expect(result).toEqual({});
});

test("mapKeys - later key wins when two keys map to the same new key", () => {
	const result = pipe({ a: 1, A: 2 }, Rec.mapKeys((k) => k.toUpperCase()));
	// Both "a" and "A" map to "A"; iteration order is insertion order
	expect(result["A"]).toBe(2);
});

test("mapKeys - prefix transformation", () => {
	const result = pipe({ name: "Alice", age: "30" }, Rec.mapKeys((k) => `user_${k}`));
	expect(result).toEqual({ user_name: "Alice", user_age: "30" });
});

// =============================================================================
// compact
// =============================================================================

test("compact - removes None values and unwraps Some values", () => {
	const result = Rec.compact({ a: Option.some(1), b: Option.none(), c: Option.some(3) });
	expect(result).toEqual({ a: 1, c: 3 });
});

test("compact - returns empty record when all values are None", () => {
	const data: Record<string, Option<number>> = { x: Option.none(), y: Option.none() };
	const result = Rec.compact(data);
	expect(result).toEqual({});
});

test("compact - returns all values when none are None", () => {
	const result = Rec.compact({ a: Option.some(10), b: Option.some(20) });
	expect(result).toEqual({ a: 10, b: 20 });
});

test("compact - empty input returns empty output", () => {
	const result = Rec.compact({});
	expect(result).toEqual({});
});

// =============================================================================
// Composition with pipe
// =============================================================================

test("pipe composition - filter then map", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 },
		Rec.filter((n) => n > 1),
		Rec.map((n) => n * 10),
	);
	expect(result).toEqual({ b: 20, c: 30 });
});

test("pipe composition - map then filter then size", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3, d: 4 },
		Rec.map((n) => n * 2),
		Rec.filter((n) => n > 4),
		Rec.size,
	);
	expect(result).toBe(2);
});

test("pipe composition - merge then mapWithKey", () => {
	const result = pipe(
		{ greeting: "hello" },
		Rec.merge({ farewell: "goodbye" }),
		Rec.mapWithKey((k, v) => `${k}: ${v}`),
	);
	expect(result).toEqual({
		greeting: "greeting: hello",
		farewell: "farewell: goodbye",
	});
});

test(
	"pipe composition - entries, transform, fromEntries round trip",
	() => {
		const result = pipe(
			{ a: 1, b: 2, c: 3 },
			Rec.entries,
			(es) => es.filter(([_k, v]) => v > 1),
			(es) => es.map(([k, v]) => [k, v * 100] as const),
			Rec.fromEntries,
		);
		expect(result).toEqual({ b: 200, c: 300 });
	},
);

test("pipe composition - pick then merge", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 } as Record<string, number>,
		Rec.pick("a", "b"),
		Rec.merge({ d: 4 }),
	);
	expect(result).toEqual({ a: 1, b: 2, d: 4 });
});

// =============================================================================
// groupBy
// =============================================================================

test("Rec.groupBy groups items by key function", () => {
	const result = pipe([1, 2, 3, 4, 5], Rec.groupBy((n) => n % 2 === 0 ? "even" : "odd"));
	expect([...result["odd"]]).toEqual([1, 3, 5]);
	expect([...result["even"]]).toEqual([2, 4]);
});

test("Rec.groupBy returns empty record for empty array", () => {
	expect(Object.keys(pipe([], Rec.groupBy((n: number) => String(n % 2))))).toHaveLength(0);
});

test("Rec.groupBy all elements map to same key", () => {
	const result = pipe([1, 2, 3], Rec.groupBy(() => "all"));
	expect([...result["all"]]).toEqual([1, 2, 3]);
});

test("Rec.groupBy each element maps to a unique key", () => {
	const result = pipe([1, 2, 3], Rec.groupBy((n) => String(n)));
	expect(Object.keys(result)).toHaveLength(3);
	expect([...result["1"]]).toEqual([1]);
});

test("Rec.groupBy preserves insertion order within each group", () => {
	const items = ["banana", "avocado", "blueberry", "apricot"];
	const result = pipe(items, Rec.groupBy((s) => s[0]));
	expect([...result["b"]]).toEqual(["banana", "blueberry"]);
	expect([...result["a"]]).toEqual(["avocado", "apricot"]);
});
