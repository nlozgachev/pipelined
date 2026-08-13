---
title: Lazy — Memoized Computations
description: Defer expensive synchronous calculations to first use, caching the result automatically for all subsequent evaluations.
---

When developing software, we frequently face a design trade-off between eager evaluation and
repeated execution.

Consider a heavy synchronous operation, such as parsing a large local configuration payload or
compiling a complex regular expression sheet. If we evaluate it eagerly at startup, we pay the
computational cost immediately, even if the specific code path that requires the configuration is
never executed.

If we attempt to defer it by wrapping it in a standard function thunk `() => A`, we solve the
startup problem, but we introduce a new friction: the operation is executed and re-computed on
**every single call**, wasting CPU cycles over and over.

`Lazy<A>` represents the elegant middle ground. It is a simple data structure that wraps a
synchronous computation:

```ts
type Lazy<A> = {
  readonly get: () => A;
};
```

`Lazy` defers the execution of the computation until the exact moment the value is first requested.
Once evaluated, it caches the result, serving it instantly from memory for all subsequent requests
without ever executing the underlying operation again.

---

## Creating and Evaluating

We lift synchronous thunks into the `Lazy` context using its core constructor:

```ts
import { Lazy } from "@nlozgachev/pipelined/core";

// The computation is defined, but nothing runs yet
const config = Lazy.from(() => parseExpensiveConfiguration(rawInput));
```

To force the evaluation of the thunk and extract the cached result, we use `Lazy.evaluate`:

```ts
// 1. First read: the expensive parser executes
const value1 = Lazy.evaluate(config);

// 2. Second read: returns the cached value instantly
const value2 = Lazy.evaluate(config);
```

---

## Transforming and Sequencing

You can map over and sequence lazy computations point-free without triggering their evaluation.

### Transforming results with `map`

`map` describes how the deferred value should be transformed once it is eventually requested,
returning a new `Lazy` container:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

const databaseUrl = pipe(
  Lazy.from(() => loadConfiguration()),
  Lazy.map((cfg) => cfg.db.connectionString),
); // Lazy<string>

// loadConfiguration() has not executed yet
const url = Lazy.evaluate(databaseUrl); // Evaluated once and cached
```

### Sequencing dependencies with `chain`

When a transformation itself returns a `Lazy` container, we use `chain` to flatten the nested
context:

```ts
const dbConnection = pipe(
  Lazy.from(() => loadConfiguration()),
  Lazy.chain((cfg) => Lazy.from(() => openConnectionPool(cfg.db))),
); // Lazy<ConnectionPool>

const pool = Lazy.evaluate(dbConnection); // Both steps execute once in sequence
```

---

## Peeking with tap

`Lazy.tap` executes a side-effectful callback when the lazy container is evaluated for the first
time, passing the computed value through unchanged:

```ts
const priceCatalog = pipe(
  Lazy.from(() => computeDetailedPrices(rawCatalog)),
  Lazy.tap((prices) => console.log(`Price list of size ${prices.length} compiled`)),
);

// Nothing has run or logged yet
Lazy.evaluate(priceCatalog); // compute runs, then console.log fires — both once
Lazy.evaluate(priceCatalog); // returns cached value instantly — no console.log
```

---

## Problems it solves

- **Deferring expensive startup computations**: Compiling large regular expression suites, parsing
  extensive localization dictionaries, or validating JSON schemas at application startup degrades
  boot performance. `Lazy` postpones execution until a code path explicitly calls for the value,
  skipping the work entirely if that branch is not reached.
- **Request-scoped derivation memoization**: Within an HTTP request handler or calculation pipeline,
  multiple helper functions may require the same derived data (such as a decoded auth token payload,
  a compiled discount table, or a permission matrix). `Lazy` computes the value on the first access
  and caches the outcome for all subsequent steps within the request lifecycle.
- **Safe deferred dependency pipelines**: In modular services, constructing values that depend on
  other computed settings can trigger eager initialization ordering issues. `Lazy` allows
  transformation pipelines to be assembled point-free and evaluated only when downstream consumers
  require them.
