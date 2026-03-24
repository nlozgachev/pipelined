---
title: Deferred — infallible async values
description: Model infallible async values that support await but structurally exclude rejection and chaining.
---

`Deferred<A>` is a minimal async value. Like a Promise, it represents a computation that will
eventually produce an `A`. Unlike a Promise, it cannot reject, cannot be chained, and has no
`.catch()` or `.finally()`. Those restrictions are not missing features — they are the type-level
proof that the computation will always succeed.

## Why Promise is too broad

`Promise<A>` always exposes `.then()`, `.catch()`, and `.finally()`. That API implies that a
rejection is possible. For computations that are genuinely infallible — in-memory lookups, pure
transformations, cached reads — this is a lie the type cannot retract. A caller can always write
`.catch(handleError)` and the type system offers no objection, even when the rejection will never
arrive.

`Deferred` solves this with two structural choices working together:

```ts
type Deferred<A> = {
	readonly [_deferred]: A;
	readonly then: (onfulfilled: (value: A) => void) => void;
};
```

The `[_deferred]` field is a phantom unique symbol — it carries `A` nominally so that only values
produced by `Deferred.fromPromise` satisfy the type. A plain object `{ then: ... }` does not. This
prevents accidental structural compatibility.

The `.then()` accepts only a fulfillment callback — no rejection handler — and returns `void` rather
than a new thenable. There is no second parameter to pass, so chaining and error handling are
excluded by construction. The type says exactly what is true: this will resolve, and only that.

## Wrapping a Promise with `fromPromise`

`Deferred.fromPromise` is the only constructor. It takes a Promise you know will not reject and
wraps it into a `Deferred`:

```ts
import { Deferred } from "@nlozgachev/pipelined/core";

const d: Deferred<number> = Deferred.fromPromise(Promise.resolve(42));
```

The wrapped Promise should be genuinely infallible — a scheduled pure computation, an in-memory
read, or a cache lookup where a miss returns a default:

```ts
const settings = Deferred.fromPromise(prefsCache.getOrDefault("theme", "light"));
const reading = await settings; // string — always resolves
```

## Awaiting a Deferred

`await` works on any object with a compatible `.then()` method, and `Deferred` qualifies. The
JavaScript runtime calls `.then(resolve)` on it internally, so the protocol is identical to
awaiting a Promise:

```ts
const d = Deferred.fromPromise(configStore.get("locale"));
const locale: string = await d;
```

TypeScript infers the result type correctly: `await d` where `d: Deferred<A>` gives you `A`.

## Converting to a Promise with `toPromise`

When a third-party API requires an explicit `Promise<A>` — not just something awaitable — use
`Deferred.toPromise` to convert:

```ts
const d = Deferred.fromPromise(sessionStore.get("userId"));
const p: Promise<string> = Deferred.toPromise(d);
```

The resulting Promise always resolves. It inherits the infallibility of the `Deferred` it came from.

## When to use Deferred

Use `Deferred` when:

- You want the return type of a function to document that it is infallible — not just "it probably
  won't reject", but structurally cannot
- A downstream API expects a thenable and you want to prevent callers from attaching `.catch()`
  handlers that will never fire
- You need to convert a `Deferred` to an explicit `Promise` for interop with code that checks
  `instanceof Promise`

Keep using `Promise` directly when:

- The computation can genuinely fail — model that with `Result` or let the Promise reject
- You need `.catch()`, `.finally()`, or chainable `.then()` — those exist on Promise for a reason
