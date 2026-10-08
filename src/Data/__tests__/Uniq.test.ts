import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Uniq } from "../Uniq.ts";

// ---------------------------------------------------------------------------
// empty
// ---------------------------------------------------------------------------

test("empty: returns ReadonlySet with size 0", () => {
	expect(Uniq.empty<number>().size).toBe(0);
});

// ---------------------------------------------------------------------------
// singleton
// ---------------------------------------------------------------------------

test("singleton: returns ReadonlySet with one item", () => {
	const s = Uniq.singleton(42);
	expect(s.size).toBe(1);
	expect(s.has(42)).toBe(true);
});

// ---------------------------------------------------------------------------
// from.array
// ---------------------------------------------------------------------------

test("from.array: deduplicates items", () => {
	const s = Uniq.from.array([1, 2, 2, 3, 3, 3]);
	expect(s.size).toBe(3);
});

test("from.array: returns empty set for empty array", () => {
	expect(Uniq.from.array([]).size).toBe(0);
});

test("from.array: preserves all unique items", () => {
	const s = Uniq.from.array([10, 20, 30]);
	expect(s.has(10)).toBe(true);
	expect(s.has(20)).toBe(true);
	expect(s.has(30)).toBe(true);
});

// ---------------------------------------------------------------------------
// has
// ---------------------------------------------------------------------------

test("has: returns true when item is in set", () => {
	expect(pipe(Uniq.from.array([1, 2, 3]), Uniq.has(2))).toBe(true);
});

test("has: returns false when item is not in set", () => {
	expect(pipe(Uniq.from.array([1, 2, 3]), Uniq.has(4))).toBe(false);
});

test("has: returns false on empty set", () => {
	expect(pipe(Uniq.empty<number>(), Uniq.has(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// size
// ---------------------------------------------------------------------------

test("size: returns number of items", () => {
	expect(Uniq.size(Uniq.from.array([1, 2, 3]))).toBe(3);
	expect(Uniq.size(Uniq.empty())).toBe(0);
});

// ---------------------------------------------------------------------------
// isEmpty
// ---------------------------------------------------------------------------

test("is.empty: returns true for empty set", () => {
	expect(Uniq.is.empty(Uniq.empty())).toBe(true);
});

test("is.empty: returns false for non-empty set", () => {
	expect(Uniq.is.empty(Uniq.singleton(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// is.subsetOf
// ---------------------------------------------------------------------------

test("is.subsetOf: returns true when all items are in other", () => {
	expect(pipe(Uniq.from.array([1, 2]), Uniq.is.subsetOf(Uniq.from.array([1, 2, 3])))).toBe(true);
});

test("is.subsetOf: returns false when some items are missing from other", () => {
	expect(pipe(Uniq.from.array([1, 4]), Uniq.is.subsetOf(Uniq.from.array([1, 2, 3])))).toBe(false);
});

test("is.subsetOf: returns true when empty set is subset of any set", () => {
	expect(pipe(Uniq.empty<number>(), Uniq.is.subsetOf(Uniq.from.array([1, 2, 3])))).toBe(true);
});

test("is.subsetOf: returns true when set equals other", () => {
	expect(pipe(Uniq.from.array([1, 2]), Uniq.is.subsetOf(Uniq.from.array([1, 2])))).toBe(true);
});

// ---------------------------------------------------------------------------
// insert
// ---------------------------------------------------------------------------

test("insert: adds a new item", () => {
	const s = pipe(Uniq.from.array([1, 2]), Uniq.insert(3));
	expect(s.size).toBe(3);
	expect(s.has(3)).toBe(true);
});

test("insert: returns original reference when item already present", () => {
	const original = Uniq.from.array([1, 2, 3]);
	const result = pipe(original, Uniq.insert(2));
	expect(result).toBe(original);
});

test("insert: does not mutate original set", () => {
	const original = Uniq.from.array([1, 2]);
	pipe(original, Uniq.insert(3));
	expect(original.size).toBe(2);
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

test("remove: removes existing item", () => {
	const s = pipe(Uniq.from.array([1, 2, 3]), Uniq.remove(2));
	expect(s.size).toBe(2);
	expect(s.has(2)).toBe(false);
});

test("remove: returns original reference when item not present", () => {
	const original = Uniq.from.array([1, 2, 3]);
	const result = pipe(original, Uniq.remove(4));
	expect(result).toBe(original);
});

test("remove: does not mutate original set", () => {
	const original = Uniq.from.array([1, 2, 3]);
	pipe(original, Uniq.remove(1));
	expect(original.size).toBe(3);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: transforms all items", () => {
	const s = pipe(Uniq.from.array([1, 2, 3]), Uniq.map((n) => n * 2));
	expect([...Uniq.to.array(s)].toSorted((a, b) => a - b)).toStrictEqual([2, 4, 6]);
});

test("map: merges duplicate results", () => {
	const s = pipe(Uniq.from.array([1, 2, 3, 4]), Uniq.map((n) => n % 3));
	expect(s.size).toBe(3); // 1%3=1, 2%3=2, 3%3=0, 4%3=1 — three unique values
});

test("map: returns empty set when input is empty", () => {
	expect(pipe(Uniq.empty<number>(), Uniq.map((n) => n * 2)).size).toBe(0);
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("filter: keeps items matching predicate", () => {
	const s = pipe(Uniq.from.array([1, 2, 3, 4, 5]), Uniq.filter((n) => n % 2 === 0));
	expect([...Uniq.to.array(s)].toSorted((a, b) => a - b)).toStrictEqual([2, 4]);
});

test("filter: returns empty set when nothing matches", () => {
	expect(pipe(Uniq.from.array([1, 3, 5]), Uniq.filter((n) => n % 2 === 0)).size).toBe(0);
});

// ---------------------------------------------------------------------------
// union
// ---------------------------------------------------------------------------

test("union: combines items from both sets", () => {
	const s = pipe(Uniq.from.array([1, 2, 3]), Uniq.union(Uniq.from.array([2, 3, 4])));
	expect(s.size).toBe(4);
	expect(s.has(1)).toBe(true);
	expect(s.has(4)).toBe(true);
});

test("union: returns equivalent set when unioned with empty set", () => {
	const base = Uniq.from.array([1, 2]);
	const result = pipe(base, Uniq.union(Uniq.empty<number>()));
	expect(result.size).toBe(2);
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

test("intersection: keeps only items in both sets", () => {
	const s = pipe(Uniq.from.array([1, 2, 3]), Uniq.intersection(Uniq.from.array([2, 3, 4])));
	expect(s.size).toBe(2);
	expect(s.has(2)).toBe(true);
	expect(s.has(3)).toBe(true);
	expect(s.has(1)).toBe(false);
	expect(s.has(4)).toBe(false);
});

test("intersection: returns empty set when no common items", () => {
	const s = pipe(Uniq.from.array([1, 2]), Uniq.intersection(Uniq.from.array([3, 4])));
	expect(s.size).toBe(0);
});

// ---------------------------------------------------------------------------
// difference
// ---------------------------------------------------------------------------

test("difference: keeps items from set that are not in other", () => {
	const s = pipe(Uniq.from.array([1, 2, 3, 4]), Uniq.difference(Uniq.from.array([2, 4])));
	expect(s.size).toBe(2);
	expect(s.has(1)).toBe(true);
	expect(s.has(3)).toBe(true);
});

test("difference: returns empty set when all items are in other", () => {
	const s = pipe(Uniq.from.array([1, 2]), Uniq.difference(Uniq.from.array([1, 2, 3])));
	expect(s.size).toBe(0);
});

test("difference: returns equivalent set when other is empty", () => {
	const s = pipe(Uniq.from.array([1, 2, 3]), Uniq.difference(Uniq.empty<number>()));
	expect(s.size).toBe(3);
});

// ---------------------------------------------------------------------------
// isSubsetOf — polyfill path
// ---------------------------------------------------------------------------

test("is.subsetOf: handles polyfill path when all items in other", () => {
	const s = Object.defineProperty(Uniq.from.array([1, 2]) as Set<number>, "isSubsetOf", {
		value: undefined,
		configurable: true,
	});
	expect(pipe(s, Uniq.is.subsetOf(Uniq.from.array([1, 2, 3])))).toBe(true);
});

test("is.subsetOf: handles polyfill path when item missing from other", () => {
	const s = Object.defineProperty(Uniq.from.array([1, 4]) as Set<number>, "isSubsetOf", {
		value: undefined,
		configurable: true,
	});
	expect(pipe(s, Uniq.is.subsetOf(Uniq.from.array([1, 2, 3])))).toBe(false);
});

// ---------------------------------------------------------------------------
// union — polyfill path
// ---------------------------------------------------------------------------

test("union: handles polyfill path to combine items from both sets", () => {
	const data = Object.defineProperty(Uniq.from.array([1, 2, 3]) as Set<number>, "union", {
		value: undefined,
		configurable: true,
	});
	const s = pipe(data, Uniq.union(Uniq.from.array([2, 3, 4])));
	expect(s.size).toBe(4);
	expect(s.has(1)).toBe(true);
	expect(s.has(4)).toBe(true);
});

// ---------------------------------------------------------------------------
// intersection — polyfill path
// ---------------------------------------------------------------------------

test("intersection: handles polyfill path to keep items in both sets", () => {
	const data = Object.defineProperty(Uniq.from.array([1, 2, 3]) as Set<number>, "intersection", {
		value: undefined,
		configurable: true,
	});
	const s = pipe(data, Uniq.intersection(Uniq.from.array([2, 3, 4])));
	expect(s.size).toBe(2);
	expect(s.has(2)).toBe(true);
	expect(s.has(3)).toBe(true);
	expect(s.has(1)).toBe(false);
});

test("intersection: handles polyfill path when no common items", () => {
	const data = Object.defineProperty(Uniq.from.array([1, 2]) as Set<number>, "intersection", {
		value: undefined,
		configurable: true,
	});
	const s = pipe(data, Uniq.intersection(Uniq.from.array([3, 4])));
	expect(s.size).toBe(0);
});

// ---------------------------------------------------------------------------
// difference — polyfill path
// ---------------------------------------------------------------------------

test("difference: handles polyfill path to keep items not in other", () => {
	const data = Object.defineProperty(Uniq.from.array([1, 2, 3, 4]) as Set<number>, "difference", {
		value: undefined,
		configurable: true,
	});
	const s = pipe(data, Uniq.difference(Uniq.from.array([2, 4])));
	expect(s.size).toBe(2);
	expect(s.has(1)).toBe(true);
	expect(s.has(3)).toBe(true);
});

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

test("reduce: folds all items", () => {
	expect(Uniq.reduce(0, (acc, n: number) => acc + n)(Uniq.from.array([1, 2, 3, 4]))).toBe(10);
});

test("reduce: returns initial value for empty set", () => {
	expect(Uniq.reduce(42, (acc, n: number) => acc + n)(Uniq.empty())).toBe(42);
});

// ---------------------------------------------------------------------------
// toArray
// ---------------------------------------------------------------------------

test("to.array: returns items in insertion order", () => {
	expect(Uniq.to.array(Uniq.from.array([3, 1, 2]))).toStrictEqual([3, 1, 2]);
});

test("to.array: returns empty array for empty set", () => {
	expect(Uniq.to.array(Uniq.empty())).toStrictEqual([]);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes from.array filter map and reduce", () => {
	const result = pipe(
		Uniq.from.array([1, 2, 3, 4, 5, 6, 1, 2]), // dedup → {1,2,3,4,5,6}
		Uniq.filter((n) => n % 2 === 0), // {2,4,6}
		Uniq.map((n) => n * 10), // {20,40,60}
		Uniq.reduce(0, (acc, n) => acc + n), // 120
	);
	expect(result).toBe(120);
});

test("pipe: composes set operations across pipelines", () => {
	const admins = Uniq.from.array(["alice", "carol"]);
	const editors = Uniq.from.array(["bob", "carol", "dave"]);
	const privileged = pipe(
		admins,
		Uniq.union(editors), // all users with any role
		Uniq.difference( // remove those who are only editors, not admins
			pipe(editors, Uniq.difference(admins)),
		),
	);
	expect(privileged.has("alice")).toBe(true);
	expect(privileged.has("carol")).toBe(true);
	expect(privileged.has("bob")).toBe(false);
	expect(privileged.has("dave")).toBe(false);
});

// ---------------------------------------------------------------------------
// Uniq.NonEmpty
// ---------------------------------------------------------------------------

test("is.nonEmpty: returns true for non-empty set", () => {
	expect(Uniq.is.nonEmpty(Uniq.singleton(42))).toBe(true);
});

test("is.nonEmpty: returns false for empty set", () => {
	expect(Uniq.is.nonEmpty(Uniq.empty())).toBe(false);
});

test("NonEmpty.singleton: creates a single-element set", () => {
	const result = Uniq.NonEmpty.singleton(42);
	expect(result.size).toBe(1);
	expect(result.has(42)).toBe(true);
	expectTypeOf(result).toEqualTypeOf<Uniq.NonEmpty<number>>();
});

test("NonEmpty.from.set: returns Some for non-empty set", () => {
	const result = Uniq.NonEmpty.from.set(Uniq.singleton(42));
	if (result.kind !== "Some") {
		throw new Error("Expected Some");
	}
	expect(result.value.size).toBe(1);
	expectTypeOf(result.value).toEqualTypeOf<Uniq.NonEmpty<number>>();
});

test("NonEmpty.from.set: returns None for empty set", () => {
	const result = Uniq.NonEmpty.from.set(Uniq.empty());
	expect(result.kind).toBe("None");
});

test("NonEmpty.reduce: reduces non-empty set without initial seed", () => {
	const s = Uniq.NonEmpty.singleton(10);
	const result = pipe(s, Uniq.NonEmpty.reduce((a, b) => a + b));
	expect(result).toBe(10);
});

test("NonEmpty.to.array: returns non-empty array of elements", () => {
	const s = Uniq.NonEmpty.singleton(42);
	const result = Uniq.NonEmpty.to.array(s);
	expect(result).toStrictEqual([42]);
	expectTypeOf(result).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("map: returns standard ReadonlySet when called on NonEmpty", () => {
	const s = Uniq.NonEmpty.singleton(10);
	const mapped = Uniq.map((n: number) => n * 2)(s);
	expect(mapped.has(20)).toBe(true);
	expectTypeOf(mapped).toEqualTypeOf<ReadonlySet<number>>();
});

test("NonEmpty.map: maps items and preserves NonEmpty type", () => {
	const s = Uniq.NonEmpty.singleton(10);
	const mapped = pipe(s, Uniq.NonEmpty.map((n) => n * 2));
	expect(mapped.has(20)).toBe(true);
	expectTypeOf(mapped).toEqualTypeOf<Uniq.NonEmpty<number>>();
});

test("NonEmpty: composes in pipe workflow", () => {
	const result = pipe(Uniq.NonEmpty.singleton(5), Uniq.NonEmpty.map((n) => n * 2), Uniq.NonEmpty.to.array);
	expect(result).toStrictEqual([10]);
});

test("toggle: toggles item inclusion", () => {
	const set1 = Uniq.from.array([1, 2]);
	const set2 = pipe(set1, Uniq.toggle(2));
	expect(set2.has(2)).toBe(false);
	const set3 = pipe(set2, Uniq.toggle(2));
	expect(set3.has(2)).toBe(true);
});

test("filterMap: filters and maps elements", () => {
	const set = Uniq.from.array([1, 2, 3, 4]);
	const res = pipe(set, Uniq.filterMap((n) => (n % 2 === 0 ? Maybe.make.some(n * 10) : Maybe.make.none())));
	expect(res).toStrictEqual(Uniq.from.array([20, 40]));
});
