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

test("head - returns Some of the first element for a non-empty array", () => {
	const result = Arr.head([10, 20, 30]);
	expect(result).toStrictEqual(Maybe.make.some(10));
});

test("head - returns None for an empty array", () => {
	const result = Arr.head([]);
	expect(result).toStrictEqual(Maybe.make.none());
});

test("head - returns Some for a single-element array", () => {
	const result = Arr.head(["only"]);
	expect(result).toStrictEqual(Maybe.make.some("only"));
});

test("last - returns Some of the last element for a non-empty array", () => {
	const result = Arr.last([10, 20, 30]);
	expect(result).toStrictEqual(Maybe.make.some(30));
});

test("last - returns None for an empty array", () => {
	const result = Arr.last([]);
	expect(result).toStrictEqual(Maybe.make.none());
});

test("last - returns Some for a single-element array", () => {
	const result = Arr.last([42]);
	expect(result).toStrictEqual(Maybe.make.some(42));
});

test("tail - returns Some of all elements except the first", () => {
	const result = Arr.tail([1, 2, 3]);
	expect(result).toStrictEqual(Maybe.make.some([2, 3]));
});

test("tail - returns Some of empty array for single-element array", () => {
	const result = Arr.tail([1]);
	expect(result).toStrictEqual(Maybe.make.some([]));
});

test("tail - returns None for an empty array", () => {
	const result = Arr.tail([]);
	expect(result).toStrictEqual(Maybe.make.none());
});

test("init - returns Some of all elements except the last", () => {
	const result = Arr.init([1, 2, 3]);
	expect(result).toStrictEqual(Maybe.make.some([1, 2]));
});

test("init - returns Some of empty array for single-element array", () => {
	const result = Arr.init([1]);
	expect(result).toStrictEqual(Maybe.make.some([]));
});

test("init - returns None for an empty array", () => {
	const result = Arr.init([]);
	expect(result).toStrictEqual(Maybe.make.none());
});

// --- Search: findFirst, findLast, findIndex ---

test("findFirst - returns Some of the first matching element", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.findFirst((n) => n > 3));
	expect(result).toStrictEqual(Maybe.make.some(4));
});

test("findFirst - returns None when no element matches", () => {
	const result = pipe([1, 2, 3], Arr.findFirst((n) => n > 10));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("findFirst - returns None for an empty array", () => {
	const result = pipe([] as number[], Arr.findFirst((n) => n > 0));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("findFirst - returns Some(undefined) when undefined matches", () => {
	const result = pipe([undefined, 1, 2] as (number | undefined)[], Arr.findFirst((x) => x === undefined));
	expect(result).toStrictEqual(Maybe.make.some(undefined));
});

test("findLast - returns Some of the last matching element", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.findLast((n) => n > 2));
	expect(result).toStrictEqual(Maybe.make.some(5));
});

test("findLast - returns None when no element matches", () => {
	const result = pipe([1, 2, 3], Arr.findLast((n) => n > 10));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("findLast - returns None for an empty array", () => {
	const result = pipe([] as number[], Arr.findLast((_) => true));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("findLast - returns Some(undefined) when undefined matches", () => {
	const result = pipe([1, undefined, 2, undefined] as (number | undefined)[], Arr.findLast((x) => x === undefined));
	expect(result).toStrictEqual(Maybe.make.some(undefined));
});

test("findIndex - returns Some of the index of the first match", () => {
	const result = pipe([10, 20, 30, 40], Arr.findIndex((n) => n === 30));
	expect(result).toStrictEqual(Maybe.make.some(2));
});

test("findIndex - returns None when no element matches", () => {
	const result = pipe([10, 20, 30], Arr.findIndex((n) => n === 99));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("findIndex - returns None for an empty array", () => {
	const result = pipe([] as number[], Arr.findIndex((_) => true));
	expect(result).toStrictEqual(Maybe.make.none());
});

// --- Transform: map, filter, partition, groupBy, uniq, uniqBy, sortBy ---

test("map - transforms each element", () => {
	const result = pipe([1, 2, 3], Arr.map((n) => n * 10));
	expect(result).toStrictEqual([10, 20, 30]);
});

test("map - returns empty array for empty input", () => {
	const result = pipe([] as number[], Arr.map((n) => n * 2));
	expect(result).toStrictEqual([]);
});

// --- mapWithIndex ---

test("Arr.mapWithIndex provides zero-based index alongside each element", () => {
	expect(pipe(["a", "b", "c"], Arr.mapWithIndex((i, s) => `${i}:${s}`))).toStrictEqual(["0:a", "1:b", "2:c"]);
});

test("Arr.mapWithIndex passes correct index and value", () => {
	expect(pipe([10, 20, 30], Arr.mapWithIndex((i, n) => i + n))).toStrictEqual([10, 21, 32]);
});

test("Arr.mapWithIndex on empty array returns empty array", () => {
	expect(pipe([], Arr.mapWithIndex((i, n: number) => n))).toStrictEqual([]);
});

test("Arr.mapWithIndex composes in pipe", () => {
	expect(pipe(["a", "b", "c"], Arr.mapWithIndex((i, s) => ({ position: i + 1, value: s })))).toStrictEqual([
		{ position: 1, value: "a" },
		{ position: 2, value: "b" },
		{ position: 3, value: "c" },
	]);
});

test("filter - keeps elements satisfying the predicate", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.filter((n) => n % 2 === 0));
	expect(result).toStrictEqual([2, 4]);
});

test("filter - returns empty array when nothing matches", () => {
	const result = pipe([1, 3, 5], Arr.filter((n) => n % 2 === 0));
	expect(result).toStrictEqual([]);
});

test("filter - returns empty array for empty input", () => {
	const result = pipe([] as number[], Arr.filter((_) => true));
	expect(result).toStrictEqual([]);
});

// --- filterMap ---

test("Arr.filterMap collects Some values and discards None", () => {
	const parseNum = (s: string): Maybe<number> => {
		const n = Number(s);
		return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	};
	expect(pipe(["1", "abc", "3"], Arr.filterMap(parseNum))).toStrictEqual([1, 3]);
});

test("Arr.filterMap returns empty array when all elements map to None", () => {
	expect(pipe(["a", "b", "c"], Arr.filterMap(() => Maybe.make.none()))).toStrictEqual([]);
});

test("Arr.filterMap returns all values when all elements map to Some", () => {
	expect(pipe([1, 2, 3], Arr.filterMap(Maybe.make.some))).toStrictEqual([1, 2, 3]);
});

test("Arr.filterMap on empty array returns empty array", () => {
	expect(pipe([], Arr.filterMap(Maybe.make.some))).toStrictEqual([]);
});

test("Arr.filterMap maps and filters in a single pipe", () => {
	expect(pipe([1, 2, 3, 4, 5], Arr.filterMap((n) => n % 2 === 0 ? Maybe.make.some(n * 10) : Maybe.make.none())))
		.toStrictEqual([20, 40]);
});

test("partition - splits array into pass and fail groups", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.partition((n) => n % 2 === 0));
	expect(result).toStrictEqual([[2, 4], [1, 3, 5]]);
});

test("partition - all elements pass", () => {
	const result = pipe([2, 4, 6], Arr.partition((n) => n % 2 === 0));
	expect(result).toStrictEqual([[2, 4, 6], []]);
});

test("partition - no elements pass", () => {
	const result = pipe([1, 3, 5], Arr.partition((n) => n % 2 === 0));
	expect(result).toStrictEqual([[], [1, 3, 5]]);
});

test("partition - empty array produces two empty arrays", () => {
	const result = pipe([] as number[], Arr.partition((_) => true));
	expect(result).toStrictEqual([[], []]);
});

test("groupBy - groups elements by a key function", () => {
	const result = pipe(["apple", "avocado", "banana", "blueberry"], Arr.groupBy((s) => s[0]));
	expect(result).toStrictEqual({ a: ["apple", "avocado"], b: ["banana", "blueberry"] });
});

test("groupBy - returns empty record for empty array", () => {
	const result = pipe([] as string[], Arr.groupBy((s) => s));
	expect(result).toStrictEqual({});
});

test("groupBy - each element in its own group", () => {
	const result = pipe([1, 2, 3], Arr.groupBy((n) => String(n)));
	expect(result).toStrictEqual({ "1": [1], "2": [2], "3": [3] });
});

test("uniq - removes duplicate elements", () => {
	const result = Arr.uniq([1, 2, 2, 3, 1, 3, 4]);
	expect(result).toStrictEqual([1, 2, 3, 4]);
});

test("uniq - returns same for array with no duplicates", () => {
	const result = Arr.uniq([1, 2, 3]);
	expect(result).toStrictEqual([1, 2, 3]);
});

test("uniq - returns empty for empty array", () => {
	const result = Arr.uniq([]);
	expect(result).toStrictEqual([]);
});

test("uniq - preserves order of first occurrences", () => {
	const result = Arr.uniq([3, 1, 2, 1, 3]);
	expect(result).toStrictEqual([3, 1, 2]);
});

test("uniqBy - removes duplicates by key function", () => {
	const items = [{ id: 1, name: "a" }, { id: 1, name: "b" }, { id: 2, name: "c" }];
	const result = pipe(items, Arr.uniqBy((x) => x.id));
	expect(result).toStrictEqual([{ id: 1, name: "a" }, { id: 2, name: "c" }]);
});

test("uniqBy - returns empty for empty array", () => {
	const result = pipe([] as { id: number; }[], Arr.uniqBy((x) => x.id));
	expect(result).toStrictEqual([]);
});

test("sortBy - sorts array using comparison function", () => {
	const result = pipe([3, 1, 4, 1, 5, 9], Arr.sortBy((a, b) => a - b));
	expect(result).toStrictEqual([1, 1, 3, 4, 5, 9]);
});

test("sortBy - sorts in descending order", () => {
	const result = pipe([3, 1, 2], Arr.sortBy((a, b) => b - a));
	expect(result).toStrictEqual([3, 2, 1]);
});

test("sortBy - does not mutate the original array", () => {
	const original = [3, 1, 2];
	pipe(original, Arr.sortBy((a, b) => a - b));
	expect(original).toStrictEqual([3, 1, 2]);
});

test("sortBy - returns empty for empty array", () => {
	const result = pipe([] as number[], Arr.sortBy((a, b) => a - b));
	expect(result).toStrictEqual([]);
});

test("sortBy - falls back to spread+sort when toSorted is unavailable", () => {
	const arr = Object.defineProperty([3, 1, 2], "toSorted", { value: undefined, configurable: true });
	expect(Arr.sortBy((a: number, b: number) => a - b)(arr)).toStrictEqual([1, 2, 3]);
});

// --- Combine: zip, zipWith, intersperse, chunksOf, flatten, flatMap ---

test("zip - pairs elements from two arrays", () => {
	const result = pipe([1, 2, 3], Arr.zip(["a", "b", "c"]));
	expect(result).toStrictEqual([[1, "a"], [2, "b"], [3, "c"]]);
});

test("zip - stops at the shorter array (first shorter)", () => {
	const result = pipe([1, 2], Arr.zip(["a", "b", "c"]));
	expect(result).toStrictEqual([[1, "a"], [2, "b"]]);
});

test("zip - stops at the shorter array (second shorter)", () => {
	const result = pipe([1, 2, 3], Arr.zip(["a", "b"]));
	expect(result).toStrictEqual([[1, "a"], [2, "b"]]);
});

test("zip - returns empty when first array is empty", () => {
	const result = pipe([] as number[], Arr.zip(["a", "b"]));
	expect(result).toStrictEqual([]);
});

test("zip - returns empty when second array is empty", () => {
	const result = pipe([1, 2], Arr.zip([] as string[]));
	expect(result).toStrictEqual([]);
});

test("zipWith - combines elements using a function", () => {
	const result = pipe([1, 2, 3], Arr.zipWith((a, b) => `${a}${b}`)(["a", "b", "c"]));
	expect(result).toStrictEqual(["1a", "2b", "3c"]);
});

test("zipWith - stops at the shorter array", () => {
	const result = pipe([1, 2, 3], Arr.zipWith((a: number, b: number) => a + b)([10, 20]));
	expect(result).toStrictEqual([11, 22]);
});

test("zipWith - returns empty for empty input", () => {
	const result = pipe([] as number[], Arr.zipWith((a: number, b: number) => a + b)([10, 20]));
	expect(result).toStrictEqual([]);
});

test("intersperse - inserts separator between elements", () => {
	const result = pipe([1, 2, 3], Arr.intersperse(0));
	expect(result).toStrictEqual([1, 0, 2, 0, 3]);
});

test("intersperse - single-element array returns unchanged", () => {
	const result = pipe([42], Arr.intersperse(0));
	expect(result).toStrictEqual([42]);
});

test("intersperse - empty array returns empty array", () => {
	const result = pipe([] as number[], Arr.intersperse(0));
	expect(result).toStrictEqual([]);
});

test("intersperse - with string separator", () => {
	const result = pipe(["a", "b", "c"], Arr.intersperse("-"));
	expect(result).toStrictEqual(["a", "-", "b", "-", "c"]);
});

test("concat - concatenates two arrays", () => {
	const result = pipe([1, 2], Arr.concat([3, 4]));
	expect(result).toStrictEqual([1, 2, 3, 4]);
});

test("concat - concatenates with empty array", () => {
	const result = pipe([1, 2], Arr.concat([] as number[]));
	expect(result).toStrictEqual([1, 2]);
});

test("concat - empty array concatenates with array", () => {
	const result = pipe([] as number[], Arr.concat([1, 2]));
	expect(result).toStrictEqual([1, 2]);
});

test("chunksOf - splits array into chunks of given size", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.chunksOf(2));
	expect(result).toStrictEqual([[1, 2], [3, 4], [5]]);
});

test("chunksOf - exact division", () => {
	const result = pipe([1, 2, 3, 4, 5, 6], Arr.chunksOf(3));
	expect(result).toStrictEqual([[1, 2, 3], [4, 5, 6]]);
});

test("chunksOf - chunk size larger than array", () => {
	const result = pipe([1, 2], Arr.chunksOf(5));
	expect(result).toStrictEqual([[1, 2]]);
});

test("chunksOf - chunk size of 1", () => {
	const result = pipe([1, 2, 3], Arr.chunksOf(1));
	expect(result).toStrictEqual([[1], [2], [3]]);
});

test("chunksOf(0) - returns empty array", () => {
	const result = pipe([1, 2, 3], Arr.chunksOf(0));
	expect(result).toStrictEqual([]);
});

test("chunksOf - negative size returns empty array", () => {
	const result = pipe([1, 2, 3], Arr.chunksOf(-1));
	expect(result).toStrictEqual([]);
});

test("chunksOf - empty array returns empty array", () => {
	const result = pipe([] as number[], Arr.chunksOf(3));
	expect(result).toStrictEqual([]);
});

test("flatten - flattens one level of nesting", () => {
	const result = Arr.flatten([[1, 2], [3], [4, 5]]);
	expect(result).toStrictEqual([1, 2, 3, 4, 5]);
});

test("flatten - with empty subarrays", () => {
	const result = Arr.flatten([[1], [], [2, 3], []]);
	expect(result).toStrictEqual([1, 2, 3]);
});

test("flatten - empty outer array", () => {
	const result = Arr.flatten([] as number[][]);
	expect(result).toStrictEqual([]);
});

test("flatten - call stack safety (handles very large number of sub-arrays)", () => {
	const size = 70_000;
	const data = Array.from({ length: size }, (_, i) => [i]);
	const result = Arr.flatten(data);
	expect(result).toHaveLength(size);
	expect(result[0]).toBe(0);
	expect(result[size - 1]).toBe(size - 1);
});

test("flatMap - maps and flattens", () => {
	const result = pipe([1, 2, 3], Arr.flatMap((n) => [n, n * 10]));
	expect(result).toStrictEqual([1, 10, 2, 20, 3, 30]);
});

test("flatMap - returning empty arrays filters elements", () => {
	const result = pipe([1, 2, 3, 4], Arr.flatMap((n) => (n % 2 === 0 ? [n] : [])));
	expect(result).toStrictEqual([2, 4]);
});

test("flatMap - empty array returns empty array", () => {
	const result = pipe([] as number[], Arr.flatMap((n) => [n, n]));
	expect(result).toStrictEqual([]);
});

// --- Reduce ---

test("reduce - sums numbers", () => {
	const result = pipe([1, 2, 3, 4], Arr.reduce(0, (acc, n) => acc + n));
	expect(result).toBe(10);
});

test("reduce - concatenates strings", () => {
	const result = pipe(["a", "b", "c"], Arr.reduce("", (acc, s) => acc + s));
	expect(result).toBe("abc");
});

test("reduce - returns initial value for empty array", () => {
	const result = pipe([] as number[], Arr.reduce(42, (acc, n) => acc + n));
	expect(result).toBe(42);
});

test("reduce - builds an object from entries", () => {
	const result = pipe(
		[["a", 1], ["b", 2], ["c", 3]] as [string, number][],
		Arr.reduce({} as Record<string, number>, (acc, [k, v]) => ({ ...acc, [k]: v })),
	);
	expect(result).toStrictEqual({ a: 1, b: 2, c: 3 });
});

// --- Traverse / Sequence (Option) ---

test("traverse - all Some results in Some of array", () => {
	const parseNum = (s: string): Maybe<number> => {
		const n = Number(s);
		return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	};
	const result = pipe(["1", "2", "3"], Arr.traverse.Maybe(parseNum));
	expect(result).toStrictEqual(Maybe.make.some([1, 2, 3]));
});

test("traverse - any None results in None", () => {
	const parseNum = (s: string): Maybe<number> => {
		const n = Number(s);
		return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	};
	const result = pipe(["1", "x", "3"], Arr.traverse.Maybe(parseNum));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("traverse - empty array results in Some of empty array", () => {
	const result = pipe([] as string[], Arr.traverse.Maybe((s) => Maybe.make.some(s)));
	expect(result).toStrictEqual(Maybe.make.some([]));
});

test("traverse - fails at first None and short-circuits", () => {
	let callCount = 0;
	const f = (n: number): Maybe<number> => {
		callCount++;
		return n > 0 ? Maybe.make.some(n) : Maybe.make.none();
	};
	const result = pipe([1, 0, 2, 3], Arr.traverse.Maybe(f));
	expect(result).toStrictEqual(Maybe.make.none());
	expect(callCount).toBe(2);
});

test("sequence - all Some results in Some of array", () => {
	const result = Arr.sequence.Maybe([Maybe.make.some(1), Maybe.make.some(2), Maybe.make.some(3)]);
	expect(result).toStrictEqual(Maybe.make.some([1, 2, 3]));
});

test("sequence - any None results in None", () => {
	const result = Arr.sequence.Maybe([Maybe.make.some(1), Maybe.make.none(), Maybe.make.some(3)]);
	expect(result).toStrictEqual(Maybe.make.none());
});

test("sequence - empty array results in Some of empty array", () => {
	const result = Arr.sequence.Maybe([] as Maybe<number>[]);
	expect(result).toStrictEqual(Maybe.make.some([]));
});

// --- Traverse / Sequence (Result) ---

test("traverseResult - all Ok results in Ok of array", () => {
	const validate = (n: number): Result<string, number> => n > 0 ? Result.make.ok(n) : Result.make.err("not positive");
	const result = pipe([1, 2, 3], Arr.traverse.Result(validate));
	expect(result).toStrictEqual(Result.make.ok([1, 2, 3]));
});

test("traverseResult - first Err is returned", () => {
	const validate = (n: number): Result<string, number> =>
		n > 0 ? Result.make.ok(n) : Result.make.err(`${n} is not positive`);
	const result = pipe([1, -2, -3], Arr.traverse.Result(validate));
	expect(result).toStrictEqual(Result.make.err("-2 is not positive"));
});

test("traverseResult - empty array results in Ok of empty array", () => {
	const result = pipe([] as number[], Arr.traverse.Result((n) => Result.make.ok(n)));
	expect(result).toStrictEqual(Result.make.ok([]));
});

test("traverseResult - short-circuits at first Err", () => {
	let callCount = 0;
	const f = (n: number): Result<string, number> => {
		callCount++;
		return n > 0 ? Result.make.ok(n) : Result.make.err("bad");
	};
	pipe([1, 0, 2, 3], Arr.traverse.Result(f));
	expect(callCount).toBe(2);
});

test("sequenceResult - all Ok results in Ok of array", () => {
	const result = Arr.sequence.Result([Result.make.ok(1), Result.make.ok(2), Result.make.ok(3)]);
	expect(result).toStrictEqual(Result.make.ok([1, 2, 3]));
});

test("sequenceResult - first Err is returned", () => {
	const result = Arr.sequence.Result([Result.make.ok(1), Result.make.err("oops"), Result.make.ok(3)]);
	expect(result).toStrictEqual(Result.make.err("oops"));
});

test("sequenceResult - empty array results in Ok of empty array", () => {
	const result = Arr.sequence.Result([] as Result<string, number>[]);
	expect(result).toStrictEqual(Result.make.ok([]));
});

// --- Traverse / Sequence (Task - async) ---

test("traverseTask - maps elements to tasks and runs in parallel", async () => {
	const result = await pipe([1, 2, 3], Arr.traverse.Task((n) => Task.resolve(n * 10)))();
	expect(result).toStrictEqual([10, 20, 30]);
});

test("traverseTask - empty array resolves to empty array", async () => {
	const result = await pipe([] as number[], Arr.traverse.Task((n) => Task.resolve(n)))();
	expect(result).toStrictEqual([]);
});

test("traverseTask - handles async operations", async () => {
	const delayedDouble = (n: number): Task<number> =>
		Task.from.Promise(() => new Promise<number>((resolve) => setTimeout(() => resolve(n * 2), 10)));

	const result = await pipe([1, 2, 3], Arr.traverse.Task(delayedDouble))();
	expect(result).toStrictEqual([2, 4, 6]);
});

test("sequenceTask - runs all tasks in parallel and collects results", async () => {
	const tasks: Task<number>[] = [Task.resolve(10), Task.resolve(20), Task.resolve(30)];
	const result = await Arr.sequence.Task(tasks)();
	expect(result).toStrictEqual([10, 20, 30]);
});

test("sequenceTask - empty array resolves to empty array", async () => {
	const result = await Arr.sequence.Task([] as Task<number>[])();
	expect(result).toStrictEqual([]);
});

test("sequenceTask - preserves order despite different completion times", async () => {
	const tasks: Task<string>[] = [
		Task.from.Promise(() => new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 30))),
		Task.from.Promise(() => new Promise<string>((resolve) => setTimeout(() => resolve("fast"), 5))),
		Task.from.Promise(() => new Promise<string>((resolve) => setTimeout(() => resolve("medium"), 15))),
	];
	const result = await Arr.sequence.Task(tasks)();
	expect(result).toStrictEqual(["slow", "fast", "medium"]);
});

// --- traverseTaskResult / sequenceTaskResult ---

test("traverseTaskResult - all succeed returns Ok of results", async () => {
	const validate = (n: number): Task<Result<string, number>> =>
		n > 0 ? Task.resolve(Result.make.ok(n)) : Task.resolve(Result.make.err("non-positive"));
	const result = await pipe([1, 2, 3], Arr.traverse.Task.Result(validate))();
	expect(result).toStrictEqual(Result.make.ok([1, 2, 3]));
});

test("traverseTaskResult - first error short-circuits", async () => {
	const order: number[] = [];
	const validate = (n: number): Task<Result<string, number>> =>
		Task.from.Promise(() => {
			order.push(n);
			return Promise.resolve(n > 0 ? Result.make.ok(n) : Result.make.err("non-positive"));
		});
	const result = await pipe([1, -1, 3], Arr.traverse.Task.Result(validate))();
	expect(result).toStrictEqual(Result.make.err("non-positive"));
	expect(order).toStrictEqual([1, -1]); // 3 was not processed
});

test("traverseTaskResult - empty array returns Ok of empty array", async () => {
	const result = await Arr.traverse.Task.Result((n: number) => Task.resolve(Result.make.ok(n)))([])();
	expect(result).toStrictEqual(Result.make.ok([]));
});

test("sequenceTaskResult - collects Ok results", async () => {
	const tasks: Task<Result<string, number>>[] = [Task.resolve(Result.make.ok(10)), Task.resolve(Result.make.ok(20))];
	const result = await Arr.sequence.Task.Result(tasks)();
	expect(result).toStrictEqual(Result.make.ok([10, 20]));
});

test("sequenceTaskResult - returns first Err", async () => {
	const tasks: Task<Result<string, number>>[] = [
		Task.resolve(Result.make.ok(10)),
		Task.resolve(Result.make.err("oops")),
		Task.resolve(Result.make.ok(30)),
	];
	const result = await Arr.sequence.Task.Result(tasks)();
	expect(result).toStrictEqual(Result.make.err("oops"));
});

// --- Predicates: isNonEmpty, some, every ---

test("isNonEmpty - returns true for non-empty array", () => {
	expect(Arr.is.nonEmpty([1, 2, 3])).toBe(true);
});

test("isNonEmpty - returns false for empty array", () => {
	expect(Arr.is.nonEmpty([])).toBe(false);
});

test("isNonEmpty - returns true for single-element array", () => {
	expect(Arr.is.nonEmpty([undefined])).toBe(true);
});

test("some - returns true when at least one element matches", () => {
	const result = pipe([1, 2, 3, 4], Arr.some((n) => n > 3));
	expect(result).toBe(true);
});

test("some - returns false when no element matches", () => {
	const result = pipe([1, 2, 3], Arr.some((n) => n > 10));
	expect(result).toBe(false);
});

test("some - returns false for empty array", () => {
	const result = pipe([] as number[], Arr.some((_) => true));
	expect(result).toBe(false);
});

test("every - returns true when all elements match", () => {
	const result = pipe([2, 4, 6], Arr.every((n) => n % 2 === 0));
	expect(result).toBe(true);
});

test("every - returns false when any element does not match", () => {
	const result = pipe([2, 3, 6], Arr.every((n) => n % 2 === 0));
	expect(result).toBe(false);
});

test("every - returns true for empty array (vacuous truth)", () => {
	const result = pipe([] as number[], Arr.every((_) => false));
	expect(result).toBe(true);
});

// --- Slicing: reverse, take, drop, takeWhile, dropWhile ---

test("reverse - reverses elements", () => {
	const result = Arr.reverse([1, 2, 3]);
	expect(result).toStrictEqual([3, 2, 1]);
});

test("reverse - does not mutate the original array", () => {
	const original = [1, 2, 3];
	Arr.reverse(original);
	expect(original).toStrictEqual([1, 2, 3]);
});

test("reverse - returns empty for empty array", () => {
	expect(Arr.reverse([])).toStrictEqual([]);
});

test("reverse - single element returns same", () => {
	expect(Arr.reverse([42])).toStrictEqual([42]);
});

// --- insertAt ---

test("insertAt - inserts at start", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(0, 99))).toStrictEqual([99, 1, 2, 3]);
});

test("insertAt - inserts in middle", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(1, 99))).toStrictEqual([1, 99, 2, 3]);
});

test("insertAt - inserts at end", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(3, 99))).toStrictEqual([1, 2, 3, 99]);
});

test("insertAt - clamps negative index to 0", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(-5, 99))).toStrictEqual([99, 1, 2, 3]);
});

test("insertAt - clamps over-length index to end", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(100, 99))).toStrictEqual([1, 2, 3, 99]);
});

test("insertAt - inserts into empty array", () => {
	expect(pipe([] as number[], Arr.insertAt(0, 99))).toStrictEqual([99]);
});

test("insertAt - does not mutate the original array", () => {
	const original = [1, 2, 3];
	pipe(original, Arr.insertAt(1, 99));
	expect(original).toStrictEqual([1, 2, 3]);
});

test("insertAt - falls back to spread+splice when toSpliced is unavailable", () => {
	const arr = Object.defineProperty([1, 2, 3], "toSpliced", { value: undefined, configurable: true });
	expect(Arr.insertAt(1, 99)(arr)).toStrictEqual([1, 99, 2, 3]);
});

// --- removeAt ---

test("removeAt - removes at start", () => {
	expect(pipe([1, 2, 3], Arr.removeAt(0))).toStrictEqual([2, 3]);
});

test("removeAt - removes in middle", () => {
	expect(pipe([1, 2, 3], Arr.removeAt(1))).toStrictEqual([1, 3]);
});

test("removeAt - removes at end", () => {
	expect(pipe([1, 2, 3], Arr.removeAt(2))).toStrictEqual([1, 2]);
});

test("removeAt - returns original for negative index", () => {
	const original = [1, 2, 3];
	expect(pipe(original, Arr.removeAt(-1))).toBe(original);
});

test("removeAt - returns original for out-of-bounds index", () => {
	const original = [1, 2, 3];
	expect(pipe(original, Arr.removeAt(5))).toBe(original);
});

test("removeAt - returns empty for single-element array", () => {
	expect(pipe([42], Arr.removeAt(0))).toStrictEqual([]);
});

test("removeAt - does not mutate the original array", () => {
	const original = [1, 2, 3];
	pipe(original, Arr.removeAt(1));
	expect(original).toStrictEqual([1, 2, 3]);
});

test("removeAt - falls back to spread+splice when toSpliced is unavailable", () => {
	const arr = Object.defineProperty([1, 2, 3], "toSpliced", { value: undefined, configurable: true });
	expect(Arr.removeAt(1)(arr)).toStrictEqual([1, 3]);
});

test("take - takes first n elements", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.take(3));
	expect(result).toStrictEqual([1, 2, 3]);
});

test("take - takes all when n exceeds length", () => {
	const result = pipe([1, 2], Arr.take(10));
	expect(result).toStrictEqual([1, 2]);
});

test("take(0) - returns empty array", () => {
	const result = pipe([1, 2, 3], Arr.take(0));
	expect(result).toStrictEqual([]);
});

test("take - negative n returns empty array", () => {
	const result = pipe([1, 2, 3], Arr.take(-1));
	expect(result).toStrictEqual([]);
});

test("drop - drops first n elements", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.drop(2));
	expect(result).toStrictEqual([3, 4, 5]);
});

test("drop - drops all when n exceeds length", () => {
	const result = pipe([1, 2], Arr.drop(10));
	expect(result).toStrictEqual([]);
});

test("drop(0) - returns entire array", () => {
	const result = pipe([1, 2, 3], Arr.drop(0));
	expect(result).toStrictEqual([1, 2, 3]);
});

test("takeWhile - takes elements while predicate holds", () => {
	const result = pipe([1, 2, 3, 4, 1], Arr.takeWhile((n) => n < 3));
	expect(result).toStrictEqual([1, 2]);
});

test("takeWhile - takes nothing when first element fails", () => {
	const result = pipe([5, 1, 2], Arr.takeWhile((n) => n < 3));
	expect(result).toStrictEqual([]);
});

test("takeWhile - takes all when all pass", () => {
	const result = pipe([1, 2, 3], Arr.takeWhile((n) => n < 10));
	expect(result).toStrictEqual([1, 2, 3]);
});

test("takeWhile - empty array returns empty", () => {
	const result = pipe([] as number[], Arr.takeWhile((_) => true));
	expect(result).toStrictEqual([]);
});

test("dropWhile - drops elements while predicate holds", () => {
	const result = pipe([1, 2, 3, 4, 1], Arr.dropWhile((n) => n < 3));
	expect(result).toStrictEqual([3, 4, 1]);
});

test("dropWhile - drops nothing when first element fails", () => {
	const result = pipe([5, 1, 2], Arr.dropWhile((n) => n < 3));
	expect(result).toStrictEqual([5, 1, 2]);
});

test("dropWhile - drops all when all pass", () => {
	const result = pipe([1, 2, 3], Arr.dropWhile((n) => n < 10));
	expect(result).toStrictEqual([]);
});

test("dropWhile - empty array returns empty", () => {
	const result = pipe([] as number[], Arr.dropWhile((_) => true));
	expect(result).toStrictEqual([]);
});

// --- scan ---

test("scan - returns running totals of a sum", () => {
	expect(pipe([1, 2, 3], Arr.scan(0, (acc, n) => acc + n))).toStrictEqual([1, 3, 6]);
});

test("scan - returns empty array for empty input", () => {
	expect(pipe([], Arr.scan(0, (acc: number, n: number) => acc + n))).toStrictEqual([]);
});

test("scan - does not include the initial value in output", () => {
	expect(pipe([5], Arr.scan(100, (acc, n) => acc + n))).toStrictEqual([105]);
});

test("scan - output length equals input length", () => {
	const result = pipe([1, 2, 3, 4], Arr.scan(0, (acc, n) => acc + n));
	expect(result).toHaveLength(4);
});

test("scan - works with non-numeric accumulators", () => {
	expect(pipe(["a", "b", "c"], Arr.scan("", (acc, s) => acc + s))).toStrictEqual(["a", "ab", "abc"]);
});

// --- splitAt ---

test("splitAt - splits array at a given index", () => {
	expect(pipe([1, 2, 3, 4], Arr.splitAt(2))).toStrictEqual([[1, 2], [3, 4]]);
});

test("splitAt - index 0 gives empty before and full after", () => {
	expect(pipe([1, 2, 3], Arr.splitAt(0))).toStrictEqual([[], [1, 2, 3]]);
});

test("splitAt - index equal to length gives full before and empty after", () => {
	expect(pipe([1, 2, 3], Arr.splitAt(3))).toStrictEqual([[1, 2, 3], []]);
});

test("splitAt - index beyond length clamps to end", () => {
	expect(pipe([1, 2], Arr.splitAt(10))).toStrictEqual([[1, 2], []]);
});

test("splitAt - negative index clamps to 0", () => {
	expect(pipe([1, 2, 3], Arr.splitAt(-5))).toStrictEqual([[], [1, 2, 3]]);
});

test("splitAt - empty array returns two empty arrays", () => {
	expect(pipe([], Arr.splitAt(2))).toStrictEqual([[], []]);
});

// --- Size ---

test("size - returns length of array", () => {
	expect(Arr.size([1, 2, 3])).toBe(3);
});

test("size - returns 0 for empty array", () => {
	expect(Arr.size([])).toBe(0);
});

test("size - returns 1 for single-element array", () => {
	expect(Arr.size(["only"])).toBe(1);
});

// --- Composition with pipe ---

test("pipe composition - filter, map, head", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.filter((n) => n > 2), Arr.map((n) => n * 10), Arr.head);
	expect(result).toStrictEqual(Maybe.make.some(30));
});

test("pipe composition - map, filter, reduce", () => {
	const result = pipe(
		[1, 2, 3, 4, 5],
		Arr.map((n) => n * 2),
		Arr.filter((n) => n > 4),
		Arr.reduce(0, (acc, n) => acc + n),
	);
	expect(result).toBe(6 + 8 + 10);
});

test("pipe composition - flatMap, uniq, sortBy", () => {
	const result = pipe([1, 2, 3], Arr.flatMap((n) => [n, n + 1]), Arr.uniq, Arr.sortBy((a, b) => a - b));
	expect(result).toStrictEqual([1, 2, 3, 4]);
});

// --- uniqWith ---

test("uniqWith - removes duplicates using custom equality", () => {
	type Point = { x: number; y: number; };
	const eqPoint: Equality<Point> = (a, b) => a.x === b.x && a.y === b.y;
	const result = pipe(
		[{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 1 }, { x: 3, y: 3 }] as Point[],
		Arr.uniqWith(eqPoint),
	);
	expect(result).toStrictEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]);
});

test("uniqWith - preserves order of first occurrences", () => {
	const eqMod3: Equality<number> = (a, b) => a % 3 === b % 3;
	expect(pipe([1, 4, 2, 5, 3], Arr.uniqWith(eqMod3))).toStrictEqual([1, 2, 3]);
});

test("uniqWith - returns empty array for empty input", () => {
	expect(pipe([] as number[], Arr.uniqWith(Equality.number))).toStrictEqual([]);
});

// --- sortWith ---

test("sortWith - sorts ascending with Ordering.number", () => {
	expect(pipe([3, 1, 2], Arr.sortWith(Ordering.number))).toStrictEqual([1, 2, 3]);
});

test("sortWith - sorts descending with Ordering.reverse", () => {
	expect(pipe([3, 1, 2], Arr.sortWith(Ordering.reverse(Ordering.number)))).toStrictEqual([3, 2, 1]);
});

test("sortWith - does not mutate the original array", () => {
	const original = [3, 1, 2];
	pipe(original, Arr.sortWith(Ordering.number));
	expect(original).toStrictEqual([3, 1, 2]);
});

test("sortWith - returns empty array for empty input", () => {
	expect(pipe([] as number[], Arr.sortWith(Ordering.number))).toStrictEqual([]);
});

test("sortWith - falls back to sort when toSorted is unavailable", () => {
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

test("Arr.compact extracts values from Some and discards None", () => {
	const input = [Maybe.make.some(1), Maybe.make.none(), Maybe.make.some(2), Maybe.make.none(), Maybe.make.some(3)];
	expect(Arr.compact(input)).toStrictEqual([1, 2, 3]);
});

test("Arr.compact returns empty array for all None", () => {
	const input = [Maybe.make.none(), Maybe.make.none(), Maybe.make.none()];
	expect(Arr.compact(input)).toStrictEqual([]);
});

test("Arr.compact returns all values when no None present", () => {
	const input = [Maybe.make.some("a"), Maybe.make.some("b"), Maybe.make.some("c")];
	expect(Arr.compact(input)).toStrictEqual(["a", "b", "c"]);
});

// --- separate ---

test("Arr.separate splits Results into errors and successes", () => {
	const input = [Result.make.ok(1), Result.make.err("bad"), Result.make.ok(2), Result.make.err("worse")];
	expect(Arr.separate(input)).toStrictEqual([["bad", "worse"], [1, 2]]);
});

test("Arr.separate returns empty arrays for empty input", () => {
	expect(Arr.separate([])).toStrictEqual([[], []]);
});

test("Arr.separate returns only errors when all are Error", () => {
	const input = [Result.make.err("a"), Result.make.err("b")];
	expect(Arr.separate(input)).toStrictEqual([["a", "b"], []]);
});

test("Arr.separate returns only successes when all are Ok", () => {
	const input = [Result.make.ok(1), Result.make.ok(2), Result.make.ok(3)];
	expect(Arr.separate(input)).toStrictEqual([[], [1, 2, 3]]);
});

// --- partitionMap ---

test("Arr.partitionMap maps and separates in one pass", () => {
	const classify = (n: number): Result<string, number> =>
		n > 0 ? Result.make.ok(n * 10) : Result.make.err(`${n} is not positive`);
	const result = pipe([1, -2, 3, -4], Arr.partitionMap(classify));
	expect(result).toStrictEqual([["-2 is not positive", "-4 is not positive"], [10, 30]]);
});

test("Arr.partitionMap returns empty arrays for empty input", () => {
	const result = pipe([] as number[], Arr.partitionMap((n) => Result.make.ok(n)));
	expect(result).toStrictEqual([[], []]);
});

test("Arr.partitionMap composes in pipe", () => {
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

test("Arr.prepend - prepends an element to an array", () => {
	const result = pipe([1, 2], Arr.prepend(0));
	expect(result).toStrictEqual([0, 1, 2]);
});

test("Arr.prepend - prepends to an empty array", () => {
	const result = pipe([], Arr.prepend(42));
	expect(result).toStrictEqual([42]);
});

test("Arr.append - appends an element to an array", () => {
	const result = pipe([1, 2], Arr.append(3));
	expect(result).toStrictEqual([1, 2, 3]);
});

test("Arr.append - appends to an empty array", () => {
	const result = pipe([], Arr.append(42));
	expect(result).toStrictEqual([42]);
});

// --- Arr.NonEmpty ---

test("isNonEmptyArr - returns true for non-empty array", () => {
	expect(isNonEmptyArr([1, 2, 3])).toBe(true);
});

test("isNonEmptyArr - returns false for empty array", () => {
	expect(isNonEmptyArr([])).toBe(false);
});

test("Arr.NonEmpty.map on NonEmptyArr - maps values type-safely", () => {
	const list: NonEmptyArr<number> = [1, 2, 3];
	const result: NonEmptyArr<number> = Arr.NonEmpty.map((n: number) => n * 2)(list);
	expect(result).toStrictEqual([2, 4, 6]);
});

test("Arr.NonEmpty.concat on NonEmptyArr - concatenates list with array", () => {
	const list: NonEmptyArr<number> = [1, 2];
	const result: NonEmptyArr<number> = Arr.NonEmpty.concat([3, 4])(list);
	expect(result).toStrictEqual([1, 2, 3, 4]);
});

test("Validation failure errors are type-compatible with Arr.NonEmpty", () => {
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

test("Arr.NonEmpty.singleton - creates a single-element non-empty array", () => {
	const result = Arr.NonEmpty.singleton(42);
	expect(result).toStrictEqual([42]);
	expectTypeOf(result).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("Arr.NonEmpty.from.Array - returns Some for non-empty array", () => {
	const result = Arr.NonEmpty.from.Array([1, 2]);
	expect(result).toStrictEqual(Maybe.make.some([1, 2]));
});

test("Arr.NonEmpty.from.Array - returns None for empty array", () => {
	const result = Arr.NonEmpty.from.Array([]);
	expect(result).toStrictEqual(Maybe.make.none());
});

test("Arr.NonEmpty.head - returns the first element", () => {
	const result = Arr.NonEmpty.head([1, 2, 3]);
	expect(result).toBe(1);
});

test("Arr.NonEmpty.last - returns the last element", () => {
	const result = Arr.NonEmpty.last([1, 2, 3]);
	expect(result).toBe(3);
});

test("Arr.NonEmpty.tail - returns all elements except the first", () => {
	const result = Arr.NonEmpty.tail([1, 2, 3]);
	expect(result).toStrictEqual([2, 3]);
});

test("Arr.NonEmpty.reduce - reduces elements from left without initial value", () => {
	const result = pipe([1, 2, 3, 4] as Arr.NonEmpty<number>, Arr.NonEmpty.reduce((a, b) => a + b));
	expect(result).toBe(10);
});

test("Arr.NonEmpty.map - maps elements and preserves NonEmpty type", () => {
	const result = pipe(Arr.NonEmpty.singleton(1), Arr.NonEmpty.map((n) => n * 2));
	expect(result).toStrictEqual([2]);
	expectTypeOf(result).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("Arr.NonEmpty.mapWithIndex - maps elements with index and preserves NonEmpty type", () => {
	const result = pipe(Arr.NonEmpty.singleton("a"), Arr.NonEmpty.mapWithIndex((i, s) => `${i}:${s}`));
	expect(result).toStrictEqual(["0:a"]);
	expectTypeOf(result).toEqualTypeOf<readonly [string, ...string[]]>();
});

test("Arr.NonEmpty.intersperse - inserts separator between elements", () => {
	const result = pipe([1, 2, 3] as Arr.NonEmpty<number>, Arr.NonEmpty.intersperse(0));
	expect(result).toStrictEqual([1, 0, 2, 0, 3]);
	expectTypeOf(result).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("Arr.NonEmpty.intersperse - returns original array if length is 1", () => {
	const result = pipe([42] as Arr.NonEmpty<number>, Arr.NonEmpty.intersperse(0));
	expect(result).toStrictEqual([42]);
});

test("Arr.NonEmpty.concat - concatenates with standard array", () => {
	const result = pipe(Arr.NonEmpty.singleton(1), Arr.NonEmpty.concat([2, 3]));
	expect(result).toStrictEqual([1, 2, 3]);
	expectTypeOf(result).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("Arr.NonEmpty.reverse - reverses non-empty array", () => {
	const result = pipe([1, 2, 3] as Arr.NonEmpty<number>, Arr.NonEmpty.reverse);
	expect(result).toStrictEqual([3, 2, 1]);
	expectTypeOf(result).toEqualTypeOf<readonly [number, ...number[]]>();
});

test("Arr.NonEmpty pipe composition", () => {
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

test("Arr.partitionMaybe separates None inputs from Some outputs", () => {
	const parseNumber = (s: string) => (isNaN(Number(s)) ? Maybe.make.none() : Maybe.make.some(Number(s)));
	const [failures, successes] = pipe(["1", "abc", "3"], Arr.partitionMaybe(parseNumber));
	expect(failures).toStrictEqual(["abc"]);
	expect(successes).toStrictEqual([1, 3]);
});

// --- at ---

test("Arr.at looks up elements by positive and negative index", () => {
	expect(pipe([10, 20, 30], Arr.at(1))).toStrictEqual(Maybe.make.some(20));
	expect(pipe([10, 20, 30], Arr.at(-1))).toStrictEqual(Maybe.make.some(30));
	expect(pipe([10, 20, 30], Arr.at(5))).toStrictEqual(Maybe.make.none());
	expect(pipe([10, 20, 30], Arr.at(-5))).toStrictEqual(Maybe.make.none());
});

// --- findMap ---

test("Arr.findMap returns first Some transformed value", () => {
	const parseNumber = (s: string) => (isNaN(Number(s)) ? Maybe.make.none() : Maybe.make.some(Number(s)));
	expect(pipe(["a", "2", "3"], Arr.findMap(parseNumber))).toStrictEqual(Maybe.make.some(2));
	expect(pipe(["a", "b"], Arr.findMap(parseNumber))).toStrictEqual(Maybe.make.none());
});

// --- indexBy ---

test("Arr.indexBy indexes array elements into Map by key", () => {
	const users = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];
	const map = pipe(users, Arr.indexBy((u) => u.id));
	expect(map.get(1)).toStrictEqual({ id: 1, name: "Alice" });
	expect(map.get(2)).toStrictEqual({ id: 2, name: "Bob" });
});

// --- frequencies ---

test("Arr.frequencies counts element occurrences", () => {
	const map = Arr.frequencies(["a", "b", "a", "c", "b", "a"]);
	expect(map.get("a")).toBe(3);
	expect(map.get("b")).toBe(2);
	expect(map.get("c")).toBe(1);
});

// --- chunkBy ---

test("Arr.chunkBy groups consecutive elements by key", () => {
	const res = pipe([1, 1, 2, 3, 3, 1], Arr.chunkBy((n) => n));
	expect(res).toStrictEqual([[1, 1], [2], [3, 3], [1]]);
	expect(pipe([], Arr.chunkBy((n) => n))).toStrictEqual([]);
});

// --- dedupeAdjacent ---

test("Arr.dedupeAdjacent drops consecutive duplicate elements", () => {
	const res = Arr.dedupeAdjacent()([1, 1, 2, 2, 1, 3]);
	expect(res).toStrictEqual([1, 2, 1, 3]);
	expect(Arr.dedupeAdjacent()([])).toStrictEqual([]);
});

// --- windowed ---

test("Arr.windowed creates sliding windows with size and step", () => {
	expect(pipe([1, 2, 3, 4], Arr.windowed(2))).toStrictEqual([[1, 2], [2, 3], [3, 4]]);
	expect(pipe([1, 2, 3, 4], Arr.windowed(2, { step: 2 }))).toStrictEqual([[1, 2], [3, 4]]);
	expect(pipe([1, 2, 3, 4], Arr.windowed(0))).toStrictEqual([]);
	expect(pipe([1, 2, 3, 4], Arr.windowed(2, { step: 0 }))).toStrictEqual([]);
	expect(pipe([], Arr.windowed(2))).toStrictEqual([]);
});

// --- unfold ---

test("Arr.unfold generates array from seed until None", () => {
	const res = Arr.unfold(1, (n) => (n > 3 ? Maybe.make.none() : Maybe.make.some([n, n + 1])));
	expect(res).toStrictEqual([1, 2, 3]);
});
