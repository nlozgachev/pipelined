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
```

Standard transformation steps are curried and ready for pipe composition:

```ts
pipe([1, 2, 3], Arr.map((n) => n * 2));     // [2, 4, 6]
pipe([1, 2, 3, 4], Arr.filter((n) => n % 2 === 0)); // [2, 4]
pipe([1, 2, 3], Arr.reverse);               // [3, 2, 1]
```

### Partitioning and grouping

- `partition` divides a collection into two groups: those that pass a predicate and those that fail.
- `groupBy` maps elements into a record of non-empty lists grouped by a key function:

```ts
// Splits into: [ [evens...], [odds...] ]
const [evens, odds] = pipe(
  [1, 2, 3, 4, 5],
  Arr.partition((n) => n % 2 === 0),
);

// Grouping by starting letter:
const grouped = pipe(
  ["apple", "avocado", "banana"],
  Arr.groupBy((word) => word[0]),
); // { a: ["apple", "avocado"], b: ["banana"] }
```

### Deduplication and sorting

- `uniq` filters duplicates using strict equality (`===`).
- `uniqBy` filters duplicates by projecting a key.
- `sortBy` sorts values immutably without mutating the source array:

```ts
const unique = Arr.uniq([1, 2, 2, 3, 1]); // [1, 2, 3]

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
  return isNaN(n) ? Maybe.none() : Maybe.some(n);
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

## Traversal across Contexts: traverse and sequence

When you map an array using an operation that can fail or runs asynchronously, you end up with an
array of containers, such as `Array<Maybe<A>>` or `Array<Result<E, A>>`.

This is highly inconvenient. Typically, we want to flip this structure inside out: if *all*
operations passed, we want `Maybe<Array<A>>` or `Result<E, Array<A>>`. If a single check failed, we
want the entire pipeline to fail.

The `traverse` family executes this inside-out flip automatically during the mapping stage.

### Safe traversal with `Arr.Maybe.traverse`

Maps each element to a `Maybe` and flattens it. If a single element yields `None`, the entire result
resolves to `None`:

```ts
pipe(
  ["1", "2", "3"],
  Arr.Maybe.traverse(parseNumeric),
); // Some([1, 2, 3])

pipe(
  ["1", "invalid_text", "3"],
  Arr.Maybe.traverse(parseNumeric),
); // None (the entire check short-circuits)
```

### Safe error traversal with `Arr.Result.traverse`

Maps elements to `Result`, returning `Ok` only if every element succeeded, or the first `Err`
encountered:

```ts
const validateAge = (age: number): Result<string, number> =>
  age >= 18 ? Result.ok(age) : Result.err(`Age ${age} is underage`);

pipe([20, 25, 30], Arr.Result.traverse(validateAge)); // Ok([20, 25, 30])
pipe([20, 16, 30], Arr.Result.traverse(validateAge)); // Err("Age 16 is underage")
```

### Asynchronous traversal with `Arr.Task.traverse` and `Arr.Task.Result.traverse`

- `Arr.Task.traverse` runs all async tasks in **parallel**, resolving to a `Task<A[]>` once all
  complete.
- `Arr.Task.Result.traverse` runs tasks **sequentially**, short-circuiting on the first `Err`
  encountered.

```ts
// Parallel user profile fetch:
pipe(
  userIds,
  Arr.Task.traverse((id) => fetchUserTask(id)),
)(); // Promise<User[]> (all requests execute simultaneously)
```

### Flipping existing structures: `sequence`

If you *already* have an array of containers, you can flip them using `sequence` directly under each
nested namespace:

```ts
// Array<Maybe<number>> → Maybe<Array<number>>
Arr.Maybe.sequence([Maybe.some(1), Maybe.some(2)]); // Some([1, 2])
Arr.Maybe.sequence([Maybe.some(1), Maybe.none()]);   // None
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
arrays, you can use the nested `Arr.NonEmpty` namespace.

- **`head` / `last`**: Because a non-empty array is guaranteed to contain elements, these helpers
  return the value directly instead of wrapping it in a `Maybe`.
- **`tail`**: Returns all elements after the first as a standard `readonly A[]`.
- **`reduce`**: Reduces the array from the left without requiring an initial seed value, since there
  is always at least one element.
- **`singleton`**: Wraps a single value in an `Arr.NonEmpty`.
- **`fromArray`**: Attempts to lift a standard, potentially empty array into an `Arr.NonEmpty`,
  returning `Some<Arr.NonEmpty>` if elements are present, and `None` otherwise.

```ts
import { Arr } from "@nlozgachev/pipelined/data";

const list: Arr.NonEmpty<number> = [10, 20, 30];

const first: number = Arr.NonEmpty.head(list); // 10 (returns number directly, not Maybe)
const sum: number = Arr.NonEmpty.reduce((a, b) => a + b)(list); // 60 (no initial value required)

const singletonList = Arr.NonEmpty.singleton("value"); // Arr.NonEmpty<string>
const maybeNonEmpty = Arr.NonEmpty.fromArray([1, 2]); // Some([1, 2])
```

For more details on when to enforce non-empty guarantees at the boundaries of your systems, see the
dedicated [NonEmpty Guide](../nonempty).

---

## When to use Arr

### Use Arr when:

- **Operating inside pipelines**: You are sequencing steps point-free inside `pipe` or `flow` chains
  and want to avoid noisy data-first method wrappers.
- **Accessing indices safely**: You want to avoid runtime `undefined` crashes and explicitly capture
  absence via `Maybe`.
- **Flipping async collections**: You need to traverse an array with fallible or asynchronous steps,
  mapping `Array<Task.Result<E, A>>` to `Task.Result<E, A[]>` cleanly.

### Keep using native array methods when:

- **Writing simple local logic**: Inside a single, self-contained function body where structural
  pipelining is not utilized, and basic `.map()` or `.filter()` chains are already clear.
