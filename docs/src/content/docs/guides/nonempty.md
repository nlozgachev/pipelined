---
title: Non-Empty Collections — Compile-Time Guarantees
description: Prevent boundary errors and eliminate defensive checks with compile-time guarantees that a collection, string, or record contains at least one element.
---

Functions that operate on collections often assume at least one element exists (such as `head`,
`min`, `max`, or bulk database inserts). Because standard arrays (`readonly T[]`) can be empty,
functions must either return `undefined`, throw runtime errors, or require defensive length checks.

`NonEmpty` provides compile-time branded types—`NonEmptyArr<A>`, `NonEmptyStr`, `NonEmptySet<A>`,
`NonEmptyMap<K, V>`, `NonEmptyRec<K, V>`, and `NonEmptyDict<V>`—guaranteeing that a collection
contains at least one element:

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

Under the hood, non-empty collections leverage TypeScript's type system:

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
import { Arr, Rec, Uniq, Dict } from "@nlozgachev/pipelined/data";

const singleItem = Arr.NonEmpty.singleton("admin"); // Arr.NonEmpty<string>
const singleValue = Rec.NonEmpty.singleton("admin", true); // Rec.NonEmpty<boolean, "admin">
const singleSet = Uniq.NonEmpty.singleton("admin"); // Uniq.NonEmpty<string>
const singleMap = Dict.NonEmpty.singleton("admin", true); // Dict.NonEmpty<string, boolean>
```

### Refinement (Type Guards)

You can refine standard collections or strings using module-level `is.nonEmpty` type guards. Inside
the conditional blocks, TypeScript automatically narrows the types:

```ts
import { Arr, Rec, Uniq, Dict, Str } from "@nlozgachev/pipelined/data";

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
namespace-specific `from*` helpers. They return `Some` if the collection/string contains
elements/characters, and `None` if it is empty:

```ts
import { Arr, Rec, Uniq, Dict, Str } from "@nlozgachev/pipelined/data";

const maybeArr = Arr.NonEmpty.from.Array([]); // None
const maybeRec = Rec.NonEmpty.from.Record({ a: 1 }); // Some(Rec.NonEmpty<number, "a">)
const maybeSet = Uniq.NonEmpty.from.Set(new Set([1, 2])); // Some(Uniq.NonEmpty<number>)
const maybeMap = Dict.NonEmpty.from.Map(new Map()); // None
const maybeStr = Str.NonEmpty.from.String("hello"); // Some(Str.NonEmpty)
```

---

## Modifying Non-Empty Arrays

Adding elements to standard arrays naturally guarantees a non-empty result. The namespace helpers
`Arr.prepend` and `Arr.append` accept standard, potentially empty arrays and return a guaranteed
`Arr.NonEmpty`:

```ts
import { Arr } from "@nlozgachev/pipelined/data";
import { pipe } from "@nlozgachev/pipelined/composition";

const list1 = pipe([1, 2], Arr.prepend(0)); // Arr.NonEmpty<number>: [0, 1, 2]
const list2 = pipe([1, 2], Arr.append(3));  // Arr.NonEmpty<number>: [1, 2, 3]
```

---

## Transformations and Reductions

Standard library mapping functions operating on standard collections (such as `Arr.map` or
`Rec.map`) return standard collections, discarding any compile-time guarantee that the collection is
non-empty.

To transform the elements of a non-empty collection while preserving its non-empty type guarantee,
always use the dedicated mapping helpers under the `NonEmpty` namespace of the module (e.g.,
`Arr.NonEmpty.map`, `Rec.NonEmpty.map`):

```ts
import { Arr, Rec, Uniq, Dict } from "@nlozgachev/pipelined/data";
import { pipe } from "@nlozgachev/pipelined/composition";

// Direct mapping
const doubledList = Arr.NonEmpty.map((n: number) => n * 2)(list1); 
// typed as Arr.NonEmpty<number>

// Pipeline transformation
const result = pipe(
	list1,
	Arr.NonEmpty.map((n) => n * 2),
	Arr.NonEmpty.reverse,
);
// typed as Arr.NonEmpty<number>

const updatedSet = pipe(
	maybeSet.value,
	Uniq.NonEmpty.map((n) => n.toString()),
);
// typed as Uniq.NonEmpty<string>

const updatedMap = pipe(
	maybeMap.value,
	Dict.NonEmpty.map((v) => v * 100),
);
// typed as Dict.NonEmpty<string, number>
```

When reducing collections down to a single value, you can use the `NonEmpty.reduce` helpers. Unlike
standard reductions, these do not require an initial accumulator seed value because the collections
are guaranteed to contain at least one element:

```ts
import { Arr, Rec, Uniq, Dict } from "@nlozgachev/pipelined/data";

const sumOfArray = Arr.NonEmpty.reduce((a: number, b: number) => a + b)(list1); // number
const sumOfRecord = Rec.NonEmpty.reduce((a: number, b: number) => a + b)(updatedRecord); // number
const sumOfSet = Uniq.NonEmpty.reduce((a: number, b: number) => a + b)(maybeSet.value); // number
const sumOfMap = Dict.NonEmpty.reduce((a: number, b: number) => a + b)(updatedMap); // number
```

````
---

## Destructuring and Extracting Elements

Operating on non-empty collections guarantees safe extraction of members:

- **Arrays (`Arr.NonEmpty`)**: `head` and `last` return values directly (not `undefined` unions),
  and `tail` returns standard read-only arrays.
- **Records (`Rec.NonEmpty`) and Maps (`Dict.NonEmpty`)**: Extracting `keys`, `values`, or `entries` returns a guaranteed
  `Arr.NonEmpty` array of those elements:

```ts
import { Arr, Rec, Dict } from "@nlozgachev/pipelined/data";

const firstElement = Arr.NonEmpty.head(list1); // number (safe)
const remainingList = Arr.NonEmpty.tail(list1); // readonly number[]

const recordKeys = Rec.NonEmpty.keys(updatedRecord); // Arr.NonEmpty<"a">
const recordValues = Rec.NonEmpty.values(updatedRecord); // Arr.NonEmpty<number>

const mapKeys = Dict.NonEmpty.keys(updatedMap); // Arr.NonEmpty<string>
const mapValues = Dict.NonEmpty.values(updatedMap); // Arr.NonEmpty<number>
````

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
