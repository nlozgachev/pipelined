---
title: "Ordering — typed sort comparators"
description: Composable sort functions with built-in instances, multi-key sorting, and field extraction.
---

Sorting is easy for a single field — `array.sort((a, b) => a.price - b.price)` — but becomes messy
when you need to sort by multiple fields, reverse a sort, or extract a field from a nested object.
Each variation requires writing a new comparator from scratch, and there is no way to compose two
existing comparators into a third without re-implementing the tiebreaker logic every time.

`Ordering<A>` makes comparators first-class values: built-in instances for common types, combinators
to reverse or chain them, and field extraction to adapt them to structured data.

## The Ordering type

```ts
type Ordering<A> = (a: A, b: A) => number;
```

An `Ordering<A>` is a function that returns a negative number when `a` comes before `b`, a positive
number when `a` comes after `b`, and `0` when they are equal. This is the same shape as the callback
accepted by `Array.prototype.sort`, so any `Ordering<A>` works directly anywhere a comparator is
expected.

## Built-in instances

```ts
import { Ordering } from "@nlozgachev/pipelined/core";

Ordering.string("apple", "banana"); // negative — "apple" < "banana"
Ordering.number(1, 2);             // negative
Ordering.number(2, 1);             // positive
Ordering.date(new Date("2024-01-01"), new Date("2025-01-01")); // negative
```

## Reversing an ordering

`Ordering.reverse` flips the direction of any comparator:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Ordering } from "@nlozgachev/pipelined/core";
import { Arr } from "@nlozgachev/pipelined/utils";

pipe([3, 1, 4, 1, 5], Arr.sortWith(Ordering.reverse(Ordering.number)));
// [5, 4, 3, 1, 1]
```

## Sorting by multiple fields

`Ordering.thenBy` chains two orderings: the second is used only when the first returns `0`:

```ts
type Employee = { department: string; salary: number };

const byDept   = pipe(Ordering.string, Ordering.by((e: Employee) => e.department));
const bySalary = pipe(Ordering.number, Ordering.by((e: Employee) => e.salary));

pipe(employees, Arr.sortWith(pipe(byDept, Ordering.thenBy(bySalary))));
// sorted by department; within the same department, sorted by salary ascending
```

## Extracting a field

`Ordering.by` adapts an ordering for type `A` into an ordering for type `B` by extracting the field
to compare:

```ts
type Product = { name: string; price: number };

const byPrice = pipe(Ordering.number, Ordering.by((p: Product) => p.price));
pipe(products, Arr.sortWith(byPrice)); // cheapest first
```

## Sorting with sortWith

`Arr.sortWith` accepts any `Ordering<A>` and returns a new sorted array without mutating the
original:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Ordering } from "@nlozgachev/pipelined/core";
import { Arr } from "@nlozgachev/pipelined/utils";

type User = { name: string; age: number };
const byAgeThenName = pipe(
  pipe(Ordering.number, Ordering.by((u: User) => u.age)),
  Ordering.thenBy(pipe(Ordering.string, Ordering.by((u: User) => u.name))),
);

pipe(
  [{ name: "Charlie", age: 25 }, { name: "Alice", age: 30 }, { name: "Bob", age: 25 }],
  Arr.sortWith(byAgeThenName),
);
// [{ name: "Bob", age: 25 }, { name: "Charlie", age: 25 }, { name: "Alice", age: 30 }]
// age ascending, then name ascending within the same age
```

## When to use Ordering

Use `Ordering<A>` when you need to sort structured values, sort by multiple fields, or reuse a
comparator across more than one call site. The primary entry point is `Arr.sortWith`. For cases
where you only need deduplication (not ordering), see `Equality<A>` and `Arr.uniqWith`.
