---
title: Rec — record utilities
description: Work with records in a pipeline — data-last utilities with Maybe-returning key lookup.
---

Plain JavaScript objects used as maps — `Record<string, A>` — are one of the most common data
structures in any TypeScript codebase. `Rec` is a small collection of utilities for working with
them in pipelines: data-last, curried, and returning `Maybe` wherever a key might not exist.

## Safe lookup

`Rec.lookup` retrieves a value by key and returns `Maybe` to make the absence explicit:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe, Rec } from "@nlozgachev/pipelined/core";

const settings = { theme: "dark", lang: "en" };

pipe(settings, Rec.lookup("theme")); // Some("dark")
pipe(settings, Rec.lookup("font")); // None — not undefined
```

This composes naturally with `Maybe` operations:

```ts
pipe(
	config,
	Rec.lookup("timeout"), // Maybe<string>
	Maybe.chain(parseNumber), // Maybe<number>
	Maybe.getOrElse(() => 30_000),
);
```

## Transforming values

**`map`** transforms every value in a record, preserving keys:

```ts
pipe({ a: 1, b: 2, c: 3 }, Rec.map((n) => n * 10));
// { a: 10, b: 20, c: 30 }
```

**`mapWithKey`** receives both key and value:

```ts
pipe({ a: 1, b: 2 }, Rec.mapWithKey((key, val) => `${key}=${val}`));
// { a: "a=1", b: "b=2" }
```

## Filtering

**`filter`** keeps entries where the predicate passes:

```ts
pipe({ a: 1, b: 2, c: 3 }, Rec.filter((n) => n > 1));
// { b: 2, c: 3 }
```

**`filterWithKey`** receives both key and value:

```ts
pipe(
	{ a: 1, b: 0, c: 3 },
	Rec.filterWithKey((key, val) => key !== "a" && val > 0),
); // { c: 3 }
```

## Picking and omitting keys

**`pick`** returns a new record with only the specified keys:

```ts
pipe({ a: 1, b: 2, c: 3 }, Rec.pick("a", "c")); // { a: 1, c: 3 }
```

**`omit`** returns a new record with the specified keys removed:

```ts
pipe({ a: 1, b: 2, c: 3 }, Rec.omit("b")); // { a: 1, c: 3 }
```

Both are type-safe: `pick` returns `Pick<A, K>` and `omit` returns `Omit<A, K>`, so the resulting
type reflects exactly which keys are present.

## Merging

**`merge`** combines two records. Keys in the second record take precedence over the first:

```ts
pipe(
	{ a: 1, b: 2 },
	Rec.merge({ b: 99, c: 3 }),
); // { a: 1, b: 99, c: 3 }
```

## Keys, values, and entries

```ts
const rec = { x: 10, y: 20 };

Rec.keys(rec); // ["x", "y"]
Rec.values(rec); // [10, 20]
Rec.entries(rec); // [["x", 10], ["y", 20]]
```

**`fromEntries`** is the inverse — builds a record from key-value pairs:

```ts
Rec.fromEntries([["a", 1], ["b", 2]]); // { a: 1, b: 2 }
```

`entries` and `fromEntries` pair well when you want to transform both keys and values by converting
to entries, mapping, and converting back:

```ts
pipe(
	{ firstName: "Alice", lastName: "Smith" },
	Rec.entries,
	(entries) => entries.map(([k, v]) => [k.toUpperCase(), v] as const),
	Rec.fromEntries,
); // { FIRSTNAME: "Alice", LASTNAME: "Smith" }
```

## Inspecting size

```ts
Rec.isEmpty({ a: 1 }); // false
Rec.isEmpty({}); // true
Rec.size({ a: 1, b: 2 }); // 2
```

## Combining with pipe

Because all `Rec` functions are curried and data-last, they chain naturally:

```ts
const result = pipe(
	rawConfig,
	Rec.filter((v) => v !== null),
	Rec.mapWithKey((key, val) => `${key}: ${val}`),
	Rec.omit("debug", "internal"),
);
```

Each step produces a new record — no mutation, no intermediate variables.
