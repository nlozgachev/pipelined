---
title: Duration — Type-Safe Time
description: A branded, compile-time type-safe representation of time quantities to prevent unit-mismatch bugs.
---

<!-- BUNDLE_SIZE:START -->

> 153 B minified + gzipped

<!-- BUNDLE_SIZE:END -->

Modeling time quantities as raw `number` primitives introduces silent unit-mismatch bugs (such as
passing seconds to a function expecting milliseconds). Because both values are typed as `number`,
TypeScript cannot catch the error at compile time.

`Duration` provides a branded, unit-safe representation of time with explicit constructors
(`Duration.seconds`, `Duration.milliseconds`) and conversion helpers.

## The problem with primitive numbers for time

Consider a typical background worker that retries failed requests with a customizable timeout and
delay:

```ts
// What unit is expected here? Seconds? Milliseconds?
function configureTimeout(timeout: number, retryDelay: number) {
  // ...
}

const defaultTimeout = 30; // Seconds?
const defaultRetry = 500;  // Milliseconds?

configureTimeout(defaultTimeout, defaultRetry);
```

Nothing prevents a developer from swapping these arguments or passing the wrong scale. The compiler
happily accepts `configureTimeout(30, 500)`, even if the function internally treats both arguments
as milliseconds (making the timeout a practically instant 30 milliseconds).

To fix this defensively, developers often append unit suffixes to variable names (e.g.,
`timeoutMs`), but this is a convention that relies entirely on human memory and is easily bypassed.

## The shift to branded time quantities

`Duration` changes this by raising time from a generic primitive to a distinct, branded type. At
runtime, a `Duration` is represented purely as a standard number of milliseconds, carrying **zero
runtime overhead**.

At compile time, however, the nominal type brand prevents it from being mixed with generic numbers
or other units.

```mermaid
flowchart TB
    A["Raw Number (1)"] -->|"Duration.seconds(1)"| B["Duration (1000ms, Branded)"]
    B -->|"Passed to Task.delay"| C["Safe, Type-Checked Delay"]
    A -->|"Passed to Task.delay"| D["Compile Error: Type 'number' is not assignable to 'Duration'"]
```

## Creating Durations

We construct a `Duration` by calling the constructor that matches our mental model of the time
quantity. The internal representation is normalized to milliseconds automatically:

```ts
import { Duration } from "@nlozgachev/pipelined/types";

const halfSecond  = Duration.milliseconds(500);
const threeSeconds = Duration.seconds(3);
const tenMinutes   = Duration.minutes(10);
const twelveHours  = Duration.hours(12);
const oneDay       = Duration.days(1);
```

Once branded, TypeScript will reject any attempt to pass a raw number where a `Duration` is
expected:

```ts
declare function sleep(duration: Duration): Promise<void>;

// @ts-expect-error: Argument of type 'number' is not assignable to parameter of type 'Duration'
sleep(1000);

// Correct usage:
sleep(Duration.seconds(1));
```

## Converting Durations back to primitives

When interfacing with third-party libraries, native browser APIs, or database drivers that require
plain numbers, we unwrap the `Duration` into the specific unit we need:

```ts
const duration = Duration.hours(36);

Duration.to.milliseconds(duration); // 129600000
Duration.to.seconds(duration);      // 129600
Duration.to.minutes(duration);      // 2160
Duration.to.hours(duration);        // 36
Duration.to.days(duration);         // 1.5
```

## Curried time arithmetic

We can perform arithmetic on durations. `Duration.add` and `Duration.subtract` are curried,
data-last operations that allow us to adjust time quantities cleanly inside a `pipe`:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

const requestTimeout = Duration.seconds(30);
const networkLatency = Duration.milliseconds(200);

// Add network latency and subtract a safety margin
const adjustedTimeout = pipe(
  requestTimeout,
  Duration.add(networkLatency),
  Duration.subtract(Duration.seconds(5))
);

Duration.to.seconds(adjustedTimeout); // 25.2
```

## Deep integration with asynchronous APIs

Within the `pipelined` ecosystem, all core time-sensitive operations strictly require `Duration`
types rather than raw numbers. This guarantees that delays, repeating poll tasks, and timeouts are
safe by default:

```ts
import { Task } from "@nlozgachev/pipelined/core";

// 1. Delaying execution
const delayedTask = pipe(
  Task.make("data"),
  Task.delay(Duration.seconds(2))
);

// 2. Setting a computation timeout
const guardedTask = pipe(
  fetchLargeDataset,
  Task.timeout({ duration: Duration.seconds(10), onTimeout: () => "timeout_error" })
);

// 3. Scheduling a recurring poll
const pollingTask = pipe(
  checkQueueStatus,
  Task.repeat({ times: 5, delay: Duration.milliseconds(500) })
);
```

## Modeling retry backoffs with RetryPolicy

Transient network errors, rate-limited endpoints, and brief database lock contentions often succeed
when retried after a short pause. Rather than scattering ad-hoc retry loops and raw millisecond
multipliers across your services, `RetryPolicy` (from `@nlozgachev/pipelined/types`) pairs with
`Duration` to define reusable, declarative backoff schedules.

`RetryPolicy` offers two constructors:

- `RetryPolicy.constant({ attempts, delay, when?, onRetry? })`: Waits a fixed `Duration` between
  each retry attempt.
- `RetryPolicy.exponential({ attempts, initial, factor?, jitter?, maxDelay?, when?, onRetry? })`:
  Grows the wait duration exponentially after each failure (defaulting to `factor: 2`), with
  optional `maxDelay` capping and randomized `jitter` to prevent synchronized retry spikes
  ("thundering herds") across clients.

```ts
import { Op, Task } from "@nlozgachev/pipelined/core";
import { Duration, RetryPolicy } from "@nlozgachev/pipelined/types";

// 1. Fixed delay between attempts with failure filter and retry telemetry
const fixedRetry = RetryPolicy.constant({
  attempts: 3,
  delay: Duration.seconds(1),
  when: (err: { status: number }) => err.status === 503 || err.status === 429,
  onRetry: ({ attempt, error, delay }) => {
    console.warn(`Retry attempt ${attempt} for status ${error.status} in ${delay.millis}ms`);
  },
});

// 2. Exponential backoff with jitter and an upper ceiling
const backoffPolicy = RetryPolicy.exponential({
  attempts: 5,
  initial: Duration.milliseconds(200),
  factor: 2,
  jitter: true,
  maxDelay: Duration.seconds(10),
});

// 3. Pairing RetryPolicy with Task.Result.retry
const resilientFetch = pipe(
  fetchInvoiceTask,
  Task.Result.retry(fixedRetry),
);

// 4. Pairing RetryPolicy with Op.interpret
const syncInventoryRunner = Op.interpret(syncInventoryOp, {
  strategy: "exclusive",
  retry: backoffPolicy,
});
```

## Problems it solves

- **Eliminating time unit ambiguity in configurations**: When configuring HTTP timeouts, debounce
  intervals, cache TTLs, or retry backoffs, accepting raw numbers forces developers to guess whether
  the function expects seconds or milliseconds. Passing `5` instead of `5000` leads to premature
  timeout failures in production. `Duration` makes time units explicit (`Duration.seconds(5)`,
  `Duration.minutes(10)`).
- **Safe duration arithmetic**: Calculating total timeout budgets or subtracting safety margins
  using raw numbers risks mixing millisecond and second units. `Duration` provides unit-safe
  arithmetic (`Duration.add`, `Duration.subtract`).
- **Declarative retry and backoff strategies (`RetryPolicy`)**: Expressing constant or exponential
  backoff with jitter and maximum delay caps via `RetryPolicy` eliminates manual exponentiation math
  and integrates directly with `Task.Result.retry` and `Op.interpret`.
- **Cache TTL and session expiry policies**: Calculating cache eviction deadlines or token validity
  spans in security middlewares without manual millisecond multiplier math (`Duration.hours(2)`).
- **Unified time modeling across async utilities**: Core asynchronous combinators (such as
  `Task.timeout`, `Task.delay`, and `Op` repeat schedules) enforce `Duration` at the type level,
  establishing a single consistent time model across the entire application.
