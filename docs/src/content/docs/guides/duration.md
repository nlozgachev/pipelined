---
title: Duration -- type-safe time
description: A branded numeric type for durations, preventing unit-mismatch bugs at compile time.
---

A function expects milliseconds. You pass seconds. The timer fires a thousand times too fast, the
animation stutters, or a timeout expires instantly. The values are all plain `number`, so TypeScript
has no way to flag the mistake. `Duration` wraps a `number` in a compile-time brand that makes the
unit explicit and the conversions safe.

## The problem with raw numbers

```ts
function delay(ms: number): Promise<void> { ... }

const timeout = 5; // seconds? milliseconds? minutes?
delay(timeout);    // compiles, probably wrong
```

Both `timeout` and `ms` are `number`. Nothing prevents you from passing a value in the wrong unit.
The bug surfaces at runtime -- often intermittently, depending on how far off the scale is.

## Creating a Duration

Every constructor returns a `Duration` whose internal representation is always milliseconds. You
never need to think about the internal unit -- just pick the constructor that matches your intent:

```ts
import { Duration } from "@nlozgachev/pipelined/types";

const halfSecond  = Duration.milliseconds(500);
const twoSeconds  = Duration.seconds(2);
const fiveMinutes = Duration.minutes(5);
const oneHour     = Duration.hours(1);
const oneDay      = Duration.days(1);
```

Because `Duration` is a branded `number`, TypeScript will reject a raw `number` where a `Duration`
is expected:

```ts
declare function sleep(d: Duration): Promise<void>;

sleep(1000);                      // Type error -- number is not Duration
sleep(Duration.milliseconds(1000)); // OK
```

## Reading a Duration

Unwrappers convert a `Duration` back to a plain `number` in the unit you choose:

```ts
const d = Duration.minutes(1.5);

Duration.toMilliseconds(d); // 90000
Duration.toSeconds(d);      // 90
Duration.toMinutes(d);      // 1.5
Duration.toHours(d);        // 0.025
Duration.toDays(d);         // ~0.00104
```

## Arithmetic

`add` and `subtract` are curried and data-last, so they compose naturally in `pipe`:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

const requestTimeout = Duration.seconds(30);
const networkLatency = Duration.milliseconds(200);

const total    = pipe(requestTimeout, Duration.add(networkLatency));
const adjusted = pipe(total, Duration.subtract(Duration.seconds(5)));

Duration.toSeconds(total);    // 30.2
Duration.toSeconds(adjusted); // 25.2
```

## Composing with Task

`Task.delay`, `Task.timeout`, `Task.repeat`, and `Task.repeatUntil` all accept `number | Duration`.
When you pass a `Duration`, the intent is self-documenting and the compiler guards against unit
errors:

```ts
import { Task } from "@nlozgachev/pipelined/core";

pipe(
  Task.resolve("ready"),
  Task.delay(Duration.seconds(1))    // clear: one second
);

pipe(
  slowComputation,
  Task.timeout(Duration.seconds(5), () => "timed out")
);

pipe(
  pollSensor,
  Task.repeat({ times: 10, delay: Duration.milliseconds(500) })
);
```

## Pipe composition

```ts
const retryDelay  = Duration.seconds(1);
const maxDuration = Duration.minutes(2);

const budget = pipe(
  maxDuration,
  Duration.subtract(Duration.seconds(10)),   // leave a margin
  Duration.add(retryDelay),                  // account for one retry
);

Duration.toSeconds(budget); // 111
```

## When to use Duration

Reach for `Duration` whenever a function accepts a time value:

- **Timeouts and delays** -- `Task.delay`, `Task.timeout`, HTTP timeouts, animation durations.
- **Interval configuration** -- polling periods, debounce windows, rate-limit buckets.
- **Domain modelling** -- subscription periods, cache TTLs, SLA thresholds.

If your function currently takes `ms: number`, switching to `ms: number | Duration` is backward
compatible -- existing callers that pass a raw number still work, while new callers can opt into the
branded version for stronger guarantees.
