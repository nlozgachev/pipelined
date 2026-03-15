---
title: Arr — array utilities
description: Work with arrays in a pipeline — data-last utilities that return Option instead of undefined.
---

JavaScript arrays come with a full set of built-in methods, but they have two friction points in
pipelines: they put the data first (making partial application awkward), and they return `undefined`
when something isn't found. `Arr` is a collection of array utilities that address both: data-last
functions that slot directly into `pipe`, and `Option` wherever something might be absent.

## Safe access

JavaScript's built-in access functions silently return `undefined` when an element doesn't exist.
`Arr` makes the absence explicit:

```ts
import { Arr, Option } from "@nlozgachev/pipelined/core";
import { pipe } from "@nlozgachev/pipelined/composition";

Arr.head([1, 2, 3]); // Some(1)
Arr.head([]); // None

Arr.last([1, 2, 3]); // Some(3)
Arr.last([]); // None

Arr.tail([1, 2, 3]); // Some([2, 3]) — everything after the first
Arr.tail([]); // None

Arr.init([1, 2, 3]); // Some([1, 2]) — everything before the last
Arr.init([]); // None
```

These compose naturally with `Option` operations:

```ts
pipe(
  users,
  Arr.head, // Option<User>
  Option.map((u) => u.displayName), // Option<string>
  Option.getOrElse("No users"),
);
```

## Search

`findFirst`, `findLast`, and `findIndex` all return `Option` for the same reason — the element might
not exist:

```ts
pipe(
  [1, 2, 3, 4],
  Arr.findFirst((n) => n > 2),
); // Some(3)
pipe(
  [1, 2, 3, 4],
  Arr.findLast((n) => n > 2),
); // Some(4)
pipe(
  [1, 2, 3, 4],
  Arr.findIndex((n) => n > 2),
); // Some(2)

pipe(
  [1, 2],
  Arr.findFirst((n) => n > 10),
); // None
```

## Transforming

The core transforms work exactly like their built-in counterparts, but curried for `pipe`:

```ts
pipe(
  [1, 2, 3],
  Arr.map((n) => n * 2),
); // [2, 4, 6]
pipe(
  [1, 2, 3, 4],
  Arr.filter((n) => n % 2 === 0),
); // [2, 4]
pipe([1, 2, 3], Arr.reverse); // [3, 2, 1]
```

**`partition`** splits into two groups — those that pass the predicate and those that don't:

```ts
const [evens, odds] = pipe(
  [1, 2, 3, 4, 5],
  Arr.partition((n) => n % 2 === 0),
); // [[2, 4], [1, 3, 5]]
```

**`groupBy`** groups elements by a key function, returning a record where each group is a
`NonEmptyList`:

```ts
pipe(
  ["apple", "avocado", "banana", "blueberry"],
  Arr.groupBy((s) => s[0]),
); // { a: ["apple", "avocado"], b: ["banana", "blueberry"] }
```

**`uniq`** removes duplicates using strict equality; **`uniqBy`** removes duplicates by a key
function:

```ts
Arr.uniq([1, 2, 2, 3, 1]); // [1, 2, 3]

pipe(
  [
    { id: 1, name: "a" },
    { id: 1, name: "b" },
    { id: 2, name: "c" },
  ],
  Arr.uniqBy((x) => x.id),
); // [{ id: 1, name: "a" }, { id: 2, name: "c" }]
```

**`sortBy`** sorts without mutating:

```ts
pipe(
  [3, 1, 4, 1, 5],
  Arr.sortBy((a, b) => a - b),
); // [1, 1, 3, 4, 5]
```

**`flatMap`** and **`flatten`** for working with nested arrays:

```ts
pipe(
  [1, 2, 3],
  Arr.flatMap((n) => [n, n * 10]),
); // [1, 10, 2, 20, 3, 30]
Arr.flatten([[1, 2], [3], [4, 5]]); // [1, 2, 3, 4, 5]
```

## Slicing

```ts
pipe([1, 2, 3, 4], Arr.take(2)); // [1, 2]
pipe([1, 2, 3, 4], Arr.drop(2)); // [3, 4]

pipe(
  [1, 2, 3, 1],
  Arr.takeWhile((n) => n < 3),
); // [1, 2]
pipe(
  [1, 2, 3, 1],
  Arr.dropWhile((n) => n < 3),
); // [3, 1]
```

## Combining arrays

**`zip`** pairs elements from two arrays, stopping at the shorter one:

```ts
pipe([1, 2, 3], Arr.zip(["a", "b"])); // [[1, "a"], [2, "b"]]
```

**`zipWith`** combines elements with a function:

```ts
pipe(
  [1, 2, 3],
  Arr.zipWith((a, b) => `${a}${b}`, ["a", "b"]),
); // ["1a", "2b"]
```

**`intersperse`** inserts a separator between every element:

```ts
pipe([1, 2, 3], Arr.intersperse(0)); // [1, 0, 2, 0, 3]
```

**`chunksOf`** splits into fixed-size chunks:

```ts
pipe([1, 2, 3, 4, 5], Arr.chunksOf(2)); // [[1, 2], [3, 4], [5]]
```

**`reduce`** folds from the left:

```ts
pipe(
  [1, 2, 3, 4],
  Arr.reduce(0, (acc, n) => acc + n),
); // 10
```

## Predicates

```ts
pipe(
  [1, 2, 3],
  Arr.some((n) => n > 2),
); // true
pipe(
  [1, 2, 3],
  Arr.every((n) => n > 0),
); // true
Arr.isNonEmpty([]); // false
Arr.isNonEmpty([1, 2]); // true (also narrows to NonEmptyList)
```

## Traversing across types

The `traverse` family maps each element to a typed container and collects the results. They're
useful when you want to run a fallible operation across every element and collect either all
successes or the first failure.

**`traverse`** — maps to `Option`, returns `None` if any element fails:

```ts
const parseNum = (s: string): Option<number> => {
  const n = Number(s);
  return isNaN(n) ? Option.none() : Option.some(n);
};

pipe(["1", "2", "3"], Arr.traverse(parseNum)); // Some([1, 2, 3])
pipe(["1", "x", "3"], Arr.traverse(parseNum)); // None
```

**`traverseResult`** — maps to `Result`, returns the first `Err` if any element fails:

```ts
const validatePositive = (n: number): Result<string, number> =>
  n > 0 ? Result.ok(n) : Result.err("not positive");

pipe([1, 2, 3], Arr.traverseResult(validatePositive)); // Ok([1, 2, 3])
pipe([1, -1, 3], Arr.traverseResult(validatePositive)); // Err("not positive")
```

**`traverseTask`** — maps to `Task` and runs all in parallel:

```ts
pipe(
  userIds,
  Arr.traverseTask((id) => fetchUser(id)),
)(); // Promise<User[]> — all fetches run in parallel
```

**`sequence`**, **`sequenceResult`**, **`sequenceTask`** — shorthand for when you already have an
array of containers and want to flip `Array<Option<A>>` into `Option<Array<A>>`:

```ts
Arr.sequence([Option.some(1), Option.some(2)]); // Some([1, 2])
Arr.sequence([Option.some(1), Option.none()]); // None
```
