---
title: Why this exists
description: Architectural trade-offs, standard TypeScript error handling, and the design decisions behind pipelined.
---

Standard TypeScript provides two primary mechanisms for handling edge cases: `null` or `undefined`
for missing values, and `try/catch` for errors. While familiar, both mechanisms have structural
limitations in production applications:

1. **Exceptions are invisible in type signatures**: A function signature `(id: string) => User` does
   not indicate whether it throws. Callers must either inspect implementation details, read
   documentation, or add defensive `try/catch` blocks around calls.
2. **`null` and `undefined` force immediate branching**: Handling optional values typically requires
   conditional `if` checks at every step of a pipeline, breaking linear data flow.
3. **Promises reject with `unknown`**: Standard `Promise<T>` rejections bypass the return type
   channel and can throw untyped values at runtime.

`pipelined` provides data structures that represent absence, failure, and asynchronous execution
explicitly within TypeScript's type system, without introducing external dependencies or a
proprietary runtime.

---

## Control Flow as Data

Consider retrieving configuration data, extracting a connection string, and opening a database
client in standard TypeScript:

```ts
function getClient(userId: string): Client | null {
  try {
    const config = fetchConfig(userId);
    if (!config) return null;

    const connStr = config.database.connectionString;
    if (!connStr) return null;

    return connect(connStr);
  } catch {
    return null;
  }
}
```

In this implementation, data extraction and conditional branching are combined in a single block.
Each intermediate step requires manual verification before the next step can run.

Using `Maybe`, the operations are expressed as a pipeline where absent values skip subsequent
transformations automatically:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";

const getClient = (userId: string) =>
  pipe(
    userId,
    fetchConfig,
    Maybe.chain((config) => Maybe.from.nullable(config.database.connectionString)),
    Maybe.chain(connect),
  );
```

If `fetchConfig` or the connection string lookup returns `None`, execution bypasses `connect` and
returns `None` directly.

---

## Descriptive Names Over Category Theory

Many functional programming libraries use terminology derived from abstract algebra, such as
*Functor*, *Monad*, *Applicative*, or *Kleisli arrow*.

`pipelined` uses names that describe the concrete operation being performed:

- **`map`**: Transforms the value inside a container.
- **`chain`**: Transforms the value using a function that returns another container, flattening the
  result.
- **`fold`**: Collapses a container into a plain value by providing handlers for every variant.
- **`match`**: Pattern matches against named cases (`{ ok, err }` or `{ some, none }`).

This keeps the API readable for TypeScript developers without requiring background in functional
programming theory.

---

## Plain Discriminated Unions

`pipelined` structures are plain JavaScript objects with a `kind` discriminator:

```ts
type Some<A> = { readonly kind: "Some"; readonly value: A };
type None = { readonly kind: "None" };
type Maybe<A> = Some<A> | None;
```

This design choice provides several practical benefits:

- **Standard debugging**: Values inspect cleanly in `console.log` and browser devtools without
  hidden prototype wrappers.
- **Exhaustive pattern matching**: TypeScript's standard `switch (val.kind)` and
  `if (val.kind === "Ok")` narrow types natively.
- **Zero classes**: No `new` keyword, no prototype methods, and no `instanceof` checks that can fail
  across package boundaries or worker threads.

---

## Trade-Offs and Architectural Context

Choosing a tool requires balancing safety against operational complexity:

### Standard TypeScript

- **Pros**: Zero dependencies, familiar syntax, direct execution with no function-call overhead.
- **Cons**: Errors are untyped, missing values require repetitive branching, and async rejections
  can crash processes if unhandled.
- **When to use**: Simple CRUD scripts, small internal tools, or performance-critical micro-loops
  where function allocations must be strictly avoided.

### Frameworks like Effect

- **Pros**: Comprehensive ecosystem with built-in fibers, distributed tracing, structured
  concurrency, and dependency injection.
- **Cons**: Large runtime footprint, steep learning curve, and pervasive architectural lock-in
  requiring the entire application to run inside an effect runtime.
- **When to use**: Large-scale distributed applications requiring structured concurrency and runtime
  telemetry across all layers.

### Pipelined

- **Pros**: Lightweight (<11 KB core), zero dependencies, tree-shakeable, plain discriminated
  unions, and works with standard Node and browser runtimes.
- **Cons**: Curried pipelines introduce closure allocations; requires wrapping and unwrapping data
  containers at system boundaries.
- **When to use**: Application business logic, form validation, parsing pipelines, and async
  workflows where typed errors and linear composition improve maintainability without adding a
  runtime framework.
