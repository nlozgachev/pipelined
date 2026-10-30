---
title: Num — Number Utilities
description: Curried arithmetic, safe parsing, rounding, formatting, clamping, range generation, and array aggregations designed for pipelines.
---

<!-- BUNDLE_SIZE:START -->

> 2.02 kB minified + gzipped

<!-- BUNDLE_SIZE:END -->

Working with numbers in standard JavaScript or TypeScript often leads to code cluttered with inline
arrow functions, manual `Number.isNaN` checks, and silent runtime traps:

1. **Silent `NaN` and `Infinity` propagation**: Parsing an invalid string with `Number("abc")`
   produces `NaN`, and dividing `100 / 0` produces `Infinity`. Both values have the TypeScript type
   `number`, allowing corrupted math to spread silently into database writes or UI displays.
2. **Unsafe empty collection aggregates**: Calling `Math.min(...items)` on an empty array evaluates
   to `Infinity`, `Math.max(...items)` evaluates to `-Infinity`, and computing an average via
   `sum / items.length` produces `NaN` when `items` is empty.
3. **Verbose inline math in pipelines**: Applying arithmetic, clamping bounds, or formatting
   currencies inside a `pipe` requires repetitive inline functions like
   `n => Math.max(0, Math.min(100, n))`.

```ts
function parseSliderValue(rawInput: string | undefined): number {
  if (rawInput === undefined) {
    return 50;
  }
  const parsed = parseFloat(rawInput);
  if (isNaN(parsed)) {
    return 50;
  }
  return Math.max(0, Math.min(100, parsed));
}
```

`Num` replaces these imperative checks and silent failure modes with declarative, curried,
**data-last** operations that model failure boundaries — such as unparseable strings, division by
zero, or empty array aggregations — explicitly using `Maybe<number>`.

---

## Safe Numeric Parsing

To convert a string into a number without encountering the `NaN` trap or accepting blank whitespace
as `0` (which `Number("   ")` does in standard JavaScript), use `Num.from.string`. It returns
`Some(number)` for valid numeric strings and `None` for empty, whitespace-only, or malformed text:

```ts
import { Num } from "@nlozgachev/pipelined/data";

Num.from.string("42");   // Some(42)
Num.from.string("3.14"); // Some(3.14)
Num.from.string("abc");  // None
Num.from.string("   ");  // None (avoids JavaScript's Number("   ") === 0 coercion trap)
```

---

## Curried Arithmetic and Safe Division

Arithmetic functions in `Num` are curried and place the target number last so they compose directly
inside `pipe` and `Arr.map`. In particular, `Num.subtract(amount)(from)` computes `from - amount`,
reading naturally in a pipeline as "subtract `amount`":

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Arr, Num } from "@nlozgachev/pipelined/data";

// Add a flat shipping surcharge:
const withShipping = pipe(
  [25, 50, 75],
  Arr.map(Num.add(5)),
); // [30, 55, 80]

// Subtract a promotional discount (from - amount):
const discounted = pipe(
  [100, 200, 300],
  Arr.map(Num.subtract(15)),
); // [85, 185, 285]

// Scale unit prices by tax multiplier:
const withTax = pipe(
  [10, 20, 30],
  Arr.map(Num.multiply(1.2)),
); // [12, 24, 36]
```

For unary sign adjustments, `Num.abs` returns the non-negative magnitude of a number and
`Num.negate` flips its sign:

```ts
pipe(-42, Num.abs);   // 42
pipe(15, Num.negate); // -15
```

To prevent division by zero from introducing `Infinity` or `NaN`, `Num.divide(divisor)(dividend)`
and `Num.remainder(divisor)(dividend)` return `Maybe<number>`, yielding `None` whenever `divisor` is
`0`:

```ts
// Safe division (dividend / divisor):
pipe(100, Num.divide(5)); // Some(20)
pipe(100, Num.divide(0)); // None

// Safe remainder (dividend % divisor):
pipe(10, Num.remainder(3)); // Some(1)
pipe(10, Num.remainder(0)); // None
```

---

## Rounding

When converting fractional calculations into whole integers — such as calculating cent amounts, page
counts, or pixel coordinates — `Num.round`, `Num.floor`, and `Num.ceil` provide composable wrappers
around standard rounding rules:

```ts
pipe(19.6, Num.round); // 20 (nearest integer)
pipe(19.4, Num.round); // 19

pipe(19.9, Num.floor); // 19 (rounds down)
pipe(19.1, Num.ceil);  // 20 (rounds up)
```

---

## Constraining and Testing Bounds

Use `Num.clamp` to restrict a number to an inclusive `[min, max]` interval, `Num.between` to test
membership in a closed `[min, max]` interval, and `Num.inRange` to test membership in a half-open
`[start, end)` interval (where `start` is included and `end` is excluded):

```ts
// Constrain a percentage to [0, 100]:
pipe(150, Num.clamp(0, 100)); // 100
pipe(-5, Num.clamp(0, 100));  // 0
pipe(42, Num.clamp(0, 100));  // 42

// Closed range check [min, max]:
pipe(50, Num.between(10, 50)); // true (50 is included)

// Half-open range check [start, end):
pipe(50, Num.inRange(10, 50)); // false (50 is excluded)
pipe(25, Num.inRange(10, 50)); // true
```

---

## Numeric Predicates (`Num.is`)

The `Num.is` namespace provides boolean predicates for inspecting numeric properties inside
pipelines and array filters:

```ts
Num.is.zero(0);        // true
Num.is.integer(42);    // true
Num.is.float(3.14);    // true (finite and non-integer)
Num.is.finite(100);    // true (false for Infinity, -Infinity, and NaN)
Num.is.nan(NaN);       // true
Num.is.even(4);        // true
Num.is.odd(3);         // true
Num.is.positive(5);    // true (strictly > 0)
Num.is.negative(-5);   // true (strictly < 0)

const validQuantities = pipe(
  [-2, 0, 1.5, 3, 8],
  Arr.filter(Num.is.positive),
  Arr.filter(Num.is.integer),
); // [3, 8]
```

---

## Generating Sequences

To generate an inclusive sequence of numbers without manual `for` loops,
`Num.range(from, to, step?)` builds a readonly array stepping by `step` (default `1`). If
`from > to`, `step <= 0`, or any argument is non-finite, it safely returns an empty array `[]`:

```ts
Num.range(1, 5);     // [1, 2, 3, 4, 5]
Num.range(0, 10, 2); // [0, 2, 4, 6, 8, 10]
Num.range(0, 9, 2);  // [0, 2, 4, 6, 8]
Num.range(5, 1);     // []
```

---

## Safe Collection Aggregations

`Num` provides collection reducers that handle empty arrays safely without returning `Infinity` or
`NaN`. `Num.sum` returns `0` for an empty list, while `Num.mean`, `Num.min`, and `Num.max` return
`Maybe<number>`:

```ts
Num.sum([10, 20, 30]);  // 60
Num.sum([]);            // 0

Num.mean([10, 20, 30]); // Some(20)
Num.mean([]);           // None

Num.min([5, 12, 3]);    // Some(3)
Num.min([]);            // None

Num.max([5, 12, 3]);    // Some(12)
Num.max([]);            // None
```

---

## Locale-Aware Formatting

When presenting numbers in a UI or report, `Num.format(options?, locales?)` wraps
`Intl.NumberFormat` in a curried, safe function. Because formatting `NaN` or `Infinity` into user
interfaces is almost always a bug, `Num.format` returns `Some(formattedString)` for finite numbers
and `None` for `NaN`, `Infinity`, or `-Infinity`:

```ts
const formatUsd = Num.format({ style: "currency", currency: "USD" }, "en-US");

pipe(1249.5, formatUsd);   // Some("$1,249.50")
pipe(NaN, formatUsd);      // None
pipe(Infinity, formatUsd); // None
```

---

## Pipeline Composition

We can combine parsing, filtering, clamping, arithmetic, aggregation, and formatting into a single
pipeline. Here, we process raw discount percentages from a configuration payload, clamp them to the
permitted `[0, 50]` range, compute the average discount, and format it for display:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";
import { Arr, Num } from "@nlozgachev/pipelined/data";

const rawDiscounts = ["15", "invalid", "60", "25", "10"];

const averageDiscountLabel = pipe(
  rawDiscounts,
  Arr.filterMap(Num.from.string), // [15, 60, 25, 10]
  Arr.map(Num.clamp(0, 50)),      // [15, 50, 25, 10]
  Num.mean,                       // Some(25)
  Maybe.map(Num.round),           // Some(25)
  Maybe.chain(
    Num.format({ style: "unit", unit: "percent" }, "en-US"),
  ),                              // Some("25%")
  Maybe.getOrElse(() => "0%"),
); // "25%"
```

---

## Problems it solves

- **Sanitizing and clamping untrusted numeric inputs**: When extracting pagination offsets, page
  limits, or price filter boundaries from query strings, numbers can be malformed or fall outside
  permitted domain ranges. `Num.from.string` and `Num.clamp` sanitize and constrain values directly
  in pipeline workflows.
- **Safe statistical computations without `Infinity` or `NaN`**: Calling standard functions like
  `Math.min()` on an empty collection returns `Infinity`, while dividing by an empty list length
  yields `NaN`. `Num.min`, `Num.max`, and `Num.mean` return `Maybe<number>`, guaranteeing that empty
  datasets are handled explicitly.
- **Division-by-zero protection in progress and ratio calculations**: Calculating task percentages
  (e.g. `completed / total`) when `total === 0` produces `NaN` or `Infinity` in standard JavaScript,
  causing broken UI progress bars. `Num.divide` and `Num.remainder` guard against division by zero
  safely.
- **Safe locale formatting (`Num.format`)**: Formatting numbers into currencies, units, or compact
  notation via `Intl.NumberFormat` while automatically rejecting `NaN` and `Infinity` values as
  `None`.
- **Linear mathematical pipelines**: In shopping cart calculations, rate adjustments, and layout
  engines, combining arithmetic and rounding operations (`Num.add`, `Num.subtract`, `Num.multiply`,
  `Num.abs`, `Num.negate`, `Num.round`, `Num.floor`, `Num.ceil`) inside `pipe` keeps mathematical
  transformations readable without temporary variables.
