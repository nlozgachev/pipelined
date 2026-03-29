---
title: "State — threading state through pipelines"
description: Computations that read and update a piece of state without passing it explicitly at every step.
---

Pure functions don't mutate. Yet many real operations naturally require state: generating sequential
IDs, building up a data structure one step at a time, simulating a counter or stack, threading
configuration through a pipeline. The usual alternatives are to pass the state as an extra argument
to every function, or to reach for a mutable variable. Neither is satisfying. `State<S, A>` offers
a third option: describe the stateful computation as a value, then run it once at the end.

## The problem with threading state manually

When state must flow through several steps, the usual approaches either tangle the signature of
every function or introduce shared mutation:

```ts
// Option 1 — explicit parameter threading
// Every function must accept and return the counter, even when it's not the main concern
function buildGraph(counter: number): [Graph, number] {
	const [nodeA, c1] = makeNode("root", counter);
	const [nodeB, c2] = makeNode("child", c1);
	const [edge, c3] = makeEdge(nodeA, nodeB, c2);
	return [{ nodes: [nodeA, nodeB], edges: [edge] }, c3];
}

// Option 2 — mutable variable
// The counter is implicit; any function in scope can corrupt it
let counter = 0;
function nextId() {
	return counter++;
}
```

The first approach is verbose and breaks when you add or remove a step — every caller must be
updated. The second replaces a typing burden with a correctness burden: nothing stops two functions
from racing on the shared variable.

## What a State is

Each step receives the current state and returns the next state alongside its result. There's no
shared variable; the state flows through the chain explicitly, and nothing runs until you call
`State.run` at the end:

```ts
type State<S, A> = (s: S) => readonly [A, S];
```

The return tuple `[value, nextState]` makes the state transition explicit — no side effects, no
mutation.

## Creating State computations

`State.get` reads the current state as the produced value; `State.modify` updates it. These are
the two you'll reach for most often:

```ts
const snapshot: State<string[], string[]> = State.get();
State.run(["a", "b"])(snapshot); // [["a", "b"], ["a", "b"]]

const increment: State<number, undefined> = State.modify(n => n + 1);
State.run(5)(increment); // [undefined, 6]
```

`State.gets` projects a field from the state — useful when your state is a record and you only need
one piece. `State.put` replaces the state entirely. `State.resolve` lifts a plain value without
touching state. These are less common; `get` and `modify` cover most cases.

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
const push = (item: string): State<string[], undefined> => State.modify(stack => [...stack, item]);

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
type Cart = { items: string[]; total: number; };

const addItem = (name: string, price: number): State<Cart, undefined> =>
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
	State.chain(id =>
		pipe(
			State.put(id + 1),
			State.chain(() => State.resolve(id)),
		)
	),
);

const buildNodes = pipe(
	nextId,
	State.chain(id1 =>
		pipe(
			nextId,
			State.chain(id2 =>
				State.resolve([
					{ id: id1, label: "root" },
					{ id: id2, label: "child" },
				])
			),
		)
	),
);

State.evaluate(0)(buildNodes);
// [{ id: 0, label: "root" }, { id: 1, label: "child" }]
```

The counter starts at 0 and is incremented by each call to `nextId`. The final value is the list of
nodes — the counter itself is discarded.

If you build up a chain and forget to call `State.run` at the end, you have a function, not a
value — nothing runs and no type error tells you why.

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
