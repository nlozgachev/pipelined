import { expect, expectTypeOf, test } from "vitest";
import { Deferred } from "../../Core/Deferred.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Result } from "../../Core/Result.ts";
import { either } from "../either.ts";
import { pipe } from "../pipe.ts";
import { pipeAsync } from "../pipeAsync.ts";
import { struct } from "../struct.ts";
import { tryCatch } from "../tryCatch.ts";
import { unless } from "../unless.ts";
import { when } from "../when.ts";

test("pipe: propagates multi-stage error union", () => {
	const step1: Result<"ERR_A", string> = Result.make.ok("start");
	const step2 = (_: string): Result<"ERR_B", string> => Result.make.err("ERR_B" as const);

	const res = pipe(step1, Result.chain(step2), Result.ensure((s: string) => s.length > 0, () => "ERR_C" as const));

	expectTypeOf(res).toMatchTypeOf<Result<"ERR_A" | "ERR_B" | "ERR_C", string>>();
	expect(res).toStrictEqual({ kind: "Err", error: "ERR_B" });
});

test("pipe: returns single value as identity", () => {
	expect(pipe(42)).toBe(42);
	expect(pipe("hello")).toBe("hello");
	expect(pipe(true)).toBe(true);
	expect(pipe(null)).toBeNull();
	expect(pipe(undefined)).toBeUndefined();
});

test("pipe: applies single function transformation", () => {
	const result = pipe(5, (n: number) => n * 2);
	expect(result).toBe(10);
});

test("pipe: applies two function transformations", () => {
	const result = pipe(5, (n: number) => n * 2, (n: number) => n + 1);
	expect(result).toBe(11);
});

test("pipe: applies three function transformations", () => {
	const result = pipe("hello", (s: string) => s.toUpperCase(), (s: string) => `${s}!`, (s: string) => s.length);
	expect(result).toBe(6);
});

test("pipe: preserves number types across chain", () => {
	const result = pipe(10, (n: number) => n / 2, (n: number) => n + 0.5);
	expect(result).toBe(5.5);
});

test("pipe: transforms types through chain", () => {
	const result = pipe(42, (n: number) => String(n), (s: string) => [...s], (arr: string[]) => arr.length);
	expect(result).toBe(2);
});

test("pipe: integrates with Maybe.map on Some", () => {
	const result = pipe(
		Maybe.make.some(5),
		Maybe.map((n: number) => n * 2),
		Maybe.map((n: number) => n + 1),
		Maybe.getOrElse(() => 0),
	);
	expect(result).toBe(11);
});

test("pipe: integrates with Maybe.map on None", () => {
	const result = pipe(Maybe.make.none() as Maybe<number>, Maybe.map((n: number) => n * 2), Maybe.getOrElse(() => 0));
	expect(result).toBe(0);
});

test("pipe: integrates with Result.map on Ok", () => {
	const result = pipe(Result.make.ok<number>(10), Result.map((n: number) => n * 3), Result.getOrElse(() => 0));
	expect(result).toBe(30);
});

test("pipe: integrates with Result.map on Err", () => {
	const result = pipe(
		Result.make.err("oops") as Result<string, number>,
		Result.map((n: number) => n * 3),
		Result.getOrElse(() => 0),
	);
	expect(result).toBe(0);
});

test("pipe: transforms object values", () => {
	const result = pipe({ name: "Alice", age: 30 }, (user) => user.name, (name) => name.toUpperCase());
	expect(result).toBe("ALICE");
});

test("pipe: transforms array values", () => {
	const result = pipe([1, 2, 3, 4, 5], (arr) => arr.filter((n) => n % 2 === 0), (arr) => arr.reduce((a, b) => a + b, 0));
	expect(result).toBe(6);
});

// ---------------------------------------------------------------------------
// switch case coverage (one test per step count to keep every case reachable)
// ---------------------------------------------------------------------------

const inc = (n: number) => n + 1;

test("pipe: passes through 4 functions", () => {
	expect(pipe(0, inc, inc, inc, inc)).toBe(4);
});

test("pipe: passes through 5 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc)).toBe(5);
});

test("pipe: passes through 6 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc)).toBe(6);
});

test("pipe: passes through 7 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc, inc)).toBe(7);
});

test("pipe: passes through 8 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc, inc, inc)).toBe(8);
});

test("pipe: passes through 9 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc, inc, inc, inc)).toBe(9);
});

test("pipe: passes through 10 functions", () => {
	expect(pipe(0, inc, inc, inc, inc, inc, inc, inc, inc, inc, inc)).toBe(10);
});

// --- when / unless / either ---

test("when: applies onTrue if predicate holds", () => {
	const doubleEven = when((n: number) => n % 2 === 0, (n: number) => n * 2);
	expect(doubleEven(2)).toBe(4);
	expect(doubleEven(3)).toBe(3);
});

test("unless: applies onFalse if predicate does not hold", () => {
	const doubleOdd = unless((n: number) => n % 2 === 0, (n: number) => n * 2);
	expect(doubleOdd(3)).toBe(6);
	expect(doubleOdd(2)).toBe(2);
});

test("either: branches appropriately based on predicate", () => {
	const describe = either((n: number) => n > 0, () => "positive", () => "non-positive");
	expect(describe(5)).toBe("positive");
	expect(describe(-1)).toBe("non-positive");
});

// --- tryCatch ---

test("tryCatch: returns result on success", () => {
	const parsed = pipe('{"value": 42}', tryCatch((s) => JSON.parse(s), () => ({ error: true })));
	expect(parsed).toStrictEqual({ value: 42 });
});

test("tryCatch: returns fallback on error", () => {
	const parsed = pipe("invalid", tryCatch((s) => JSON.parse(s), (err, input) => ({ error: true, input })));
	expect(parsed).toStrictEqual({ error: true, input: "invalid" });
});

// --- struct ---

test("struct: builds objects dynamically", () => {
	const result = pipe(
		{ firstName: "Alice", lastName: "Smith" },
		struct({ fullName: (u) => `${u.firstName} ${u.lastName}`, upper: (u) => u.firstName.toUpperCase() }),
	);
	expect(result).toStrictEqual({ fullName: "Alice Smith", upper: "ALICE" });
});

// --- pipeAsync ---

test("pipeAsync: resolves synchronous chains", async () => {
	const result = await pipeAsync(5, (n: number) => n * 2, (n: number) => n + 1);
	expect(result).toBe(11);
});

test("pipeAsync: resolves asynchronous chains", async () => {
	const result = await pipeAsync(
		Promise.resolve(5),
		(n: number) => Promise.resolve(n * 2),
		(n: number) => Promise.resolve(n + 1),
	);
	expect(result).toBe(11);
});

test("pipeAsync: resolves hybrid sync and async chains", async () => {
	const result = await pipeAsync(5, (n: number) => Promise.resolve(n * 2), (n: number) => n + 1);
	expect(result).toBe(11);
});

test("pipeAsync: resolves Deferred values and functions returning Deferred", async () => {
	const val = Deferred.from.Promise(Promise.resolve(5));
	const result = await pipeAsync(
		val,
		(n: number) => Deferred.from.Promise(Promise.resolve(n * 2)),
		(n: number) => n + 1,
	);
	expect(result).toBe(11);
});
