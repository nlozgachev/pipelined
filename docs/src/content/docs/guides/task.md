---
title: Task — lazy async
description: Model lazy async computations that are guaranteed to succeed — nothing runs until called.
---

`Task<A>` is an async computation with two guarantees: it is **lazy** (nothing runs until you call
it) and **infallible** (it always resolves — it never rejects). When failure is possible, that
failure is encoded in the return type using `TaskResult<E, A>` rather than leaking out as a rejected
Promise.

## The problems with Promises

Promises have two quirks that make them hard to compose.

**Promises are eager.** A Promise starts the moment it's created:

```ts
const p = new Promise<void>((resolve) => setTimeout(resolve, 5000));
// the 5-second countdown is already running
```

You can't build a pipeline of async steps and pass it around before any work begins — by the time
you have the Promise in hand, the work is already underway.

**Promises can reject.** Failure leaks out as an untyped exception rather than as a typed value.
This forces `try/catch` at every call site and makes it impossible to tell from a function's return
type whether it can fail.

## The Task approach

A `Task<A>` is a zero-argument function that returns a `Deferred<A>`:

```ts
type Task<A> = () => Deferred<A>;
```

`Deferred<A>` is a minimal async value: it supports `await` but has no `.catch()`, `.finally()`, or
chainable `.then()`. This reinforces the infallibility guarantee at the type level — there is simply
no way to register a rejection handler on a `Deferred`.

This addresses both problems with Promises. The function wrapper makes it lazy — nothing runs until
you call it. And by treating Tasks as always-succeeding computations, failure is pushed into the
type: `TaskResult<E, A>` is `Task<Result<E, A>>`, so it's impossible to overlook.

```ts
import { Task } from "@nlozgachev/pipelined/core";
import { pipe } from "@nlozgachev/pipelined/composition";

const getTimestamp: Task<number> = Task.resolve(Date.now());

// Nothing has happened yet. getTimestamp is just a description.

const pipeline = pipe(
  getTimestamp,
  Task.map((ts) => new Date(ts).toISOString()),
);

// Still nothing. pipeline is a new Task<string>.

const result = await pipeline(); // NOW it runs
```

The pipeline is built first, then executed once by calling it. You can pass it around, compose it
further, or call it multiple times.

## Creating Tasks

```ts
Task.resolve(42); // Task that resolves to 42 immediately
Task.from(() => Promise.resolve(Date.now())); // Task from any Promise-returning function
```

`Task.from` is an explicit alias for writing `() => somePromise()`. It's mainly useful for clarity:

```ts
const getTimestamp: Task<number> = Task.from(() => Promise.resolve(Date.now()));
```

## Transforming with `map`

`map` transforms the resolved value without running the Task:

```ts
pipe(
  Task.resolve(5),
  Task.map((n) => n * 2),
)(); // Promise resolving to 10
```

Chaining maps builds a description of the transformation; the actual async work happens when you
call the result.

## Sequencing with `chain`

`chain` sequences two async operations where the second depends on the result of the first:

```ts
const readUserId: Task<string> = () => Promise.resolve(session.userId);

const loadPreferences =
  (userId: string): Task<Preferences> =>
  () =>
    Promise.resolve(prefsCache.get(userId));

const userPrefs: Task<Preferences> = pipe(
  readUserId,
  Task.chain(loadPreferences),
);

await userPrefs(); // reads user ID, then loads their preferences
```

Each step waits for the previous one to resolve before starting.

## Running Tasks in parallel with `all`

`Task.all` takes an array of Tasks and runs them simultaneously, collecting all results:

```ts
const [config, locale, theme] = await Task.all([
  loadConfig,
  detectLocale,
  () => loadTheme(userId),
])();
```

The return type is inferred from the input tuple — if you pass `[Task<Config>, Task<string>]`, you
get back `Task<[Config, string]>`.

## Delaying execution

`Task.delay` adds a pause before the Task runs:

```ts
pipe(Task.resolve("ping"), Task.delay(1000))(); // resolves to "ping" after 1 second
```

Useful for debouncing or rate limiting.

## Repeating Tasks

Unlike retry — which re-runs a computation in response to failure — `repeat` and `repeatUntil` run a
Task multiple times unconditionally. This fits naturally with Task's guarantee that it never fails.

`Task.repeat` runs a Task a fixed number of times and collects every result:

```ts
pipe(pollSensor, Task.repeat({ times: 5, delay: 1000 }))(); // Task<Reading[]> — 5 readings, one per second
```

`Task.repeatUntil` keeps running until the result satisfies a predicate, then returns it. This is
the natural shape for polling:

```ts
pipe(
  checkDeploymentStatus,
  Task.repeatUntil({ when: (s) => s === "ready", delay: 2000 }),
)(); // checks every 2s until the deployment is ready
```

Both accept an optional `delay` (in ms) inserted between runs. The delay is not applied after the
final run.

## The Task family

`Task<A>` is for async operations that always succeed. When failure is possible, use the specialised
variants:

**`TaskResult<E, A>`** — an async operation that can fail with a typed error. It's
`Task<Result<E, A>>` under the hood:

```ts
import { TaskResult } from "@nlozgachev/pipelined/core";

const fetchUser = (id: string): TaskResult<string, User> =>
  TaskResult.tryCatch(
    () => fetch(`/users/${id}`).then((r) => r.json()),
    (e) => `Fetch failed: ${e}`,
  );

const name = pipe(
  fetchUser("123"),
  TaskResult.map((user) => user.name),
  TaskResult.getOrElse("Unknown"),
);

await name(); // "Alice" or "Unknown"
```

**`TaskOption<A>`** — an async operation that may return nothing. It's `Task<Option<A>>`:

```ts
import { TaskOption } from "@nlozgachev/pipelined/core";

const findUser = (id: string): TaskOption<User> =>
  TaskOption.tryCatch(() => db.users.findById(id));

const displayName = pipe(
  findUser("123"),
  TaskOption.map((user) => user.name),
  TaskOption.getOrElse("Guest"),
);

await displayName();
```

`TaskOption.tryCatch` catches any rejection and converts it to `None` — useful when you treat a
failed lookup the same as a missing value.

**`TaskValidation<E, A>`** — an async operation that accumulates errors. Used for async validation
where all checks should run regardless of individual failures.

All three follow the same API conventions as their synchronous counterparts (`map`, `chain`,
`match`, `getOrElse`, `recover`). If you've used `Result`, `TaskResult` will be immediately
familiar.

## Running a Task

A Task is just a function. To run it, call it — calling returns a `Deferred<A>`, which you can
`await` directly:

```ts
const task: Task<number> = Task.resolve(42);
const result: number = await task();
```

For `TaskResult` and `TaskOption`, the result is a wrapped value:

```ts
const taskResult: TaskResult<string, number> = TaskResult.ok(42);
const result: Result<string, number> = await taskResult(); // Ok(42)
```

Most of the time you'll call the pipeline at one point — the outer boundary where your application
produces a final result or triggers a side effect.

When you need an explicit `Promise<A>` — for example, to pass to a third-party API that requires
one — convert the `Deferred` with `Deferred.toPromise`:

```ts
import { Deferred, Task } from "@nlozgachev/pipelined/core";

const p: Promise<number> = Deferred.toPromise(task());
```

This is the only case where you need to reach for `Deferred` directly. Everywhere inside a `pipe`
chain, `await task()` is all you need.

## When to use Task vs async/await

Use `Task` when:

- You want to build a pipeline of async steps that you can compose, pass around, or delay before
  executing
- You need parallel execution via `Task.all` within a pipeline
- You want typed error handling with `TaskResult` instead of try/catch around async functions

Keep using `async/await` directly when:

- The operation is a one-liner with no composition needed
- You're inside a function body and the imperative style is clearer
- You're working with code that isn't pipeline-oriented

The two styles interoperate freely. `Task.from(() => someAsyncFunction())` wraps any async function
into a Task, and `await task()` integrates back into any async/await context — the `Deferred` that
`task()` returns is thenable, so the runtime handles it exactly like a Promise.
