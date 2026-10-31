# pipelined (@pplnd/core)

[![npm](https://img.shields.io/npm/v/@pplnd/core?style=for-the-badge&color=000&logo=npm&label&logoColor=fff)](https://www.npmjs.com/package/@pplnd/core)
[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/pplnd/core/publish.yml?style=for-the-badge&color=000&logo=githubactions&label&logoColor=fff)](https://github.com/pplnd/core/actions/workflows/publish.yml)
[![Codecov](https://img.shields.io/codecov/c/github/pplnd/core?style=for-the-badge&color=000&logo=codecov&label&logoColor=fff)](https://app.codecov.io/github/pplnd/core)

Typed errors, explicit optional values, and composable pipelines for TypeScript.

> **Note:** pipelined is pre-1.0. The API may change between minor versions until the 1.0 release.

```sh
npm add @pplnd/core
```

## Overview

TypeScript brings static types to JavaScript, but leaves several critical failure modes to developer
discipline:

- Functions throw exceptions that never appear in their return types.
- Missing values require defensive `null` and `undefined` checks scattered across every function
  call.
- Promises reject with `unknown`, forcing manual `try/catch` blocks and speculative casts.
- Retrying requests, enforcing timeouts, and wiring cancellation requires juggling `AbortController`
  instances, timers, and mutable boolean flags.

`pipelined` provides pragmatic data structures and curried functions designed for everyday
application code. Everything is a plain JavaScript object with a `kind` discriminator — no classes,
no `instanceof` checks, no prototype modification, and no functional programming prerequisites.
Functions accept their data last, so multi-step operations read top-to-bottom in a `pipe`.

<!-- BUNDLE_OVERVIEW:START -->

It has zero dependencies, ships ESM and CommonJS builds, and tree-shakes down to ~27 B–5.96 kB
gzipped for individual modules and 22.93 kB for the entire package.

<!-- BUNDLE_OVERVIEW:END -->

## Documentation

Full guides and API reference at **[pplnd.dev](https://pplnd.dev/)**.

---

## Examples

### Handling errors without throw (Result)

Functions that throw exceptions leave error handling to caller memory. TypeScript does not track
thrown errors in return types, and `catch (err)` types errors as `unknown`. `Result<E, A>` makes
failure a normal return value:

```ts
import { pipe, Result } from "@pplnd/core";

type Config = { apiKey: string; port: number };
type ConfigError =
  | { kind: "InvalidJson"; message: string }
  | { kind: "MissingField"; field: string };

const parseConfig = (raw: string): Result<ConfigError, Config> =>
  pipe(
    Result.tryCatch(
      () => JSON.parse(raw) as Record<string, unknown>,
      { onError: (err): ConfigError => ({ kind: "InvalidJson", message: String(err) }) },
    ),
    Result.ensure(
      (data): data is { apiKey: string; port?: number } => typeof data.apiKey === "string",
      (): ConfigError => ({ kind: "MissingField", field: "apiKey" }),
    ),
    Result.map((data) => ({
      apiKey: data.apiKey,
      port: typeof data.port === "number" ? data.port : 8080,
    })),
  );

const outcome = parseConfig('{"apiKey": "secret-123"}');

if (Result.is.ok(outcome)) {
  console.log(`Starting server on port ${outcome.value.port}`);
} else {
  console.error(`Config error: ${outcome.error.kind}`);
}
```

The compiler enforces that `outcome.value` is only accessible after checking
`Result.is.ok(outcome)`. If validation fails, the typed error is preserved without runtime
exceptions.

### Optional values without null checks (Maybe)

Defensive `null` and `undefined` checks clutter business logic. When parsing optional inputs, each
transformation step can fail or produce empty data. `Maybe<A>` wraps a value that might be missing
so subsequent pipeline steps only run when a value exists:

```ts
import { Maybe, Num, pipe, Str } from "@pplnd/core";

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

Any step that evaluates to `None` skips the rest of the chain. The fallback executes once at the end
of the pipeline.

### Lazy async workflows and cancellation (Task.Result)

Standard promises start executing immediately upon creation and reject with `unknown`.
`Task.Result<E, A>` is a lazy async function `(signal?: AbortSignal) => Promise<Result<E, A>>`.
Nothing runs until you invoke it, errors remain typed in the signature, and cancellation propagates
through every chained request automatically:

```ts
import { pipe, Result, Task } from "@pplnd/core";

type User = { id: string; name: string };
type Post = { id: string; title: string };
type ApiError = { status: number; message: string };

const fetchUser = (id: string): Task.Result<ApiError, User> =>
  Task.Result.tryCatch(
    async (signal) => {
      const res = await fetch(`/users/${id}`, { signal });
      if (!res.ok) throw new Error(res.statusText);
      return (await res.json()) as User;
    },
    { onError: (err): ApiError => ({ status: 500, message: String(err) }) },
  );

const fetchPosts = (userId: string): Task.Result<ApiError, Post[]> =>
  Task.Result.tryCatch(
    async (signal) => {
      const res = await fetch(`/users/${userId}/posts`, { signal });
      if (!res.ok) throw new Error(res.statusText);
      return (await res.json()) as Post[];
    },
    { onError: (err): ApiError => ({ status: 500, message: String(err) }) },
  );

// Chain two requests — the AbortSignal propagates to both steps automatically
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

To run the pipeline with cancellation support:

```ts
const controller = new AbortController();
const run = userWithPosts("42");

// Execution starts here; aborting controller cancels the active fetch request
const outcome = await run(controller.signal);

if (Result.is.ok(outcome)) {
  render(outcome.value); // { id: "42", name: "...", posts: [...] }
} else {
  showError(outcome.error.message); // ApiError, not unknown
}
```

### Multi-field form validation (Validation)

Validators that throw or fail fast on the first error force users into a frustrating cycle of fixing
one form error at a time. `Validation<E, A>` runs all field checks and collects all validation
errors in a single pass:

```ts
import { pipe, Str, Validation } from "@pplnd/core";

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

// Accumulate errors into a flat array:
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

### Eliminating impossible UI states (RemoteData)

Tracking network requests with separate boolean flags (`isLoading`, `isError`, `data`) makes it easy
to create contradictory states, like displaying an error message while a loading spinner is still
spinning. `RemoteData` models a request as four mutually exclusive states:

```ts
import { pipe, RemoteData } from "@pplnd/core";

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

`RemoteData.match` requires handling all four variants at compile time, eliminating missing loading
or failure views.

### Managing request lifecycles, retries, and concurrency (Op)

UI events often arrive faster than the network can settle: a search box fires on every keystroke, a
user double-clicks a submit button, or a flaky connection needs exponential backoff. Writing this by
hand requires managing `AbortController` instances, timers, and attempt counters.

`Op` separates what a request does from how overlapping calls and failures are handled:

```ts
import { Duration, Op, RetryPolicy } from "@pplnd/core";

type SearchResult = { id: string; title: string };
type SearchError = { kind: "NetworkError"; cause: unknown } | { kind: "Timeout" };

const searchOp = Op.make(
  (signal) => (query: string) =>
    fetch(`/search?q=${encodeURIComponent(query)}`, { signal }).then((r) =>
      r.json() as Promise<SearchResult[]>
    ),
  { onError: (cause): SearchError => ({ kind: "NetworkError", cause }) },
);

const search = Op.interpret(searchOp, {
  strategy: "restartable", // new keystroke cancels the previous in-flight request
  retry: RetryPolicy.exponential({
    attempts: 3,
    initial: Duration.milliseconds(200),
  }),
  timeout: {
    duration: Duration.seconds(5),
    onTimeout: (): SearchError => ({ kind: "Timeout" }),
  },
});

search.subscribe((state) => {
  if (Op.is.pending(state)) showSpinner();
  if (Op.Outcome.is.ok(state)) showResults(state.value);
  if (Op.Outcome.is.err(state)) showError(state.error.kind);
});

input.addEventListener("input", (e) => search.run(e.currentTarget.value));
```

For form submissions, swapping `strategy: "restartable"` to `strategy: "exclusive"` automatically
drops duplicate clicks while a request is in flight. Built-in strategies include `restartable`,
`exclusive`, `debounced`, `throttled`, `queue`, `buffered`, `concurrent`, `keyed`, and `once`.

### Typed in-memory events and sequence funnels (EventBus)

Decoupling application components with untyped event emitters can cause runtime crashes if a
listener throws, and emitting events inside listeners can overflow the call stack through
uncontrolled recursion.

`EventBus` provides compile-time message types, listener error isolation, and FIFO queue drainage
for re-entrant events:

```ts
import { EventBus } from "@pplnd/core";

type UserFlowMessages = {
  sessionStarted: { sessionId: string };
  stepCompleted: { stepName: string };
  flowFinished: { totalTimeMs: number };
  flowCancelled: { reason: string };
};

const flowBus = EventBus.make<UserFlowMessages>();

// Match an ordered multi-step funnel with an explicit cancellation reset:
const funnel = EventBus.subscribe(
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

// Emit typed messages to the bus
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

funnel.getState(); // { completedFlows: 1 }
```

When a subscriber emits a new event during dispatch, `EventBus` buffers it into an internal FIFO
queue instead of recursing on the call stack, preserving event ordering without stack overflow.

### Deep immutable updates (Lens & Optional)

Updating nested properties immutably with object spreads
(`{ ...state, user: { ...state.user, address: { ... } } }`) becomes difficult to read and maintain
as schemas grow. `Lens` and `Optional` define reusable focus paths into nested data:

```ts
import { Lens, pipe } from "@pplnd/core";

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

### Safe lifecycle management for connections and locks (Resource)

Acquiring multiple handles — such as database connections, sockets, or distributed locks — requires
nested `try/finally` blocks. If an intermediate setup step fails or an operation aborts midway,
already-opened handles can leak.

`Resource<E, A>` packages acquisition and cleanup into a bracket. When multiple resources are
grouped with `Resource.all`, they are acquired sequentially and automatically released in reverse
(LIFO) order upon completion, error, or cancellation:

```ts
import { pipe, Resource, Task } from "@pplnd/core";

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

// Run operations safely — both handles are closed in reverse order on exit
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

### Nominal type safety for IDs and validated strings (Brand)

TypeScript's structural type system treats all `string` types as interchangeable. Passing an
`orderId` into a function expecting a `userId` compiles without warning. `Brand` attaches a
compile-time tag to primitives without runtime wrapping or memory overhead:

```ts
import { Brand, Result } from "@pplnd/core";

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
  // Compile error: sendReceipt(order, user, email.value)
}
```

### Transforming data collections (Arr & Rec)

Chaining native array methods like `.map()`, `.filter()`, and `.sort()` allocates intermediate
arrays at each step, and index lookups return `undefined` without type guidance. `Arr` and `Rec`
provide curried helpers designed for `pipe`:

```ts
import { Arr, Maybe, Num, pipe, Rec, Str } from "@pplnd/core";

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
    Arr.filterMap(normalise), // parse + drop unparseable rows in a single pass
    Arr.sortBy((a, b) => a.price - b.price), // sort ascending by price
    Arr.groupBy((item) => item.category), // Record<string, Arr.NonEmpty<Item>>
    Rec.map((group) => Arr.NonEmpty.head(group)), // lowest price per category without Maybe wrapper
  );
```

`Arr.filterMap` combines mapping and filtering into a single loop. `Arr.groupBy` returns guaranteed
non-empty groups, allowing `Arr.NonEmpty.head` to extract the first element directly without an
unnecessary `Maybe` wrapper.

---

## Quick Reference

### Error Handling and Optionality

| Problem to Solve                                          | Module       |
| --------------------------------------------------------- | ------------ |
| Synchronous typed errors without `try`/`catch` or `throw` | `Result`     |
| Optional values without `null` / `undefined` guards       | `Maybe`      |
| Multi-field form and batch validation error accumulation  | `Validation` |
| Eliminating impossible UI loading/error/data states       | `RemoteData` |
| Values that can hold one side, the other, or both at once | `These`      |
| Pure calculation audit trails and decision logging        | `Logged`     |

### Async, Concurrency, and State

| Problem to Solve                                                   | Module                |
| ------------------------------------------------------------------ | --------------------- |
| Lazy async workflows with automatic `AbortSignal` propagation      | `Task.Result`, `Task` |
| Managing request race conditions, retries, timeouts, and locks     | `Op`                  |
| In-memory typed event dispatching, sequence funnels & queue safety | `EventBus`            |
| Automatic setup and guaranteed LIFO teardown of connections/locks  | `Resource`            |
| Type-safe finite state machines & validated transitions            | `Machine`             |
| Declarative DAG task scheduling & cycle detection                  | `Graph`               |
| Infallible async synchronization latch for tasks                   | `Deferred`            |
| Circuit breaker pattern for protecting failing upstream services   | `CircuitBreaker`      |
| Pure state transitions, tokenizers, and parsers                    | `State`               |
| Dependency injection and contextual configuration without drilling | `Reader`              |

### Collections and Optics

| Problem to Solve                                           | Module                  |
| ---------------------------------------------------------- | ----------------------- |
| Bounds-safe array transformations & single-pass filters    | `Arr`, `Arr.NonEmpty`   |
| Type-safe object manipulation & key migration              | `Rec`, `Rec.NonEmpty`   |
| Immutable `Map` operations with any key type               | `Dict`, `Dict.NonEmpty` |
| Immutable `Set` operations (union, intersection, diff)     | `Uniq`, `Uniq.NonEmpty` |
| Deep nested immutable updates without spread boilerplate   | `Lens`, `Optional`      |
| String sanitization, numeric conversion & slug parsing     | `Str`, `Str.NonEmpty`   |
| Boundary clamping & division-by-zero protection            | `Num`                   |
| Exact `bigint` math without floating-point rounding errors | `BigNum`                |
| Boolean checks and conditional branching in pipelines      | `Bool`                  |
| Safe JSON parsing & circular reference protection          | `Json`                  |

### Composition and Utilities

| Problem to Solve                                                | Module                                  |
| --------------------------------------------------------------- | --------------------------------------- |
| Left-to-right value pipeline execution                          | `pipe`                                  |
| Asynchronous value & function pipeline execution                | `pipeAsync`, `flowAsync`                |
| Left-to-right function composition                              | `flow`                                  |
| Distinct compile-time types for primitive IDs                   | `Brand`                                 |
| Explicit, unit-safe time spans & timeout policies               | `Duration`, `RetryPolicy`               |
| Deep value equality & custom comparison rules                   | `Equality`                              |
| Multi-column sorting with fallback tiebreakers                  | `Ordering`                              |
| Combining boolean checks and filter rules                       | `Predicate`                             |
| Runtime type narrowing & custom type guard composition          | `Refinement`                            |
| Merging configs, counters, and summary objects                  | `Combinable`                            |
| Two-element `[first, second]` tuples                            | `Pair`                                  |
| Conditional branching and object shaping in pipelines           | `when`, `unless`, `struct`              |
| Currying, uncurrying, tuple wrapping, and argument flipping     | `curry`, `uncurry`, `flip`              |
| Feeding one input into multiple functions and combining results | `converge`, `juxt`, `on`                |
| Function result caching & pipeline side-effects                 | `memoize`, `tap`, `tapLog`              |
| Small helper functions                                          | `identity`, `constant`, `noop`, `tuple` |

---

## Package Architecture and Performance

All entry points are published with `"sideEffects": false` and structured as static constant objects
without class prototypes or closure side-effects. Modern bundlers (Vite, Rollup, webpack, esbuild,
Next.js) automatically tree-shake unused functions and modules, bundling only the specific symbols
imported by your application.

<!-- BUNDLE_TABLE:START -->

### Standalone Module Footprint (Tree-Shaken)

When imported individually, only the targeted module is bundled into your application:

| Import Pattern | Minified + Gzipped |
| :------------- | :----------------- |
| `pipe`         | **142 B**          |
| `flow`         | **173 B**          |
| `Brand`        | **27 B**           |
| `Duration`     | **150 B**          |
| `Maybe`        | **1.56 kB**        |
| `Result`       | **1.56 kB**        |
| `Validation`   | **1.56 kB**        |
| `RemoteData`   | **1.87 kB**        |
| `Machine`      | **1.88 kB**        |
| `EventBus`     | **1.17 kB**        |
| `Batcher`      | **2.87 kB**        |
| `Resource`     | **2.32 kB**        |
| `Graph`        | **5.44 kB**        |
| `Task`         | **4.04 kB**        |
| `Op`           | **5.96 kB**        |
| `Lens`         | **233 B**          |
| `Arr`          | **5.94 kB**        |
| `Rec`          | **2.54 kB**        |
| `Dict`         | **2.43 kB**        |
| `Str`          | **2.20 kB**        |

<!-- BUNDLE_TABLE:END -->

Data helpers use pre-allocated arrays and index loops where built-in methods add callback or
allocation overhead, and delegate to native C++ methods like `.slice()` where the engine is faster.
See [Performance and benchmarks](https://pplnd.dev/appendix/benchmarks) for the benchmark suite and
results.

## License

BSD-3-Clause
