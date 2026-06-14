---
title: Non-Empty Collections — Compile-Time Guarantees
description: Prevent boundary errors and eliminate defensive checks with compile-time guarantees that a collection, string, or record contains at least one element.
---

In software systems, we frequently operate on collections, strings, or records under the semantic
assumption that there is at least one item to process. For example, a validation pipeline must
return a list of errors only if at least one error occurred, and a bulk database update requires at
least one record to persist.

Standard TypeScript represents these as standard read-only arrays `readonly T[]`, sets, maps,
strings, or records. However, because standard collections are structurally permitted to be empty
(`[]`, `{}`, `new Set()`, etc.), our codebases become littered with defensive checks, runtime
exceptions, and nullable/undefined handling:

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
  utilize the library's `Brand` utility to tag their unbranded counterparts with the phantom
  `"NonEmpty"` brand tag. This guarantees presence of elements at compile-time while remaining
  assignable to their unbranded versions:
  - **`Uniq.NonEmpty<A>`**: `Brand<"NonEmpty", ReadonlySet<A>>`
  - **`Dict.NonEmpty<K, V>`**: `Brand<"NonEmpty", ReadonlyMap<K, V>>`
  - **`Rec.NonEmpty<A, K>`**: `Brand<"NonEmpty", Readonly<Record<K, A>>>`
  - **`Str.NonEmpty`**: `Brand<"NonEmpty", string>`

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

You can refine standard collections or strings using module-level `isNonEmpty` type guards. Inside
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

Standard library mapping functions return standard collections, discarding the compile-time
guarantee that the collection is non-empty.

To transform the elements of a non-empty collection while maintaining its structural/branded type
guarantee, use the curried mapping helpers. When calling them directly, the standard overloaded
mapping functions preserve the type:

```ts
import { Arr, Rec, Uniq, Dict } from "@nlozgachev/pipelined/data";

const doubledList = Arr.map((n: number) => n * 2)(list1); 
// typed as Arr.NonEmpty<number>

const updatedRecord = Rec.map((v: number) => v + 10)(maybeRec.value);
// typed as Rec.NonEmpty<number, "a">
```

However, when composing operations inside generic `pipe` pipelines, TypeScript's overload resolution
can lose the non-empty type brand. In pipeline contexts, use the dedicated, non-overloaded
`NonEmpty.map` and `NonEmpty.mapWithKey` functions to preserve type inference:

```ts
import { Arr, Rec, Uniq, Dict } from "@nlozgachev/pipelined/data";
import { pipe } from "@nlozgachev/pipelined/composition";

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

## When to use Non-Empty Collections

### Use Non-Empty collections when:

- **Accumulating errors**: You want to gather multiple validation failures (like in the `Validation`
  type) and guarantee that a failure variant contains at least one error.
- **Requiring payloads**: A function or API route demands at least one record (e.g., bulk-updating
  items or running database transactions).
- **Safe head access**: You need to safely extract elements without checking for `undefined` or
  throwing runtime boundaries.

### Keep using standard collections when:

- **Absence of elements is valid**: A list or record representing filters, tags, or optional
  configurations is naturally permitted to be empty.
- **Interfacing with third-party libraries**: Downstream APIs only consume standard collections, and
  the overhead of checking boundaries is not justified by the application logic.
