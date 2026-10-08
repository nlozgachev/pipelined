---
title: Arr — Array Utilities
description: Work with collections linearly, replacing data-first array method chains and unsafe undefined values with pipeline-ready, type-safe array helpers.
---

JavaScript arrays feature an exceptionally rich, built-in set of methods. However, when we build
structured pipelines, native array methods introduce two notable friction points:

1. **They are data-first**: Native methods reside directly on the array prototype. To sequence them
   inside a `pipe` or `flow`, we must wrap them in noisy inline arrow functions:
   `(items) => items.map(f)`.
2. **They are unsafe**: Native lookup methods (like accessing index `[0]` or `.find()`) silently
   return `undefined` when an element is absent or a search misses, shifting the burden of checking
   back to our code.

`Arr` solves both structural limitations. It is a comprehensive collection of **data-last**, curried
utilities designed to slot directly into pipelines, returning explicit `Maybe` values the moment a
search could result in absence.

---

## Safe Access: Bypassing Undefined

Accessing indices directly in JavaScript can crash our programs or introduce silent, propagating
`undefined` bugs. `Arr` provides safe, explicit boundary boundaries:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";
import { Arr } from "@nlozgachev/pipelined/data";

Arr.head([1, 2, 3]); // Some(1)
Arr.head([]);        // None

Arr.last([1, 2, 3]); // Some(3)
Arr.last([]);        // None

Arr.tail([1, 2, 3]); // Some([2, 3]) (all elements except the first)
Arr.init([1, 2, 3]); // Some([1, 2]) (all elements except the last)
```

Because these returns are standard `Maybe` containers, they compose linearly without a single
conditional guard:

```ts
const leadUserName = pipe(
  activeUsers,
  Arr.head,
  Maybe.map((u) => u.displayName),
  Maybe.getOrElse(() => "No active users found"),
);
```

---

## Searching and Filtering

Searches are guaranteed to return safe optional values:

```ts
const numbers = [1, 2, 3, 4];

pipe(numbers, Arr.findFirst((n) => n > 2)); // Some(3)
pipe(numbers, Arr.findLast((n) => n > 2));  // Some(4)
pipe(numbers, Arr.findIndex((n) => n > 2)); // Some(2)
pipe(numbers, Arr.findFirst((n) => n > 10)); // None

// Safe index lookup supporting negative offsets counting back from the end:
pipe(numbers, Arr.at(1));  // Some(2)
pipe(numbers, Arr.at(-1)); // Some(4)
pipe(numbers, Arr.at(10)); // None

// Find and transform in a single pass:
pipe(
  ["invalid", "42", "100"],
  Arr.findMap((s) => isNaN(Number(s)) ? Maybe.make.none() : Maybe.make.some(Number(s))),
); // Some(42)
```

Standard transformation steps are curried and ready for pipe composition:

```ts
pipe([1, 2, 3], Arr.map((n) => n * 2));     // [2, 4, 6]
pipe([1, 2, 3, 4], Arr.filter((n) => n % 2 === 0)); // [2, 4]
pipe([1, 2, 3], Arr.reverse);               // [3, 2, 1]
```

### Partitioning and grouping

- `partition` divides a collection into two groups: those that pass a predicate and those that fail.
- `partitionMaybe` maps with a `Maybe`-returning function, gathering `None` inputs into failures and
  `Some` unpacked values into successes.
- `groupBy` maps elements into a record of non-empty lists grouped by a key function:

```ts
// Splits into: [ [evens...], [odds...] ]
const [evens, odds] = pipe(
  [1, 2, 3, 4, 5],
  Arr.partition((n) => n % 2 === 0),
);

// Partition raw inputs by parser success:
const [rejectedStrings, validNumbers] = pipe(
  ["1", "foo", "2", "bar"],
  Arr.partitionMaybe((s) => isNaN(Number(s)) ? Maybe.make.none() : Maybe.make.some(Number(s))),
); // rejectedStrings: ["foo", "bar"], validNumbers: [1, 2]

// Grouping by starting letter:
const grouped = pipe(
  ["apple", "avocado", "banana"],
  Arr.groupBy((word) => word[0]),
); // { a: ["apple", "avocado"], b: ["banana"] }
```

### Deduplication and sorting

- `uniq` filters duplicates using strict equality (`===`).
- `uniqBy` filters duplicates by projecting a key.
- `dedupeAdjacent` removes consecutive identical elements, with an optional custom `Equality<A>`.
- `sortBy` sorts values immutably without mutating the source array:

```ts
const unique = Arr.uniq([1, 2, 2, 3, 1]); // [1, 2, 3]

// Drops only consecutive duplicate values:
const deduplicated = Arr.dedupeAdjacent()([1, 1, 2, 2, 1, 3]); // [1, 2, 1, 3]

const sorted = pipe(
  [3, 1, 4],
  Arr.sortBy((a, b) => a - b),
); // [1, 3, 4]
```

### FlatMap and Flatten

For nested collections:

```ts
pipe([1, 2, 3], Arr.flatMap((n) => [n, n * 10])); // [1, 10, 2, 20, 3, 30]
Arr.flatten([[1, 2], [3], [4, 5]]);              // [1, 2, 3, 4, 5]
```

---

## The Map-Filter Superpower: filterMap

We frequently need to map over a collection and filter out invalid or empty results. Writing this
natively requires two complete array iterations:

```ts
// Native multi-pass approach:
const ids = rawStrings.map(parseId).filter(isSome).map(unwrap);
```

`filterMap` performs both mapping and filtering in a **single pass**, collecting only the successful
`Some` values and discarding `None` states automatically:

```ts
const parseNumeric = (s: string): Maybe<number> => {
  const n = Number(s);
  return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
};

const numbers = pipe(
  ["1", "invalid_text", "3", "hello", "9"],
  Arr.filterMap(parseNumeric),
); // [1, 3, 9] (single pass, perfectly typed as number[])
```

---

## Index Slicing and Modification

```ts
pipe([1, 2, 3, 4], Arr.take(2)); // [1, 2]
pipe([1, 2, 3, 4], Arr.drop(2)); // [3, 4]

pipe([1, 2, 3, 1], Arr.takeWhile((n) => n < 3)); // [1, 2]
pipe([1, 2, 3, 1], Arr.dropWhile((n) => n < 3)); // [3, 1]
```

### Safe modifications

Unlike direct mutations or bracket insertions, these return a fresh, structurally copied array,
preserving immutability:

- `insertAt` places an item at a given index (negative clamp to `0`, overflow appends).
- `removeAt` removes the element at an index (out of bounds returns the original array unchanged).

```ts
pipe([1, 2, 3], Arr.insertAt(1, 99)); // [1, 99, 2, 3]
pipe([1, 2, 3], Arr.removeAt(1));     // [1, 3]
```

---

## Combinations and Folds

- `zip` pairs elements from two arrays, terminating at the length of the shorter array.
- `zipWith` combines elements using a custom function.
- `intersperse` injects a separator between every element.
- `chunksOf` splits an array into fixed-size chunks.
- `reduce` folds a collection from the left.

```ts
pipe([1, 2], Arr.zip(["a", "b"]));          // [[1, "a"], [2, "b"]]
pipe([1, 2, 3], Arr.intersperse(0));         // [1, 0, 2, 0, 3]
pipe([1, 2, 3, 4, 5], Arr.chunksOf(2));     // [[1, 2], [3, 4], [5]]
```

---

## Grouping, Windowing, and Occurrences

### Consecutive grouping with `Arr.chunkBy`

When you need to group adjacent elements that share a calculated key (such as identical status tags
or timestamp intervals):

```ts
pipe(
  [1, 1, 2, 3, 3, 1],
  Arr.chunkBy((n) => n),
); // [[1, 1], [2], [3, 3], [1]]
```

### Sliding windows with `Arr.windowed`

`Arr.windowed` produces fixed-size overlapping slices across a collection, advancing by a specified
`step` (defaulting to 1):

```ts
const metrics = [10, 15, 20, 25];

// Overlapping pairs for trend calculation:
pipe(metrics, Arr.windowed(2)); // [[10, 15], [15, 20], [20, 25]]

// Stepping by 2:
pipe(metrics, Arr.windowed(2, { step: 2 })); // [[10, 15], [20, 25]]
```

### Indexing and counting occurrences

- `Arr.indexBy` maps an array into a `ReadonlyMap<K, A>` by a key extraction function.
- `Arr.frequencies` counts element occurrences, returning a `ReadonlyMap<A, number>`:

```ts
interface Product { id: string; category: string }
const catalog: Product[] = [
  { id: "p1", category: "books" },
  { id: "p2", category: "electronics" },
];

const catalogMap = pipe(catalog, Arr.indexBy((p) => p.id));
// ReadonlyMap { "p1" => { id: "p1", ... }, "p2" => { id: "p2", ... } }

const tagCounts = Arr.frequencies(["typescript", "rust", "typescript", "go"]);
// ReadonlyMap { "typescript" => 2, "rust" => 1, "go" => 1 }
```

---

## Sequence Generation: unfold

When generating a sequence from an initial seed state until a termination condition is met (such as
generating paginated page numbers or unfolding an arithmetic sequence), `Arr.unfold` executes while
the step callback returns `Some`:

```ts
// Unfold countdown until 0:
const countdown = Arr.unfold(5, (current) =>
  current > 0 ? Maybe.make.some([current, current - 1]) : Maybe.make.none(),
); // [5, 4, 3, 2, 1]
```

---

## Traversal across Contexts: traverse and sequence

When you map an array using an operation that can fail or runs asynchronously, you end up with an
array of containers, such as `Array<Maybe<A>>` or `Array<Result<E, A>>`.

This is highly inconvenient. Typically, we want to flip this structure inside out: if *all*
operations passed, we want `Maybe<Array<A>>` or `Result<E, Array<A>>`. If a single check failed, we
want the entire pipeline to fail.

The `traverse` family executes this inside-out flip automatically during the mapping stage.

### Safe traversal with `Arr.traverse.Maybe`

Maps each element to a `Maybe` and flattens it. If a single element yields `None`, the entire result
resolves to `None`:

```ts
pipe(
  ["1", "2", "3"],
  Arr.traverse.Maybe(parseNumeric),
); // Some([1, 2, 3])

pipe(
  ["1", "invalid_text", "3"],
  Arr.traverse.Maybe(parseNumeric),
); // None (the entire check short-circuits)
```

### Safe error traversal with `Arr.traverse.Result`

Maps elements to `Result`, returning `Ok` only if every element succeeded, or the first `Err`
encountered:

```ts
const validateAge = (age: number): Result<string, number> =>
  age >= 18 ? Result.make.ok(age) : Result.make.err(`Age ${age} is underage`);

pipe([20, 25, 30], Arr.traverse.Result(validateAge)); // Ok([20, 25, 30])
pipe([20, 16, 30], Arr.traverse.Result(validateAge)); // Err("Age 16 is underage")
```

### Asynchronous traversal with `Arr.traverse.Task` and `Arr.traverse.Task.Result`

- `Arr.traverse.Task` runs asynchronous tasks, resolving to a `Task<A[]>` once all complete. By
  default, it executes all tasks in parallel. Pass `{ concurrency }` to limit concurrent execution.
- `Arr.traverse.Task.Result` traverses fallible tasks, short-circuiting on the first `Err`
  encountered. By default, it executes sequentially. Pass `{ concurrency }` to execute with a
  bounded worker pool.

```ts
// Parallel user profile fetch bounded to 3 in-flight requests:
pipe(
  userIds,
  Arr.traverse.Task((id) => fetchUserTask(id), { concurrency: 3 }),
)();

// Fallible batch processing bounded to 5 concurrent workers:
pipe(
  userIds,
  Arr.traverse.Task.Result((id) => fetchUserTaskResult(id), { concurrency: 5 }),
)();
```

### Accumulating validation traversal with `Arr.traverse.Validation`

Unlike `Arr.traverse.Result` which short-circuits on the first error, `Arr.traverse.Validation`
evaluates all elements and accumulates every error into a `Failed` non-empty array:

```ts
const validatePositive = (n: number) =>
  n > 0 ? Validation.make.passed(n) : Validation.make.failed(`Non-positive: ${n}`);

pipe([1, 2, 3], Arr.traverse.Validation(validatePositive)); // Passed([1, 2, 3])
pipe([1, -2, -3], Arr.traverse.Validation(validatePositive)); // Failed(["Non-positive: -2", "Non-positive: -3"])
```

### Flipping existing structures: `sequence`

If you *already* have an array of containers, you can flip them using `sequence` directly under the
new layout:

```ts
// Array<Maybe<number>> → Maybe<Array<number>>
Arr.sequence.Maybe([Maybe.make.some(1), Maybe.make.some(2)]); // Some([1, 2])
Arr.sequence.Maybe([Maybe.make.some(1), Maybe.make.none()]);   // None

// Array<Validation<string, number>> → Validation<string, Array<number>>
Arr.sequence.Validation([Validation.make.passed(1), Validation.make.passed(2)]); // Passed([1, 2])
Arr.sequence.Validation([Validation.make.failed("err1"), Validation.make.failed("err2")]); // Failed(["err1", "err2"])
```

---

## Non-Empty Arrays: Arr.NonEmpty and Generic Operations

When you need compile-time guarantees that an array is not empty (e.g., for safe head access or
accumulating validation errors), you can use `Arr.NonEmpty<A>` from the data module.

To simplify operating on non-empty arrays, several core `Arr` helpers are generic and automatically
preserve the non-empty type contract when applied to a `Arr.NonEmpty`. These include `map`,
`mapWithIndex`, `reverse`, `intersperse`, `prepend`, `append`, and `concat`.

```ts
import { Arr } from "@nlozgachev/pipelined/data";

const list: Arr.NonEmpty<number> = [1, 2, 3];

// Generic operations preserve the Arr.NonEmpty type signature automatically:
const doubled: Arr.NonEmpty<number> = Arr.map((n) => n * 2)(list);
const reversed: Arr.NonEmpty<number> = Arr.reverse(list);
const extended: Arr.NonEmpty<number> = pipe(list, Arr.concat([4, 5]));
```

### Specialized Non-Empty Operations: Arr.NonEmpty

For operations that have structurally distinct signatures or return shapes when applied to non-empty
arrays, you can use the nested `Arr.NonEmpty` module.

- **`head` / `last`**: Because a non-empty array is guaranteed to contain elements, these helpers
  return the value directly instead of wrapping it in a `Maybe`.
- **`tail`**: Returns all elements after the first as a standard `readonly A[]`.
- **`reduce`**: Reduces the array from the left without requiring an initial seed value, since there
  is always at least one element.
- **`singleton`**: Wraps a single value in an `Arr.NonEmpty`.
- **`from.array`**: Attempts to lift a standard, potentially empty array into an `Arr.NonEmpty`,
  returning `Some<Arr.NonEmpty>` if elements are present, and `None` otherwise.

```ts
import { Arr } from "@nlozgachev/pipelined/data";

const list: Arr.NonEmpty<number> = [10, 20, 30];

const first: number = Arr.NonEmpty.head(list); // 10 (returns number directly, not Maybe)
const sum: number = Arr.NonEmpty.reduce((a, b) => a + b)(list); // 60 (no initial value required)

const singletonList = Arr.NonEmpty.singleton("value"); // Arr.NonEmpty<string>
const maybeNonEmpty = Arr.NonEmpty.from.array([1, 2]); // Some([1, 2])
```

For more details on when to enforce non-empty guarantees at the boundaries of your systems, see the
dedicated [NonEmpty Guide](../nonempty).

---

## Problems it solves

- **Point-free transformation in data pipelines**: In API response formatters and event processors,
  transforming arrays with native methods often requires verbose arrow wrapper functions inside
  `pipe` chains. `Arr` provides data-last combinators (`Arr.map`, `Arr.filterMap`, `Arr.chunk`,
  `Arr.groupBy`) that compose cleanly into linear pipelines.
- **Safe element extraction and out-of-bounds protection (`Arr.head`, `Arr.last`, `Arr.at`)**:
  Native indexing (`arr[i]`) returns `undefined` at runtime without static safety. `Arr.head`,
  `Arr.last`, and `Arr.at` return `Maybe<A>`, supporting negative offsets and guaranteeing
  out-of-bounds checks before accessing properties.
- **Batch chunking and sliding windows (`Arr.chunksOf`, `Arr.chunkBy`, `Arr.windowed`)**: When
  submitting bulk inserts to rate-limited APIs, grouping consecutive identical states, or computing
  moving averages across time-series metrics, `Arr.chunksOf`, `Arr.chunkBy`, and `Arr.windowed`
  partition collections point-free.
- **Categorization and dual-partitioning (`Arr.groupBy`, `Arr.partition`, `Arr.partitionMaybe`,
  `Arr.frequencies`)**: In UI dashboards and reporting tools, collections need to be split by
  boolean criteria (`Arr.partition`), segregated by optional parsers (`Arr.partitionMaybe`),
  organized into non-empty buckets (`Arr.groupBy`), or counted into frequency maps
  (`Arr.frequencies`).
- **Simultaneous mapping and filtering (`Arr.filterMap`, `Arr.findMap`, `Arr.compact`)**: Extracting
  valid data from dirty datasets (such as parsing strings to numbers and discarding unparseable
  rows) typically requires separate `.map()` and `.filter()` passes. `Arr.filterMap` and
  `Arr.findMap` execute transformation and filtering in a single efficient pass.
- **Sequence generation from seeds (`Arr.unfold`)**: Constructing lists from iterative algorithms or
  paginated cursor workflows without imperative `while` loops or mutable array allocations.
- **Traversing collections of fallible or asynchronous steps (`Arr.traverse`)**: When running batch
  operations (such as validating an array of input records or fetching details for a list of IDs),
  standard mapping produces `Array<Task.Result<E, A>>`. `Arr.traverse.Task.Result` sequences or
  parallels the collection with optional bounded concurrency into a single `Task.Result<E, A[]>`,
  handling failures and collection inversion automatically.
