import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Uniq } from "../Uniq.ts";

test("is: guards empty, non-empty, and subset relations", () => {
	const s = Uniq.from.array([1, 2]);
	expectTypeOf(Uniq.is.empty(s)).toEqualTypeOf<boolean>();

	if (Uniq.is.nonEmpty(s)) {
		expectTypeOf(s).toEqualTypeOf<Uniq.NonEmpty<number>>();
	}

	const isSub = pipe(s, Uniq.is.subsetOf(Uniq.from.array([1, 2, 3])));
	expectTypeOf(isSub).toEqualTypeOf<boolean>();
});

test("empty, singleton, from, to: constructs and converts sets", () => {
	const empty = Uniq.empty<number>();
	expectTypeOf(empty).toEqualTypeOf<ReadonlySet<number>>();

	const single = Uniq.singleton(42);
	expectTypeOf(single).toEqualTypeOf<ReadonlySet<number>>();

	const fromArr = Uniq.from.array([1, 2, 3]);
	expectTypeOf(fromArr).toEqualTypeOf<ReadonlySet<number>>();

	const toArr = Uniq.to.array(fromArr);
	expectTypeOf(toArr).toEqualTypeOf<readonly number[]>();
});

test("has & size: inspects membership and cardinality", () => {
	const s = Uniq.from.array([1, 2]);

	const member = pipe(s, Uniq.has(1));
	expectTypeOf(member).toEqualTypeOf<boolean>();

	const count = Uniq.size(s);
	expectTypeOf(count).toEqualTypeOf<number>();
});

test("insert, remove, toggle: updates set elements", () => {
	const s = Uniq.from.array([1, 2]);

	const inserted = pipe(s, Uniq.insert(3));
	expectTypeOf(inserted).toEqualTypeOf<ReadonlySet<number>>();

	const removed = pipe(s, Uniq.remove(1));
	expectTypeOf(removed).toEqualTypeOf<ReadonlySet<number>>();

	const toggled = pipe(s, Uniq.toggle(2));
	expectTypeOf(toggled).toEqualTypeOf<ReadonlySet<number>>();
});

test("map, filter, filterMap: transforms and filters sets", () => {
	const s = Uniq.from.array([1, 2]);

	const mapped = pipe(s, Uniq.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<ReadonlySet<string>>();

	const filtered = pipe(s, Uniq.filter((n) => n > 1));
	expectTypeOf(filtered).toEqualTypeOf<ReadonlySet<number>>();

	const filterMapped = pipe(s, Uniq.filterMap((n) => (n > 1 ? Maybe.make.some(n.toString()) : Maybe.make.none())));
	expectTypeOf(filterMapped).toEqualTypeOf<ReadonlySet<string>>();
});

test("union, intersection, difference: performs set algebra", () => {
	const s1 = Uniq.from.array([1, 2]);
	const s2 = Uniq.from.array([2, 3]);

	const un = pipe(s1, Uniq.union(s2));
	expectTypeOf(un).toEqualTypeOf<ReadonlySet<number>>();

	const inter = pipe(s1, Uniq.intersection(s2));
	expectTypeOf(inter).toEqualTypeOf<ReadonlySet<number>>();

	const diff = pipe(s1, Uniq.difference(s2));
	expectTypeOf(diff).toEqualTypeOf<ReadonlySet<number>>();
});

test("reduce: folds elements to accumulator", () => {
	const s = Uniq.from.array([1, 2, 3]);
	const sum = pipe(s, Uniq.reduce(0, (acc, n) => acc + n));
	expectTypeOf(sum).toEqualTypeOf<number>();
});

test("NonEmpty: singleton, from.set, reduce, map, to.array preserve non-empty brand", () => {
	const single = Uniq.NonEmpty.singleton(42);
	expectTypeOf(single).toEqualTypeOf<Uniq.NonEmpty<number>>();

	const refined = Uniq.NonEmpty.from.set(new Set([1, 2]));
	expectTypeOf(refined).toEqualTypeOf<Maybe<Uniq.NonEmpty<number>>>();

	const reduced = pipe(single, Uniq.NonEmpty.reduce((a, b) => a + b));
	expectTypeOf(reduced).toEqualTypeOf<number>();

	const mapped = pipe(single, Uniq.NonEmpty.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Uniq.NonEmpty<string>>();

	const arr = Uniq.NonEmpty.to.array(single);
	expectTypeOf(arr).toEqualTypeOf<readonly [number, ...number[]]>();
});
