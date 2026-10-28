import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";
import { State } from "../State.ts";

test("make, get, put, modify: constructs fundamental state operations", () => {
	const pure = State.make<number, string>("hello");
	expectTypeOf(pure).toEqualTypeOf<State<number, string>>();

	const getter = State.get<number>();
	expectTypeOf(getter).toEqualTypeOf<State<number, number>>();

	const putter = State.put<number>(42);
	expectTypeOf(putter).toEqualTypeOf<State<number, undefined>>();

	const modifier = State.modify<number>((n) => n + 1);
	expectTypeOf(modifier).toEqualTypeOf<State<number, undefined>>();
});

test("map: transforms produced value and preserves state threading", () => {
	const st = State.make<string, number>(42);
	const mapped = pipe(st, State.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<State<string, string>>();
});

test("chain: sequences computations while threading state type", () => {
	const st = State.make<string, number>(42);
	const chained = pipe(st, State.chain((n) => State.make<string, boolean>(n > 0)));
	expectTypeOf(chained).toEqualTypeOf<State<string, boolean>>();
});

test("apply: applies wrapped function to wrapped argument", () => {
	const fnState = State.make<string, (n: number) => boolean>((n) => n > 0);
	const argState = State.make<string, number>(42);

	const applied = pipe(fnState, State.apply(argState));
	expectTypeOf(applied).toEqualTypeOf<State<string, boolean>>();
});

test("tap: executes side effect on produced value without altering types", () => {
	const st = State.make<string, number>(42);
	const tapped = pipe(
		st,
		State.tap((n) => {
			expectTypeOf(n).toEqualTypeOf<number>();
		}),
	);
	expectTypeOf(tapped).toEqualTypeOf<State<string, number>>();
});

test("run, evaluate, execute: unpacks state computation results", () => {
	const st = State.make<string, number>(42);

	const runResult = pipe(st, State.run("initial"));
	expectTypeOf(runResult).toEqualTypeOf<readonly [number, string]>();

	const evalResult = pipe(st, State.evaluate("initial"));
	expectTypeOf(evalResult).toEqualTypeOf<number>();

	const execResult = pipe(st, State.execute("initial"));
	expectTypeOf(execResult).toEqualTypeOf<string>();
});

test("assign & assignTo: accumulates record fields over state operations", () => {
	const bound = pipe(
		State.make<number, string>("hello"),
		State.assignTo("text"),
		State.assign("length", ({ text }) => State.make<number, number>(text.length)),
	);
	expectTypeOf(bound).toEqualTypeOf<State<number, { text: string; } & { length: number; }>>();
});

test("focus: projects state operation onto sub-state using Lens", () => {
	type User = { id: number; profile: { age: number; }; };
	const profileLens: Lens<User, { age: number; }> = { get: (u) => u.profile, set: (p) => (u) => ({ ...u, profile: p }) };

	const subOp = State.modify<{ age: number; }>((p) => ({ age: p.age + 1 }));
	const focused = pipe(subOp, State.focus(profileLens));
	expectTypeOf(focused).toEqualTypeOf<State<User, undefined>>();
});

test("negative: enforces state invariants and parameter types at compile time", () => {
	const st = State.make<number, string>("hello");

	// @ts-expect-error run expects initial state of type number, but received string
	expectTypeOf(pipe(st, State.run("not-a-number"))).toBeObject();

	// @ts-expect-error evaluate expects initial state of type number, but received boolean
	expectTypeOf(pipe(st, State.evaluate(true))).toBeString();

	// @ts-expect-error execute expects initial state of type number, but received object
	expectTypeOf(pipe(st, State.execute({}))).toBeNumber();

	// @ts-expect-error modify callback must return the same state type number, not string
	expectTypeOf(State.modify<number>((_n) => "invalid")).toBeFunction();

	type User = { id: number; profile: { age: number; }; };
	const idLens: Lens<User, number> = { get: (u) => u.id, set: (id) => (u) => ({ ...u, id }) };
	const strOp = State.modify<string>((s) => s.toUpperCase());

	// @ts-expect-error focus requires lens target type to match sub-operation state type
	expectTypeOf(pipe(strOp, State.focus(idLens))).toBeFunction();

	// @ts-expect-error apply requires piped state to hold a function value, but received State<number, string>
	expectTypeOf(pipe(st, State.apply(State.make<number, number>(42)))).toBeFunction();
});
