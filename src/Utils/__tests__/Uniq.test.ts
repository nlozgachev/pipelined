import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Uniq } from "../Uniq.ts";
import { pipe } from "#composition/pipe.ts";

// ---------------------------------------------------------------------------
// empty
// ---------------------------------------------------------------------------

Deno.test("Uniq.empty returns a ReadonlySet with size 0", () => {
	assertStrictEquals(Uniq.empty<number>().size, 0);
});

// ---------------------------------------------------------------------------
// singleton
// ---------------------------------------------------------------------------

Deno.test("Uniq.singleton returns a ReadonlySet with one item", () => {
	const s = Uniq.singleton(42);
	assertStrictEquals(s.size, 1);
	assertStrictEquals(s.has(42), true);
});

// ---------------------------------------------------------------------------
// fromArray
// ---------------------------------------------------------------------------

Deno.test("Uniq.fromArray deduplicates items", () => {
	const s = Uniq.fromArray([1, 2, 2, 3, 3, 3]);
	assertStrictEquals(s.size, 3);
});

Deno.test("Uniq.fromArray returns empty set for empty array", () => {
	assertStrictEquals(Uniq.fromArray([]).size, 0);
});

Deno.test("Uniq.fromArray preserves all unique items", () => {
	const s = Uniq.fromArray([10, 20, 30]);
	assertStrictEquals(s.has(10), true);
	assertStrictEquals(s.has(20), true);
	assertStrictEquals(s.has(30), true);
});

// ---------------------------------------------------------------------------
// has
// ---------------------------------------------------------------------------

Deno.test("Uniq.has returns true when item is in the set", () => {
	assertStrictEquals(pipe(Uniq.fromArray([1, 2, 3]), Uniq.has(2)), true);
});

Deno.test("Uniq.has returns false when item is not in the set", () => {
	assertStrictEquals(pipe(Uniq.fromArray([1, 2, 3]), Uniq.has(4)), false);
});

Deno.test("Uniq.has returns false on empty set", () => {
	assertStrictEquals(pipe(Uniq.empty<number>(), Uniq.has(1)), false);
});

// ---------------------------------------------------------------------------
// size
// ---------------------------------------------------------------------------

Deno.test("Uniq.size returns the number of items", () => {
	assertStrictEquals(Uniq.size(Uniq.fromArray([1, 2, 3])), 3);
	assertStrictEquals(Uniq.size(Uniq.empty()), 0);
});

// ---------------------------------------------------------------------------
// isEmpty
// ---------------------------------------------------------------------------

Deno.test("Uniq.isEmpty returns true for empty set", () => {
	assertStrictEquals(Uniq.isEmpty(Uniq.empty()), true);
});

Deno.test("Uniq.isEmpty returns false for non-empty set", () => {
	assertStrictEquals(Uniq.isEmpty(Uniq.singleton(1)), false);
});

// ---------------------------------------------------------------------------
// isSubsetOf
// ---------------------------------------------------------------------------

Deno.test("Uniq.isSubsetOf returns true when all items are in other", () => {
	assertStrictEquals(
		pipe(Uniq.fromArray([1, 2]), Uniq.isSubsetOf(Uniq.fromArray([1, 2, 3]))),
		true,
	);
});

Deno.test("Uniq.isSubsetOf returns false when some items are missing from other", () => {
	assertStrictEquals(
		pipe(Uniq.fromArray([1, 4]), Uniq.isSubsetOf(Uniq.fromArray([1, 2, 3]))),
		false,
	);
});

Deno.test("Uniq.isSubsetOf empty set is subset of any set", () => {
	assertStrictEquals(
		pipe(Uniq.empty<number>(), Uniq.isSubsetOf(Uniq.fromArray([1, 2, 3]))),
		true,
	);
});

Deno.test("Uniq.isSubsetOf returns true when set equals other", () => {
	assertStrictEquals(
		pipe(Uniq.fromArray([1, 2]), Uniq.isSubsetOf(Uniq.fromArray([1, 2]))),
		true,
	);
});

// ---------------------------------------------------------------------------
// insert
// ---------------------------------------------------------------------------

Deno.test("Uniq.insert adds a new item", () => {
	const s = pipe(Uniq.fromArray([1, 2]), Uniq.insert(3));
	assertStrictEquals(s.size, 3);
	assertStrictEquals(s.has(3), true);
});

Deno.test("Uniq.insert returns original reference when item already present", () => {
	const original = Uniq.fromArray([1, 2, 3]);
	const result = pipe(original, Uniq.insert(2));
	assertStrictEquals(result, original);
});

Deno.test("Uniq.insert does not mutate the original", () => {
	const original = Uniq.fromArray([1, 2]);
	pipe(original, Uniq.insert(3));
	assertStrictEquals(original.size, 2);
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

Deno.test("Uniq.remove removes an existing item", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3]), Uniq.remove(2));
	assertStrictEquals(s.size, 2);
	assertStrictEquals(s.has(2), false);
});

Deno.test("Uniq.remove returns original reference when item not present", () => {
	const original = Uniq.fromArray([1, 2, 3]);
	const result = pipe(original, Uniq.remove(4));
	assertStrictEquals(result, original);
});

Deno.test("Uniq.remove does not mutate the original", () => {
	const original = Uniq.fromArray([1, 2, 3]);
	pipe(original, Uniq.remove(1));
	assertStrictEquals(original.size, 3);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("Uniq.map transforms all items", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3]), Uniq.map((n) => n * 2));
	assertEquals([...Uniq.toArray(s)].sort((a, b) => a - b), [2, 4, 6]);
});

Deno.test("Uniq.map merges duplicate results", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3, 4]), Uniq.map((n) => n % 3));
	assertStrictEquals(s.size, 3); // 1%3=1, 2%3=2, 3%3=0, 4%3=1 — three unique values
});

Deno.test("Uniq.map on empty set returns empty set", () => {
	assertStrictEquals(pipe(Uniq.empty<number>(), Uniq.map((n) => n * 2)).size, 0);
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

Deno.test("Uniq.filter keeps items matching predicate", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3, 4, 5]), Uniq.filter((n) => n % 2 === 0));
	assertEquals([...Uniq.toArray(s)].sort((a, b) => a - b), [2, 4]);
});

Deno.test("Uniq.filter returns empty set when nothing matches", () => {
	assertStrictEquals(
		pipe(Uniq.fromArray([1, 3, 5]), Uniq.filter((n) => n % 2 === 0)).size,
		0,
	);
});

// ---------------------------------------------------------------------------
// union
// ---------------------------------------------------------------------------

Deno.test("Uniq.union combines items from both sets", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3]), Uniq.union(Uniq.fromArray([2, 3, 4])));
	assertStrictEquals(s.size, 4);
	assertStrictEquals(s.has(1), true);
	assertStrictEquals(s.has(4), true);
});

Deno.test("Uniq.union with empty set returns equivalent set", () => {
	const base = Uniq.fromArray([1, 2]);
	const result = pipe(base, Uniq.union(Uniq.empty<number>()));
	assertStrictEquals(result.size, 2);
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

Deno.test("Uniq.intersection keeps only items in both sets", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3]), Uniq.intersection(Uniq.fromArray([2, 3, 4])));
	assertStrictEquals(s.size, 2);
	assertStrictEquals(s.has(2), true);
	assertStrictEquals(s.has(3), true);
	assertStrictEquals(s.has(1), false);
	assertStrictEquals(s.has(4), false);
});

Deno.test("Uniq.intersection returns empty set when no common items", () => {
	const s = pipe(Uniq.fromArray([1, 2]), Uniq.intersection(Uniq.fromArray([3, 4])));
	assertStrictEquals(s.size, 0);
});

// ---------------------------------------------------------------------------
// difference
// ---------------------------------------------------------------------------

Deno.test("Uniq.difference keeps items from set that are not in other", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3, 4]), Uniq.difference(Uniq.fromArray([2, 4])));
	assertStrictEquals(s.size, 2);
	assertStrictEquals(s.has(1), true);
	assertStrictEquals(s.has(3), true);
});

Deno.test("Uniq.difference returns empty set when all items are in other", () => {
	const s = pipe(Uniq.fromArray([1, 2]), Uniq.difference(Uniq.fromArray([1, 2, 3])));
	assertStrictEquals(s.size, 0);
});

Deno.test("Uniq.difference with empty other returns equivalent set", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3]), Uniq.difference(Uniq.empty<number>()));
	assertStrictEquals(s.size, 3);
});

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

Deno.test("Uniq.reduce folds all items", () => {
	assertStrictEquals(
		Uniq.reduce(0, (acc, n: number) => acc + n)(Uniq.fromArray([1, 2, 3, 4])),
		10,
	);
});

Deno.test("Uniq.reduce returns init for empty set", () => {
	assertStrictEquals(Uniq.reduce(42, (acc, n: number) => acc + n)(Uniq.empty()), 42);
});

// ---------------------------------------------------------------------------
// toArray
// ---------------------------------------------------------------------------

Deno.test("Uniq.toArray returns items in insertion order", () => {
	assertEquals(Uniq.toArray(Uniq.fromArray([3, 1, 2])), [3, 1, 2]);
});

Deno.test("Uniq.toArray returns empty array for empty set", () => {
	assertEquals(Uniq.toArray(Uniq.empty()), []);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("Uniq pipe composition — fromArray, filter, map, reduce", () => {
	const result = pipe(
		Uniq.fromArray([1, 2, 3, 4, 5, 6, 1, 2]), // dedup → {1,2,3,4,5,6}
		Uniq.filter((n) => n % 2 === 0), // {2,4,6}
		Uniq.map((n) => n * 10), // {20,40,60}
		Uniq.reduce(0, (acc, n) => acc + n), // 120
	);
	assertStrictEquals(result, 120);
});

Deno.test("Uniq pipe composition — set operations", () => {
	const admins = Uniq.fromArray(["alice", "carol"]);
	const editors = Uniq.fromArray(["bob", "carol", "dave"]);
	const privileged = pipe(
		admins,
		Uniq.union(editors), // all users with any role
		Uniq.difference( // remove those who are only editors, not admins
			pipe(editors, Uniq.difference(admins)),
		),
	);
	assertStrictEquals(privileged.has("alice"), true);
	assertStrictEquals(privileged.has("carol"), true);
	assertStrictEquals(privileged.has("bob"), false);
	assertStrictEquals(privileged.has("dave"), false);
});
