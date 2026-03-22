import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Tuple } from "../Tuple.ts";

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("Tuple.make creates a pair with both values", () => {
	expect(Tuple.make("alice", 42)).toEqual(["alice", 42]);
});

test("Tuple.make values are accessible by index", () => {
	const t = Tuple.make("hello", true);
	expect(t[0]).toBe("hello");
	expect(t[1]).toBe(true);
});

// ---------------------------------------------------------------------------
// first / second
// ---------------------------------------------------------------------------

test("Tuple.first returns the first value", () => {
	expect(Tuple.first(Tuple.make("paris", 42))).toBe("paris");
});

test("Tuple.second returns the second value", () => {
	expect(Tuple.second(Tuple.make("paris", 42))).toBe(42);
});

test("Tuple.first works with pipe", () => {
	expect(pipe(Tuple.make(99, "x"), Tuple.first)).toBe(99);
});

test("Tuple.second works with pipe", () => {
	expect(pipe(Tuple.make(99, "x"), Tuple.second)).toBe("x");
});

// ---------------------------------------------------------------------------
// mapFirst
// ---------------------------------------------------------------------------

test("Tuple.mapFirst transforms the first value", () => {
	expect(pipe(Tuple.make("alice", 42), Tuple.mapFirst((s) => s.toUpperCase()))).toEqual(["ALICE", 42]);
});

test("Tuple.mapFirst leaves the second value unchanged", () => {
	const t = Tuple.make(5, "unchanged");
	const result = pipe(t, Tuple.mapFirst((n: number) => n * 10));
	expect(result[1]).toBe("unchanged");
});

test("Tuple.mapFirst can change the first value type", () => {
	expect(pipe(Tuple.make(42, true), Tuple.mapFirst((n: number) => `num:${n}`))).toEqual(["num:42", true]);
});

// ---------------------------------------------------------------------------
// mapSecond
// ---------------------------------------------------------------------------

test("Tuple.mapSecond transforms the second value", () => {
	expect(pipe(Tuple.make("alice", 42), Tuple.mapSecond((n: number) => n * 2))).toEqual(["alice", 84]);
});

test("Tuple.mapSecond leaves the first value unchanged", () => {
	const t = Tuple.make("unchanged", 5);
	const result = pipe(t, Tuple.mapSecond((n: number) => n * 10));
	expect(result[0]).toBe("unchanged");
});

test("Tuple.mapSecond can change the second value type", () => {
	expect(pipe(Tuple.make("key", 7), Tuple.mapSecond((n: number) => n > 5))).toEqual(["key", true]);
});

// ---------------------------------------------------------------------------
// mapBoth
// ---------------------------------------------------------------------------

test("Tuple.mapBoth transforms both values independently", () => {
	expect(pipe(
		Tuple.make("alice", 42),
		Tuple.mapBoth(
			(s: string) => s.toUpperCase(),
			(n: number) => n * 2,
		),
	)).toEqual(["ALICE", 84]);
});

test("Tuple.mapBoth calls both functions", () => {
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
	expect(firstCalled).toBe(true);
	expect(secondCalled).toBe(true);
});

test("Tuple.mapBoth can change both value types", () => {
	expect(pipe(Tuple.make(42, true), Tuple.mapBoth((n: number) => String(n), (b: boolean) => (b ? 1 : 0)))).toEqual([
		"42",
		1,
	]);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Tuple.fold applies the binary function to both values", () => {
	expect(pipe(Tuple.make("Alice", 100), Tuple.fold((name: string, score: number) => `${name}: ${score}`))).toBe(
		"Alice: 100",
	);
});

test("Tuple.fold receives first value as first argument and second as second", () => {
	const args: [string, number][] = [];
	pipe(
		Tuple.make("x", 99),
		Tuple.fold((a: string, b: number) => {
			args.push([a, b]);
			return 0;
		}),
	);
	expect(args).toEqual([["x", 99]]);
});

// ---------------------------------------------------------------------------
// swap
// ---------------------------------------------------------------------------

test("Tuple.swap reverses the pair", () => {
	expect(Tuple.swap(Tuple.make("key", 1))).toEqual([1, "key"]);
});

test("Tuple.swap is its own inverse", () => {
	const t = Tuple.make("a", 42);
	expect(Tuple.swap(Tuple.swap(t))).toEqual(t);
});

test("Tuple.swap works with homogeneous pairs", () => {
	expect(Tuple.swap(Tuple.make(1, 2))).toEqual([2, 1]);
});

// ---------------------------------------------------------------------------
// toArray
// ---------------------------------------------------------------------------

test("Tuple.toArray returns both elements in order", () => {
	expect(Tuple.toArray(Tuple.make("hello", 42))).toEqual(["hello", 42]);
});

test("Tuple.toArray returns a new array (not the original tuple)", () => {
	const t = Tuple.make(1, 2);
	const arr = Tuple.toArray(t);
	expect(arr).not.toBe(t as unknown);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("Tuple.tap executes side effect with both values", () => {
	let seenFirst = "";
	let seenSecond = 0;
	pipe(
		Tuple.make("paris", 2_161_000),
		Tuple.tap((city: string, pop: number) => {
			seenFirst = city;
			seenSecond = pop;
		}),
	);
	expect(seenFirst).toBe("paris");
	expect(seenSecond).toBe(2_161_000);
});

test("Tuple.tap returns the original tuple unchanged", () => {
	const t = Tuple.make("alice", 42);
	const result = pipe(t, Tuple.tap(() => {}));
	expect(result).toEqual(t);
});

test("Tuple.tap does not mutate the tuple", () => {
	const t = Tuple.make(1, 2);
	pipe(t, Tuple.tap((_a, _b) => {}));
	expect(t).toEqual([1, 2]);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Tuple composes well in a pipe chain", () => {
	const result = pipe(
		Tuple.make("alice", 42),
		Tuple.mapFirst((s: string) => s.toUpperCase()),
		Tuple.mapSecond((n: number) => n * 2),
		Tuple.fold((name: string, score: number) => `${name}: ${score}`),
	);
	expect(result).toBe("ALICE: 84");
});

test("Tuple pipe chain with mapBoth and swap", () => {
	const result = pipe(
		Tuple.make(5, "hello"),
		Tuple.mapBoth(
			(n: number) => n + 1,
			(s: string) => s.length,
		),
		Tuple.swap,
		Tuple.fold((a: number, b: number) => a + b),
	);
	expect(result).toBe(11); // swap([6, 5]) = [5, 6], fold = 11
});

test("Tuple tap does not interrupt pipeline", () => {
	let logged = "";
	const result = pipe(
		Tuple.make("product", 9.99),
		Tuple.tap((name, price) => {
			logged = `${name}@${price}`;
		}),
		Tuple.mapSecond((price: number) => price * 1.2),
		Tuple.fold((name: string, price: number) => `${name}: ${price.toFixed(2)}`),
	);
	expect(logged).toBe("product@9.99");
	expect(result).toBe("product: 11.99");
});
