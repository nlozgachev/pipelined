---
title: Dict — dictionary utilities
description: Pure, composable operations for key-value maps — lookup returns Option, every operation returns a new map.
---

You reach for a `Map` when you need to associate values with keys that aren't strings, or when
you want insertion-order iteration guaranteed, or when you're working with a large collection
where key membership checks matter. The native `Map` API gives you this, but it's mutation-based
and doesn't compose with `pipe`.

`Dict` wraps `ReadonlyMap<K, V>` with a set of pure, data-last functions that do.

## Creating a dictionary

The three main constructors cover the common cases. `Dict.empty()` starts you with nothing.
`Dict.fromEntries` converts an array of key-value pairs — the same format you'd use with
`Object.fromEntries`, but for maps with any key type. `Dict.fromRecord` imports a plain object
when you already have one:

```ts
import { Dict } from "@nlozgachev/pipelined/utils";

const empty = Dict.empty<string, number>();

const byId = Dict.fromEntries([
  ["u1", { name: "Alice", role: "admin" }],
  ["u2", { name: "Bob",   role: "editor" }],
]);

const scores = Dict.fromRecord({ alice: 85, bob: 92, carol: 74 });
```

`Dict.singleton` is useful when you're building up a map incrementally and want a typed
starting point with one known entry.

## Looking up values safely

The native `Map.get` returns `V | undefined`, which forces a null check at every call site.
`Dict.lookup` returns `Option<V>` instead — the absence of a key is explicit in the type:

```ts
import { Dict } from "@nlozgachev/pipelined/utils";
import { Option } from "@nlozgachev/pipelined/core";
import { pipe } from "@nlozgachev/pipelined/composition";

const config = Dict.fromRecord({ timeout: 5000, retries: 3 });

pipe(config, Dict.lookup("timeout"));  // Some(5000)
pipe(config, Dict.lookup("missing")); // None
```

When you only need a boolean, `Dict.has` is the right tool — it avoids allocating an `Option`
for what is essentially a membership test:

```ts
pipe(config, Dict.has("retries")); // true
```

## Transforming values

`Dict.map` applies a function to every value, returning a new dictionary with the same keys.
`Dict.mapWithKey` is the same but also passes the key to the function:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

// Normalise all scores to a 0–1 scale
pipe(scores, Dict.map(score => score / 100));

// Prepend the key to each value for display
pipe(
  Dict.fromRecord({ alice: "admin", bob: "editor" }),
  Dict.mapWithKey((name, role) => `${name} (${role})`),
);
// ReadonlyMap { "alice" => "alice (admin)", "bob" => "bob (editor)" }
```

## Filtering

`Dict.filter` removes entries whose values don't match a predicate. `Dict.filterWithKey` also
exposes the key to the predicate, which is useful when the decision depends on both:

```ts
// Keep only passing scores
pipe(scores, Dict.filter(score => score >= 75));

// Remove entries where the key starts with a prefix
pipe(
  Dict.fromRecord({ test_alice: 1, alice: 2, test_bob: 3 }),
  Dict.filterWithKey((k, _v) => !k.startsWith("test_")),
);
// ReadonlyMap { "alice" => 2 }
```

## Modifying individual entries

`Dict.insert` adds or replaces a single entry. `Dict.remove` removes one. Neither mutates the
original — both return a new dictionary:

```ts
const base = Dict.fromRecord({ views: 10, likes: 2 });

pipe(base, Dict.insert("shares", 5));
// ReadonlyMap { "views" => 10, "likes" => 2, "shares" => 5 }

pipe(base, Dict.remove("likes"));
// ReadonlyMap { "views" => 10 }
```

For the common pattern of incrementing a counter or initialising a value on first access,
`Dict.upsert` provides a single operation. It calls your function with `Some(currentValue)` if
the key exists, or `None` if it doesn't:

```ts
import { Option } from "@nlozgachev/pipelined/core";

const increment = (opt: Option<number>) => (opt.kind === "Some" ? opt.value : 0) + 1;

pipe(base, Dict.upsert("views", increment));
// ReadonlyMap { "views" => 11, "likes" => 2 }

pipe(base, Dict.upsert("shares", increment));
// ReadonlyMap { "views" => 10, "likes" => 2, "shares" => 1 }
```

## Combining dictionaries

`Dict.union` merges two dictionaries. When a key exists in both, the value from `other` takes
precedence — the same behaviour as spreading objects:

```ts
const defaults = Dict.fromRecord({ timeout: 3000, retries: 3, debug: false });
const overrides = Dict.fromRecord({ timeout: 10000, debug: true });

pipe(defaults, Dict.union(overrides));
// ReadonlyMap { "timeout" => 10000, "retries" => 3, "debug" => true }
```

`Dict.intersection` keeps only the keys that appear in both dictionaries, taking values from
the left. `Dict.difference` removes from the left any keys that appear in the right:

```ts
const allUsers   = Dict.fromRecord({ alice: "admin", bob: "editor", carol: "viewer" });
const activeIds  = Dict.fromRecord({ alice: true, carol: true });
const removedIds = Dict.fromRecord({ bob: true });

pipe(allUsers, Dict.intersection(activeIds));
// ReadonlyMap { "alice" => "admin", "carol" => "viewer" }

pipe(allUsers, Dict.difference(removedIds));
// ReadonlyMap { "alice" => "admin", "carol" => "viewer" }
```

## Removing absent values with compact

When you build a dictionary from fallible lookups — mapping over IDs that might not exist — you
end up with `ReadonlyMap<K, Option<V>>`. `Dict.compact` collapses that into `ReadonlyMap<K, V>`:

```ts
import { Option } from "@nlozgachev/pipelined/core";

const profileMap = Dict.fromEntries<string, Option<string>>([
  ["alice", Option.some("Alice Smith")],
  ["b404",  Option.none()],
  ["carol", Option.some("Carol Jones")],
]);

Dict.compact(profileMap);
// ReadonlyMap { "alice" => "Alice Smith", "carol" => "Carol Jones" }
```

## Folding and converting

`Dict.reduce` collapses the dictionary to a single value. `Dict.toRecord` converts a
string-keyed dictionary back to a plain object when you need to pass it to code that expects one:

```ts
// Sum all values
Dict.reduce(0, (acc, value) => acc + value)(scores); // e.g. 251

// Export for JSON serialisation
Dict.toRecord(scores); // { alice: 85, bob: 92, carol: 74 }
```

## Composing it all

`Dict` operations chain naturally in `pipe`. Here, a dictionary of raw exam results is built,
filtered to passing grades, scaled, and summed:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

pipe(
  Dict.fromRecord({ alice: 85, bob: 42, carol: 91, dave: 68 }),
  Dict.filter(score => score >= 50),       // remove failures
  Dict.map(score => Math.round(score / 10)), // convert to grade 1–10
  Dict.reduce(0, (acc, grade) => acc + grade), // total grade points
);
```

## When to use Dict

Use `Dict` when:

- You need keys that aren't strings — numbers, objects, or any other type
- You need guaranteed insertion-order iteration over entries
- You're building lookup tables that grow and shrink over time
- You want `lookup` to return `Option` instead of a nullable value

Keep using `Rec` when:

- Your keys are always strings and you're working with plain objects from JSON or APIs
- You need `pick`, `omit`, or `mapKeys` operations (not available on `Dict`)
- You're interoperating with code that expects `Record<string, V>` directly
