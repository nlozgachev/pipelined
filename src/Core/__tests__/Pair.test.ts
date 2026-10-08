import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Pair } from "../Pair.ts";

test("make: creates Pair tuple", () => {
	const p = Pair.make("alice", 42);
	expectTypeOf(p).toEqualTypeOf<Pair<string, number>>();
	expect(p).toStrictEqual(["alice", 42]);
});

test("from.array: creates Pair from 2-element array", () => {
	const p = Pair.from.array(["paris", 2000] as const);
	expectTypeOf(p).toEqualTypeOf<Pair<"paris", 2000>>();
	expect(p).toStrictEqual(["paris", 2000]);
});

test("first: and second extract elements", () => {
	const p = Pair.make("foo", 100);
	expect(Pair.first(p)).toBe("foo");
	expect(Pair.second(p)).toBe(100);
});

test("mapFirst: transforms first element only", () => {
	const res = pipe(Pair.make("alice", 42), Pair.mapFirst((s) => s.toUpperCase()));
	expectTypeOf(res).toEqualTypeOf<Pair<string, number>>();
	expect(res).toStrictEqual(["ALICE", 42]);
});

test("mapSecond: transforms second element only", () => {
	const res = pipe(Pair.make("alice", 42), Pair.mapSecond((n) => n * 2));
	expectTypeOf(res).toEqualTypeOf<Pair<string, number>>();
	expect(res).toStrictEqual(["alice", 84]);
});

test("mapBoth: transforms both elements independently", () => {
	const res = pipe(Pair.make("alice", 42), Pair.mapBoth((s) => s.toUpperCase(), (n) => n * 2));
	expectTypeOf(res).toEqualTypeOf<Pair<string, number>>();
	expect(res).toStrictEqual(["ALICE", 84]);
});

test("fold: collapses pair using binary function", () => {
	const res = pipe(Pair.make("Alice", 100), Pair.fold((name, score) => `${name}: ${score}`));
	expectTypeOf(res).toEqualTypeOf<string>();
	expect(res).toBe("Alice: 100");
});

test("swap: flips pair positions", () => {
	const res = Pair.swap(Pair.make("key", 1));
	expectTypeOf(res).toEqualTypeOf<Pair<number, string>>();
	expect(res).toStrictEqual([1, "key"]);
});

test("to.array: converts pair to heterogeneous array", () => {
	const arr = Pair.to.array(Pair.make("hello", 42));
	expectTypeOf(arr).toEqualTypeOf<readonly (string | number)[]>();
	expect(arr).toStrictEqual(["hello", 42]);
});

test("tap: runs side effect with both values and returns pair unchanged", () => {
	let seen: string | null = null;
	const res = pipe(
		Pair.make("Paris", 2000),
		Pair.tap((city, pop) => {
			seen = `${city}:${pop}`;
		}),
	);
	expect(res).toStrictEqual(["Paris", 2000]);
	expect(seen).toBe("Paris:2000");
});
