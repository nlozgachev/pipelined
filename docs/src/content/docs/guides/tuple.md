---
title: Tuple — typed pairs
description: Carry two values together through a pipeline and transform either or both sides without destructuring.
---

Some values always come in pairs: a product name and its price, a city and its population, a configuration key and its current value. `Tuple<A, B>` is a typed alias for `readonly [A, B]`. Both values are always present. The library provides data-last operations for transforming either or both sides, consuming the pair into a single value, and composing these steps cleanly in a pipeline.

## Creating a pair

```ts
import { Tuple } from "@nlozgachev/pipelined/core";

Tuple.make("Paris", 2_161_000); // ["Paris", 2161000]
Tuple.make("tax_rate", 0.21);   // ["tax_rate", 0.21]
```

If you already have a `readonly [A, B]` value — from `Arr.zip`, `Arr.splitAt`, or a native tuple
literal — it is already a valid `Tuple<A, B>`. You don't need to call `make` to convert it.

## Reading the values

`first` and `second` extract a value from a pair. They are useful as the last step in a pipeline
or when you only need one side:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

const entry = Tuple.make("alice", 980);

Tuple.first(entry);  // "alice"
Tuple.second(entry); // 980

pipe(entry, Tuple.second); // 980
```

## Transforming one side

`mapFirst` and `mapSecond` apply a function to one element and return a new pair with the other
element unchanged.

```ts
pipe(
  Tuple.make("alice", 980),
  Tuple.mapFirst((name) => name.toUpperCase()),
  // ["ALICE", 980]
  Tuple.mapSecond((score) => score + 20),
  // ["ALICE", 1000]
);
```

A realistic example — formatting a localised price:

```ts
const formatPrice = (locale: string, amountCents: number): string =>
  (amountCents / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });

pipe(
  Tuple.make("fr-FR", 1299),
  Tuple.mapSecond((cents) => cents * 1.2),   // apply VAT in cents
  Tuple.fold(formatPrice),                    // "15,59 €"
);
```

## Transforming both sides at once

`mapBoth` applies two functions — one per side — in a single step:

```ts
pipe(
  Tuple.make("product-a", 4999),
  Tuple.mapBoth(
    (sku) => sku.toUpperCase(),
    (priceCents) => priceCents / 100,
  ),
  // ["PRODUCT-A", 49.99]
);
```

## Consuming the pair

`fold` collapses both values into one by applying a binary function. It is usually the final step
in a pipeline:

```ts
pipe(
  Tuple.make("Alice", 100),
  Tuple.mapSecond((score) => score * 1.1),
  Tuple.fold((name, score) => `${name}: ${score.toFixed(0)} pts`),
); // "Alice: 110 pts"
```

## Swapping the two sides

`swap` reverses the pair: `[A, B]` becomes `[B, A]`. Useful when a downstream function expects
the elements in the opposite order:

```ts
Tuple.swap(Tuple.make("key", 42)); // [42, "key"]

// Swap the pair before passing to a function that expects (score, name)
pipe(
  Tuple.make("Bob", 77),
  Tuple.swap,
  Tuple.fold((score: number, name: string) => `${name} scored ${score}`),
); // "Bob scored 77"
```

## Converting to an array

`toArray` converts the pair to a `readonly (A | B)[]`. The elements stay in order:

```ts
Tuple.toArray(Tuple.make("hello", 42)); // ["hello", 42]
```

## Observing values without changing them

`tap` runs a side effect on both values and returns the pair unchanged. Use it for logging or
debugging in the middle of a pipeline:

```ts
pipe(
  Tuple.make("Paris", 2_161_000),
  Tuple.tap((city, pop) => console.log(`Processing: ${city} (${pop})`)),
  Tuple.mapSecond((pop) => pop / 1_000_000),
  Tuple.fold((city, popM) => `${city}: ${popM.toFixed(1)}M`),
); // logs "Processing: Paris (2161000)", returns "Paris: 2.2M"
```

## When to use Tuple

Use `Tuple` when:

- Two values always belong together and travel as a unit through a pipeline
- You want to transform one or both sides without destructuring at each step
- You are working with output from `Arr.zip` or `Arr.splitAt` and need to manipulate the pair
- `fold` provides a clean final step to collapse the pair into a single result

Keep using native tuple destructuring when the pair is short-lived and the transformation is a
single expression — `const [a, b] = pair; return f(a, b);` is perfectly clear for simple cases.
`Tuple` earns its place in longer pipelines where the pair passes through several steps before
being consumed.
