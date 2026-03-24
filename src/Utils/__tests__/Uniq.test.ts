import { pipe } from "#composition/pipe.ts";
import { expect, test } from "vitest";
import { Uniq } from "../Uniq.ts";

// ---------------------------------------------------------------------------
// empty
// ---------------------------------------------------------------------------

test("Uniq.empty returns a ReadonlySet with size 0", () => {
	expect(Uniq.empty<number>().size).toBe(0);
});

// ---------------------------------------------------------------------------
// singleton
// ---------------------------------------------------------------------------

test("Uniq.singleton returns a ReadonlySet with one item", () => {
	const s = Uniq.singleton(42);
	expect(s.size).toBe(1);
	expect(s.has(42)).toBe(true);
});

// ---------------------------------------------------------------------------
// fromArray
// ---------------------------------------------------------------------------

test("Uniq.fromArray deduplicates items", () => {
	const s = Uniq.fromArray([1, 2, 2, 3, 3, 3]);
	expect(s.size).toBe(3);
});

test("Uniq.fromArray returns empty set for empty array", () => {
	expect(Uniq.fromArray([]).size).toBe(0);
});

test("Uniq.fromArray preserves all unique items", () => {
	const s = Uniq.fromArray([10, 20, 30]);
	expect(s.has(10)).toBe(true);
	expect(s.has(20)).toBe(true);
	expect(s.has(30)).toBe(true);
});

// ---------------------------------------------------------------------------
// has
// ---------------------------------------------------------------------------

test("Uniq.has returns true when item is in the set", () => {
	expect(pipe(Uniq.fromArray([1, 2, 3]), Uniq.has(2))).toBe(true);
});

test("Uniq.has returns false when item is not in the set", () => {
	expect(pipe(Uniq.fromArray([1, 2, 3]), Uniq.has(4))).toBe(false);
});

test("Uniq.has returns false on empty set", () => {
	expect(pipe(Uniq.empty<number>(), Uniq.has(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// size
// ---------------------------------------------------------------------------

test("Uniq.size returns the number of items", () => {
	expect(Uniq.size(Uniq.fromArray([1, 2, 3]))).toBe(3);
	expect(Uniq.size(Uniq.empty())).toBe(0);
});

// ---------------------------------------------------------------------------
// isEmpty
// ---------------------------------------------------------------------------

test("Uniq.isEmpty returns true for empty set", () => {
	expect(Uniq.isEmpty(Uniq.empty())).toBe(true);
});

test("Uniq.isEmpty returns false for non-empty set", () => {
	expect(Uniq.isEmpty(Uniq.singleton(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// isSubsetOf
// ---------------------------------------------------------------------------

test("Uniq.isSubsetOf returns true when all items are in other", () => {
	expect(pipe(Uniq.fromArray([1, 2]), Uniq.isSubsetOf(Uniq.fromArray([1, 2, 3])))).toBe(true);
});

test("Uniq.isSubsetOf returns false when some items are missing from other", () => {
	expect(pipe(Uniq.fromArray([1, 4]), Uniq.isSubsetOf(Uniq.fromArray([1, 2, 3])))).toBe(false);
});

test("Uniq.isSubsetOf empty set is subset of any set", () => {
	expect(pipe(Uniq.empty<number>(), Uniq.isSubsetOf(Uniq.fromArray([1, 2, 3])))).toBe(true);
});

test("Uniq.isSubsetOf returns true when set equals other", () => {
	expect(pipe(Uniq.fromArray([1, 2]), Uniq.isSubsetOf(Uniq.fromArray([1, 2])))).toBe(true);
});

// ---------------------------------------------------------------------------
// insert
// ---------------------------------------------------------------------------

test("Uniq.insert adds a new item", () => {
	const s = pipe(Uniq.fromArray([1, 2]), Uniq.insert(3));
	expect(s.size).toBe(3);
	expect(s.has(3)).toBe(true);
});

test("Uniq.insert returns original reference when item already present", () => {
	const original = Uniq.fromArray([1, 2, 3]);
	const result = pipe(original, Uniq.insert(2));
	expect(result).toBe(original);
});

test("Uniq.insert does not mutate the original", () => {
	const original = Uniq.fromArray([1, 2]);
	pipe(original, Uniq.insert(3));
	expect(original.size).toBe(2);
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

test("Uniq.remove removes an existing item", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3]), Uniq.remove(2));
	expect(s.size).toBe(2);
	expect(s.has(2)).toBe(false);
});

test("Uniq.remove returns original reference when item not present", () => {
	const original = Uniq.fromArray([1, 2, 3]);
	const result = pipe(original, Uniq.remove(4));
	expect(result).toBe(original);
});

test("Uniq.remove does not mutate the original", () => {
	const original = Uniq.fromArray([1, 2, 3]);
	pipe(original, Uniq.remove(1));
	expect(original.size).toBe(3);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Uniq.map transforms all items", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3]), Uniq.map((n) => n * 2));
	expect([...Uniq.toArray(s)].sort((a, b) => a - b)).toEqual([2, 4, 6]);
});

test("Uniq.map merges duplicate results", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3, 4]), Uniq.map((n) => n % 3));
	expect(s.size).toBe(3); // 1%3=1, 2%3=2, 3%3=0, 4%3=1 — three unique values
});

test("Uniq.map on empty set returns empty set", () => {
	expect(pipe(Uniq.empty<number>(), Uniq.map((n) => n * 2)).size).toBe(0);
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("Uniq.filter keeps items matching predicate", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3, 4, 5]), Uniq.filter((n) => n % 2 === 0));
	expect([...Uniq.toArray(s)].sort((a, b) => a - b)).toEqual([2, 4]);
});

test("Uniq.filter returns empty set when nothing matches", () => {
	expect(pipe(Uniq.fromArray([1, 3, 5]), Uniq.filter((n) => n % 2 === 0)).size).toBe(0);
});

// ---------------------------------------------------------------------------
// union
// ---------------------------------------------------------------------------

test("Uniq.union combines items from both sets", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3]), Uniq.union(Uniq.fromArray([2, 3, 4])));
	expect(s.size).toBe(4);
	expect(s.has(1)).toBe(true);
	expect(s.has(4)).toBe(true);
});

test("Uniq.union with empty set returns equivalent set", () => {
	const base = Uniq.fromArray([1, 2]);
	const result = pipe(base, Uniq.union(Uniq.empty<number>()));
	expect(result.size).toBe(2);
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

test("Uniq.intersection keeps only items in both sets", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3]), Uniq.intersection(Uniq.fromArray([2, 3, 4])));
	expect(s.size).toBe(2);
	expect(s.has(2)).toBe(true);
	expect(s.has(3)).toBe(true);
	expect(s.has(1)).toBe(false);
	expect(s.has(4)).toBe(false);
});

test("Uniq.intersection returns empty set when no common items", () => {
	const s = pipe(Uniq.fromArray([1, 2]), Uniq.intersection(Uniq.fromArray([3, 4])));
	expect(s.size).toBe(0);
});

// ---------------------------------------------------------------------------
// difference
// ---------------------------------------------------------------------------

test("Uniq.difference keeps items from set that are not in other", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3, 4]), Uniq.difference(Uniq.fromArray([2, 4])));
	expect(s.size).toBe(2);
	expect(s.has(1)).toBe(true);
	expect(s.has(3)).toBe(true);
});

test("Uniq.difference returns empty set when all items are in other", () => {
	const s = pipe(Uniq.fromArray([1, 2]), Uniq.difference(Uniq.fromArray([1, 2, 3])));
	expect(s.size).toBe(0);
});

test("Uniq.difference with empty other returns equivalent set", () => {
	const s = pipe(Uniq.fromArray([1, 2, 3]), Uniq.difference(Uniq.empty<number>()));
	expect(s.size).toBe(3);
});

// ---------------------------------------------------------------------------
// isSubsetOf — polyfill path
// ---------------------------------------------------------------------------

test("Uniq.isSubsetOf polyfill path — true when all items in other", () => {
	const s = Object.defineProperty(Uniq.fromArray([1, 2]) as Set<number>, "isSubsetOf", {
		value: undefined,
		configurable: true,
	});
	expect(pipe(s, Uniq.isSubsetOf(Uniq.fromArray([1, 2, 3])))).toBe(true);
});

test("Uniq.isSubsetOf polyfill path — false when item missing from other", () => {
	const s = Object.defineProperty(Uniq.fromArray([1, 4]) as Set<number>, "isSubsetOf", {
		value: undefined,
		configurable: true,
	});
	expect(pipe(s, Uniq.isSubsetOf(Uniq.fromArray([1, 2, 3])))).toBe(false);
});

// ---------------------------------------------------------------------------
// union — polyfill path
// ---------------------------------------------------------------------------

test("Uniq.union polyfill path — combines items from both sets", () => {
	const data = Object.defineProperty(Uniq.fromArray([1, 2, 3]) as Set<number>, "union", {
		value: undefined,
		configurable: true,
	});
	const s = pipe(data, Uniq.union(Uniq.fromArray([2, 3, 4])));
	expect(s.size).toBe(4);
	expect(s.has(1)).toBe(true);
	expect(s.has(4)).toBe(true);
});

// ---------------------------------------------------------------------------
// intersection — polyfill path
// ---------------------------------------------------------------------------

test("Uniq.intersection polyfill path — keeps only items in both sets", () => {
	const data = Object.defineProperty(Uniq.fromArray([1, 2, 3]) as Set<number>, "intersection", {
		value: undefined,
		configurable: true,
	});
	const s = pipe(data, Uniq.intersection(Uniq.fromArray([2, 3, 4])));
	expect(s.size).toBe(2);
	expect(s.has(2)).toBe(true);
	expect(s.has(3)).toBe(true);
	expect(s.has(1)).toBe(false);
});

test("Uniq.intersection polyfill path — returns empty set when no common items", () => {
	const data = Object.defineProperty(Uniq.fromArray([1, 2]) as Set<number>, "intersection", {
		value: undefined,
		configurable: true,
	});
	const s = pipe(data, Uniq.intersection(Uniq.fromArray([3, 4])));
	expect(s.size).toBe(0);
});

// ---------------------------------------------------------------------------
// difference — polyfill path
// ---------------------------------------------------------------------------

test("Uniq.difference polyfill path — keeps items not in other", () => {
	const data = Object.defineProperty(Uniq.fromArray([1, 2, 3, 4]) as Set<number>, "difference", {
		value: undefined,
		configurable: true,
	});
	const s = pipe(data, Uniq.difference(Uniq.fromArray([2, 4])));
	expect(s.size).toBe(2);
	expect(s.has(1)).toBe(true);
	expect(s.has(3)).toBe(true);
});

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

test("Uniq.reduce folds all items", () => {
	expect(Uniq.reduce(0, (acc, n: number) => acc + n)(Uniq.fromArray([1, 2, 3, 4]))).toBe(10);
});

test("Uniq.reduce returns init for empty set", () => {
	expect(Uniq.reduce(42, (acc, n: number) => acc + n)(Uniq.empty())).toBe(42);
});

// ---------------------------------------------------------------------------
// toArray
// ---------------------------------------------------------------------------

test("Uniq.toArray returns items in insertion order", () => {
	expect(Uniq.toArray(Uniq.fromArray([3, 1, 2]))).toEqual([3, 1, 2]);
});

test("Uniq.toArray returns empty array for empty set", () => {
	expect(Uniq.toArray(Uniq.empty())).toEqual([]);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Uniq pipe composition — fromArray, filter, map, reduce", () => {
	const result = pipe(
		Uniq.fromArray([1, 2, 3, 4, 5, 6, 1, 2]), // dedup → {1,2,3,4,5,6}
		Uniq.filter((n) => n % 2 === 0), // {2,4,6}
		Uniq.map((n) => n * 10), // {20,40,60}
		Uniq.reduce(0, (acc, n) => acc + n), // 120
	);
	expect(result).toBe(120);
});

test("Uniq pipe composition — set operations", () => {
	const admins = Uniq.fromArray(["alice", "carol"]);
	const editors = Uniq.fromArray(["bob", "carol", "dave"]);
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
