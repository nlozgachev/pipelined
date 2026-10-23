import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Pair } from "../Pair.ts";

test("make: constructs a readonly pair tuple", () => {
	const pair = Pair.make("alice", 42);
	expectTypeOf(pair).toEqualTypeOf<Pair<string, number>>();
	expectTypeOf(pair).toEqualTypeOf<readonly [string, number]>();
});

test("first & second: extracts values from pair", () => {
	const pair = Pair.make("alice", 42);
	expectTypeOf(Pair.first(pair)).toEqualTypeOf<string>();
	expectTypeOf(Pair.second(pair)).toEqualTypeOf<number>();
});

test("mapFirst: transforms first element and preserves second", () => {
	const pair = Pair.make("alice", 42);
	const mapped = pipe(pair, Pair.mapFirst((s) => s.length));
	expectTypeOf(mapped).toEqualTypeOf<Pair<number, number>>();
});

test("mapSecond: transforms second element and preserves first", () => {
	const pair = Pair.make("alice", 42);
	const mapped = pipe(pair, Pair.mapSecond((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Pair<string, string>>();
});

test("mapBoth: transforms both elements simultaneously", () => {
	const pair = Pair.make("alice", 42);
	const mapped = pipe(pair, Pair.mapBoth((s) => s.length, (n) => n > 0));
	expectTypeOf(mapped).toEqualTypeOf<Pair<number, boolean>>();
});

test("merge: collapses pair into a single value via accumulator", () => {
	const pair = Pair.make("alice", 42);
	const merged = pipe(pair, Pair.merge((s, n) => `${s}: ${n}`));
	expectTypeOf(merged).toEqualTypeOf<string>();
});

test("swap: interchanges elements of pair", () => {
	const pair = Pair.make("alice", 42);
	const swapped = Pair.swap(pair);
	expectTypeOf(swapped).toEqualTypeOf<Pair<number, string>>();
});

test("to.array: converts pair to heterogeneous readonly array", () => {
	const pair = Pair.make("alice", 42);
	const arr = Pair.to.array(pair);
	expectTypeOf(arr).toEqualTypeOf<readonly (string | number)[]>();
});

test("tap: executes side effect on both values without altering pair", () => {
	const pair = Pair.make("alice", 42);
	const tapped = pipe(
		pair,
		Pair.tap((name, score) => {
			expectTypeOf(name).toEqualTypeOf<string>();
			expectTypeOf(score).toEqualTypeOf<number>();
		}),
	);
	expectTypeOf(tapped).toEqualTypeOf<Pair<string, number>>();
});
