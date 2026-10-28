import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";
import { Logged } from "../Logged.ts";
import type { Pair } from "../Pair.ts";

test("make: infers never log channel for single-argument construction", () => {
	const init = Logged.make(42);
	expectTypeOf(init).toEqualTypeOf<Logged<never, number>>();
});

test("make: infers explicit log channel when initial array is supplied", () => {
	const init = Logged.make("order_1", ["created"]);
	expectTypeOf(init).toEqualTypeOf<Logged<string, string>>();
});

test("from.entry: creates container with undefined value and specified log type", () => {
	const entry = Logged.from.entry("started");
	expectTypeOf(entry).toEqualTypeOf<Logged<string, undefined>>();

	const numEntry = Logged.from.entry(404);
	expectTypeOf(numEntry).toEqualTypeOf<Logged<number, undefined>>();
});

test("to.Pair: extracts Pair tuple with preserved value and log channels", () => {
	const init = Logged.make("order_1", ["created"]);
	const pair = Logged.to.Pair(init);
	expectTypeOf(pair).toEqualTypeOf<Pair<string, ReadonlyArray<string>>>();
});

test("map: preserves log channel without collapsing to unknown", () => {
	const init = Logged.make("hello", ["greeting"]);
	const mapped = pipe(init, Logged.map((s) => s.length));
	expectTypeOf(mapped).toEqualTypeOf<Logged<string, number>>();
});

test("mapLog: transforms log channel while preserving value type", () => {
	const init = Logged.make(42, [1, 2, 3]);
	const mapped = pipe(init, Logged.mapLog((n) => `entry_${n}`));
	expectTypeOf(mapped).toEqualTypeOf<Logged<string, number>>();
});

test("chain: unifies disparate log channels into a union", () => {
	const init = Logged.make(42, ["init"]);
	const chained = pipe(init, Logged.chain((n) => Logged.make(n.toString(), [100])));
	expectTypeOf(chained).toEqualTypeOf<Logged<string | number, string>>();
});

test("apply: applies wrapped function and unifies log channels", () => {
	const fn = Logged.make((n: number) => `${n}!`, [true]);
	const arg = Logged.make(42, ["arg"]);
	const applied = pipe(fn, Logged.apply(arg));
	expectTypeOf(applied).toEqualTypeOf<Logged<boolean | string, string>>();
});

test("tap & tapLog: preserve exact container types", () => {
	const init = Logged.make(42, ["init"]);
	const tapped = pipe(init, Logged.tap((_n: number) => {}));
	expectTypeOf(tapped).toEqualTypeOf<Logged<string, number>>();

	const tappedLog = pipe(init, Logged.tapLog((_logs) => {}));
	expectTypeOf(tappedLog).toEqualTypeOf<Logged<string, number>>();
});

test("assign & assignTo: accumulate object fields and combine log channels", () => {
	const bound = pipe(
		Logged.make(42, ["start"]),
		Logged.assignTo("first"),
		Logged.assign("second", ({ first }) => Logged.make(first > 0, [1])),
	);
	expectTypeOf(bound).toEqualTypeOf<Logged<string | number, { first: number; } & { second: boolean; }>>();
});

test("focus: focuses computation via Lens and accumulates logs", () => {
	type State = { count: number; name: string; };
	const countLens = Lens.from.property<State>()("count");
	const stateLogged = Logged.make<string, State>({ count: 10, name: "demo" }, ["init"]);

	const focused = pipe(stateLogged, Logged.focus(countLens)((c) => Logged.make(c + 1, [200])));
	expectTypeOf(focused).toEqualTypeOf<Logged<string | number, State>>();
});

test("chain: negative compilation assertions", () => {
	const init = Logged.make(42);

	// @ts-expect-error chain callback must return a Logged container
	expectTypeOf(pipe(init, Logged.chain((n) => n * 2))).toBeObject();
});

test("apply: negative compilation assertions", () => {
	const fn = Logged.make((n: number) => n * 2);

	// @ts-expect-error argument to apply must be a Logged container
	expectTypeOf(pipe(fn, Logged.apply(42))).toBeObject();
});

test("focus: negative compilation assertions", () => {
	type State = { count: number; };
	const countLens = Lens.from.property<State>()("count");
	const stateLogged = Logged.make<string, State>({ count: 10 });

	// @ts-expect-error focus callback must return a Logged container matching the focused property type
	expectTypeOf(pipe(stateLogged, Logged.focus(countLens)((c) => c + 1))).toBeObject();
});
