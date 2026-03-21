import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Arr } from "../Arr.ts";
import { Option } from "../Option.ts";
import { Result } from "../Result.ts";
import { Task } from "../Task.ts";
import { pipe } from "../../Composition/pipe.ts";

// =============================================================================
// Safe access: head, last, tail, init
// =============================================================================

Deno.test(
  "head - returns Some of the first element for a non-empty array",
  () => {
    const result = Arr.head([10, 20, 30]);
    assertEquals(result, Option.some(10));
  },
);

Deno.test("head - returns None for an empty array", () => {
  const result = Arr.head([]);
  assertEquals(result, Option.none());
});

Deno.test("head - returns Some for a single-element array", () => {
  const result = Arr.head(["only"]);
  assertEquals(result, Option.some("only"));
});

Deno.test(
  "last - returns Some of the last element for a non-empty array",
  () => {
    const result = Arr.last([10, 20, 30]);
    assertEquals(result, Option.some(30));
  },
);

Deno.test("last - returns None for an empty array", () => {
  const result = Arr.last([]);
  assertEquals(result, Option.none());
});

Deno.test("last - returns Some for a single-element array", () => {
  const result = Arr.last([42]);
  assertEquals(result, Option.some(42));
});

Deno.test("tail - returns Some of all elements except the first", () => {
  const result = Arr.tail([1, 2, 3]);
  assertEquals(result, Option.some([2, 3]));
});

Deno.test("tail - returns Some of empty array for single-element array", () => {
  const result = Arr.tail([1]);
  assertEquals(result, Option.some([]));
});

Deno.test("tail - returns None for an empty array", () => {
  const result = Arr.tail([]);
  assertEquals(result, Option.none());
});

Deno.test("init - returns Some of all elements except the last", () => {
  const result = Arr.init([1, 2, 3]);
  assertEquals(result, Option.some([1, 2]));
});

Deno.test("init - returns Some of empty array for single-element array", () => {
  const result = Arr.init([1]);
  assertEquals(result, Option.some([]));
});

Deno.test("init - returns None for an empty array", () => {
  const result = Arr.init([]);
  assertEquals(result, Option.none());
});

// =============================================================================
// Search: findFirst, findLast, findIndex
// =============================================================================

Deno.test("findFirst - returns Some of the first matching element", () => {
  const result = pipe(
    [1, 2, 3, 4, 5],
    Arr.findFirst((n) => n > 3),
  );
  assertEquals(result, Option.some(4));
});

Deno.test("findFirst - returns None when no element matches", () => {
  const result = pipe(
    [1, 2, 3],
    Arr.findFirst((n) => n > 10),
  );
  assertEquals(result, Option.none());
});

Deno.test("findFirst - returns None for an empty array", () => {
  const result = pipe(
    [] as number[],
    Arr.findFirst((n) => n > 0),
  );
  assertEquals(result, Option.none());
});

Deno.test("findFirst - returns Some(undefined) when undefined matches", () => {
  const result = pipe(
    [undefined, 1, 2] as (number | undefined)[],
    Arr.findFirst((x) => x === undefined),
  );
  assertEquals(result, Option.some(undefined));
});

Deno.test("findLast - returns Some of the last matching element", () => {
  const result = pipe(
    [1, 2, 3, 4, 5],
    Arr.findLast((n) => n > 2),
  );
  assertEquals(result, Option.some(5));
});

Deno.test("findLast - returns None when no element matches", () => {
  const result = pipe(
    [1, 2, 3],
    Arr.findLast((n) => n > 10),
  );
  assertEquals(result, Option.none());
});

Deno.test("findLast - returns None for an empty array", () => {
  const result = pipe(
    [] as number[],
    Arr.findLast((_) => true),
  );
  assertEquals(result, Option.none());
});

Deno.test("findLast - returns Some(undefined) when undefined matches", () => {
  const result = pipe(
    [1, undefined, 2, undefined] as (number | undefined)[],
    Arr.findLast((x) => x === undefined),
  );
  assertEquals(result, Option.some(undefined));
});

Deno.test("findIndex - returns Some of the index of the first match", () => {
  const result = pipe(
    [10, 20, 30, 40],
    Arr.findIndex((n) => n === 30),
  );
  assertEquals(result, Option.some(2));
});

Deno.test("findIndex - returns None when no element matches", () => {
  const result = pipe(
    [10, 20, 30],
    Arr.findIndex((n) => n === 99),
  );
  assertEquals(result, Option.none());
});

Deno.test("findIndex - returns None for an empty array", () => {
  const result = pipe(
    [] as number[],
    Arr.findIndex((_) => true),
  );
  assertEquals(result, Option.none());
});

// =============================================================================
// Transform: map, filter, partition, groupBy, uniq, uniqBy, sortBy
// =============================================================================

Deno.test("map - transforms each element", () => {
  const result = pipe(
    [1, 2, 3],
    Arr.map((n) => n * 10),
  );
  assertEquals(result, [10, 20, 30]);
});

Deno.test("map - returns empty array for empty input", () => {
  const result = pipe(
    [] as number[],
    Arr.map((n) => n * 2),
  );
  assertEquals(result, []);
});

Deno.test("filter - keeps elements satisfying the predicate", () => {
  const result = pipe(
    [1, 2, 3, 4, 5],
    Arr.filter((n) => n % 2 === 0),
  );
  assertEquals(result, [2, 4]);
});

Deno.test("filter - returns empty array when nothing matches", () => {
  const result = pipe(
    [1, 3, 5],
    Arr.filter((n) => n % 2 === 0),
  );
  assertEquals(result, []);
});

Deno.test("filter - returns empty array for empty input", () => {
  const result = pipe(
    [] as number[],
    Arr.filter((_) => true),
  );
  assertEquals(result, []);
});

Deno.test("partition - splits array into pass and fail groups", () => {
  const result = pipe(
    [1, 2, 3, 4, 5],
    Arr.partition((n) => n % 2 === 0),
  );
  assertEquals(result, [
    [2, 4],
    [1, 3, 5],
  ]);
});

Deno.test("partition - all elements pass", () => {
  const result = pipe(
    [2, 4, 6],
    Arr.partition((n) => n % 2 === 0),
  );
  assertEquals(result, [[2, 4, 6], []]);
});

Deno.test("partition - no elements pass", () => {
  const result = pipe(
    [1, 3, 5],
    Arr.partition((n) => n % 2 === 0),
  );
  assertEquals(result, [[], [1, 3, 5]]);
});

Deno.test("partition - empty array produces two empty arrays", () => {
  const result = pipe(
    [] as number[],
    Arr.partition((_) => true),
  );
  assertEquals(result, [[], []]);
});

Deno.test("groupBy - groups elements by a key function", () => {
  const result = pipe(
    ["apple", "avocado", "banana", "blueberry"],
    Arr.groupBy((s) => s[0]),
  );
  assertEquals(result, {
    a: ["apple", "avocado"],
    b: ["banana", "blueberry"],
  });
});

Deno.test("groupBy - returns empty record for empty array", () => {
  const result = pipe(
    [] as string[],
    Arr.groupBy((s) => s),
  );
  assertEquals(result, {});
});

Deno.test("groupBy - each element in its own group", () => {
  const result = pipe(
    [1, 2, 3],
    Arr.groupBy((n) => String(n)),
  );
  assertEquals(result, { "1": [1], "2": [2], "3": [3] });
});

Deno.test("uniq - removes duplicate elements", () => {
  const result = Arr.uniq([1, 2, 2, 3, 1, 3, 4]);
  assertEquals(result, [1, 2, 3, 4]);
});

Deno.test("uniq - returns same for array with no duplicates", () => {
  const result = Arr.uniq([1, 2, 3]);
  assertEquals(result, [1, 2, 3]);
});

Deno.test("uniq - returns empty for empty array", () => {
  const result = Arr.uniq([]);
  assertEquals(result, []);
});

Deno.test("uniq - preserves order of first occurrences", () => {
  const result = Arr.uniq([3, 1, 2, 1, 3]);
  assertEquals(result, [3, 1, 2]);
});

Deno.test("uniqBy - removes duplicates by key function", () => {
  const items = [
    { id: 1, name: "a" },
    { id: 1, name: "b" },
    { id: 2, name: "c" },
  ];
  const result = pipe(
    items,
    Arr.uniqBy((x) => x.id),
  );
  assertEquals(result, [
    { id: 1, name: "a" },
    { id: 2, name: "c" },
  ]);
});

Deno.test("uniqBy - returns empty for empty array", () => {
  const result = pipe(
    [] as { id: number }[],
    Arr.uniqBy((x) => x.id),
  );
  assertEquals(result, []);
});

Deno.test("sortBy - sorts array using comparison function", () => {
  const result = pipe(
    [3, 1, 4, 1, 5, 9],
    Arr.sortBy((a, b) => a - b),
  );
  assertEquals(result, [1, 1, 3, 4, 5, 9]);
});

Deno.test("sortBy - sorts in descending order", () => {
  const result = pipe(
    [3, 1, 2],
    Arr.sortBy((a, b) => b - a),
  );
  assertEquals(result, [3, 2, 1]);
});

Deno.test("sortBy - does not mutate the original array", () => {
  const original = [3, 1, 2];
  pipe(
    original,
    Arr.sortBy((a, b) => a - b),
  );
  assertEquals(original, [3, 1, 2]);
});

Deno.test("sortBy - returns empty for empty array", () => {
  const result = pipe(
    [] as number[],
    Arr.sortBy((a, b) => a - b),
  );
  assertEquals(result, []);
});

// =============================================================================
// Combine: zip, zipWith, intersperse, chunksOf, flatten, flatMap
// =============================================================================

Deno.test("zip - pairs elements from two arrays", () => {
  const result = pipe([1, 2, 3], Arr.zip(["a", "b", "c"]));
  assertEquals(result, [
    [1, "a"],
    [2, "b"],
    [3, "c"],
  ]);
});

Deno.test("zip - stops at the shorter array (first shorter)", () => {
  const result = pipe([1, 2], Arr.zip(["a", "b", "c"]));
  assertEquals(result, [
    [1, "a"],
    [2, "b"],
  ]);
});

Deno.test("zip - stops at the shorter array (second shorter)", () => {
  const result = pipe([1, 2, 3], Arr.zip(["a", "b"]));
  assertEquals(result, [
    [1, "a"],
    [2, "b"],
  ]);
});

Deno.test("zip - returns empty when first array is empty", () => {
  const result = pipe([] as number[], Arr.zip(["a", "b"]));
  assertEquals(result, []);
});

Deno.test("zip - returns empty when second array is empty", () => {
  const result = pipe([1, 2], Arr.zip([] as string[]));
  assertEquals(result, []);
});

Deno.test("zipWith - combines elements using a function", () => {
  const result = pipe(
    [1, 2, 3],
    Arr.zipWith((a, b) => `${a}${b}`)(["a", "b", "c"]),
  );
  assertEquals(result, ["1a", "2b", "3c"]);
});

Deno.test("zipWith - stops at the shorter array", () => {
  const result = pipe(
    [1, 2, 3],
    Arr.zipWith((a: number, b: number) => a + b)([10, 20]),
  );
  assertEquals(result, [11, 22]);
});

Deno.test("zipWith - returns empty for empty input", () => {
  const result = pipe(
    [] as number[],
    Arr.zipWith((a: number, b: number) => a + b)([10, 20]),
  );
  assertEquals(result, []);
});

Deno.test("intersperse - inserts separator between elements", () => {
  const result = pipe([1, 2, 3], Arr.intersperse(0));
  assertEquals(result, [1, 0, 2, 0, 3]);
});

Deno.test("intersperse - single-element array returns unchanged", () => {
  const result = pipe([42], Arr.intersperse(0));
  assertEquals(result, [42]);
});

Deno.test("intersperse - empty array returns empty array", () => {
  const result = pipe([] as number[], Arr.intersperse(0));
  assertEquals(result, []);
});

Deno.test("intersperse - with string separator", () => {
  const result = pipe(["a", "b", "c"], Arr.intersperse("-"));
  assertEquals(result, ["a", "-", "b", "-", "c"]);
});

Deno.test("chunksOf - splits array into chunks of given size", () => {
  const result = pipe([1, 2, 3, 4, 5], Arr.chunksOf(2));
  assertEquals(result, [[1, 2], [3, 4], [5]]);
});

Deno.test("chunksOf - exact division", () => {
  const result = pipe([1, 2, 3, 4, 5, 6], Arr.chunksOf(3));
  assertEquals(result, [
    [1, 2, 3],
    [4, 5, 6],
  ]);
});

Deno.test("chunksOf - chunk size larger than array", () => {
  const result = pipe([1, 2], Arr.chunksOf(5));
  assertEquals(result, [[1, 2]]);
});

Deno.test("chunksOf - chunk size of 1", () => {
  const result = pipe([1, 2, 3], Arr.chunksOf(1));
  assertEquals(result, [[1], [2], [3]]);
});

Deno.test("chunksOf(0) - returns empty array", () => {
  const result = pipe([1, 2, 3], Arr.chunksOf(0));
  assertEquals(result, []);
});

Deno.test("chunksOf - negative size returns empty array", () => {
  const result = pipe([1, 2, 3], Arr.chunksOf(-1));
  assertEquals(result, []);
});

Deno.test("chunksOf - empty array returns empty array", () => {
  const result = pipe([] as number[], Arr.chunksOf(3));
  assertEquals(result, []);
});

Deno.test("flatten - flattens one level of nesting", () => {
  const result = Arr.flatten([[1, 2], [3], [4, 5]]);
  assertEquals(result, [1, 2, 3, 4, 5]);
});

Deno.test("flatten - with empty subarrays", () => {
  const result = Arr.flatten([[1], [], [2, 3], []]);
  assertEquals(result, [1, 2, 3]);
});

Deno.test("flatten - empty outer array", () => {
  const result = Arr.flatten([] as number[][]);
  assertEquals(result, []);
});

Deno.test("flatMap - maps and flattens", () => {
  const result = pipe(
    [1, 2, 3],
    Arr.flatMap((n) => [n, n * 10]),
  );
  assertEquals(result, [1, 10, 2, 20, 3, 30]);
});

Deno.test("flatMap - returning empty arrays filters elements", () => {
  const result = pipe(
    [1, 2, 3, 4],
    Arr.flatMap((n) => (n % 2 === 0 ? [n] : [])),
  );
  assertEquals(result, [2, 4]);
});

Deno.test("flatMap - empty array returns empty array", () => {
  const result = pipe(
    [] as number[],
    Arr.flatMap((n) => [n, n]),
  );
  assertEquals(result, []);
});

// =============================================================================
// Reduce
// =============================================================================

Deno.test("reduce - sums numbers", () => {
  const result = pipe(
    [1, 2, 3, 4],
    Arr.reduce(0, (acc, n) => acc + n),
  );
  assertStrictEquals(result, 10);
});

Deno.test("reduce - concatenates strings", () => {
  const result = pipe(
    ["a", "b", "c"],
    Arr.reduce("", (acc, s) => acc + s),
  );
  assertStrictEquals(result, "abc");
});

Deno.test("reduce - returns initial value for empty array", () => {
  const result = pipe(
    [] as number[],
    Arr.reduce(42, (acc, n) => acc + n),
  );
  assertStrictEquals(result, 42);
});

Deno.test("reduce - builds an object from entries", () => {
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
  assertEquals(result, { a: 1, b: 2, c: 3 });
});

// =============================================================================
// Traverse / Sequence (Option)
// =============================================================================

Deno.test("traverse - all Some results in Some of array", () => {
  const parseNum = (s: string): Option<number> => {
    const n = Number(s);
    return isNaN(n) ? Option.none() : Option.some(n);
  };
  const result = pipe(["1", "2", "3"], Arr.traverse(parseNum));
  assertEquals(result, Option.some([1, 2, 3]));
});

Deno.test("traverse - any None results in None", () => {
  const parseNum = (s: string): Option<number> => {
    const n = Number(s);
    return isNaN(n) ? Option.none() : Option.some(n);
  };
  const result = pipe(["1", "x", "3"], Arr.traverse(parseNum));
  assertEquals(result, Option.none());
});

Deno.test("traverse - empty array results in Some of empty array", () => {
  const result = pipe(
    [] as string[],
    Arr.traverse((s) => Option.some(s)),
  );
  assertEquals(result, Option.some([]));
});

Deno.test("traverse - fails at first None and short-circuits", () => {
  let callCount = 0;
  const f = (n: number): Option<number> => {
    callCount++;
    return n > 0 ? Option.some(n) : Option.none();
  };
  const result = pipe([1, 0, 2, 3], Arr.traverse(f));
  assertEquals(result, Option.none());
  assertStrictEquals(callCount, 2);
});

Deno.test("sequence - all Some results in Some of array", () => {
  const result = Arr.sequence([Option.some(1), Option.some(2), Option.some(3)]);
  assertEquals(result, Option.some([1, 2, 3]));
});

Deno.test("sequence - any None results in None", () => {
  const result = Arr.sequence([Option.some(1), Option.none(), Option.some(3)]);
  assertEquals(result, Option.none());
});

Deno.test("sequence - empty array results in Some of empty array", () => {
  const result = Arr.sequence([] as Option<number>[]);
  assertEquals(result, Option.some([]));
});

// =============================================================================
// Traverse / Sequence (Result)
// =============================================================================

Deno.test("traverseResult - all Ok results in Ok of array", () => {
  const validate = (n: number): Result<string, number> =>
    n > 0 ? Result.ok(n) : Result.err("not positive");
  const result = pipe([1, 2, 3], Arr.traverseResult(validate));
  assertEquals(result, Result.ok([1, 2, 3]));
});

Deno.test("traverseResult - first Err is returned", () => {
  const validate = (n: number): Result<string, number> =>
    n > 0 ? Result.ok(n) : Result.err(`${n} is not positive`);
  const result = pipe([1, -2, -3], Arr.traverseResult(validate));
  assertEquals(result, Result.err("-2 is not positive"));
});

Deno.test("traverseResult - empty array results in Ok of empty array", () => {
  const result = pipe(
    [] as number[],
    Arr.traverseResult((n) => Result.ok(n)),
  );
  assertEquals(result, Result.ok([]));
});

Deno.test("traverseResult - short-circuits at first Err", () => {
  let callCount = 0;
  const f = (n: number): Result<string, number> => {
    callCount++;
    return n > 0 ? Result.ok(n) : Result.err("bad");
  };
  pipe([1, 0, 2, 3], Arr.traverseResult(f));
  assertStrictEquals(callCount, 2);
});

Deno.test("sequenceResult - all Ok results in Ok of array", () => {
  const result = Arr.sequenceResult([Result.ok(1), Result.ok(2), Result.ok(3)]);
  assertEquals(result, Result.ok([1, 2, 3]));
});

Deno.test("sequenceResult - first Err is returned", () => {
  const result = Arr.sequenceResult([
    Result.ok(1),
    Result.err("oops"),
    Result.ok(3),
  ]);
  assertEquals(result, Result.err("oops"));
});

Deno.test("sequenceResult - empty array results in Ok of empty array", () => {
  const result = Arr.sequenceResult([] as Result<string, number>[]);
  assertEquals(result, Result.ok([]));
});

// =============================================================================
// Traverse / Sequence (Task - async)
// =============================================================================

Deno.test(
  "traverseTask - maps elements to tasks and runs in parallel",
  async () => {
    const result = await pipe(
      [1, 2, 3],
      Arr.traverseTask((n) => Task.resolve(n * 10)),
    )();
    assertEquals(result, [10, 20, 30]);
  },
);

Deno.test("traverseTask - empty array resolves to empty array", async () => {
  const result = await pipe(
    [] as number[],
    Arr.traverseTask((n) => Task.resolve(n)),
  )();
  assertEquals(result, []);
});

Deno.test("traverseTask - handles async operations", async () => {
  const delayedDouble = (n: number): Task<number> =>
    Task.from(
      () => new Promise<number>((resolve) => setTimeout(() => resolve(n * 2), 10)),
    );

  const result = await pipe([1, 2, 3], Arr.traverseTask(delayedDouble))();
  assertEquals(result, [2, 4, 6]);
});

Deno.test(
  "sequenceTask - runs all tasks in parallel and collects results",
  async () => {
    const tasks: Task<number>[] = [
      Task.resolve(10),
      Task.resolve(20),
      Task.resolve(30),
    ];
    const result = await Arr.sequenceTask(tasks)();
    assertEquals(result, [10, 20, 30]);
  },
);

Deno.test("sequenceTask - empty array resolves to empty array", async () => {
  const result = await Arr.sequenceTask([] as Task<number>[])();
  assertEquals(result, []);
});

Deno.test(
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
    assertEquals(result, ["slow", "fast", "medium"]);
  },
);

// =============================================================================
// traverseTaskResult / sequenceTaskResult
// =============================================================================

Deno.test("traverseTaskResult - all succeed returns Ok of results", async () => {
  const validate = (n: number): Task<Result<string, number>> =>
    n > 0 ? Task.resolve(Result.ok(n)) : Task.resolve(Result.err("non-positive"));
  const result = await pipe([1, 2, 3], Arr.traverseTaskResult(validate))();
  assertEquals(result, Result.ok([1, 2, 3]));
});

Deno.test("traverseTaskResult - first error short-circuits", async () => {
  const order: number[] = [];
  const validate = (n: number): Task<Result<string, number>> =>
    Task.from(async () => {
      order.push(n);
      return n > 0 ? Result.ok(n) : Result.err("non-positive");
    });
  const result = await pipe([1, -1, 3], Arr.traverseTaskResult(validate))();
  assertEquals(result, Result.err("non-positive"));
  assertEquals(order, [1, -1]); // 3 was not processed
});

Deno.test("traverseTaskResult - empty array returns Ok of empty array", async () => {
  const result = await Arr.traverseTaskResult((n: number) => Task.resolve(Result.ok(n)))([])();
  assertEquals(result, Result.ok([]));
});

Deno.test("sequenceTaskResult - collects Ok results", async () => {
  const tasks: Task<Result<string, number>>[] = [
    Task.resolve(Result.ok(10)),
    Task.resolve(Result.ok(20)),
  ];
  const result = await Arr.sequenceTaskResult(tasks)();
  assertEquals(result, Result.ok([10, 20]));
});

Deno.test("sequenceTaskResult - returns first Err", async () => {
  const tasks: Task<Result<string, number>>[] = [
    Task.resolve(Result.ok(10)),
    Task.resolve(Result.err("oops")),
    Task.resolve(Result.ok(30)),
  ];
  const result = await Arr.sequenceTaskResult(tasks)();
  assertEquals(result, Result.err("oops"));
});

// =============================================================================
// Predicates: isNonEmpty, some, every
// =============================================================================

Deno.test("isNonEmpty - returns true for non-empty array", () => {
  assertStrictEquals(Arr.isNonEmpty([1, 2, 3]), true);
});

Deno.test("isNonEmpty - returns false for empty array", () => {
  assertStrictEquals(Arr.isNonEmpty([]), false);
});

Deno.test("isNonEmpty - returns true for single-element array", () => {
  assertStrictEquals(Arr.isNonEmpty([undefined]), true);
});

Deno.test("some - returns true when at least one element matches", () => {
  const result = pipe(
    [1, 2, 3, 4],
    Arr.some((n) => n > 3),
  );
  assertStrictEquals(result, true);
});

Deno.test("some - returns false when no element matches", () => {
  const result = pipe(
    [1, 2, 3],
    Arr.some((n) => n > 10),
  );
  assertStrictEquals(result, false);
});

Deno.test("some - returns false for empty array", () => {
  const result = pipe(
    [] as number[],
    Arr.some((_) => true),
  );
  assertStrictEquals(result, false);
});

Deno.test("every - returns true when all elements match", () => {
  const result = pipe(
    [2, 4, 6],
    Arr.every((n) => n % 2 === 0),
  );
  assertStrictEquals(result, true);
});

Deno.test("every - returns false when any element does not match", () => {
  const result = pipe(
    [2, 3, 6],
    Arr.every((n) => n % 2 === 0),
  );
  assertStrictEquals(result, false);
});

Deno.test("every - returns true for empty array (vacuous truth)", () => {
  const result = pipe(
    [] as number[],
    Arr.every((_) => false),
  );
  assertStrictEquals(result, true);
});

// =============================================================================
// Slicing: reverse, take, drop, takeWhile, dropWhile
// =============================================================================

Deno.test("reverse - reverses elements", () => {
  const result = Arr.reverse([1, 2, 3]);
  assertEquals(result, [3, 2, 1]);
});

Deno.test("reverse - does not mutate the original array", () => {
  const original = [1, 2, 3];
  Arr.reverse(original);
  assertEquals(original, [1, 2, 3]);
});

Deno.test("reverse - returns empty for empty array", () => {
  assertEquals(Arr.reverse([]), []);
});

Deno.test("reverse - single element returns same", () => {
  assertEquals(Arr.reverse([42]), [42]);
});

Deno.test("take - takes first n elements", () => {
  const result = pipe([1, 2, 3, 4, 5], Arr.take(3));
  assertEquals(result, [1, 2, 3]);
});

Deno.test("take - takes all when n exceeds length", () => {
  const result = pipe([1, 2], Arr.take(10));
  assertEquals(result, [1, 2]);
});

Deno.test("take(0) - returns empty array", () => {
  const result = pipe([1, 2, 3], Arr.take(0));
  assertEquals(result, []);
});

Deno.test("take - negative n returns empty array", () => {
  const result = pipe([1, 2, 3], Arr.take(-1));
  assertEquals(result, []);
});

Deno.test("drop - drops first n elements", () => {
  const result = pipe([1, 2, 3, 4, 5], Arr.drop(2));
  assertEquals(result, [3, 4, 5]);
});

Deno.test("drop - drops all when n exceeds length", () => {
  const result = pipe([1, 2], Arr.drop(10));
  assertEquals(result, []);
});

Deno.test("drop(0) - returns entire array", () => {
  const result = pipe([1, 2, 3], Arr.drop(0));
  assertEquals(result, [1, 2, 3]);
});

Deno.test("takeWhile - takes elements while predicate holds", () => {
  const result = pipe(
    [1, 2, 3, 4, 1],
    Arr.takeWhile((n) => n < 3),
  );
  assertEquals(result, [1, 2]);
});

Deno.test("takeWhile - takes nothing when first element fails", () => {
  const result = pipe(
    [5, 1, 2],
    Arr.takeWhile((n) => n < 3),
  );
  assertEquals(result, []);
});

Deno.test("takeWhile - takes all when all pass", () => {
  const result = pipe(
    [1, 2, 3],
    Arr.takeWhile((n) => n < 10),
  );
  assertEquals(result, [1, 2, 3]);
});

Deno.test("takeWhile - empty array returns empty", () => {
  const result = pipe(
    [] as number[],
    Arr.takeWhile((_) => true),
  );
  assertEquals(result, []);
});

Deno.test("dropWhile - drops elements while predicate holds", () => {
  const result = pipe(
    [1, 2, 3, 4, 1],
    Arr.dropWhile((n) => n < 3),
  );
  assertEquals(result, [3, 4, 1]);
});

Deno.test("dropWhile - drops nothing when first element fails", () => {
  const result = pipe(
    [5, 1, 2],
    Arr.dropWhile((n) => n < 3),
  );
  assertEquals(result, [5, 1, 2]);
});

Deno.test("dropWhile - drops all when all pass", () => {
  const result = pipe(
    [1, 2, 3],
    Arr.dropWhile((n) => n < 10),
  );
  assertEquals(result, []);
});

Deno.test("dropWhile - empty array returns empty", () => {
  const result = pipe(
    [] as number[],
    Arr.dropWhile((_) => true),
  );
  assertEquals(result, []);
});

// =============================================================================
// Size
// =============================================================================

Deno.test("size - returns length of array", () => {
  assertStrictEquals(Arr.size([1, 2, 3]), 3);
});

Deno.test("size - returns 0 for empty array", () => {
  assertStrictEquals(Arr.size([]), 0);
});

Deno.test("size - returns 1 for single-element array", () => {
  assertStrictEquals(Arr.size(["only"]), 1);
});

// =============================================================================
// Composition with pipe
// =============================================================================

Deno.test("pipe composition - filter, map, head", () => {
  const result = pipe(
    [1, 2, 3, 4, 5],
    Arr.filter((n) => n > 2),
    Arr.map((n) => n * 10),
    Arr.head,
  );
  assertEquals(result, Option.some(30));
});

Deno.test("pipe composition - map, filter, reduce", () => {
  const result = pipe(
    [1, 2, 3, 4, 5],
    Arr.map((n) => n * 2),
    Arr.filter((n) => n > 4),
    Arr.reduce(0, (acc, n) => acc + n),
  );
  assertStrictEquals(result, 6 + 8 + 10);
});

Deno.test("pipe composition - flatMap, uniq, sortBy", () => {
  const result = pipe(
    [1, 2, 3],
    Arr.flatMap((n) => [n, n + 1]),
    Arr.uniq,
    Arr.sortBy((a, b) => a - b),
  );
  assertEquals(result, [1, 2, 3, 4]);
});
