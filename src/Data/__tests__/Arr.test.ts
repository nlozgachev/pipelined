import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Equality } from "../../Core/Equality.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Ordering } from "../../Core/Ordering.ts";
import { Result } from "../../Core/Result.ts";
import { Task } from "../../Core/Task.ts";
import { Validation } from "../../Core/Validation.ts";
import { isNonEmptyArr, type NonEmptyArr } from "../../internal/InternalTypes.ts";
import { Arr } from "../Arr.ts";

// --- Safe access: head, last, tail, init ---

test("head: returns Some of first element for non-empty array", () => {
	const result = Arr.head([10, 20, 30]);
	expect(result).toStrictEqual(Maybe.make.some(10));
});

test("head: returns None for empty array", () => {
	const result = Arr.head([]);
	expect(result).toStrictEqual(Maybe.make.none());
});

test("head: returns Some for single-element array", () => {
	const result = Arr.head(["only"]);
	expect(result).toStrictEqual(Maybe.make.some("only"));
});

test("last: returns Some of last element for non-empty array", () => {
	const result = Arr.last([10, 20, 30]);
	expect(result).toStrictEqual(Maybe.make.some(30));
});

test("last: returns None for empty array", () => {
	const result = Arr.last([]);
	expect(result).toStrictEqual(Maybe.make.none());
});

test("last: returns Some for single-element array", () => {
	const result = Arr.last([42]);
	expect(result).toStrictEqual(Maybe.make.some(42));
});

test("tail: returns Some of all elements except first", () => {
	const result = Arr.tail([1, 2, 3]);
	expect(result).toStrictEqual(Maybe.make.some([2, 3]));
});

test("tail: returns Some of empty array for single-element array", () => {
	const result = Arr.tail([1]);
	expect(result).toStrictEqual(Maybe.make.some([]));
});

test("tail: returns None for empty array", () => {
	const result = Arr.tail([]);
	expect(result).toStrictEqual(Maybe.make.none());
});

test("init: returns Some of all elements except last", () => {
	const result = Arr.init([1, 2, 3]);
	expect(result).toStrictEqual(Maybe.make.some([1, 2]));
});

test("init: returns Some of empty array for single-element array", () => {
	const result = Arr.init([1]);
	expect(result).toStrictEqual(Maybe.make.some([]));
});

test("init: returns None for empty array", () => {
	const result = Arr.init([]);
	expect(result).toStrictEqual(Maybe.make.none());
});

// --- Search: findFirst, findLast, findIndex ---

test("findFirst: returns Some of first matching element", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.findFirst((n) => n > 3));
	expect(result).toStrictEqual(Maybe.make.some(4));
});

test("findFirst: returns None when no element matches", () => {
	const result = pipe([1, 2, 3], Arr.findFirst((n) => n > 10));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("findFirst: returns None for empty array", () => {
	const result = pipe([] as number[], Arr.findFirst((n) => n > 0));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("findFirst: returns Some of undefined when undefined matches", () => {
	const result = pipe([undefined, 1, 2] as (number | undefined)[], Arr.findFirst((x) => x === undefined));
	expect(result).toStrictEqual(Maybe.make.some(undefined));
});

test("findLast: returns Some of last matching element", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.findLast((n) => n > 2));
	expect(result).toStrictEqual(Maybe.make.some(5));
});

test("findLast: returns None when no element matches", () => {
	const result = pipe([1, 2, 3], Arr.findLast((n) => n > 10));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("findLast: returns None for empty array", () => {
	const result = pipe([] as number[], Arr.findLast((_) => true));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("findLast: returns Some of undefined when undefined matches", () => {
	const result = pipe([1, undefined, 2, undefined] as (number | undefined)[], Arr.findLast((x) => x === undefined));
	expect(result).toStrictEqual(Maybe.make.some(undefined));
});

test("findIndex: returns Some of index of first match", () => {
	const result = pipe([10, 20, 30, 40], Arr.findIndex((n) => n === 30));
	expect(result).toStrictEqual(Maybe.make.some(2));
});

test("findIndex: returns None when no element matches", () => {
	const result = pipe([10, 20, 30], Arr.findIndex((n) => n === 99));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("findIndex: returns None for empty array", () => {
	const result = pipe([] as number[], Arr.findIndex((_) => true));
	expect(result).toStrictEqual(Maybe.make.none());
});

// --- Transform: map, filter, partition, groupBy, uniq, uniqBy, sortBy ---

test("map: transforms each element", () => {
	const result = pipe([1, 2, 3], Arr.map((n) => n * 10));
	expect(result).toStrictEqual([10, 20, 30]);
});

test("map: returns empty array for empty input", () => {
	const result = pipe([] as number[], Arr.map((n) => n * 2));
	expect(result).toStrictEqual([]);
});

// --- mapWithIndex ---

test("mapWithIndex: provides zero-based index alongside each element", () => {
	expect(pipe(["a", "b", "c"], Arr.mapWithIndex((i, s) => `${i}:${s}`))).toStrictEqual(["0:a", "1:b", "2:c"]);
});

test("mapWithIndex: passes correct index and value", () => {
	expect(pipe([10, 20, 30], Arr.mapWithIndex((i, n) => i + n))).toStrictEqual([10, 21, 32]);
});

test("mapWithIndex: returns empty array for empty array", () => {
	expect(pipe([], Arr.mapWithIndex((i, n: number) => n))).toStrictEqual([]);
});

test("mapWithIndex: composes in pipe", () => {
	expect(pipe(["a", "b", "c"], Arr.mapWithIndex((i, s) => ({ position: i + 1, value: s })))).toStrictEqual([
		{ position: 1, value: "a" },
		{ position: 2, value: "b" },
		{ position: 3, value: "c" },
	]);
});

test("filter: keeps elements satisfying predicate", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.filter((n) => n % 2 === 0));
	expect(result).toStrictEqual([2, 4]);
});

test("filter: returns empty array when nothing matches", () => {
	const result = pipe([1, 3, 5], Arr.filter((n) => n % 2 === 0));
	expect(result).toStrictEqual([]);
});

test("filter: returns empty array for empty input", () => {
	const result = pipe([] as number[], Arr.filter((_) => true));
	expect(result).toStrictEqual([]);
});

// --- filterMap ---

test("filterMap: collects Some values and discards None", () => {
	const parseNum = (s: string): Maybe<number> => {
		const n = Number(s);
		return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	};
	expect(pipe(["1", "abc", "3"], Arr.filterMap(parseNum))).toStrictEqual([1, 3]);
});

test("filterMap: returns empty array when all elements map to None", () => {
	expect(pipe(["a", "b", "c"], Arr.filterMap(() => Maybe.make.none()))).toStrictEqual([]);
});

test("filterMap: returns all values when all elements map to Some", () => {
	expect(pipe([1, 2, 3], Arr.filterMap(Maybe.make.some))).toStrictEqual([1, 2, 3]);
});

test("filterMap: returns empty array for empty array", () => {
	expect(pipe([], Arr.filterMap(Maybe.make.some))).toStrictEqual([]);
});

test("filterMap: maps and filters in single pipe", () => {
	expect(pipe([1, 2, 3, 4, 5], Arr.filterMap((n) => n % 2 === 0 ? Maybe.make.some(n * 10) : Maybe.make.none())))
		.toStrictEqual([20, 40]);
});

test("partition: splits array into pass and fail groups", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.partition((n) => n % 2 === 0));
	expect(result).toStrictEqual([[2, 4], [1, 3, 5]]);
});

test("partition: returns all elements in pass group when all pass", () => {
	const result = pipe([2, 4, 6], Arr.partition((n) => n % 2 === 0));
	expect(result).toStrictEqual([[2, 4, 6], []]);
});

test("partition: returns all elements in fail group when none pass", () => {
	const result = pipe([1, 3, 5], Arr.partition((n) => n % 2 === 0));
	expect(result).toStrictEqual([[], [1, 3, 5]]);
});

test("partition: produces two empty arrays for empty input", () => {
	const result = pipe([] as number[], Arr.partition((_) => true));
	expect(result).toStrictEqual([[], []]);
});

test("groupBy: groups elements by key function", () => {
	const result = pipe(["apple", "avocado", "banana", "blueberry"], Arr.groupBy((s) => s[0]));
	expect(result).toStrictEqual({ a: ["apple", "avocado"], b: ["banana", "blueberry"] });
});

test("groupBy: returns empty record for empty array", () => {
	const result = pipe([] as string[], Arr.groupBy((s) => s));
	expect(result).toStrictEqual({});
});

test("groupBy: places each element in separate group when keys differ", () => {
	const result = pipe([1, 2, 3], Arr.groupBy((n) => String(n)));
	expect(result).toStrictEqual({ "1": [1], "2": [2], "3": [3] });
});

test("uniq: removes duplicate elements", () => {
	const result = Arr.uniq([1, 2, 2, 3, 1, 3, 4]);
	expect(result).toStrictEqual([1, 2, 3, 4]);
});

test("uniq: returns unchanged array when no duplicates exist", () => {
	const result = Arr.uniq([1, 2, 3]);
	expect(result).toStrictEqual([1, 2, 3]);
});

test("uniq: returns empty array for empty input", () => {
	const result = Arr.uniq([]);
	expect(result).toStrictEqual([]);
});

test("uniq: preserves order of first occurrences", () => {
	const result = Arr.uniq([3, 1, 2, 1, 3]);
	expect(result).toStrictEqual([3, 1, 2]);
});

test("uniqBy: removes duplicates by key function", () => {
	const items = [{ id: 1, name: "a" }, { id: 1, name: "b" }, { id: 2, name: "c" }];
	const result = pipe(items, Arr.uniqBy((x) => x.id));
	expect(result).toStrictEqual([{ id: 1, name: "a" }, { id: 2, name: "c" }]);
});

test("uniqBy: returns empty array for empty input", () => {
	const result = pipe([] as { id: number; }[], Arr.uniqBy((x) => x.id));
	expect(result).toStrictEqual([]);
});

test("sortBy: sorts array using comparison function", () => {
	const result = pipe([3, 1, 4, 1, 5, 9], Arr.sortBy((a, b) => a - b));
	expect(result).toStrictEqual([1, 1, 3, 4, 5, 9]);
});

test("sortBy: sorts in descending order", () => {
	const result = pipe([3, 1, 2], Arr.sortBy((a, b) => b - a));
	expect(result).toStrictEqual([3, 2, 1]);
});

test("sortBy: does not mutate original array", () => {
	const original = [3, 1, 2];
	pipe(original, Arr.sortBy((a, b) => a - b));
	expect(original).toStrictEqual([3, 1, 2]);
});

test("sortBy: returns empty array for empty input", () => {
	const result = pipe([] as number[], Arr.sortBy((a, b) => a - b));
	expect(result).toStrictEqual([]);
});

test("sortBy: falls back to spread sort when toSorted is unavailable", () => {
	const arr = Object.defineProperty([3, 1, 2], "toSorted", { value: undefined, configurable: true });
	expect(Arr.sortBy((a: number, b: number) => a - b)(arr)).toStrictEqual([1, 2, 3]);
});

// --- Combine: zip, zipWith, intersperse, chunksOf, flatten, flatMap ---

test("zip: pairs elements from two arrays", () => {
	const result = pipe([1, 2, 3], Arr.zip(["a", "b", "c"]));
	expect(result).toStrictEqual([[1, "a"], [2, "b"], [3, "c"]]);
});

test("zip: stops at shorter array when first is shorter", () => {
	const result = pipe([1, 2], Arr.zip(["a", "b", "c"]));
	expect(result).toStrictEqual([[1, "a"], [2, "b"]]);
});

test("zip: stops at shorter array when second is shorter", () => {
	const result = pipe([1, 2, 3], Arr.zip(["a", "b"]));
	expect(result).toStrictEqual([[1, "a"], [2, "b"]]);
});

test("zip: returns empty array when first array is empty", () => {
	const result = pipe([] as number[], Arr.zip(["a", "b"]));
	expect(result).toStrictEqual([]);
});

test("zip: returns empty array when second array is empty", () => {
	const result = pipe([1, 2], Arr.zip([] as string[]));
	expect(result).toStrictEqual([]);
});

test("zipWith: combines elements using function", () => {
	const result = pipe([1, 2, 3], Arr.zipWith((a, b) => `${a}${b}`)(["a", "b", "c"]));
	expect(result).toStrictEqual(["1a", "2b", "3c"]);
});

test("zipWith: stops at shorter array", () => {
	const result = pipe([1, 2, 3], Arr.zipWith((a: number, b: number) => a + b)([10, 20]));
	expect(result).toStrictEqual([11, 22]);
});

test("zipWith: returns empty array for empty input", () => {
	const result = pipe([] as number[], Arr.zipWith((a: number, b: number) => a + b)([10, 20]));
	expect(result).toStrictEqual([]);
});

test("intersperse: inserts separator between elements", () => {
	const result = pipe([1, 2, 3], Arr.intersperse(0));
	expect(result).toStrictEqual([1, 0, 2, 0, 3]);
});

test("intersperse: returns unchanged for single-element array", () => {
	const result = pipe([42], Arr.intersperse(0));
	expect(result).toStrictEqual([42]);
});

test("intersperse: returns empty array for empty array", () => {
	const result = pipe([] as number[], Arr.intersperse(0));
	expect(result).toStrictEqual([]);
});

test("intersperse: inserts string separator", () => {
	const result = pipe(["a", "b", "c"], Arr.intersperse("-"));
	expect(result).toStrictEqual(["a", "-", "b", "-", "c"]);
});

test("concat: concatenates two arrays", () => {
	const result = pipe([1, 2], Arr.concat([3, 4]));
	expect(result).toStrictEqual([1, 2, 3, 4]);
});

test("concat: concatenates with empty array", () => {
	const result = pipe([1, 2], Arr.concat([] as number[]));
	expect(result).toStrictEqual([1, 2]);
});

test("concat: concatenates empty array with non-empty array", () => {
	const result = pipe([] as number[], Arr.concat([1, 2]));
	expect(result).toStrictEqual([1, 2]);
});

test("chunksOf: splits array into chunks of given size", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.chunksOf(2));
	expect(result).toStrictEqual([[1, 2], [3, 4], [5]]);
});

test("chunksOf: splits array with exact division", () => {
	const result = pipe([1, 2, 3, 4, 5, 6], Arr.chunksOf(3));
	expect(result).toStrictEqual([[1, 2, 3], [4, 5, 6]]);
});

test("chunksOf: returns single chunk when size exceeds array length", () => {
	const result = pipe([1, 2], Arr.chunksOf(5));
	expect(result).toStrictEqual([[1, 2]]);
});

test("chunksOf: returns single-element chunks for size 1", () => {
	const result = pipe([1, 2, 3], Arr.chunksOf(1));
	expect(result).toStrictEqual([[1], [2], [3]]);
});

test("chunksOf: returns empty array for size 0", () => {
	const result = pipe([1, 2, 3], Arr.chunksOf(0));
	expect(result).toStrictEqual([]);
});

test("chunksOf: returns empty array for negative size", () => {
	const result = pipe([1, 2, 3], Arr.chunksOf(-1));
	expect(result).toStrictEqual([]);
});

test("chunksOf: returns empty array for empty array", () => {
	const result = pipe([] as number[], Arr.chunksOf(3));
	expect(result).toStrictEqual([]);
});

test("flatten: flattens one level of nesting", () => {
	const result = Arr.flatten([[1, 2], [3], [4, 5]]);
	expect(result).toStrictEqual([1, 2, 3, 4, 5]);
});

test("flatten: flattens array containing empty subarrays", () => {
	const result = Arr.flatten([[1], [], [2, 3], []]);
	expect(result).toStrictEqual([1, 2, 3]);
});

test("flatten: returns empty array for empty outer array", () => {
	const result = Arr.flatten([] as number[][]);
	expect(result).toStrictEqual([]);
});

test("flatten: handles very large number of subarrays safely", () => {
	const size = 70_000;
	const data = Array.from({ length: size }, (_, i) => [i]);
	const result = Arr.flatten(data);
	expect(result).toHaveLength(size);
	expect(result[0]).toBe(0);
	expect(result[size - 1]).toBe(size - 1);
});

test("flatMap: maps and flattens results", () => {
	const result = pipe([1, 2, 3], Arr.flatMap((n) => [n, n * 10]));
	expect(result).toStrictEqual([1, 10, 2, 20, 3, 30]);
});

test("flatMap: filters elements when mapping to empty arrays", () => {
	const result = pipe([1, 2, 3, 4], Arr.flatMap((n) => (n % 2 === 0 ? [n] : [])));
	expect(result).toStrictEqual([2, 4]);
});

test("flatMap: returns empty array for empty array", () => {
	const result = pipe([] as number[], Arr.flatMap((n) => [n, n]));
	expect(result).toStrictEqual([]);
});

// --- Reduce ---

test("reduce: sums numbers", () => {
	const result = pipe([1, 2, 3, 4], Arr.reduce(0, (acc, n) => acc + n));
	expect(result).toBe(10);
});

test("reduce: concatenates strings", () => {
	const result = pipe(["a", "b", "c"], Arr.reduce("", (acc, s) => acc + s));
	expect(result).toBe("abc");
});

test("reduce: returns initial value for empty array", () => {
	const result = pipe([] as number[], Arr.reduce(42, (acc, n) => acc + n));
	expect(result).toBe(42);
});

test("reduce: builds object from entries", () => {
	const result = pipe(
		[["a", 1], ["b", 2], ["c", 3]] as [string, number][],
		Arr.reduce({} as Record<string, number>, (acc, [k, v]) => ({ ...acc, [k]: v })),
	);
	expect(result).toStrictEqual({ a: 1, b: 2, c: 3 });
});

// --- Traverse / Sequence (Option) ---

test("traverse.Maybe: returns Some of array when all succeed", () => {
	const parseNum = (s: string): Maybe<number> => {
		const n = Number(s);
		return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	};
	const result = pipe(["1", "2", "3"], Arr.traverse.Maybe(parseNum));
	expect(result).toStrictEqual(Maybe.make.some([1, 2, 3]));
});

test("traverse.Maybe: returns None when any element maps to None", () => {
	const parseNum = (s: string): Maybe<number> => {
		const n = Number(s);
		return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	};
	const result = pipe(["1", "x", "3"], Arr.traverse.Maybe(parseNum));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("traverse.Maybe: returns Some of empty array for empty input", () => {
	const result = pipe([] as string[], Arr.traverse.Maybe((s) => Maybe.make.some(s)));
	expect(result).toStrictEqual(Maybe.make.some([]));
});

test("traverse.Maybe: short-circuits at first None", () => {
	let callCount = 0;
	const f = (n: number): Maybe<number> => {
		callCount++;
		return n > 0 ? Maybe.make.some(n) : Maybe.make.none();
	};
	const result = pipe([1, 0, 2, 3], Arr.traverse.Maybe(f));
	expect(result).toStrictEqual(Maybe.make.none());
	expect(callCount).toBe(2);
});

test("sequence.Maybe: returns Some of array when all are Some", () => {
	const result = Arr.sequence.Maybe([Maybe.make.some(1), Maybe.make.some(2), Maybe.make.some(3)]);
	expect(result).toStrictEqual(Maybe.make.some([1, 2, 3]));
});

test("sequence.Maybe: returns None when any is None", () => {
	const result = Arr.sequence.Maybe([Maybe.make.some(1), Maybe.make.none(), Maybe.make.some(3)]);
	expect(result).toStrictEqual(Maybe.make.none());
});

test("sequence.Maybe: returns Some of empty array for empty input", () => {
	const result = Arr.sequence.Maybe([] as Maybe<number>[]);
	expect(result).toStrictEqual(Maybe.make.some([]));
});

// --- Traverse / Sequence (Result) ---

test("traverse.Result: returns Ok of array when all succeed", () => {
	const validate = (n: number): Result<string, number> => n > 0 ? Result.make.ok(n) : Result.make.err("not positive");
	const result = pipe([1, 2, 3], Arr.traverse.Result(validate));
	expect(result).toStrictEqual(Result.make.ok([1, 2, 3]));
});

test("traverse.Result: returns first Err when failure occurs", () => {
	const validate = (n: number): Result<string, number> =>
		n > 0 ? Result.make.ok(n) : Result.make.err(`${n} is not positive`);
	const result = pipe([1, -2, -3], Arr.traverse.Result(validate));
	expect(result).toStrictEqual(Result.make.err("-2 is not positive"));
});

test("traverse.Result: returns Ok of empty array for empty input", () => {
	const result = pipe([] as number[], Arr.traverse.Result((n) => Result.make.ok(n)));
	expect(result).toStrictEqual(Result.make.ok([]));
});

test("traverse.Result: short-circuits at first Err", () => {
	let callCount = 0;
	const f = (n: number): Result<string, number> => {
		callCount++;
		return n > 0 ? Result.make.ok(n) : Result.make.err("bad");
	};
	pipe([1, 0, 2, 3], Arr.traverse.Result(f));
	expect(callCount).toBe(2);
});

test("sequence.Result: returns Ok of array when all are Ok", () => {
	const result = Arr.sequence.Result([Result.make.ok(1), Result.make.ok(2), Result.make.ok(3)]);
	expect(result).toStrictEqual(Result.make.ok([1, 2, 3]));
});

test("sequence.Result: returns first Err when failure occurs", () => {
	const result = Arr.sequence.Result([Result.make.ok(1), Result.make.err("oops"), Result.make.ok(3)]);
	expect(result).toStrictEqual(Result.make.err("oops"));
});

test("sequence.Result: returns Ok of empty array for empty input", () => {
	const result = Arr.sequence.Result([] as Result<string, number>[]);
	expect(result).toStrictEqual(Result.make.ok([]));
});

// --- Traverse / Sequence (Validation) ---

test("traverse.Validation: returns Passed of array when all pass", () => {
	const validate = (n: number): Validation<string, number> =>
		n > 0 ? Validation.make.passed(n) : Validation.make.failed("not positive");
	const result = pipe([1, 2, 3], Arr.traverse.Validation(validate));
	expect(result).toStrictEqual(Validation.make.passed([1, 2, 3]));
});

test("traverse.Validation: accumulates all errors from Failed elements", () => {
	const validate = (n: number): Validation<string, number> =>
		n > 0 ? Validation.make.passed(n) : Validation.make.failed(`${n} is not positive`);
	const result = pipe([1, -2, -3], Arr.traverse.Validation(validate));
	expect(result).toStrictEqual(Validation.make.failedAll(["-2 is not positive", "-3 is not positive"]));
});

test("traverse.Validation: returns Passed of empty array for empty input", () => {
	const result = pipe([] as number[], Arr.traverse.Validation((n) => Validation.make.passed(n)));
	expect(result).toStrictEqual(Validation.make.passed([]));
});

test("traverse.Validation: evaluates all elements without short-circuiting", () => {
	let callCount = 0;
	const f = (n: number): Validation<string, number> => {
		callCount++;
		return n > 0 ? Validation.make.passed(n) : Validation.make.failed("bad");
	};
	pipe([1, 0, 2, 3], Arr.traverse.Validation(f));
	expect(callCount).toBe(4);
});

test("sequence.Validation: returns Passed of array when all are Passed", () => {
	const result = Arr.sequence.Validation([
		Validation.make.passed(1),
		Validation.make.passed(2),
		Validation.make.passed(3),
	]);
	expect(result).toStrictEqual(Validation.make.passed([1, 2, 3]));
});

test("sequence.Validation: accumulates errors from all Failed validations", () => {
	const result = Arr.sequence.Validation([
		Validation.make.passed(1),
		Validation.make.failed("err1"),
		Validation.make.failedAll(["err2", "err3"]),
	]);
	expect(result).toStrictEqual(Validation.make.failedAll(["err1", "err2", "err3"]));
});

test("sequence.Validation: returns Passed of empty array for empty input", () => {
	const result = Arr.sequence.Validation([] as Validation<string, number>[]);
	expect(result).toStrictEqual(Validation.make.passed([]));
});

// --- Traverse / Sequence (Task - async) ---

test("traverse.Task: maps elements to tasks and runs in parallel", async () => {
	const result = await pipe([1, 2, 3], Arr.traverse.Task((n) => Task.make(n * 10)))();
	expect(result).toStrictEqual([10, 20, 30]);
});

test("traverse.Task: resolves to empty array for empty input", async () => {
	const result = await pipe([] as number[], Arr.traverse.Task((n) => Task.make(n)))();
	expect(result).toStrictEqual([]);
});

test("traverse.Task: handles asynchronous operations", async () => {
	const delayedDouble = (n: number): Task<number> =>
		Task.tryCatch(() => new Promise<number>((resolve) => setTimeout(() => resolve(n * 2), 10)), { onError: () => 0 });

	const result = await pipe([1, 2, 3], Arr.traverse.Task(delayedDouble))();
	expect(result).toStrictEqual([2, 4, 6]);
});

test("traverse.Task: respects concurrency limit option", async () => {
	let active = 0;
	let maxActive = 0;

	const taskFn = (n: number): Task<number> =>
		Task.tryCatch(() =>
			new Promise<number>((resolve) => {
				active++;
				if (active > maxActive) {
					maxActive = active;
				}
				setTimeout(() => {
					active--;
					resolve(n * 2);
				}, 15);
			}), { onError: () => 0 });

	const result = await pipe([1, 2, 3, 4, 5], Arr.traverse.Task(taskFn, { concurrency: 2 }))();
	expect(result).toStrictEqual([2, 4, 6, 8, 10]);
	expect(maxActive).toBe(2);
});

test("sequence.Task: runs all tasks in parallel and collects results", async () => {
	const tasks: Task<number>[] = [Task.make(10), Task.make(20), Task.make(30)];
	const result = await Arr.sequence.Task(tasks)();
	expect(result).toStrictEqual([10, 20, 30]);
});

test("sequence.Task: resolves to empty array for empty input", async () => {
	const result = await Arr.sequence.Task([] as Task<number>[])();
	expect(result).toStrictEqual([]);
});

test("sequence.Task: preserves order despite varying completion times", async () => {
	const tasks: Task<string>[] = [
		Task.tryCatch(() => new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 30)), { onError: () => "" }),
		Task.tryCatch(() => new Promise<string>((resolve) => setTimeout(() => resolve("fast"), 5)), { onError: () => "" }),
		Task.tryCatch(() => new Promise<string>((resolve) => setTimeout(() => resolve("medium"), 15)), { onError: () => "" }),
	];
	const result = await Arr.sequence.Task(tasks)();
	expect(result).toStrictEqual(["slow", "fast", "medium"]);
});

// --- Predicates: isNonEmpty, some, every ---

test("is.nonEmpty: returns true for non-empty array", () => {
	expect(Arr.is.nonEmpty([1, 2, 3])).toBe(true);
});

test("is.nonEmpty: returns false for empty array", () => {
	expect(Arr.is.nonEmpty([])).toBe(false);
});

test("is.nonEmpty: returns true for single-element array containing undefined", () => {
	expect(Arr.is.nonEmpty([undefined])).toBe(true);
});

test("some: returns true when at least one element matches", () => {
	const result = pipe([1, 2, 3, 4], Arr.some((n) => n > 3));
	expect(result).toBe(true);
});

test("some: returns false when no element matches", () => {
	const result = pipe([1, 2, 3], Arr.some((n) => n > 10));
	expect(result).toBe(false);
});

test("some: returns false for empty array", () => {
	const result = pipe([] as number[], Arr.some((_) => true));
	expect(result).toBe(false);
});

test("every: returns true when all elements match", () => {
	const result = pipe([2, 4, 6], Arr.every((n) => n % 2 === 0));
	expect(result).toBe(true);
});

test("every: returns false when any element does not match", () => {
	const result = pipe([2, 3, 6], Arr.every((n) => n % 2 === 0));
	expect(result).toBe(false);
});

test("every: returns true for empty array", () => {
	const result = pipe([] as number[], Arr.every((_) => false));
	expect(result).toBe(true);
});

// --- Slicing: reverse, take, drop, takeWhile, dropWhile ---

test("reverse: reverses elements", () => {
	const result = Arr.reverse([1, 2, 3]);
	expect(result).toStrictEqual([3, 2, 1]);
});

test("reverse: does not mutate original array", () => {
	const original = [1, 2, 3];
	Arr.reverse(original);
	expect(original).toStrictEqual([1, 2, 3]);
});

test("reverse: returns empty array for empty array", () => {
	expect(Arr.reverse([])).toStrictEqual([]);
});

test("reverse: returns same element for single-element array", () => {
	expect(Arr.reverse([42])).toStrictEqual([42]);
});

// --- insertAt ---

test("insertAt: inserts element at start", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(0, 99))).toStrictEqual([99, 1, 2, 3]);
});

test("insertAt: inserts element in middle", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(1, 99))).toStrictEqual([1, 99, 2, 3]);
});

test("insertAt: inserts element at end", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(3, 99))).toStrictEqual([1, 2, 3, 99]);
});

test("insertAt: clamps negative index to start", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(-5, 99))).toStrictEqual([99, 1, 2, 3]);
});

test("insertAt: clamps index beyond length to end", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(100, 99))).toStrictEqual([1, 2, 3, 99]);
});

test("insertAt: inserts into empty array", () => {
	expect(pipe([] as number[], Arr.insertAt(0, 99))).toStrictEqual([99]);
});

test("insertAt: does not mutate original array", () => {
	const original = [1, 2, 3];
	pipe(original, Arr.insertAt(1, 99));
	expect(original).toStrictEqual([1, 2, 3]);
});

test("insertAt: falls back to spread splice when toSpliced is unavailable", () => {
	const arr = Object.defineProperty([1, 2, 3], "toSpliced", { value: undefined, configurable: true });
	expect(Arr.insertAt(1, 99)(arr)).toStrictEqual([1, 99, 2, 3]);
});

// --- removeAt ---

test("removeAt: removes element at start", () => {
	expect(pipe([1, 2, 3], Arr.removeAt(0))).toStrictEqual([2, 3]);
});

test("removeAt: removes element in middle", () => {
	expect(pipe([1, 2, 3], Arr.removeAt(1))).toStrictEqual([1, 3]);
});

test("removeAt: removes element at end", () => {
	expect(pipe([1, 2, 3], Arr.removeAt(2))).toStrictEqual([1, 2]);
});

test("removeAt: returns original array for negative index", () => {
	const original = [1, 2, 3];
	expect(pipe(original, Arr.removeAt(-1))).toBe(original);
});

test("removeAt: returns original array for out-of-bounds index", () => {
	const original = [1, 2, 3];
	expect(pipe(original, Arr.removeAt(5))).toBe(original);
});

test("removeAt: returns empty array for single-element array", () => {
	expect(pipe([42], Arr.removeAt(0))).toStrictEqual([]);
});

test("removeAt: does not mutate original array", () => {
	const original = [1, 2, 3];
	pipe(original, Arr.removeAt(1));
	expect(original).toStrictEqual([1, 2, 3]);
});

test("removeAt: falls back to spread splice when toSpliced is unavailable", () => {
	const arr = Object.defineProperty([1, 2, 3], "toSpliced", { value: undefined, configurable: true });
	expect(Arr.removeAt(1)(arr)).toStrictEqual([1, 3]);
});

test("take: takes first n elements", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.take(3));
	expect(result).toStrictEqual([1, 2, 3]);
});

test("take: takes all elements when n exceeds length", () => {
	const result = pipe([1, 2], Arr.take(10));
	expect(result).toStrictEqual([1, 2]);
});

test("take: returns empty array for count 0", () => {
	const result = pipe([1, 2, 3], Arr.take(0));
	expect(result).toStrictEqual([]);
});

test("take: returns empty array for negative count", () => {
	const result = pipe([1, 2, 3], Arr.take(-1));
	expect(result).toStrictEqual([]);
});

test("drop: drops first n elements", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.drop(2));
	expect(result).toStrictEqual([3, 4, 5]);
});

test("drop: drops all elements when n exceeds length", () => {
	const result = pipe([1, 2], Arr.drop(10));
	expect(result).toStrictEqual([]);
});

test("drop: returns entire array for count 0", () => {
	const result = pipe([1, 2, 3], Arr.drop(0));
	expect(result).toStrictEqual([1, 2, 3]);
});

test("takeWhile: takes elements while predicate holds", () => {
	const result = pipe([1, 2, 3, 4, 1], Arr.takeWhile((n) => n < 3));
	expect(result).toStrictEqual([1, 2]);
});

test("takeWhile: returns empty array when first element fails predicate", () => {
	const result = pipe([5, 1, 2], Arr.takeWhile((n) => n < 3));
	expect(result).toStrictEqual([]);
});

test("takeWhile: takes all elements when all pass predicate", () => {
	const result = pipe([1, 2, 3], Arr.takeWhile((n) => n < 10));
	expect(result).toStrictEqual([1, 2, 3]);
});

test("takeWhile: returns empty array for empty input", () => {
	const result = pipe([] as number[], Arr.takeWhile((_) => true));
	expect(result).toStrictEqual([]);
});

test("dropWhile: drops elements while predicate holds", () => {
	const result = pipe([1, 2, 3, 4, 1], Arr.dropWhile((n) => n < 3));
	expect(result).toStrictEqual([3, 4, 1]);
});

test("dropWhile: drops nothing when first element fails predicate", () => {
	const result = pipe([5, 1, 2], Arr.dropWhile((n) => n < 3));
	expect(result).toStrictEqual([5, 1, 2]);
});

test("dropWhile: drops all elements when all pass predicate", () => {
	const result = pipe([1, 2, 3], Arr.dropWhile((n) => n < 10));
	expect(result).toStrictEqual([]);
});

test("dropWhile: returns empty array for empty input", () => {
	const result = pipe([] as number[], Arr.dropWhile((_) => true));
	expect(result).toStrictEqual([]);
});

// --- scan ---

test("scan: returns running totals of sum", () => {
	expect(pipe([1, 2, 3], Arr.scan(0, (acc, n) => acc + n))).toStrictEqual([1, 3, 6]);
});

test("scan: returns empty array for empty input", () => {
	expect(pipe([], Arr.scan(0, (acc: number, n: number) => acc + n))).toStrictEqual([]);
});

test("scan: does not include initial seed in output", () => {
	expect(pipe([5], Arr.scan(100, (acc, n) => acc + n))).toStrictEqual([105]);
});

test("scan: produces output matching input length", () => {
	const result = pipe([1, 2, 3, 4], Arr.scan(0, (acc, n) => acc + n));
	expect(result).toHaveLength(4);
});

test("scan: accumulates with non-numeric seed", () => {
	expect(pipe(["a", "b", "c"], Arr.scan("", (acc, s) => acc + s))).toStrictEqual(["a", "ab", "abc"]);
});

// --- splitAt ---

test("splitAt: splits array at given index", () => {
	expect(pipe([1, 2, 3, 4], Arr.splitAt(2))).toStrictEqual([[1, 2], [3, 4]]);
});

test("splitAt: yields empty prefix at index 0", () => {
	expect(pipe([1, 2, 3], Arr.splitAt(0))).toStrictEqual([[], [1, 2, 3]]);
});

test("splitAt: yields empty suffix at index equal to length", () => {
	expect(pipe([1, 2, 3], Arr.splitAt(3))).toStrictEqual([[1, 2, 3], []]);
});

test("splitAt: clamps index beyond length to end", () => {
	expect(pipe([1, 2], Arr.splitAt(10))).toStrictEqual([[1, 2], []]);
});

test("splitAt: clamps negative index to start", () => {
	expect(pipe([1, 2, 3], Arr.splitAt(-5))).toStrictEqual([[], [1, 2, 3]]);
});

test("splitAt: returns two empty arrays for empty input", () => {
	expect(pipe([], Arr.splitAt(2))).toStrictEqual([[], []]);
});

// --- Size ---

test("size: returns length of array", () => {
	expect(Arr.size([1, 2, 3])).toBe(3);
});

test("size: returns 0 for empty array", () => {
	expect(Arr.size([])).toBe(0);
});

test("size: returns 1 for single-element array", () => {
	expect(Arr.size(["only"])).toBe(1);
});

// --- Composition with pipe ---

test("pipe: composes filter map and head", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.filter((n) => n > 2), Arr.map((n) => n * 10), Arr.head);
	expect(result).toStrictEqual(Maybe.make.some(30));
});

test("pipe: composes map filter and reduce", () => {
	const result = pipe(
		[1, 2, 3, 4, 5],
		Arr.map((n) => n * 2),
		Arr.filter((n) => n > 4),
		Arr.reduce(0, (acc, n) => acc + n),
	);
	expect(result).toBe(6 + 8 + 10);
});

test("pipe: composes flatMap uniq and sortBy", () => {
	const result = pipe([1, 2, 3], Arr.flatMap((n) => [n, n + 1]), Arr.uniq, Arr.sortBy((a, b) => a - b));
	expect(result).toStrictEqual([1, 2, 3, 4]);
});

// --- uniqWith ---

test("uniqWith: removes duplicates using custom equality", () => {
	type Point = { x: number; y: number; };
	const eqPoint: Equality<Point> = (a, b) => a.x === b.x && a.y === b.y;
	const result = pipe(
		[{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 1 }, { x: 3, y: 3 }] as Point[],
		Arr.uniqWith(eqPoint),
	);
	expect(result).toStrictEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]);
});

test("uniqWith: preserves order of first occurrences", () => {
	const eqMod3: Equality<number> = (a, b) => a % 3 === b % 3;
	expect(pipe([1, 4, 2, 5, 3], Arr.uniqWith(eqMod3))).toStrictEqual([1, 2, 3]);
});

test("uniqWith: returns empty array for empty input", () => {
	expect(pipe([] as number[], Arr.uniqWith(Equality.number))).toStrictEqual([]);
});

// --- sortWith ---

test("sortWith: sorts ascending with ordering", () => {
	expect(pipe([3, 1, 2], Arr.sortWith(Ordering.number))).toStrictEqual([1, 2, 3]);
});

test("sortWith: sorts descending with reversed ordering", () => {
	expect(pipe([3, 1, 2], Arr.sortWith(Ordering.reverse(Ordering.number)))).toStrictEqual([3, 2, 1]);
});

test("sortWith: does not mutate original array", () => {
	const original = [3, 1, 2];
	pipe(original, Arr.sortWith(Ordering.number));
	expect(original).toStrictEqual([3, 1, 2]);
});

test("sortWith: returns empty array for empty input", () => {
	expect(pipe([] as number[], Arr.sortWith(Ordering.number))).toStrictEqual([]);
});

test("sortWith: falls back to sort when toSorted is unavailable", () => {
	const original = Array.prototype.toSorted;
	// Simulate a runtime without Array.prototype.toSorted.
	delete (Array.prototype as { toSorted?: unknown; }).toSorted;
	try {
		const data = [3, 1, 2];
		const result = pipe(data, Arr.sortWith(Ordering.number));
		expect(result).toStrictEqual([1, 2, 3]);
		expect(data).toStrictEqual([3, 1, 2]);
	} finally {
		// oxlint-disable-next-line no-extend-native
		Array.prototype.toSorted = original;
	}
});

// --- compact ---

test("compact: extracts values from Some and discards None", () => {
	const input = [Maybe.make.some(1), Maybe.make.none(), Maybe.make.some(2), Maybe.make.none(), Maybe.make.some(3)];
	expect(Arr.compact(input)).toStrictEqual([1, 2, 3]);
});

test("compact: returns empty array when all elements are None", () => {
	const input = [Maybe.make.none(), Maybe.make.none(), Maybe.make.none()];
	expect(Arr.compact(input)).toStrictEqual([]);
});

test("compact: returns all values when no None present", () => {
	const input = [Maybe.make.some("a"), Maybe.make.some("b"), Maybe.make.some("c")];
	expect(Arr.compact(input)).toStrictEqual(["a", "b", "c"]);
});

// --- separate ---

test("separate: splits Results into errors and successes", () => {
	const input = [Result.make.ok(1), Result.make.err("bad"), Result.make.ok(2), Result.make.err("worse")];
	expect(Arr.separate(input)).toStrictEqual([["bad", "worse"], [1, 2]]);
});

test("separate: returns empty arrays for empty input", () => {
	expect(Arr.separate([])).toStrictEqual([[], []]);
});

test("separate: returns only errors when all elements are Err", () => {
	const input = [Result.make.err("a"), Result.make.err("b")];
	expect(Arr.separate(input)).toStrictEqual([["a", "b"], []]);
});

test("separate: returns only successes when all elements are Ok", () => {
	const input = [Result.make.ok(1), Result.make.ok(2), Result.make.ok(3)];
	expect(Arr.separate(input)).toStrictEqual([[], [1, 2, 3]]);
});

// --- partitionMap ---

test("partitionMap: maps and separates in one pass", () => {
	const classify = (n: number): Result<string, number> =>
		n > 0 ? Result.make.ok(n * 10) : Result.make.err(`${n} is not positive`);
	const result = pipe([1, -2, 3, -4], Arr.partitionMap(classify));
	expect(result).toStrictEqual([["-2 is not positive", "-4 is not positive"], [10, 30]]);
});

test("partitionMap: returns empty arrays for empty input", () => {
	const result = pipe([] as number[], Arr.partitionMap((n) => Result.make.ok(n)));
	expect(result).toStrictEqual([[], []]);
});

test("partitionMap: composes in pipe", () => {
	const result = pipe(
		["1", "abc", "3", "def"],
		Arr.partitionMap((s) => {
			const n = Number(s);
			return isNaN(n) ? Result.make.err(s) : Result.make.ok(n);
		}),
	);
	expect(result).toStrictEqual([["abc", "def"], [1, 3]]);
});

// --- prepend / append ---

test("prepend: prepends element to array", () => {
	const result = pipe([1, 2], Arr.prepend(0));
	expect(result).toStrictEqual([0, 1, 2]);
});

test("prepend: prepends element to empty array", () => {
	const result = pipe([], Arr.prepend(42));
	expect(result).toStrictEqual([42]);
});

test("append: appends element to array", () => {
	const result = pipe([1, 2], Arr.append(3));
	expect(result).toStrictEqual([1, 2, 3]);
});

test("append: appends element to empty array", () => {
	const result = pipe([], Arr.append(42));
	expect(result).toStrictEqual([42]);
});

// --- Arr.NonEmpty ---

test("isNonEmptyArr: returns true for non-empty array", () => {
	expect(isNonEmptyArr([1, 2, 3])).toBe(true);
});

test("isNonEmptyArr: returns false for empty array", () => {
	expect(isNonEmptyArr([])).toBe(false);
});

test("NonEmpty.map: maps values type-safely on NonEmptyArr", () => {
	const list: NonEmptyArr<number> = [1, 2, 3];
	const result: NonEmptyArr<number> = Arr.NonEmpty.map((n: number) => n * 2)(list);
	expect(result).toStrictEqual([2, 4, 6]);
});

test("NonEmpty.concat: concatenates list with array", () => {
	const list: NonEmptyArr<number> = [1, 2];
	const result: NonEmptyArr<number> = Arr.NonEmpty.concat([3, 4])(list);
	expect(result).toStrictEqual([1, 2, 3, 4]);
});

test("NonEmpty: is type-compatible with Validation failure errors", () => {
	const failedVal = Validation.make.failed("error");
	expect(Validation.is.failed(failedVal)).toBe(true);

	if (!Validation.is.failed(failedVal)) {
		throw new Error("Expected failed validation");
	}

	const { errors } = failedVal;
	const typedErrors: Arr.NonEmpty<string> = errors;
	expect(typedErrors).toStrictEqual(["error"]);

	const firstError = Arr.NonEmpty.head(errors);
	expect(firstError).toBe("error");

	expectTypeOf(errors).toEqualTypeOf<Arr.NonEmpty<string>>();
});

test("NonEmpty.singleton: creates single-element non-empty array", () => {
	const result = Arr.NonEmpty.singleton(42);
	expect(result).toStrictEqual([42]);
	expectTypeOf(result).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("NonEmpty.from.array: returns Some for non-empty array", () => {
	const result = Arr.NonEmpty.from.array([1, 2]);
	expect(result).toStrictEqual(Maybe.make.some([1, 2]));
});

test("NonEmpty.from.array: returns None for empty array", () => {
	const result = Arr.NonEmpty.from.array([]);
	expect(result).toStrictEqual(Maybe.make.none());
});

test("NonEmpty.head: returns first element", () => {
	const result = Arr.NonEmpty.head([1, 2, 3]);
	expect(result).toBe(1);
});

test("NonEmpty.last: returns last element", () => {
	const result = Arr.NonEmpty.last([1, 2, 3]);
	expect(result).toBe(3);
});

test("NonEmpty.tail: returns all elements except first", () => {
	const result = Arr.NonEmpty.tail([1, 2, 3]);
	expect(result).toStrictEqual([2, 3]);
});

test("NonEmpty.reduce: reduces elements from left without initial value", () => {
	const result = pipe([1, 2, 3, 4] as Arr.NonEmpty<number>, Arr.NonEmpty.reduce((a, b) => a + b));
	expect(result).toBe(10);
});

test("NonEmpty.map: maps elements and preserves NonEmpty type", () => {
	const result = pipe(Arr.NonEmpty.singleton(1), Arr.NonEmpty.map((n) => n * 2));
	expect(result).toStrictEqual([2]);
	expectTypeOf(result).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("NonEmpty.mapWithIndex: maps elements with index and preserves NonEmpty type", () => {
	const result = pipe(Arr.NonEmpty.singleton("a"), Arr.NonEmpty.mapWithIndex((i, s) => `${i}:${s}`));
	expect(result).toStrictEqual(["0:a"]);
	expectTypeOf(result).toEqualTypeOf<readonly [string, ...string[]]>();
});

test("NonEmpty.intersperse: inserts separator between elements", () => {
	const result = pipe([1, 2, 3] as Arr.NonEmpty<number>, Arr.NonEmpty.intersperse(0));
	expect(result).toStrictEqual([1, 0, 2, 0, 3]);
	expectTypeOf(result).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("NonEmpty.intersperse: returns original array when length is 1", () => {
	const result = pipe([42] as Arr.NonEmpty<number>, Arr.NonEmpty.intersperse(0));
	expect(result).toStrictEqual([42]);
});

test("NonEmpty.concat: concatenates with standard array", () => {
	const result = pipe(Arr.NonEmpty.singleton(1), Arr.NonEmpty.concat([2, 3]));
	expect(result).toStrictEqual([1, 2, 3]);
	expectTypeOf(result).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("NonEmpty.reverse: reverses non-empty array", () => {
	const result = pipe([1, 2, 3] as Arr.NonEmpty<number>, Arr.NonEmpty.reverse);
	expect(result).toStrictEqual([3, 2, 1]);
	expectTypeOf(result).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("NonEmpty: composes operations in pipe", () => {
	const result = pipe(
		Arr.NonEmpty.singleton(1),
		Arr.NonEmpty.concat([2]),
		Arr.NonEmpty.map((n) => n * 2),
		Arr.NonEmpty.intersperse(0),
		Arr.NonEmpty.concat([5, 6]),
		Arr.NonEmpty.reverse,
	);
	expect(result).toStrictEqual([6, 5, 4, 0, 2]);
	expectTypeOf(result).toEqualTypeOf<readonly [number, ...number[]]>();
});

// --- partitionMaybe ---

test("partitionMaybe: separates None inputs from Some outputs", () => {
	const parseNumber = (s: string) => (isNaN(Number(s)) ? Maybe.make.none() : Maybe.make.some(Number(s)));
	const [failures, successes] = pipe(["1", "abc", "3"], Arr.partitionMaybe(parseNumber));
	expect(failures).toStrictEqual(["abc"]);
	expect(successes).toStrictEqual([1, 3]);
});

// --- at ---

test("at: looks up elements by positive and negative index", () => {
	expect(pipe([10, 20, 30], Arr.at(1))).toStrictEqual(Maybe.make.some(20));
	expect(pipe([10, 20, 30], Arr.at(-1))).toStrictEqual(Maybe.make.some(30));
	expect(pipe([10, 20, 30], Arr.at(5))).toStrictEqual(Maybe.make.none());
	expect(pipe([10, 20, 30], Arr.at(-5))).toStrictEqual(Maybe.make.none());
});

// --- findMap ---

test("findMap: returns first Some transformed value", () => {
	const parseNumber = (s: string) => (isNaN(Number(s)) ? Maybe.make.none() : Maybe.make.some(Number(s)));
	expect(pipe(["a", "2", "3"], Arr.findMap(parseNumber))).toStrictEqual(Maybe.make.some(2));
	expect(pipe(["a", "b"], Arr.findMap(parseNumber))).toStrictEqual(Maybe.make.none());
});

// --- indexBy ---

test("indexBy: indexes array elements into Map by key", () => {
	const users = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];
	const map = pipe(users, Arr.indexBy((u) => u.id));
	expect(map.get(1)).toStrictEqual({ id: 1, name: "Alice" });
	expect(map.get(2)).toStrictEqual({ id: 2, name: "Bob" });
});

// --- frequencies ---

test("frequencies: counts element occurrences", () => {
	const map = Arr.frequencies(["a", "b", "a", "c", "b", "a"]);
	expect(map.get("a")).toBe(3);
	expect(map.get("b")).toBe(2);
	expect(map.get("c")).toBe(1);
});

// --- chunkBy ---

test("chunkBy: groups consecutive elements by key", () => {
	const res = pipe([1, 1, 2, 3, 3, 1], Arr.chunkBy((n) => n));
	expect(res).toStrictEqual([[1, 1], [2], [3, 3], [1]]);
	expect(pipe([], Arr.chunkBy((n) => n))).toStrictEqual([]);
});

// --- dedupeAdjacent ---

test("dedupeAdjacent: drops consecutive duplicate elements", () => {
	const res = Arr.dedupeAdjacent()([1, 1, 2, 2, 1, 3]);
	expect(res).toStrictEqual([1, 2, 1, 3]);
	expect(Arr.dedupeAdjacent()([])).toStrictEqual([]);
});

// --- windowed ---

test("windowed: creates sliding windows with size and step", () => {
	expect(pipe([1, 2, 3, 4], Arr.windowed(2))).toStrictEqual([[1, 2], [2, 3], [3, 4]]);
	expect(pipe([1, 2, 3, 4], Arr.windowed(2, { step: 2 }))).toStrictEqual([[1, 2], [3, 4]]);
	expect(pipe([1, 2, 3, 4], Arr.windowed(0))).toStrictEqual([]);
	expect(pipe([1, 2, 3, 4], Arr.windowed(2, { step: 0 }))).toStrictEqual([]);
	expect(pipe([], Arr.windowed(2))).toStrictEqual([]);
});

// --- unfold ---

test("unfold: generates array from seed until None", () => {
	const res = Arr.unfold(1, (n) => (n > 3 ? Maybe.make.none() : Maybe.make.some([n, n + 1])));
	expect(res).toStrictEqual([1, 2, 3]);
});

test("size: returns size of array", () => {
	expect(Arr.size([1, 2])).toBe(2);
	expect(Arr.size([])).toBe(0);
});

test("is: distinguishes empty and non-empty arrays", () => {
	const emptyList: number[] = [];
	const nonEmptyList: readonly number[] = [1];
	expect(Arr.is.empty(emptyList)).toBe(true);
	expect(Arr.is.empty(nonEmptyList)).toBe(false);
	expect(Arr.is.nonEmpty(nonEmptyList)).toBe(true);
	expect(Arr.is.nonEmpty(emptyList)).toBe(false);

	expectTypeOf(Arr.is.empty(emptyList)).toBeBoolean();

	if (Arr.is.empty(emptyList)) {
		expectTypeOf(emptyList).toEqualTypeOf<number[]>();
	} else {
		expectTypeOf(emptyList).toEqualTypeOf<number[]>();
	}

	if (Arr.is.nonEmpty(nonEmptyList)) {
		expectTypeOf(nonEmptyList).toEqualTypeOf<Arr.NonEmpty<number>>();
	}
});
