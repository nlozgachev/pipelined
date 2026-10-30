---
title: Combinable — Combining Values
description: Package combining operations with their neutral starting points into first-class blueprints, simplifying collection reduction.
---

<!-- BUNDLE_SIZE:START -->

> 1.81 kB minified + gzipped

<!-- BUNDLE_SIZE:END -->

Aggregating collections of data is a fundamental task in software engineering. Summing an array of
invoice prices, concatenating list items into a single string, or merging a series of configuration
profiles are structurally identical operations.

In JavaScript, our standard tool for this is `Array.prototype.reduce`. While powerful, `reduce`
forces us to explicitly supply both the combining callback and the initial starting value at every
single call site:

```ts
const totalCost = items.reduce((sum, item) => sum + item.price, 0);
const fullText  = fragments.reduce((acc, str) => acc + str, "");
```

This leads to redundant, repetitive ceremony. If we want to sum numbers, we must write
`(acc, x) => acc + x` and `0`. If we want to multiply numbers, we must write `(acc, x) => acc * x`
and `1`. The combining logic and the starting value are decoupled, forcing the developer to track
both separately.

`Combinable<A>` packages these two related concerns into a single, reusable data structure:

```ts
type Combinable<A> = {
  readonly empty: A;
  readonly combine: (next: A) => (accumulated: A) => A;
};
```

- `empty` is the neutral starting element. Combining any value with `empty` yields the original
  value unchanged.
- `combine` is the data-last combining operation, taking the next element and appending it to the
  accumulated value.

By packaging the neutral starting value and the combining rule into a single reusable blueprint (a
pattern known in functional programming as a *Monoid*), we can reduce collections, merge nested
records, and accumulate optional values without repeating initial seeds at every call site.

---

## Built-In Aggregators

The library provides optimized, built-in combiners for standard primitives:

```ts
import { Combinable } from "@nlozgachev/pipelined";

// 1. Strings (empty: "")
Combinable.string.combine("/users")("https://api.example.com"); // "https://api.example.com/users"

// 2. Numbers (Sum vs Product)
// Both interpretations of combining numbers are equally valid, carrying different baselines:
Combinable.sum.combine(150)(350);       // 500 (empty: 0)
Combinable.product.combine(1.08)(1.10); // 1.188 (empty: 1)

// 3. Booleans (All vs Any)
Combinable.all.combine(true)(true);  // true (empty: true)
Combinable.any.combine(true)(false); // true (empty: false)

// 4. Arrays
Combinable.array<string>().combine(["read:billing"])(["read:profile"]);
// ["read:profile", "read:billing"]
```

Notice the numbers example. Summation and multiplication are both mathematically valid ways to
combine numbers, but they require different baseline elements (`0` for sum, `1` for product). By
using `Combinable.sum` or `Combinable.product`, we make our exact aggregation intent explicit in our
code.

---

## Combining Collections: combineAll

`Combinable.combineAll` accepts a `Combinable<A>` and returns a single-argument function
`(items: readonly A[]) => A` that folds an entire array into one value using the `Combinable`'s
neutral `empty` value as the starting point:

```ts
import { pipe } from "@nlozgachev/pipelined";

// Concatenating path segments
const pathSegments = ["/v1", "/organizations", "/billing"];
pipe(pathSegments, Combinable.combineAll(Combinable.string)); // "/v1/organizations/billing"

// Summing invoice line totals (in cents)
const lineTotals = [1200, 3400, 850];
pipe(lineTotals, Combinable.combineAll(Combinable.sum)); // 5450

// Compounding multiplier factors
const growthFactors = [1.05, 1.10, 1.02];
pipe(growthFactors, Combinable.combineAll(Combinable.product)); // 1.1781

// Combining an empty array returns the baseline "empty" value:
pipe([], Combinable.combineAll(Combinable.sum)); // 0
```

---

## Merging Structured Records: struct

When aggregating objects with multiple fields — such as service telemetry snapshots, shopping cart
summaries, or permission sets — different fields often require different combining rules.
`Combinable.struct` builds a `Combinable` for an entire record from field-level `Combinable`
definitions:

```ts
interface ServiceMetrics {
  requests: number;
  errors: number;
  allHealthy: boolean;
  warnings: readonly string[];
}

const MetricsCombinable: Combinable<ServiceMetrics> = Combinable.struct({
  requests: Combinable.sum,
  errors: Combinable.sum,
  allHealthy: Combinable.all,
  warnings: Combinable.array<string>(),
});

const regionSnapshots: ServiceMetrics[] = [
  { requests: 1200, errors: 2, allHealthy: true, warnings: ["High memory on node-1"] },
  { requests: 950, errors: 0, allHealthy: true, warnings: [] },
  { requests: 400, errors: 5, allHealthy: false, warnings: ["Timeout in eu-central"] },
];

const globalMetrics = pipe(
  regionSnapshots,
  Combinable.combineAll(MetricsCombinable),
);
// {
//   requests: 2550,
//   errors: 7,
//   allHealthy: false,
//   warnings: ["High memory on node-1", "Timeout in eu-central"]
// }
```

---

## Combining Optional Values: maybe

Often, the values we want to combine are optional, represented by `Maybe<A>`. `Combinable.maybe`
lifts a `Combinable<A>` to operate safely over `Maybe<A>` values:

```ts
import { Maybe } from "@nlozgachev/pipelined";

const maybeSum = Combinable.maybe(Combinable.sum);

// None acts as the neutral element:
maybeSum.combine(Maybe.make.some(30))(Maybe.make.some(20)); // Some(50)
maybeSum.combine(Maybe.make.none())(Maybe.make.some(50));   // Some(50)
maybeSum.combine(Maybe.make.some(50))(Maybe.make.none());   // Some(50)
```

This makes combining collections of optional domain fields clean and predictable:

```ts
const optionalDiscounts = [
  Maybe.make.some(10),
  Maybe.make.none(),
  Maybe.make.some(20),
];

const totalDiscount = pipe(
  optionalDiscounts,
  Combinable.combineAll(Combinable.maybe(Combinable.sum)),
); // Some(30)
```

---

## Problems it solves

- **Aggregating distributed telemetry and metric reports**: In telemetry and reporting services,
  merging multiple event payloads (such as summing total request counts, combining latency tallies,
  and aggregating error counts) often requires repetitive reducer loops. `Combinable.struct`
  combines complex metric records automatically based on field-level rules.
- **Hierarchical configuration merging**: In applications loading layered configurations (such as
  default settings overlaid with environment variables and tenant-specific overrides),
  `Combinable.struct` merges configuration layers cleanly while preserving immutability.
- **Aggregating sparse or optional metrics (`Combinable.maybe`)**: Folding streams of optional data
  (such as user ratings or partial session durations) where missing values (`None`) are safely
  ignored while valid numbers are accumulated.
- **Reusable collection reduction strategies**: Instead of re-writing `Array.prototype.reduce`
  callbacks with manual initial values across multiple call sites, `Combinable` provides named,
  reusable aggregation strategies (`Combinable.sum`, `Combinable.array`, `Combinable.maybe`) for
  direct list reduction via `Combinable.combineAll`.
