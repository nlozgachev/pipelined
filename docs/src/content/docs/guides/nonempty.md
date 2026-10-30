---
title: Non-Empty Collections — Compile-Time Guarantees
description: Prevent boundary errors and eliminate defensive checks with compile-time guarantees that a collection, string, or record contains at least one element.
---

Functions that operate on collections often assume at least one element exists (such as `head`,
`min`, `max`, or bulk database inserts). Because standard arrays (`readonly T[]`) can be empty,
functions must either return `undefined`, throw runtime errors, or require defensive length checks.

`NonEmpty` provides compile-time branded types—`Arr.NonEmpty<A>`, `Str.NonEmpty`,
`Uniq.NonEmpty<A>`, `Dict.NonEmpty<K, V>`, and `Rec.NonEmpty<A, K>`—guaranteeing that a collection
or string contains at least one element:

```ts
function getFirstItem<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("List cannot be empty");
  }
  return items[0];
}

function getFirstValue<T>(record: Record<string, T>): T {
  const values = Object.values(record);
  if (values.length === 0) {
    throw new Error("Record cannot be empty");
  }
  return values[0];
}
```

Every access to the head of a potentially empty collection is unsafe. `pipelined` solves this by
introducing compile-time type-level guarantees that collections, strings, sets, or maps contain at
least one element: `Arr.NonEmpty`, `Rec.NonEmpty`, `Uniq.NonEmpty`, `Dict.NonEmpty`, and
`Str.NonEmpty`.

---

## Type Structure

Non-empty collections are represented directly using TypeScript structural types:

- **`Arr.NonEmpty<A>`**: Represented as a structural read-only tuple structure
  `readonly [A, ...A[]]`. Because it extends the standard `readonly A[]` interface, it is assignable
  to standard arrays without conversion.
- **Branded Non-Empty Types**: `Rec.NonEmpty`, `Uniq.NonEmpty`, `Dict.NonEmpty`, and `Str.NonEmpty`
  utilize compile-time phantom brand tags. This guarantees the presence of elements at compile-time
  while remaining directly assignable to their standard, unbranded counterparts:
  - **`Uniq.NonEmpty<A>`** is assignable to `ReadonlySet<A>`
  - **`Dict.NonEmpty<K, V>`** is assignable to `ReadonlyMap<K, V>`
  - **`Rec.NonEmpty<A, K>`** is assignable to `Readonly<Record<K, A>>`
  - **`Str.NonEmpty`** is assignable to `string`

---

## Creating Non-Empty Collections

When receiving collections or strings at the boundaries of your system (such as reading from
database queries, parsing API payloads, or processing user inputs), you can refine them using type
guards or lift them from known values:

### Singletons

If you already have a value, you can construct a non-empty array, record, set, or map directly:

```ts
import { Arr, Dict, Rec, Uniq } from "@pplnd/core";

const singleItem = Arr.NonEmpty.singleton("admin"); // Arr.NonEmpty<string>
const singleValue = Rec.NonEmpty.singleton("admin", true); // Rec.NonEmpty<boolean, "admin">
const singleSet = Uniq.NonEmpty.singleton("admin"); // Uniq.NonEmpty<string>
const singleMap = Dict.NonEmpty.singleton("admin", true); // Dict.NonEmpty<string, boolean>
```

### Refinement (Type Guards)

You can refine standard collections or strings using module-level `is.nonEmpty` type guards. Inside
the conditional blocks, TypeScript automatically narrows the types:

```ts
import { Arr, Dict, Rec, Str, Uniq } from "@pplnd/core";

const userList: string[] = getUsers();
if (Arr.is.nonEmpty(userList)) {
  const admin = userList[0]; // Narrowed to string (not string | undefined)
}

const userConfig: Record<string, string> = getConfig();
if (Rec.is.nonEmpty(userConfig)) {
  // Narrowed to Rec.NonEmpty<string, string>
}

const tagSet: ReadonlySet<string> = getTags();
if (Uniq.is.nonEmpty(tagSet)) {
  // Narrowed to Uniq.NonEmpty<string>
}

const userMap: ReadonlyMap<string, number> = getScores();
if (Dict.is.nonEmpty(userMap)) {
  // Narrowed to Dict.NonEmpty<string, number>
}

const nameInput: string = getName();
if (Str.is.nonEmpty(nameInput)) {
  // Narrowed to Str.NonEmpty
}
```

### Safe Conversions (Maybe)

To safely convert potentially empty collections or strings into optional values, use the
module-specific `from.*` helpers. They return `Some` if the collection or string contains at least
one item, and `None` if it is empty:

```ts
import { Arr, Dict, Rec, Str, Uniq } from "@pplnd/core";

const maybeRoles = Arr.NonEmpty.from.array<string>([]); // None
const maybeQuotas = Rec.NonEmpty.from.record({ apiCalls: 1000, storageGb: 50 }); // Some(Rec.NonEmpty<number, "apiCalls" | "storageGb">)
const maybeRegions = Uniq.NonEmpty.from.set(new Set(["us-east-1", "eu-west-1"])); // Some(Uniq.NonEmpty<string>)
const maybeLatencies = Dict.NonEmpty.from.map(new Map<string, number>()); // None
const maybeSubject = Str.NonEmpty.from.string("Invoice #1042"); // Some(Str.NonEmpty)
```

---

## Modifying and Combining Non-Empty Arrays

Adding elements to standard arrays naturally guarantees a non-empty result. The module helpers
`Arr.prepend` and `Arr.append` accept standard, potentially empty arrays and return a guaranteed
`Arr.NonEmpty`. Once you have a `Arr.NonEmpty`, you can also concatenate additional items with
`Arr.NonEmpty.concat` or insert separators between elements with `Arr.NonEmpty.intersperse` while
preserving the non-empty guarantee:

```ts
import { Arr, pipe } from "@pplnd/core";

const baseSteps = ["validate", "charge"];

const withInit = pipe(baseSteps, Arr.prepend("authenticate"));
// Arr.NonEmpty<string>: ["authenticate", "validate", "charge"]

const fullPipeline = pipe(withInit, Arr.NonEmpty.concat(["notify", "archive"]));
// Arr.NonEmpty<string>: ["authenticate", "validate", "charge", "notify", "archive"]

const breadcrumbSteps = pipe(withInit, Arr.NonEmpty.intersperse("->"));
// Arr.NonEmpty<string>: ["authenticate", "->", "validate", "->", "charge"]

const withAudit = pipe(baseSteps, Arr.append("audit"));
// Arr.NonEmpty<string>: ["validate", "charge", "audit"]
```

---

## Transformations and Reductions

Standard library mapping functions operating on standard collections (such as `Arr.map` or
`Rec.map`) return standard collections, discarding any compile-time guarantee that the collection is
non-empty.

To transform the elements of a non-empty collection while preserving its non-empty type guarantee,
use the dedicated mapping helpers under the `NonEmpty` drawer (`Arr.NonEmpty.map`,
`Arr.NonEmpty.mapWithIndex`, `Rec.NonEmpty.map`, `Rec.NonEmpty.mapWithKey`, `Dict.NonEmpty.map`,
`Dict.NonEmpty.mapWithKey`, and `Uniq.NonEmpty.map`):

```ts
import { Arr, Dict, pipe, Rec, Uniq } from "@pplnd/core";

const lineItemPrices: Arr.NonEmpty<number> = [120, 80, 50];

// Direct mapping and indexed mapping on Arr.NonEmpty
const taxedPrices = pipe(
  lineItemPrices,
  Arr.NonEmpty.map((price) => price * 1.1),
  Arr.NonEmpty.reverse,
); // Arr.NonEmpty<number>

const labeledLineItems = pipe(
  lineItemPrices,
  Arr.NonEmpty.mapWithIndex((index, price) => `Item #${index + 1}: $${price}`),
); // Arr.NonEmpty<string>

// Transforming non-empty records with value and key access
const regionalTaxRates = Rec.NonEmpty.singleton("us", 0.08);
const formattedRates = pipe(
  regionalTaxRates,
  Rec.NonEmpty.map((rate) => Math.round(rate * 100)),
  Rec.NonEmpty.mapWithKey((region, pct) => `${region.toUpperCase()}: ${pct}%`),
); // Rec.NonEmpty<string, "us">

// Transforming non-empty sets and dictionaries
const activeRegions = Uniq.NonEmpty.singleton("us-east-1");
const upperRegions = pipe(
  activeRegions,
  Uniq.NonEmpty.map((region) => region.toUpperCase()),
); // Uniq.NonEmpty<string>

const serviceScores = Dict.NonEmpty.singleton("payments", 0.99);
const scaledScores = pipe(
  serviceScores,
  Dict.NonEmpty.map((score) => score * 100),
); // Dict.NonEmpty<string, number>

const formattedScores = pipe(
  scaledScores,
  Dict.NonEmpty.mapWithKey((service, score) => `${service}: ${score}%`),
); // Dict.NonEmpty<string, string>
```

When reducing collections down to a single value, use the `NonEmpty.reduce` helpers. Unlike standard
reductions, these do not require an initial accumulator seed value because the collections are
guaranteed to contain at least one element:

```ts
import { Arr, Dict, Rec, Uniq } from "@pplnd/core";

const totalOrderCents = Arr.NonEmpty.reduce((sum: number, price: number) => sum + price)(lineItemPrices);
const totalTaxRate = Rec.NonEmpty.reduce((sum: number, rate: number) => sum + rate)(regionalTaxRates);
const combinedRegions = Uniq.NonEmpty.reduce((acc: string, r: string) => `${acc}, ${r}`)(upperRegions);
const totalScore = Dict.NonEmpty.reduce((sum: number, s: number) => sum + s)(scaledScores);
```

---

## Destructuring and Extracting Elements

Operating on non-empty collections guarantees safe extraction of members:

- **Arrays (`Arr.NonEmpty`)**: `head` and `last` return values directly (never `undefined`), and
  `tail` returns a standard read-only array of the remaining elements.
- **Records (`Rec.NonEmpty`) and Maps (`Dict.NonEmpty`)**: Extracting `keys`, `values`, or `entries`
  returns a guaranteed `Arr.NonEmpty` array of those elements.
- **Sets (`Uniq.NonEmpty`)**: Converting to an array via `Uniq.NonEmpty.to.array` returns a
  guaranteed `Arr.NonEmpty<A>`.

```ts
import { Arr, Dict, Rec, Uniq } from "@pplnd/core";

const firstStep = Arr.NonEmpty.head(fullPipeline); // "authenticate" (string)
const finalStep = Arr.NonEmpty.last(fullPipeline); // "archive" (string)
const remainingSteps = Arr.NonEmpty.tail(fullPipeline); // readonly string[]

const recordKeys = Rec.NonEmpty.keys(regionalTaxRates); // Arr.NonEmpty<"us">
const recordValues = Rec.NonEmpty.values(regionalTaxRates); // Arr.NonEmpty<number>
const recordEntries = Rec.NonEmpty.entries(regionalTaxRates); // Arr.NonEmpty<readonly ["us", number]>

const mapKeys = Dict.NonEmpty.keys(scaledScores); // Arr.NonEmpty<string>
const mapValues = Dict.NonEmpty.values(scaledScores); // Arr.NonEmpty<number>
const mapEntries = Dict.NonEmpty.entries(scaledScores); // Arr.NonEmpty<readonly [string, number]>

const regionList = Uniq.NonEmpty.to.array(upperRegions); // Arr.NonEmpty<string>
```

---

## Problems it solves

- **Enforcing non-empty batch payloads at API boundaries**: Endpoints and service methods (such as
  bulk database mutations, multi-item checkouts, or batch deletion jobs) require at least one item
  to execute validly. Requiring `Arr.NonEmpty<A>` or `Rec.NonEmpty<K, V>` guarantees presence at
  compile time, eliminating defensive `if (arr.length === 0)` checks across internal layers.
- **Guaranteeing error payloads in validation failures**: When a validation or multi-rule check
  fails, the failure container must contain at least one error message. Returning an empty error
  list is an impossible state that confuses UI renderers. `Validation` utilizes non-empty
  collections to ensure failure variants always contain actionable errors.
- **Navigation breadcrumbs and hierarchical trees**: Data models like navigation trails or
  organizational hierarchies always possess at least one root node. Modeling breadcrumbs as
  `Arr.NonEmpty<Crumb>` guarantees that extracting the active leaf (`Arr.NonEmpty.last`) or root
  (`Arr.NonEmpty.head`) is always safe and immediate.
- **Guaranteed non-empty record keys (`Rec.NonEmpty.keys`)**: Extracting keys or values from a
  verified non-empty dictionary returns `Arr.NonEmpty<K>`, preserving non-empty guarantees across
  subsequent transformation stages.
- **Eliminating mathematically undefined operations on empty sets**: Operations like finding
  extremes (`Math.min(...[]) === Infinity`), reducing collections without fallback values, or
  computing statistical averages (`sum / length` producing `NaN` on empty arrays) are mathematically
  undefined on empty collections. `NonEmpty` collections guarantee at least one element exists,
  making `head`, `min`, `max`, and reduction operations structurally safe and non-optional.
