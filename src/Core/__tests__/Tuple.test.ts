import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Tuple } from "../Tuple.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

Deno.test("Tuple.make creates a pair with both values", () => {
	assertEquals(Tuple.make("alice", 42), ["alice", 42]);
});

Deno.test("Tuple.make values are accessible by index", () => {
	const t = Tuple.make("hello", true);
	assertStrictEquals(t[0], "hello");
	assertStrictEquals(t[1], true);
});

// ---------------------------------------------------------------------------
// first / second
// ---------------------------------------------------------------------------

Deno.test("Tuple.first returns the first value", () => {
	assertStrictEquals(Tuple.first(Tuple.make("paris", 42)), "paris");
});

Deno.test("Tuple.second returns the second value", () => {
	assertStrictEquals(Tuple.second(Tuple.make("paris", 42)), 42);
});

Deno.test("Tuple.first works with pipe", () => {
	assertStrictEquals(pipe(Tuple.make(99, "x"), Tuple.first), 99);
});

Deno.test("Tuple.second works with pipe", () => {
	assertStrictEquals(pipe(Tuple.make(99, "x"), Tuple.second), "x");
});

// ---------------------------------------------------------------------------
// mapFirst
// ---------------------------------------------------------------------------

Deno.test("Tuple.mapFirst transforms the first value", () => {
	assertEquals(
		pipe(Tuple.make("alice", 42), Tuple.mapFirst((s) => s.toUpperCase())),
		["ALICE", 42],
	);
});

Deno.test("Tuple.mapFirst leaves the second value unchanged", () => {
	const t = Tuple.make(5, "unchanged");
	const result = pipe(t, Tuple.mapFirst((n: number) => n * 10));
	assertStrictEquals(result[1], "unchanged");
});

Deno.test("Tuple.mapFirst can change the first value type", () => {
	assertEquals(
		pipe(Tuple.make(42, true), Tuple.mapFirst((n: number) => `num:${n}`)),
		["num:42", true],
	);
});

// ---------------------------------------------------------------------------
// mapSecond
// ---------------------------------------------------------------------------

Deno.test("Tuple.mapSecond transforms the second value", () => {
	assertEquals(
		pipe(Tuple.make("alice", 42), Tuple.mapSecond((n: number) => n * 2)),
		["alice", 84],
	);
});

Deno.test("Tuple.mapSecond leaves the first value unchanged", () => {
	const t = Tuple.make("unchanged", 5);
	const result = pipe(t, Tuple.mapSecond((n: number) => n * 10));
	assertStrictEquals(result[0], "unchanged");
});

Deno.test("Tuple.mapSecond can change the second value type", () => {
	assertEquals(
		pipe(Tuple.make("key", 7), Tuple.mapSecond((n: number) => n > 5)),
		["key", true],
	);
});

// ---------------------------------------------------------------------------
// mapBoth
// ---------------------------------------------------------------------------

Deno.test("Tuple.mapBoth transforms both values independently", () => {
	assertEquals(
		pipe(
			Tuple.make("alice", 42),
			Tuple.mapBoth(
				(s: string) => s.toUpperCase(),
				(n: number) => n * 2,
			),
		),
		["ALICE", 84],
	);
});

Deno.test("Tuple.mapBoth calls both functions", () => {
	let firstCalled = false;
	let secondCalled = false;
	pipe(
		Tuple.make(1, 2),
		Tuple.mapBoth(
			(n: number) => {
				firstCalled = true;
				return n;
			},
			(n: number) => {
				secondCalled = true;
				return n;
			},
		),
	);
	assertStrictEquals(firstCalled, true);
	assertStrictEquals(secondCalled, true);
});

Deno.test("Tuple.mapBoth can change both value types", () => {
	assertEquals(
		pipe(Tuple.make(42, true), Tuple.mapBoth((n: number) => String(n), (b: boolean) => (b ? 1 : 0))),
		["42", 1],
	);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

Deno.test("Tuple.fold applies the binary function to both values", () => {
	assertStrictEquals(
		pipe(Tuple.make("Alice", 100), Tuple.fold((name: string, score: number) => `${name}: ${score}`)),
		"Alice: 100",
	);
});

Deno.test("Tuple.fold receives first value as first argument and second as second", () => {
	const args: [string, number][] = [];
	pipe(
		Tuple.make("x", 99),
		Tuple.fold((a: string, b: number) => {
			args.push([a, b]);
			return 0;
		}),
	);
	assertEquals(args, [["x", 99]]);
});

// ---------------------------------------------------------------------------
// swap
// ---------------------------------------------------------------------------

Deno.test("Tuple.swap reverses the pair", () => {
	assertEquals(Tuple.swap(Tuple.make("key", 1)), [1, "key"]);
});

Deno.test("Tuple.swap is its own inverse", () => {
	const t = Tuple.make("a", 42);
	assertEquals(Tuple.swap(Tuple.swap(t)), t);
});

Deno.test("Tuple.swap works with homogeneous pairs", () => {
	assertEquals(Tuple.swap(Tuple.make(1, 2)), [2, 1]);
});

// ---------------------------------------------------------------------------
// toArray
// ---------------------------------------------------------------------------

Deno.test("Tuple.toArray returns both elements in order", () => {
	assertEquals(Tuple.toArray(Tuple.make("hello", 42)), ["hello", 42]);
});

Deno.test("Tuple.toArray returns a new array (not the original tuple)", () => {
	const t = Tuple.make(1, 2);
	const arr = Tuple.toArray(t);
	assertStrictEquals(arr === (t as unknown), false);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

Deno.test("Tuple.tap executes side effect with both values", () => {
	let seenFirst = "";
	let seenSecond = 0;
	pipe(
		Tuple.make("paris", 2_161_000),
		Tuple.tap((city: string, pop: number) => {
			seenFirst = city;
			seenSecond = pop;
		}),
	);
	assertStrictEquals(seenFirst, "paris");
	assertStrictEquals(seenSecond, 2_161_000);
});

Deno.test("Tuple.tap returns the original tuple unchanged", () => {
	const t = Tuple.make("alice", 42);
	const result = pipe(t, Tuple.tap(() => {}));
	assertEquals(result, t);
});

Deno.test("Tuple.tap does not mutate the tuple", () => {
	const t = Tuple.make(1, 2);
	pipe(t, Tuple.tap((_a, _b) => {}));
	assertEquals(t, [1, 2]);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("Tuple composes well in a pipe chain", () => {
	const result = pipe(
		Tuple.make("alice", 42),
		Tuple.mapFirst((s: string) => s.toUpperCase()),
		Tuple.mapSecond((n: number) => n * 2),
		Tuple.fold((name: string, score: number) => `${name}: ${score}`),
	);
	assertStrictEquals(result, "ALICE: 84");
});

Deno.test("Tuple pipe chain with mapBoth and swap", () => {
	const result = pipe(
		Tuple.make(5, "hello"),
		Tuple.mapBoth(
			(n: number) => n + 1,
			(s: string) => s.length,
		),
		Tuple.swap,
		Tuple.fold((a: number, b: number) => a + b),
	);
	assertStrictEquals(result, 11); // swap([6, 5]) = [5, 6], fold = 11
});

Deno.test("Tuple tap does not interrupt pipeline", () => {
	let logged = "";
	const result = pipe(
		Tuple.make("product", 9.99),
		Tuple.tap((name, price) => {
			logged = `${name}@${price}`;
		}),
		Tuple.mapSecond((price: number) => price * 1.2),
		Tuple.fold((name: string, price: number) => `${name}: ${price.toFixed(2)}`),
	);
	assertStrictEquals(logged, "product@9.99");
	assertStrictEquals(result, "product: 11.99");
});
