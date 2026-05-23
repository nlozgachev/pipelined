---
title: Dict — Dictionary Utilities
description: Model key-value associations immutably, replacing mutation-based Map structures and unsafe lookups with clean, pipeline-ready dictionary helpers.
---

JavaScript provides two primary ways to associate keys with values: plain objects (`{}`) and the
built-in `Map`.

A `Map` is exceptionally useful: it supports any key type (not just strings and symbols), guarantees
insertion-order iteration, and offers highly optimized membership lookups for large collections.
However, in a functional pipeline, the native `Map` API introduces notable friction:

1. **It is mutation-based**: Methods like `.set()` and `.delete()` alter the map in place, violating
   the principles of immutability and creating subtle shared-state bugs.
2. **It is data-first**: Methods are located on the prototype, forcing us to write verbose inline
   arrow wrappers inside `pipe` chains.
3. **It is unsafe**: The `.get()` method silently returns `undefined` when a key is absent, shifting
   the checking burden back to our code.

`Dict` solves these limitations. It acts as a wrapper around the standard `ReadonlyMap<K, V>`,
providing a suite of pure, **data-last**, immutable utilities that return `Maybe` containers for
safe, explicit lookups.

---

## Creating Dictionaries

We lift key-value associations into the `Dict` context using its core constructors:

```ts
import { Dict } from "@nlozgachev/pipelined/utils";

// An empty dictionary
const empty = Dict.empty<string, number>();

// Lift an array of key-value pairs (supports any key type)
const byId = Dict.fromEntries([
  ["usr_1", { name: "Alice", role: "admin" }],
  ["usr_2", { name: "Bob", role: "member" }],
]);

// Convert a plain object
const scores = Dict.fromRecord({ alice: 85, bob: 92, carol: 74 });
```

`Dict.singleton(key, value)` is also available to quickly construct a typed dictionary holding
exactly one initial entry.

---

## Safe Lookups: Bypassing Undefined

Instead of returning nullable values, `Dict.lookup` explicitly yields a `Maybe` container:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";

const config = Dict.fromRecord({ timeout: 5000, retries: 3 });

pipe(config, Dict.lookup("timeout")); // Some(5000)
pipe(config, Dict.lookup("missing")); // None
```

If you only need to verify whether a key is present and do not need to retrieve its value,
`Dict.has` is the optimized tool, avoiding the allocations of a `Maybe` instance:

```ts
pipe(config, Dict.has("retries")); // true
```

---

## Transforming Values

`Dict.map` applies a transformation to every value inside the dictionary, returning a new dictionary
with the same keys:

```ts
// Normalize all test scores to a 0–1 decimal scale:
const normalized = pipe(scores, Dict.map((score) => score / 100));
```

If the transformation depends on the key as well as the value, `Dict.mapWithKey` passes both to your
callback:

```ts
const userDetails = Dict.fromRecord({ usr_1: "admin", usr_2: "member" });

const labels = pipe(
  userDetails,
  Dict.mapWithKey((key, role) => `${key} (${role})`),
); // Map { "usr_1" => "usr_1 (admin)", "usr_2" => "usr_2 (member)" }
```

---

## Filtering Values

- `Dict.filter` filters out entries whose values do not satisfy a predicate.
- `Dict.filterWithKey` passes both the key and the value to the predicate:

```ts
// Keep only passing exam scores:
const passing = pipe(scores, Dict.filter((score) => score >= 75));

// Remove entries where the key starts with an internal prefix:
const publicScores = pipe(
  Dict.fromRecord({ test_alice: 99, bob: 92 }),
  Dict.filterWithKey((key, _score) => !key.startsWith("test_")),
); // Map { "bob" => 92 }
```

### The Single-Pass map-and-filter: filterMap

When you need to map dictionary values and filter out empty or invalid items simultaneously,
`Dict.filterMap` performs both operations in a **single pass**, collecting only the successful
`Some` values:

```ts
const parseNumeric = (s: string): Maybe<number> => {
  const n = Number(s);
  return isNaN(n) ? Maybe.none() : Maybe.some(n);
};

const parsed = pipe(
  Dict.fromRecord({ val_a: "42", val_b: "invalid_text", val_c: "100" }),
  Dict.filterMap(parseNumeric),
); // Map { "val_a" => 42, "val_c" => 100 }
```

---

## Modifying Entries Immutably

Unlike native `Map` operations, modifying a `Dict` never alters the original instance. Every
modification returns a fresh, structurally copied dictionary:

```ts
const baseStats = Dict.fromRecord({ visits: 100, likes: 25 });

// Inserting a new key-value pair
const expanded = pipe(baseStats, Dict.insert("shares", 5));

// Removing a key
const cleaned = pipe(baseStats, Dict.remove("likes"));
```

### Inserting or updating with upsert

For the common pattern of incrementing a counter or initializing a default value on first write,
`Dict.upsert` provides a single, unified operation. It passes `Some(value)` to your updater function
if the key exists, or `None` if the key is absent:

```ts
const incrementCounter = (current: Maybe<number>): number =>
  pipe(current, Maybe.getOrElse(() => 0)) + 1;

// Increments visits to 101:
const updatedStats = pipe(baseStats, Dict.upsert("visits", incrementCounter));

// Initializes shares to 1:
const initialStats = pipe(baseStats, Dict.upsert("shares", incrementCounter));
```

---

## Combining Dictionaries

- `Dict.union` merges two dictionaries. When a key exists in both, the value from the right-hand
  dictionary takes precedence (equivalent to spreading objects).
- `Dict.intersection` preserves only the keys that exist in both dictionaries, keeping the values
  from the left-hand dictionary.
- `Dict.difference` removes from the left-hand dictionary any keys present in the right-hand
  dictionary.

```ts
const defaults = Dict.fromRecord({ timeout: 3000, retries: 3 });
const overrides = Dict.fromRecord({ timeout: 10000 });

const merged = pipe(defaults, Dict.union(overrides)); 
// Map { "timeout" => 10000, "retries" => 3 }
```

---

## Compacting and Folds

- `compact` collapses a dictionary of optional values `ReadonlyMap<K, Maybe<V>>` into a clean
  dictionary of values `ReadonlyMap<K, V>`, discarding `None` states.
- `reduce` folds the dictionary values from the left into a single accumulator.
- `toRecord` exports a string-keyed dictionary back into a plain JavaScript object.

```ts
// Sum all scores:
const totalScore = pipe(
  scores,
  Dict.reduce(0, (sum, score) => sum + score),
);
```

---

## When to use Dict

### Use Dict when:

- **Keys are non-strings**: You need to associate values using numbers, objects, or custom symbols
  as keys.
- **Order matters**: You require guaranteed insertion-order iteration over key-value entries.
- **Lookup safety is desired**: You want lookups to explicitly return `Maybe` containers rather than
  nullable values.
- **Operating in pipelines**: You are transforming, filtering, or merging key-value maps point-free
  inside `pipe` chains.

### Keep using plain objects (Rec) when:

- **Keys are always strings**: You are working directly with standard JSON payloads or API
  responses.
- **You require object transformations**: You need structural operations like `pick`, `omit`, or
  `mapKeys` (which are strictly designed for plain objects).
