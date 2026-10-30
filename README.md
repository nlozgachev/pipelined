# pipelined

[![npm](https://img.shields.io/npm/v/@nlozgachev/pipelined?style=for-the-badge&color=000&logo=npm&label&logoColor=fff)](https://www.npmjs.com/package/@nlozgachev/pipelined)
[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/nlozgachev/pipelined/publish.yml?style=for-the-badge&color=000&logo=githubactions&label&logoColor=fff)](https://github.com/nlozgachev/pipelined/actions/workflows/publish.yml)
[![Codecov](https://img.shields.io/codecov/c/github/nlozgachev/pipelined?style=for-the-badge&color=000&logo=codecov&label&logoColor=fff)](https://app.codecov.io/github/nlozgachev/pipelined)

Typed errors, explicit optional values, and composable pipelines for TypeScript.

> **Note:** pipelined is pre-1.0. The API may change between minor versions until the 1.0 release.

```sh
npm add @nlozgachev/pipelined
```

## Overview

TypeScript's built-in tools leave a few common problems to discipline: a function signature doesn't
say whether it throws, `null` checks have to be written by hand at every step, rejected promises
carry `unknown`, and retry or cancellation logic ends up tangled with the request itself.

`pipelined` gives those cases plain discriminated-union types and curried functions that compose in
a `pipe`: `Maybe` for missing values, `Result` for typed errors, `Validation` for collecting
multiple errors at once, `Task.Result` for lazy async work with cancellation, `Graph` for
declarative dependency DAG scheduling with sibling cancellation, `Machine` for type-safe finite
state transitions, `Op` for managed requests with retries and concurrency rules, `Resource` for safe
lifecycle management of connections and locks, and `EventBus` for typed in-memory events.

<!-- BUNDLE_OVERVIEW:START -->

It has zero dependencies, ships ESM and CommonJS builds, and tree-shakes down to ~36 B–7.53 kB
gzipped for individual modules (with an upper ceiling of <15.05 kB gzipped for all of `core` and
<21.96 kB for the entire package).

<!-- BUNDLE_OVERVIEW:END -->

## Documentation

Full guides and API reference at **[pipelined.lozgachev.dev](https://pipelined.lozgachev.dev)**.

---

## Examples

### Composing optional values

`null` checks pile up quickly, and every one interrupts the flow of a function. `Maybe<A>` wraps a
value that might be missing so the steps after it only run when something is there:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";
import { Num, Str } from "@nlozgachev/pipelined/data";

const parseDiscount = (raw: string): string =>
  pipe(
    raw,
    Str.trim,
    Num.from.string, // "15" → Some(15), "abc" → None
    Maybe.filter((n) => n >= 0 && n <= 100), // out of range → None
    Maybe.map((n) => `${n}% off`),
    Maybe.getOrElse(() => "No discount"),
  );

parseDiscount("  15  "); // "15% off"
parseDiscount("150"); // "No discount"
parseDiscount("abc"); // "No discount"
```

Every step that sees `None` is skipped. The fallback runs once, at the end.

### Typed async errors and cancellation

A `Promise<T>` rejects with `unknown`, so the return type of an async function never tells you how
it can fail. `Task.Result<E, A>` is a lazy async function
`(signal?: AbortSignal) => Deferred<Result<E, A>>`. It never rejects, and the error type `E` stays
in the signature:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Result, Task } from "@nlozgachev/pipelined/core";

type User = { id: string; name: string };
type Post = { id: string; title: string };
type ApiError = { status: number; message: string };

const fetchUser = (id: string): Task.Result<ApiError, User> =>
  Task.Result.tryCatch(
    (signal) =>
      fetch(`/users/${id}`, { signal }).then((r) => {
        if (!r.ok) throw { status: r.status, message: r.statusText };
        return r.json() as Promise<User>;
      }),
    { onError: (e) => e as ApiError },
  );

const fetchPosts = (userId: string): Task.Result<ApiError, Post[]> =>
  Task.Result.tryCatch(
    (signal) =>
      fetch(`/users/${userId}/posts`, { signal }).then((r) => r.json()),
    { onError: (e) => e as ApiError },
  );

// Chain two requests — the AbortSignal propagates to both automatically
const userWithPosts = (id: string) =>
  pipe(
    fetchUser(id),
    Task.Result.chain((user) =>
      pipe(
        fetchPosts(user.id),
        Task.Result.map((posts) => ({ ...user, posts })),
      )
    ),
  );
```

`userWithPosts` is a function, so nothing runs until you call it. The `AbortSignal` you pass in is
forwarded to both requests; aborting cancels whichever one is currently in flight.

```ts
const controller = new AbortController();
const fetchUserWithPosts = userWithPosts("42"); // build the lazy task
const result = await fetchUserWithPosts(controller.signal); // run it with cancellation

if (Result.is.ok(result)) {
  render(result.value); // { ...User, posts: Post[] }
} else {
  showError(result.error); // ApiError, not unknown
}
```

### Transforming data collections

Built-in array and object lookups return `undefined` when an index is out of bounds or a key is
missing. The helpers in `@nlozgachev/pipelined/data` are curried for `pipe` and return `Maybe`
whenever an element might not exist:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";
import { Arr, Num, Rec, Str } from "@nlozgachev/pipelined/data";

type RawItem = { name: string; price: string; category: string };
type Item = { name: string; price: number; category: string };

const normalise = (raw: RawItem): Maybe<Item> =>
  pipe(
    Num.from.string(raw.price), // "9.99" → Some(9.99), "n/a" → None
    Maybe.map((price) => ({
      name: Str.trim(raw.name),
      price,
      category: raw.category,
    })),
  );

const cheapestByCategory = (items: RawItem[]) =>
  pipe(
    items,
    Arr.filterMap(normalise), // parse + drop unparseable prices in one pass
    Arr.sortBy((a, b) => a.price - b.price), // ascending price
    Arr.groupBy((item) => item.category), // Record<string, Arr.NonEmpty<Item>>
    Rec.map((group) => Arr.head(group)), // cheapest per category — Maybe<Item>
  );
```

`filterMap` runs a function that returns `Maybe` and keeps only the `Some` values, replacing a `map`
followed by a `filter`. `Arr.head` returns `Maybe<Item>` instead of `Item | undefined`, so a missing
value is handled the same way as the rest of the pipeline.

### Multi-field form validation

If a form validator stops at the first error, the user has to fix and resubmit one field at a time.
`Validation<E, A>` checks every field and collects all errors in one pass:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Validation } from "@nlozgachev/pipelined/core";
import { Str } from "@nlozgachev/pipelined/data";

type SignupForm = { username: string; email: string };

const validateUsername = (name: string): Validation<string, string> =>
  pipe(
    name,
    Str.trim,
    Validation.from.Predicate(
      (s) => s.length >= 3,
      () => "Username must be at least 3 characters",
    ),
  );

const validateEmail = (email: string): Validation<string, string> =>
  pipe(
    email,
    Str.trim,
    Validation.from.Predicate(
      (s) => s.includes("@"),
      () => "Email must contain an @ symbol",
    ),
  );

const validateSignup = (form: SignupForm) =>
  Validation.struct({
    username: validateUsername(form.username),
    email: validateEmail(form.email),
  });

const outcome = validateSignup({ username: "a", email: "invalid" });

if (Validation.is.failed(outcome)) {
  console.log(outcome.errors);
  // ["Username must be at least 3 characters", "Email must contain an @ symbol"]
}

// Or keep errors partitioned per field for UI forms:
const validateForm = Validation.keyed.make({
  username: validateUsername,
  email: validateEmail,
});

const formState = validateForm({ username: "a", email: "invalid" });

if (Validation.keyed.is.failed(formState)) {
  const errors = Validation.keyed.getErrors(formState);
  // Some({ username: ["Username must be at least 3 characters"], email: ["Email must contain an @ symbol"] })
}
```

### Eliminating impossible UI states

Tracking a request with separate `isLoading`, `isError`, and `data` fields makes it easy to end up
in states that shouldn't exist, like showing a spinner and an error message at the same time.
`RemoteData` represents the request as one of four mutually exclusive states:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { RemoteData } from "@nlozgachev/pipelined/core";

type UserProfile = { name: string };
type FetchError = { message: string };

const renderUI = (state: RemoteData<FetchError, UserProfile>): string =>
  pipe(
    state,
    RemoteData.match({
      notAsked: () => "Click to load profile",
      loading: () => "Loading...",
      failure: (err) => `Failed: ${err.message}`,
      success: (user) => `Welcome, ${user.name}!`,
    }),
  );

renderUI(RemoteData.make.notAsked()); // "Click to load profile"
renderUI(RemoteData.make.loading()); // "Loading..."
renderUI(RemoteData.make.failure({ message: "Network down" })); // "Failed: Network down"
renderUI(RemoteData.make.success({ name: "Alice" })); // "Welcome, Alice!"
```

### Managing request lifecycles, retries, and timeouts

Writing retries, backoff, a per-attempt timeout, and caller cancellation by hand means juggling
timers, `AbortController` instances, and recursive attempt counters:

```ts
type UserResult =
  | { ok: true; user: User }
  | { ok: false; error: "Timeout" | "NetworkError" };

async function fetchUser(
  id: string,
  signal?: AbortSignal,
): Promise<UserResult> {
  async function attempt(n: number): Promise<UserResult> {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 5000);
    signal?.addEventListener("abort", () => controller.abort(), { once: true });

    try {
      const res = await fetch(`/users/${id}`, { signal: controller.signal });
      clearTimeout(timerId);
      return { ok: true, user: await res.json() };
    } catch (e) {
      clearTimeout(timerId);
      if ((e as Error).name === "AbortError" && !signal?.aborted) {
        return { ok: false, error: "Timeout" };
      }
      if (n < 3) {
        await new Promise((r) => setTimeout(r, n * 1000));
        return attempt(n + 1);
      }
      return { ok: false, error: "NetworkError" };
    }
  }
  return attempt(1);
}
```

With **pipelined**:

```ts
import { Op } from "@nlozgachev/pipelined/core";
import { Duration } from "@nlozgachev/pipelined/types";

type ApiError = { kind: "NetworkError"; cause: unknown } | { kind: "Timeout" };

const fetchUser = Op.interpret(
  Op.make(
    (signal) => (id: string) =>
      fetch(`/users/${id}`, { signal }).then((r) => r.json() as Promise<User>),
    { onError: (cause): ApiError => ({ kind: "NetworkError", cause }) },
  ),
  {
    strategy: "restartable",
    retry: { attempts: 3, backoff: (n) => Duration.seconds(n) },
    timeout: {
      duration: Duration.seconds(5),
      onTimeout: (): ApiError => ({ kind: "Timeout" }),
    },
  },
);
```

`fetchUser` doesn't run until you call `run`. Retries, signal forwarding, and timeout timers are
handled by the interpreter, and every call resolves to an `Op.Outcome<ApiError, User>`: `Ok(user)`,
`Err(apiError)`, or `Nil` when cancelled or superseded.

```ts
const outcome = await fetchUser.run("42");

if (Op.Outcome.is.ok(outcome)) {
  render(outcome.value); // User
} else if (Op.Outcome.is.err(outcome)) {
  showError(outcome.error); // ApiError, not unknown
}

// cancel an in-flight request immediately
fetchUser.abort();
```

### Repeated UI interactions and concurrency strategies

UI events often fire faster than the network can answer: a search box that runs on every keystroke,
a submit button clicked twice, or a draft auto-save. `Op` separates what the request does from how
overlapping calls behave:

**Search (cancel the previous call when the user types):**

```ts
import { Op } from "@nlozgachev/pipelined/core";
import { Duration } from "@nlozgachev/pipelined/types";

type SearchError = { kind: "SearchFailed"; cause: unknown };

const searchOp = Op.make(
  (signal) => (query: string) =>
    fetch(`/search?q=${query}`, { signal }).then((r) =>
      r.json() as Promise<SearchResult[]>
    ),
  { onError: (cause): SearchError => ({ kind: "SearchFailed", cause }) },
);

const search = Op.interpret(searchOp, {
  strategy: "restartable", // new call cancels the previous in-flight request
  retry: { attempts: 2, backoff: Duration.milliseconds(300) },
});

search.subscribe((state) => {
  if (Op.is.pending(state)) showSpinner();
  if (Op.is.retrying(state)) showSpinner(`retrying… attempt ${state.attempt}`);
  if (Op.Outcome.is.ok(state)) showResults(state.value);
  if (Op.Outcome.is.err(state)) showError(state.error);
});

input.addEventListener("input", (e) => search.run(e.currentTarget.value));
```

**Form submit (ignore new clicks while a request is in flight):**

```ts
type SubmitError = { kind: "SubmitFailed"; cause: unknown };

const submitOp = Op.make(
  (signal) => (data: FormData) =>
    fetch("/orders", { method: "POST", body: data, signal }).then((r) =>
      r.json()
    ),
  { onError: (cause): SubmitError => ({ kind: "SubmitFailed", cause }) },
);

const submit = Op.interpret(submitOp, {
  strategy: "exclusive", // in-flight? new calls are dropped immediately
});

submit.subscribe((state) => {
  submitButton.disabled = Op.is.pending(state);
  if (Op.Outcome.is.ok(state)) showConfirmation(state.value);
  if (Op.Outcome.is.err(state)) showError(state.error);
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  submit.run(new FormData(form)); // double-clicks and rage-clicks are ignored
});
```

Built-in strategies include `restartable`, `exclusive`, `debounced`, `throttled`, `queue`,
`buffered`, `concurrent`, `keyed`, and `once`.

### Typed event dispatching, sequence funnels, and queue safety

`EventBus` is an in-memory pub/sub broker with a typed message map. Listeners can subscribe to
single events or match ordered multi-step sequences with a reset event:

```ts
import { EventBus } from "@nlozgachev/pipelined/core";

type UserFlowMessages = {
  sessionStarted: { sessionId: string };
  stepCompleted: { stepName: string };
  flowFinished: { totalTimeMs: number };
  flowCancelled: { reason: string };
};

const flowBus = EventBus.make<UserFlowMessages>();

// Pattern-match the complete multi-step funnel
const sub = EventBus.subscribe(
  flowBus,
  ["sessionStarted", "stepCompleted", "flowFinished"],
  { ordered: true, reset: "flowCancelled" },
).reduce(
  (msg, state) => {
    if (msg.kind === "flowFinished") {
      return { completedFlows: state.completedFlows + 1 };
    }
    return state;
  },
  { completedFlows: 0 },
);

// Emit typed messages to the event bus
EventBus.emit(flowBus, {
  kind: "sessionStarted",
  value: { sessionId: "sess-101" },
});

EventBus.emit(flowBus, {
  kind: "stepCompleted",
  value: { stepName: "onboarding" },
});

EventBus.emit(flowBus, {
  kind: "flowFinished",
  value: { totalTimeMs: 4200 },
});

sub.getState(); // { completedFlows: 1 }
```

When a listener emits another event during handling, `EventBus` drains the new events through an
internal FIFO queue instead of recursing on the call stack, so cascading events stay in order and
cannot overflow the stack.

### Deep immutable updates without spread boilerplate

Updating a nested field immutably usually means copying each level with `{ ...obj }`. `Lens` and
`Optional` let you build a reusable path to a nested property and update it in one step:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Lens } from "@nlozgachev/pipelined/core";

type Address = { city: string; zip: string };
type User = { name: string; address: Address };

const user: User = {
  name: "Alice",
  address: { city: "Berlin", zip: "10115" },
};

const addressLens = Lens.from.property<User>()("address");
const cityLens = Lens.from.property<Address>()("city");
const userCityLens = pipe(addressLens, Lens.andThen(cityLens));

// Immutably modify deep property in one line
const updatedUser = pipe(
  user,
  Lens.modify(userCityLens)((c) => c.toUpperCase()),
);

updatedUser.address.city; // "BERLIN"
```

### Safe lifecycle management for connections and locks

Acquiring database connections, sockets, or distributed locks usually requires nested `try/finally`
blocks. If a second resource fails to open or an operation aborts midway, it is easy to leak an
already-opened handle or release resources in the wrong order.

`Resource<E, A>` packages acquisition and guaranteed cleanup into an opaque bracket. When composed
with `Resource.chain` or `Resource.all`, resources are acquired sequentially and automatically
released in strict reverse (LIFO) order upon completion or error:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Resource, Task } from "@nlozgachev/pipelined/core";

type AppError =
  | { kind: "DbError"; message: string }
  | { kind: "CacheError"; message: string };

type DbClient = {
  query: (sql: string) => Promise<{ id: string; name: string }>;
  close: () => Promise<void>;
};
type CacheClient = {
  set: (key: string, value: string) => Promise<void>;
  quit: () => Promise<void>;
};

declare function connectPostgres(url: string): Promise<DbClient>;
declare function connectRedis(url: string): Promise<CacheClient>;

const dbResource = Resource.make(
  Task.Result.tryCatch(
    () => connectPostgres("postgres://localhost:5432/app"),
    { onError: (error): AppError => ({ kind: "DbError", message: String(error) }) },
  ),
  (db) => Task.tryCatch(() => db.close(), { onError: () => {} }),
);

const cacheResource = Resource.make(
  Task.Result.tryCatch(
    () => connectRedis("redis://localhost:6379"),
    { onError: (error): AppError => ({ kind: "CacheError", message: String(error) }) },
  ),
  (cache) => Task.tryCatch(() => cache.quit(), { onError: () => {} }),
);

// Group independent resources into a typed record:
const appInfra = Resource.all({
  db: dbResource,
  cache: cacheResource,
});

// Run operations safely — both handles are closed in reverse order upon completion or failure
const syncUserProfile = (userId: string) =>
  pipe(
    appInfra,
    Resource.use(({ db, cache }) =>
      Task.Result.tryCatch(
        async () => {
          const user = await db.query(`SELECT * FROM users WHERE id = '${userId}'`);
          await cache.set(`user:${userId}`, JSON.stringify(user));
          return user;
        },
        { onError: (error): AppError => ({ kind: "DbError", message: String(error) }) },
      )
    ),
  );

const fetchAndCacheUser = syncUserProfile("usr_101");
const result = await fetchAndCacheUser();
// cache.quit() and db.close() are guaranteed to have run in reverse order
```

### Nominal type safety and security boundaries

Because TypeScript's type system is structural, two `string` IDs (`UserId` and `OrderId`) are
interchangeable by default. `Brand` attaches a compile-time tag to a primitive type so the compiler
rejects mixed-up arguments without adding any wrapper at runtime:

```ts
import { Result } from "@nlozgachev/pipelined/core";
import { Brand } from "@nlozgachev/pipelined/types";

type UserId = Brand<"UserId", string>;
type OrderId = Brand<"OrderId", string>;
type Email = Brand<"Email", string>;

const toUserId = Brand.wrap<"UserId", string>();
const toOrderId = Brand.wrap<"OrderId", string>();
const toEmail = Brand.wrap<"Email", string>();

const parseEmail = (raw: string): Result<string, Email> =>
  raw.includes("@")
    ? Result.make.ok(toEmail(raw))
    : Result.make.err("Invalid email address");

const sendReceipt = (userId: UserId, orderId: OrderId, email: Email) =>
  `Sent to ${email} for order ${orderId} by user ${userId}`;

const user = toUserId("usr_100");
const order = toOrderId("ord_500");
const email = parseEmail("alice@example.com");

if (Result.is.ok(email)) {
  sendReceipt(user, order, email.value);
  // Type error: sendReceipt(order, user, email.value)
}
```

---

## Quick Reference

| Problem to Solve                                                   | Module                          | Import Path                         |
| ------------------------------------------------------------------ | ------------------------------- | ----------------------------------- |
| Optional values without `null` / `undefined` checks                | `Maybe`                         | `@nlozgachev/pipelined/core`        |
| Synchronous typed errors without `try`/`catch`                     | `Result`                        | `@nlozgachev/pipelined/core`        |
| Multi-field form and batch validation error accumulation           | `Validation`                    | `@nlozgachev/pipelined/core`        |
| Lazy async workflows with automatic `AbortSignal`                  | `Task.Result`, `Task`           | `@nlozgachev/pipelined/core`        |
| Infallible async return container for tasks                        | `Deferred`                      | `@nlozgachev/pipelined/core`        |
| Declarative DAG task scheduling & cycle detection                  | `Graph`                         | `@nlozgachev/pipelined/core`        |
| Type-safe finite state machines & validated transitions            | `Machine`                       | `@nlozgachev/pipelined/core`        |
| Eliminating impossible UI loading/error/data states                | `RemoteData`                    | `@nlozgachev/pipelined/core`        |
| Managing request race conditions, retries, and locks               | `Op`                            | `@nlozgachev/pipelined/core`        |
| In-memory typed event dispatching, sequence funnels & queue safety | `EventBus`                      | `@nlozgachev/pipelined/core`        |
| Deep nested immutable updates without spread boilerplate           | `Lens`, `Optional`              | `@nlozgachev/pipelined/core`        |
| Implicit dependency injection without prop drilling                | `Reader`                        | `@nlozgachev/pipelined/core`        |
| Pure state transitions, tokenizers, and parsers                    | `State`                         | `@nlozgachev/pipelined/core`        |
| Automatic setup and teardown of connections and locks              | `Resource`                      | `@nlozgachev/pipelined/core`        |
| Pure calculation audit trails and decision logging                 | `Logged`                        | `@nlozgachev/pipelined/core`        |
| Values that can hold one side, the other, or both at once          | `These`                         | `@nlozgachev/pipelined/core`        |
| Deep value equality & custom comparison rules                      | `Equality`                      | `@nlozgachev/pipelined/core`        |
| Multi-column sorting with fallback tiebreakers                     | `Ordering`                      | `@nlozgachev/pipelined/core`        |
| Combining boolean checks and filter rules                          | `Predicate`                     | `@nlozgachev/pipelined/core`        |
| Runtime type narrowing & custom type guard composition             | `Refinement`                    | `@nlozgachev/pipelined/core`        |
| Merging configs, counters, and summary objects                     | `Combinable`                    | `@nlozgachev/pipelined/core`        |
| Working with two-element `[first, second]` tuples                  | `Pair`                          | `@nlozgachev/pipelined/core`        |
| Bounds-safe array transformations                                  | `Arr`, `Arr.NonEmpty`           | `@nlozgachev/pipelined/data`        |
| Type-safe object manipulation & key migration                      | `Rec`, `Rec.NonEmpty`           | `@nlozgachev/pipelined/data`        |
| Immutable `Map` operations with any key type                       | `Dict`, `Dict.NonEmpty`         | `@nlozgachev/pipelined/data`        |
| Immutable `Set` operations (union, intersection, difference)       | `Uniq`, `Uniq.NonEmpty`         | `@nlozgachev/pipelined/data`        |
| String sanitization, numeric conversion & slug parsing             | `Str`, `Str.NonEmpty`           | `@nlozgachev/pipelined/data`        |
| Boundary clamping & division-by-zero protection                    | `Num`                           | `@nlozgachev/pipelined/data`        |
| Exact `bigint` math without floating-point rounding errors         | `BigNum`                        | `@nlozgachev/pipelined/data`        |
| Boolean checks and conditional branching in pipelines              | `Bool`                          | `@nlozgachev/pipelined/data`        |
| Safe JSON parsing & circular reference protection                  | `Json`                          | `@nlozgachev/pipelined/data`        |
| Distinct types for primitive IDs and validated strings             | `Brand`                         | `@nlozgachev/pipelined/types`       |
| Explicit, unit-safe time spans & timeout policies                  | `Duration`, `RetryPolicy`       | `@nlozgachev/pipelined/types`       |
| Left-to-right value pipeline execution                             | `pipe`                          | `@nlozgachev/pipelined/composition` |
| Asynchronous value & function pipeline execution                   | `pipeAsync`, `flowAsync`        | `@nlozgachev/pipelined/composition` |
| Left-to-right function composition                                 | `flow`                          | `@nlozgachev/pipelined/composition` |
| Conditional branching and object shaping in pipelines              | `when`, `unless`, `struct`      | `@nlozgachev/pipelined/composition` |
| Currying, uncurrying, tuple wrapping, and argument flipping        | `curry`, `uncurry`, `flip`      | `@nlozgachev/pipelined/composition` |
| Feeding one input into multiple functions and combining results    | `converge`, `juxt`, `on`        | `@nlozgachev/pipelined/composition` |
| Function result caching & pipeline side-effects                    | `memoize`, `tap`, `tapLog`      | `@nlozgachev/pipelined/composition` |
| Small helper functions (`identity`, `constant`, `noop`, `tuple`)   | `identity`, `constant`, `tuple` | `@nlozgachev/pipelined/composition` |

---

## Package Architecture and Performance

All entry points are published with `"sideEffects": false` and structured as static constant objects
without class prototypes or closure side-effects. Modern bundlers (Vite, Rollup, webpack, esbuild,
Next.js) automatically tree-shake unused functions and modules, bundling only the specific symbols
imported by your application.

<!-- BUNDLE_TABLE:START -->

### Standalone Module Footprint (Tree-Shaken)

When imported individually, only the targeted module is bundled into your application:

| Import Pattern | Subpath                             | Minified + Gzipped |
| :------------- | :---------------------------------- | :----------------- |
| `pipe`         | `@nlozgachev/pipelined/composition` | **142 B**          |
| `flow`         | `@nlozgachev/pipelined/composition` | **173 B**          |
| `Brand`        | `@nlozgachev/pipelined/types`       | **36 B**           |
| `Duration`     | `@nlozgachev/pipelined/types`       | **153 B**          |
| `Maybe`        | `@nlozgachev/pipelined/core`        | **1.56 kB**        |
| `Result`       | `@nlozgachev/pipelined/core`        | **1.56 kB**        |
| `Validation`   | `@nlozgachev/pipelined/core`        | **1.56 kB**        |
| `RemoteData`   | `@nlozgachev/pipelined/core`        | **1.87 kB**        |
| `Machine`      | `@nlozgachev/pipelined/core`        | **1.89 kB**        |
| `EventBus`     | `@nlozgachev/pipelined/core`        | **1.18 kB**        |
| `Resource`     | `@nlozgachev/pipelined/core`        | **2.32 kB**        |
| `Graph`        | `@nlozgachev/pipelined/core`        | **5.44 kB**        |
| `Task`         | `@nlozgachev/pipelined/core`        | **4.04 kB**        |
| `Op`           | `@nlozgachev/pipelined/core`        | **5.97 kB**        |
| `Lens`         | `@nlozgachev/pipelined/core`        | **233 B**          |
| `Arr`          | `@nlozgachev/pipelined/data`        | **6.82 kB**        |
| `Rec`          | `@nlozgachev/pipelined/data`        | **6.82 kB**        |
| `Dict`         | `@nlozgachev/pipelined/data`        | **7.53 kB**        |
| `Str`          | `@nlozgachev/pipelined/data`        | **7.42 kB**        |

### Subpath Ceilings (Worst-Case Monolithic Imports)

The upper bounds below apply only if your application imports every exported symbol from that
subpath:

| Subpath                           | Scope                                                             | Gzipped Size | Budget Limit |
| :-------------------------------- | :---------------------------------------------------------------- | :----------- | :----------- |
| @nlozgachev/pipelined/types       | Domain branded types and duration units                           | **461 B**    | 550 B        |
| @nlozgachev/pipelined/composition | Pipeline runners and composition combinators                      | **1.54 kB**  | 2.00 kB      |
| @nlozgachev/pipelined/data        | Bounds-safe array, record, and primitive helpers                  | **9.64 kB**  | 10.00 kB     |
| @nlozgachev/pipelined/core        | Typed errors, optional values, async execution, state, and optics | **15.05 kB** | 16.00 kB     |
| **All entry points combined**     | Monolithic import of entire library                               | **21.96 kB** | 23.00 kB     |

<!-- BUNDLE_TABLE:END -->

Data helpers use pre-allocated arrays and index loops where built-in methods add callback or
allocation overhead, and delegate to native C++ methods like `.slice()` where the engine is faster.
See [Performance and benchmarks](https://pipelined.lozgachev.dev/appendix/benchmarks) for the
benchmark suite and results.

## License

BSD-3-Clause
