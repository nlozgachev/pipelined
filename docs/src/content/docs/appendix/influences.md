---
title: Design and influences
description: Where the ideas in pipelined come from, how the internals are structured, and why things are the way they are.
---

This page covers where the ideas in `pipelined` came from, the patterns every module follows, and
what was left out on purpose.

## Where the ideas come from

### Haskell

Most core types in this library come from Haskell. `Result` is based on `Either`, and `Task` on
`IO`, Haskell's lazy and composable way of describing side effects. `map` and `chain` are Haskell's
`fmap` and `>>=` under names that say what they do. `match` handles every case by name, the way
Haskell's `maybe` and `either` functions do.

`These` comes from the Haskell library of the same name. It holds a first value, a second value, or
both at once.

### Elm

Elm showed that `Maybe` and `Result` can be taught with plain, consistent names and no algebra.

The `RemoteData` pattern also started in Elm, in a package by Kris Jenkins. A data fetch is in
exactly one of four states, and modelling it that way removes the loading and error flags that can
disagree with each other.

### Rust

Rust put `Option<T>` and `Result<T, E>` in a mainstream standard library, and plenty of
performance-sensitive code uses them every day. That settled the question of whether explicit
absence and typed failure are practical outside academic languages.

### fp-ts

The direct TypeScript predecessor is fp-ts by Giulio Canti. It introduced the `pipe` composition
model, data-last currying, and the pattern of pairing a type with a module of the same name.

### Optics

`Lens` and `Optional` come from a functional programming tradition that treats a path through data
as a value. You define the path once, give it a name, pass it around, and combine it with other
paths to reach deeper. Most of that tradition comes from Haskell, and Edward Kmett's `lens` package
is the best-known implementation.

The `lens` package defines a whole family of optics (`Iso`, `Prism`, `Lens`, `Traversal`, `Fold`,
`Getter`, `Setter`) and unifies them with the van Laarhoven encoding. In that encoding, an optic is
a polymorphic higher-order function over `Functor`, `Applicative` and similar abstractions, and
optics compose with ordinary function composition. It is elegant, but it depends on higher-kinded
types. TypeScript can approximate those with encoding tricks, as fp-ts does, and this library avoids
that for the reasons given in the typeclass section below.

This library uses a simpler, concrete representation instead. Each optic is a plain record with
`get` and `set` fields:

```ts
type Lens<S, A> = {
  get: (s: S) => A;
  set: (a: A) => (s: S) => S;
};

type Optional<S, A> = {
  get: (s: S) => Maybe<A>;
  set: (a: A) => (s: S) => S;
};
```

The concrete form can't compose uniformly across the whole family, but you can read the type and see
exactly what it does, and there is no encoding to pay for.

## Structural principles

### Tagged unions

Every core type in this library is a discriminated union: a union of object types that each carry a
literal `kind` field.

```ts
type Maybe<A> = { kind: "Some"; value: A } | { kind: "None" };

type Result<E, A> = { kind: "Ok"; value: A } | { kind: "Err"; error: E };

type RemoteData<E, A> =
  | { kind: "NotAsked" }
  | { kind: "Loading" }
  | { kind: "Failure"; error: E }
  | { kind: "Success"; value: A };
```

The main reason is exhaustiveness checking. A `switch` or `match` over `kind` that covers every
variant satisfies the compiler, and if a variant is added later, every existing `match` becomes a
compile error until the new case is handled.

The values are also just data. They show up readably in `console.log`, serialize with
`JSON.stringify`, and can be matched without any class in scope. There is nothing to inherit or
override, and the operations live in separate module objects instead of on the values.

A class-based encoding would dispatch with `instanceof` and put operations in methods. That ties
operations to types, so adding one means editing the class. It also means you can't pattern-match on
a value unless the class is in scope.

### InternalTypes

The four types in `InternalTypes.ts` are the structural vocabulary of the entire library:

```ts
type WithKind<K extends string> = { readonly kind: K };
type WithValue<T> = { readonly value: T };
type WithError<T> = { readonly error: T };
type WithErrors<T> = { readonly errors: NonEmptyArr<T> };
```

These keep field names the same across every type in the library. The success payload is always
`value`, a single failure is always `error`, and accumulated failures are always `errors`. The type
of `errors` is always `NonEmptyArr`, so a failed value has at least one error.

The shared names matter at runtime too. `Maybe.map`, `Result.map` and `RemoteData.map` all read the
success payload from `.value`, which keeps them uniform without duplicated code.

`These` is the one exception. Its variants (`TheseFirst`, `TheseSecond`, `TheseBoth`) use `first`
and `second` as field names, because `These<A, B>` holds two arbitrary types and neither of them
means success or failure.

### The type and static object pattern

Each module is defined as a co-located pair sharing the same name: a TypeScript type alias and a
static `const` object literal:

```ts
export type Maybe<A> = Some<A> | None;

export const Maybe = {
  make: {
    some: <A>(value: A): Some<A> => ({ kind: "Some", value }),
    none: <A = never>(): None => ({ kind: "None" }),
  },
  map: <A, B>(transform: (value: A) => B) => (maybe: Maybe<A>): Maybe<B> => ...,
  match: ...,
};
```

A single import gives you both:

```ts
import { Maybe } from "@nlozgachev/pipelined/core";

const x: Maybe<number> = Maybe.make.some(42); // type and constructor from the same import
```

The object literal works like a module: a flat collection of pure, data-last functions with no
class, no prototype, and no `this`. TypeScript's runtime namespaces compile to an IIFE
(`(function(Maybe) { ... })(Maybe || (Maybe = {}))`) that bundlers can't split, while an object
literal can be tree-shaken within a subpath. If your application only imports `Maybe.map`, the
unused combinators are left out of your production bundle.

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
  Maybe.make.some(5),
  Maybe.map((n) => n * 2), // map(n => n * 2) is already a function Maybe<number> → Maybe<number>
  Maybe.getOrElse(() => 0),
);
```

Without data-last, each `pipe` step would need to be wrapped in an arrow function:

```ts
pipe(
  Maybe.make.some(5),
  (opt) => Maybe.map(opt, (n) => n * 2), // awkward — two arguments, data first
  (opt) => Maybe.getOrElse(opt, () => 0),
);
```

The convention is a direct import from fp-ts, which in turn took it from Haskell and OCaml.

### Error type as the first type parameter

`Result<E, A>` puts the error type before the value type, and so do `Validation<E, A>` and
`RemoteData<E, A>`. Many TypeScript APIs do the opposite, so it can look backwards at first.

It comes down to which type parameter `map` transforms. `map` changes the success value, `A`, and
leaves `E` alone. Putting the parameter that changes last and the one that stays fixed first is the
same convention Haskell uses for `Either e a`.

Once you've seen `Result<string, User>` a few times, you read it as "can fail with a string,
succeeds with a User" without thinking about the order.

### NonEmptyArr as a structural guarantee

`Validation` types its errors field as `NonEmptyArr<E>` (defined as `readonly [E, ...E[]]`) instead
of `E[]`. A `Failed` value always has at least one error, and a `Failed` with zero errors can't be
constructed.

This helps whoever handles the `failed` branch. If `errors` were `E[]`, every handler would need to
guard against an empty list that can never actually happen. With `NonEmptyArr`, you can call
`errors[0]` or `errors.join(", ")` without a check.

## What was deliberately left out

### Typeclass names

The library implements the usual functional structures (`Functor`, `Monad`, `Applicative`) but
exposes them only through operation names like `map`, `chain` and `apply`.
[Why this exists](/appendix/motivation#something-understandable) explains the reasoning.

### A typeclass system

fp-ts simulates higher-kinded types in TypeScript with an `HKT` encoding, which lets you write
generic code over any type that implements a given typeclass. This library doesn't try. The `map` on
`Maybe` and the `map` on `Result` share a name, not an interface, so you can't write one function
that works over "any type with a `map`". That is a real limitation. In exchange, the types stay
simple and there is no encoding layer to learn.

### Classes and inheritance

Every type is plain data. There's no inheritance hierarchy and no `instanceof` checks in user-facing
code.

### Runtime brand overhead

`Brand<K, T>` exists only at compile time. At runtime, a branded value is exactly the underlying
value, with no wrapper object, tag field, or extra allocation. `Brand.wrap` and `Brand.unwrap` are
identity functions whose only job is to satisfy the type checker.

### The full optics hierarchy

`Lens` and `Optional` are two members of a much larger family. The two most useful ones left out are
`Prism`, which focuses on one variant of a union (such as the value inside `Some`, or the `Ok` case
of a `Result`), and `Traversal`, which focuses on several values at once, for example every element
of a nested array. With the concrete `{ get, set }` encoding, each new optic type needs its own
composition function for every other type, so the API grows with the square of the number of optic
types. `Lens` and `Optional` cover the cases that come up most in everyday TypeScript, so the rest
stayed out.

## Acknowledgements

The ideas behind this library come from years of reading code by people who thought hard about these
problems: the Haskell community, the Elm community and its insistence that good ideas should be
approachable, and the fp-ts contributors who did the work of encoding those ideas in TypeScript.

Particular thanks to Giulio Canti, whose fp-ts showed that typed functional programming is practical
in TypeScript, and whose source code taught me more about the language than any tutorial. To Kris
Jenkins, for naming `RemoteData` and making the case for it so clearly that the pattern spread
beyond Elm. To Edward Kmett, for the `lens` library and the optics tradition that `Lens` and
`Optional` come from. To the Haskell community more broadly, for `These` and for a huge body of work
that keeps the ecosystem moving. And to the TypeScript team, for a type system expressive enough to
encode most of these ideas at all.

If you've read this far, thank you. Whether you found the library useful, built something with it,
spotted something wrong, or just wanted to see how the pieces fit together, I'm glad you did.

Write good code. Make the impossible states unrepresentable.
