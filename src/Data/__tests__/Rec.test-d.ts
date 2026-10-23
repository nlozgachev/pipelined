import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Result } from "../../Core/Result.ts";
import { Rec } from "../Rec.ts";

test("is: guards empty and non-empty records", () => {
	const r: Readonly<Record<string, number>> = { a: 1 };
	expectTypeOf(Rec.is.empty(r)).toEqualTypeOf<boolean>();

	if (Rec.is.nonEmpty(r)) {
		expectTypeOf(r).toEqualTypeOf<Rec.NonEmpty<number>>();
	}
});

test("map, filterMap, mapWithKey, mapKeys, mapEntries: transforms record structures", () => {
	const r = { a: 1, b: 2 };

	const mapped = pipe(r, Rec.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Readonly<Record<"a" | "b", string>>>();

	const filterMapped = pipe(r, Rec.filterMap((n) => (n > 1 ? Maybe.make.some(n.toString()) : Maybe.make.none())));
	expectTypeOf(filterMapped).toEqualTypeOf<Readonly<Record<string, string>>>();

	const mappedKey = pipe(r, Rec.mapWithKey((k, v) => `${k}:${v}`));
	expectTypeOf(mappedKey).toEqualTypeOf<Readonly<Record<"a" | "b", string>>>();

	const mappedKeys = pipe(r, Rec.mapKeys((k) => k.toUpperCase()));
	expectTypeOf(mappedKeys).toEqualTypeOf<Readonly<Record<string, number>>>();

	const mappedEnts = pipe(r, Rec.mapEntries((k, v) => [k.toUpperCase(), v * 10] as const));
	expectTypeOf(mappedEnts).toEqualTypeOf<Readonly<Record<string, number>>>();
});

test("filter & filterWithKey: filters records", () => {
	const r = { a: 1, b: 2 };

	const filtered = pipe(r, Rec.filter((n) => n > 1));
	expectTypeOf(filtered).toEqualTypeOf<Readonly<Record<string, number>>>();

	const filteredKey = pipe(r, Rec.filterWithKey((k, v) => k === "a" && v > 0));
	expectTypeOf(filteredKey).toEqualTypeOf<Readonly<Record<string, number>>>();
});

test("lookup: retrieves value by key as Maybe", () => {
	const r: Readonly<Record<string, number>> = { a: 1, b: 2 };
	const found = pipe(r, Rec.lookup("a"));
	expectTypeOf(found).toEqualTypeOf<Maybe<number>>();
});

test("keys, values, entries, size: extracts properties and dimensions", () => {
	const r = { a: 1, b: "hello" };

	expectTypeOf(Rec.keys(r)).toEqualTypeOf<readonly ("a" | "b")[]>();
	expectTypeOf(Rec.values(r)).toEqualTypeOf<readonly (number | string)[]>();
	expectTypeOf(Rec.entries(r)).toEqualTypeOf<readonly (readonly ["a" | "b", number | string])[]>();
	expectTypeOf(Rec.size(r)).toEqualTypeOf<number>();
});

test("pick & omit: selects or removes key subsets", () => {
	const r = { a: 1, b: "two", c: true };

	const picked = pipe(r, Rec.pick("a", "b"));
	expectTypeOf(picked).toEqualTypeOf<{ a: number; b: string; }>();

	const omitted = pipe(r, Rec.omit("c"));
	expectTypeOf(omitted).toEqualTypeOf<{ a: number; b: string; }>();
});

test("merge & mergeWith: merges record structures", () => {
	const r1: Readonly<Record<string, number>> = { a: 1 };
	const r2: Readonly<Record<string, number>> = { b: 2 };

	const merged = pipe(r1, Rec.merge(r2));
	expectTypeOf(merged).toEqualTypeOf<Readonly<Record<string, number>>>();

	const mergedCustom = pipe(r1, Rec.mergeWith((a: number, b: number) => a + b)(r2));
	expectTypeOf(mergedCustom).toEqualTypeOf<Readonly<Record<string, number>>>();
});

test("compact: removes None values from Maybe record", () => {
	const r: Readonly<Record<string, Maybe<number>>> = { a: Maybe.make.some(1), b: Maybe.make.none() };
	const compacted = Rec.compact(r);
	expectTypeOf(compacted).toEqualTypeOf<Readonly<Record<string, number>>>();
});

test("groupBy: creates grouped record of arrays", () => {
	const items = ["apple", "banana", "avocado"];
	const grouped = pipe(items, Rec.groupBy((s) => s[0]));
	expectTypeOf(grouped).toEqualTypeOf<Readonly<Record<string, readonly string[]>>>();
});

test("traverse & sequence: maps or transposes effects over records", () => {
	const r = { a: "1", b: "2" };

	const travMaybe = pipe(r, Rec.traverse.Maybe((s) => Maybe.make.some(Number(s))));
	expectTypeOf(travMaybe).toEqualTypeOf<Maybe<Readonly<Record<string, number>>>>();

	const travResult = pipe(
		r,
		Rec.traverse.Result((s) => constTruthyBool() ? Result.make.ok(Number(s)) : Result.make.err("parse_err")),
	);
	expectTypeOf(travResult).toEqualTypeOf<Result<string, Readonly<Record<string, number>>>>();

	const seqMaybe = Rec.sequence.Maybe({ a: Maybe.make.some(1) });
	expectTypeOf(seqMaybe).toEqualTypeOf<Maybe<Readonly<Record<string, number>>>>();

	const seqResult = Rec.sequence.Result({ a: constTruthyBool() ? Result.make.ok(1) : Result.make.err("err") });
	expectTypeOf(seqResult).toEqualTypeOf<Result<string, Readonly<Record<string, number>>>>();
});

test("from.entries & to.Dict: converts between record and other structures", () => {
	const entries: readonly (readonly [string, number])[] = [["a", 1], ["b", 2]];
	const fromEntries = Rec.from.entries(entries);
	expectTypeOf(fromEntries).toEqualTypeOf<Readonly<Record<string, number>>>();

	const dict = Rec.to.Dict({ a: 1, b: 2 });
	expectTypeOf(dict).toEqualTypeOf<ReadonlyMap<"a" | "b", number>>();
});

test("NonEmpty: singleton, from.record, and combinators preserve branded non-empty type", () => {
	const singleton = Rec.NonEmpty.singleton("a", 42);
	expectTypeOf(singleton).toEqualTypeOf<Rec.NonEmpty<number, "a">>();

	const maybeNonEmpty = Rec.NonEmpty.from.record({ a: 1 });
	expectTypeOf(maybeNonEmpty).toEqualTypeOf<Maybe<Rec.NonEmpty<number, "a">>>();

	const keys = Rec.NonEmpty.keys(singleton);
	expectTypeOf(keys).toEqualTypeOf<readonly ["a", ..."a"[]]>();

	const vals = Rec.NonEmpty.values(singleton);
	expectTypeOf(vals).toEqualTypeOf<readonly [number, ...number[]]>();

	const reduced = pipe(singleton, Rec.NonEmpty.reduce((a, b) => a + b));
	expectTypeOf(reduced).toEqualTypeOf<number>();

	const mapped = pipe(singleton, Rec.NonEmpty.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Rec.NonEmpty<string, "a">>();

	const mappedKey = pipe(singleton, Rec.NonEmpty.mapWithKey((k, v) => `${k}:${v}`));
	expectTypeOf(mappedKey).toEqualTypeOf<Rec.NonEmpty<string, "a">>();
});
