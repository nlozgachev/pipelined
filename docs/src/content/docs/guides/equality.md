---
title: "Equality — composable equality checks"
description: First-class equality functions with built-in instances, field extraction, and logical combination.
---

Checking whether two values are equal is something every application does constantly — deduplicating
a list of records, comparing form state before saving, checking whether an item is already in a
selection. For primitive values, `===` works fine. For objects and arrays, it does not: two objects
with identical fields are not `===` to each other, and `===` on arrays compares references, not
contents.

You can write `JSON.stringify(a) === JSON.stringify(b)` or inline field comparisons, but those
do not compose — you cannot combine two equality checks into one, or adapt a string equality into
an object-field equality without rewriting it from scratch. `Equality<A>` makes equality checks
first-class values you can build, name, combine, and reuse.

## The Equality type

```ts
type Equality<A> = (a: A, b: A) => boolean;
```

An `Equality<A>` is a function that takes two values of type `A` and returns `true` if they are
equal. Any function with this signature is an `Equality<A>`.

## Built-in instances

The library ships instances for the common primitive types:

```ts
import { Equality } from "@nlozgachev/pipelined/core";

Equality.string("hello", "hello");  // true
Equality.number(42, 42);            // true
Equality.boolean(true, false);      // false
Equality.date(new Date("2024-01-01"), new Date("2024-01-01")); // true

// For arrays, pass the element equality:
const eqNumbers = Equality.array(Equality.number);
eqNumbers([1, 2, 3], [1, 2, 3]); // true
eqNumbers([1, 2], [1, 2, 3]);    // false
```

## Comparing by a field

`Equality.by` adapts an equality for type `A` into an equality for type `B` by extracting the
field to compare. Read it left-to-right: start with the inner equality (how to compare the
extracted value), then apply `.by` (how to get that value from the outer type):

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Equality } from "@nlozgachev/pipelined/core";

type Product = { id: string; name: string; price: number };

const byId = pipe(Equality.string, Equality.by((p: Product) => p.id));

byId({ id: "p1", name: "Widget", price: 9.99 }, { id: "p1", name: "Gadget", price: 14.99 });
// true — same id, different name and price
```

## Combining equality checks

`Equality.and` produces an equality that passes only when both constituent checks agree:

```ts
type User = { name: string; role: string };

const byName = pipe(Equality.string, Equality.by((u: User) => u.name));
const byRole = pipe(Equality.string, Equality.by((u: User) => u.role));
const exact  = pipe(byName, Equality.and(byRole));

exact({ name: "Alice", role: "admin" }, { name: "Alice", role: "admin" }); // true
exact({ name: "Alice", role: "admin" }, { name: "Alice", role: "user" });  // false
```

## Deduplicating with custom equality

`Arr.uniqWith` uses an `Equality<A>` to deduplicate an array. Unlike `Arr.uniq` (reference
equality) or `Arr.uniqBy` (key extraction), `uniqWith` accepts any equality check:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Equality } from "@nlozgachev/pipelined/core";
import { Arr } from "@nlozgachev/pipelined/utils";

type Event = { userId: string; type: string };
const byUserAndType = pipe(
  pipe(Equality.string, Equality.by((e: Event) => e.userId)),
  Equality.and(pipe(Equality.string, Equality.by((e: Event) => e.type))),
);

pipe(
  [{ userId: "u1", type: "click" }, { userId: "u2", type: "click" }, { userId: "u1", type: "click" }],
  Arr.uniqWith(byUserAndType),
); // [{ userId: "u1", type: "click" }, { userId: "u2", type: "click" }]
```

## When to use Equality

Use `Equality<A>` when you need to compare structured values — objects, arrays, or records — and
the built-in `===` comparison is insufficient or impossible to compose. The most common cases are
deduplication with `Arr.uniqWith`, diffing form state, and checking membership for complex types.

For comparisons that also carry ordering (less-than / greater-than), use `Ordering<A>`.
