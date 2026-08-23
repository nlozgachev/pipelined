# pipelined

[![npm](https://img.shields.io/npm/v/@nlozgachev/pipelined?style=for-the-badge&color=000&logo=npm&label&logoColor=fff)](https://www.npmjs.com/package/@nlozgachev/pipelined)
[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/nlozgachev/pipelined/publish.yml?style=for-the-badge&color=000&logo=githubactions&label&logoColor=fff)](https://github.com/nlozgachev/pipelined/actions/workflows/publish.yml)
[![Codecov](https://img.shields.io/codecov/c/github/nlozgachev/pipelined?style=for-the-badge&color=000&logo=codecov&label&logoColor=fff)](https://app.codecov.io/github/nlozgachev/pipelined)

Opinionated functional abstractions for TypeScript.

> **Note:** pipelined is pre-1.0. The API may change between minor versions until the 1.0 release.

```sh
npm add @nlozgachev/pipelined
```

## Overview

Standard TypeScript applications frequently deal with unchecked runtime exceptions, manual null
propagation, unhandled async rejections, race conditions, and verbose nested spread operators.

`pipelined` provides discriminated unions and pure combinators to model these conditions explicitly:
`Maybe` for absence, `Result` for typed failures, `Validation` for multi-error accumulation,
`Task.Result` for lazy infallible async, `Op` for declarative request concurrency, and `Stream` for
typed event sequences.

The library has zero external dependencies, <16 KB core gzipped (<25 KB total), and compiles to dual
ESM and CommonJS distributions.

## Documentation

Full guides and API reference at **[pipelined.lozgachev.dev](https://pipelined.lozgachev.dev)**.

---

## Examples

### Composing optional values

`null` checks accumulate fast. Each one is a conditional branch that the type system can't help you
forget. `Maybe<A>` turns absence into a value that composes — the same operations apply whether or
not anything is there:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";
import { Num, Str } from "@nlozgachev/pipelined/data";

const parseDiscount = (raw: string): string =>
  pipe(
    raw,
    Str.trim,
    Num.parse, // "15" → Some(15), "abc" → None
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

In JavaScript, asynchronous exceptions bypass the static type system, leaving unhandled rejections
as invisible runtime risks. `Task.Result<E, A>` represents fallible asynchronous computations as
lazy, infallible tasks that resolve to a typed `Result`. The error type is explicitly tracked in the
function signature, ensuring that failures are handled before compile time:

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

`userWithPosts` is a lazy function — nothing runs until called. The `AbortSignal` threads through
both requests: abort at any point and whichever request is in flight is cancelled immediately.

```ts
const controller = new AbortController();
const fetchUserWithPosts = userWithPosts("42"); // build the lazy task
const result = await fetchUserWithPosts(controller.signal); // run it — signal controls cancellation

if (Result.is.ok(result)) {
  render(result.value); // { ...User, posts: Post[] }
} else {
  showError(result.error); // ApiError — typed, not unknown
}
```

### Transforming data collections

Standard JavaScript arrays and records routinely return `undefined` on out-of-bounds access or
missing keys. The utility modules in `pipelined` wrap these operations with data-last, curried
helper functions that return `Maybe` when a value might be missing, allowing data transformation
steps to compose naturally with the core types:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";
import { Arr, Num, Rec, Str } from "@nlozgachev/pipelined/data";

type RawItem = { name: string; price: string; category: string };
type Item = { name: string; price: number; category: string };

const normalise = (raw: RawItem): Maybe<Item> =>
  pipe(
    Num.parse(raw.price), // "9.99" → Some(9.99), "n/a" → None
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

`filterMap` applies a function that returns `Maybe` and collects only the `Some` results — one step
replaces a `map` followed by a `filter`. `Arr.head` returns `Maybe<Item>` rather than
`Item | undefined`, so the absence is explicit in the type and the rest of the pipeline handles it
the same way.

### Multi-field form validation

In web forms and batch data ingestion, failing fast on the first error produces poor user
experiences. `Validation<E, A>` accumulates all errors across independent fields simultaneously:

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
```

### Eliminating impossible UI states

Managing asynchronous data in UI components with separate boolean flags (`isLoading`, `isError`,
`data`) leads to contradictory combinations (like showing a spinner alongside an error alert).
`RemoteData` models the complete 4-state lifecycle explicitly:

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

Handling robust network interactions — including retry attempts, backoff timing, timeouts, and
signal-driven cancellation — typically requires complex, stateful code that is highly prone to
subtle race conditions:

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

const fetchUser = Op.interpret(
  Op.create(
    (signal) => (id: string) =>
      fetch(`/users/${id}`, { signal }).then((r) => r.json() as Promise<User>),
    (e) => new ApiError(e),
  ),
  {
    strategy: "restartable",
    retry: { attempts: 3, backoff: (n) => Duration.seconds(n) },
    timeout: {
      duration: Duration.seconds(5),
      onTimeout: () => new ApiError("request timed out"),
    },
  },
);
```

`fetchUser` is a managed operator — nothing runs until you call `run`. Retry logic, signal
propagation, and timeout wiring are handled automatically. The outcome type is the contract:
`ApiError` on the left, `User` on the right, nothing escapes as an unhandled exception.

```ts
const outcome = await fetchUser.run("42");

if (Op.isOk(outcome)) {
  render(outcome.value); // User
} else if (Op.isErr(outcome)) {
  showError(outcome.error); // ApiError, not unknown
}

// explicit cancellation — in-flight request is aborted immediately
fetchUser.abort();
```

### Repeated UI interactions and concurrency strategies

User interfaces frequently trigger repeated asynchronous events: a search input firing on every
keystroke, a submit button clicked multiple times, or background draft auto-saving. `Op` lets you
declare the concurrency strategy as a clean configuration choice:

**Search — cancel the previous call when the user types:**

```ts
import { Op } from "@nlozgachev/pipelined/core";
import { Duration } from "@nlozgachev/pipelined/types";

const searchOp = Op.create(
  (signal) => (query: string) =>
    fetch(`/search?q=${query}`, { signal }).then((r) =>
      r.json() as Promise<SearchResult[]>
    ),
  (e) => new SearchError(e),
);

const search = Op.interpret(searchOp, {
  strategy: "restartable", // new call cancels the previous in-flight request
  retry: { attempts: 2, backoff: Duration.milliseconds(300) },
});

search.subscribe((state) => {
  if (Op.isPending(state)) showSpinner();
  if (Op.isRetrying(state)) showSpinner(`retrying… attempt ${state.attempt}`);
  if (Op.isOk(state)) showResults(state.value);
  if (Op.isErr(state)) showError(state.error);
});

input.addEventListener("input", (e) => search.run(e.currentTarget.value));
```

**Form submit — drop concurrent duplicate submissions:**

```ts
const submitOp = Op.create(
  (signal) => (data: FormData) =>
    fetch("/orders", { method: "POST", body: data, signal }).then((r) =>
      r.json()
    ),
  (e) => new ApiError(e),
);

const submit = Op.interpret(submitOp, {
  strategy: "exclusive", // in-flight? new calls are dropped immediately
});

submit.subscribe((state) => {
  submitButton.disabled = Op.isPending(state);
  if (Op.isOk(state)) showConfirmation(state.value);
  if (Op.isErr(state)) showError(state.error);
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  submit.run(new FormData(form)); // double-clicks and rage-clicks are ignored
});
```

The system supports a variety of built-in strategies — `restartable`, `exclusive`, `debounced`,
`throttled`, `queue`, `buffered`, `concurrent`, `keyed`, and `once`.

### Event streaming, sequence funnels, and queue safety

Decoupling event producers from stateful event consumers often leads to untyped event emitters or
recursive call stack crashes during event cascades. `Stream` models in-memory event pipelines with
typed message schemas, multi-step sequence pattern matching, and causal FIFO queue dispatching:

```ts
import { Stream } from "@nlozgachev/pipelined/core";

type UserFlowMessages = {
  sessionStarted: { sessionId: string };
  stepCompleted: { stepName: string };
  flowFinished: { totalTimeMs: number };
  flowCancelled: { reason: string };
};

const flowStream = Stream.make<UserFlowMessages>();

// Pattern-match the complete multi-step funnel
const sub = Stream.listen(
  flowStream,
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

// Emit typed messages to the stream
Stream.emit(flowStream, {
  kind: "sessionStarted",
  value: { sessionId: "sess-101" },
});

Stream.emit(flowStream, {
  kind: "stepCompleted",
  value: { stepName: "onboarding" },
});

Stream.emit(flowStream, {
  kind: "flowFinished",
  value: { totalTimeMs: 4200 },
});

sub.getState(); // { completedFlows: 1 }
```

`Stream` executes cascading events iteratively using an internal queue with O(1) stack overhead,
completely preventing stack overflow crashes and out-of-order re-entrant execution.

### Deep immutable updates without spread boilerplate

Modifying deeply nested properties in state trees normally requires tedious spread syntax. `Lens`
and `Optional` turn nested paths into first-class values:

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

### Nominal type safety and security boundaries

TypeScript's structural typing allows accidental parameter swapping (such as passing an `OrderId`
into a `UserId` slot). `Brand` creates nominal types with smart constructor validation gates at zero
runtime cost:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Result } from "@nlozgachev/pipelined/core";
import { Brand } from "@nlozgachev/pipelined/types";

type UserId = Brand<"UserId", string>;
type OrderId = Brand<"OrderId", string>;
type Email = Brand<"Email", string>;

const parseEmail = (raw: string): Result<string, Email> =>
  raw.includes("@")
    ? Result.make.ok(raw as Email)
    : Result.make.err("Invalid email address");

const sendReceipt = (userId: UserId, orderId: OrderId, email: Email) =>
  `Sent to ${email} for order ${orderId} by user ${userId}`;

const user = "usr_100" as UserId;
const order = "ord_500" as OrderId;
const email = parseEmail("alice@example.com");

if (Result.is.ok(email)) {
  sendReceipt(user, order, email.value);
  // Type checker prevents: sendReceipt(order, user, email.value)
}
```

---

## Quick Reference

| Problem to Solve                                              | Module                        | Import Path                         |
| ------------------------------------------------------------- | ----------------------------- | ----------------------------------- |
| Optional values without `null` / `undefined` checks           | `Maybe`                       | `@nlozgachev/pipelined/core`        |
| Synchronous typed errors without `try`/`catch`                | `Result`                      | `@nlozgachev/pipelined/core`        |
| Multi-field form and batch validation error accumulation      | `Validation`                  | `@nlozgachev/pipelined/core`        |
| Lazy async workflows with automatic `AbortSignal`             | `Task.Result`, `Task`         | `@nlozgachev/pipelined/core`        |
| Infallible async return container for tasks                   | `Deferred`                    | `@nlozgachev/pipelined/core`        |
| Eliminating impossible UI loading/error/data states           | `RemoteData`                  | `@nlozgachev/pipelined/core`        |
| Managing request race conditions, retries, and locks          | `Op`                          | `@nlozgachev/pipelined/core`        |
| In-memory event streaming, sequence funnels & queue safety    | `Stream`                      | `@nlozgachev/pipelined/core`        |
| Deep nested immutable updates without spread boilerplate      | `Lens`, `Optional`            | `@nlozgachev/pipelined/core`        |
| Implicit dependency injection without prop drilling           | `Reader`                      | `@nlozgachev/pipelined/core`        |
| Pure state transitions, tokenizers, and parsers               | `State`                       | `@nlozgachev/pipelined/core`        |
| Deterministic bracket cleanup (DB pools, file locks)          | `Resource`                    | `@nlozgachev/pipelined/core`        |
| Deferred computation memoized on first access                 | `Lazy`                        | `@nlozgachev/pipelined/core`        |
| Pure calculation audit trails and decision logging            | `Logged`                      | `@nlozgachev/pipelined/core`        |
| Inclusive-OR data modeling and two-way sync diffs             | `These`                       | `@nlozgachev/pipelined/core`        |
| Deep structural equality & React component memoization        | `Equality`                    | `@nlozgachev/pipelined/core`        |
| Multi-column table sorting with tiebreakers                   | `Ordering`                    | `@nlozgachev/pipelined/core`        |
| Composable boolean filter pipelines & authorization policies  | `Predicate`                   | `@nlozgachev/pipelined/core`        |
| Runtime type narrowing & custom type guard composition        | `Refinement`                  | `@nlozgachev/pipelined/core`        |
| Merging configurations & metric structures (Monoids)          | `Combinable`                  | `@nlozgachev/pipelined/core`        |
| Strongly-typed immutable pair manipulation                    | `Tuple`                       | `@nlozgachev/pipelined/core`        |
| Point-free, bounds-safe array transformations                 | `Arr`, `Arr.NonEmpty`         | `@nlozgachev/pipelined/data`        |
| Type-safe object manipulation & key migration                 | `Rec`, `Rec.NonEmpty`         | `@nlozgachev/pipelined/data`        |
| Insertion-ordered maps with non-string keys                   | `Dict`, `Dict.NonEmpty`       | `@nlozgachev/pipelined/data`        |
| Immutable sets & role/permission algebra                      | `Uniq`                        | `@nlozgachev/pipelined/data`        |
| String sanitization, numeric conversion & slug parsing        | `Str`                         | `@nlozgachev/pipelined/data`        |
| Boundary clamping & division-by-zero protection               | `Num`                         | `@nlozgachev/pipelined/data`        |
| Financial ledger arithmetic without float precision drift     | `BigNum`                      | `@nlozgachev/pipelined/data`        |
| Safe JSON parsing & circular reference protection             | `Json`                        | `@nlozgachev/pipelined/data`        |
| Nominal typing & security boundary gates                      | `Brand`                       | `@nlozgachev/pipelined/types`       |
| Explicit, unit-safe time spans & timeout policies             | `Duration`, `RetryPolicy`     | `@nlozgachev/pipelined/types`       |
| Left-to-right value pipeline execution                        | `pipe`                        | `@nlozgachev/pipelined/composition` |
| Left-to-right and right-to-left function composition          | `flow`, `compose`             | `@nlozgachev/pipelined/composition` |
| Currying, uncurrying, and argument flipping                   | `curry`, `uncurry`, `flip`    | `@nlozgachev/pipelined/composition` |
| Multi-branch argument routing and combining                   | `converge`, `juxt`, `on`      | `@nlozgachev/pipelined/composition` |
| Pure function memoization, predicates & pipeline side-effects | `memoize`, `tap`, `not`, `fn` | `@nlozgachev/pipelined/composition` |

---

## Package Architecture and Performance

`pipelined` is structured into 4 isolated, tree-shakeable entry points:

- **`@nlozgachev/pipelined/core`**: Core context containers, async runtimes, optics, and logic
  abstractions (<16 KB gzipped).
- **`@nlozgachev/pipelined/data`**: Curried, data-last utilities for collections, numbers, strings,
  and JSON (<10 KB gzipped).
- **`@nlozgachev/pipelined/composition`**: Pure higher-order function combinators (`pipe`, `flow`,
  `compose`, `curry`, `uncurry`, `converge`, `juxt`, `memoize`, `tap`, `on`, `not`, `flip`, `fn`)
  (<3 KB gzipped).
- **`@nlozgachev/pipelined/types`**: Type-level utilities (`Brand`, `Duration`, `RetryPolicy`) (<700
  B gzipped).

Every utility in the library is benchmarked against its native equivalent. While currying introduces
a small function call overhead for composability, the library uses custom algorithms for
data-structure methods whenever the native JavaScript implementations are slower, ensuring the
fastest execution path possible.

## License

BSD-3-Clause
