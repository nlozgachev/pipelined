---
title: Rec — Record Utilities
description: Work with plain JavaScript objects as key-value records immutably and safely inside pipelines, using data-last utilities with type-safe key lookup.
---

<!-- BUNDLE_SIZE:START -->

> 2.54 kB minified + gzipped

<!-- BUNDLE_SIZE:END -->

Plain JavaScript objects serving as string-keyed dictionaries — typed as `Record<string, A>` — are
used everywhere in TypeScript applications for configurations, HTTP headers, lookup tables, and JSON
payloads.

However, working with records in standard JavaScript introduces two recurring problems:

1. **Object operations are imperative or verbose**: Transforming values across a record requires
   converting the object with `Object.entries(obj)`, mapping the array of pairs, and rebuilding the
   object with `Object.fromEntries(...)`.
2. **Dynamic key access is unsafe**: Looking up a key with bracket notation (`headers[key]`)
   silently returns `undefined` at runtime when the key is missing, and accessing `"__proto__"` or
   `"toString"` can collide with `Object.prototype` properties unless guarded with `Object.hasOwn`.

```ts
// Native dynamic lookup returns undefined without forcing a check:
const timeoutMs = Number(rawConfig["request_timeout"].trim()); // TypeError if key is missing!
```

`Rec` solves both issues by providing pure, curried, **data-last** utilities over immutable
`Readonly<Record<K, A>>` objects, returning `Maybe` for dynamic lookups and protecting against
prototype pollution automatically.

---

## Safe Key Lookup and Inspection

`Rec.lookup` checks own properties via `Object.hasOwn` and returns the value wrapped in a `Maybe`
container, making missing keys explicit in the type system:

```ts
import { Maybe, pipe, Rec } from "@pplnd/core";

const envConfig: Readonly<Record<string, string>> = {
  PORT: "8080",
  LOG_LEVEL: "info",
};

pipe(envConfig, Rec.lookup("PORT"));    // Some("8080")
pipe(envConfig, Rec.lookup("TIMEOUT")); // None (never undefined)
```

Because `Rec.lookup` returns a `Maybe`, it composes directly with parsing and fallback steps:

```ts
const serverTimeout = pipe(
  envConfig,
  Rec.lookup("TIMEOUT"),
  Maybe.map((raw) => Number(raw)),
  Maybe.filter((ms) => Number.isFinite(ms) && ms > 0),
  Maybe.getOrElse(() => 30_000),
); // 30000
```

To inspect the size or emptiness of a record, use `Rec.size`, `Rec.is.empty`, and `Rec.is.nonEmpty`:

```ts
Rec.is.empty({});          // true
Rec.is.empty(envConfig);   // false
Rec.is.nonEmpty(envConfig); // true (narrows to Rec.NonEmpty<string>)
Rec.size(envConfig);       // 2
```

---

## Transforming Values and Keys

`Rec.map` transforms every value inside a record while preserving its keys. When the transformation
also needs access to the property key, use `Rec.mapWithKey`:

```ts
const planPrices = { starter: 20, pro: 50, enterprise: 200 };

// Apply a 10% annual discount to every plan:
const annualPrices = pipe(
  planPrices,
  Rec.map((monthly) => monthly * 0.9),
); // { starter: 18, pro: 45, enterprise: 180 }

// Format labels using both the plan key and price:
const priceLabels = pipe(
  planPrices,
  Rec.mapWithKey((plan, price) => `${plan.toUpperCase()}: $${price}/mo`),
);
// { starter: "STARTER: $20/mo", pro: "PRO: $50/mo", enterprise: "ENTERPRISE: $200/mo" }
```

When you need to rename keys across a record — such as normalizing HTTP header names or prefixing
configuration keys — `Rec.mapKeys` transforms each key while preserving its value. To transform both
keys and values in a single pass, `Rec.mapEntries` maps each `(key, value)` pair to a new
`[newKey, newValue]` tuple:

```ts
const rawHeaders = { "Content-Type": "application/json", "X-Request-Id": "req_99" };

const lowercaseHeaders = pipe(
  rawHeaders,
  Rec.mapKeys((header) => header.toLowerCase()),
); // { "content-type": "application/json", "x-request-id": "req_99" }

const sanitizedEnv = pipe(
  { db_host: "  localhost ", db_port: " 5432 " },
  Rec.mapEntries((key, val) => [key.toUpperCase(), val.trim()]),
); // { DB_HOST: "localhost", DB_PORT: "5432" }
```

---

## Filtering and Compacting

`Rec.filter` keeps only the entries whose values satisfy a predicate, while `Rec.filterWithKey`
passes both the key and the value to the predicate:

```ts
const warehouseStock = { sku_keyboard: 14, sku_mouse: 0, sku_monitor: 5, temp_hold: 2 };

// Keep only in-stock items:
const availableStock = pipe(
  warehouseStock,
  Rec.filter((count) => count > 0),
); // { sku_keyboard: 14, sku_monitor: 5, temp_hold: 2 }

// Exclude internal temporary keys and zero-stock items:
const publicInventory = pipe(
  warehouseStock,
  Rec.filterWithKey((key, count) => !key.startsWith("temp_") && count > 0),
); // { sku_keyboard: 14, sku_monitor: 5 }
```

When you want to transform values and discard failed or empty results simultaneously,
`Rec.filterMap` applies a `Maybe`-returning function to each value and retains only the `Some`
results. If you already have a record of `Maybe<A>` values, `Rec.compact` unwraps all `Some` entries
and drops all `None` entries:

```ts
const rawEnvOverrides = { WORKER_CONCURRENCY: "8", RETRY_LIMIT: "invalid", CACHE_TTL: "300" };

const parsedOverrides = pipe(
  rawEnvOverrides,
  Rec.filterMap((raw) => {
    const num = Number(raw);
    return Number.isInteger(num) ? Maybe.make.some(num) : Maybe.make.none();
  }),
); // { WORKER_CONCURRENCY: 8, CACHE_TTL: 300 }

const optionalFeatureOwners = {
  billing: Maybe.make.some("team-fin"),
  legacyReport: Maybe.make.none(),
  search: Maybe.make.some("team-core"),
};

const activeFeatureOwners = Rec.compact(optionalFeatureOwners);
// { billing: "team-fin", search: "team-core" }
```

---

## Picking, Omitting, and Grouping

`Rec.pick` creates a new record containing only the specified keys (`Pick<A, K>`), while `Rec.omit`
creates a new record with the specified keys removed (`Omit<A, K>`):

```ts
const userAccount = {
  id: "usr_42",
  email: "alice@example.com",
  passwordHash: "$2b$12$...",
  role: "admin",
};

const publicProfile = pipe(userAccount, Rec.pick("id", "role"));
// { id: "usr_42", role: "admin" }

const safePayload = pipe(userAccount, Rec.omit("passwordHash"));
// { id: "usr_42", email: "alice@example.com", role: "admin" }
```

To group an array of items into a record keyed by a string selector, use `Rec.groupBy`:

```ts
const employees = [
  { name: "Alice", department: "engineering" },
  { name: "Bob", department: "sales" },
  { name: "Carol", department: "engineering" },
];

const byDepartment = pipe(
  employees,
  Rec.groupBy((emp) => emp.department),
);
// {
//   engineering: [{ name: "Alice", department: "engineering" }, { name: "Carol", department: "engineering" }],
//   sales: [{ name: "Bob", department: "sales" }]
// }
```

---

## Merging and Deep Updates

`Rec.merge` combines two records into a new object where keys in the second record override keys in
the first. When you want to combine colliding values using a custom function rather than overwriting
them, use `Rec.mergeWith`:

```ts
const defaultQuotas = { apiCalls: 1000, storageGb: 10 };
const planAddons = { storageGb: 50, seats: 5 };

// Right-precedence shallow merge:
const effectiveQuotas = pipe(defaultQuotas, Rec.merge(planAddons));
// { apiCalls: 1000, storageGb: 50, seats: 5 }

// Custom collision resolution (summing values for matching keys):
const combinedQuotas = pipe(
  defaultQuotas,
  Rec.mergeWith((base: number, addon: number) => base + addon)(planAddons),
);
// { apiCalls: 1000, storageGb: 60, seats: 5 }
```

When updating a deeply nested property inside a record, `Rec.updateIn` applies a transformation at a
path tuple without verbose nested object spreads:

```ts
const serviceConfig = {
  server: {
    database: { poolSize: 5 },
  },
};

const scaledConfig = pipe(
  serviceConfig,
  Rec.updateIn(["server", "database", "poolSize"], (size: number) => size * 2),
);
// { server: { database: { poolSize: 10 } } }
```

---

## Keys, Values, Entries, and Conversions

`Rec.keys`, `Rec.values`, and `Rec.entries` extract typed arrays from a record, while
`Rec.from.entries` builds a record from `[key, value]` tuples. To convert a string-keyed record into
an immutable `ReadonlyMap<K, A>` for use with `Dict`, use `Rec.to.Dict`:

```ts
const regionEndpoints = { us: "https://us.api.internal", eu: "https://eu.api.internal" };

Rec.keys(regionEndpoints);    // ["us", "eu"]
Rec.values(regionEndpoints);  // ["https://us.api.internal", "https://eu.api.internal"]
Rec.entries(regionEndpoints); // [["us", "https://us.api.internal"], ["eu", "https://eu.api.internal"]]

const rebuilt = Rec.from.entries([["ap", "https://ap.api.internal"]]);
// { ap: "https://ap.api.internal" }

const endpointMap = Rec.to.Dict(regionEndpoints);
// ReadonlyMap { "us" => "https://us.api.internal", "eu" => "https://eu.api.internal" }
```

---

## Traversing and Sequencing Records

When you validate or transform every value in a record using a function that returns a `Maybe` or
`Result`, `Rec.traverse` collects the results into a single `Maybe` or `Result` wrapping the entire
record, short-circuiting on the first failure. `Rec.sequence` performs the same flip on a record
whose values are already wrapped in `Maybe` or `Result`:

```ts
import { Result } from "@pplnd/core";

const parsePort = (raw: string): Maybe<number> => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? Maybe.make.some(n) : Maybe.make.none();
};

pipe({ http: "8080", metrics: "9090" }, Rec.traverse.Maybe(parsePort));
// Some({ http: 8080, metrics: 9090 })

pipe({ http: "8080", metrics: "invalid" }, Rec.traverse.Maybe(parsePort));
// None

Rec.sequence.Maybe({ http: Maybe.make.some(8080), metrics: Maybe.make.none() });
// None
```

Using `Rec.traverse.Result` and `Rec.sequence.Result` preserves the error of whichever key fails
first:

```ts
const validateAllocation = (percent: number): Result<string, number> =>
  percent >= 0 && percent <= 100
    ? Result.make.ok(percent)
    : Result.make.err(`Invalid allocation percentage: ${percent}`);

pipe({ equities: 60, bonds: 40 }, Rec.traverse.Result(validateAllocation));
// Ok({ equities: 60, bonds: 40 })

pipe({ equities: 60, bonds: -10 }, Rec.traverse.Result(validateAllocation));
// Err("Invalid allocation percentage: -10")

Rec.sequence.Result({
  equities: Result.make.ok(60),
  bonds: Result.make.err("Missing bond pricing"),
});
// Err("Missing bond pricing")
```

---

## Non-Empty Records: `Rec.NonEmpty`

When a function requires a compile-time guarantee that a record has at least one key-value entry,
use `Rec.NonEmpty<A, K>`. You can construct one directly with `Rec.NonEmpty.singleton`, narrow a
record with the `Rec.is.nonEmpty` type guard, or refine a record into `Maybe<Rec.NonEmpty<A, K>>`
via `Rec.NonEmpty.from.record`:

```ts
const primaryNode = Rec.NonEmpty.singleton("us_east_1", "10.0.1.12"); // Rec.NonEmpty<string, "us_east_1">

const verifiedNodes = Rec.NonEmpty.from.record({ us_east_1: "10.0.1.12", eu_west_1: "10.0.2.8" });
// Some(Rec.NonEmpty<string, "us_east_1" | "eu_west_1">)

const emptyNodes = Rec.NonEmpty.from.record({}); // None
```

Extracting keys, values, or entries from a `Rec.NonEmpty` via `Rec.NonEmpty.keys`,
`Rec.NonEmpty.values`, and `Rec.NonEmpty.entries` returns a guaranteed non-empty array
(`Arr.NonEmpty`), and `Rec.NonEmpty.reduce` folds the values without needing an initial seed value:

```ts
const serviceLatencies = Rec.NonEmpty.singleton("auth", 42);

const names = Rec.NonEmpty.keys(serviceLatencies);      // Arr.NonEmpty<"auth">
const timings = Rec.NonEmpty.values(serviceLatencies);  // Arr.NonEmpty<number>
const pairs = Rec.NonEmpty.entries(serviceLatencies);   // Arr.NonEmpty<readonly ["auth", number]>

const maxLatency = pipe(
  serviceLatencies,
  Rec.NonEmpty.reduce((a, b) => Math.max(a, b)),
); // 42
```

Because top-level `Rec.map` and `Rec.mapWithKey` return general `Readonly<Record<K, B>>` types, use
`Rec.NonEmpty.map` and `Rec.NonEmpty.mapWithKey` when you want transformations to preserve the
`Rec.NonEmpty<B, K>` brand across a pipeline:

```ts
const latenciesInSeconds: Rec.NonEmpty<number, "auth"> = pipe(
  serviceLatencies,
  Rec.NonEmpty.map((ms) => ms / 1000),
);

const formattedLatencies: Rec.NonEmpty<string, "auth"> = pipe(
  serviceLatencies,
  Rec.NonEmpty.mapWithKey((service, ms) => `${service}: ${ms}ms`),
);
```

For more details on non-empty data modeling, see the [Non-Empty Collections Guide](../nonempty).

---

## Pipeline Composition

Here is an end-to-end configuration ingestion pipeline that merges raw environment overrides onto
default service limits, normalizes keys to lowercase, parses numeric strings while discarding
malformed values, and extracts the active worker limit:

```ts
import { Maybe, Num, pipe, Rec } from "@pplnd/core";

const defaultLimits: Readonly<Record<string, string>> = {
  MAX_CONNECTIONS: "100",
  WORKER_THREADS: "4",
  REQUEST_TIMEOUT_MS: "5000",
};

const rawOverrides: Readonly<Record<string, string>> = {
  WORKER_THREADS: "16",
  REQUEST_TIMEOUT_MS: "invalid_number",
};

const validatedLimits = pipe(
  defaultLimits,
  Rec.merge(rawOverrides),
  Rec.mapKeys((key) => key.toLowerCase()),
  Rec.filterMap(Num.from.string),
);
// { max_connections: 100, worker_threads: 16 }

const workerThreads = pipe(
  validatedLimits,
  Rec.lookup("worker_threads"),
  Maybe.getOrElse(() => 1),
); // 16
```

---

## Problems it solves

- **Type-safe payload sanitization**: When preparing API responses, stripping sensitive fields (such
  as password hashes, secret tokens, or internal flags) using `Rec.omit` or retaining allowed fields
  via `Rec.pick` narrows the TypeScript type statically, preventing accidental access to omitted
  properties downstream.
- **Transforming and filtering record values in pipelines**: When processing dynamic dictionaries
  (such as converting string prices to numbers or stripping empty optional fields), `Rec.map`,
  `Rec.filter`, `Rec.filterMap`, and `Rec.compact` apply transformations directly within `pipe`
  workflows while preserving key structure.
- **Payload key migration and renaming (`Rec.mapKeys`, `Rec.mapEntries`)**: When ingesting
  third-party webhook payloads or normalizing HTTP headers, `Rec.mapKeys` and `Rec.mapEntries`
  transform object keys and values immutably without manual `Object.entries` / `Object.fromEntries`
  boilerplate.
- **Safe dynamic property retrieval (`Rec.lookup`)**: When looking up runtime keys in configuration
  objects, user attributes, or localized string tables, direct index access (`obj[key]`) returns
  `undefined` without static warnings. `Rec.lookup` checks `Object.hasOwn` and returns `Maybe<V>`,
  requiring explicit presence handling before operating on values.
- **Merging multi-layer configuration records (`Rec.merge`, `Rec.mergeWith`)**: Combining default
  settings with user overrides or accumulating metrics across datasets using custom collision
  handlers.
- **Deep immutable updates without spread nesting (`Rec.updateIn`)**: Updating nested properties in
  deeply structured configuration objects without writing repetitive object spread boilerplate.
