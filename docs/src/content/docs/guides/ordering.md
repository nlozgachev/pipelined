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
import { Arr } from "@nlozgachev/pipelined/utils";

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

## When to use Ordering

### Use Ordering when:

- **Sorting by multiple criteria**: You want to chain multiple sort keys and tiebreakers point-free.
- **Executing immutable sorts**: You are sorting arrays inside reactive pipelines where mutating the
  original source would trigger unintended rendering bugs.
- **Adapting nested properties**: You want to reuse core primitive comparators across complex object
  shapes using `by`.

### Keep using standard arrow inline functions when:

- **Executing a single, local sort**: You are sorting a primitive array (like numbers) within a
  narrow, one-off synchronous scope where structural composition is unnecessary.
