---
title: Stream — Typed Event Sequences & State Reduction
description: Decouple event emission from sequence matching, state reduction, and structural forwarding.
---

Applications often need to coordinate decoupled events happening in different places — such as form
step transitions, authentication handshakes, and UI user action tracking. Standard event emitters
leave message payloads untyped, while complex reactive stream libraries introduce heavy operator
boilerplate for basic event sequence tracking.

`Stream` provides a lightweight, type-safe event pipeline. It enables modules to publish typed
messages, match specific event sequences, accumulate state over time, and forward events between
streams without manual callback management.

The design of `Stream` draws inspiration from key functional programming patterns:

- **Functional Reactive Programming (FRP)**: Incremental state reduction over a stream of discrete
  events (`scanl`).
- **Event-Driven State Machines**: Sequence pattern matching and reset rules over typed message
  kinds.
- **Typed Pub/Sub Messaging**: Strongly-typed payload schemas, broadcasting, and structural channel
  forwarding.

---

## Type Structure

A `Stream<S>` represents an active message pipeline constrained to a schema map `S`. Each schema map
defines message kind string keys paired with payload types.

```ts
import { Stream } from "@nlozgachev/pipelined/core";

type UserFlowMessages = {
  sessionStarted: { sessionId: string; timestamp: number };
  emailEntered: { email: string };
  otpVerified: { code: string };
  flowCompleted: { userId: string };
};

// Stream.Message<UserFlowMessages> is a discriminated union of all messages in UserFlowMessages:
// | { kind: "sessionStarted"; value: { sessionId: string; timestamp: number } }
// | { kind: "emailEntered"; value: { email: string } }
// | { kind: "otpVerified"; value: { code: string } }
// | { kind: "flowCompleted"; value: { userId: string } }
```

Every message emitted through a stream is structured as a plain discriminated union containing
`kind` (the message identifier) and `value` (the payload).

---

## Creating Streams

Streams are constructed using `Stream.make`. An optional configuration object allows naming the
stream for debugging or attaching an error boundary callback to isolate listener exceptions.

```ts
import { Stream } from "@nlozgachev/pipelined/core";

// Create an isolated stream with an error handler
const authStream = Stream.make<UserFlowMessages>({
  name: "auth-pipeline",
  onError: (error) => {
    console.error("Stream listener exception:", error);
  },
});
```

---

## Emitting Messages

Messages are published using `Stream.emit`, which accepts the target stream (or an array of streams
for broadcasting) and the message payload object.

```ts
import { Stream } from "@nlozgachev/pipelined/core";

// Emit to a single stream
Stream.emit(authStream, {
  kind: "sessionStarted",
  value: { sessionId: "sess-9921", timestamp: Date.now() },
});

// Broadcast to multiple streams simultaneously
Stream.emit([authStream, analyticsStream], {
  kind: "emailEntered",
  value: { email: "dev@example.com" },
});
```

---

## Listening & Sequence Matching

`Stream.listen` registers subscribers on a stream for a single message kind or a sequence of message
kinds. Matching options control sequence ordering, strictness, and auto-resetting.

```ts
import { Stream } from "@nlozgachev/pipelined/core";

// Single-word sequence options:
// - ordered: matches events in exact array sequence order
// - strict: requires strictly consecutive events without intermediary events
// - once: automatically unsubscribes after the first match
// - reset: event kind(s) that reset sequence tracking to index 0
// - optional: event kind(s) in sequence that may be present or skipped

const sequenceListener = Stream.listen(
  authStream,
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
import { Stream } from "@nlozgachev/pipelined/core";

type OnboardingState = {
  completedSteps: number;
  lastEmail: string;
};

const subscription = Stream.listen(
  authStream,
  ["sessionStarted", "emailEntered", "otpVerified"],
  { ordered: true }
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
  { completedSteps: 0, lastEmail: "" }
);

// Inspect state after emission
console.log(subscription.getState());

// Stop listening when no longer needed
subscription.unsubscribe();
```

---

## Stateless Side-Effects

For scenarios where state accumulation is not required, `.tap(effect)` executes a side-effect
callback when the matching event or sequence fires. It returns a cleanup function to unsubscribe.

```ts
import { Stream } from "@nlozgachev/pipelined/core";

type TelemetryMessages = {
  pageViewed: { path: string };
  buttonClicked: { buttonId: string };
};

const analyticsStream = Stream.make<TelemetryMessages>();

const unsubscribe = Stream.listen(analyticsStream, "buttonClicked").tap((msg) => {
  if (msg.kind === "buttonClicked") {
    console.log("Telemetry event:", msg.value.buttonId);
  }
});

// Remove listener
unsubscribe();
```

---

## Structural Stream Forwarding

`Stream.forward` connects streams together, piping messages from a source stream to target streams.
An optional `only` filter restricts forwarding to specific message kinds.

```ts
import { Stream } from "@nlozgachev/pipelined/core";

type OrderMessages = {
  cartUpdated: { count: number };
  checkoutSubmitted: { total: number };
};

const UIStream = Stream.make<OrderMessages>();
const AuditStream = Stream.make<OrderMessages>();

// Forward checkout events from UIStream to AuditStream
const stopForwarding = Stream.forward({
  from: UIStream,
  to: AuditStream,
  only: ["checkoutSubmitted"],
});

// Emitting on UIStream automatically reaches AuditStream subscribers
Stream.emit(UIStream, {
  kind: "checkoutSubmitted",
  value: { total: 149.99 },
});

// Disconnect stream forwarding when feature unmounts
stopForwarding();
```

---

## Synchronous Breadth-First Dispatch

When a listener callback emits a new message during event handling (`Stream.emit` called within a
subscriber), `Stream` dispatches messages using a synchronous breadth-first trampoline queue.

Rather than invoking re-entrant emissions recursively on the call stack, nested messages are
appended to the stream's internal queue. The active dispatch loop delivers the current message to
all registered listeners completely before processing subsequent messages in sequence.

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
  hardcoded references to UI banners, logging sinks, or analytics trackers. `Stream` provides a
  typed, memory-safe event broker that completely decouples event sources from consumers.
- **Pattern-matching multi-step event sequences (`Stream.listen`)**: Tracking complex multi-event
  flows (such as detecting a multi-step checkout sequence: `userRegistered` → `planSelected` →
  `paymentSubmitted`, or keyboard shortcut combos) normally requires ad-hoc boolean flags and
  timeout handles. `Stream.listen` matches ordered or strict event sequences natively, with
  configurable reset events (`reset: "cartEmptied"`).
- **Preventing re-entrant message reordering**: When an event listener reacts to an incoming event
  by immediately emitting a new event, standard event emitters execute listeners recursively. This
  can cause secondary events to finish before primary events, scrambling chronological order.
  `Stream` uses causal queue dispatching to guarantee strict FIFO ordering across all subscribers.
- **Eliminating stack overflow crashes during event cascades**: Cascading domain events (where event
  A triggers event B, which triggers event C) can easily exceed JavaScript's call stack limits in
  recursive emitter implementations. `Stream` executes nested dispatches iteratively using an
  internal queue with O(1) stack overhead.
- **State reduction over matched event streams (`.reduce()`)**: In dashboard widgets and activity
  trackers, components need to compute live derived state (such as counting unread notifications or
  summing active cart totals) from a stream of discrete events. Calling `.reduce()` on a listener
  accumulates state over time synchronously without external mutable state stores.
- **Structural stream forwarding and subsystem aggregation (`Stream.forward`)**: In modular
  applications, child feature modules maintain local event streams. `Stream.forward` bridges and
  forwards filtered or renamed events from isolated module streams into a central application event
  bus without manual event plumbing.
- **Memory leak prevention with explicit listener disposal**: Every subscription returns a clean
  disposal function that removes the listener instantly, preventing dangling references and memory
  leaks when UI views unmount.
