---
title: "Lazy — memoized computations"
description: Synchronous memoized thunks that run once and cache the result.
---

Some computations are expensive but only needed when a specific branch of code runs. You want to
defer the work until it is needed, and avoid repeating it if it is needed more than once.

JavaScript gives you two options: a plain function `() => A` (defers but re-runs every call) or an
eagerly-evaluated value (cached, but runs immediately on construction). `Lazy<A>` is the middle
ground — it defers evaluation to first use, then caches the result for every subsequent call.

## The Lazy type

```ts
type Lazy<A> = { readonly get: () => A };
```

A `Lazy<A>` wraps a computation that produces an `A`. The computation runs exactly once — on the
first call to `Lazy.evaluate` — and the result is cached for every call after that.

## Creating and evaluating a Lazy value

Use `Lazy.from` to wrap any synchronous thunk:

```ts
import { Lazy, pipe } from "@nlozgachev/pipelined/core";

const config = Lazy.from(() => parseConfig(rawInput));
```

Nothing runs at this point. `parseConfig` is deferred until the value is actually needed.

To force evaluation and get the result, call `Lazy.evaluate`:

```ts
const value = Lazy.evaluate(config); // parseConfig runs here, exactly once
const same  = Lazy.evaluate(config); // cached — parseConfig does not run again
```

## Transforming without evaluating

`Lazy.map` transforms the result of a `Lazy` without triggering evaluation. The transformation runs
once, at the same moment the lazy value is first evaluated:

```ts
const port = pipe(
  Lazy.from(() => loadConfig()),
  Lazy.map(cfg => cfg.port),
);

// loadConfig() has not run yet
const p = Lazy.evaluate(port); // loadConfig runs once, returns cfg.port
```

`Lazy.chain` is for transformations that themselves return a `Lazy`:

```ts
const connection = pipe(
  Lazy.from(() => loadConfig()),
  Lazy.chain(cfg => Lazy.from(() => openConnection(cfg.dbUrl))),
);

Lazy.evaluate(connection); // loadConfig runs, then openConnection runs — each exactly once
```

## Side effects with tap

`Lazy.tap` lets you observe the value as a side effect without changing it. The effect fires once,
on first evaluation:

```ts
const priceList = pipe(
  Lazy.from(() => computePriceList(catalog)),
  Lazy.tap(prices => console.log(`Computed ${prices.length} prices`)),
);

// Nothing has run yet
Lazy.evaluate(priceList); // compute runs, then console.log fires — both once
Lazy.evaluate(priceList); // no-op: cached, no log
```

## When to use Lazy

Use `Lazy<A>` when a synchronous computation is expensive and its result may not always be needed.
The canonical case is a value computed at most once per request or lifecycle, but only when a
specific code path is taken.

Do not use `Lazy<A>` for async work — use `Task<A>` instead. Do not use it for computations with
side effects that should repeat on each call — use a plain function `() => A`. If the value is
always needed immediately, just evaluate directly instead of wrapping in `Lazy.from`.
