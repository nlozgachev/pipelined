import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { State } from "../State.ts";

// ---------------------------------------------------------------------------
// resolve
// ---------------------------------------------------------------------------

test("State.resolve produces the given value and leaves state unchanged", () => {
	const [value, state] = State.run(10)(State.resolve(42));
	expect(value).toBe(42);
	expect(state).toBe(10);
});

test("State.resolve works with string state", () => {
	const [value, state] = State.run("s")(State.resolve("hello"));
	expect(value).toBe("hello");
	expect(state).toBe("s");
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

test("State.get produces the current state as the value", () => {
	const [value, state] = State.run(99)(State.get());
	expect(value).toBe(99);
	expect(state).toBe(99);
});

test("State.get does not modify the state", () => {
	const [, finalState] = State.run(7)(State.get());
	expect(finalState).toBe(7);
});

// ---------------------------------------------------------------------------
// gets
// ---------------------------------------------------------------------------

test("State.gets projects a field from the state", () => {
	type S = { count: number; };
	const [value] = State.run({ count: 5 })(State.gets((s: S) => s.count));
	expect(value).toBe(5);
});

test("State.gets does not modify the state", () => {
	const [, state] = State.run(42)(State.gets((n: number) => n * 2));
	expect(state).toBe(42);
});

// ---------------------------------------------------------------------------
// put
// ---------------------------------------------------------------------------

test("State.put replaces the state", () => {
	const [, state] = State.run(0)(State.put(99));
	expect(state).toBe(99);
});

test("State.put produces undefined as the value", () => {
	const [value] = State.run(0)(State.put(99));
	expect(value).toBeUndefined();
});

// ---------------------------------------------------------------------------
// modify
// ---------------------------------------------------------------------------

test("State.modify applies a function to the state", () => {
	const [, state] = State.run(5)(State.modify((n) => n + 1));
	expect(state).toBe(6);
});

test("State.modify produces undefined as the value", () => {
	const [value] = State.run(5)(State.modify((n) => n + 1));
	expect(value).toBeUndefined();
});

test("State.modify does not affect the value branch", () => {
	const program = pipe(
		State.modify<number>((n) => n * 2),
		State.chain(() => State.get<number>()),
	);
	const [value, state] = State.run(3)(program);
	expect(value).toBe(6);
	expect(state).toBe(6);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("State.map transforms the produced value", () => {
	const [value] = State.run(10)(pipe(State.get<number>(), State.map((n) => n * 2)));
	expect(value).toBe(20);
});

test("State.map does not change the state", () => {
	const [, state] = State.run(10)(pipe(State.get<number>(), State.map((n) => n * 2)));
	expect(state).toBe(10);
});

test("State.map chains multiple transformations", () => {
	const program = pipe(
		State.resolve<number, number>(3),
		State.map((n) => n + 1),
		State.map((n) => n * 10),
	);
	const [value] = State.run(0)(program);
	expect(value).toBe(40);
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("State.chain sequences two computations, threading state", () => {
	const program = pipe(
		State.put<number>(5),
		State.chain(() => State.modify<number>((n) => n + 1)),
		State.chain(() => State.get<number>()),
	);
	const [value, state] = State.run(0)(program);
	expect(value).toBe(6);
	expect(state).toBe(6);
});

test("State.chain passes the value from one step to the next", () => {
	const program = pipe(
		State.resolve<number, number>(10),
		State.chain((n) => State.resolve(n * 2)),
	);
	const [value] = State.run(0)(program);
	expect(value).toBe(20);
});

test("State.chain builds a stack via modify and get", () => {
	const push = (item: string): State<string[], undefined> => State.modify((stack) => [...stack, item]);

	const program = pipe(
		push("a"),
		State.chain(() => push("b")),
		State.chain(() => push("c")),
		State.chain(() => State.get<string[]>()),
	);
	const [value] = State.run([] as string[])(program);
	expect(value).toEqual(["a", "b", "c"]);
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("State.ap applies a wrapped function to a wrapped value", () => {
	const double = (n: number) => n * 2;
	const program = pipe(
		State.resolve<number, (n: number) => number>(double),
		State.ap(State.resolve(7)),
	);
	const [value] = State.run(0)(program);
	expect(value).toBe(14);
});

test("State.ap threads state through function then argument", () => {
	const program = pipe(
		State.resolve<number, (n: number) => number>((n) => n + 1),
		State.ap(State.gets((s: number) => s * 10)),
	);
	// state = 3 → gets reads 30, adds 1 → value = 31
	const [value, state] = State.run(3)(program);
	expect(value).toBe(31);
	expect(state).toBe(3);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("State.tap runs a side effect without changing value or state", () => {
	let captured = -1;
	const program = pipe(
		State.get<number>(),
		State.tap((n) => {
			captured = n;
		}),
	);
	const [value, state] = State.run(42)(program);
	expect(captured).toBe(42);
	expect(value).toBe(42);
	expect(state).toBe(42);
});

// ---------------------------------------------------------------------------
// run / evaluate / execute
// ---------------------------------------------------------------------------

test("State.run returns [value, finalState]", () => {
	const [value, state] = State.run(0)(State.put(99));
	expect(value).toBeUndefined();
	expect(state).toBe(99);
});

test("State.evaluate returns only the produced value", () => {
	const result = State.evaluate(5)(State.gets((n: number) => n * 3));
	expect(result).toBe(15);
});

test("State.execute returns only the final state", () => {
	const result = State.execute(5)(State.modify((n: number) => n + 10));
	expect(result).toBe(15);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("State composes well in a pipe chain", () => {
	type Cart = { items: string[]; total: number; };
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
	expect(total).toBe(4);
});
