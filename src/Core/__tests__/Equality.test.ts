import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Equality } from "../Equality.ts";

// ---------------------------------------------------------------------------
// string
// ---------------------------------------------------------------------------

test("Equality.string returns true for equal strings", () => {
	expect(Equality.string("hello", "hello")).toBe(true);
});

test("Equality.string returns false for different strings", () => {
	expect(Equality.string("hello", "world")).toBe(false);
});

test("Equality.string is case-sensitive", () => {
	expect(Equality.string("Hello", "hello")).toBe(false);
});

// ---------------------------------------------------------------------------
// number
// ---------------------------------------------------------------------------

test("Equality.number returns true for equal numbers", () => {
	expect(Equality.number(42, 42)).toBe(true);
});

test("Equality.number returns false for different numbers", () => {
	expect(Equality.number(1, 2)).toBe(false);
});

// ---------------------------------------------------------------------------
// boolean
// ---------------------------------------------------------------------------

test("Equality.boolean returns true for matching booleans", () => {
	expect(Equality.boolean(true, true)).toBe(true);
	expect(Equality.boolean(false, false)).toBe(true);
});

test("Equality.boolean returns false for different booleans", () => {
	expect(Equality.boolean(true, false)).toBe(false);
});

// ---------------------------------------------------------------------------
// date
// ---------------------------------------------------------------------------

test("Equality.date returns true for dates with the same time value", () => {
	expect(Equality.date(new Date("2024-01-01"), new Date("2024-01-01"))).toBe(true);
});

test("Equality.date returns false for dates with different time values", () => {
	expect(Equality.date(new Date("2024-01-01"), new Date("2024-01-02"))).toBe(false);
});

// ---------------------------------------------------------------------------
// array
// ---------------------------------------------------------------------------

test("Equality.array returns true for element-wise equal arrays", () => {
	expect(Equality.array(Equality.number)([1, 2, 3], [1, 2, 3])).toBe(true);
});

test("Equality.array returns false for arrays of different length", () => {
	expect(Equality.array(Equality.number)([1, 2], [1, 2, 3])).toBe(false);
});

test("Equality.array returns false for arrays with a differing element", () => {
	expect(Equality.array(Equality.number)([1, 2, 3], [1, 2, 4])).toBe(false);
});

test("Equality.array returns true for two empty arrays", () => {
	expect(Equality.array(Equality.number)([], [])).toBe(true);
});

// ---------------------------------------------------------------------------
// by
// ---------------------------------------------------------------------------

test("Equality.by compares objects by an extracted field", () => {
	type User = { name: string; age: number; };
	const byName = pipe(Equality.string, Equality.by((u: User) => u.name));
	expect(byName({ name: "Alice", age: 30 }, { name: "Alice", age: 25 })).toBe(true);
	expect(byName({ name: "Alice", age: 30 }, { name: "Bob", age: 30 })).toBe(false);
});

// ---------------------------------------------------------------------------
// and
// ---------------------------------------------------------------------------

test("Equality.and returns true when both checks pass", () => {
	type User = { name: string; role: string; };
	const byName = pipe(Equality.string, Equality.by((u: User) => u.name));
	const byRole = pipe(Equality.string, Equality.by((u: User) => u.role));
	const eq = pipe(byName, Equality.and(byRole));
	expect(eq({ name: "Alice", role: "admin" }, { name: "Alice", role: "admin" })).toBe(true);
});

test("Equality.and returns false when the first check fails", () => {
	type User = { name: string; role: string; };
	const byName = pipe(Equality.string, Equality.by((u: User) => u.name));
	const byRole = pipe(Equality.string, Equality.by((u: User) => u.role));
	const eq = pipe(byName, Equality.and(byRole));
	expect(eq({ name: "Alice", role: "admin" }, { name: "Bob", role: "admin" })).toBe(false);
});

test("Equality.and returns false when the second check fails", () => {
	type User = { name: string; role: string; };
	const byName = pipe(Equality.string, Equality.by((u: User) => u.name));
	const byRole = pipe(Equality.string, Equality.by((u: User) => u.role));
	const eq = pipe(byName, Equality.and(byRole));
	expect(eq({ name: "Alice", role: "admin" }, { name: "Alice", role: "user" })).toBe(false);
});

// --- struct & tuple ---

test("Equality.struct compares objects field-by-field", () => {
	const userEq = Equality.struct({ id: Equality.string, age: Equality.number });
	expect(userEq({ id: "1", age: 20 }, { id: "1", age: 20 })).toBe(true);
	expect(userEq({ id: "1", age: 20 }, { id: "1", age: 21 })).toBe(false);
});

test("Equality.tuple compares tuples element-by-element", () => {
	const pairEq = Equality.tuple(Equality.string, Equality.number);
	expect(pairEq(["a", 1], ["a", 1])).toBe(true);
	expect(pairEq(["a", 1], ["a", 2])).toBe(false);
	expect(pairEq(["a", 1] as any, ["a", 1, "extra"] as any)).toBe(false);
});

// --- side-effect isolation ---

test("Equality.by executes side effect function during comparison", () => {
	let called = false;
	const eq = Equality.by((x: number) => {
		called = true;
		return x;
	})(Equality.number);
	eq(1, 1);
	expect(called).toBe(true);
});

test("Equality.and short-circuits side effect if first comparison fails", () => {
	let called = false;
	const first = () => false;
	const second = () => {
		called = true;
		return true;
	};
	const eq = pipe(first, Equality.and(second));
	eq(1, 2);
	expect(called).toBe(false);
});
