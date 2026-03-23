---
title: Resource — safe acquire-release lifecycle
description: Guarantee that connections, file handles, and other managed objects are always cleaned up, even when errors occur.
---

You open a database connection, run a query, and close the connection afterward. Then one day the
query throws an error, the `close()` call is skipped, and the connection lingers. You add a
`try/finally` block. Then another path grows around it, and another, and now cleanup logic is
scattered across every function that touches the database.

`Resource<E, A>` solves this structurally. You describe *how to open something* and *how to close
it* once, and `Resource.use` guarantees the close step always runs — whether the work succeeds or
fails.

## The structure of a Resource

A Resource holds two things: an `acquire` step that opens the resource (a `TaskResult` that may
fail), and a `release` function that closes it (a `Task` that always succeeds). You build one and
run it with `Resource.use`.

```ts
import { Resource, TaskResult, Task } from "@nlozgachev/pipelined/core";
import { pipe } from "@nlozgachev/pipelined/composition";
```

## Creating a Resource with `make`

`Resource.make` takes the acquire step and the release function:

```ts
const dbResource = Resource.make(
  TaskResult.tryCatch(
    () => openConnection({ host: "db.internal", port: 5432 }),
    (e) => new Error(`Could not connect: ${e}`)
  ),
  (conn) => Task.from(() => conn.close())
);
```

The release function receives the same value that `acquire` produced. When the connection is no
longer needed, `Resource.use` will call `conn.close()` with that exact connection — whether the
work succeeded or returned an error.

## Creating from an infallible acquire

When the acquire step cannot fail — an in-memory structure, a timer, or a simple counter — use
`Resource.fromTask`:

```ts
const lockResource = Resource.fromTask<never, Lock>(
  Task.from(() => Promise.resolve(acquireLock("export-job"))),
  (lock) => Task.from(() => Promise.resolve(lock.release()))
);
```

The type parameter `<never, Lock>` makes the error type explicit. Since acquisition cannot fail,
`never` signals there is no error path.

## Running work with `use`

`Resource.use` takes a function that receives the acquired value and returns a `TaskResult`. It
acquires the resource, runs your function, then releases the resource — always, in that order.

```ts
const rows = await pipe(
  dbResource,
  Resource.use((conn) =>
    TaskResult.tryCatch(
      () => conn.query("SELECT id, name FROM products WHERE active = true"),
      (e) => new Error(`Query failed: ${e}`)
    )
  )
)();
```

If `openConnection` fails, the function is never called and `close` is never called — there is
nothing to clean up. If the query fails, `close` is still called with the connection that was
opened.

## Composing two resources with `combine`

When a piece of work needs two resources — a database connection and a cache client, say — use
`Resource.combine` to acquire both and present them as a pair:

```ts
const combined = Resource.combine(dbResource, cacheResource);

const result = await pipe(
  combined,
  Resource.use(([conn, cache]) =>
    TaskResult.tryCatch(
      async () => {
        const cached = await cache.get("user:42");
        if (cached) return cached;
        const row = await conn.query("SELECT * FROM users WHERE id = 42");
        await cache.set("user:42", row, 300);
        return row;
      },
      (e) => new Error(`Lookup failed: ${e}`)
    )
  )
)();
```

Resources are released in reverse acquisition order: the cache client is released before the
database connection. If acquiring the cache client fails after the database connection is already
open, the database connection is closed immediately before the error is returned.

## Nesting resources

For more complex compositions, you can nest `Resource.use` calls. Each `use` manages its own
acquire-release lifecycle independently:

```ts
const result = await pipe(
  dbResource,
  Resource.use((conn) =>
    pipe(
      transactionResource(conn),
      Resource.use((tx) =>
        TaskResult.tryCatch(
          () => insertOrder(tx, order),
          (e) => new Error(`Insert failed: ${e}`)
        )
      )
    )
  )
)();
```

The transaction is released (committed or rolled back) before the connection is released.

## When to use Resource

- Opening and closing database connections, file handles, or network sockets
- Acquiring and releasing locks around a critical section
- Starting and stopping background workers tied to a request's lifetime
- Any pattern where cleanup must run even when errors occur

Keep using `try/finally` when you are working with a single synchronous operation inside a narrow
scope. `Resource` pays off when cleanup is async, when resources compose, or when the acquire step
can itself fail.
