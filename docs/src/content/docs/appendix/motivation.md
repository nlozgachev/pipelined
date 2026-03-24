---
title: Why this exists
description: The reasoning behind pipelined — why it exists alongside other libraries, and what it is trying to be.
---

There are already many functional programming libraries for TypeScript. Effect is powerful and
comprehensive. neverthrow is focused. fp-ts, which pioneered typed functional programming in
TypeScript, is no longer actively developed — its author joined the Effect organisation, and that's
now where new development happens. So why another one?

The short answer is that nothing clicked. After time spent with each of them — reading the docs,
trying the APIs, writing real code — none of them felt quite right. So this library started as a
personal project: a set of types and utilities built around rules I find useful, organised in a way
that makes sense to me. If it's useful to others, that's a welcome bonus.

The longer answer is about why they didn't click. Most existing libraries were built for people who
already know functional programming. fp-ts was explicit about this — it used typeclass names
(`Functor`, `Monad`, `Traversable`) and assumed familiarity with the tradition they come from. That
was appropriate for what it was. But it means the entry cost is high for developers who know
TypeScript well but haven't been through Haskell or category theory.

This library is for that second group — which, when I started, included me.

## The vocabulary problem

Functional programming has a naming problem. The concepts are genuinely useful — arguably among the
most useful ever developed for structuring programs. But many of them carry names that describe
mathematical structure rather than behaviour.

`Functor` is a type that implements `map`. `Monad` is a type that implements `chain` (also written
`flatMap` or `bind`, depending on the tradition). `Applicative` is a type with `ap`. These names are
precise within their lineage. Outside it, they're meaningless.

The result is a wall. You encounter a library, see `Functor` in the docs, and either stop — because
the term is unfamiliar — or detour into learning what it means, which takes you away from the actual
problem you were trying to solve. Either way, the concept that would have helped you — that you can
transform a value inside a container without unwrapping it — gets obscured by the vocabulary needed
to name it.

This library uses names that describe what operations do. `map` transforms a value inside a
container. `chain` transforms a value inside a container and flattens one layer. `fold` collapses a
type into a single value by providing a handler for each case. If you can read the name and
understand the operation, the name is doing its job.

The goal isn't to avoid the vocabulary — the appendix connects the library's names to the tradition
they came from. The goal is to ensure you don't need that vocabulary to start using, and benefiting
from, the patterns.

## Why the guides exist

The guides are not API documentation. For that, there's the API reference.

The guides are about understanding why each type exists — what problem it solves, what it replaces,
and why that replacement is better than the alternative. Each one starts with the status quo: how
people typically handle absent values, failures, async operations, or loading states. Then it shows
what breaks. Then it introduces a type that encodes the problem more honestly, and walks through what
you can do with it.

The intent is that after reading a guide, you understand the concept — not just the API. And
understanding the concept means you'll recognise it in code that doesn't use this library. You'll
see `Maybe<T>` in fp-ts, or `Maybe T` in Elm, and know immediately what you're looking at. You'll
understand why Rust's standard library has `Maybe<T>` and `Result<T, E>` at its core. You'll read
Haskell's `Maybe` without needing a translation.

Learning the pattern once — without jargon in the way — is worth more than learning any specific
library's API.

## Why not Effect

Effect is the right choice if you need a full effect system — typed errors with dependency
injection, fibers, structured concurrency, and the complete typeclass hierarchy that fp-ts
pioneered. It's powerful, actively developed, and used in production at scale. If you need what it
provides, use it.

This library is the right choice if you want to make absent values, failures, and async more
explicit without adopting a full framework. The surface area is smaller, the types are plain data,
and the vocabulary is minimal. You can use it alongside other libraries, adopt just the types you
need, and stop there.

The goal is not to replace fp-ts or Effect. It's to be useful at a smaller scope — and honest about
what that scope is.
