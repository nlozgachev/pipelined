---
title: Lens — nested updates
description: Focus on a required field in nested data — read, set, and modify immutably without spread chains.
---

The most direct way to update a nested field is to just assign to it:

```ts
user.address.city = "Hamburg";
```

That works. Until it doesn't.

## The problem with mutation

Objects in JavaScript are passed by reference. When you pass an object to a function, the
function receives the same object in memory — not a copy. Any mutation inside that function
affects every part of your code that holds a reference to it:

```ts
function relocate(user: User) {
	user.address.city = "Hamburg"; // silently changes the caller's object too
}

const user = { name: "Alice", address: { city: "Berlin" } };
relocate(user);
console.log(user.address.city); // "Hamburg" — the original changed
```

This is usually fine in small scripts. It becomes a source of subtle bugs as code grows:

- **UI frameworks like React** compare old and new state to decide what to re-render. If you
  mutate state in place, the reference stays the same, and React sees no change — the component
  doesn't update.
- **Multiple components or functions** holding a reference to the same object will all see the
  mutation. An unrelated part of the app can be broken by a change it never asked for.
- **Testing** becomes harder when functions silently change their inputs — you have to inspect the
  argument after the call, not just the return value.

The standard fix is to never mutate shared objects — instead, produce a new object with the
change applied. This is what the spread operator (`...`) was designed for.

## Why spread — and why it's painful

The spread pattern is the right idea: make a copy with one field changed, leave everything else
untouched, return the new object:

```ts
const updated = { ...user, name: "Bob" }; // shallow copy with name replaced
```

The problem is that spread is shallow. Changing a field one level down means copying every
intermediate object along the path:

```ts
const updated = {
	...user,
	address: {
		...user.address,
		city: "Hamburg",
	},
};
```

Two levels deep, two spreads. Three levels deep:

```ts
const updated = {
	...user,
	address: {
		...user.address,
		location: {
			...user.address.location,
			city: "Hamburg",
		},
	},
};
```

This is correct — but verbose, fragile to refactors, and has to be repeated every time you need
the same update from a different place in the code. Most teams end up writing one-off helper
functions for each update path, each one just wrapping a spread chain with a different field name
at the end.

## The Lens approach

A `Lens<S, A>` is a reusable description of a path through a structure. It knows how to read
a value at that path (`get`) and how to produce an updated copy with a new value at that path
(`set`). You define the path once; the spread chain is generated for you:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Lens } from "@nlozgachev/pipelined/core";

const cityLens = pipe(
	Lens.prop<User>()("address"),
	Lens.andThen(Lens.prop<Address>()("city")),
);

pipe(user, Lens.get(cityLens)); // "Berlin"
pipe(user, Lens.set(cityLens)("Hamburg")); // new User, city updated
pipe(user, Lens.modify(cityLens)(c => c.toUpperCase())); // "BERLIN"
```

The original `user` is never changed. `set` and `modify` return a new object with the change
applied. The path is defined once and works for reading, writing, and transforming equally.

## Defining a path

**`Lens.prop`** points at a single field of an object. Call it with the object type, then the
field name:

```ts
const addressLens = Lens.prop<User>()("address"); // Lens<User, Address>
const nameLens = Lens.prop<User>()("name"); // Lens<User, string>
```

The double-call (`<User>()("address")`) lets TypeScript know the object type upfront so it can
offer autocomplete for valid field names at the second call.

**`Lens.make`** defines a lens from an explicit getter and setter pair, for when the path isn't
a simple property lookup:

```ts
const nameLens = Lens.make(
	(user: User) => user.name,
	(name) => (user) => ({ ...user, name }),
);
```

## Reading and writing

All three operations are data-last and work directly in a `pipe`:

```ts
pipe(user, Lens.get(nameLens)); // read the value
pipe(user, Lens.set(nameLens)("Bob")); // replace with a new value
pipe(user, Lens.modify(nameLens)(n => n.toUpperCase())); // apply a function
```

`modify` is the most useful in practice: it reads the current value, applies your function, and
writes the result back — without reading the value separately first.

## Composing paths with `andThen`

Paths compose. `andThen` extends a lens one field further inward, so you build a deep path from
a sequence of single-field steps:

```ts
const userCityLens = pipe(
	Lens.prop<User>()("address"),
	Lens.andThen(Lens.prop<Address>()("city")),
);

const userZipLens = pipe(
	Lens.prop<User>()("address"),
	Lens.andThen(Lens.prop<Address>()("zip")),
);
```

Each composed lens is a plain value you can store in a variable and reuse wherever you need it.

## When the field might not be there

`Lens` only works for fields that are always present. If the next field in your path is optional
(`field?: string`) or you want to target an array element by index, you need `Optional` — the
same idea, but the path might not reach anything.

You can cross over with `Lens.andThenOptional`:

```ts
import { Optional } from "@nlozgachev/pipelined/core";

const userBioOpt = pipe(
	Lens.prop<User>()("profile"),
	Lens.andThenOptional(Optional.prop<Profile>()("bio")),
); // Optional<User, string>
```

Or convert any lens to an Optional first with `Lens.toOptional`, then continue with
`Optional.andThen`:

```ts
pipe(
	Lens.prop<User>()("address"),
	Lens.toOptional,
	Optional.andThen(Optional.prop<Address>()("landmark")),
); // Optional<User, string>
```

See the [Optional guide](/guides/optional) for the full picture.

## Compared to other approaches

### Immer

[Immer](https://immerjs.github.io/immer/) is the most popular alternative. It lets you write
code that looks like mutation but produces a new immutable object under the hood:

```ts
import produce from "immer";

const updated = produce(user, draft => {
	draft.address.city = "Hamburg";
});
```

This is a good solution and the right choice in many codebases — particularly if you're already
using Redux Toolkit, which bundles Immer. The draft syntax is familiar and requires no learning
curve beyond the `produce` wrapper.

Where Lens differs is in **reusability**. In Immer, the path to the field (`draft.address.city`)
is written inline each time. If you need the same update in five places, you write it five times,
or extract a helper function yourself. A Lens is a typed value — you define the path once, name
it, and pass it around:

```ts
// Defined once:
const userCityLens = pipe(
	Lens.prop<User>()("address"),
	Lens.andThen(Lens.prop<Address>()("city")),
);

// Used anywhere, including passed to other functions:
const setCity = Lens.set(userCityLens);
const readCity = Lens.get(userCityLens);
```

Lens paths also compose — you can build a deep path from smaller paths that already exist, which
is harder to achieve with Immer's draft approach. And because Lens has no runtime magic (Immer
uses JavaScript `Proxy` internally, which has edge cases with certain class instances and
circular references), the behaviour is always predictable.

If Immer already solves your problem and composable paths aren't something you need, stick with
Immer. If you want paths as typed, reusable, composable values that work naturally in a `pipe`
chain, Lens is worth the switch.

### structuredClone

`structuredClone(user)` creates a full deep copy, after which you can mutate freely. It works,
but it copies the entire object tree on every call regardless of how small the change is, it
fails on non-serializable values (functions, class instances, `Map`, `Set`), and the update
path is still manual — you write the drill-down every time with no reusability. It's a useful
browser built-in for specific situations, but not a scalable pattern for nested updates in
application code.

## When to use Lens

Once you commit to not mutating shared objects — whether because you're working with React, a
state management library, or just want predictable functions — you'll find yourself writing the
same spread chains repeatedly. That's the signal. Lens turns each repeated spread chain into a
named, composable path that you define once and use everywhere.
