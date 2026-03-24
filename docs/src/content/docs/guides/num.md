---
title: Num — number utilities
description: Curried arithmetic, clamping, range generation, and safe parsing — all designed to compose with pipe and Arr.map.
---

Working with numbers in a pipeline usually means scattering anonymous arrow functions everywhere:
`Arr.map(n => n * 2)`, `Arr.filter(n => n >= 0 && n <= 100)`. `Num` replaces these with
composable, named operations that read naturally inside `pipe`.

## Generating number ranges

`Num.range` produces an array of numbers from `from` to `to` (both inclusive), with an
optional `step`. When the step does not land exactly on `to`, the sequence stops at the last
value that does not exceed it:

```ts
import { Num } from "@nlozgachev/pipelined/utils";

Num.range(0, 5); // [0, 1, 2, 3, 4, 5]
Num.range(0, 10, 2); // [0, 2, 4, 6, 8, 10]
Num.range(0, 9, 2); // [0, 2, 4, 6, 8]   — 9 is not reachable, stops at 8
Num.range(5, 0); // [] — start > end produces nothing
```

This pairs naturally with `Arr.map` and `Arr.filter` to build datasets for charts, pagination, or
test fixtures without manually constructing arrays.

## Curried arithmetic

`add`, `subtract`, `multiply`, and `divide` each take the operand first and the value last —
making them directly composable in `pipe` and `Arr.map`:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Arr, Num } from "@nlozgachev/pipelined/utils";

pipe([1, 2, 3, 4, 5], Arr.map(Num.multiply(2))); // [2, 4, 6, 8, 10]
pipe([10, 20, 30], Arr.map(Num.subtract(5))); // [5, 15, 25]
```

`subtract(b)(a)` = `a - b` and `divide(b)(a)` = `a / b`, so they read as "subtract `b`" and
"divide by `b`" — natural for transforming arrays of values.

## Clamping values to a range

`Num.clamp` constrains a number to stay within `[min, max]` (both inclusive). Values below `min`
become `min`; values above `max` become `max`:

```ts
pipe(150, Num.clamp(0, 100)); // 100
pipe(-5, Num.clamp(0, 100)); // 0
pipe(42, Num.clamp(0, 100)); // 42
```

A common use case is normalising user input — ensuring a slider value stays within the allowed
range before sending it to an API.

## Checking membership with `between`

`Num.between` is a predicate that returns `true` when the value falls within `[min, max]`
(inclusive on both ends). It composes directly with `Arr.filter`:

```ts
pipe(
	Num.range(0, 20),
	Arr.filter(Num.between(5, 15)),
); // [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]  — both bounds inclusive
```

This eliminates the common `n >= min && n <= max` inline expression scattered throughout filter
callbacks.

## Safe parsing

`Num.parse` converts a string to a number and wraps the result in `Maybe` — `None` if the string
doesn't represent a valid number, `Some` otherwise:

```ts
Num.parse("42"); // Some(42)
Num.parse("3.14"); // Some(3.14)
Num.parse("abc"); // None
Num.parse(""); // None
```

This avoids the `isNaN` dance and integrates with the rest of the `Maybe` API:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";

pipe(
	Num.parse(rawInput),
	Maybe.map(Num.clamp(0, 255)),
	Maybe.getOrElse(() => 0),
); // a clamped byte value, defaulting to 0 for bad input
```

## Composing it all

`Num` functions are designed to appear as steps in a `pipe` chain alongside `Arr` operations.
Here, a range of integers is scaled, filtered to a sub-range, and summed:

```ts
pipe(
	Num.range(1, 20), // [1 .. 20]
	Arr.map(Num.multiply(3)), // [3, 6, 9, ..., 60]
	Arr.filter(Num.between(10, 40)),
	Arr.reduce(0, Num.add), // curried add works as a reducer too
); // 10+12+15+18+21+24+27+30+33+36+39 = ?
```

## When to use Num

Use `Num` when:

- You need to generate a sequence of numbers for iteration, pagination, or test data
- You're mapping or filtering arrays of numbers and want to avoid inline arrow functions
- You need to constrain user input to a valid range with `clamp`
- You're parsing numeric strings from form fields, query params, or configuration and want a typed
  `Maybe` instead of a `NaN` check

Keep using plain arithmetic operators when:

- The expression is a one-off inside a function body where readability is not improved by naming
- You don't need to compose the operation in a pipeline
