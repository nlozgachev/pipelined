---
title: Ordering — Composable Comparators
description: Model sorting and comparisons structurally, combining sort comparators and tiebreaker rules point-free.
---

Sorting a collection is straightforward when we only care about a single, simple field:

```ts
// Cheapest first:
products.sort((a, b) => a.price - b.price);
```

However, as soon as we need to sort across multiple criteria — say, grouping employees by
department, and then sorting by salary within each department — our code quickly becomes cluttered
with manual tiebreaker logic:

```ts
// Manual sorting with tiebreaker logic:
employees.sort((a, b) => {
  const deptCompare = a.department.localeCompare(b.department);
  if (deptCompare !== 0) {
    return deptCompare;
  }
  return a.salary - b.salary;
});
```

This code is verbose, tedious to write, and prone to copy-paste bugs. Crucially, these comparators
**do not compose**. You cannot take an existing `byDepartment` checker and a `bySalary` checker and
combine them into a third comparator without rewriting the nested logic from scratch.

`Ordering<A>` solves this problem. It represents a first-class, pure comparator:

```ts
type Ordering<A> = (a: A, b: A) => number;
```

A positive return number means the first element comes after the second; a negative number means it
comes before; and zero indicates a tie. Because `Ordering` matches the standard JavaScript
comparator signature, it is 100% compatible with native runtime APIs.

---

## Built-In Ordering Instances

The library provides optimized, built-in ordering instances for primitive types:

```ts
import { Ordering } from "@nlozgachev/pipelined/core";

Ordering.string("apple", "banana"); // Negative ("apple" comes first)
Ordering.number(42, 10);            // Positive (42 comes after 10)
Ordering.date(new Date("2026-05-24"), new Date("2026-05-24")); // Zero (tie)
```

---

## Reversing Sort Order: reverse

`Ordering.reverse` flips the sorting direction of any existing comparator:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Arr } from "@nlozgachev/pipelined/data";

// Sorts integers in descending order:
const descending = Ordering.reverse(Ordering.number);

const sorted = pipe([3, 1, 4, 1, 5], Arr.sortWith(descending)); // [5, 4, 3, 1, 1]
```

---

## Adapting Keys: by

`Ordering.by` adapts an ordering checker designed for a simpler type `A` so that it operates on a
richer type `B` by extracting the field to compare:

```ts
interface Product {
  name: string;
  price: number;
}

// Order products by price ascending:
const byPrice: Ordering<Product> = pipe(
  Ordering.number,
  Ordering.by((p: Product) => p.price),
);
```

---

## Combining Comparators: thenBy

`Ordering.thenBy` allows you to chain two ordering checkers together, using the second checker as a
**tiebreaker** only when the first check evaluates to a tie (`0`):

```ts
interface Employee {
  department: string;
  salary: number;
}

const byDept = pipe(Ordering.string, Ordering.by((e: Employee) => e.department));
const bySalary = pipe(Ordering.number, Ordering.by((e: Employee) => e.salary));

// Sort by department, then by salary within each department:
const byDeptAndSalary: Ordering<Employee> = pipe(
  byDept,
  Ordering.thenBy(bySalary),
);
```

---

## Multi-Column Sorting: byFields

When you need to aggregate an arbitrary list of field comparators — such as multi-column data tables
where users can sort by dynamic combinations of columns — `Ordering.byFields` combines an array of
`Ordering<A>` instances into a single composite comparator:

```ts
const byDepartment = pipe(Ordering.string, Ordering.by((e: Employee) => e.department));
const bySalary = pipe(Ordering.number, Ordering.by((e: Employee) => e.salary));
const byName = pipe(Ordering.string, Ordering.by((e: Employee) => e.name));

// Combines an array of field comparators into a single ordering:
const multiColumnSort: Ordering<Employee> = Ordering.byFields([
  byDepartment,
  bySalary,
  byName,
]);
```

It evaluates each comparator sequentially until it finds a non-zero comparison result,
short-circuiting early once a tie is broken.

---

## Practical Application: Immutable Sorting

`Arr.sortWith` accepts any `Ordering<A>` instance and returns a **fresh, sorted array**, avoiding
the mutability issues associated with JavaScript’s native `Array.prototype.sort`:

```ts
interface User {
  name: string;
  age: number;
}

const byAgeThenName: Ordering<User> = pipe(
  pipe(Ordering.number, Ordering.by((u: User) => u.age)),
  Ordering.thenBy(pipe(Ordering.string, Ordering.by((u: User) => u.name))),
);

const users = [
  { name: "Charlie", age: 25 },
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 },
];

const sortedUsers = pipe(
  users,
  Arr.sortWith(byAgeThenName),
);
// [
//   { name: "Bob", age: 25 },
//   { name: "Charlie", age: 25 },
//   { name: "Alice", age: 30 }
// ]
```

---

## Problems it solves

- **Multi-column table sorting with tiebreakers**: In data grids and table views, users frequently
  sort records by multiple criteria (such as status first, then created date descending, then name
  ascending). Writing chained ternary comparator callbacks manually is error-prone. `Ordering.by`
  and `Ordering.then` combine atomic sorting rules into readable tiebreaker pipelines.
- **Preventing in-place array mutation**: Native `Array.prototype.sort()` mutates the source array
  in place, causing race conditions and UI state bugs in reactive stores. Pairing `Ordering`
  comparators with `Arr.sortWith` produces a new sorted array while preserving the original dataset
  immutably.
- **Custom priority hierarchies and status rankings**: Sorting domain entities by non-alphabetical
  business rules (such as `urgent` > `high` > `medium` > `low`) with composable custom comparators.
- **Reusable and reversible comparator definitions**: Instead of redefining inline sorting callbacks
  across different endpoints and components, `Ordering` allows domain comparators (such as
  chronological order or priority rankings) to be named, shared, and reversed via
  `Ordering.reverse`.
