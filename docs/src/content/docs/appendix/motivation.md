---
title: Why this exists
description: The philosophy behind pipelined — how it balances safety, simplicity, and pragmatism in a landscape of complex alternatives.
---

In mainstream TypeScript development, developers routinely accept a certain amount of friction as
the natural cost of doing business. Code throws exceptions, functions pass around `null` and
`undefined`, and systems rely on deeply nested `try/catch` blocks to manage asynchronous operations.
Over time, developers build a high tolerance for the mental overhead required to keep track of what
might fail, what might be missing, and what order operations must execute in.

When looking to solve these issues, the ecosystem presents a stark choice. On one side are the
familiar, ad-hoc techniques of standard JavaScript: optional chaining, defensive `if` checks, and
manual error propagation. On the other side are comprehensive, mathematically rigorous functional
programming libraries like `fp-ts` or `Effect`.

`pipelined` is an exploration of a third path. It is built for developers who recognize the
structural flaws of mainstream error-handling and null-checking, but who want to solve these
problems without adopting a massive architectural framework or learning category theory.

## The entanglement of control flow

To understand why a different approach is necessary, it is helpful to look at how standard
TypeScript forces the mixing of business logic with control flow.

Consider a typical task: retrieving a user configuration, extracting a nested database connection
string, and establishing a client. At each step, things can go wrong. The configuration might be
missing; the connection string might be empty; the connection attempt might fail.

In standard TypeScript, this often looks like:

```ts
function getClient(userId: string): Client | null {
  try {
    const config = fetchConfig(userId);
    if (!config) return null;

    const connStr = config.database.connectionString;
    if (!connStr) return null;

    return connect(connStr);
  } catch (error) {
    return null;
  }
}
```

Notice what has happened to this code. The actual work to perform — getting a config, reading a
string, and connecting — is deeply entangled with the mechanics of checking for absence and catching
errors. The control structures (`if` statements and `try/catch` blocks) dominate the visual layout.

This is what Rich Hickey describes as *complexity*: the braiding together of unrelated concerns. The
business logic (the "what") and the error handling (the "how") are physically bound together in a
single block of instructions. It is difficult to test, reuse, or reason about one without the other.

Functional programming offers a way to disentangle them. By representing absence as a `Maybe` and
failure as a `Result`, control flow becomes data. The steps of a program can be described as a pure,
sequential pipeline, leaving the containment of errors and missing values to the types themselves:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";

const getClient = (userId: string) =>
  pipe(
    userId,
    fetchConfig,
    Maybe.chain(config => Maybe.fromNullable(config.database.connectionString)),
    Maybe.chain(connect)
  );
```

In this pipeline, the code is simple. The operations are expressed in a straight line, and the
presence or absence of the value is handled implicitly by the `Maybe` context.

## The vocabulary barrier

If these patterns are so powerful, why aren't they more widely used in the TypeScript community?

The barrier is rarely the utility of the patterns themselves; it is the vocabulary used to describe
them. Many functional libraries are designed by and for people who already think in terms of
algebraic structures. They expect the developer to understand terms like `Functor`, `Monad`,
`Applicative`, `Morphism`, or `Kleisli arrow`.

For a developer who has spent years building reliable applications in TypeScript but has never
touched Haskell or Elm, these terms do not illuminate; they obscure. They suggest that to solve a
simple problem — like safely parsing an API response without throwing an error — one must first
master a branch of abstract mathematics.

This library takes a different approach. Functional programming patterns are too useful to be locked
behind academic gatekeeping.

`pipelined` does not use algebraic jargon in its public guides or API signatures, and interfaces are
not named after typeclasses. Instead, the library uses names that describe what the operations
actually *do*. It uses `map` to transform a value inside a container while leaving the container
intact. It uses `chain` to transform a value inside a container when the transformation itself
returns a new container, flattening the resulting layers. And it uses `fold` to collapse a container
down to a raw value by requiring a handler for every possible state.

By focusing on behavior rather than mathematical classification, the patterns become approachable. A
developer does not need to understand what a Monad is to understand that `chain` allows the
sequencing of operations that might return nothing.

## Simplicity over familiarity

It is helpful to distinguish between what is *easy* and what is *simple*.

Mainstream language features like `throw` and `null` are *easy*. They are near-to-hand, familiar,
and supported by the syntax of the language. But they are not *simple*. They are structurally
complex because they create invisible exit points, break referential transparency, and require the
programmer to maintain a complex mental model of runtime behavior.

Conversely, a type like `Result` or `Maybe` might initially feel unfamiliar to developers raised on
object-oriented patterns. But structurally, it is exceptionally *simple*. It is a plain, immutable
data structure. It has no hidden side-effects, no implicit control flow, and no magic. It is a value
that can be passed around, inspected, and tested like any other.

`pipelined` is designed to favor simplicity. It does not introduce a complex runtime, a system of
fibers, or custom execution context queues. It provides lightweight, transparent TypeScript
structures that honor the type system and get out of the way.

## Why the guides exist

The guides in this documentation are not mere listings of function signatures. Their purpose is to
teach a way of thinking about software.

Every guide begins with a friction point developers have all encountered: a silent failure, an
unchecked null pointer, or an unhandled rejection. That friction is traced back to standard language
primitives, and then a functional data structure is introduced to cleanly resolve the issue.

The goal is to help developers build a deep, conceptual model of these patterns. Once the structural
advantages of a `Result` over an exception are understood, that pattern becomes visible everywhere —
whether writing Rust, Elm, Swift, or standard TypeScript. The syntax changes, but the fundamental
insights into simplicity and data composition remain the same.

## When to use pipelined

Choosing a library is not an exercise in purity; it is a pragmatic assessment of context, team
dynamics, and system requirements.

If the primary goal is to bring robust static safety, typed error handling, and explicit optionality
to an existing codebase without forcing a team to master a new mathematical vocabulary, `pipelined`
is a natural fit. It allows for progressive adoption — a developer can introduce `Maybe` to clean up
a single complex parser, and leave the rest of the system untouched. Because the library is composed
of lightweight, plain data structures, it integrates seamlessly with standard TypeScript patterns
and imposes no runtime architecture.

Conversely, standard TypeScript may remain the correct choice for simple, CRUD-driven applications
where the overhead of learning currying, pipelines, and functional container types exceeds the
benefits of formal safety. In such environments, standard defensive programming and conventional
try-catch blocks, despite their structural flaws, are familiar enough to be productive.

If an application demands structured concurrency, built-in dependency injection, and fiber-based
execution, a comprehensive framework like `Effect` provides an exceptionally powerful runtime.
However, that power comes with significant architectural weight. `Effect` is a complete ecosystem
that takes over the execution flow of the application, introducing a steep learning curve and a
proprietary runtime.

For the vast majority of applications, this level of complexity is not only unnecessary but can
actively hinder development and debugging. `pipelined` offers a different design philosophy. It is
not a framework that demands architectural submission. Instead, it provides a set of highly focused,
zero-dependency, compile-time tools that integrate seamlessly with standard TypeScript runtimes and
architectures. It allows the expression of complex asynchronous logic, optionality, and error
handling through simple, transparent data structures that preserve standard debugging workflows,
compile away cleanly, and place no tax on runtime performance.
