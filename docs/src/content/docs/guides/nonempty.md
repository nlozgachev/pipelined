---
title: Non-Empty Collections — Compile-Time Guarantees
description: Prevent boundary errors and eliminate defensive checks with compile-time guarantees that an array or record contains at least one element.
---

In software systems, we frequently operate on arrays or records under the semantic assumption that
there is at least one item to process. For example, a validation pipeline must return a list of
errors only if at least one error occurred, and a bulk database update requires at least one record
to persist.

Standard TypeScript represents these collections as standard read-only arrays `readonly T[]` or
records `Readonly<Record<string, T>>`. However, because standard collections are structurally
permitted to be empty (`[]` or `{}`), our codebases become littered with defensive checks, runtime
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
introducing `Arr.NonEmpty<A>` and `Rec.NonEmpty<A>`, providing static type-level guarantees that
collections contain at least one element.

---

## Type Structure

Under the hood, non-empty collections leverage TypeScript's structural type system:

- **`Arr.NonEmpty<A>`**: Represented as a read-only tuple structure `readonly [A, ...A[]]`. Because
  it extends the standard `readonly A[]` interface, it is assignable to standard arrays without
  conversion.
- **`Rec.NonEmpty<A>`**: A branded type
  `Readonly<Record<string, A>> & { readonly [_nonEmptyRecord]: true }`. It functions as a standard
  record, but is tracked as non-empty by the compiler.

---

## Creating Non-Empty Collections

When receiving collections at the boundaries of your system (such as reading from database queries
or parsing API payloads), you will often receive standard, potentially empty collections. You can
refine them using type guards or lift them from known values:

### Singletons

If you already have a value, you can construct a non-empty array or record directly using
`Arr.NonEmpty.singleton` and `Rec.NonEmpty.singleton`:

```ts
import { Arr, Rec } from "@nlozgachev/pipelined/data";

const singleItem = Arr.NonEmpty.singleton("admin"); // Arr.NonEmpty<string>
const singleValue = Rec.NonEmpty.singleton("admin", true); // Rec.NonEmpty<boolean>
```

### Refinement (Type Guards)

You can refine a standard collection using `Arr.isNonEmpty` and `Rec.isNonEmpty`. Inside the
conditional blocks, TypeScript automatically narrows the types:

```ts
import { Arr, Rec } from "@nlozgachev/pipelined/data";

const userList: string[] = getUsers();
if (Arr.isNonEmpty(userList)) {
  const admin = userList[0]; // Narrowed to string (not string | undefined)
}

const userConfig: Record<string, string> = getConfig();
if (Rec.isNonEmpty(userConfig)) {
  // Narrowed to Rec.NonEmpty<string>
}
```

### Safe Conversions (Maybe)

When you want to convert standard collections into optional values, you can use
`Arr.NonEmpty.fromArray` and `Rec.NonEmpty.fromRecord`. They return a `Some` wrapping the non-empty
collection if it contains elements, and `None` if it is empty:

```ts
import { Arr, Rec } from "@nlozgachev/pipelined/data";

const maybeArr = Arr.NonEmpty.fromArray([]); // None
const maybeRec = Rec.NonEmpty.fromRecord({ a: 1 }); // Some(Rec.NonEmpty<number>)
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

To transform the elements of a non-empty collection while maintaining its structural type guarantee,
use the curried `Arr.map`, `Rec.map`, or `Rec.mapWithKey` helpers. They preserve the non-empty
status of the collection in their return types:

```ts
import { Arr, Rec } from "@nlozgachev/pipelined/data";

const doubledList = Arr.map((n: number) => n * 2)(list1); 
// typed as Arr.NonEmpty<number>

const updatedRecord = Rec.map((v: number) => v + 10)(maybeRec.value);
// typed as Rec.NonEmpty<number>
```

When reducing collections down to a single value, you can use `Arr.NonEmpty.reduce` and
`Rec.NonEmpty.reduce`. Unlike standard JavaScript reductions, these do not require an initial
accumulator seed value because the collections are guaranteed to contain at least one element:

```ts
import { Arr, Rec } from "@nlozgachev/pipelined/data";

const sumOfArray = Arr.NonEmpty.reduce((a: number, b: number) => a + b)(list1); // number
const sumOfRecord = Rec.NonEmpty.reduce((a: number, b: number) => a + b)(updatedRecord); // number
```

---

## Destructuring and Extracting Elements

Operating on non-empty collections guarantees safe extraction of members:

- **Arrays (`Arr.NonEmpty`)**: `head` and `last` return values directly (not `undefined` unions),
  and `tail` returns standard read-only arrays.
- **Records (`Rec.NonEmpty`)**: Extracting `keys`, `values`, or `entries` returns a guaranteed
  `Arr.NonEmpty` array of those elements:

```ts
import { Arr, Rec } from "@nlozgachev/pipelined/data";

const firstElement = Arr.NonEmpty.head(list1); // number (safe)
const remainingList = Arr.NonEmpty.tail(list1); // readonly number[]

const recordKeys = Rec.NonEmpty.keys(updatedRecord); // Arr.NonEmpty<string>
const recordValues = Rec.NonEmpty.values(updatedRecord); // Arr.NonEmpty<number>
```

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
