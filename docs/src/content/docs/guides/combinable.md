---
title: "Combinable — combining values"
description: Monoid algebra for folding collections and merging values with a neutral starting point.
---

Folding a list of numbers into their sum, concatenating an array of strings, merging a series of
records — these are all the same operation in different shapes: start with a neutral value and apply
a combining operation repeatedly. JavaScript's `Array.reduce` handles this, but you have to supply
both the operation and the starting value at every call site.

`Combinable<A>` packages the two together. Define once how values of type `A` combine and what the
neutral starting value is. Then `Combinable.fold` gives you a single function that folds any array
of `A` values into one.

## The Combinable type

```ts
type Combinable<A> = {
  readonly empty: A;
  readonly combine: (b: A) => (a: A) => A;
};
```

`empty` is the neutral element — combining anything with `empty` gives back that thing unchanged.
`combine(b)(a)` appends `b` onto `a`. The data-last convention means `a` is the accumulated value
and `b` is the next element being combined in.

## Built-in instances

```ts
import { Combinable } from "@nlozgachev/pipelined/core";

// Strings
Combinable.string.combine(" world")("hello"); // "hello world"

// Numbers — two instances because both interpretations are equally valid
Combinable.sum.combine(3)(2);     // 5   (empty: 0)
Combinable.product.combine(3)(2); // 6   (empty: 1)

// Booleans — two instances
Combinable.all.combine(true)(true);   // true   (empty: true)
Combinable.any.combine(true)(false);  // true   (empty: false)

// Arrays
Combinable.array<number>().combine([3, 4])([1, 2]); // [1, 2, 3, 4]
```

## Folding a collection

`Combinable.fold` reduces an array into a single value, using the `Combinable`'s `empty` as the
starting point and `combine` as the operation:

```ts
import { Combinable, pipe } from "@nlozgachev/pipelined/core";

pipe(["hello", ", ", "world"], Combinable.fold(Combinable.string)); // "hello, world"
pipe([1, 2, 3, 4, 5], Combinable.fold(Combinable.sum));            // 15
pipe([2, 3, 4], Combinable.fold(Combinable.product));              // 24
pipe([], Combinable.fold(Combinable.sum));                         // 0 — the empty element
```

## Combining Maybe values

`Combinable.maybe` lifts a `Combinable<A>` into a `Combinable<Maybe<A>>`. `None` is the neutral
element — combining with `None` on either side leaves the other value unchanged. Two `Some` values
combine their inner values using the inner `Combinable`:

```ts
import { Combinable, Maybe, pipe } from "@nlozgachev/pipelined/core";

const c = Combinable.maybe(Combinable.sum);

c.combine(Maybe.some(3))(Maybe.some(2)); // Some(5)
c.combine(Maybe.none())(Maybe.some(5));  // Some(5) — None is neutral
c.combine(Maybe.some(5))(Maybe.none());  // Some(5) — None is neutral

// Fold a list of Maybe values:
pipe(
  [Maybe.some(1), Maybe.some(2), Maybe.some(3)],
  Combinable.fold(Combinable.maybe(Combinable.sum)),
); // Some(6)
```

## When to use Combinable

Use `Combinable<A>` when you have a collection of values that need to be folded into one, and you
want to name and reuse the combining operation rather than passing `reduce` callbacks at every call
site. The most common cases are summing numeric fields, concatenating strings or arrays, folding
boolean flags, and merging optional values.

If you need to combine values of two different types (`A` and `B` into `C`), `Combinable` is not
the right fit — use `Arr.reduce` directly.
