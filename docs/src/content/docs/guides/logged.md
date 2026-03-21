---
title: "Logged — values with accumulated logs"
description: Pair computations with a log that builds up automatically as you chain steps.
---

Many operations need to record what they did: an audit trail of decisions in a rules engine, a
debug trace of transformations in a data pipeline, a sequence of validation messages collected
alongside a processed value. The usual approach threads an array through every function as an extra
parameter. `Logged<W, A>` does that threading automatically: each step in a pipeline declares its
own log entries, and they are concatenated in order without any manual bookkeeping.

## What a Logged is

```ts
type Logged<W, A> = { readonly value: A; readonly log: ReadonlyArray<W> };
```

A `Logged<W, A>` is a plain data structure — a value of type `A` paired with an ordered sequence
of log entries of type `W`. There are no side effects, no mutation, no console output. The log is
just data that you inspect or emit at the edge of your program.

## Creating a Logged value

`Logged.make` wraps a value with an empty log:

```ts
const start: Logged<string, number> = Logged.make(0);
// { value: 0, log: [] }
```

`Logged.tell` records a single entry with no meaningful value. It is the atomic logging operation:

```ts
const entry: Logged<string, undefined> = Logged.tell("processing started");
// { value: undefined, log: ["processing started"] }
```

## Transforming with `map`

`map` changes the value without touching the log:

```ts
const doubled = pipe(
  Logged.make<string, number>(5),
  Logged.map(n => n * 2),
);
// { value: 10, log: [] }
```

Any log entries already present are carried forward unchanged:

```ts
const result: Logged<string, number> = { value: 3, log: ["loaded"] };
const bigger = pipe(result, Logged.map(n => n + 1));
// { value: 4, log: ["loaded"] }
```

## Sequencing with `chain`

`chain` is the key operation. It passes the value of one `Logged` to a function that returns
another `Logged`, and automatically concatenates both logs:

```ts
const program = pipe(
  Logged.make<string, number>(1),
  Logged.chain(n => pipe(Logged.tell("incremented"), Logged.map(() => n + 1))),
  Logged.chain(n => pipe(Logged.tell("doubled"),     Logged.map(() => n * 2))),
);

Logged.run(program); // [4, ["incremented", "doubled"]]
```

No function in the chain touches the log from a previous step — the concatenation is handled by
`chain` itself. Each step only declares its own entries.

## A rules engine example

Suppose you are applying a sequence of business rules to a discount calculation. Each rule may
apply a modifier and should record its reasoning:

```ts
type Rule = (price: number) => Logged<string, number>;

const memberDiscount: Rule = (price) =>
  price > 100
    ? pipe(Logged.tell("member discount: -10%"), Logged.map(() => price * 0.9))
    : pipe(Logged.tell("member discount: not applicable"), Logged.map(() => price));

const bulkDiscount: Rule = (price) =>
  price > 200
    ? pipe(Logged.tell("bulk discount: -5%"), Logged.map(() => price * 0.95))
    : pipe(Logged.tell("bulk discount: not applicable"), Logged.map(() => price));

const applyRules = (basePrice: number): Logged<string, number> =>
  pipe(
    Logged.make<string, number>(basePrice),
    Logged.chain(memberDiscount),
    Logged.chain(bulkDiscount),
  );

const [finalPrice, auditTrail] = Logged.run(applyRules(250));
// finalPrice ≈ 213.75
// auditTrail = ["member discount: -10%", "bulk discount: -5%"]
```

The audit trail builds automatically. Neither `memberDiscount` nor `bulkDiscount` knows about the
other's log entries — `chain` stitches them together.

## A transformation pipeline with debug trace

In a data transformation pipeline you often want to know what each step produced without wiring in
actual logging infrastructure:

```ts
const normalise = (s: string): Logged<string, string> => {
  const result = s.trim().toLowerCase();
  return pipe(
    Logged.tell(`normalise: "${s}" → "${result}"`),
    Logged.map(() => result),
  );
};

const truncate = (max: number) => (s: string): Logged<string, string> => {
  const result = s.slice(0, max);
  return pipe(
    Logged.tell(`truncate(${max}): "${s}" → "${result}"`),
    Logged.map(() => result),
  );
};

const processSlug = (raw: string): Logged<string, string> =>
  pipe(
    Logged.make<string, string>(raw),
    Logged.chain(normalise),
    Logged.chain(truncate(20)),
  );

const [slug, trace] = Logged.run(processSlug("  Hello World Foo Bar  "));
// slug  = "hello world foo bar"
// trace = [
//   'normalise: "  Hello World Foo Bar  " → "hello world foo bar"',
//   'truncate(20): "hello world foo bar" → "hello world foo bar"',
// ]
```

## Extracting results with `run`

`Logged.run` returns the value and log as a tuple `[value, log]`. Call it at the boundary where
you want to act on the results — emit the log to a monitoring system, return both to the caller, or
discard one:

```ts
const [value, log] = Logged.run(program);
log.forEach(entry => auditService.record(entry));
return value;
```

## When to use Logged

- You want a computation to produce both a result and a record of what happened, without threading
  a log array through every function signature.
- You are building a rules engine, validation pipeline, or data transformation where each step
  should declare its own reasoning and the final caller collects the full trace.
- You want pure, testable logging — the log is just data, there are no side effects until you
  explicitly emit it.

**Keep using plain logging calls when** the output is purely for human debugging during development
and you don't need to inspect, assert on, or forward the log programmatically. `Logged` is most
valuable when the log itself is a first-class output that callers need to process, not just a
side channel.
</content>
</invoke>