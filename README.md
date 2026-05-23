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

**pipelined** names every possible state and gives you operations that compose. `Maybe<A>` for
values that may or may not be there. `Result<E, A>` for operations that succeed or fail with a typed
error. `TaskResult<E, A>` for async operations that keep failures as typed values and propagate
cancellation automatically. `Op<I, E, A>` for managing repeated async interactions — retry, timeout,
and concurrency strategy in one place. And, of course, there is more than that.

## Documentation

Full guides and API reference at **[pipelined.lozgachev.dev](https://pipelined.lozgachev.dev)**.

## Example: composing optional values

`null` checks accumulate fast. Each one is a conditional branch that the type system can't help you
forget. `Maybe<A>` turns absence into a value that composes — the same operations apply whether or
not anything is there:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";
import { Num, Str } from "@nlozgachev/pipelined/utils";

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

Unhandled rejections are invisible until they crash. `TaskResult<E, A>` keeps failures as typed
values — the error type is part of the signature, not a runtime surprise.

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Result, TaskResult } from "@nlozgachev/pipelined/core";

type ApiError = { status: number; message: string };

const fetchUser = (id: string): TaskResult<ApiError, User> =>
  TaskResult.tryCatch(
    (signal) =>
      fetch(`/users/${id}`, { signal }).then((r) => {
        if (!r.ok) throw { status: r.status, message: r.statusText };
        return r.json() as Promise<User>;
      }),
    (e) => e as ApiError,
  );

const fetchPosts = (userId: string): TaskResult<ApiError, Post[]> =>
  TaskResult.tryCatch(
    (signal) =>
      fetch(`/users/${userId}/posts`, { signal }).then((r) => r.json()),
    (e) => e as ApiError,
  );

// Chain two requests — the AbortSignal propagates to both automatically
const userWithPosts = (id: string) =>
  pipe(
    fetchUser(id),
    TaskResult.chain((user) =>
      pipe(
        fetchPosts(user.id),
        TaskResult.map((posts) => ({ ...user, posts })),
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

The utils modules wrap JavaScript's built-in types with data-last, curried operations that return
`Maybe` wherever a value might be absent. They compose naturally with the core types:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";
import { Arr, Num, Rec, Str } from "@nlozgachev/pipelined/utils";

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
    Arr.groupBy((item) => item.category), // Record<string, NonEmptyList<Item>>
    Rec.map((group) => Arr.head(group)), // cheapest per category — Maybe<Item>
  );
```

`filterMap` applies a function that returns `Maybe` and collects only the `Some` results — one step
replaces a `map` followed by a `filter`. `Arr.head` returns `Maybe<Item>` rather than
`Item | undefined`, so the absence is explicit in the type and the rest of the pipeline handles it
the same way.

## Example: retry, timeout, and cancellation

A careful, production-minded attempt at "fetch with retry, timeout, and cancellation":

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

The signal is forwarded by hand. The timeout needs its own controller. Timed-out aborts are
distinguished from external cancellation by checking `signal?.aborted`. The retry is recursive to
thread the attempt count.

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

## Example: repeated interactions

Real UIs make the same call many times — a search input fires on every keystroke, a submit button
gets clicked twice, a polling loop needs to stop when something newer starts. Each scenario has a
different answer to the same question: *what happens to the previous call when a new one arrives?*

`Op` makes that question a one-word configuration choice.

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

`restartable`, `exclusive`, `debounced`, `throttled`, `queue`, `buffered`, `concurrent`, `keyed`,
`once` — each strategy is a complete, tested answer to one concurrency scenario. Swap the word, keep
the rest of the code.

## What's included?

The library covers the states you encounter in real applications: values that may be absent,
operations that accumulate multiple errors, data that moves through
`NotAsked >> Loading >> ( Success | Failure )`, async interactions with concurrency policies, nested
immutable updates, and computations that share a common environment. Every type follows the same
conventions — `map`, `chain`, `match`, `getOrElse` — so moving between them feels familiar.

### pipelined/core

- **`Maybe<A>`** — a value that may not exist; propagates absence without null checks.
- **`Result<E, A>`** — an operation that succeeds or fails with a typed error.
- **`Validation<E, A>`** — like `Result`, but accumulates every failure instead of stopping at the
  first.
- **`Task<A>`** — a lazy, infallible async operation; nothing runs until called.
- **`TaskResult<E, A>`** — a lazy async operation that can fail with a typed error.
- **`TaskMaybe<A>`** — a lazy async operation that may produce nothing.
- **`TaskValidation<E, A>`** — a lazy async operation that accumulates validation errors.
- **`Op<I, E, A>`** — a managed async operation with a named concurrency strategy: `restartable`,
  `exclusive`, `debounced`, `throttled`, `queue`, `buffered`, `concurrent`, `keyed`, or `once`.
  Handles retry, timeout, cancellation, and state in one place.
- **`RemoteData<E, A>`** — the four states of a data fetch: `NotAsked`, `Loading`, `Failure`,
  `Success`.
- **`These<A, B>`** — an inclusive OR: holds a first value, a second, or both at once.
- **`Lens<S, A>`** — focus on a required field in a nested structure. Read, set, and modify
  immutably.
- **`Optional<S, A>`** — like `Lens`, but the target may be absent (nullable fields, array indices).
- **`Reader<R, A>`** — a computation that depends on an environment `R`, supplied once at the
  boundary.
- **`State<S, A>`** — a computation that reads and updates a state value, threaded explicitly
  through the chain.
- **`Logged<W, A>`** — a computation that accumulates a log alongside its value; no console output,
  just data.
- **`Predicate<A>`** — a typed boolean function, composable with `and`, `or`, `not`, and `using`.
- **`Refinement<A, B>`** — a type predicate that narrows `A` to `B` at runtime; composes with
  `Predicate`.
- **`Resource<E, A>`** — an acquire/release pair for safe resource management in `TaskResult`
  pipelines.
- **`Deferred<A>`** — an infallible async value: a thenable that always resolves, never rejects.
- **`Tuple<A, B>`** — a typed pair with `first`, `second`, `map`, `swap`, and `fold`.

### pipelined/utils

Everyday utilities for built-in JS types.

- **`Arr`** — array utilities, data-last, returning `Maybe` instead of `undefined`.
- **`Rec`** — record/object utilities, data-last, with `Maybe`-returning key lookup.
- **`Dict`** — `ReadonlyMap<K, V>` utilities: `lookup`, `groupBy`, `upsert`, set operations.
- **`Uniq`** — `ReadonlySet<A>` utilities: `insert`, `remove`, `union`, `intersection`,
  `difference`.
- **`Num`** — number utilities: `range`, `clamp`, `between`, safe `parse`, and curried arithmetic.
- **`Str`** — string utilities: `split`, `trim`, `words`, `lines`, and safe `parse.int` /
  `parse.float`.

Every utility is benchmarked against its native equivalent. The data-last currying adds a function
call; that is the expected cost of composability. Operations that exceeded a reasonable overhead
have custom implementations that in several cases run faster than the native method they replace.
See the [benchmarks page](https://pipelined.lozgachev.dev/appendix/benchmarks) for the methodology.

### pipelined/types

- **`Brand<K, T>`** — nominal typing at compile time, zero runtime cost.
- **`NonEmptyList<A>`** — an array guaranteed to have at least one element.

### pipelined/composition

- **`pipe`**, **`flow`**, **`compose`** — function composition.
- **`curry`** / **`uncurry`**, **`tap`**, **`memoize`**, and other function utilities.

## License

BSD-3-Clause
