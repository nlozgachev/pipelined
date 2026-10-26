---
title: Logged — Accumulated Logs
description: Pair computations with a log that accumulates automatically as you chain transformations, keeping logging pure, testable, and side-effect-free.
---

<!-- BUNDLE_SIZE:START -->

> 232 B minified + gzipped

<!-- BUNDLE_SIZE:END -->

Collecting audit logs or diagnostic traces during computations typically requires either manually
threading an array of log messages through every function or calling impure side effects
(`console.log`) that complicate unit testing.

`Logged<L, A>` pairs a computed value `A` with an accumulated read-only array of log entries `L`.
Operations on `Logged` append log entries automatically as transformations are chained:

```ts
type Logged<L, A> = {
  readonly value: A;
  readonly log: readonly L[];
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
const start = Logged.make<string, number>(0);
// { value: 0, log: [] }

// Lifting a value with an initial log array
const seeded = Logged.make("order_101", ["Order received", "Validated schema"]);
// { value: "order_101", log: ["Order received", "Validated schema"] }

// Recording a single log entry with an empty (undefined) value
const note = Logged.from.entry("Initializing calculations");
// { value: undefined, log: ["Initializing calculations"] }
```

`Logged.make(value, log?)` wraps a value with an optional initial array of log entries (defaulting
to `[]`). `Logged.from.entry` writes a single log entry and sets `value` to `undefined`, ready to be
sequenced into a pipeline.

---

## Transforming and Sequencing

We can transform the values inside `Logged` and sequence multiple logging steps directly in a
pipeline without manually concatenating arrays at each step.

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
  Logged.chain((n) => pipe(Logged.from.entry("Incremented value"), Logged.map(() => n + 1))),
  Logged.chain((n) => pipe(Logged.from.entry("Doubled value"), Logged.map(() => n * 2))),
);

const [value, log] = Logged.run(program);
// value = 4, log = ["Incremented value", "Doubled value"]
```

The intermediate log arrays are stitched together by `chain` itself. Each individual step only
declares its own log entry, fully isolated from the history of the pipeline.

### Combining logged values with `apply`

When combining independent `Logged` computations through a curried function, `Logged.apply` applies
the wrapped function to the wrapped value and concatenates their logs in order:

```ts
const buildLineItem = (sku: string) => (quantity: number) => ({ sku, quantity });

const validatedSku = Logged.make("SKU-900", ["Verified SKU in catalog"]);
const allocatedQty = Logged.make(3, ["Reserved 3 units from warehouse"]);

const lineItem = pipe(
  Logged.make<string, typeof buildLineItem>(buildLineItem),
  Logged.apply(validatedSku),
  Logged.apply(allocatedQty),
);

Logged.run(lineItem);
// [
//   { sku: "SKU-900", quantity: 3 },
//   ["Verified SKU in catalog", "Reserved 3 units from warehouse"]
// ]
```

### Inspecting values with `tap` and updating nested fields with `focus`

Use `Logged.tap` to execute a side effect on the current value (such as emitting a metric) without
modifying the value or the accumulated log. When the logged value is a nested record, `Logged.focus`
pairs with a `Lens` to update a specific property while preserving all existing log entries:

```ts
import { Lens } from "@nlozgachev/pipelined/core";

interface InvoiceDraft {
  id: string;
  subtotal: number;
}

const subtotalLens = Lens.from.property<InvoiceDraft>()("subtotal");

const updatedDraft = pipe(
  Logged.make<string, InvoiceDraft>(
    { id: "inv_01", subtotal: 100 },
    ["Draft initialized"],
  ),
  Logged.focus(subtotalLens)((amount) => amount + 25),
  Logged.tap((draft) => console.log(`Current draft subtotal: ${draft.subtotal}`)),
);
// { value: { id: "inv_01", subtotal: 125 }, log: ["Draft initialized"] }
```

---

## Practical Example: A Business Rules Engine

Consider a discount calculator that applies a series of promotional codes. To audit decisions, each
rule must record its reasoning:

```ts
type DiscountRule = (price: number) => Logged<string, number>;

const applyMemberPromo: DiscountRule = (price) =>
  price > 100
    ? pipe(Logged.from.entry("Member discount: -10% applied"), Logged.map(() => price * 0.9))
    : pipe(Logged.from.entry("Member discount: threshold not met"), Logged.map(() => price));

const applyBulkPromo: DiscountRule = (price) =>
  price > 200
    ? pipe(Logged.from.entry("Bulk discount: -5% applied"), Logged.map(() => price * 0.95))
    : pipe(Logged.from.entry("Bulk discount: threshold not met"), Logged.map(() => price));

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

## Accumulating values: bind / bindTo

When you need to perform multiple sequential operations and gather their results into a single
object, nesting `chain` and `map` inside pipelines can become highly complex:

```ts
const userProfile = pipe(
  getUser(userId),
  Logged.chain((user) =>
    pipe(
      getPreferences(user.id),
      Logged.map((prefs) => ({ user, prefs }))
    )
  ),
  Logged.chain(({ user, prefs }) =>
    pipe(
      getTheme(prefs.themeId),
      Logged.map((theme) => ({ user, prefs, theme }))
    )
  )
);
```

To solve this, you can use `bindTo` and `bind` to cleanly accumulate values key-by-key in a flat,
readable pipeline.

`bindTo` wraps the initial `Logged` value into a single-key accumulator object while keeping its
log:

```ts
const initialUser = pipe(
  getUser(userId),
  Logged.bindTo("user"),
); // Logged<string, { user: User }>
```

`bind` runs a new operation using the accumulated object and attaches the result to a new key:

```ts
const userProfile = pipe(
  getUser(userId),
  Logged.bindTo("user"),
  Logged.bind("prefs", ({ user }) => getPreferences(user.id)),
  Logged.bind("theme", ({ prefs }) => getTheme(prefs.themeId))
); // Logged({ user: User, prefs: Preferences, theme: Theme })
```

All logs produced at each key-binding step are automatically concatenated in sequential order.

---

## Problems it solves

- **Auditable calculation engines**: In tax estimation, pricing engines, and compliance evaluations,
  business logic must output both a calculated result and an explicit audit trail explaining how
  each step was determined. `Logged` pairs the computed value with an accumulated log array purely,
  without relying on side-effecting global loggers.
- **Data migration and non-fatal warning accumulation**: When importing legacy datasets or
  sanitizing user inputs, entries often contain non-fatal warnings (such as deprecated formats or
  fallback defaults applied) that must be surfaced alongside transformed data. `Logged` preserves
  these diagnostic records across pipeline steps.
- **Deterministic, mock-free log testing**: Asserting that a workflow logged specific decisions
  normally requires intercepting stdout or mocking logger instances. `Logged` treats logs as
  first-class returned data, allowing unit tests to assert directly on trace arrays.
