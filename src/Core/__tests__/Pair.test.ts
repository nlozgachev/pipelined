import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Pair } from "../Pair.ts";

test("Pair.from.pair creates a Pair [A, B]", () => {
	const p = Pair.from.pair("alice", 42);
	expectTypeOf(p).toEqualTypeOf<Pair<string, number>>();
	expect(p).toStrictEqual(["alice", 42]);
});

test("Pair.from.array creates a Pair from a 2-element array", () => {
	const p = Pair.from.array(["paris", 2000] as const);
	expectTypeOf(p).toEqualTypeOf<Pair<"paris", 2000>>();
	expect(p).toStrictEqual(["paris", 2000]);
});

test("Pair.first and Pair.second extract elements", () => {
	const p = Pair.from.pair("foo", 100);
	expect(Pair.first(p)).toBe("foo");
	expect(Pair.second(p)).toBe(100);
});

test("Pair.mapFirst transforms first element only", () => {
	const res = pipe(Pair.from.pair("alice", 42), Pair.mapFirst((s) => s.toUpperCase()));
	expectTypeOf(res).toEqualTypeOf<Pair<string, number>>();
	expect(res).toStrictEqual(["ALICE", 42]);
});

test("Pair.mapSecond transforms second element only", () => {
	const res = pipe(Pair.from.pair("alice", 42), Pair.mapSecond((n) => n * 2));
	expectTypeOf(res).toEqualTypeOf<Pair<string, number>>();
	expect(res).toStrictEqual(["alice", 84]);
});

test("Pair.mapBoth transforms both elements independently", () => {
	const res = pipe(Pair.from.pair("alice", 42), Pair.mapBoth((s) => s.toUpperCase(), (n) => n * 2));
	expectTypeOf(res).toEqualTypeOf<Pair<string, number>>();
	expect(res).toStrictEqual(["ALICE", 84]);
});

test("Pair.fold collapses pair using binary function", () => {
	const res = pipe(Pair.from.pair("Alice", 100), Pair.fold((name, score) => `${name}: ${score}`));
	expectTypeOf(res).toEqualTypeOf<string>();
	expect(res).toBe("Alice: 100");
});

test("Pair.swap flips pair positions", () => {
	const res = Pair.swap(Pair.from.pair("key", 1));
	expectTypeOf(res).toEqualTypeOf<Pair<number, string>>();
	expect(res).toStrictEqual([1, "key"]);
});

test("Pair.to.Array converts pair to heterogeneous array", () => {
	const arr = Pair.to.Array(Pair.from.pair("hello", 42));
	expectTypeOf(arr).toEqualTypeOf<readonly (string | number)[]>();
	expect(arr).toStrictEqual(["hello", 42]);
});

test("Pair.tap runs side effect with both values and returns pair unchanged", () => {
	let seen: string | null = null;
	const res = pipe(
		Pair.from.pair("Paris", 2000),
		Pair.tap((city, pop) => {
			seen = `${city}:${pop}`;
		}),
	);
	expect(res).toStrictEqual(["Paris", 2000]);
	expect(seen).toBe("Paris:2000");
});
