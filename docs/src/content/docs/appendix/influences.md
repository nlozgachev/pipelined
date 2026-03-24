---
title: Design & influences
description: Where the ideas in pipelined come from, how the internals are structured, and why things are the way they are.
---

This page is for readers who want to understand the library at a deeper level — the decisions behind
the API, the structural patterns used throughout, and the prior work that shaped them. None of this
is required to use the library effectively. Think of it as the author's notes at the back of the
book.

## Where the ideas come from

### Haskell

Most of the core types in this library descend, in some form, from Haskell.
`Either` became `Result`, and the `IO` type — a lazy, composable wrapper around side effects —
inspired `Task`. The naming convention of `map` and `chain` follows Haskell's vocabulary (translated
from `fmap` and `>>=` into names that describe what they do rather than where they come from).
`fold` is an eliminator — it collapses a type by providing a handler for each case — corresponding
to Haskell's `maybe :: b -> (a -> b) -> Maybe a -> b` and `either :: (a -> c) -> (b -> c) -> Either a b -> c`.

`These` comes from a Haskell library of the same name. It represents the
inclusive-OR case: a value that can carry an error, a result, or both simultaneously — which neither
`Either` nor a tuple cleanly expresses.

### Elm

Elm deserves particular credit for two things. First, it took the `Maybe` and `Result` types from
Haskell and gave them an API that felt natural to people without a Haskell background — friendly,
named, and consistent.

Second, Elm is where `RemoteData` as a named pattern originated, in a package by Kris Jenkins. The
insight — that a data fetch has exactly four states, that those states are mutually exclusive, and
that encoding them as a union type eliminates a whole class of bugs — predates this library by
several years. The name, the four variants, and the motivation in the guide are all drawn from that
original work.

### Rust

Rust brought `Option<T>` and `Result<T, E>` into the standard library of a mainstream systems
language and proved that these types work outside academia. Seeing them become idiomatic in a
performance-critical, widely-used language validated the premise that explicit absence and explicit
failure are practical, not academic.

### fp-ts

The most direct TypeScript ancestor is fp-ts by Giulio Canti — a comprehensive, rigorous encoding
of functional programming in TypeScript that covered every major typeclass, used `pipe` as its
composition primitive, and followed the data-last convention throughout. fp-ts is no longer under active feature development — its author joined the [Effect](https://effect.website/)
organisation, and Effect-TS is positioned as the successor to fp-ts; that's now where new
development in this space happens.

This library borrows several things from fp-ts directly: the `pipe` and `flow` functions, the
data-last convention, and the pattern of defining each type as a TypeScript type alias alongside a
namespace of functions with the same name.

### Optics

`Lens` and `Optional` belong to a tradition in functional programming of treating "a path through
data" as a composable first-class value — a path you define once, name, pass around, and compose
into deeper paths. The tradition originates primarily in Haskell, where Edward Kmett's `lens`
package is the canonical implementation.

The `lens` package defines a full optics hierarchy — `Iso`, `Prism`, `Lens`, `Traversal`, `Fold`,
`Getter`, `Setter` — and unifies them using the van Laarhoven encoding: an optic is a polymorphic
higher-order function over `Functor`/`Applicative`/etc., and composition is ordinary function
composition. This encoding is elegant, but it relies
on higher-kinded types — and while TypeScript can approximate those through HKT encoding tricks
(as fp-ts demonstrates), this library deliberately avoids that approach for the same reasons
described in the typeclass section below.

This library uses a simpler "concrete" representation instead. Each optic is a plain record with
`get` and `set` fields:

```ts
type Lens<S, A> = { get: (s: S) => A; set: (a: A) => (s: S) => S; };
type Optional<S, A> = { get: (s: S) => Maybe<A>; set: (a: A) => (s: S) => S; };
```

The concrete form gives up uniform composition across the full hierarchy but gains implementation
transparency — you can read the type and see exactly what it does — and introduces no encoding
overhead whatsoever.

## Structural principles

### Tagged unions

Every core type in this library is a discriminated union — a union of object types, each
distinguished by a literal `kind` field:

```ts
type Maybe<A> = { kind: "Some"; value: A; } | { kind: "None"; };

type Result<E, A> = { kind: "Ok"; value: A; } | { kind: "Error"; error: E; };

type RemoteData<E, A> =
	| { kind: "NotAsked"; }
	| { kind: "Loading"; }
	| { kind: "Failure"; error: E; }
	| { kind: "Success"; value: A; };
```

This representation has several properties that make it well-suited for TypeScript:

- **Exhaustiveness checking**: A `switch` or `match` over `kind` that handles every variant
  satisfies the compiler. If a new variant is added to the type, every existing `match` becomes a
  type error until the new case is handled.
- **Transparency**: The structure is plain data. You can inspect it with `console.log`, serialize it
  with `JSON.stringify`, and pattern-match it without any class machinery.
- **No prototype chain**: There's nothing to inherit, override, or accidentally mutate. The
  operations live in separate namespace modules, not on the objects themselves.

The alternative — class-based encoding — would use `instanceof` for dispatch and method definitions
for operations. This has appeal, but it couples operations to types (adding a method means touching
the class), makes the types opaque (you can't pattern-match without the class being in scope), and
ties the library to a specific instantiation model.

### InternalTypes

The four types in `InternalTypes.ts` are the structural vocabulary of the entire library:

```ts
type WithKind<K extends string> = { readonly kind: K; };
type WithValue<T> = { readonly value: T; };
type WithError<T> = { readonly error: T; };
type WithErrors<T> = { readonly errors: NonEmptyList<T>; };
```

These ensure that field names are consistent across every type in the library. The success payload
is always named `value`. A single failure is always named `error`. Multiple accumulated failures are
always named `errors`, and the type of `errors` is always `NonEmptyList` — guaranteeing at least one
error exists when a type is in an invalid state.

This consistency matters at runtime too: `Maybe.map` and `Result.map` and `RemoteData.map` all look
for `.value` to find the success payload. Sharing the field name is what makes this uniform without
code duplication.

`These` is the deliberate exception. Its two payloads — `TheseFirst`, `TheseSecond`, and
`TheseBoth` — use `first` and `second` as field names rather than `value` and `error`. `These<A,
B>` makes no claim about which side is "good" and which is "bad": it is a symmetric inclusive-OR,
not a biased success/failure container. Importing the `value`/`error` convention would give it a
directionality it doesn't have.

### The namespace pattern

Each type is defined as a pair: a TypeScript type alias and a namespace with the same name:

```ts
export type Maybe<A> = Some<A> | None;

export namespace Maybe {
  export const some = <A>(value: A): Some<A> => ({ kind: "Some", value });
  export const map  = <A, B>(f: (a: A) => B) => (data: Maybe<A>): Maybe<B> => ...
  export const fold = ...
}
```

A single import gives you both:

```ts
import { <Maybe> } from "@nlozgachev/pipelined/core";

const x: <Maybe><number> = Maybe.some(42); // type and constructor from the same import
```

The namespace acts like a module — a flat collection of named functions. There's no class, no
prototype, no `this`. The functions are just functions; they happen to share a namespace prefix that
signals they operate on the same type.

This pattern also means the operations are tree-shakeable. If your bundler can tell that
`Maybe.filter` is never called, it can exclude it from the bundle. Method-on-class approaches don't
give bundlers the same opportunity because the method is attached to the prototype at definition
time.

### Data-last convention

Every operation in the library takes the data it operates on as the **last** argument. Comparing
signatures:

```ts
// data-first (not used here)
map(option, f);

// data-last (used throughout)
map(f)(option);
```

With data-last, the function is curried: calling `map(f)` without the data returns a new function
that accepts the data. This is what makes `pipe` and `flow` compose cleanly:

```ts
pipe(
	Maybe.some(5),
	Maybe.map((n) => n * 2), // map(n => n * 2) is already a function Maybe<number> → Maybe<number>
	Maybe.getOrElse(0),
);
```

Without data-last, each `pipe` step would need to be wrapped in an arrow function:

```ts
pipe(
	Maybe.some(5),
	(opt) => Maybe.map(opt, (n) => n * 2), // awkward — two arguments, data first
	(opt) => Maybe.getOrElse(opt, 0),
);
```

The convention is a direct import from fp-ts, which in turn took it from Haskell and OCaml.

### Error type as the first type parameter

`Result<E, A>` puts the error type before the value type. Same for `Validation<E, A>` and
`RemoteData<E, A>`. This is the opposite of many TypeScript APIs and feels counterintuitive at first
glance.

The reason is about which type parameter `map` should transform. `map` transforms the success value
— the `A`. For TypeScript to infer this correctly when you write `Result.map(f)`, `A` needs to be
the "last" type parameter in the sense that it's the one that varies across a `map` operation.
Putting `E` first keeps it stable while `A` changes — the same reason Haskell's `Either` is
`Either e a` with `e` first and `a` last.

In practice this rarely matters for reading type signatures: once you've seen `Result<string, User>`
a few times, you read it as "can fail with string, succeeds with User" and the ordering is
automatic.

### NonEmptyList as a structural guarantee

`Validation` uses `NonEmptyList<E>` (defined as `readonly [E, ...E[]]`) for the errors field instead
of `E[]`. This is a structural guarantee: when a value is `Invalid`, it always has at least one
error. An `Invalid` with zero errors is a contradiction — it can't be represented.

This matters for consumers of the `invalid` branch. If `errors` were `E[]`, every handler would need
to guard against the empty case even though it's semantically impossible. With `NonEmptyList`, you
can call `errors[0]` or `errors.join(", ")` without defensive checks.

## What was deliberately left out

**Typeclass names.** The library contains implementations of what Haskell calls `Functor` (`map`),
`Monad` (`chain`), and `Applicative` (`ap`). These names don't appear in the API — the operations
use names that describe what they do rather than the algebraic structure they belong to. The
reasoning behind this is in [Why this exists](/motivation).

**A typeclass system.** fp-ts uses a `HKT` encoding to simulate higher-kinded types in TypeScript,
which allows generic code over any type that implements a given typeclass. This library makes no
attempt at that. The `map` on `Maybe` and the `map` on `Result` share a naming convention, not a
shared interface. This is a real limitation — you can't write a function that works generically over
"any type with a `map`" — but the tradeoff is a much simpler type system with no encoding overhead.

**Classes and `extends`.** Every type is plain data. There's no inheritance hierarchy and no
`instanceof` checks in user-facing code.

**Runtime overhead for brands.** `Brand<K, T>` exists only as a compile-time phantom. At runtime, a
branded value is exactly the underlying value — no wrapper object, no tag field, no extra
allocation. The brand is erased entirely by the TypeScript compiler. `Brand.wrap` and `Brand.unwrap`
are identity functions at runtime; their only job is to satisfy the type checker.

**The full optics hierarchy.** `Lens` and `Optional` cover two points in a much larger optics
space. The most practically useful omissions are `Prism` — which focuses into one variant of a
union type (e.g. the inner value of `Some`, or the `Ok` case of a `Result`) — and `Traversal` —
which focuses on multiple values simultaneously, useful for updating all elements of a nested array
in one composed path. Both were left out because the concrete `{ get, set }` encoding doesn't
compose them uniformly with `Lens` and `Optional` without additional per-combination composition
functions, adding complexity proportional to the square of the number of optic types. In practice,
`Lens` and `Optional` cover the cases that arise most often in everyday TypeScript code.

## Acknowledgements

The ideas behind this library were worked out over years of reading code written by people who
thought carefully about these problems — the Haskell community's decades of refining abstractions
down to their most composable form; the Elm community's insistence that good ideas should be
approachable; the fp-ts contributors who did the genuinely hard work of encoding those ideas
faithfully in TypeScript.

Particular thanks to Giulio Canti, whose fp-ts library is the clearest demonstration that typed
functional programming is practical in TypeScript — and whose source code taught me more about the
language than any tutorial. To Kris Jenkins, for naming `RemoteData` and making the case so clearly
that the pattern spread beyond Elm. To Edward Kmett for the `lens` library and the optics tradition that `Lens` and `Optional` descend
from. To the Haskell community more broadly — for `These` and for an enormous body
of work that keeps the ecosystem moving forward. And to the TypeScript team, for building a type
system expressive enough that most of these ideas can be encoded at all.

If you've read this far, thank you for your curiosity. Whether you found the library useful, built
something interesting with it, spotted something wrong, or just wanted to understand how the pieces
fit together — that kind of engagement is what makes writing software for others worthwhile.

Write good code. Make the impossible states unrepresentable.
