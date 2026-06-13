---
title: Rec — Record Utilities
description: Work with plain JavaScript objects as key-value records immutably and safely inside pipelines, using data-last utilities with type-safe key lookup.
---

Plain JavaScript objects serving as dictionaries — typed as `Record<string, A>` — are the most
ubiquitous data structures in any TypeScript application. We use them for configurations, lookup
tables, and serialized payloads.

However, working with records in functional pipelines introduces two common points of friction:

1. **They are data-first**: Modifying objects natively forces us to write verbose, inline spreads
   inside our `pipe` chains: `(obj) => ({ ...obj, key: value })`.
2. **They are unsafe**: Accessing a missing key via bracket notation (`obj[key]`) silently returns
   `undefined` at runtime, bypassing the type system and causing errors downstream.

`Rec` solves both issues. It provides a small, highly optimized collection of **data-last**, curried
utilities designed to compose cleanly in pipelines, returning explicit `Maybe` values for safe,
crash-free key lookups.

---

## Safe Key Lookup

`Rec.lookup` retrieves the value associated with a key, wrapping it in a `Maybe` container to make
key absence explicit in your types:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";
import { Rec } from "@nlozgachev/pipelined/data";

const settings = { theme: "dark", language: "en" };

pipe(settings, Rec.lookup("theme")); // Some("dark")
pipe(settings, Rec.lookup("font"));  // None (not undefined)
```

This integrates naturally with other pipelines:

```ts
const serverTimeout = pipe(
  configPayload,
  Rec.lookup("timeout"),
  Maybe.map((s) => Number(s)),
  Maybe.filter((n) => !isNaN(n)),
  Maybe.getOrElse(() => 30000), // Secure fallback
);
```

---

## Transforming Values

`Rec.map` transforms every value inside a record, returning a new record with the original keys
preserved:

```ts
pipe({ a: 1, b: 2 }, Rec.map((n) => n * 10)); // { a: 10, b: 20 }
```

If the transformation requires the key as well as the value, `Rec.mapWithKey` passes both to your
callback:

```ts
pipe({ a: 1, b: 2 }, Rec.mapWithKey((key, value) => `${key}_${value}`));
// { a: "a_1", b: "b_2" }
```

---

## Filtering Values

- `Rec.filter` keeps only the entries whose values satisfy a predicate.
- `Rec.filterWithKey` passes both the key and the value to the predicate:

```ts
// Keep only values greater than 1:
pipe({ a: 1, b: 2, c: 3 }, Rec.filter((n) => n > 1)); // { b: 2, c: 3 }

// Keep values where the key matches a specific prefix and value is non-zero:
pipe(
  { a: 1, b: 0, c: 3 },
  Rec.filterWithKey((key, value) => key !== "a" && value > 0),
); // { c: 3 }
```

---

## Picking and Omitting Keys

- `Rec.pick` returns a new record containing only the specified keys.
- `Rec.omit` returns a new record with the specified keys removed.

Both utilities are fully **type-safe**. `pick` returns a precise `Pick<A, K>` type and `omit`
returns a precise `Omit<A, K>` type, ensuring the compiler tracks exactly which properties survive
the pipeline:

```ts
const baseProfile = { id: "123", name: "Alice", email: "alice@example.com" };

const summary = pipe(baseProfile, Rec.pick("id", "name")); // { id: "123", name: "Alice" }
const publicView = pipe(baseProfile, Rec.omit("email"));   // { id: "123", name: "Alice" }
```

---

## Merging Records

`Rec.merge` combines two records, returning a fresh object. Keys present in the second record
override those in the first record, behaving identically to standard object spreads:

```ts
pipe(
  { a: 1, b: 2 },
  Rec.merge({ b: 99, c: 3 }),
); // { a: 1, b: 99, c: 3 }
```

---

## Keys, Values, and Entries

`Rec` provides utilities to extract arrays of keys, values, or entries:

```ts
const coordinates = { x: 10, y: 20 };

Rec.keys(coordinates);    // ["x", "y"]
Rec.values(coordinates);  // [10, 20]
Rec.entries(coordinates); // [["x", 10], ["y", 20]]
```

`Rec.fromEntries` is the inverse constructor, building a record from an array of key-value pairs:

```ts
Rec.fromEntries([["a", 1], ["b", 2]]); // { a: 1, b: 2 }
```

You can pair `entries` and `fromEntries` to easily perform structural record mappings:

```ts
// Upper-casing all keys in a record:
const rawInput = { firstName: "Alice", lastName: "Smith" };

const parsed = pipe(
  rawInput,
  Rec.entries,
  (entries) => entries.map(([key, value]) => [key.toUpperCase(), value] as const),
  Rec.fromEntries,
); // { FIRSTNAME: "Alice", LASTNAME: "Smith" }
```

---

## Sizing and Verification

```ts
Rec.isEmpty({});         // true
Rec.isEmpty({ a: 1 });   // false

Rec.size({ a: 1, b: 2 }); // 2
```

---

## Traversing and Sequencing Records

When a record contains values that wrap effectful computations, you may want to aggregate those
individual effects into a single container holding the mapped record. `Rec.Maybe` and `Rec.Result`
provide namespaces for traversing and sequencing records, short-circuiting on the first failure.

`Rec.Maybe.traverse` maps a `Maybe`-returning function over the values of a record. If every value
produces a `Some`, it returns `Some` of the updated record. If any value maps to `None`, the entire
operation returns `None`:

```ts
import { Maybe } from "@nlozgachev/pipelined/core";
import { Rec } from "@nlozgachev/pipelined/data";

const parseNum = (s: string) => s === "NaN" ? Maybe.none() : Maybe.some(Number(s));

pipe({ a: "1", b: "2" }, Rec.Maybe.traverse(parseNum)); // Some({ a: 1, b: 2 })
pipe({ a: "1", b: "NaN" }, Rec.Maybe.traverse(parseNum)); // None
```

`Rec.Maybe.sequence` takes a record where every value is already a `Maybe` and collapses it into a
single `Maybe` of a record:

```ts
Rec.Maybe.sequence({ a: Maybe.some(1), b: Maybe.some(2) }); // Some({ a: 1, b: 2 })
Rec.Maybe.sequence({ a: Maybe.some(1), b: Maybe.none() }); // None
```

Similarly, `Rec.Result.traverse` and `Rec.Result.sequence` aggregate fallible computations:

```ts
import { Result } from "@nlozgachev/pipelined/core";

const validateStock = (quantity: number) =>
  quantity < 0 ? Result.err("Negative stock not allowed") : Result.ok(quantity);

pipe({ apples: 10, oranges: 5 }, Rec.Result.traverse(validateStock)); // Ok({ apples: 10, oranges: 5 })
pipe({ apples: 10, oranges: -1 }, Rec.Result.traverse(validateStock)); // Err("Negative stock not allowed")
```

---

## Non-Empty Records

Sometimes, you need compile-time assurance that a record contains at least one key-value pair. You
can represent this with the branded type `Rec.NonEmpty<A>` and refine standard records using the
type guard `Rec.isNonEmpty`.

```ts
const userRecord = { admin: "Alice" };

if (Rec.isNonEmpty(userRecord)) {
  // Inside this block, userRecord is typed as Rec.NonEmpty<string>
}
```

You can create a non-empty record directly using `Rec.NonEmpty.singleton` or parse a standard record
using `Rec.NonEmpty.fromRecord`:

```ts
const singletonRec = Rec.NonEmpty.singleton("main", 42); // Rec.NonEmpty<number>

const parsedRec = Rec.NonEmpty.fromRecord(userRecord); // Some(Rec.NonEmpty<string>)
const emptyRec = Rec.NonEmpty.fromRecord({});          // None
```

Operating on `Rec.NonEmpty<A>` ensures that operations which would normally return standard arrays
(which could be empty) instead return guaranteed non-empty arrays (`Arr.NonEmpty`). For example,
extracting keys, values, or entries from a non-empty record returns `Arr.NonEmpty`:

```ts
const users = Rec.NonEmpty.singleton("admin", "Alice");

Rec.NonEmpty.keys(users);    // Arr.NonEmpty<string> (e.g. ["admin"])
Rec.NonEmpty.values(users);  // Arr.NonEmpty<string> (e.g. ["Alice"])
Rec.NonEmpty.entries(users); // Arr.NonEmpty<readonly [string, string]> (e.g. [["admin", "Alice"]])
```

You can also reduce the values of a non-empty record without providing an initial accumulator seed,
since there is guaranteed to be at least one value:

```ts
const scores = Rec.NonEmpty.singleton("math", 95);
pipe(scores, Rec.NonEmpty.reduce((a, b) => a + b)); // 95
```

Additionally, `Rec.map` and `Rec.mapWithKey` preserve the non-empty status of the record in their
return types:

```ts
const doubled = Rec.map((n: number) => n * 2)(scores); // Rec.NonEmpty<number>
```

For more details on operating with guaranteed non-empty data structures, see the dedicated
[Non-Empty Collections Guide](../nonempty).

---

## When to use Rec

### Use Rec when:

- **Operating inside pipelines**: You are transforming, filtering, or merging records point-free
  inside `pipe` chains.
- **You require type-safe picks or omits**: You want the compiler to statically track exactly which
  properties exist after keys are picked or omitted.
- **Safe key retrieval is required**: You want to avoid accidental `undefined` runtime crashes by
  capturing key absence as a `Maybe` container.

### Keep using standard object notation when:

- **The operation is a simple, local one-liner**: Inside a narrow function body where standard
  dot-notation `obj.key` or spreads `{ ...obj }` are already clear and require no composition.
