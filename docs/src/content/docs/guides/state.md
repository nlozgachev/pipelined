---
title: State — Stateful Computations
description: Thread immutable state through a sequence of transformations cleanly, replacing local mutations and parameter drilling with pure state transitions.
---

Many programming tasks—such as parsing, sequential ID generation, and simulations—require updating
state across a sequence of steps.

To keep functions pure without mutable globals, state is typically threaded manually via tuples:

```ts
// Threading state explicitly:
function constructNodes(counter: number): [Node[], number] {
  const [nodeA, c1] = makeNode("root", counter);
  const [nodeB, c2] = makeNode("child", c1);
  return [[nodeA, nodeB], c2];
}
```

This is extremely verbose. Every single function must accept the state as a parameter and return a
tuple of the result and the updated state, even when the state is not the primary concern of that
function. If you insert or remove a step, you must manually rewrite the variable assignments (`c1`,
`c2`, etc.).

The common alternative is to introduce a mutable variable:

```ts
let counter = 0;
function nextId() {
  return counter++;
}
```

While this eliminates the parameter noise, it introduces a correctness risk. The state is now shared
globally within its scope. Any function can corrupt it, and testing it in isolation requires manual
reset hooks.

`State<S, A>` offers an elegant third path. It models a stateful computation as a pure, immutable
function that takes an initial state `S` and returns a tuple of a result `A` and the new state `S`:

```ts
type State<S, A> = (initialState: S) => readonly [A, S];
```

By representing state transitions as a data structure rather than a series of mutable assignments,
we compose stateful steps cleanly and execute them once at the boundary of our program.

---

## Creating State Operations

To construct state transitions, we use the core constructors of `State`:

```ts
import { State } from "@nlozgachev/pipelined/core";

// Reads the current state
const snapshot = State.get<number>();

// Modifies the state by applying a function
const increment = State.modify((n: number) => n + 1);

// Replaces the state entirely
const overwrite = State.put(42);
```

- `State.get` reads the current state, returning it as the produced value.
- `State.modify` updates the state using a mapping function.
- `State.put` overwrites the active state with a new value.
- `State.gets` projects a specific slice from a structured state record.
- `State.resolve` lifts a constant value into the `State` context without touching the state itself.

---

## Transforming and Sequencing

We can compose our stateful blueprints point-free, allowing the state to flow through our
transformations automatically.

### Transforming values with `map`

`map` transforms the produced result of a stateful step, leaving the underlying state transition
completely unaffected:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

const stackSize: State<string[], number> = pipe(
  State.get<string[]>(),
  State.map((stack) => stack.length),
);
```

### Sequencing transitions with `chain`

`chain` is the engine of the `State` container. It threads the output state of one step into the
input state of the next step, allowing you to write a sequence of stateful operations without ever
referencing the state variable explicitly:

```ts
interface Cart {
  items: string[];
  total: number;
}

const addItem = (name: string, price: number): State<Cart, undefined> =>
  State.modify((cart) => ({
    items: [...cart.items, name],
    total: cart.total + price,
  }));

const checkout = pipe(
  addItem("coffee", 4),
  State.chain(() => addItem("croissant", 3)),
  State.chain(() => addItem("juice", 2)),
  State.chain(() => State.gets((c: Cart) => c.total)),
);
```

Notice the layout. We describe the addition of three items to the cart and read the final total. The
intermediate cart state is threaded from step to step behind the scenes.

---

## Extracting Results: The Runners

`State` is lazy — defining a chain does not execute any transitions. To run the computation, we must
pass it an initial state using one of three runner functions:

### Full extraction with `run`

`State.run` executes the transitions and returns a tuple containing both the final value and the
final state:

```ts
const [value, finalState] = State.run({ items: [], total: 0 })(checkout);
// value = 9, finalState = { items: ["coffee", "croissant", "juice"], total: 9 }
```

### Reading outcomes with `evaluate`

`State.evaluate` executes the transitions and returns **only the produced value**, discarding the
final state:

```ts
const totalCost = State.evaluate({ items: [], total: 0 })(checkout); // 9
```

### Reading state changes with `execute`

`State.execute` executes the transitions and returns **only the final state**, discarding the
produced value:

```ts
const cartSnapshot = State.execute({ items: [], total: 0 })(checkout);
// { items: ["coffee", "croissant", "juice"], total: 9 }
```

---

## Practical Example: Unique ID Generation

A classic use case for `State` is generating unique, sequential IDs while constructing an immutable
data structure:

```ts
type IdState = number;

const generateId: State<IdState, number> = pipe(
  State.get<IdState>(),
  State.chain((id) =>
    pipe(
      State.put(id + 1),
      State.chain(() => State.resolve(id)),
    )
  ),
);

const buildNodes = pipe(
  generateId,
  State.chain((id1) =>
    pipe(
      generateId,
      State.chain((id2) =>
        State.resolve([
          { id: id1, label: "parent_node" },
          { id: id2, label: "child_node" },
        ])
      )
    )
  ),
);

const nodes = State.evaluate(0)(buildNodes);
// [{ id: 0, label: "parent_node" }, { id: 1, label: "child_node" }]
```

Each call to `generateId` reads the current integer, increments the counter in the state, and
returns the original integer. The state flows through the sequence, ensuring that no two nodes
receive duplicate IDs.

---

## Accumulating values: bind / bindTo

When you need to perform multiple sequential stateful operations and gather their results into a
single object, nesting `chain` and `map` inside pipelines can become highly complex:

```ts
const buildProfile = pipe(
  generateId,
  State.chain((id) =>
    pipe(
      loadData(id),
      State.map((data) => ({ id, data }))
    )
  ),
  State.chain(({ id, data }) =>
    pipe(
      loadPrefs(id),
      State.map((prefs) => ({ id, data, prefs }))
    )
  )
);
```

To solve this, you can use `bindTo` and `bind` to cleanly accumulate values key-by-key in a flat,
readable pipeline.

`bindTo` lifts a value into the pipeline's accumulator object:

```ts
pipe(
  State.resolve(42),
  State.bindTo("value")
); // State({ value: 42 })
```

`bind` runs a new stateful operation using the accumulated object and attaches the result to a new
key:

```ts
const buildProfile = pipe(
  generateId,
  State.bindTo("id"),
  State.bind("data", ({ id }) => loadData(id)),
  State.bind("prefs", ({ id }) => loadPrefs(id))
); // State({ id: number, data: Data, prefs: Preferences })
```

The underlying state transition threads behind the scenes key-by-key perfectly.

---

## Problems it solves

- **Stateful parsers and tokenizers**: When writing custom data parsers, markdown tokenizers, or
  protocol decoders, each operation consumes input, advances cursor offsets, and yields syntax
  nodes. Managing this with shared mutable counters creates fragile off-by-one bugs. `State` models
  every step as a pure transition that yields a computed value alongside an updated state object.
- **Sequential ID generation and seed tracking**: In simulations, workflow step engines, or game
  loops, operations need to generate incremental IDs, advance random seeds, or track fuel/quota
  budgets without relying on global mutable state. `State` threads accumulated updates sequentially
  from one step to the next.
- **Sub-state isolation and modular transitions (`State.focus`)**: In complex state machines,
  writing transitions that know about the entire root state couples domain helpers to top-level
  schemas. Pairing `State` with `Lens` via `State.focus(lens)` allows reusable operations to
  transform isolated sub-properties (such as updating an inventory or cart sub-model) while running
  directly against the global state tree.
- **Multi-step wizard flows and branch rollbacks**: In complex onboarding wizards and financial
  questionnaires, user responses dictate subsequent questions and update a growing payload. Because
  `State` transitions produce fresh state values without mutating the original, implementing
  branching navigation, back-tracking, and undo/redo snapshots requires zero defensive cloning.
- **Deterministic state testing**: Mutable state can leak across unit tests or cause subtle ordering
  issues. Because `State` computations are pure functions, tests can execute any sequence of steps
  with an exact initial state and deterministically verify both the final state and intermediate
  values.
