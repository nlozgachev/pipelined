import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Result } from "../../Core/Result.ts";
import { Rec } from "../Rec.ts";

// =============================================================================
// Transform: map, mapWithKey, filter, filterWithKey
// =============================================================================

test("map - transforms each value in a record", () => {
	const result = pipe({ a: 1, b: 2, c: 3 }, Rec.map((n) => n * 10));
	expect(result).toStrictEqual({ a: 10, b: 20, c: 30 });
});

test("map - returns empty record for empty input", () => {
	const result = pipe({} as Record<string, number>, Rec.map((n) => n * 2));
	expect(result).toStrictEqual({});
});

test("map - transforms value types", () => {
	const result = pipe({ x: 1, y: 2 }, Rec.map((n) => String(n)));
	expect(result).toStrictEqual({ x: "1", y: "2" });
});

test("map - handles prototype pollution key", () => {
	const obj = JSON.parse('{"__proto__": 123}') as Record<string, number>;
	const result = pipe(obj, Rec.map((n) => n * 2));
	expect(result.__proto__).toBe(246);
});

test("filterMap - keeps Some values, drops None", () => {
	const result = pipe({ a: 1, b: 2, c: 3 }, Rec.filterMap((n) => (n > 1 ? Maybe.make.some(n * 10) : Maybe.make.none())));
	expect(result).toStrictEqual({ b: 20, c: 30 });
});

test("filterMap - returns empty for empty input", () => {
	const result = pipe({} as Record<string, number>, Rec.filterMap((n) => Maybe.make.some(n)));
	expect(result).toStrictEqual({});
});

test("filterMap - returns empty when all values map to None", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.filterMap((_) => Maybe.make.none()));
	expect(result).toStrictEqual({});
});

test("filterMap - keeps all values when all map to Some", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.filterMap((n) => Maybe.make.some(n * 2)));
	expect(result).toStrictEqual({ a: 2, b: 4 });
});

test("filterMap - can change value type", () => {
	const result = pipe(
		{ x: "42", y: "abc" },
		Rec.filterMap((s) => {
			const n = Number(s);
			return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
		}),
	);
	expect(result).toStrictEqual({ x: 42 });
});

test("mapWithKey - transforms values with access to key", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.mapWithKey((k, v) => `${k}:${v}`));
	expect(result).toStrictEqual({ a: "a:1", b: "b:2" });
});

test("mapWithKey - returns empty record for empty input", () => {
	const result = pipe({} as Record<string, number>, Rec.mapWithKey((k, v) => `${k}=${v}`));
	expect(result).toStrictEqual({});
});

test("mapWithKey - key is available for logic", () => {
	const result = pipe({ name: "Alice", age: "30" }, Rec.mapWithKey((k, v) => (k === "name" ? v.toUpperCase() : v)));
	expect(result).toStrictEqual({ name: "ALICE", age: "30" });
});

test("mapWithKey - handles prototype pollution key", () => {
	const obj = JSON.parse('{"__proto__": 123}') as Record<string, number>;
	const result = pipe(obj, Rec.mapWithKey((k, v) => `${k}:${v}`));
	expect(result.__proto__).toBe("__proto__:123");
});

test("filter - keeps values satisfying the predicate", () => {
	const result = pipe({ a: 1, b: 2, c: 3, d: 4 }, Rec.filter((n) => n > 2));
	expect(result).toStrictEqual({ c: 3, d: 4 });
});

test("filter - returns empty when nothing matches", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.filter((n) => n > 10));
	expect(result).toStrictEqual({});
});

test("filter - returns empty for empty input", () => {
	const result = pipe({} as Record<string, number>, Rec.filter((_) => true));
	expect(result).toStrictEqual({});
});

test("filter - keeps all when all match", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.filter((n) => n > 0));
	expect(result).toStrictEqual({ a: 1, b: 2 });
});

test("filterWithKey - filters using both key and value", () => {
	const result = pipe({ a: 1, b: 2, c: 3 }, Rec.filterWithKey((k, v) => k !== "b" && v > 0));
	expect(result).toStrictEqual({ a: 1, c: 3 });
});

test("filterWithKey - filters by key only", () => {
	const result = pipe({ keep: 1, drop: 2, keep2: 3 }, Rec.filterWithKey((k, _v) => k.startsWith("keep")));
	expect(result).toStrictEqual({ keep: 1, keep2: 3 });
});

test("filterWithKey - returns empty for empty input", () => {
	const result = pipe({} as Record<string, number>, Rec.filterWithKey((_k, _v) => true));
	expect(result).toStrictEqual({});
});

// =============================================================================
// Lookup
// =============================================================================

test("lookup - returns Some for existing key", () => {
	const result = pipe({ a: 1, b: 2, c: 3 }, Rec.lookup("b"));
	expect(result).toStrictEqual(Maybe.make.some(2));
});

test("lookup - returns None for missing key", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.lookup("z"));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("lookup - returns None for empty record", () => {
	const result = pipe({} as Record<string, number>, Rec.lookup("a"));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("lookup - returns Some even if value is falsy (0)", () => {
	const result = pipe({ a: 0 }, Rec.lookup("a"));
	expect(result).toStrictEqual(Maybe.make.some(0));
});

test("lookup - returns Some even if value is falsy (empty string)", () => {
	const result = pipe({ a: "" }, Rec.lookup("a"));
	expect(result).toStrictEqual(Maybe.make.some(""));
});

test("lookup - returns Some even if value is falsy (false)", () => {
	const result = pipe({ a: false }, Rec.lookup("a"));
	expect(result).toStrictEqual(Maybe.make.some(false));
});

test("lookup - does not find inherited properties", () => {
	const obj = Object.create({ inherited: 42 });
	obj.own = 1;
	const result = pipe(obj, Rec.lookup("inherited"));
	expect(result).toStrictEqual(Maybe.make.none());
});

// =============================================================================
// Destructure: keys, values, entries, fromEntries
// =============================================================================

test("keys - returns all keys of a record", () => {
	const result = Rec.keys({ a: 1, b: 2, c: 3 });
	expect(result).toStrictEqual(["a", "b", "c"]);
});

test("keys - returns empty array for empty record", () => {
	const result = Rec.keys({});
	expect(result).toStrictEqual([]);
});

test("values - returns all values of a record", () => {
	const result = Rec.values({ a: 10, b: 20, c: 30 });
	expect(result).toStrictEqual([10, 20, 30]);
});

test("values - returns empty array for empty record", () => {
	const result = Rec.values({});
	expect(result).toStrictEqual([]);
});

test("entries - returns all key-value pairs", () => {
	const result = Rec.entries({ a: 1, b: 2 });
	expect(result).toStrictEqual([["a", 1], ["b", 2]]);
});

test("entries - returns empty array for empty record", () => {
	const result = Rec.entries({});
	expect(result).toStrictEqual([]);
});

test("fromEntries - creates record from key-value pairs", () => {
	const result = Rec.from.entries([["a", 1], ["b", 2], ["c", 3]]);
	expect(result).toStrictEqual({ a: 1, b: 2, c: 3 });
});

test("fromEntries - returns empty record for empty array", () => {
	const result = Rec.from.entries([] as [string, number][]);
	expect(result).toStrictEqual({});
});

test("fromEntries - last entry wins for duplicate keys", () => {
	const result = Rec.from.entries([["a", 1], ["a", 2]]);
	expect(result).toStrictEqual({ a: 2 });
});

test("entries and fromEntries are inverses", () => {
	const original = { x: 10, y: 20, z: 30 };
	const roundTripped = Rec.from.entries(Rec.entries(original));
	expect(roundTripped).toStrictEqual(original);
});

// =============================================================================
// Select: pick, omit
// =============================================================================

test("pick - selects specified keys", () => {
	const result = pipe({ a: 1, b: 2, c: 3 } as Record<string, number>, Rec.pick("a", "c"));
	expect(result).toStrictEqual({ a: 1, c: 3 });
});

test("pick - ignores keys not in record", () => {
	// @ts-expect-error 'x' does not exist on the record
	const result = pipe({ a: 1, b: 2 }, Rec.pick("x", "a"));
	expect(result).toStrictEqual({ a: 1 });
});

test("pick - returns empty when no keys match", () => {
	const result = pipe({ a: 1, b: 2 } as Record<string, number>, Rec.pick("x", "y"));
	expect(result).toStrictEqual({} as typeof result);
});

test("pick - with single key", () => {
	const result = pipe({ a: 1, b: 2, c: 3 } as Record<string, number>, Rec.pick("b"));
	expect(result).toStrictEqual({ b: 2 });
});

test("omit - removes specified keys", () => {
	const result = pipe({ a: 1, b: 2, c: 3 } as Record<string, number>, Rec.omit("b"));
	expect(result).toStrictEqual({ a: 1, c: 3 });
});

test("omit - ignores keys not in record", () => {
	const result = pipe({ a: 1, b: 2 } as Record<string, number>, Rec.omit("z"));
	expect(result).toStrictEqual({ a: 1, b: 2 });
});

test("omit - multiple keys", () => {
	const result = pipe({ a: 1, b: 2, c: 3, d: 4 } as Record<string, number>, Rec.omit("a", "c"));
	expect(result).toStrictEqual({ b: 2, d: 4 });
});

test("omit - all keys results in empty record", () => {
	const result = pipe({ a: 1, b: 2 } as Record<string, number>, Rec.omit("a", "b"));
	expect(result).toStrictEqual({});
});

test("omit - empty record returns empty record", () => {
	const result = pipe({} as Record<string, number>, Rec.omit("a"));
	expect(result).toStrictEqual({});
});

// =============================================================================
// Combine: merge
// =============================================================================

test("merge - combines two records", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.merge({ c: 3, d: 4 }));
	expect(result).toStrictEqual({ a: 1, b: 2, c: 3, d: 4 });
});

test("merge - second record overrides first on conflict", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.merge({ b: 99, c: 3 }));
	expect(result).toStrictEqual({ a: 1, b: 99, c: 3 });
});

test("merge - merging with empty record returns original", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.merge({}));
	expect(result).toStrictEqual({ a: 1, b: 2 });
});

test("merge - merging empty with non-empty returns second", () => {
	const result = pipe({} as Record<string, number>, Rec.merge({ a: 1 }));
	expect(result).toStrictEqual({ a: 1 });
});

test("merge - both empty records returns empty record", () => {
	const result = pipe({} as Record<string, number>, Rec.merge({}));
	expect(result).toStrictEqual({});
});

test("merge - complete override when all keys conflict", () => {
	const result = pipe({ a: 1, b: 2 }, Rec.merge({ a: 10, b: 20 }));
	expect(result).toStrictEqual({ a: 10, b: 20 });
});

// =============================================================================
// Info: isEmpty, size
// =============================================================================

test("isEmpty - returns true for empty record", () => {
	expect(Rec.is.empty({})).toBe(true);
});

test("isEmpty - returns false for non-empty record", () => {
	expect(Rec.is.empty({ a: 1 })).toBe(false);
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
	expect(result).toStrictEqual({ A: 1, B: 2 });
});

test("mapKeys - returns empty record for empty input", () => {
	const result = pipe({} as Record<string, number>, Rec.mapKeys((k) => `prefix_${k}`));
	expect(result).toStrictEqual({});
});

test("mapKeys - later key wins when two keys map to the same new key", () => {
	const result = pipe({ a: 1, A: 2 }, Rec.mapKeys((k) => k.toUpperCase()));
	// Both "a" and "A" map to "A"; iteration order is insertion order
	expect(result["A"]).toBe(2);
});

test("mapKeys - prefix transformation", () => {
	const result = pipe({ name: "Alice", age: "30" }, Rec.mapKeys((k) => `user_${k}`));
	expect(result).toStrictEqual({ user_name: "Alice", user_age: "30" });
});

// =============================================================================
// compact
// =============================================================================

test("compact - removes None values and unwraps Some values", () => {
	const result = Rec.compact({ a: Maybe.make.some(1), b: Maybe.make.none(), c: Maybe.make.some(3) });
	expect(result).toStrictEqual({ a: 1, c: 3 });
});

test("compact - returns empty record when all values are None", () => {
	const data: Record<string, Maybe<number>> = { x: Maybe.make.none(), y: Maybe.make.none() };
	const result = Rec.compact(data);
	expect(result).toStrictEqual({});
});

test("compact - returns all values when none are None", () => {
	const result = Rec.compact({ a: Maybe.make.some(10), b: Maybe.make.some(20) });
	expect(result).toStrictEqual({ a: 10, b: 20 });
});

test("compact - empty input returns empty output", () => {
	const result = Rec.compact({});
	expect(result).toStrictEqual({});
});

test("Rec methods safely handle __proto__ keys without prototype pollution", () => {
	const input = JSON.parse('{"__proto__": {"polluted": true}}');
	const mapped = pipe(input, Rec.mapKeys((k) => k));
	expect(Object.keys(mapped)).toStrictEqual(["__proto__"]);
	expect((mapped as any).polluted).toBeUndefined();

	const compactInput: Record<string, Maybe<any>> = {};
	Object.defineProperty(compactInput, "__proto__", {
		value: Maybe.make.some({ polluted: true }),
		writable: true,
		enumerable: true,
		configurable: true,
	});
	const compacted = Rec.compact(compactInput);
	expect(Object.keys(compacted)).toStrictEqual(["__proto__"]);
	expect((compacted as any).polluted).toBeUndefined();

	const filtered = pipe(input, Rec.filter(() => true));
	expect(Object.keys(filtered)).toStrictEqual(["__proto__"]);

	const filterWithKeyed = pipe(input, Rec.filterWithKey(() => true));
	expect(Object.keys(filterWithKeyed)).toStrictEqual(["__proto__"]);

	const filterMapped = pipe(compactInput, Rec.filterMap((m) => m));
	expect(Object.keys(filterMapped)).toStrictEqual(["__proto__"]);

	const grouped = Rec.groupBy(() => "__proto__")(["item1"]);
	expect(Object.keys(grouped)).toStrictEqual(["__proto__"]);

	const protoObj: Record<string, number> = {};
	Object.defineProperty(protoObj, "__proto__", { value: 42, enumerable: true, configurable: true, writable: true });
	const picked = Rec.pick("__proto__")(protoObj);
	expect(Object.keys(picked)).toStrictEqual(["__proto__"]);

	const omitted = Rec.omit("otherKey")(protoObj);
	expect(Object.keys(omitted)).toStrictEqual(["__proto__"]);

	const traversedMaybe = pipe(compactInput, Rec.traverse.Maybe((m) => m));
	expect(traversedMaybe.kind).toBe("Some");

	const resultInput: Record<string, any> = {};
	Object.defineProperty(resultInput, "__proto__", {
		value: { kind: "Ok", value: 1 },
		enumerable: true,
		configurable: true,
		writable: true,
	});
	const traversedResult = pipe(resultInput, Rec.traverse.Result((r) => r));
	expect(traversedResult.kind).toBe("Ok");
});

// --- mergeWith ---

test("Rec.mergeWith combines records uncurried and curried on key collisions", () => {
	const combine = Rec.mergeWith((a: number, b: number) => a + b);
	expect(combine({ a: 1, b: 2 }, { b: 3, c: 4 })).toStrictEqual({ a: 1, b: 5, c: 4 });
	expect(pipe({ a: 1, b: 2 }, combine({ b: 3, c: 4 }))).toStrictEqual({ a: 1, b: 5, c: 4 });
});

// --- mapEntries & updateIn ---

test("Rec.mapEntries transforms key and value pairs simultaneously", () => {
	const res = pipe({ a: 1, b: 2 }, Rec.mapEntries((k, v) => [k.toUpperCase(), v * 10]));
	expect(res).toStrictEqual({ A: 10, B: 20 });
});

test("Rec.updateIn immutably updates deep nested record paths", () => {
	const data = { user: { profile: { age: 30 } } };
	const res = pipe(data, Rec.updateIn(["user", "profile", "age"], (n: number) => n + 1));
	expect(res).toStrictEqual({ user: { profile: { age: 31 } } });
	expect(data.user.profile.age).toBe(30); // immutability preserved
});

test("Rec.updateIn creates missing intermediate objects when path does not exist", () => {
	const res = pipe({}, Rec.updateIn(["a", "b", "c"], (val: number | undefined) => (val ?? 0) + 1));
	expect(res).toStrictEqual({ a: { b: { c: 1 } } });
});

// =============================================================================
// Composition with pipe
// =============================================================================

test("pipe composition - filter then map", () => {
	const result = pipe({ a: 1, b: 2, c: 3 }, Rec.filter((n) => n > 1), Rec.map((n) => n * 10));
	expect(result).toStrictEqual({ b: 20, c: 30 });
});

test("pipe composition - map then filter then size", () => {
	const result = pipe({ a: 1, b: 2, c: 3, d: 4 }, Rec.map((n) => n * 2), Rec.filter((n) => n > 4), Rec.size);
	expect(result).toBe(2);
});

test("pipe composition - merge then mapWithKey", () => {
	const result = pipe({ greeting: "hello" }, Rec.merge({ farewell: "goodbye" }), Rec.mapWithKey((k, v) => `${k}: ${v}`));
	expect(result).toStrictEqual({ greeting: "greeting: hello", farewell: "farewell: goodbye" });
});

test("pipe composition - entries, transform, fromEntries round trip", () => {
	const result = pipe(
		{ a: 1, b: 2, c: 3 },
		Rec.entries,
		(es) => es.filter(([_k, v]) => v > 1),
		(es) => es.map(([k, v]) => [k, v * 100] as const),
		Rec.from.entries,
	);
	expect(result).toStrictEqual({ b: 200, c: 300 });
});

test("pipe composition - pick then merge", () => {
	const result = pipe({ a: 1, b: 2, c: 3 } as Record<string, number>, Rec.pick("a", "b"), Rec.merge({ d: 4 }));
	expect(result).toStrictEqual({ a: 1, b: 2, d: 4 });
});

// =============================================================================
// groupBy
// =============================================================================

test("Rec.groupBy groups items by key function", () => {
	const result = pipe([1, 2, 3, 4, 5], Rec.groupBy((n) => n % 2 === 0 ? "even" : "odd"));
	expect([...result["odd"]]).toStrictEqual([1, 3, 5]);
	expect([...result["even"]]).toStrictEqual([2, 4]);
});

test("Rec.groupBy returns empty record for empty array", () => {
	expect(Object.keys(pipe([], Rec.groupBy((n: number) => String(n % 2))))).toHaveLength(0);
});

test("Rec.groupBy all elements map to same key", () => {
	const result = pipe([1, 2, 3], Rec.groupBy(() => "all"));
	expect([...result["all"]]).toStrictEqual([1, 2, 3]);
});

test("Rec.groupBy each element maps to a unique key", () => {
	const result = pipe([1, 2, 3], Rec.groupBy((n) => String(n)));
	expect(Object.keys(result)).toHaveLength(3);
	expect([...result["1"]]).toStrictEqual([1]);
});

test("Rec.groupBy preserves insertion order within each group", () => {
	const items = ["banana", "avocado", "blueberry", "apricot"];
	const result = pipe(items, Rec.groupBy((s) => s[0]));
	expect([...result["b"]]).toStrictEqual(["banana", "blueberry"]);
	expect([...result["a"]]).toStrictEqual(["avocado", "apricot"]);
});

// =============================================================================
// Rec.traverse & Rec.sequence
// =============================================================================

test("Rec.traverse.Maybe - traverses record with Some values", () => {
	const result = pipe(
		{ a: "1", b: "2" },
		Rec.traverse.Maybe((s) => (s === "NaN" ? Maybe.make.none() : Maybe.make.some(Number(s)))),
	);
	expect(result).toStrictEqual(Maybe.make.some({ a: 1, b: 2 }));
});

test("Rec.traverse.Maybe - short-circuits at first None", () => {
	const result = pipe(
		{ a: "1", b: "NaN", c: "3" },
		Rec.traverse.Maybe((s) => (s === "NaN" ? Maybe.make.none() : Maybe.make.some(Number(s)))),
	);
	expect(result).toStrictEqual(Maybe.make.none());
});

test("Rec.traverse.Maybe - returns Some of empty record for empty input", () => {
	const result = pipe({} as Record<string, string>, Rec.traverse.Maybe((s) => Maybe.make.some(s)));
	expect(result).toStrictEqual(Maybe.make.some({}));
});

test("Rec.sequence.Maybe - sequences record of Some values", () => {
	const result = Rec.sequence.Maybe({ a: Maybe.make.some(1), b: Maybe.make.some(2) });
	expect(result).toStrictEqual(Maybe.make.some({ a: 1, b: 2 }));
});

test("Rec.sequence.Maybe - returns None if any is None", () => {
	const result = Rec.sequence.Maybe({ a: Maybe.make.some(1), b: Maybe.make.none() });
	expect(result).toStrictEqual(Maybe.make.none());
});

test("Rec.traverse.Result - traverses record with Ok values", () => {
	const result = pipe(
		{ a: 1, b: 2 },
		Rec.traverse.Result((n) => (n < 0 ? Result.make.err("negative") : Result.make.ok(n * 10))),
	);
	expect(result).toStrictEqual(Result.make.ok({ a: 10, b: 20 }));
});

test("Rec.traverse.Result - short-circuits at first Err", () => {
	const result = pipe(
		{ a: 1, b: -2, c: 3 },
		Rec.traverse.Result((n) => (n < 0 ? Result.make.err("negative") : Result.make.ok(n * 10))),
	);
	expect(result).toStrictEqual(Result.make.err("negative"));
});

test("Rec.traverse.Result - returns Ok of empty record for empty input", () => {
	const result = pipe({} as Record<string, number>, Rec.traverse.Result((n) => Result.make.ok(n)));
	expect(result).toStrictEqual(Result.make.ok({}));
});

test("Rec.sequence.Result - sequences record of Ok values", () => {
	const result = Rec.sequence.Result({ a: Result.make.ok(1), b: Result.make.ok(2) });
	expect(result).toStrictEqual(Result.make.ok({ a: 1, b: 2 }));
});

test("Rec.sequence.Result - returns Err if any is Err", () => {
	const result = Rec.sequence.Result({ a: Result.make.ok(1), b: Result.make.err("oops") });
	expect(result).toStrictEqual(Result.make.err("oops"));
});

// =============================================================================
// Rec.NonEmpty
// =============================================================================

test("Rec.is.nonEmpty - returns true for non-empty record", () => {
	expect(Rec.is.nonEmpty({ a: 1 })).toBe(true);
});

test("Rec.is.nonEmpty - returns false for empty record", () => {
	expect(Rec.is.nonEmpty({})).toBe(false);
});

test("Rec.NonEmpty.singleton - creates a single-element record", () => {
	const result = Rec.NonEmpty.singleton("key", "value");
	expect(result).toStrictEqual({ key: "value" });
	expect(Rec.is.nonEmpty(result)).toBe(true);
});

test("Rec.NonEmpty.from.Record - returns Some for non-empty record", () => {
	const result = Rec.NonEmpty.from.Record({ a: 1 });
	expect(result).toStrictEqual(Maybe.make.some({ a: 1 }));
});

test("Rec.NonEmpty.from.Record - returns None for empty record", () => {
	const result = Rec.NonEmpty.from.Record({});
	expect(result).toStrictEqual(Maybe.make.none());
});

test("Rec.NonEmpty.keys - returns non-empty array of keys", () => {
	const r = Rec.NonEmpty.singleton("a", 1);
	const keys = Rec.NonEmpty.keys(r);
	expect(keys).toStrictEqual(["a"]);
	expectTypeOf(keys).toEqualTypeOf<readonly ["a", ..."a"[]]>();
});

test("Rec.NonEmpty.values - returns non-empty array of values", () => {
	const r = Rec.NonEmpty.singleton("a", 1);
	const values = Rec.NonEmpty.values(r);
	expect(values).toStrictEqual([1]);
	expectTypeOf(values).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("Rec.NonEmpty.entries - returns non-empty array of entries", () => {
	const r = Rec.NonEmpty.singleton("a", 1);
	const entries = Rec.NonEmpty.entries(r);
	expect(entries).toStrictEqual([["a", 1]]);
	expectTypeOf(entries).toEqualTypeOf<readonly [readonly ["a", number], ...(readonly ["a", number])[]]>();
});

test("Rec.NonEmpty.reduce - reduces non-empty record without initial seed", () => {
	const r = Rec.NonEmpty.singleton("a", 10);
	const result = pipe(r, Rec.NonEmpty.reduce((a, b) => a + b));
	expect(result).toBe(10);
});

test("Rec.map on NonEmpty - returns standard Record", () => {
	const r = Rec.NonEmpty.singleton("x", 5);
	const mapped = Rec.map((n: number) => n * 2)(r);
	expect(mapped).toStrictEqual({ x: 10 });
	expectTypeOf(mapped).toEqualTypeOf<Readonly<Record<string, number>>>();
});

test("Rec.mapWithKey on NonEmpty - returns standard Record", () => {
	const r = Rec.NonEmpty.singleton("x", 5);
	const mapped = Rec.mapWithKey((k, v: number): string => `${k}:${v}`)(r);
	expect(mapped).toStrictEqual({ x: "x:5" });
	expectTypeOf(mapped).toEqualTypeOf<Readonly<Record<string, string>>>();
});

test("Rec.NonEmpty.map - maps values and preserves NonEmpty type", () => {
	const r = Rec.NonEmpty.singleton("x", 5);
	const mapped = pipe(r, Rec.NonEmpty.map((n) => n * 2));
	expect(mapped).toStrictEqual({ x: 10 });
	expectTypeOf(mapped).toEqualTypeOf<Rec.NonEmpty<number, "x">>();
});

test("Rec.NonEmpty.mapWithKey - maps values with key and preserves NonEmpty type", () => {
	const r = Rec.NonEmpty.singleton("x", 5);
	const mapped = pipe(r, Rec.NonEmpty.mapWithKey((k, v) => `${k}:${v}`));
	expect(mapped).toStrictEqual({ x: "x:5" });
	expectTypeOf(mapped).toEqualTypeOf<Rec.NonEmpty<string, "x">>();
});

test("Rec.NonEmpty pipe composition", () => {
	const result = pipe(Rec.NonEmpty.singleton("a", 5), Rec.NonEmpty.map((n) => n * 2), Rec.NonEmpty.keys);
	expect(result).toStrictEqual(["a"]);
	expectTypeOf(result).toEqualTypeOf<readonly ["a", ..."a"[]]>();
});

test("Rec.to.Dict converts record to ReadonlyMap", () => {
	const map = Rec.to.Dict({ a: 1, b: 2 });
	expect(map.get("a")).toBe(1);
	expect(map.get("b")).toBe(2);
});
