---
title: Why this exists
description: What I wanted from a library like this, and what it costs.
---

I started `pipelined` because I kept writing the same null checks, the same `try/catch` around calls
that might throw, and the same retry loop with an `AbortController` wired through it, and every copy
was a little different. I wanted code where the steps of the work were easy to see, where hovering
over a function told you how it could fail, and where that plumbing lived in one place instead of in
every feature.

The sections below describe what I was looking for.

---

## Something useful

Each module here started as a problem I ran into more than once. Functions that can fail got
`Result`. Values that might be missing got `Maybe`. Forms where several fields can be wrong at the
same time got `Validation`, so the user sees every error at once instead of fixing them one submit
at a time. Requests got `RemoteData`, which replaces the `isLoading`/`error`/`data` trio and the
combinations of it that should never happen.

---

## Something readable

Here is a function that loads a user's config, reads the connection string from it, and opens a
database client:

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

There are three steps in it, but you have to read past the null checks and the `try` to find them.
Here is the same function as a pipeline:

```ts
import { Maybe, pipe } from "@pplnd/core";

const getClient = (userId: string) =>
  pipe(
    userId,
    fetchConfig,
    Maybe.chain((config) => Maybe.from.nullable(config.database.connectionString)),
    Maybe.chain(connect),
  );
```

Each line is one step, in the order it runs. If a step returns nothing, the rest are skipped and you
get `None`. The null checks still happen inside `Maybe.chain`, but nobody has to write them again.

---

## Something understandable

I wanted the types to do some of the explaining. If a function is typed
`(input: unknown) => Validation<FieldError, Order>`, a colleague knows it can return several field
errors before they open the file. In a pipeline, hovering over any step shows what it hands to the
next one.

The function names follow the same idea: they say what the step does. `map` changes the value inside
a container, `chain` runs a step that can itself fail or come back empty, and `match` takes one
handler per case, such as `{ ok, err }` or `{ some, none }`.

---

## Something honest

A signature should cover everything that can happen. `(id: string) => User` doesn't tell you it
throws when the user isn't found, and `(id: string) => Result<NotFound, User>` does. `Task` goes a
step further. It returns a `Deferred`, which has no rejection path, so you know it never throws
because the type says so.

I used the same rule to decide how much an abstraction is allowed to hide. It can hide how something
happens, but not what can happen. `Op` handles retries, backoff, timeouts and cancellation for you:

```ts
const paymentManager = Op.interpret(submitPaymentOp, {
  strategy: "exclusive",
  retry: { attempts: 3, backoff: (attempt) => Duration.milliseconds(attempt * 500) },
  timeout: { duration: Duration.seconds(10), onTimeout: () => paymentTimedOut },
});
```

None of that machinery shows up in your code, but every possible result does. A run ends as `Ok`,
`Err`, or `Nil` (cancelled or dropped), and `Op.Outcome.match` won't compile until you've handled
all three.

The library has costs, and they belong in this section too. Curried functions allocate small
closures, which you'll only notice in tight loops over large arrays. Data-last currying takes some
getting used to. And where your code meets code that doesn't use these types, like a framework
callback or a third-party SDK, you have to convert values at the boundary.

---

## Something unobtrusive

I didn't want to move a codebase into a framework to get any of this. Values in `pipelined` are
plain objects with a `kind` field. They print normally in `console.log`, survive `JSON.stringify`,
and narrow in a regular `switch`. There are no classes, so `instanceof` can't break when a value
crosses a package or worker boundary, and there's no runtime to start.

So you can try it in one function. That function returns a `Result` and the code around it stays the
same. If it doesn't help, you take it out of that one function and you're done.

---

## Something thorough

A lot of the work went into keeping things consistent, so that once you know one module you mostly
know the others. The success value is always called `value`. A single failure is `error`, and a list
of failures is `errors`. All containers share the same core operations under the same names.

Some guarantees live in the types. A failed `Validation` always has at least one error, because the
list is typed as non-empty, so you never check for an empty one. Others are enforced at runtime:
index helpers treat `1.5`, `NaN` and `Infinity` as invalid instead of returning `undefined`.

---

## Something small

A team should be able to learn the whole library, so it tries to stay small. There's one way to do
each thing, with no aliases or duplicate modules, so code review never turns into a debate about
which spelling to use. It's small in the bundle as well. It has no dependencies and tree-shakes per
function, so if you only use `Maybe.map`, that's all you ship.

[Design and influences](/appendix/influences) covers what was left out on purpose and where the
ideas came from.

---

## When plain TypeScript is enough

Plain TypeScript with early returns is often the better choice for a one-off script, a small
internal tool, or a hot loop where allocations matter. `pipelined` is for the code a team keeps
working on for years: business logic, parsing and validation, and async workflows.
