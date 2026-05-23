---
title: Logged — Accumulated Logs
description: Pair computations with a log that accumulates automatically as you chain transformations, keeping logging pure, testable, and side-effect-free.
---

Many systems require a record of how a computation arrived at its result: an audit trail of
decisions made by a complex business rules engine, a diagnostic trace of steps inside a data
transformation pipeline, or warning notices gathered during validation.

If we want to keep our code pure and testable, we typically resort to threading a log array
manually:

```ts
// Manual log threading:
function formatUsername(username: string, log: string[]): [string, string[]] {
  const result = username.trim().toLowerCase();
  return [result, [...log, `Normalized: ${username} to ${result}`]];
}
```

This is incredibly noisy. Every single function in the chain must accept the log as a parameter and
forward it, even when the function's core mathematical logic has nothing to do with logging. If you
add or remove a transformation step, you must manually adjust all variable threads.

The typical alternative is to inject a logging framework and call side effects (like `console.log`)
directly mid-function. While this removes parameter noise, it introduces global side effects. Our
functions are no longer pure; they cannot be tested in isolation without mocking the global output
stream, and we cannot programmatically inspect the logs to assert on business rules.

`Logged<W, A>` offers a clean, functional alternative. It is a simple data structure that pairs a
value `A` with an accumulated read-only array of log entries `W`:

```ts
type Logged<W, A> = {
  readonly value: A;
  readonly log: ReadonlyArray<W>;
};
```

Logging is decoupled from execution. The log is treated purely as immutable data. We build our
pipeline step-by-step, letting the logs accumulate automatically, and decide what to do with them
once at the boundary of our program.

---

## Creating Logged Values

To begin logging, we lift our values into `Logged` using its core constructors:

```ts
import { Logged } from "@nlozgachev/pipelined/core";

// Lifting a raw value with an empty log
const start = Logged.make(0); // { value: 0, log: [] }

// Logging a single entry with an empty value
const note = Logged.tell("Initializing calculations"); 
// { value: undefined, log: ["Initializing calculations"] }
```

`Logged.tell` represents the atomic logging block. It writes a single log entry and returns
`undefined` as its value, ready to be sequenced into a pipeline.

---

## Transforming and Sequencing

We can transform the values inside `Logged` and sequence multiple logging steps point-free.

### Transforming values with `map`

`map` transforms the underlying value of a `Logged` container, leaving any accumulated log entries
completely untouched:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

const doubled = pipe(
  Logged.make<string, number>(5),
  Logged.map((n) => n * 2),
); // { value: 10, log: [] }
```

### Sequencing logs with `chain`

`chain` is the key combinator for `Logged`. It passes the value of the current `Logged` container to
your next step, executes the step, and automatically concatenates the log arrays from both steps in
order:

```ts
const program = pipe(
  Logged.make<string, number>(1),
  Logged.chain((n) => pipe(Logged.tell("Incremented value"), Logged.map(() => n + 1))),
  Logged.chain((n) => pipe(Logged.tell("Doubled value"), Logged.map(() => n * 2))),
);

const [value, log] = Logged.run(program);
// value = 4, log = ["Incremented value", "Doubled value"]
```

The intermediate log arrays are stitched together by `chain` itself. Each individual step only
declares its own log entry, fully isolated from the history of the pipeline.

---

## Practical Example: A Business Rules Engine

Consider a discount calculator that applies a series of promotional codes. To audit decisions, each
rule must record its reasoning:

```ts
type DiscountRule = (price: number) => Logged<string, number>;

const applyMemberPromo: DiscountRule = (price) =>
  price > 100
    ? pipe(Logged.tell("Member discount: -10% applied"), Logged.map(() => price * 0.9))
    : pipe(Logged.tell("Member discount: threshold not met"), Logged.map(() => price));

const applyBulkPromo: DiscountRule = (price) =>
  price > 200
    ? pipe(Logged.tell("Bulk discount: -5% applied"), Logged.map(() => price * 0.95))
    : pipe(Logged.tell("Bulk discount: threshold not met"), Logged.map(() => price));

const calculateTotal = (basePrice: number): Logged<string, number> =>
  pipe(
    Logged.make<string, number>(basePrice),
    Logged.chain(applyMemberPromo),
    Logged.chain(applyBulkPromo),
  );

const [finalPrice, auditTrail] = Logged.run(calculateTotal(250));
// finalPrice ≈ 213.75
// auditTrail = ["Member discount: -10% applied", "Bulk discount: -5% applied"]
```

The promotional rules remain completely independent. Neither `applyMemberPromo` nor `applyBulkPromo`
has any knowledge of the other's existence or log records. The audit trail is built automatically
during sequencing.

---

## Extracting Results with run

`Logged.run` unpacks the container and returns the value and accumulated log as a standard tuple:

```ts
const [result, logs] = Logged.run(program);

// Dispatch logs programmatically at your system boundary:
logs.forEach((message) => logger.info(message));
```

By calling `run` at the boundary of your system, you can choose to write the logs to an external
database, return them to the client, or filter them, keeping your operational code 100% pure.

---

## When to use Logged

### Use Logged when:

- **The log is an essential output**: You are building rules engines, payload validators, or data
  migrators where the audit trail or warnings log must be returned to the caller or database.
- **You require pure, testable traces**: You want to assert on log traces programmatically in unit
  tests without setting up global console mocks or capturing standard output.

### Keep using standard logging libraries when:

- **Logs are purely for development diagnostics**: You are writing generic debugging logs that only
  humans will read in development, and the trace has no first-class programmatic value in
  production.
