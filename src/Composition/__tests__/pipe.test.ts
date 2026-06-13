import { pipe } from "#composition";
import { Deferred, Maybe, Result } from "#core";
import { expect, test } from "vitest";

test("pipe - single value (identity)", () => {
	expect(pipe(42)).toBe(42);
	expect(pipe("hello")).toBe("hello");
	expect(pipe(true)).toBe(true);
	expect(pipe(null)).toBeNull();
	expect(pipe(undefined)).toBeUndefined();
});

test("pipe - single function transformation", () => {
	const result = pipe(5, (n: number) => n * 2);
	expect(result).toBe(10);
});

test("pipe - two function transformations", () => {
	const result = pipe(5, (n: number) => n * 2, (n: number) => n + 1);
	expect(result).toBe(11);
});

test("pipe - three function transformations", () => {
	const result = pipe("hello", (s: string) => s.toUpperCase(), (s: string) => `${s}!`, (s: string) => s.length);
	expect(result).toBe(6);
});

test("pipe - type preservation through number chain", () => {
	const result = pipe(10, (n: number) => n / 2, (n: number) => n + 0.5);
	expect(result).toBe(5.5);
});

test("pipe - type transformation through chain", () => {
	const result = pipe(42, (n: number) => String(n), (s: string) => [...s], (arr: string[]) => arr.length);
	expect(result).toBe(2);
});

test("pipe - integration with Maybe.map", () => {
	const result = pipe(
		Maybe.some(5),
		Maybe.map((n: number) => n * 2),
		Maybe.map((n: number) => n + 1),
		Maybe.getOrElse(() => 0),
	);
	expect(result).toBe(11);
});

test("pipe - integration with Maybe.map on None", () => {
	const result = pipe(Maybe.none() as Maybe<number>, Maybe.map((n: number) => n * 2), Maybe.getOrElse(() => 0));
	expect(result).toBe(0);
});

test("pipe - integration with Result.map on Ok", () => {
	const result = pipe(Result.ok<number>(10), Result.map((n: number) => n * 3), Result.getOrElse(() => 0));
	expect(result).toBe(30);
});

test("pipe - integration with Result.map on Err", () => {
	const result = pipe(
		Result.err("oops") as Result<string, number>,
		Result.map((n: number) => n * 3),
		Result.getOrElse(() => 0),
	);
	expect(result).toBe(0);
});

test("pipe - works with objects", () => {
	const result = pipe({ name: "Alice", age: 30 }, (user) => user.name, (name) => name.toUpperCase());
	expect(result).toBe("ALICE");
});

test("pipe - works with arrays", () => {
	const result = pipe([1, 2, 3, 4, 5], (arr) => arr.filter((n) => n % 2 === 0), (arr) => arr.reduce((a, b) => a + b, 0));
	expect(result).toBe(6);
});

// ---------------------------------------------------------------------------
// switch case coverage (one test per step count to keep every case reachable)
// ---------------------------------------------------------------------------

const inc = (n: number) => n + 1;

test("pipe - 4 functions", () => {
	expect(pipe(0, inc, inc, inc, inc)).toBe(4);
});

test("pipe - 5 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc)).toBe(5);
});

test("pipe - 6 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc)).toBe(6);
});

test("pipe - 7 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc, inc)).toBe(7);
});

test("pipe - 8 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc, inc, inc)).toBe(8);
});

test("pipe - 9 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc, inc, inc, inc)).toBe(9);
});

test("pipe - 10 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc, inc, inc, inc, inc)).toBe(10);
});

// --- pipe.when / pipe.unless / pipe.either ---

test("pipe.when - applies onTrue if predicate holds", () => {
	const doubleEven = pipe.when((n: number) => n % 2 === 0, (n: number) => n * 2);
	expect(doubleEven(2)).toBe(4);
	expect(doubleEven(3)).toBe(3);
});

test("pipe.unless - applies onFalse if predicate does not hold", () => {
	const doubleOdd = pipe.unless((n: number) => n % 2 === 0, (n: number) => n * 2);
	expect(doubleOdd(3)).toBe(6);
	expect(doubleOdd(2)).toBe(2);
});

test("pipe.either - branches appropriately", () => {
	const describe = pipe.either((n: number) => n > 0, () => "positive", () => "non-positive");
	expect(describe(5)).toBe("positive");
	expect(describe(-1)).toBe("non-positive");
});

// --- pipe.try ---

test("pipe.try - returns result on success", () => {
	const parsed = pipe('{"value": 42}', pipe.try((s) => JSON.parse(s), () => ({ error: true })));
	expect(parsed).toStrictEqual({ value: 42 });
});

test("pipe.try - returns fallback on error", () => {
	const parsed = pipe("invalid", pipe.try((s) => JSON.parse(s), (err, input) => ({ error: true, input })));
	expect(parsed).toStrictEqual({ error: true, input: "invalid" });
});

// --- pipe.struct ---

test("pipe.struct - builds objects dynamically", () => {
	const result = pipe(
		{ firstName: "Alice", lastName: "Smith" },
		pipe.struct({ fullName: (u) => `${u.firstName} ${u.lastName}`, upper: (u) => u.firstName.toUpperCase() }),
	);
	expect(result).toStrictEqual({ fullName: "Alice Smith", upper: "ALICE" });
});

// --- pipe.safe ---

test("pipe.safe - pipes values normally when not nil", () => {
	const result = pipe.safe("hello", (s) => s.toUpperCase(), (s) => s.length);
	expect(result).toBe(5);
});

test("pipe.safe - short-circuits on null", () => {
	let called = false;
	const result = pipe.safe(null as string | null, (s) => {
		called = true;
		return s.toUpperCase();
	}, (s) => s.length);
	expect(result).toBeNull();
	expect(called).toBe(false);
});

test("pipe.safe - short-circuits on undefined", () => {
	let called = false;
	const result = pipe.safe(undefined as string | undefined, (s) => {
		called = true;
		return s.toUpperCase();
	});
	expect(result).toBeUndefined();
	expect(called).toBe(false);
});

test("pipe.safe - short-circuits if intermediate step returns null", () => {
	let called = false;
	const result = pipe.safe({ name: null } as { name: string | null; }, (u) => u.name, (name) => {
		called = true;
		return name.length;
	});
	expect(result).toBeNull();
	expect(called).toBe(false);
});

// --- pipe.async ---

test("pipe.async - resolves synchronous chains", async () => {
	const result = await pipe.async(5, (n: number) => n * 2, (n: number) => n + 1);
	expect(result).toBe(11);
});

test("pipe.async - resolves asynchronous chains", async () => {
	const result = await pipe.async(
		Promise.resolve(5),
		(n: number) => Promise.resolve(n * 2),
		(n: number) => Promise.resolve(n + 1),
	);
	expect(result).toBe(11);
});

test("pipe.async - resolves hybrid sync and async chains", async () => {
	const result = await pipe.async(5, (n: number) => Promise.resolve(n * 2), (n: number) => n + 1);
	expect(result).toBe(11);
});

test("pipe.async - resolves Deferred values and functions returning Deferred", async () => {
	const val = Deferred.fromPromise(Promise.resolve(5));
	const result = await pipe.async(
		val,
		(n: number) => Deferred.fromPromise(Promise.resolve(n * 2)),
		(n: number) => n + 1,
	);
	expect(result).toBe(11);
});
