---
title: Deferred — Infallible Async Values
description: Model asynchronous computations that are guaranteed to resolve successfully, structurally excluding rejection and chaining at the type level.
---

Standard JavaScript `Promise<A>` exposes `.catch()` and `.finally()`, implying that any asynchronous
operation might reject. For operations that are guaranteed to resolve successfully (such as timer
delays, in-memory caches, or pure computations), this creates dead error-handling paths.

`Deferred<A>` represents an awaitable asynchronous value that is structurally typed to never reject:

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

## Wrapping Promises with Deferred.from.Promise

`Deferred.from.Promise` is the gateway constructor. It wraps a standard `Promise` that you are
confident will never reject, lifting it into the infallible `Deferred` type:

```ts
import { Deferred } from "@nlozgachev/pipelined/core";

// Wrapping a guaranteed cache lookup
const themeState: Deferred<string> = Deferred.from.Promise(
  prefsCache.getOrDefault("theme", "dark"),
);
```

When you call `Deferred.from.Promise`, you are asserting to the compiler that the underlying Promise
is infallible. If the Promise does reject, that rejection behaves exactly like an unhandled Promise
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

## Interoperability: Deferred.to.Promise

If you need to pass a `Deferred` value to an external library or a third-party API that strictly
checks `instanceof Promise` rather than accepting generic thenables, you can convert it using
`Deferred.to.Promise`:

```ts
const userSession = Deferred.from.Promise(sessionStore.get("userId"));

// Convert back for library interop
const sessionPromise: Promise<string> = Deferred.to.Promise(userSession);
```

The resulting `Promise` is guaranteed to resolve, inheriting the structural infallibility of the
original `Deferred`.

---

## Problems it solves

- **Infallible return container for `Task` and `Op.run()`**: When executing a lazy `Task<A>` or
  running an `Op` invocation, the operation handles errors internally and is guaranteed never to
  reject. Returning `Promise<A>` misleadingly implies that rejection is possible, forcing callers to
  write redundant error handlers or silence linter warnings. `Deferred` provides an awaitable handle
  that communicates certainty at the type level.
- **Eliminating uncaught rejection crashes**: Standard Promises allow rejections to bubble up if
  `.catch()` is omitted, risking uncaught promise rejection crashes in Node.js processes or
  unhandled window errors in browsers. Because `Deferred` structurally excludes `.catch()` and
  rejection handlers by construction, operations returning `Deferred` cannot produce unhandled
  rejections.
- **Preventing arbitrary promise chaining and mutation**: Passing raw promises across library or
  plugin boundaries allows consumers to attach arbitrary `.then()` chains or mutate execution order.
  `Deferred` wraps async values into a nominal, read-only container that supports direct awaiting
  and structured coordination (`Deferred.all`, `Deferred.race`) without uncontrolled chaining.
- **Safe Promise bridge conversions (`from.Promise`, `to.Promise`)**: Interfacing with external
  libraries that require native Promises while ensuring error recovery and fallbacks are handled
  upfront at the conversion boundary.
