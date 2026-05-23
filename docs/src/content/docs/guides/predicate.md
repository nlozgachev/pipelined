---
title: Predicate — Composable Logic
description: Represent boolean checks as first-class, composable functions, combining, negating, and adapting them to richer data structures point-free.
---

Boolean checks are the structural foundation of control flow. We write them everywhere: inside
`Array.prototype.filter` callbacks, authorization gates, and conditional branch guards.

Typically, we write them as ad-hoc, inline lambda functions:

```ts
const activeAdultUsers = users.filter(
  (u) => u.age >= 18 && u.status === "active" && !u.banned,
);
```

While this works, it is entirely un-composable. If we need to negate this rule — for instance, to
find ineligible users — we are forced to wrap the entire block in `!(...)`. If we want to adapt this
exact check to operate on an `Order` (e.g., verifying if the customer placing the order is an active
adult) rather than a raw `User`, we must duplicate and rewrite the logic from scratch.

Our domain rules become scattered, hard to test in isolation, and tightly coupled to specific object
shapes.

`Predicate<A>` solves this. It is a simple type alias for a function that accepts an input `A` and
returns a `boolean`:

```ts
type Predicate<A> = (a: A) => boolean;
```

By representing boolean checks as first-class values, we can name them, negate them, combine them,
and adapt them to new shapes point-free.

---

## Predicate vs Refinement: How they compare

`Predicate<A>` and `Refinement<A, B>` are closely related. In fact, every `Refinement` is
structurally a `Predicate`. However, they serve different purposes in your design:

| Type                   | Type System Behavior                                                | Primary Use Case                                                                                 |
| :--------------------- | :------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------- |
| **`Predicate<A>`**     | None. The type remains `A` after the check has evaluated to `true`. | Standard domain checks where type narrowing is not needed (e.g., `isAdult`, `isAffordable`).     |
| **`Refinement<A, B>`** | Nrows the type to `B` inside successful conditional branches.       | Type guards where you must assert a stricter type safety boundary (e.g., `isString`, `isEmail`). |

`Predicate` has a major structural superpower: the `using` operator. It allows you to adapt simple
primitive checks to work on rich, deeply nested domain objects, which is extremely difficult to
express cleanly with `Refinement`.

If you need to mix a type guard into a simple boolean chain, you can lift it using
`Predicate.fromRefinement`.

---

## Negating logic with `not`

`not` inverts a predicate, returning a new `Predicate<A>` without any complex type-casting overhead:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Predicate } from "@nlozgachev/pipelined/core";

const isExpired: Predicate<Date> = (d) => d < new Date();
const isActive: Predicate<Date> = pipe(isExpired, Predicate.not);

isActive(new Date("2099-01-01")); // true
isActive(new Date("2000-01-01")); // false
```

---

## Combining with `and` and `or`

`and` and `or` allow you to combine two predicates over the same input type. Both combinators
**short-circuit** naturally at runtime: `and` stops evaluating the moment a check fails, while `or`
stops the moment a check succeeds.

```ts
const isAdult: Predicate<number> = (age) => age >= 18;
const isSenior: Predicate<number> = (age) => age >= 65;

const isWorkingAge: Predicate<number> = pipe(
  isAdult,
  Predicate.and(pipe(isSenior, Predicate.not)),
);

isWorkingAge(30); // true
isWorkingAge(15); // false (too young)
isWorkingAge(70); // false (retired)
```

By chaining `and` in a `pipe`, you describe complex rules as a highly readable checklist:

```ts
const isValidPassword: Predicate<string> = pipe(
  (s: string) => s.length >= 8,
  Predicate.and((s) => /[A-Z]/.test(s)),
  Predicate.and((s) => /[0-9]/.test(s)),
);
```

---

## Adapting context: using

`using` is the most powerful operator in the `Predicate` toolbox. It allows you to lift a
`Predicate<A>` to a `Predicate<B>` by providing a mapping function `B => A`.

This allows you to define core, atomic rules on primitive types, and project them onto rich domain
objects without rewriting the logic:

```ts
interface Product {
  name: string;
  price: number;
  inStock: boolean;
}

const isAffordable: Predicate<number> = (price) => price < 50;
const isInStock: Predicate<boolean> = (stock) => stock;

// Lift primitive checks to operate on Product:
const isAffordableProduct: Predicate<Product> = pipe(
  isAffordable,
  Predicate.using((p: Product) => p.price),
);

const isAvailableProduct: Predicate<Product> = pipe(
  isInStock,
  Predicate.using((p: Product) => p.inStock),
);

// Combine the lifted predicates:
const canPurchaseNow: Predicate<Product> = pipe(
  isAffordableProduct,
  Predicate.and(isAvailableProduct),
);
```

By writing your rules once on `number` and `boolean`, you keep the core math independent of your
data models. You can reuse `isAffordable` for checking an `Order`, a `ShippingFee`, or a `TaxRate`
simply by mapping the input with `using`.

---

## Variable-Length Lists: all and any

When combining a dynamic list of conditions, chaining `and`/`or` can become tedious. For this, we
use `all` and `any`.

`all` constructs a single predicate that requires every check in the array to pass:

```ts
const uploadRules: Predicate<File>[] = [
  (file) => file.size <= 5_000_000,
  (file) => file.name.endsWith(".png"),
  (file) => !file.name.includes("draft"),
];

const isValidUpload = Predicate.all(uploadRules);

isValidUpload(activeFile); // Returns true only if all three rules pass
```

`any` constructs a predicate that passes if at least one check in the array succeeds:

```ts
const allowedImageFormats: Predicate<string>[] = [
  (name) => name.endsWith(".png"),
  (name) => name.endsWith(".jpg"),
  (name) => name.endsWith(".webp"),
];

const isSupportedImage = Predicate.any(allowedImageFormats);
```

Both combinators short-circuit internally (using `Array.prototype.every` and
`Array.prototype.some`), ensuring that downstream checks are skipped as soon as the outcome is
determined.

---

## When to use Predicate

### Use Predicate when:

- **Combining simple checks**: You want to negate (`not`), intersect (`and`), or branch (`or`)
  boolean checks point-free without writing manual arrow wrappers.
- **Reusing primitive checks**: You want to define atomic logic on `string` or `number` and project
  it onto deeply nested records using `using`.
- **Aggregating rules**: You have a variable-length list of validation checks that must all pass
  (`all`) or of which at least one must pass (`any`).

### Keep using Refinement when:

- **Type narrowing is required**: You are asserting system boundaries (e.g. confirming that an
  `unknown` payload is a `User` or that a `string` is a branded `Email`), and subsequent pipeline
  steps require the narrowed type.
