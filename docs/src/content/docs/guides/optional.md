---
title: Optional — nullable paths
description: Focus on a field or index that may be absent — read and update nullable paths without null checks.
---

If you haven't read the [Lens guide](/guides/lens) first, start there. It covers why mutating
objects directly causes problems and why producing new copies is the right approach. `Optional`
builds on that same idea — the difference is that the path through the data might not reach
anything.

## The gap in TypeScript's optional chaining

TypeScript's `?.` operator lets you safely read through a path that might not exist:

```ts
const city = user.address?.city; // string | undefined
```

But `?.` is read-only. The moment you want to update something at the end of that path,
it stops working. There is no `?.=` operator. You are back to writing spreads with conditionals:

```ts
const updated = user.address
  ? { ...user, address: { ...user.address, city: "Hamburg" } }
  : user; // do nothing if address isn't there
```

`Optional<S, A>` closes that gap. It is a path through your data that accepts the path might
not reach anything. Reads return `Maybe<A>` instead of `A`. Writes and modifications are
no-ops when the path finds nothing — no conditional required.

## The Optional approach

```ts
import { Optional } from "@nlozgachev/pipelined/core";
import { pipe } from "@nlozgachev/pipelined/composition";

type User = { name: string; address?: { city: string; zip: string } };

const addressOpt = Optional.prop<User>()("address");

pipe(user, Optional.get(addressOpt));         // Some({ city: "Berlin", zip: "10115" }) or None
pipe(user, Optional.set(addressOpt)(newAddr)); // new User with address replaced, or unchanged if absent
pipe(user, Optional.modify(addressOpt)(a => ({ ...a, city: "Hamburg" }))); // update if present, skip if not
```

No conditional. The absent case is handled by the Optional itself.

## Defining an optional path

**`Optional.prop`** points at an optional field — one declared with `?` in its type. Required
fields belong to `Lens.prop`; `Optional.prop` only accepts keys where the value might be
`undefined`:

```ts
type Profile = { username: string; bio?: string };

const bioOpt = Optional.prop<Profile>()("bio"); // Optional<Profile, string>
```

**`Optional.index`** points at an element in an array by position:

```ts
const firstOpt = Optional.index<string>(0); // Optional<string[], string>
```

Out-of-bounds reads return `None`. Out-of-bounds writes leave the array unchanged.

**`Optional.make`** constructs a custom optional from an explicit getter and setter:

```ts
const firstChar = Optional.make(
  (s: string) => s.length > 0 ? Maybe.some(s[0]) : Maybe.none(),
  (c) => (s) => s.length > 0 ? c + s.slice(1) : s,
);
```

## Reading

`Optional.get` returns `Maybe<A>` — `Some` when the value is there, `None` when it isn't:

```ts
pipe({ username: "alice", bio: "hello" }, Optional.get(bioOpt)); // Some("hello")
pipe({ username: "alice" }, Optional.get(bioOpt));               // None
```

Extracting a plain value from the result:

```ts
// Provide a fallback:
pipe(profile, Optional.getOrElse(bioOpt)(() => "no bio"));

// Handle both cases by name:
pipe(
  profile,
  Optional.match(bioOpt)({
    none: () => "no bio",
    some: (bio) => bio.toUpperCase(),
  }),
);

// Or positionally (none handler first):
pipe(
  profile,
  Optional.fold(bioOpt)(
    () => "no bio",
    (bio) => bio.toUpperCase(),
  ),
);
```

## Writing

`Optional.set` always produces a new object — it never mutates. For optional properties, it
inserts the value whether or not the field was there before. For array indices, it is a no-op
when the index is out of bounds:

```ts
// Optional field — inserts even when previously absent:
pipe({ username: "alice" }, Optional.set(bioOpt)("hello"));
// { username: "alice", bio: "hello" }

// Array index — replaces if in bounds:
pipe(["a", "b", "c"], Optional.set(Optional.index<string>(1))("z"));
// ["a", "z", "c"]

// Array index — no-op if out of bounds:
pipe([], Optional.set(Optional.index<string>(0))("z"));
// []
```

`Optional.modify` applies a function to the value if it is present, and returns the structure
unchanged if it is not:

```ts
pipe(profile, Optional.modify(bioOpt)(s => s.trim()));
// trims the bio if present, returns profile unchanged if absent
```

## Composing paths

`Optional.andThen` extends a path by another optional step. If either step finds nothing, the
whole path returns `None` for reads and does nothing for writes:

```ts
type City   = { name: string; landmark?: string };
type Region = { capital?: City };

const landmarkOpt = pipe(
  Optional.prop<Region>()("capital"),
  Optional.andThen(Optional.prop<City>()("landmark")),
); // Optional<Region, string>
```

When the next step is a required field once the optional part resolves, use `andThenLens` to
continue with a `Lens` rather than converting it to an `Optional` manually:

```ts
const capitalNameOpt = pipe(
  Optional.prop<Region>()("capital"),
  Optional.andThenLens(Lens.prop<City>()("name")),
); // Optional<Region, string>
```

## Starting from a Lens

A path often begins through required fields and then reaches an optional one. Convert the `Lens`
to an `Optional` with `Lens.toOptional` and continue from there:

```ts
pipe(
  Lens.prop<User>()("profile"),      // Lens<User, Profile>
  Lens.toOptional,                   // Optional<User, Profile>
  Optional.andThen(Optional.prop<Profile>()("bio")), // Optional<User, string>
);
```

## Lens vs Optional — when to use which

| Situation                                      | Use                                         |
| ---------------------------------------------- | ------------------------------------------- |
| Required field, always present                 | `Lens.prop`                                 |
| Optional field (`field?: T`)                   | `Optional.prop`                             |
| Array element by index                         | `Optional.index`                            |
| Path that starts required and becomes optional | `Lens.andThenOptional` or `Lens.toOptional` |
