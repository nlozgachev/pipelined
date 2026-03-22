import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { State } from "../State.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// resolve
// ---------------------------------------------------------------------------

Deno.test("State.resolve produces the given value and leaves state unchanged", () => {
	const [value, state] = State.run(10)(State.resolve(42));
	assertStrictEquals(value, 42);
	assertStrictEquals(state, 10);
});

Deno.test("State.resolve works with string state", () => {
	const [value, state] = State.run("s")(State.resolve("hello"));
	assertStrictEquals(value, "hello");
	assertStrictEquals(state, "s");
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

Deno.test("State.get produces the current state as the value", () => {
	const [value, state] = State.run(99)(State.get());
	assertStrictEquals(value, 99);
	assertStrictEquals(state, 99);
});

Deno.test("State.get does not modify the state", () => {
	const [, finalState] = State.run(7)(State.get());
	assertStrictEquals(finalState, 7);
});

// ---------------------------------------------------------------------------
// gets
// ---------------------------------------------------------------------------

Deno.test("State.gets projects a field from the state", () => {
	type S = { count: number };
	const [value] = State.run({ count: 5 })(State.gets((s: S) => s.count));
	assertStrictEquals(value, 5);
});

Deno.test("State.gets does not modify the state", () => {
	const [, state] = State.run(42)(State.gets((n: number) => n * 2));
	assertStrictEquals(state, 42);
});

// ---------------------------------------------------------------------------
// put
// ---------------------------------------------------------------------------

Deno.test("State.put replaces the state", () => {
	const [, state] = State.run(0)(State.put(99));
	assertStrictEquals(state, 99);
});

Deno.test("State.put produces undefined as the value", () => {
	const [value] = State.run(0)(State.put(99));
	assertStrictEquals(value, undefined);
});

// ---------------------------------------------------------------------------
// modify
// ---------------------------------------------------------------------------

Deno.test("State.modify applies a function to the state", () => {
	const [, state] = State.run(5)(State.modify((n) => n + 1));
	assertStrictEquals(state, 6);
});

Deno.test("State.modify produces undefined as the value", () => {
	const [value] = State.run(5)(State.modify((n) => n + 1));
	assertStrictEquals(value, undefined);
});

Deno.test("State.modify does not affect the value branch", () => {
	const program = pipe(
		State.modify<number>((n) => n * 2),
		State.chain(() => State.get<number>()),
	);
	const [value, state] = State.run(3)(program);
	assertStrictEquals(value, 6);
	assertStrictEquals(state, 6);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("State.map transforms the produced value", () => {
	const [value] = State.run(10)(pipe(State.get<number>(), State.map((n) => n * 2)));
	assertStrictEquals(value, 20);
});

Deno.test("State.map does not change the state", () => {
	const [, state] = State.run(10)(pipe(State.get<number>(), State.map((n) => n * 2)));
	assertStrictEquals(state, 10);
});

Deno.test("State.map chains multiple transformations", () => {
	const program = pipe(
		State.resolve<number, number>(3),
		State.map((n) => n + 1),
		State.map((n) => n * 10),
	);
	const [value] = State.run(0)(program);
	assertStrictEquals(value, 40);
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

Deno.test("State.chain sequences two computations, threading state", () => {
	const program = pipe(
		State.put<number>(5),
		State.chain(() => State.modify<number>((n) => n + 1)),
		State.chain(() => State.get<number>()),
	);
	const [value, state] = State.run(0)(program);
	assertStrictEquals(value, 6);
	assertStrictEquals(state, 6);
});

Deno.test("State.chain passes the value from one step to the next", () => {
	const program = pipe(
		State.resolve<number, number>(10),
		State.chain((n) => State.resolve(n * 2)),
	);
	const [value] = State.run(0)(program);
	assertStrictEquals(value, 20);
});

Deno.test("State.chain builds a stack via modify and get", () => {
	const push = (item: string): State<string[], undefined> => State.modify((stack) => [...stack, item]);

	const program = pipe(
		push("a"),
		State.chain(() => push("b")),
		State.chain(() => push("c")),
		State.chain(() => State.get<string[]>()),
	);
	const [value] = State.run([] as string[])(program);
	assertEquals(value, ["a", "b", "c"]);
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

Deno.test("State.ap applies a wrapped function to a wrapped value", () => {
	const double = (n: number) => n * 2;
	const program = pipe(
		State.resolve<number, (n: number) => number>(double),
		State.ap(State.resolve(7)),
	);
	const [value] = State.run(0)(program);
	assertStrictEquals(value, 14);
});

Deno.test("State.ap threads state through function then argument", () => {
	const program = pipe(
		State.resolve<number, (n: number) => number>((n) => n + 1),
		State.ap(State.gets((s: number) => s * 10)),
	);
	// state = 3 → gets reads 30, adds 1 → value = 31
	const [value, state] = State.run(3)(program);
	assertStrictEquals(value, 31);
	assertStrictEquals(state, 3);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

Deno.test("State.tap runs a side effect without changing value or state", () => {
	let captured = -1;
	const program = pipe(
		State.get<number>(),
		State.tap((n) => {
			captured = n;
		}),
	);
	const [value, state] = State.run(42)(program);
	assertStrictEquals(captured, 42);
	assertStrictEquals(value, 42);
	assertStrictEquals(state, 42);
});

// ---------------------------------------------------------------------------
// run / evaluate / execute
// ---------------------------------------------------------------------------

Deno.test("State.run returns [value, finalState]", () => {
	const [value, state] = State.run(0)(State.put(99));
	assertStrictEquals(value, undefined);
	assertStrictEquals(state, 99);
});

Deno.test("State.evaluate returns only the produced value", () => {
	const result = State.evaluate(5)(State.gets((n: number) => n * 3));
	assertStrictEquals(result, 15);
});

Deno.test("State.execute returns only the final state", () => {
	const result = State.execute(5)(State.modify((n: number) => n + 10));
	assertStrictEquals(result, 15);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("State composes well in a pipe chain", () => {
	type Cart = { items: string[]; total: number };
	const addItem = (item: string, price: number): State<Cart, undefined> =>
		State.modify((cart) => ({
			items: [...cart.items, item],
			total: cart.total + price,
		}));

	const program = pipe(
		addItem("apple", 1),
		State.chain(() => addItem("bread", 2)),
		State.chain(() => addItem("milk", 1)),
		State.chain(() => State.gets((cart: Cart) => cart.total)),
	);

	const total = State.evaluate({ items: [] as string[], total: 0 })(program);
	assertStrictEquals(total, 4);
});
