---
title: Pair — Typed Pairs
description: Model two values that always travel together in a pipeline as an explicit, strongly typed pair without destructuring.
---

In modern application code, data naturally comes in connected pairs: key-value entries in maps,
width and height dimensions, coordinate points `(x, y)`, or HTTP response headers
`(headerName, headerValue)`.

While TypeScript supports two-element array tuples (`readonly [A, B]`), treating them as raw arrays
inside pipeline compositions forces awkward destructuring and manual array rebuilding:

```ts
// Without Pair: manual array destructuring inside map
const scoreEntry: readonly [string, number] = ["alice", 980];
const updated = [scoreEntry[0].toUpperCase(), scoreEntry[1] + 20] as const;
```

`Pair<A, B>` treats typed pairs (`readonly [A, B]`) as first-class, unified containers. It provides
dedicated combinators to transform the first element, the second element, or both elements
independently without breaking your pipeline flow.

```ts
import { Pair } from "@nlozgachev/pipelined/core";
import { pipe } from "@nlozgachev/pipelined/composition";

const entry = Pair.from.pair("alice", 980);

const updatedEntry = pipe(
  entry,
  Pair.mapFirst((name) => name.toUpperCase()),
  Pair.mapSecond((score) => score + 20),
); // ["ALICE", 1000]
```

---

## Type Structure

A `Pair<A, B>` is a structural alias for a `readonly [A, B]` array. Because it is a plain TypeScript
tuple under the hood, any native two-element array is automatically a valid `Pair`.

```ts
type Pair<A, B> = readonly [A, B];
```

`Pair` provides dedicated, pure operations that manipulate this structure without requiring us to
destructure or manage array indices manually.

---

## Creating Pairs

To lift two distinct values into a typed pair, we use `Pair.from.pair`:

```ts
import { Pair } from "@nlozgachev/pipelined/core";

const entry = Pair.from.pair("timeout_seconds", 30); // Pair<string, number>
```

Any existing function that returns a two-element tuple (such as array utilities like `Arr.splitAt`)
is already structurally compatible with `Pair` and requires no constructor wrapping.

---

## Inspecting and Accessing

We can extract elements from a pair using `Pair.first` and `Pair.second`, or reverse their order
using `Pair.swap`:

```ts
const pair = Pair.from.pair("port", 8080);

Pair.first(pair);  // "port"
Pair.second(pair); // 8080

const swapped = Pair.swap(pair); // [8080, "port"]
```

---

## Transforming Pairs

`Pair` allows us to apply mapping functions to either element independently without affecting the
other, or transform both values simultaneously.

### Transforming the first element with `mapFirst`

```ts
const userScore = Pair.from.pair("alice", 980);

const formattedUser = pipe(
  userScore,
  Pair.mapFirst((name) => name.toUpperCase()),
); // ["ALICE", 980]
```

### Transforming the second element with `mapSecond`

```ts
const updatedScore = pipe(
  userScore,
  Pair.mapSecond((score) => score + 20),
); // ["alice", 1000]
```

### Transforming both elements with `mapBoth`

```ts
const updatedPair = pipe(
  userScore,
  Pair.mapBoth(
    (name) => name.toUpperCase(),
    (score) => score + 20,
  ),
); // ["ALICE", 1000]
```

---

## Collapsing and Converting Pairs

When we reach the end of a transformation pipeline and need to merge the pair into a single value,
we use `Pair.fold`. It applies a binary function that merges the two elements:

```ts
const formatted = pipe(
  Pair.from.pair("fr-FR", 1299),
  Pair.mapSecond((cents) => cents / 100), // convert to Euros
  Pair.fold((locale, euros) => `${locale}: €${euros.toFixed(2)}`),
); // "fr-FR: €12.99"
```

To run a side-effect (such as logging) in the middle of a pipeline without modifying the pair, use
`Pair.tap`. When interfacing with APIs that do not support tuple types, we can convert the pair to a
plain array using `Pair.to.Array`:

```ts
const arr = pipe(
  Pair.from.pair("debug_flag", true),
  Pair.tap((key, val) => console.log(`Config: ${key} is ${val}`)),
  Pair.to.Array,
); // ["debug_flag", true]
```

---

## Problems it solves

- **Selective element transformations in pipelines (`Pair.mapFirst`, `Pair.mapSecond`,
  `Pair.mapBoth`)**: Transforming one half of a key-value entry or pair without breaking pipeline
  chain syntax or requiring temporary variables.
- **Key-value pair swapping for inverted indexes (`Pair.swap`)**: When building inverse lookup
  indexes (such as converting map entries from IDs to usernames into usernames to IDs), `Pair.swap`
  flips pair positions cleanly inside array pipelines.
- **Collapsing paired data with `Pair.fold`**: Merging two values into a single formatted string or
  combined result without manual index accesses.
