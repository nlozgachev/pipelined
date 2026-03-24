# pipelined

[![npm](https://img.shields.io/npm/v/@nlozgachev/pipelined?style=for-the-badge&color=000&logo=npm&label&logoColor=fff)](https://www.npmjs.com/package/@nlozgachev/pipelined)[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/nlozgachev/pipelined/publish.yml?style=for-the-badge&color=000&logo=githubactions&label&logoColor=fff)](https://github.com/nlozgachev/pipelined/actions/workflows/publish.yml)[![Codecov](https://img.shields.io/codecov/c/github/nlozgachev/pipelined?style=for-the-badge&color=000&logo=codecov&label&logoColor=fff)](https://app.codecov.io/github/nlozgachev/pipelined)[![TypeScript](https://img.shields.io/badge/-0?style=for-the-badge&color=000&logo=typescript&label&logoColor=fff)](https://www.typescriptlang.org)

Opinionated functional abstractions for TypeScript.

> **Note:** pipelined is pre-1.0. The API may change between minor versions until the 1.0 release.

```sh
npm add @nlozgachev/pipelined
```

## Possibly maybe

**pipelined** names every possible state and gives you operations that compose. `Maybe<A>` for values
that may or may not be there. `Result<E, A>` for operations that succeed or fail
with a typed error. `TaskResult<E, A>` for async operations that do both — lazily, with retry,
timeout, and cancellation built in. And, of course, there is more than that.

## Documentation

Full guides and API reference at **[pipelined.lozgachev.dev](https://pipelined.lozgachev.dev)**.

## Example

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
distinguished from external cancellation by checking `signal?.aborted`. The retry is recursive
to thread the attempt count.

With **pipelined**:

```ts
import { TaskResult, Result } from "@nlozgachev/pipelined/core";
import { pipe } from "@nlozgachev/pipelined/composition";

const fetchUser = (id: string): TaskResult<ApiError, User> =>
  pipe(
    TaskResult.tryCatch(
      (signal) => fetch(`/users/${id}`, { signal }).then((r) => r.json()),
      (e) => new ApiError(e),
    ),
    TaskResult.timeout(5000, () => new ApiError("request timed out")),
    TaskResult.retry({ attempts: 3, backoff: (n) => n * 1000 }),
  );
```

`TaskResult<ApiError, User>` is a lazy function — nothing runs until called. The `AbortSignal`
threads through every retry and the timeout automatically. The return type is the contract:
`ApiError` on the left, `User` on the right, nothing escapes as an exception.

```ts
const controller = new AbortController();
const result = await fetchUser("42")(controller.signal);

if (Result.isOk(result)) {
  render(result.value); // User
} else {
  showError(result.error); // ApiError, not unknown
}
```

## What's included?

`TaskResult` is one type. The library also covers the rest of the states you encounter in real
applications: values that may be absent, operations that accumulate multiple errors, data that moves
through `NotAsked >> Loading >> ( Success | Failure )`, nested immutable updates, and computations that
share a common environment. Every type follows the same conventions — `map`, `chain`, `match`,
`getOrElse` — so moving between them feels familiar.

### pipelined/core

- **`Maybe<A>`** — a value that may not exist; propagates absence without null checks.
- **`Result<E, A>`** — an operation that succeeds or fails with a typed error.
- **`Validation<E, A>`** — like `Result`, but accumulates every failure instead of stopping at the
  first.
- **`Task<A>`** — a lazy, infallible async operation; nothing runs until called.
- **`TaskResult<E, A>`** — a lazy async operation that can fail with a typed error.
- **`TaskMaybe<A>`** — a lazy async operation that may produce nothing.
- **`TaskValidation<E, A>`** — a lazy async operation that accumulates validation errors.
- **`These<E, A>`** — an inclusive OR: holds an error, a value, or both at once.
- **`RemoteData<E, A>`** — the four states of a data fetch: `NotAsked`, `Loading`, `Failure`,
  `Success`.
- **`Lens<S, A>`** — focus on a required field in a nested structure. Read, set, and modify
  immutably.
- **`Optional<S, A>`** — like `Lens`, but the target may be absent (nullable fields, array indices).
- **`Reader<R, A>`** — a computation that depends on an environment `R`, supplied once at the
  boundary.


### pipelined/utils

Everyday utilities for built-in JS types.

- **`Arr`** — array utilities, data-last, returning `Maybe` instead of `undefined`.
- **`Rec`** — record/object utilities, data-last, with `Maybe`-returning key lookup.
- **`Dict`** — `ReadonlyMap<K, V>` utilities: `lookup`, `groupBy`, `upsert`, set operations.
- **`Uniq`** — `ReadonlySet<A>` utilities: `insert`, `remove`, `union`, `intersection`, `difference`.
- **`Num`** — number utilities: `range`, `clamp`, `between`, safe `parse`, and curried arithmetic.
- **`Str`** — string utilities: `split`, `trim`, `words`, `lines`, and safe `parse.int` / `parse.float`.

Every utility is benchmarked against its native equivalent. The data-last currying adds a function
call; that is the expected cost of composability. Operations that exceeded a reasonable overhead
have custom implementations that in several cases run faster than the native method they replace. See the
[benchmarks page](https://pipelined.lozgachev.dev/appendix/benchmarks) for the methodology.

### pipelined/types

- **`Brand<K, T>`** — nominal typing at compile time, zero runtime cost.
- **`NonEmptyList<A>`** — an array guaranteed to have at least one element.

### pipelined/composition

- **`pipe`**, **`flow`**, **`compose`** — function composition.
- **`curry`** / **`uncurry`**, **`tap`**, **`memoize`**, and other function utilities.




## License

BSD-3-Clause
