---
title: Deferred — Infallible Async Values
description: Model asynchronous computations that are guaranteed to resolve successfully, structurally excluding rejection and chaining at the type level.
---

In JavaScript, `Promise<A>` is the universal container for any asynchronous value. While highly
convenient, a Promise is structurally over-specified for operations that are **infallible** —
computations that are guaranteed to resolve successfully, such as reading an in-memory cache,
applying a pure transformation, or looking up config defaults.

By exposing `.catch()` and `.finally()`, a `Promise` always implies that rejection is a possibility.
For infallible computations, this is a design mismatch. It forces callers to either ignore the
theoretical possibility of failure or write unnecessary, dead error-handling code that will never be
executed.

`Deferred<A>` solves this mismatch. It represents an asynchronous value that will eventually resolve
to an `A`, but it is structurally incapable of rejecting:

```ts
type Deferred<A> = {
  readonly [_deferred]: A;
  readonly then: (onfulfilled: (value: A) => void) => void;
};
```

Two deliberate design choices make `Deferred` work:

1. **Nominal Safety**: The `[_deferred]` property is a phantom unique symbol. It carries the type
   parameter `A` nominally, ensuring that only genuine values produced by `Deferred` satisfy the
   type. A plain, raw `{ then: ... }` object cannot bypass the type check.
2. **No Chaining or Rejection**: The `.then()` method accepts only a single fulfillment callback. It
   returns `void` rather than a new thenable. There is no second parameter to pass a rejection
   handler, and no chainable return value. Rejection and chaining are excluded by construction.

---

## Wrapping Promises with fromPromise

`Deferred.fromPromise` is the gateway constructor. It wraps a standard `Promise` that you are
confident will never reject, lifting it into the infallible `Deferred` type:

```ts
import { Deferred } from "@nlozgachev/pipelined/core";

// Wrapping a guaranteed cache lookup
const themeState: Deferred<string> = Deferred.fromPromise(
  prefsCache.getOrDefault("theme", "dark"),
);
```

When you call `fromPromise`, you are asserting to the compiler that the underlying Promise is
infallible. If the Promise does reject, that rejection behaves exactly like an unhandled Promise
rejection at runtime. Only wrap Promises that are guaranteed to succeed, such as those that have
already resolved their errors using defaults or fallback strategies.

---

## Awaiting a Deferred

Because the JavaScript runtime evaluates `await` by looking for any object with a compatible
`.then()` method, `Deferred` qualifies as a standard thenable. The runtime calls `.then(resolve)` on
it internally, making `await` behave identically to awaiting a standard Promise:

```ts
const theme: string = await themeState; // Resolves to string safely
```

TypeScript understands this protocol and infers the correct type `A` from any `Deferred<A>`
automatically.

---

## Interoperability: toPromise

If you need to pass a `Deferred` value to an external library or a third-party API that strictly
checks `instanceof Promise` rather than accepting generic thenables, you can convert it using
`toPromise`:

```ts
const userSession = Deferred.fromPromise(sessionStore.get("userId"));

// Convert back for library interop
const sessionPromise: Promise<string> = Deferred.toPromise(userSession);
```

The resulting `Promise` is guaranteed to resolve, inheriting the structural infallibility of the
original `Deferred`.

---

## When to use Deferred

### Use Deferred when:

- **The async work cannot fail**: You want the function signature to explicitly document that a task
  is infallible, preventing callers from writing dead error-handling branches.
- **You want to restrict chaining**: You want to pass an async value to a consumer and structurally
  prevent them from attaching `.catch()` or `.then()` chains.

### Keep using standard Promises when:

- **The task can genuinely fail**: The operation could time out or lose connection, and you want to
  let the Promise reject or model it using a `Result` type.
- **You require chaining**: You need to chain multiple `.then()` or `.finally()` blocks directly on
  the async handle.
