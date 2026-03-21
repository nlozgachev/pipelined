---
title: "State — threading state through pipelines"
description: Computations that read and update a piece of state without passing it explicitly at every step.
---

Pure functions don't mutate. Yet many real operations naturally require state: generating sequential
IDs, building up a data structure one step at a time, simulating a counter or stack, threading
configuration through a pipeline. The usual alternatives are to pass the state as an extra argument
to every function, or to reach for a mutable variable. Neither is satisfying. `State<S, A>` offers
a third option: describe the stateful computation as a value, then run it once at the end.

## What a State is

```ts
type State<S, A> = (s: S) => readonly [A, S];
```

A `State<S, A>` is a function that takes an initial state of type `S` and produces both a value `A`
and a new (or unchanged) state. Nothing runs until you explicitly provide the initial state. The
return tuple `[value, nextState]` makes the state transition explicit — there is no implicit shared
mutable variable.

## Creating State computations

`State.resolve` lifts a pure value without touching the state:

```ts
const greet: State<number, string> = State.resolve("hello");
State.run(0)(greet); // ["hello", 0] — state is untouched
```

`State.get` reads the current state as the produced value:

```ts
const snapshot: State<string[], string[]> = State.get();
State.run(["a", "b"])(snapshot); // [["a", "b"], ["a", "b"]]
```

`State.gets` reads a projection of the state — useful when your state type is a record and you only
need one field:

```ts
type Config = { retries: number; timeout: number };

const maxRetries: State<Config, number> = State.gets(c => c.retries);
State.run({ retries: 3, timeout: 5000 })(maxRetries); // [3, { retries: 3, timeout: 5000 }]
```

`State.put` replaces the state entirely:

```ts
const resetCounter: State<number, undefined> = State.put(0);
State.run(99)(resetCounter); // [undefined, 0]
```

`State.modify` applies a function to the state to produce the next state, similar to how `Array`
reducers work:

```ts
const increment: State<number, undefined> = State.modify(n => n + 1);
State.run(5)(increment); // [undefined, 6]
```

## Transforming with `map`

`map` changes the value a computation produces without affecting the state transition:

```ts
const stackSize: State<string[], number> = pipe(
  State.get<string[]>(),
  State.map(stack => stack.length),
);

State.evaluate(["a", "b", "c"])(stackSize); // 3
```

## Sequencing with `chain`

`chain` is where State earns its keep. It threads the output state of one computation into the
input of the next, so you can write a sequence of stateful steps without passing the state
explicitly at each one:

```ts
const push = (item: string): State<string[], undefined> =>
  State.modify(stack => [...stack, item]);

const program = pipe(
  push("first"),
  State.chain(() => push("second")),
  State.chain(() => push("third")),
  State.chain(() => State.get<string[]>()),
);

State.evaluate([])(program); // ["first", "second", "third"]
```

Each call to `push` extends the stack in turn. The final `State.get` reads the accumulated result.

Here is a more realistic example: building a shopping cart by chaining item additions:

```ts
type Cart = { items: string[]; total: number };

const addItem =
  (name: string, price: number): State<Cart, undefined> =>
    State.modify(cart => ({
      items: [...cart.items, name],
      total: cart.total + price,
    }));

const checkout = pipe(
  addItem("coffee", 4),
  State.chain(() => addItem("croissant", 3)),
  State.chain(() => addItem("juice", 2)),
  State.chain(() => State.gets((c: Cart) => c.total)),
);

State.evaluate({ items: [], total: 0 })(checkout); // 9
```

## Running a State computation

Three runners extract results from a State:

`State.run` returns both the value and the final state as a tuple:

```ts
const [value, finalState] = State.run(0)(pipe(
  State.modify<number>(n => n + 10),
  State.chain(() => State.get<number>()),
));
// value = 10, finalState = 10
```

`State.evaluate` returns only the produced value — use this when you care about the result but not
the final state:

```ts
const total = State.evaluate({ items: [], total: 0 })(checkout); // 9
```

`State.execute` returns only the final state — use this when you care about the side-effect on the
state but not the value:

```ts
const finalCart = State.execute({ items: [], total: 0 })(pipe(
  addItem("coffee", 4),
  State.chain(() => addItem("juice", 2)),
));
// { items: ["coffee", "juice"], total: 6 }
```

## Generating sequential IDs

A common use case for State is generating unique integer IDs while building a data structure:

```ts
type IdState = number;

const nextId: State<IdState, number> = pipe(
  State.get<IdState>(),
  State.chain(id => pipe(
    State.put(id + 1),
    State.chain(() => State.resolve(id)),
  )),
);

const buildNodes = pipe(
  nextId,
  State.chain(id1 => pipe(
    nextId,
    State.chain(id2 => State.resolve([
      { id: id1, label: "root" },
      { id: id2, label: "child" },
    ])),
  )),
);

State.evaluate(0)(buildNodes);
// [{ id: 0, label: "root" }, { id: 1, label: "child" }]
```

The counter starts at 0 and is incremented by each call to `nextId`. The final value is the list of
nodes — the counter itself is discarded.

## When to use State

- You have a sequence of operations that need to read and update a shared piece of state without
  passing it as an extra parameter to every function.
- You want to model stateful algorithms (stack machines, counters, ID generators, config
  accumulators) as pure pipelines.
- You need a description of a stateful computation that you can pass around and run later with
  different initial states.

**Keep using plain variables when** the state is local to a single function body with no composition
need — a simple `let count = 0; count++` is clearer than `State.modify(n => n + 1)` when there is
nothing to compose. `State` earns its place when the stateful steps are themselves functions that
you want to name, reuse, or pass around before running.
