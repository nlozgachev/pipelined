import { pipe } from "#composition/pipe.ts";
import { Maybe } from "#core/Maybe.ts";
import { Result } from "#core/Result.ts";
import { Task } from "#core/Task.ts";
import { expect, test } from "vitest";
import { Arr } from "../Arr.ts";

// =============================================================================
// Safe access: head, last, tail, init
// =============================================================================

test(
	"head - returns Some of the first element for a non-empty array",
	() => {
		const result = Arr.head([10, 20, 30]);
		expect(result).toEqual(Maybe.some(10));
	},
);

test("head - returns None for an empty array", () => {
	const result = Arr.head([]);
	expect(result).toEqual(Maybe.none());
});

test("head - returns Some for a single-element array", () => {
	const result = Arr.head(["only"]);
	expect(result).toEqual(Maybe.some("only"));
});

test(
	"last - returns Some of the last element for a non-empty array",
	() => {
		const result = Arr.last([10, 20, 30]);
		expect(result).toEqual(Maybe.some(30));
	},
);

test("last - returns None for an empty array", () => {
	const result = Arr.last([]);
	expect(result).toEqual(Maybe.none());
});

test("last - returns Some for a single-element array", () => {
	const result = Arr.last([42]);
	expect(result).toEqual(Maybe.some(42));
});

test("tail - returns Some of all elements except the first", () => {
	const result = Arr.tail([1, 2, 3]);
	expect(result).toEqual(Maybe.some([2, 3]));
});

test("tail - returns Some of empty array for single-element array", () => {
	const result = Arr.tail([1]);
	expect(result).toEqual(Maybe.some([]));
});

test("tail - returns None for an empty array", () => {
	const result = Arr.tail([]);
	expect(result).toEqual(Maybe.none());
});

test("init - returns Some of all elements except the last", () => {
	const result = Arr.init([1, 2, 3]);
	expect(result).toEqual(Maybe.some([1, 2]));
});

test("init - returns Some of empty array for single-element array", () => {
	const result = Arr.init([1]);
	expect(result).toEqual(Maybe.some([]));
});

test("init - returns None for an empty array", () => {
	const result = Arr.init([]);
	expect(result).toEqual(Maybe.none());
});

// =============================================================================
// Search: findFirst, findLast, findIndex
// =============================================================================

test("findFirst - returns Some of the first matching element", () => {
	const result = pipe(
		[1, 2, 3, 4, 5],
		Arr.findFirst((n) => n > 3),
	);
	expect(result).toEqual(Maybe.some(4));
});

test("findFirst - returns None when no element matches", () => {
	const result = pipe(
		[1, 2, 3],
		Arr.findFirst((n) => n > 10),
	);
	expect(result).toEqual(Maybe.none());
});

test("findFirst - returns None for an empty array", () => {
	const result = pipe(
		[] as number[],
		Arr.findFirst((n) => n > 0),
	);
	expect(result).toEqual(Maybe.none());
});

test("findFirst - returns Some(undefined) when undefined matches", () => {
	const result = pipe(
		[undefined, 1, 2] as (number | undefined)[],
		Arr.findFirst((x) => x === undefined),
	);
	expect(result).toEqual(Maybe.some(undefined));
});

test("findLast - returns Some of the last matching element", () => {
	const result = pipe(
		[1, 2, 3, 4, 5],
		Arr.findLast((n) => n > 2),
	);
	expect(result).toEqual(Maybe.some(5));
});

test("findLast - returns None when no element matches", () => {
	const result = pipe(
		[1, 2, 3],
		Arr.findLast((n) => n > 10),
	);
	expect(result).toEqual(Maybe.none());
});

test("findLast - returns None for an empty array", () => {
	const result = pipe(
		[] as number[],
		Arr.findLast((_) => true),
	);
	expect(result).toEqual(Maybe.none());
});

test("findLast - returns Some(undefined) when undefined matches", () => {
	const result = pipe(
		[1, undefined, 2, undefined] as (number | undefined)[],
		Arr.findLast((x) => x === undefined),
	);
	expect(result).toEqual(Maybe.some(undefined));
});

test("findIndex - returns Some of the index of the first match", () => {
	const result = pipe(
		[10, 20, 30, 40],
		Arr.findIndex((n) => n === 30),
	);
	expect(result).toEqual(Maybe.some(2));
});

test("findIndex - returns None when no element matches", () => {
	const result = pipe(
		[10, 20, 30],
		Arr.findIndex((n) => n === 99),
	);
	expect(result).toEqual(Maybe.none());
});

test("findIndex - returns None for an empty array", () => {
	const result = pipe(
		[] as number[],
		Arr.findIndex((_) => true),
	);
	expect(result).toEqual(Maybe.none());
});

// =============================================================================
// Transform: map, filter, partition, groupBy, uniq, uniqBy, sortBy
// =============================================================================

test("map - transforms each element", () => {
	const result = pipe(
		[1, 2, 3],
		Arr.map((n) => n * 10),
	);
	expect(result).toEqual([10, 20, 30]);
});

test("map - returns empty array for empty input", () => {
	const result = pipe(
		[] as number[],
		Arr.map((n) => n * 2),
	);
	expect(result).toEqual([]);
});

test("filter - keeps elements satisfying the predicate", () => {
	const result = pipe(
		[1, 2, 3, 4, 5],
		Arr.filter((n) => n % 2 === 0),
	);
	expect(result).toEqual([2, 4]);
});

test("filter - returns empty array when nothing matches", () => {
	const result = pipe(
		[1, 3, 5],
		Arr.filter((n) => n % 2 === 0),
	);
	expect(result).toEqual([]);
});

test("filter - returns empty array for empty input", () => {
	const result = pipe(
		[] as number[],
		Arr.filter((_) => true),
	);
	expect(result).toEqual([]);
});

test("partition - splits array into pass and fail groups", () => {
	const result = pipe(
		[1, 2, 3, 4, 5],
		Arr.partition((n) => n % 2 === 0),
	);
	expect(result).toEqual([
		[2, 4],
		[1, 3, 5],
	]);
});

test("partition - all elements pass", () => {
	const result = pipe(
		[2, 4, 6],
		Arr.partition((n) => n % 2 === 0),
	);
	expect(result).toEqual([[2, 4, 6], []]);
});

test("partition - no elements pass", () => {
	const result = pipe(
		[1, 3, 5],
		Arr.partition((n) => n % 2 === 0),
	);
	expect(result).toEqual([[], [1, 3, 5]]);
});

test("partition - empty array produces two empty arrays", () => {
	const result = pipe(
		[] as number[],
		Arr.partition((_) => true),
	);
	expect(result).toEqual([[], []]);
});

test("groupBy - groups elements by a key function", () => {
	const result = pipe(
		["apple", "avocado", "banana", "blueberry"],
		Arr.groupBy((s) => s[0]),
	);
	expect(result).toEqual({
		a: ["apple", "avocado"],
		b: ["banana", "blueberry"],
	});
});

test("groupBy - returns empty record for empty array", () => {
	const result = pipe(
		[] as string[],
		Arr.groupBy((s) => s),
	);
	expect(result).toEqual({});
});

test("groupBy - each element in its own group", () => {
	const result = pipe(
		[1, 2, 3],
		Arr.groupBy((n) => String(n)),
	);
	expect(result).toEqual({ "1": [1], "2": [2], "3": [3] });
});

test("uniq - removes duplicate elements", () => {
	const result = Arr.uniq([1, 2, 2, 3, 1, 3, 4]);
	expect(result).toEqual([1, 2, 3, 4]);
});

test("uniq - returns same for array with no duplicates", () => {
	const result = Arr.uniq([1, 2, 3]);
	expect(result).toEqual([1, 2, 3]);
});

test("uniq - returns empty for empty array", () => {
	const result = Arr.uniq([]);
	expect(result).toEqual([]);
});

test("uniq - preserves order of first occurrences", () => {
	const result = Arr.uniq([3, 1, 2, 1, 3]);
	expect(result).toEqual([3, 1, 2]);
});

test("uniqBy - removes duplicates by key function", () => {
	const items = [
		{ id: 1, name: "a" },
		{ id: 1, name: "b" },
		{ id: 2, name: "c" },
	];
	const result = pipe(
		items,
		Arr.uniqBy((x) => x.id),
	);
	expect(result).toEqual([
		{ id: 1, name: "a" },
		{ id: 2, name: "c" },
	]);
});

test("uniqBy - returns empty for empty array", () => {
	const result = pipe(
		[] as { id: number; }[],
		Arr.uniqBy((x) => x.id),
	);
	expect(result).toEqual([]);
});

test("sortBy - sorts array using comparison function", () => {
	const result = pipe(
		[3, 1, 4, 1, 5, 9],
		Arr.sortBy((a, b) => a - b),
	);
	expect(result).toEqual([1, 1, 3, 4, 5, 9]);
});

test("sortBy - sorts in descending order", () => {
	const result = pipe(
		[3, 1, 2],
		Arr.sortBy((a, b) => b - a),
	);
	expect(result).toEqual([3, 2, 1]);
});

test("sortBy - does not mutate the original array", () => {
	const original = [3, 1, 2];
	pipe(
		original,
		Arr.sortBy((a, b) => a - b),
	);
	expect(original).toEqual([3, 1, 2]);
});

test("sortBy - returns empty for empty array", () => {
	const result = pipe(
		[] as number[],
		Arr.sortBy((a, b) => a - b),
	);
	expect(result).toEqual([]);
});

// =============================================================================
// Combine: zip, zipWith, intersperse, chunksOf, flatten, flatMap
// =============================================================================

test("zip - pairs elements from two arrays", () => {
	const result = pipe([1, 2, 3], Arr.zip(["a", "b", "c"]));
	expect(result).toEqual([
		[1, "a"],
		[2, "b"],
		[3, "c"],
	]);
});

test("zip - stops at the shorter array (first shorter)", () => {
	const result = pipe([1, 2], Arr.zip(["a", "b", "c"]));
	expect(result).toEqual([
		[1, "a"],
		[2, "b"],
	]);
});

test("zip - stops at the shorter array (second shorter)", () => {
	const result = pipe([1, 2, 3], Arr.zip(["a", "b"]));
	expect(result).toEqual([
		[1, "a"],
		[2, "b"],
	]);
});

test("zip - returns empty when first array is empty", () => {
	const result = pipe([] as number[], Arr.zip(["a", "b"]));
	expect(result).toEqual([]);
});

test("zip - returns empty when second array is empty", () => {
	const result = pipe([1, 2], Arr.zip([] as string[]));
	expect(result).toEqual([]);
});

test("zipWith - combines elements using a function", () => {
	const result = pipe(
		[1, 2, 3],
		Arr.zipWith((a, b) => `${a}${b}`)(["a", "b", "c"]),
	);
	expect(result).toEqual(["1a", "2b", "3c"]);
});

test("zipWith - stops at the shorter array", () => {
	const result = pipe(
		[1, 2, 3],
		Arr.zipWith((a: number, b: number) => a + b)([10, 20]),
	);
	expect(result).toEqual([11, 22]);
});

test("zipWith - returns empty for empty input", () => {
	const result = pipe(
		[] as number[],
		Arr.zipWith((a: number, b: number) => a + b)([10, 20]),
	);
	expect(result).toEqual([]);
});

test("intersperse - inserts separator between elements", () => {
	const result = pipe([1, 2, 3], Arr.intersperse(0));
	expect(result).toEqual([1, 0, 2, 0, 3]);
});

test("intersperse - single-element array returns unchanged", () => {
	const result = pipe([42], Arr.intersperse(0));
	expect(result).toEqual([42]);
});

test("intersperse - empty array returns empty array", () => {
	const result = pipe([] as number[], Arr.intersperse(0));
	expect(result).toEqual([]);
});

test("intersperse - with string separator", () => {
	const result = pipe(["a", "b", "c"], Arr.intersperse("-"));
	expect(result).toEqual(["a", "-", "b", "-", "c"]);
});

test("chunksOf - splits array into chunks of given size", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.chunksOf(2));
	expect(result).toEqual([[1, 2], [3, 4], [5]]);
});

test("chunksOf - exact division", () => {
	const result = pipe([1, 2, 3, 4, 5, 6], Arr.chunksOf(3));
	expect(result).toEqual([
		[1, 2, 3],
		[4, 5, 6],
	]);
});

test("chunksOf - chunk size larger than array", () => {
	const result = pipe([1, 2], Arr.chunksOf(5));
	expect(result).toEqual([[1, 2]]);
});

test("chunksOf - chunk size of 1", () => {
	const result = pipe([1, 2, 3], Arr.chunksOf(1));
	expect(result).toEqual([[1], [2], [3]]);
});

test("chunksOf(0) - returns empty array", () => {
	const result = pipe([1, 2, 3], Arr.chunksOf(0));
	expect(result).toEqual([]);
});

test("chunksOf - negative size returns empty array", () => {
	const result = pipe([1, 2, 3], Arr.chunksOf(-1));
	expect(result).toEqual([]);
});

test("chunksOf - empty array returns empty array", () => {
	const result = pipe([] as number[], Arr.chunksOf(3));
	expect(result).toEqual([]);
});

test("flatten - flattens one level of nesting", () => {
	const result = Arr.flatten([[1, 2], [3], [4, 5]]);
	expect(result).toEqual([1, 2, 3, 4, 5]);
});

test("flatten - with empty subarrays", () => {
	const result = Arr.flatten([[1], [], [2, 3], []]);
	expect(result).toEqual([1, 2, 3]);
});

test("flatten - empty outer array", () => {
	const result = Arr.flatten([] as number[][]);
	expect(result).toEqual([]);
});

test("flatMap - maps and flattens", () => {
	const result = pipe(
		[1, 2, 3],
		Arr.flatMap((n) => [n, n * 10]),
	);
	expect(result).toEqual([1, 10, 2, 20, 3, 30]);
});

test("flatMap - returning empty arrays filters elements", () => {
	const result = pipe(
		[1, 2, 3, 4],
		Arr.flatMap((n) => (n % 2 === 0 ? [n] : [])),
	);
	expect(result).toEqual([2, 4]);
});

test("flatMap - empty array returns empty array", () => {
	const result = pipe(
		[] as number[],
		Arr.flatMap((n) => [n, n]),
	);
	expect(result).toEqual([]);
});

// =============================================================================
// Reduce
// =============================================================================

test("reduce - sums numbers", () => {
	const result = pipe(
		[1, 2, 3, 4],
		Arr.reduce(0, (acc, n) => acc + n),
	);
	expect(result).toBe(10);
});

test("reduce - concatenates strings", () => {
	const result = pipe(
		["a", "b", "c"],
		Arr.reduce("", (acc, s) => acc + s),
	);
	expect(result).toBe("abc");
});

test("reduce - returns initial value for empty array", () => {
	const result = pipe(
		[] as number[],
		Arr.reduce(42, (acc, n) => acc + n),
	);
	expect(result).toBe(42);
});

test("reduce - builds an object from entries", () => {
	const result = pipe(
		[
			["a", 1],
			["b", 2],
			["c", 3],
		] as [string, number][],
		Arr.reduce({} as Record<string, number>, (acc, [k, v]) => ({
			...acc,
			[k]: v,
		})),
	);
	expect(result).toEqual({ a: 1, b: 2, c: 3 });
});

// =============================================================================
// Traverse / Sequence (Option)
// =============================================================================

test("traverse - all Some results in Some of array", () => {
	const parseNum = (s: string): Maybe<number> => {
		const n = Number(s);
		return isNaN(n) ? Maybe.none() : Maybe.some(n);
	};
	const result = pipe(["1", "2", "3"], Arr.traverse(parseNum));
	expect(result).toEqual(Maybe.some([1, 2, 3]));
});

test("traverse - any None results in None", () => {
	const parseNum = (s: string): Maybe<number> => {
		const n = Number(s);
		return isNaN(n) ? Maybe.none() : Maybe.some(n);
	};
	const result = pipe(["1", "x", "3"], Arr.traverse(parseNum));
	expect(result).toEqual(Maybe.none());
});

test("traverse - empty array results in Some of empty array", () => {
	const result = pipe(
		[] as string[],
		Arr.traverse((s) => Maybe.some(s)),
	);
	expect(result).toEqual(Maybe.some([]));
});

test("traverse - fails at first None and short-circuits", () => {
	let callCount = 0;
	const f = (n: number): Maybe<number> => {
		callCount++;
		return n > 0 ? Maybe.some(n) : Maybe.none();
	};
	const result = pipe([1, 0, 2, 3], Arr.traverse(f));
	expect(result).toEqual(Maybe.none());
	expect(callCount).toBe(2);
});

test("sequence - all Some results in Some of array", () => {
	const result = Arr.sequence([Maybe.some(1), Maybe.some(2), Maybe.some(3)]);
	expect(result).toEqual(Maybe.some([1, 2, 3]));
});

test("sequence - any None results in None", () => {
	const result = Arr.sequence([Maybe.some(1), Maybe.none(), Maybe.some(3)]);
	expect(result).toEqual(Maybe.none());
});

test("sequence - empty array results in Some of empty array", () => {
	const result = Arr.sequence([] as Maybe<number>[]);
	expect(result).toEqual(Maybe.some([]));
});

// =============================================================================
// Traverse / Sequence (Result)
// =============================================================================

test("traverseResult - all Ok results in Ok of array", () => {
	const validate = (n: number): Result<string, number> => n > 0 ? Result.ok(n) : Result.err("not positive");
	const result = pipe([1, 2, 3], Arr.traverseResult(validate));
	expect(result).toEqual(Result.ok([1, 2, 3]));
});

test("traverseResult - first Err is returned", () => {
	const validate = (n: number): Result<string, number> => n > 0 ? Result.ok(n) : Result.err(`${n} is not positive`);
	const result = pipe([1, -2, -3], Arr.traverseResult(validate));
	expect(result).toEqual(Result.err("-2 is not positive"));
});

test("traverseResult - empty array results in Ok of empty array", () => {
	const result = pipe(
		[] as number[],
		Arr.traverseResult((n) => Result.ok(n)),
	);
	expect(result).toEqual(Result.ok([]));
});

test("traverseResult - short-circuits at first Err", () => {
	let callCount = 0;
	const f = (n: number): Result<string, number> => {
		callCount++;
		return n > 0 ? Result.ok(n) : Result.err("bad");
	};
	pipe([1, 0, 2, 3], Arr.traverseResult(f));
	expect(callCount).toBe(2);
});

test("sequenceResult - all Ok results in Ok of array", () => {
	const result = Arr.sequenceResult([Result.ok(1), Result.ok(2), Result.ok(3)]);
	expect(result).toEqual(Result.ok([1, 2, 3]));
});

test("sequenceResult - first Err is returned", () => {
	const result = Arr.sequenceResult([
		Result.ok(1),
		Result.err("oops"),
		Result.ok(3),
	]);
	expect(result).toEqual(Result.err("oops"));
});

test("sequenceResult - empty array results in Ok of empty array", () => {
	const result = Arr.sequenceResult([] as Result<string, number>[]);
	expect(result).toEqual(Result.ok([]));
});

// =============================================================================
// Traverse / Sequence (Task - async)
// =============================================================================

test(
	"traverseTask - maps elements to tasks and runs in parallel",
	async () => {
		const result = await pipe(
			[1, 2, 3],
			Arr.traverseTask((n) => Task.resolve(n * 10)),
		)();
		expect(result).toEqual([10, 20, 30]);
	},
);

test("traverseTask - empty array resolves to empty array", async () => {
	const result = await pipe(
		[] as number[],
		Arr.traverseTask((n) => Task.resolve(n)),
	)();
	expect(result).toEqual([]);
});

test("traverseTask - handles async operations", async () => {
	const delayedDouble = (n: number): Task<number> =>
		Task.from(
			() => new Promise<number>((resolve) => setTimeout(() => resolve(n * 2), 10)),
		);

	const result = await pipe([1, 2, 3], Arr.traverseTask(delayedDouble))();
	expect(result).toEqual([2, 4, 6]);
});

test(
	"sequenceTask - runs all tasks in parallel and collects results",
	async () => {
		const tasks: Task<number>[] = [
			Task.resolve(10),
			Task.resolve(20),
			Task.resolve(30),
		];
		const result = await Arr.sequenceTask(tasks)();
		expect(result).toEqual([10, 20, 30]);
	},
);

test("sequenceTask - empty array resolves to empty array", async () => {
	const result = await Arr.sequenceTask([] as Task<number>[])();
	expect(result).toEqual([]);
});

test(
	"sequenceTask - preserves order despite different completion times",
	async () => {
		const tasks: Task<string>[] = [
			Task.from(
				() => new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 30)),
			),
			Task.from(
				() => new Promise<string>((resolve) => setTimeout(() => resolve("fast"), 5)),
			),
			Task.from(
				() => new Promise<string>((resolve) => setTimeout(() => resolve("medium"), 15)),
			),
		];
		const result = await Arr.sequenceTask(tasks)();
		expect(result).toEqual(["slow", "fast", "medium"]);
	},
);

// =============================================================================
// traverseTaskResult / sequenceTaskResult
// =============================================================================

test("traverseTaskResult - all succeed returns Ok of results", async () => {
	const validate = (n: number): Task<Result<string, number>> =>
		n > 0 ? Task.resolve(Result.ok(n)) : Task.resolve(Result.err("non-positive"));
	const result = await pipe([1, 2, 3], Arr.traverseTaskResult(validate))();
	expect(result).toEqual(Result.ok([1, 2, 3]));
});

test("traverseTaskResult - first error short-circuits", async () => {
	const order: number[] = [];
	const validate = (n: number): Task<Result<string, number>> =>
		Task.from(() => {
			order.push(n);
			return Promise.resolve(n > 0 ? Result.ok(n) : Result.err("non-positive"));
		});
	const result = await pipe([1, -1, 3], Arr.traverseTaskResult(validate))();
	expect(result).toEqual(Result.err("non-positive"));
	expect(order).toEqual([1, -1]); // 3 was not processed
});

test("traverseTaskResult - empty array returns Ok of empty array", async () => {
	const result = await Arr.traverseTaskResult((n: number) => Task.resolve(Result.ok(n)))([])();
	expect(result).toEqual(Result.ok([]));
});

test("sequenceTaskResult - collects Ok results", async () => {
	const tasks: Task<Result<string, number>>[] = [
		Task.resolve(Result.ok(10)),
		Task.resolve(Result.ok(20)),
	];
	const result = await Arr.sequenceTaskResult(tasks)();
	expect(result).toEqual(Result.ok([10, 20]));
});

test("sequenceTaskResult - returns first Err", async () => {
	const tasks: Task<Result<string, number>>[] = [
		Task.resolve(Result.ok(10)),
		Task.resolve(Result.err("oops")),
		Task.resolve(Result.ok(30)),
	];
	const result = await Arr.sequenceTaskResult(tasks)();
	expect(result).toEqual(Result.err("oops"));
});

// =============================================================================
// Predicates: isNonEmpty, some, every
// =============================================================================

test("isNonEmpty - returns true for non-empty array", () => {
	expect(Arr.isNonEmpty([1, 2, 3])).toBe(true);
});

test("isNonEmpty - returns false for empty array", () => {
	expect(Arr.isNonEmpty([])).toBe(false);
});

test("isNonEmpty - returns true for single-element array", () => {
	expect(Arr.isNonEmpty([undefined])).toBe(true);
});

test("some - returns true when at least one element matches", () => {
	const result = pipe(
		[1, 2, 3, 4],
		Arr.some((n) => n > 3),
	);
	expect(result).toBe(true);
});

test("some - returns false when no element matches", () => {
	const result = pipe(
		[1, 2, 3],
		Arr.some((n) => n > 10),
	);
	expect(result).toBe(false);
});

test("some - returns false for empty array", () => {
	const result = pipe(
		[] as number[],
		Arr.some((_) => true),
	);
	expect(result).toBe(false);
});

test("every - returns true when all elements match", () => {
	const result = pipe(
		[2, 4, 6],
		Arr.every((n) => n % 2 === 0),
	);
	expect(result).toBe(true);
});

test("every - returns false when any element does not match", () => {
	const result = pipe(
		[2, 3, 6],
		Arr.every((n) => n % 2 === 0),
	);
	expect(result).toBe(false);
});

test("every - returns true for empty array (vacuous truth)", () => {
	const result = pipe(
		[] as number[],
		Arr.every((_) => false),
	);
	expect(result).toBe(true);
});

// =============================================================================
// Slicing: reverse, take, drop, takeWhile, dropWhile
// =============================================================================

test("reverse - reverses elements", () => {
	const result = Arr.reverse([1, 2, 3]);
	expect(result).toEqual([3, 2, 1]);
});

test("reverse - does not mutate the original array", () => {
	const original = [1, 2, 3];
	Arr.reverse(original);
	expect(original).toEqual([1, 2, 3]);
});

test("reverse - returns empty for empty array", () => {
	expect(Arr.reverse([])).toEqual([]);
});

test("reverse - single element returns same", () => {
	expect(Arr.reverse([42])).toEqual([42]);
});

// =============================================================================
// insertAt
// =============================================================================

test("insertAt - inserts at start", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(0, 99))).toEqual([99, 1, 2, 3]);
});

test("insertAt - inserts in middle", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(1, 99))).toEqual([1, 99, 2, 3]);
});

test("insertAt - inserts at end", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(3, 99))).toEqual([1, 2, 3, 99]);
});

test("insertAt - clamps negative index to 0", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(-5, 99))).toEqual([99, 1, 2, 3]);
});

test("insertAt - clamps over-length index to end", () => {
	expect(pipe([1, 2, 3], Arr.insertAt(100, 99))).toEqual([1, 2, 3, 99]);
});

test("insertAt - inserts into empty array", () => {
	expect(pipe([] as number[], Arr.insertAt(0, 99))).toEqual([99]);
});

test("insertAt - does not mutate the original array", () => {
	const original = [1, 2, 3];
	pipe(original, Arr.insertAt(1, 99));
	expect(original).toEqual([1, 2, 3]);
});

// =============================================================================
// removeAt
// =============================================================================

test("removeAt - removes at start", () => {
	expect(pipe([1, 2, 3], Arr.removeAt(0))).toEqual([2, 3]);
});

test("removeAt - removes in middle", () => {
	expect(pipe([1, 2, 3], Arr.removeAt(1))).toEqual([1, 3]);
});

test("removeAt - removes at end", () => {
	expect(pipe([1, 2, 3], Arr.removeAt(2))).toEqual([1, 2]);
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
	expect(pipe([42], Arr.removeAt(0))).toEqual([]);
});

test("removeAt - does not mutate the original array", () => {
	const original = [1, 2, 3];
	pipe(original, Arr.removeAt(1));
	expect(original).toEqual([1, 2, 3]);
});

test("take - takes first n elements", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.take(3));
	expect(result).toEqual([1, 2, 3]);
});

test("take - takes all when n exceeds length", () => {
	const result = pipe([1, 2], Arr.take(10));
	expect(result).toEqual([1, 2]);
});

test("take(0) - returns empty array", () => {
	const result = pipe([1, 2, 3], Arr.take(0));
	expect(result).toEqual([]);
});

test("take - negative n returns empty array", () => {
	const result = pipe([1, 2, 3], Arr.take(-1));
	expect(result).toEqual([]);
});

test("drop - drops first n elements", () => {
	const result = pipe([1, 2, 3, 4, 5], Arr.drop(2));
	expect(result).toEqual([3, 4, 5]);
});

test("drop - drops all when n exceeds length", () => {
	const result = pipe([1, 2], Arr.drop(10));
	expect(result).toEqual([]);
});

test("drop(0) - returns entire array", () => {
	const result = pipe([1, 2, 3], Arr.drop(0));
	expect(result).toEqual([1, 2, 3]);
});

test("takeWhile - takes elements while predicate holds", () => {
	const result = pipe(
		[1, 2, 3, 4, 1],
		Arr.takeWhile((n) => n < 3),
	);
	expect(result).toEqual([1, 2]);
});

test("takeWhile - takes nothing when first element fails", () => {
	const result = pipe(
		[5, 1, 2],
		Arr.takeWhile((n) => n < 3),
	);
	expect(result).toEqual([]);
});

test("takeWhile - takes all when all pass", () => {
	const result = pipe(
		[1, 2, 3],
		Arr.takeWhile((n) => n < 10),
	);
	expect(result).toEqual([1, 2, 3]);
});

test("takeWhile - empty array returns empty", () => {
	const result = pipe(
		[] as number[],
		Arr.takeWhile((_) => true),
	);
	expect(result).toEqual([]);
});

test("dropWhile - drops elements while predicate holds", () => {
	const result = pipe(
		[1, 2, 3, 4, 1],
		Arr.dropWhile((n) => n < 3),
	);
	expect(result).toEqual([3, 4, 1]);
});

test("dropWhile - drops nothing when first element fails", () => {
	const result = pipe(
		[5, 1, 2],
		Arr.dropWhile((n) => n < 3),
	);
	expect(result).toEqual([5, 1, 2]);
});

test("dropWhile - drops all when all pass", () => {
	const result = pipe(
		[1, 2, 3],
		Arr.dropWhile((n) => n < 10),
	);
	expect(result).toEqual([]);
});

test("dropWhile - empty array returns empty", () => {
	const result = pipe(
		[] as number[],
		Arr.dropWhile((_) => true),
	);
	expect(result).toEqual([]);
});

// =============================================================================
// scan
// =============================================================================

test("scan - returns running totals of a sum", () => {
	expect(pipe([1, 2, 3], Arr.scan(0, (acc, n) => acc + n))).toEqual([1, 3, 6]);
});

test("scan - returns empty array for empty input", () => {
	expect(pipe([], Arr.scan(0, (acc: number, n: number) => acc + n))).toEqual([]);
});

test("scan - does not include the initial value in output", () => {
	expect(pipe([5], Arr.scan(100, (acc, n) => acc + n))).toEqual([105]);
});

test("scan - output length equals input length", () => {
	const result = pipe([1, 2, 3, 4], Arr.scan(0, (acc, n) => acc + n));
	expect(result).toHaveLength(4);
});

test("scan - works with non-numeric accumulators", () => {
	expect(pipe(["a", "b", "c"], Arr.scan("", (acc, s) => acc + s))).toEqual(["a", "ab", "abc"]);
});

// =============================================================================
// splitAt
// =============================================================================

test("splitAt - splits array at a given index", () => {
	expect(pipe([1, 2, 3, 4], Arr.splitAt(2))).toEqual([[1, 2], [3, 4]]);
});

test("splitAt - index 0 gives empty before and full after", () => {
	expect(pipe([1, 2, 3], Arr.splitAt(0))).toEqual([[], [1, 2, 3]]);
});

test("splitAt - index equal to length gives full before and empty after", () => {
	expect(pipe([1, 2, 3], Arr.splitAt(3))).toEqual([[1, 2, 3], []]);
});

test("splitAt - index beyond length clamps to end", () => {
	expect(pipe([1, 2], Arr.splitAt(10))).toEqual([[1, 2], []]);
});

test("splitAt - negative index clamps to 0", () => {
	expect(pipe([1, 2, 3], Arr.splitAt(-5))).toEqual([[], [1, 2, 3]]);
});

test("splitAt - empty array returns two empty arrays", () => {
	expect(pipe([], Arr.splitAt(2))).toEqual([[], []]);
});

// =============================================================================
// Size
// =============================================================================

test("size - returns length of array", () => {
	expect(Arr.size([1, 2, 3])).toBe(3);
});

test("size - returns 0 for empty array", () => {
	expect(Arr.size([])).toBe(0);
});

test("size - returns 1 for single-element array", () => {
	expect(Arr.size(["only"])).toBe(1);
});

// =============================================================================
// Composition with pipe
// =============================================================================

test("pipe composition - filter, map, head", () => {
	const result = pipe(
		[1, 2, 3, 4, 5],
		Arr.filter((n) => n > 2),
		Arr.map((n) => n * 10),
		Arr.head,
	);
	expect(result).toEqual(Maybe.some(30));
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
	const result = pipe(
		[1, 2, 3],
		Arr.flatMap((n) => [n, n + 1]),
		Arr.uniq,
		Arr.sortBy((a, b) => a - b),
	);
	expect(result).toEqual([1, 2, 3, 4]);
});
