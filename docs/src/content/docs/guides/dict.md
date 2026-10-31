---
title: Dict — Dictionary Utilities
description: Model key-value associations immutably, replacing mutation-based Map structures and unsafe lookups with clean, pipeline-ready dictionary helpers.
---

<!-- BUNDLE_SIZE:START -->

> 2.43 kB minified + gzipped

<!-- BUNDLE_SIZE:END -->

JavaScript provides two primary ways to associate keys with values: plain objects (`{}`) and the
built-in `Map`.

A `Map` is essential when you need non-string keys (such as numeric IDs, composite objects, or
symbols), guaranteed insertion-order iteration, or frequent additions and removals without prototype
pollution risks. However, using native `Map` instances in TypeScript pipelines introduces three
problems:

1. **Mutation in place**: Calling `.set()` or `.delete()` mutates the underlying `Map` instance,
   creating shared-state bugs across components and breaking change detection in UI frameworks.
2. **Data-first prototype methods**: Native `Map` has no `.map()` or `.filter()` methods, forcing
   you to spread entries into arrays (`new Map([...map].filter(...))`) for every transformation.
3. **Unsafe `.get()` lookups**: Calling `map.get(key)` returns `V | undefined`, shifting the burden
   of null-checking onto every caller and conflating missing keys with keys whose value is
   `undefined`.

```ts
// Native Map mutation alters shared references in place:
const activeSessions = new Map<number, string>([[101, "tok_abc"]]);
activeSessions.delete(101); // Mutates activeSessions for all holders of the reference!
```

`Dict` solves these limitations by operating over standard `ReadonlyMap<K, V>` instances with pure,
curried, **data-last** functions. Every modification returns a fresh `ReadonlyMap` without mutating
the original, and every key lookup returns an explicit `Maybe<V>`.

---

## Creating Dictionaries

You can construct a `ReadonlyMap<K, V>` using `Dict.empty`, `Dict.singleton`, or the converters in
`Dict.from`:

```ts
import { Dict } from "@pplnd/core";

// An empty dictionary with explicit key and value types:
const emptyCache = Dict.empty<number, string>();

// A single-entry dictionary:
const primaryAdmin = Dict.singleton("usr_1", { name: "Alice", role: "admin" });

// From an array of [key, value] tuples (supports any key type, such as numeric IDs):
const accountsById = Dict.from.entries([
  [1001, { owner: "Alice", balance: 2500 }],
  [1002, { owner: "Bob", balance: 1800 }],
]);

// From a plain string-keyed JavaScript object:
const scoresByUser = Dict.from.record({ alice: 85, bob: 92, carol: 74 });

// From a nullable Map reference (returns Some(ReadonlyMap) or None):
const maybeSessionMap = Dict.from.nullable(externalCache.getMap());
```

You can also build a dictionary directly from an array of items using `Dict.groupBy`, which groups
elements by a key selector function into a `ReadonlyMap<K, Arr.NonEmpty<A>>`:

```ts
import { pipe } from "@pplnd/core";

const events = [
  { tenantId: 10, type: "login" },
  { tenantId: 20, type: "purchase" },
  { tenantId: 10, type: "logout" },
];

const eventsByTenant = pipe(
  events,
  Dict.groupBy((event) => event.tenantId),
);
// ReadonlyMap {
//   10 => [{ tenantId: 10, type: "login" }, { tenantId: 10, type: "logout" }],
//   20 => [{ tenantId: 20, type: "purchase" }]
// }
```

---

## Safe Lookups and Inspection

Instead of returning `undefined` when a key is absent, `Dict.lookup` returns `Some(value)` when the
key exists in the dictionary and `None` when it does not:

```ts
import { Maybe } from "@pplnd/core";

const timeouts = Dict.from.record({ api: 5000, webhook: 12000 });

pipe(timeouts, Dict.lookup("api"));     // Some(5000)
pipe(timeouts, Dict.lookup("billing")); // None
```

When you only need to check whether a key exists without wrapping its value in a `Maybe`, use
`Dict.has`. To inspect entry counts, emptiness, or extract arrays of keys, values, and entries, use
`Dict.size`, `Dict.is.empty`, `Dict.is.nonEmpty`, `Dict.keys`, `Dict.values`, and `Dict.entries`:

```ts
pipe(timeouts, Dict.has("webhook")); // true

Dict.size(timeouts);        // 2
Dict.is.empty(timeouts);    // false
Dict.is.nonEmpty(timeouts); // true (narrows to Dict.NonEmpty<string, number>)

Dict.keys(timeouts);        // ["api", "webhook"]
Dict.values(timeouts);      // [5000, 12000]
Dict.entries(timeouts);     // [["api", 5000], ["webhook", 12000]]
```

---

## Transforming Values and Keys

`Dict.map` applies a function to every value in the dictionary, returning a new `ReadonlyMap` with
the same keys. When the transformation also depends on the key, use `Dict.mapWithKey`:

```ts
// Convert millisecond timeouts to seconds:
const timeoutsInSeconds = pipe(
  timeouts,
  Dict.map((ms) => ms / 1000),
); // ReadonlyMap { "api" => 5, "webhook" => 12 }

// Include the service key in a formatted label:
const timeoutLabels = pipe(
  timeouts,
  Dict.mapWithKey((service, ms) => `${service}: ${ms}ms`),
); // ReadonlyMap { "api" => "api: 5000ms", "webhook" => "webhook: 12000ms" }
```

To transform only the keys of a dictionary, use `Dict.mapKeys`. To transform both keys and values
simultaneously in a single pass, use `Dict.mapEntries`:

```ts
const prefixedTimeouts = pipe(
  timeouts,
  Dict.mapKeys((service) => `svc_${service}`),
); // ReadonlyMap { "svc_api" => 5000, "svc_webhook" => 12000 }

const scaledEntries = pipe(
  timeouts,
  Dict.mapEntries((service, ms) => [service.toUpperCase(), ms * 2]),
); // ReadonlyMap { "API" => 10000, "WEBHOOK" => 24000 }
```

---

## Filtering and Compacting

`Dict.filter` retains entries whose values satisfy a predicate, and `Dict.filterWithKey` passes both
the key and value to the predicate:

```ts
const passingScores = pipe(
  scoresByUser,
  Dict.filter((score) => score >= 80),
); // ReadonlyMap { "alice" => 85, "bob" => 92 }

const nonInternalScores = pipe(
  Dict.from.record({ test_bot: 100, alice: 85, bob: 92 }),
  Dict.filterWithKey((username, score) => !username.startsWith("test_") && score >= 80),
); // ReadonlyMap { "alice" => 85, "bob" => 92 }
```

When mapping values with a parser or validator that returns `Maybe<B>`, `Dict.filterMap` transforms
and filters the dictionary in a single pass, keeping only unwrapped `Some` values. If you already
hold a `ReadonlyMap<K, Maybe<A>>`, `Dict.compact` unwraps all `Some` entries and discards all `None`
entries:

```ts
const parsePort = (raw: string): Maybe<number> => {
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 ? Maybe.make.some(port) : Maybe.make.none();
};

const rawPorts = Dict.from.record({ http: "8080", grpc: "invalid", metrics: "9090" });

const validPorts = pipe(rawPorts, Dict.filterMap(parsePort));
// ReadonlyMap { "http" => 8080, "metrics" => 9090 }

const optionalEndpoints = Dict.from.entries([
  ["primary", Maybe.make.some("10.0.0.1")],
  ["failover", Maybe.make.none()],
]);

const activeEndpoints = Dict.compact(optionalEndpoints);
// ReadonlyMap { "primary" => "10.0.0.1" }
```

---

## Modifying Entries Immutably

Every modification function in `Dict` leaves the input dictionary untouched and returns a new
`ReadonlyMap`. Use `Dict.insert` to add or overwrite a key, `Dict.remove` to delete a key, and
`Dict.upsert` when updating a key depends on whether an existing value is already present:

```ts
const baseQuota = Dict.from.record({ requests: 100, uploads: 10 });

const withDownloads = pipe(baseQuota, Dict.insert("downloads", 50));
// ReadonlyMap { "requests" => 100, "uploads" => 10, "downloads" => 50 }

const withoutUploads = pipe(baseQuota, Dict.remove("uploads"));
// ReadonlyMap { "requests" => 100 }

// Dict.upsert passes Some(existingValue) when the key is present, or None when absent:
const incrementCount = (existing: Maybe<number>): number =>
  pipe(existing, Maybe.getOrElse(() => 0)) + 1;

const afterRequest = pipe(baseQuota, Dict.upsert("requests", incrementCount));
// ReadonlyMap { "requests" => 101, "uploads" => 10 }

const afterFirstError = pipe(baseQuota, Dict.upsert("errors", incrementCount));
// ReadonlyMap { "requests" => 100, "uploads" => 10, "errors" => 1 }
```

---

## Combining Set Algebra and Merging

When reconciling two dictionaries, `Dict` provides three set-theoretic combinators plus a custom
collision merger:

`Dict.union(other)(dict)` combines all entries from both dictionaries, with values in `other`
overwriting matching keys in `dict`. `Dict.intersection(other)(dict)` keeps only keys that exist in
both dictionaries (preserving values from `dict`). `Dict.difference(other)(dict)` keeps only keys in
`dict` that do not exist in `other`:

```ts
const defaultFlags = Dict.from.record({ darkMode: false, betaSearch: false, telemetry: true });
const userOverrides = Dict.from.record({ darkMode: true, experimentalAi: true });

// Combine all keys (userOverrides wins on collisions):
const effectiveFlags = pipe(defaultFlags, Dict.union(userOverrides));
// ReadonlyMap { "darkMode" => true, "betaSearch" => false, "telemetry" => true, "experimentalAi" => true }

// Keep only keys present in both dictionaries:
const overlappingFlags = pipe(defaultFlags, Dict.intersection(userOverrides));
// ReadonlyMap { "darkMode" => false }

// Keep keys in defaultFlags that were NOT overridden by the user:
const untouchedDefaults = pipe(defaultFlags, Dict.difference(userOverrides));
// ReadonlyMap { "betaSearch" => false, "telemetry" => true }
```

When colliding keys should be combined with a calculation rather than overwritten, `Dict.mergeWith`
accepts a combiner callback `(first, second) => combined`:

```ts
const shardA = Dict.from.record({ clicks: 120, conversions: 8 });
const shardB = Dict.from.record({ clicks: 95, conversions: 12 });

const totalTraffic = pipe(
  shardA,
  Dict.mergeWith((a: number, b: number) => a + b)(shardB),
); // ReadonlyMap { "clicks" => 215, "conversions" => 20 }
```

---

## Reducing and Exporting

To fold a dictionary into a single summary value, `Dict.reduce` iterates over values, while
`Dict.reduceWithKey` passes `(accumulator, value, key)` to the reducer. To convert a string-keyed
dictionary back into a plain JavaScript `Readonly<Record<K, V>>`, use `Dict.to.record`:

```ts
const invoiceLines = Dict.from.record({ hosting: 150, support: 50, bandwidth: 25 });

const totalBilled = pipe(
  invoiceLines,
  Dict.reduce(0, (sum, amount) => sum + amount),
); // 225

const summaryLine = pipe(
  invoiceLines,
  Dict.reduceWithKey("", (acc, amount, item) =>
    acc === "" ? `${item}:$${amount}` : `${acc}, ${item}:$${amount}`,
  ),
); // "hosting:$150, support:$50, bandwidth:$25"

const plainRecord = Dict.to.record(invoiceLines);
// { hosting: 150, support: 50, bandwidth: 25 }
```

---

## Non-Empty Dictionaries: `Dict.NonEmpty`

When a function requires a dictionary guaranteed to contain at least one entry, use the branded type
`Dict.NonEmpty<K, V>`. You can create one directly with `Dict.NonEmpty.singleton`, narrow a
`ReadonlyMap` with the `Dict.is.nonEmpty` type guard, or refine an existing map into
`Maybe<Dict.NonEmpty<K, V>>` via `Dict.NonEmpty.from.map`:

```ts
const singleRegion = Dict.NonEmpty.singleton("us-east", 120); // Dict.NonEmpty<string, number>

const refinedMap = Dict.NonEmpty.from.map(invoiceLines);      // Some(Dict.NonEmpty<string, number>)
const emptyAttempt = Dict.NonEmpty.from.map(Dict.empty());    // None
```

Operating on `Dict.NonEmpty<K, V>` unlocks guaranteed non-empty array extractors
(`Dict.NonEmpty.keys`, `Dict.NonEmpty.values`, `Dict.NonEmpty.entries`), seedless reduction
(`Dict.NonEmpty.reduce`), and non-emptiness-preserving transformations (`Dict.NonEmpty.map`,
`Dict.NonEmpty.mapWithKey`):

```ts
const regionKeys = Dict.NonEmpty.keys(singleRegion);       // Arr.NonEmpty<string>
const regionValues = Dict.NonEmpty.values(singleRegion);   // Arr.NonEmpty<number>
const regionEntries = Dict.NonEmpty.entries(singleRegion); // Arr.NonEmpty<readonly [string, number]>

const highestLoad = pipe(
  singleRegion,
  Dict.NonEmpty.reduce((a, b) => Math.max(a, b)),
); // 120

const doubledLoad: Dict.NonEmpty<string, number> = pipe(
  singleRegion,
  Dict.NonEmpty.map((load) => load * 2),
);

const labeledLoad: Dict.NonEmpty<string, string> = pipe(
  singleRegion,
  Dict.NonEmpty.mapWithKey((region, load) => `${region}=${load}`),
);
```

For more details on non-empty data modeling across collections, see the
[Non-Empty Collections Guide](../nonempty).

---

## Pipeline Composition

Here is an end-to-end metrics aggregation pipeline that merges regional request counters, filters
out idle endpoints, normalizes route keys, and exports a plain JSON-serializable summary record:

```ts
import { Dict, pipe } from "@pplnd/core";

const usTraffic = Dict.from.record({
  "/V1/CHECKOUT": 450,
  "/V1/HEALTH": 0,
  "/V1/CATALOG": 1200,
});

const euTraffic = Dict.from.record({
  "/V1/CHECKOUT": 310,
  "/V1/HEALTH": 0,
  "/V1/SEARCH": 890,
});

const activeRouteReport = pipe(
  usTraffic,
  Dict.mergeWith((usCount: number, euCount: number) => usCount + euCount)(euTraffic),
  Dict.filter((totalRequests) => totalRequests > 0),
  Dict.mapKeys((route) => route.toLowerCase()),
  Dict.to.record,
);
// {
//   "/v1/checkout": 760,
//   "/v1/catalog": 1200,
//   "/v1/search": 890
// }
```

---

## Problems it solves

- **Entity caching with non-string keys**: Plain JavaScript objects coerce all keys into strings,
  which corrupts numeric database IDs or composite identifiers. `Dict` preserves typed non-string
  keys while providing guaranteed insertion-order iteration.
- **Safe map lookup in pipeline chains (`Dict.lookup`)**: Calling `.get(key)` on a standard `Map`
  returns `V | undefined`, which easily escapes into downstream arithmetic or method calls.
  `Dict.lookup` wraps lookups in `Maybe<V>`, enforcing compile-time absence handling before values
  can be used.
- **Immutable updates without shared-state mutation (`Dict.insert`, `Dict.remove`, `Dict.upsert`)**:
  Mutating a native `Map` with `.set()` or `.delete()` modifies shared references in place. `Dict`
  returns fresh `ReadonlyMap` instances on every update and provides atomic initialize-or-update
  semantics via `Dict.upsert`.
- **Pipeline transformation of key-value stores (`Dict.map`, `Dict.mapKeys`, `Dict.mapEntries`,
  `Dict.filterMap`, `Dict.compact`, `Dict.mergeWith`)**: Filtering invalid entries, merging
  configuration layers with custom collision resolvers, or transforming map keys and values in data
  pipelines without converting to arrays and back.
- **Dictionary set algebra (`Dict.union`, `Dict.intersection`, `Dict.difference`)**: Reconciling
  local entity caches with remote server state by finding updated, overlapping, or removed map
  entries without mutating input maps.
