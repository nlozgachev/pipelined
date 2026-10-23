import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Dict } from "../Dict.ts";

test("is: guards empty and non-empty dictionaries", () => {
	const d = Dict.from.entries([["a", 1]]);
	expectTypeOf(Dict.is.empty(d)).toEqualTypeOf<boolean>();

	if (Dict.is.nonEmpty(d)) {
		expectTypeOf(d).toEqualTypeOf<Dict.NonEmpty<string, number>>();
	}
});

test("empty, singleton, from, to: constructs and converts dictionaries", () => {
	const empty = Dict.empty<string, number>();
	expectTypeOf(empty).toEqualTypeOf<ReadonlyMap<string, number>>();

	const single = Dict.singleton("a", 1);
	expectTypeOf(single).toEqualTypeOf<ReadonlyMap<string, number>>();

	const fromEntries = Dict.from.entries([["a", 1]] as const);
	expectTypeOf(fromEntries).toEqualTypeOf<ReadonlyMap<"a", 1>>();

	const fromRec = Dict.from.record({ a: 1 });
	expectTypeOf(fromRec).toEqualTypeOf<ReadonlyMap<"a", number>>();

	const fromNull = Dict.from.nullable(new Map([["a", 1]]));
	expectTypeOf(fromNull).toEqualTypeOf<Maybe<ReadonlyMap<string, number>>>();

	const toRec = Dict.to.record(fromRec);
	expectTypeOf(toRec).toEqualTypeOf<Readonly<Record<"a", number>>>();
});

test("has & lookup: checks existence and extracts value as Maybe", () => {
	const d = Dict.from.entries([["a", 1]]);

	const exists = pipe(d, Dict.has("a"));
	expectTypeOf(exists).toEqualTypeOf<boolean>();

	const val = pipe(d, Dict.lookup("a"));
	expectTypeOf(val).toEqualTypeOf<Maybe<number>>();
});

test("keys, values, entries, size: inspects dictionary dimensions", () => {
	const d = Dict.from.entries([["a", 1]]);

	expectTypeOf(Dict.keys(d)).toEqualTypeOf<readonly string[]>();
	expectTypeOf(Dict.values(d)).toEqualTypeOf<readonly number[]>();
	expectTypeOf(Dict.entries(d)).toEqualTypeOf<readonly (readonly [string, number])[]>();
	expectTypeOf(Dict.size(d)).toEqualTypeOf<number>();
});

test("insert, remove, upsert: updates dictionary entries", () => {
	const d = Dict.from.entries([["a", 1]]);

	const inserted = pipe(d, Dict.insert("b", 2));
	expectTypeOf(inserted).toEqualTypeOf<ReadonlyMap<string, number>>();

	const removed = pipe(d, Dict.remove("a"));
	expectTypeOf(removed).toEqualTypeOf<ReadonlyMap<string, number>>();

	const upserted = pipe(d, Dict.upsert("a", (opt) => (Maybe.is.some(opt) ? opt.value + 1 : 0)));
	expectTypeOf(upserted).toEqualTypeOf<ReadonlyMap<string, number>>();
});

test("map, filterMap, mapWithKey, mapKeys, mapEntries: transforms dictionary structures", () => {
	const d = Dict.from.entries([["a", 1]]);

	const mapped = pipe(d, Dict.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<ReadonlyMap<string, string>>();

	const filterMapped = pipe(d, Dict.filterMap((n) => (n > 0 ? Maybe.make.some(n.toString()) : Maybe.make.none())));
	expectTypeOf(filterMapped).toEqualTypeOf<ReadonlyMap<string, string>>();

	const mappedKey = pipe(d, Dict.mapWithKey((k, v) => `${k}:${v}`));
	expectTypeOf(mappedKey).toEqualTypeOf<ReadonlyMap<string, string>>();

	const mappedKeys = pipe(d, Dict.mapKeys((k) => k.toUpperCase()));
	expectTypeOf(mappedKeys).toEqualTypeOf<ReadonlyMap<string, number>>();

	const mappedEnts = pipe(d, Dict.mapEntries((k, v) => [k.toUpperCase(), v * 10] as const));
	expectTypeOf(mappedEnts).toEqualTypeOf<ReadonlyMap<string, number>>();
});

test("filter & filterWithKey: filters dictionary entries", () => {
	const d = Dict.from.entries([["a", 1]]);

	const filtered = pipe(d, Dict.filter((n) => n > 0));
	expectTypeOf(filtered).toEqualTypeOf<ReadonlyMap<string, number>>();

	const filteredKey = pipe(d, Dict.filterWithKey((k, v) => k === "a" && v > 0));
	expectTypeOf(filteredKey).toEqualTypeOf<ReadonlyMap<string, number>>();
});

test("union, intersection, difference, mergeWith: combines dictionary structures", () => {
	const d1 = Dict.from.entries([["a", 1]]);
	const d2 = Dict.from.entries([["b", 2]]);

	const un = pipe(d1, Dict.union(d2));
	expectTypeOf(un).toEqualTypeOf<ReadonlyMap<string, number>>();

	const inter = pipe(d1, Dict.intersection(d2));
	expectTypeOf(inter).toEqualTypeOf<ReadonlyMap<string, number>>();

	const diff = pipe(d1, Dict.difference(d2));
	expectTypeOf(diff).toEqualTypeOf<ReadonlyMap<string, number>>();

	const merged = pipe(d1, Dict.mergeWith((a: number, b: number) => a + b)(d2));
	expectTypeOf(merged).toEqualTypeOf<ReadonlyMap<string, number>>();
});

test("reduce & reduceWithKey: aggregates dictionary values", () => {
	const d = Dict.from.entries([["a", 1], ["b", 2]]);

	const red = pipe(d, Dict.reduce(0, (acc, n) => acc + n));
	expectTypeOf(red).toEqualTypeOf<number>();

	const redKey = pipe(d, Dict.reduceWithKey("", (acc, v, k) => `${acc}${k}${v}`));
	expectTypeOf(redKey).toEqualTypeOf<string>();
});

test("compact: unwraps Maybe values from dictionary", () => {
	const d = Dict.from.entries([["a", Maybe.make.some(1)]]);
	const compacted = Dict.compact(d);
	expectTypeOf(compacted).toEqualTypeOf<ReadonlyMap<string, number>>();
});

test("groupBy: partitions array into dictionary of NonEmpty arrays", () => {
	const items = ["apple", "banana", "avocado"];
	const grouped = pipe(items, Dict.groupBy((s) => s[0]));
	expectTypeOf(grouped).toEqualTypeOf<ReadonlyMap<string, readonly [string, ...string[]]>>();
});

test("NonEmpty: maintains non-empty branded dictionary guarantees", () => {
	const singleton = Dict.NonEmpty.singleton("a", 1);
	expectTypeOf(singleton).toEqualTypeOf<Dict.NonEmpty<string, number>>();

	const fromMap = Dict.NonEmpty.from.map(new Map([["a", 1]]));
	expectTypeOf(fromMap).toEqualTypeOf<Maybe<Dict.NonEmpty<string, number>>>();

	const keys = Dict.NonEmpty.keys(singleton);
	expectTypeOf(keys).toEqualTypeOf<readonly [string, ...string[]]>();

	const vals = Dict.NonEmpty.values(singleton);
	expectTypeOf(vals).toEqualTypeOf<readonly [number, ...number[]]>();

	const entries = Dict.NonEmpty.entries(singleton);
	expectTypeOf(entries).toEqualTypeOf<readonly [readonly [string, number], ...(readonly [string, number])[]]>();

	const reduced = pipe(singleton, Dict.NonEmpty.reduce((a, b) => a + b));
	expectTypeOf(reduced).toEqualTypeOf<number>();

	const mapped = pipe(singleton, Dict.NonEmpty.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Dict.NonEmpty<string, string>>();

	const mappedKey = pipe(singleton, Dict.NonEmpty.mapWithKey((k, v) => `${k}:${v}`));
	expectTypeOf(mappedKey).toEqualTypeOf<Dict.NonEmpty<string, string>>();
});
