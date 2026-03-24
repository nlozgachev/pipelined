# pipelined

[![npm](https://img.shields.io/npm/v/@nlozgachev/pipelined?style=for-the-badge&color=000&logo=npm&label&logoColor=fff)](https://www.npmjs.com/package/@nlozgachev/pipelined)[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/nlozgachev/pipelined/publish.yml?style=for-the-badge&color=000&logo=githubactions&label&logoColor=fff)](https://github.com/nlozgachev/pipelined/actions/workflows/publish.yml)[![Codecov](https://img.shields.io/codecov/c/github/nlozgachev/pipelined?style=for-the-badge&color=000&logo=codecov&label&logoColor=fff)](https://app.codecov.io/github/nlozgachev/pipelined)[![TypeScript](https://img.shields.io/badge/-0?style=for-the-badge&color=000&logo=typescript&label&logoColor=fff)](https://www.typescriptlang.org)

Opinionated functional abstractions for TypeScript.

> **Note:** pipelined is pre-1.0. The API may change between minor versions until the 1.0 release.

```sh
npm add @nlozgachev/pipelined
```

## What is this?

A toolkit for expressing uncertainty precisely. Instead of `T | null`, `try/catch`, and loading
state flag soup, you get types that name every possible state and make invalid ones unrepresentable.
Each type comes with a consistent set of operations — `map`, `chain`, `match`, `getOrElse` — that
compose with `pipe` and `flow`.

## What's included?

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
- **`Num`** — number utilities: `range`, `clamp`, `between`, safe `parse`, and curried arithmetic.
- **`Str`** — string utilities: `split`, `trim`, `words`, `lines`, and safe `parse.int` / `parse.float`.

### pipelined/types

- **`Brand<K, T>`** — nominal typing at compile time, zero runtime cost.
- **`NonEmptyList<A>`** — an array guaranteed to have at least one element.

### pipelined/composition

- **`pipe`**, **`flow`**, **`compose`** — function composition.
- **`curry`** / **`uncurry`**, **`tap`**, **`memoize`**, and other function utilities.

## Example

```ts
import { TaskResult } from "@nlozgachev/pipelined/core";
import { pipe } from "@nlozgachev/pipelined/composition";

// Typed errors. Lazy. Composable.
const getUser = (id: string): TaskResult<string, User> =>
  pipe(
    TaskResult.tryCatch(
      () => fetch(`/users/${id}`).then((r) => r.json() as Promise<User>),
      (e) => `fetch failed: ${e}`,
    ),
    TaskResult.timeout(5_000, () => "request timed out"),
    TaskResult.retry({ attempts: 3, backoff: (n) => n * 1_000 }),
  );

// Poll until a background job finishes — stop immediately on failure
const waitForExport = (jobId: string): TaskResult<string, ExportResult> =>
  pipe(
    TaskResult.tryCatch(
      () => fetch(`/exports/${jobId}`).then((r) => r.json() as Promise<Job>),
      String,
    ),
    TaskResult.pollUntil({
      when: (job) => job.status === "done",
      delay: (n) => n * 500,  // 500 ms, 1 s, 1.5 s, ...
    }),
    TaskResult.map((job) => job.result),
  );

// Compose the two — nothing runs until the final call
const message = await pipe(
  getUser("abc"),
  TaskResult.chain((user) => waitForExport(user.exportId)),
  TaskResult.match({
    ok:  (r) => `Export ready: ${r.url}`,
    err: (e) => `Failed: ${e}`,
  }),
)();
```

## Documentation

Full guides and API reference at **[pipelined.lozgachev.dev](https://pipelined.lozgachev.dev)**.

## License

BSD-3-Clause
