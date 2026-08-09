---
title: Stream — Typed Event Sequences & State Reduction
description: Decouple event emission from sequence matching, state reduction, and structural forwarding.
---

Applications often need to coordinate decoupled events happening in different places—such as form
step transitions, authentication handshakes, and UI user action tracking. Standard event emitters
leave message payloads untyped, while complex reactive stream libraries introduce heavy operator
boilerplate for basic event sequence tracking.

`Stream` provides a lightweight, type-safe event pipeline. It enables modules to publish typed
messages, match specific event sequences, accumulate state over time, and forward events between
streams without manual callback management.

The design of `Stream` draws inspiration from three functional paradigms:

- **Erlang / Elixir (`gen_statem`)**: State machine pattern matching on sequences of incoming typed
  messages.
- **Clojure (`core.async`)**: Decoupled message channels for event distribution.
- **Haskell FRP (`scanl`)**: Incremental state reduction over a sequence of discrete events.

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

const sequenceListener = Stream.listen(
  authStream,
  ["sessionStarted", "emailEntered", "otpVerified"],
  {
    ordered: true,
    strict: false,
    reset: "sessionStarted",
  }
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

## When to Use Stream

- Decoupling event producers from event consumers across application modules.
- Tracking multi-step event sequences (e.g. user action flows or onboarding steps) without manual
  state machines.
- Accumulating state over time from incoming discrete events.
- Structurally piping events between feature-level streams and global telemetry channels.
