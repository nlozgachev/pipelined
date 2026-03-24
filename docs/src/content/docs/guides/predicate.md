---
title: "Predicate — composable boolean checks"
description: First-class boolean functions with not, and, or, using, and Refinement interop.
---

When you reach for `Array.filter`, `if` branches, or access-control gates, you are writing
predicates. Usually they are anonymous inline functions: `n => n > 0`, `u => u.role === "admin"`.
They work, but they don't _compose_. You can't take two boolean functions and combine them into a
third without writing a new function by hand each time. `Predicate<A>` makes boolean checks
first-class values you can name, reuse, negate, combine, and adapt to new types.

## The problem with ad-hoc boolean functions

Combining checks inline is fine for a single call site, but it doesn't scale:

```ts
// To reuse this later you have to extract and name it yourself every time
const eligible = users.filter(
	u => u.age >= 18 && u.subscription === "active" && !u.banned,
);

// Negating requires wrapping the whole expression
const ineligible = users.filter(
	u => !(u.age >= 18 && u.subscription === "active" && !u.banned),
);

// Adapting to a different type means rewriting the check
const eligibleOrders = orders.filter(
	o => o.customer.age >= 18 && o.customer.subscription === "active" && !o.customer.banned,
);
```

Each variation is a one-off. There's no way to name the "is eligible" concept once and reuse it,
negate it, or lift it to work on `Order` as well as `User`.

## The Predicate type

```ts
type Predicate<A> = (a: A) => boolean;
```

A `Predicate<A>` is just a typed alias for a boolean function. No wrapper, no allocation — the
namespace provides utilities for combining and adapting these functions.

## Predicate vs Refinement — when to use which

`Refinement<A, B>` and `Predicate<A>` are closely related: every `Refinement<A, B>` is a
`Predicate<A>`. The difference is what they tell the compiler:

|                    | Compile-time effect                              | Use when                                                          |
| ------------------ | ------------------------------------------------ | ----------------------------------------------------------------- |
| `Predicate<A>`     | None — TypeScript still sees `A` after the check | You only need the boolean result and don't require type narrowing |
| `Refinement<A, B>` | Narrows to `B` in the `true` branch              | You need TypeScript to track the stricter type                    |

In short: reach for `Refinement` when compile-time narrowing matters (e.g. `isString`, `isUser`),
and for `Predicate` when you just need the boolean (e.g. `isAdult`, `isExpired`, `hasPermission`).
A key advantage of `Predicate` is `using` — it can adapt checks to any input shape, which
`Refinement` cannot express cleanly.

Convert a `Refinement` to a `Predicate` with `Predicate.fromRefinement` when you want to compose a
narrowing check alongside plain predicates in `and`, `or`, or `all`.

## Negating with `not`

`not` inverts a predicate. The result is still a `Predicate<A>` with no type-level side effects,
so there is no `Exclude<A, B>` complexity.

```ts
const isExpired: Predicate<Date> = (d) => d < new Date();
const isActive: Predicate<Date> = Predicate.not(isExpired);

isActive(new Date("2099-01-01")); // true
isActive(new Date("2000-01-01")); // false
```

`not` works as a direct transformer in `pipe`:

```ts
const isActive = pipe(isExpired, Predicate.not);
```

## Combining with `and` and `or`

`and` and `or` are data-last, composing two predicates over the same input type. Both
short-circuit: `and` stops as soon as the first check fails, `or` stops as soon as the first check
passes.

```ts
const isAdult: Predicate<number> = (age) => age >= 18;
const isSenior: Predicate<number> = (age) => age >= 65;

const isWorkingAge: Predicate<number> = pipe(
	isAdult,
	Predicate.and(Predicate.not(isSenior)),
);

isWorkingAge(30); // true
isWorkingAge(15); // false — too young
isWorkingAge(70); // false — retired
```

Building up a chain of checks reads left to right in `pipe`:

```ts
const isValidPassword: Predicate<string> = pipe(
	(s: string) => s.length >= 8,
	Predicate.and(s => /[A-Z]/.test(s)),
	Predicate.and(s => /[0-9]/.test(s)),
);
```

## Adapting the input type with `using`

`using` is what distinguishes `Predicate` from a plain function. It lifts a `Predicate<A>`
to a `Predicate<B>` by providing a function `B → A` that extracts the relevant part of `B`.
The check itself doesn't change — only the type it operates on does.

```ts
type Product = { name: string; price: number; inStock: boolean; };

const isAffordable: Predicate<number> = (price) => price < 50;
const isInStock: Predicate<boolean> = (b) => b;

const isAffordableProduct: Predicate<Product> = pipe(
	isAffordable,
	Predicate.using((p: Product) => p.price),
);

const isAvailableProduct: Predicate<Product> = pipe(
	isInStock,
	Predicate.using((p: Product) => p.inStock),
);

const canBuyNow: Predicate<Product> = pipe(
	isAffordableProduct,
	Predicate.and(isAvailableProduct),
);
```

The same base predicates (`isAffordable`, `isInStock`) are reused across different contexts — you
don't rewrite them for each type that contains a price or a stock flag.

`using` chains are also useful when your data is nested:

```ts
type Order = { customer: { tier: string; }; };

const isPremiumTier: Predicate<string> = (tier) => tier === "premium";
const isPremiumOrder: Predicate<Order> = pipe(
	isPremiumTier,
	Predicate.using((c: { tier: string; }) => c.tier),
	Predicate.using((o: Order) => o.customer),
);
```

## Combining many checks with `all` and `any`

When you have an array of checks to apply, `all` (every check must pass) and `any` (at least one
must pass) are cleaner than chaining `and`/`or`.

```ts
const contentRules: Predicate<string>[] = [
	(s) => s.length > 0,
	(s) => s.length <= 500,
	(s) => !/<script/i.test(s),
	(s) => !s.includes("\0"),
];

const isSafeContent = Predicate.all(contentRules);

isSafeContent("Hello world"); // true
isSafeContent(""); // false — too short
isSafeContent("<script>...</script>"); // false — rejected pattern
```

`any` is useful for allowing a set of alternative conditions:

```ts
const allowedExtensions: Predicate<string>[] = [
	(name) => name.endsWith(".jpg"),
	(name) => name.endsWith(".jpeg"),
	(name) => name.endsWith(".png"),
	(name) => name.endsWith(".webp"),
];

const isAcceptedImage = Predicate.any(allowedExtensions);

isAcceptedImage("banner.png"); // true
isAcceptedImage("script.exe"); // false
```

Both `all` and `any` short-circuit internally (`Array.every` and `Array.some`) so predicates that
come later in the array are skipped once the result is determined.

## Bridging from Refinement with `fromRefinement`

When you need to combine a type guard with plain predicates, convert it first:

```ts
const isString: Refinement<unknown, string> = Refinement.make((x) => typeof x === "string");

const isShortString: Predicate<unknown> = pipe(
	Predicate.fromRefinement(isString),
	Predicate.and((x) => (x as string).length < 20),
);

isShortString("hello"); // true
isShortString(42); // false — not a string
isShortString("a very long string that exceeds the limit"); // false — too long
```

This is a one-way conversion: once you have a `Predicate`, the narrowing information is gone. If
you need the narrowed type downstream, keep the value as a `Refinement` and use
`Refinement.toFilter` or `Refinement.toResult` instead.

## When to use Predicate

- You need to negate, combine, or pass around boolean checks as values, and you don't require
  compile-time type narrowing.
- You want to lift a check from a primitive type (number, string) to a richer domain type
  (`User`, `Product`, `Order`) using `using`.
- You have a variable-length list of conditions to apply uniformly with `all` or `any`.
- You want to mix a type guard (`Refinement`) with plain checks in a single composition.

**Keep using a `Refinement<A, B>` when** the narrowed type needs to flow into subsequent operations
— for example when you want `Maybe<NonEmptyString>` from `toFilter`, or `Result<E, ValidEmail>`
from `toResult`. `Predicate` discards that information; `Refinement` preserves it.
