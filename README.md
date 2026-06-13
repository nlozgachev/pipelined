# pipelined

[![npm](https://img.shields.io/npm/v/@nlozgachev/pipelined?style=for-the-badge&color=000&logo=npm&label&logoColor=fff)](https://www.npmjs.com/package/@nlozgachev/pipelined)
[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/nlozgachev/pipelined/publish.yml?style=for-the-badge&color=000&logo=githubactions&label&logoColor=fff)](https://github.com/nlozgachev/pipelined/actions/workflows/publish.yml)
[![Codecov](https://img.shields.io/codecov/c/github/nlozgachev/pipelined?style=for-the-badge&color=000&logo=codecov&label&logoColor=fff)](https://app.codecov.io/github/nlozgachev/pipelined)

Opinionated functional abstractions for TypeScript.

> **Note:** pipelined is pre-1.0. The API may change between minor versions until the 1.0 release.

```sh
npm add @nlozgachev/pipelined
```

## Possibly maybe

In mainstream TypeScript, code is often burdened by implicit control flow: unchecked exceptions,
manual null propagation, and unhandled asynchronous failures. `pipelined` turns these complex
runtime states into simple, transparent data structures that compose. By representing optionality as
`Maybe`, failures as `Result`, lazy asynchronous pipelines as `Task.Result`, and repeated stateful
interactions as `Op`, the library helps disentangle business logic from control mechanics.

## Documentation

Full guides and API reference at **[pipelined.lozgachev.dev](https://pipelined.lozgachev.dev)**.

## Example: composing optional values

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
    Num.parse, // "10" → Some(10), "abc" → None
    Maybe.filter((n) => n >= 0 && n <= 100), // out of range → None
    Maybe.map((n) => `${n}% off`),
    Maybe.getOrElse(() => "No discount"),
  );

parseDiscount("  15  "); // "15% off"
parseDiscount("150"); // "No discount"
parseDiscount("abc"); // "No discount"
```

Every step that sees `None` is skipped. The fallback runs once, at the end.

## Example: typed async errors

In JavaScript, asynchronous exceptions bypass the static type system, leaving unhandled rejections
as invisible runtime risks. `Task.Result<E, A>` represents fallible asynchronous computations as
lazy, infallible tasks that resolve to a typed `Result`. The error type is explicitly tracked in the
function signature, ensuring that failures are handled before compile time:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Result, Task } from "@nlozgachev/pipelined/core";

type ApiError = { status: number; message: string };

const fetchUser = (id: string): Task.Result<ApiError, User> =>
  Task.Result.tryCatch(
    (signal) =>
      fetch(`/users/${id}`, { signal }).then((r) => {
        if (!r.ok) throw { status: r.status, message: r.statusText };
        return r.json() as Promise<User>;
      }),
    (e) => e as ApiError,
  );

const fetchPosts = (userId: string): Task.Result<ApiError, Post[]> =>
  Task.Result.tryCatch(
    (signal) =>
      fetch(`/users/${userId}/posts`, { signal }).then((r) => r.json()),
    (e) => e as ApiError,
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

if (Result.isOk(result)) {
  render(result.value); // { ...User, posts: Post[] }
} else {
  showError(result.error); // ApiError — typed, not unknown
}
```

## Example: transforming data

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

## Example: retry, timeout, and cancellation

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

## Example: repeated UI interactions

User interfaces frequently trigger repeated asynchronous events: a search input firing on every
keystroke, a submit button clicked multiple times, or a polling loop that must terminate when a
newer request starts. Managing these concurrency scenarios traditionally requires complex, ad-hoc
state machines. `Op` simplifies this by allowing developers to declare the concurrency strategy as a
simple configuration choice:

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
  strategy: "restartable", // new call cancels the previous one
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

**Form submit — drop concurrent submissions:**

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
`throttled`, `queue`, `buffered`, `concurrent`, `keyed`, and `once` — making the integration of
complex async scenarios highly predictable.

## What is included

The library covers the full spectrum of state and control flow scenarios encountered in production
applications.

### Core context containers

`Maybe` represents explicit optionality without null checks. `Result` handles synchronous, typed
success and failure, while `Validation` accumulates multiple errors. `RemoteData` tracks the four
states of an asynchronous data fetch (`NotAsked`, `Loading`, `Failure`, `Success`), `These` handles
inclusive-OR scenarios containing a first value, a second, or both simultaneously, and `Tuple`
provides a strongly-typed, immutable two-element pair.

### Asynchronous operations

`Task` represents a lazy, infallible asynchronous computation. Fallible asynchronous workflows are
handled by `Task.Result`, `Task.Maybe`, and `Task.Validation`. For managing stateful, recurring
asynchronous operations with complex scheduling, `Op` implements named concurrency strategies such
as `restartable`, `exclusive`, `debounced`, `throttled`, and `queue`, handling retries, timeouts,
and signal propagation automatically. `Deferred` represents a lightweight, infallible asynchronous
value that is guaranteed to always resolve without rejection.

### Optics and environment state

`Lens` and `Optional` provide a simple concrete interface for safe, nested immutable data updates.
Environment-dependent calculations and explicit state threading are supported by the `Reader` and
`State` abstractions, while `Logged` enables side-effect-free data logging, and `Lazy` implements
synchronous memoized thunks.

### Algebraic and logic abstractions

For general type-safe comparisons and algebraic operations, the library includes `Equality` for
composable object and primitive comparisons, `Ordering` for sorting comparators, and `Combinable`
for structural monoids (allowing folding collections with a neutral starting point). Composable
boolean checks and type guards are supported by `Predicate` and `Refinement` abstractions.

### Optimized utilities

Custom, performance-optimized utility modules (`Arr`, `Rec`, `Dict`, `Uniq`, `Num`, `Str`) wrap
standard JavaScript types to return explicit types like `Maybe` and support data-last currying.
Functions are composed using `pipe` and `flow`, which are enriched with high-level composition
helpers like `when`, `unless`, `either`, `safe`, and `async` to support robust, expressive
pipelines.

### Nominal branding, durations, and non-empty collections

Compile-time nominal typing with zero runtime overhead is provided by `Brand`. `Duration` safely
models and converts time durations (seconds, milliseconds, etc.). `Arr.NonEmpty` and `Rec.NonEmpty`
guarantee that an array or record is never empty, eliminating defensive length/emptiness checks at
runtime.

Every utility in the library is benchmarked against its native equivalent. The data-last currying
adds a small function call overhead, which is the expected cost of composability. For operations
where native overhead is significant, custom implementations are used that often run faster than
their native counterparts.

## License

BSD-3-Clause
