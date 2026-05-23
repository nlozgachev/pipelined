---
title: Combinable — Combining Values
description: Package combining operations with their neutral starting points into first-class blueprints, simplifying collection reduction.
---

Aggregating collections of data is a fundamental task in software engineering. Summing an array of
invoice prices, concatenating list items into a single string, or merging a series of configuration
profiles are structurally identical operations.

In JavaScript, our standard tool for this is `Array.prototype.reduce`. While powerful, `reduce`
forces us to explicitly supply both the combining callback and the initial starting value at every
single call site:

```ts
const totalCost = items.reduce((sum, item) => sum + item.price, 0);
const fullText  = fragments.reduce((acc, str) => acc + str, "");
```

This leads to redundant, repetitive ceremony. If we want to sum numbers, we must write
`(acc, x) => acc + x` and `0`. If we want to multiply numbers, we must write `(acc, x) => acc * x`
and `1`. The combining logic and the starting value are decoupled, forcing the developer to track
both separately.

`Combinable<A>` packages these two related concerns into a single, reusable data structure:

```ts
type Combinable<A> = {
  readonly empty: A;
  readonly combine: (next: A) => (accumulated: A) => A;
};
```

- `empty` is the neutral starting element. Combining any value with `empty` yields the original
  value unchanged.
- `combine` is the data-last combining operation, taking the next element and appending it to the
  accumulated value.

In abstract algebra, this combination is known as a **Monoid**. By packaging the baseline value and
the appending logic into a first-class blueprint, we get a highly reusable, clean strategy for
collection aggregation.

---

## Built-In Aggregators

The library provides optimized, built-in combiners for standard primitives:

```ts
import { Combinable } from "@nlozgachev/pipelined/core";

// 1. Strings (empty: "")
Combinable.string.combine(" world")("hello"); // "hello world"

// 2. Numbers (Sum vs Product)
// Both interpretations of combining numbers are equally valid, carrying different baselines:
Combinable.sum.combine(3)(2);     // 5 (empty: 0)
Combinable.product.combine(3)(2); // 6 (empty: 1)

// 3. Booleans (All vs Any)
Combinable.all.combine(true)(true);  // true (empty: true)
Combinable.any.combine(true)(false); // true (empty: false)

// 4. Arrays
Combinable.array<number>().combine([3, 4])([1, 2]); // [1, 2, 3, 4]
```

Notice the numbers example. Summation and multiplication are both mathematically valid ways to
combine numbers, but they require different baseline elements (`0` for sum, `1` for product). By
using `Combinable.sum` or `Combinable.product`, we make our exact aggregation intent explicit in our
code.

---

## Folding Collections point-free: fold

`Combinable.fold` accepts a `Combinable<A>` and returns a clean, single-argument function
`(as: A[]) => A` that collapses an array into a single value:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

// Collapsing strings
pipe(["hello", ", ", "world"], Combinable.fold(Combinable.string)); // "hello, world"

// Summing numbers
pipe([1, 2, 3, 4, 5], Combinable.fold(Combinable.sum)); // 15

// Multiplying numbers
pipe([2, 3, 4], Combinable.fold(Combinable.product)); // 24

// Folding an empty array returns the baseline "empty" value:
pipe([], Combinable.fold(Combinable.sum)); // 0
```

---

## Combining Optional Values: maybe

Often, the values we want to combine are optional, represented by `Maybe<A>`. `Combinable.maybe`
lifts a `Combinable<A>` to operate safely over `Maybe<A>` values:

```ts
import { Maybe } from "@nlozgachev/pipelined/core";

const maybeSum = Combinable.maybe(Combinable.sum);

// None acts as the neutral element:
maybeSum.combine(Maybe.some(3))(Maybe.some(2)); // Some(5)
maybeSum.combine(Maybe.none())(Maybe.some(5));  // Some(5)
maybeSum.combine(Maybe.some(5))(Maybe.none());  // Some(5)
```

This makes folding collections of optional domain fields extremely elegant:

```ts
const totalScores = pipe(
  [Maybe.some(10), Maybe.none(), Maybe.some(20)],
  Combinable.fold(Combinable.maybe(Combinable.sum)),
); // Some(30)
```

---

## When to use Combinable

### Use Combinable when:

- **Aggregating homogeneous collections**: Summing a list of numbers, appending string blocks,
  merging record overlays, or folding a list of optional values.
- **Creating reusable folder functions**: You want to name and reuse an aggregation rule point-free
  across multiple list reductions rather than writing manual `Array.prototype.reduce` callbacks at
  each call site.

### Keep using Array.reduce directly when:

- **Folding heterogeneous values**: You are reducing values of one type `A` to yield a completely
  different type `B` (e.g. converting a list of raw strings into a structured lookup map). In this
  case, `Combinable` is structurally incompatible — use standard `Array.prototype.reduce` or
  specialized dict builders instead.
