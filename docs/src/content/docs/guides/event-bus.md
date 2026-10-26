---
title: EventBus — Typed Event Sequences & State Reduction
description: Decouple event emission from sequence matching, state reduction, and structural forwarding.
---

Applications often need to coordinate decoupled events happening in different places — such as form
step transitions, authentication handshakes, and UI user action tracking. Standard event emitters
leave message payloads untyped, while complex reactive stream libraries introduce heavy operator
boilerplate for basic event sequence tracking.

`EventBus` provides a lightweight, type-safe event pipeline. It enables modules to publish typed
messages, match specific event sequences, accumulate state over time, and forward events between
event buses without manual callback management.

`EventBus` centers on three core capabilities:

- **Incremental State Reduction**: Accumulating derived state over a stream of discrete events as
  they arrive.
- **Event-Driven Sequence Matching**: Matching ordered or unordered multi-event sequences with
  optional steps and automatic reset rules.
- **Typed Pub/Sub Messaging**: Strongly-typed payload schemas, multi-bus broadcasting, and cross-bus
  event forwarding.

---

## Type Structure

An `EventBus<S>` represents an active message pipeline constrained to a schema map `S`. Each schema
map defines message kind string keys paired with payload types.

```ts
import { EventBus } from "@nlozgachev/pipelined/core";

type UserFlowMessages = {
  sessionStarted: { sessionId: string; timestamp: number };
  emailEntered: { email: string };
  otpVerified: { code: string };
  flowCompleted: { userId: string };
};

// EventBus.Message<UserFlowMessages> is a discriminated union of all messages in UserFlowMessages:
// | { kind: "sessionStarted"; value: { sessionId: string; timestamp: number } }
// | { kind: "emailEntered"; value: { email: string } }
// | { kind: "otpVerified"; value: { code: string } }
// | { kind: "flowCompleted"; value: { userId: string } }
```

Every message emitted through an event bus is structured as a plain discriminated union containing
`kind` (the message identifier) and `value` (the payload).

---

## Creating Event Buses

Event buses are constructed using `EventBus.make`. An optional configuration object allows naming
the bus for debugging or attaching an error boundary callback to isolate subscriber exceptions.

```ts
import { EventBus } from "@nlozgachev/pipelined/core";

// Create an isolated event bus with an error handler
const authBus = EventBus.make<UserFlowMessages>({
  name: "auth-pipeline",
  onError: (error) => {
    console.error("EventBus subscriber exception:", error);
  },
});
```

---

## Emitting Messages

Messages are published using `EventBus.emit`, which accepts the target event bus (or an array of
buses for broadcasting) and the message payload object.

```ts
import { EventBus } from "@nlozgachev/pipelined/core";

// Emit to a single event bus
EventBus.emit(authBus, {
  kind: "sessionStarted",
  value: { sessionId: "sess-9921", timestamp: Date.now() },
});

// Broadcast to multiple event buses simultaneously
EventBus.emit([authBus, analyticsBus], {
  kind: "emailEntered",
  value: { email: "dev@example.com" },
});
```

---

## Subscribing & Sequence Matching

`EventBus.subscribe` registers subscribers on an event bus. Omitting the event filter subscribes to
all events defined in the bus schema, while providing a key or array of keys targets specific events
or sequences. Matching options control sequence ordering, strictness, and auto-resetting. Each call
to `.reduce()`, `.tap()`, or `.collect()` registers an independent subscription with its own
sequence tracking state and disposal function.

### Schema-Wide Subscriptions

When building cross-cutting loggers, metrics sinks, or state projections across an entire bus, call
`EventBus.subscribe(bus)` without specifying event keys. The callback receives a discriminated union
of all messages defined on the bus schema:

```ts
import { EventBus } from "@nlozgachev/pipelined/core";

// Observe all events emitted on the bus
const unsubscribe = EventBus.subscribe(authBus).tap((msg) => {
  console.log("Telemetry event:", msg.kind, msg.value);
});

// Accumulate state across all events
const eventCount = EventBus.subscribe(authBus).reduce((_msg, count) => count + 1, 0);
```

### Targeted & Sequence Matching

When targeting specific event keys or sequences:

```ts
import { EventBus } from "@nlozgachev/pipelined/core";

// Sequence options:
// - ordered: matches events in exact array sequence order
// - strict: requires strictly consecutive events without intermediary events
// - once: automatically unsubscribes after the first match
// - reset: event kind(s) that reset sequence tracking to index 0
// - optional: event kind(s) in sequence that may be present or skipped

const sequenceListener = EventBus.subscribe(
  authBus,
  ["sessionStarted", "emailEntered", "otpVerified"],
  {
    ordered: true,
    strict: false,
    optional: ["emailEntered"],
    reset: "sessionStarted",
  },
);
```

---

## Stateful Reduction

When an event or sequence of events matches, `.reduce(reducer, initialState)` accumulates state over
time. It returns a `Subscription<State>` object with `.getState()` and `.unsubscribe()`.

```ts
import { EventBus } from "@nlozgachev/pipelined/core";

type OnboardingState = {
  completedSteps: number;
  lastEmail: string;
};

const subscription = EventBus.subscribe(
  authBus,
  ["sessionStarted", "emailEntered", "otpVerified"],
).reduce(
  (msg, state) => {
    if (msg.kind === "emailEntered") {
      return { ...state, lastEmail: msg.value.email };
    }
    if (msg.kind === "otpVerified") {
      return { ...state, completedSteps: state.completedSteps + 1 };
    }
    return state;
  },
  { completedSteps: 0, lastEmail: "" },
);

// Inspect state after emission
console.log(subscription.getState());

// Stop listening when no longer needed
subscription.unsubscribe();
```

---

## Stateless Side-Effects

For scenarios where state accumulation is not required, `.tap(effect)` executes a side-effect
callback when the matching event or sequence fires. Because `EventBus.subscribe` narrows the message
type to the listened key(s), `msg.value` is automatically typed without extra narrowing checks. It
returns a cleanup function to unsubscribe:

```ts
import { EventBus } from "@nlozgachev/pipelined/core";

type TelemetryMessages = {
  pageViewed: { path: string };
  buttonClicked: { buttonId: string };
};

const analyticsBus = EventBus.make<TelemetryMessages>();

const unsubscribe = EventBus.subscribe(analyticsBus, "buttonClicked").tap((msg) => {
  console.log("Telemetry event:", msg.value.buttonId);
});

// Remove subscriber
unsubscribe();
```

---

## Sequence Payload Collection

`.collect(callback)` registers a terminal subscriber that aggregates payloads into a single keyed
record (`{ [Event]: Payload }`), returning an unsubscribe disposer. The callback executes each time
all required events have been emitted (in sequence when `{ ordered: true }`, or in any order when
omitted), recurring on every completion unless `{ once: true }` is set.

```ts
import { EventBus } from "@nlozgachev/pipelined/core";

type CheckoutMessages = {
  addressValidated: { shippingAddress: string };
  paymentAuthorized: { transactionId: string; amount: number };
  orderConfirmed: { orderId: string };
};

const checkoutBus = EventBus.make<CheckoutMessages>();

// Listen for the complete multi-step checkout sequence:
const unsubscribe = EventBus.subscribe(
  checkoutBus,
  ["addressValidated", "paymentAuthorized", "orderConfirmed"],
  { ordered: true, strict: true },
).collect((payloads) => {
  // payloads is typed as:
  // {
  //   addressValidated: { shippingAddress: string };
  //   paymentAuthorized: { transactionId: string; amount: number };
  //   orderConfirmed: { orderId: string };
  // }
  console.log("Order processed:", payloads.orderConfirmed.orderId);
  console.log("Payment amount:", payloads.paymentAuthorized.amount);
});
```

If an event is configured as optional via `{ optional: [...] }`, it may be skipped in the sequence.
In `.collect()`, skipped optional events evaluate to `undefined`, and TypeScript marks their
properties as optional (`T | undefined`) to enforce proper narrowing:

```ts
const sub = EventBus.subscribe(
  checkoutBus,
  ["addressValidated", "paymentAuthorized"],
  { ordered: true, optional: ["paymentAuthorized"] },
).collect((payloads) => {
  console.log(payloads.addressValidated.shippingAddress);

  if (payloads.paymentAuthorized !== undefined) {
    console.log("Payment captured:", payloads.paymentAuthorized.transactionId);
  }
});
```

---

## Structural Event Bus Forwarding

`EventBus.forward` connects buses together, piping messages from a source bus to one or more target
buses. An optional `only` filter restricts forwarding to specific message kinds, allowing you to
forward shared event keys across buses with distinct domain schemas:

```ts
import { EventBus } from "@nlozgachev/pipelined/core";

type OrderMessages = {
  cartUpdated: { count: number };
  checkoutSubmitted: { total: number };
};

type AuditMessages = {
  checkoutSubmitted: { total: number };
  userLoggedOut: { userId: string };
};

const UIBus = EventBus.make<OrderMessages>();
const AuditBus = EventBus.make<AuditMessages>();

// Forward shared checkoutSubmitted events from UIBus to AuditBus
const stopForwarding = EventBus.forward({
  from: UIBus,
  to: AuditBus,
  only: ["checkoutSubmitted"],
});

// Emitting on UIBus automatically reaches AuditBus subscribers
EventBus.emit(UIBus, {
  kind: "checkoutSubmitted",
  value: { total: 149.99 },
});

// Disconnect event forwarding when feature unmounts
stopForwarding();
```

---

## Synchronous Breadth-First Dispatch

When a subscriber callback emits a new message during event handling (`EventBus.emit` called within
a subscriber), `EventBus` dispatches messages using a synchronous breadth-first trampoline queue.

Rather than invoking re-entrant emissions recursively on the call stack, nested messages are
appended to the bus's internal queue. The active dispatch loop delivers the current message to all
registered subscribers completely before processing subsequent messages in sequence.

This architecture guarantees two core runtime properties:

- **Strict Causal Ordering**: Parallel subscribers always receive messages in exact chronological
  sequence. A subscriber will never observe a re-entrantly emitted message before finishing its
  processing of the preceding event.
- **Stack Overflow Prevention**: Deeply cascading re-entrant emissions run sequentially inside a
  flat queue using O(1) stack space, preventing call stack exhaustion without introducing
  asynchronous microtask delays.

---

## Problems it solves

- **Decoupling event producers from subscribers**: In modular architectures, components (such as
  auth controllers, shopping carts, or WebSocket clients) need to broadcast lifecycle events without
  hardcoded references to UI banners, logging sinks, or analytics trackers. `EventBus` provides a
  typed, memory-safe event broker that completely decouples event sources from consumers.
- **Pattern-matching multi-step event sequences (`EventBus.subscribe`)**: Tracking complex
  multi-event flows (such as detecting a multi-step checkout sequence: `userRegistered` →
  `planSelected` → `paymentSubmitted`, or keyboard shortcut combos) normally requires ad-hoc boolean
  flags and timeout handles. `EventBus.subscribe` matches ordered or strict event sequences
  natively, with configurable reset events (`reset: "cartEmptied"`).
- **Preventing re-entrant message reordering**: When an event subscriber reacts to an incoming event
  by immediately emitting a new event, standard event emitters execute subscribers recursively. This
  can cause secondary events to finish before primary events, scrambling chronological order.
  `EventBus` uses causal queue dispatching to guarantee strict FIFO ordering across all subscribers.
- **Eliminating stack overflow crashes during event cascades**: Cascading domain events (where event
  A triggers event B, which triggers event C) can easily exceed JavaScript's call stack limits in
  recursive emitter implementations. `EventBus` executes nested dispatches iteratively using an
  internal queue with O(1) stack overhead.
- **State reduction over matched event streams (`.reduce()`)**: In dashboard widgets and activity
  trackers, components need to compute live derived state (such as counting unread notifications or
  summing active cart totals) from a stream of discrete events. Calling `.reduce()` on a subscriber
  accumulates state over time synchronously without external mutable state stores.
- **Structural event bus forwarding and subsystem aggregation (`EventBus.forward`)**: In modular
  applications, child feature modules maintain local event buses. `EventBus.forward` bridges and
  forwards filtered subsets of shared events from isolated module buses into a central application
  event bus without manual event plumbing.
- **Memory leak prevention with explicit subscriber disposal**: Every subscription returns a clean
  disposal function that removes the subscriber instantly, preventing dangling references and memory
  leaks when UI views unmount.
