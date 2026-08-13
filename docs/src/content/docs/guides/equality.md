---
title: Equality — Composable Equality Checks
description: Model value equivalence structurally, replacing pointer-based reference checks and fragile JSON stringification with composable equality checkers.
---

Checking whether two values are equal is one of the most common requirements in software
development. We do it to deduplicate arrays of items, detect changes in a user profile before
saving, or confirm if an asset is already in a local collection.

For primitive types like strings, numbers, or booleans, JavaScript’s built-in `===` operator works
perfectly. However, for structured objects, arrays, and dates, `===` fails to capture our intent:

```ts
const userA = { id: "123", name: "Alice" };
const userB = { id: "123", name: "Alice" };

console.log(userA === userB); // false (compares reference pointers, not values)
```

Two objects holding identical fields are not equal in standard JavaScript because they occupy
different locations in memory. Similarly, two `Date` objects representing the exact same millisecond
will evaluate to `false` when compared with `===`.

To solve this, we often resort to serializing objects with
`JSON.stringify(a) === JSON.stringify(b)`. But serialization is slow, fragile (it fails if keys are
written in a different order), and structurally incapable of handling functions, dates, or custom
maps. Alternatively, we write one-off comparison functions by hand, but they do not compose — you
cannot combine two checkers into one, or lift a string checker to compare record fields without
writing new boilerplate from scratch.

`Equality<A>` solves this mismatch. It represents a first-class, pure description of equivalence:

```ts
type Equality<A> = (a: A, b: A) => boolean;
```

Any binary function matching this signature is a valid `Equality` checker. By treating equality as a
composable value, we can construct, name, and combine equivalence checkers point-free.

---

## Built-In Equivalence Instances

The library provides optimized, built-in instances for common primitive types:

```ts
import { Equality } from "@nlozgachev/pipelined/core";

Equality.string("hello", "hello"); // true
Equality.number(42, 42);           // true
Equality.boolean(true, false);     // false
Equality.date(new Date("2026-01-01"), new Date("2026-01-01")); // true
```

### Deep Array Equivalence

To compare arrays, we pass the element-level equivalence checker to `Equality.array`:

```ts
const eqNumberArray = Equality.array(Equality.number);

eqNumberArray([1, 2, 3], [1, 2, 3]); // true
eqNumberArray([1, 2], [1, 2, 3]);    // false
```

---

## Comparing by Fields: by

`Equality.by` adapts an equality checker designed for type `A` to operate on a richer type `B` by
extracting the target field to compare:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

interface Product {
  id: string;
  name: string;
  price: number;
}

// Compare two products solely by their unique identifier:
const productEqById: Equality<Product> = pipe(
  Equality.string,
  Equality.by((p: Product) => p.id),
);

productEqById(
  { id: "widget_abc", name: "Heavy Widget", price: 9.99 },
  { id: "widget_abc", name: "Sleek Widget", price: 14.99 },
); // true (same identifier, ignoring name and price changes)
```

---

## Combining Checks: and

When we need to assert that two complex objects are equivalent across multiple different fields, we
combine their respective checkers using `and`:

```ts
interface User {
  name: string;
  role: string;
}

const eqByName = pipe(Equality.string, Equality.by((u: User) => u.name));
const eqByRole = pipe(Equality.string, Equality.by((u: User) => u.role));

// Combines both checkers:
const eqUserExact: Equality<User> = pipe(
  eqByName,
  Equality.and(eqByRole),
);

eqUserExact(
  { name: "Alice", role: "admin" },
  { name: "Alice", role: "admin" },
); // true

eqUserExact(
  { name: "Alice", role: "admin" },
  { name: "Alice", role: "member" },
); // false (names match, but roles differ)
```

---

## Practical Application: Custom Deduplication

`Arr.uniqWith` accepts any `Equality<A>` instance to remove duplicate values from a collection,
allowing you to deduplicate complex objects structurally:

```ts
import { Arr } from "@nlozgachev/pipelined/data";

interface LogEvent {
  userId: string;
  action: string;
}

const eqEventByUserAndAction: Equality<LogEvent> = pipe(
  pipe(Equality.string, Equality.by((e: LogEvent) => e.userId)),
  Equality.and(pipe(Equality.string, Equality.by((e: LogEvent) => e.action))),
);

const rawEvents = [
  { userId: "user_1", action: "click" },
  { userId: "user_2", action: "click" },
  { userId: "user_1", action: "click" }, // Duplicate structural event
];

const uniqueEvents = pipe(
  rawEvents,
  Arr.uniqWith(eqEventByUserAndAction),
);
// [ { userId: "user_1", action: "click" }, { userId: "user_2", action: "click" } ]
```

---

## Problems it solves

- **UI change detection without redundant re-renders**: In UI component memoization (such as React
  `memo` or custom state selectors), comparing object props with `===` triggers false-positive
  renders because fresh object references are created on each pass. `Equality.struct` and
  `Equality.array` compare fields structurally, preventing unnecessary re-renders.
- **Deduplicating event streams by compound keys**: When filtering activity feeds or telemetry
  queues, deduplicating items based on multiple fields (such as `userId` + `action` + `entityId`)
  requires explicit equality definitions. `Equality.struct` and `Equality.and` compose field
  comparators for use with collection helpers like `Arr.uniqWith`.
- **Projected property and normalized comparisons (`Equality.by`)**: Comparing domain models by
  specific projected properties (such as comparing users by email address case-insensitively, or
  orders by currency value) without writing repetitive equality callbacks.
- **Accurate Date and value-object comparisons**: Comparing JavaScript `Date` instances with `===`
  tests reference identity rather than chronological time, causing identical dates to evaluate as
  unequal. `Equality.date` provides accurate timestamp comparisons across domain models.
