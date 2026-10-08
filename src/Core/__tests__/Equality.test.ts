import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Equality } from "../Equality.ts";

// ---------------------------------------------------------------------------
// string
// ---------------------------------------------------------------------------

test("string: returns true for equal strings", () => {
	expect(Equality.string("hello", "hello")).toBe(true);
});

test("string: returns false for different strings", () => {
	expect(Equality.string("hello", "world")).toBe(false);
});

test("string: is case-sensitive", () => {
	expect(Equality.string("Hello", "hello")).toBe(false);
});

// ---------------------------------------------------------------------------
// number
// ---------------------------------------------------------------------------

test("number: returns true for equal numbers", () => {
	expect(Equality.number(42, 42)).toBe(true);
});

test("number: returns false for different numbers", () => {
	expect(Equality.number(1, 2)).toBe(false);
});

// ---------------------------------------------------------------------------
// boolean
// ---------------------------------------------------------------------------

test("boolean: returns true for matching booleans", () => {
	expect(Equality.boolean(true, true)).toBe(true);
	expect(Equality.boolean(false, false)).toBe(true);
});

test("boolean: returns false for different booleans", () => {
	expect(Equality.boolean(true, false)).toBe(false);
});

// ---------------------------------------------------------------------------
// date
// ---------------------------------------------------------------------------

test("date: returns true for dates with same time value", () => {
	expect(Equality.date(new Date("2024-01-01"), new Date("2024-01-01"))).toBe(true);
});

test("date: returns false for dates with different time values", () => {
	expect(Equality.date(new Date("2024-01-01"), new Date("2024-01-02"))).toBe(false);
});

// ---------------------------------------------------------------------------
// array
// ---------------------------------------------------------------------------

test("array: returns true for element-wise equal arrays", () => {
	expect(Equality.array(Equality.number)([1, 2, 3], [1, 2, 3])).toBe(true);
});

test("array: returns false for arrays of different length", () => {
	expect(Equality.array(Equality.number)([1, 2], [1, 2, 3])).toBe(false);
});

test("array: returns false for arrays with differing element", () => {
	expect(Equality.array(Equality.number)([1, 2, 3], [1, 2, 4])).toBe(false);
});

test("array: returns true for two empty arrays", () => {
	expect(Equality.array(Equality.number)([], [])).toBe(true);
});

// ---------------------------------------------------------------------------
// by
// ---------------------------------------------------------------------------

test("by: compares objects by extracted field", () => {
	type User = { name: string; age: number; };
	const byName = pipe(Equality.string, Equality.by((u: User) => u.name));
	expect(byName({ name: "Alice", age: 30 }, { name: "Alice", age: 25 })).toBe(true);
	expect(byName({ name: "Alice", age: 30 }, { name: "Bob", age: 30 })).toBe(false);
});

// ---------------------------------------------------------------------------
// and
// ---------------------------------------------------------------------------

test("and: returns true when both checks pass", () => {
	type User = { name: string; role: string; };
	const byName = pipe(Equality.string, Equality.by((u: User) => u.name));
	const byRole = pipe(Equality.string, Equality.by((u: User) => u.role));
	const eq = pipe(byName, Equality.and(byRole));
	expect(eq({ name: "Alice", role: "admin" }, { name: "Alice", role: "admin" })).toBe(true);
});

test("and: returns false when first check fails", () => {
	type User = { name: string; role: string; };
	const byName = pipe(Equality.string, Equality.by((u: User) => u.name));
	const byRole = pipe(Equality.string, Equality.by((u: User) => u.role));
	const eq = pipe(byName, Equality.and(byRole));
	expect(eq({ name: "Alice", role: "admin" }, { name: "Bob", role: "admin" })).toBe(false);
});

test("and: returns false when second check fails", () => {
	type User = { name: string; role: string; };
	const byName = pipe(Equality.string, Equality.by((u: User) => u.name));
	const byRole = pipe(Equality.string, Equality.by((u: User) => u.role));
	const eq = pipe(byName, Equality.and(byRole));
	expect(eq({ name: "Alice", role: "admin" }, { name: "Alice", role: "user" })).toBe(false);
});

// --- struct & tuple ---

test("struct: compares objects field-by-field", () => {
	const userEq = Equality.struct({ id: Equality.string, age: Equality.number });
	expect(userEq({ id: "1", age: 20 }, { id: "1", age: 20 })).toBe(true);
	expect(userEq({ id: "1", age: 20 }, { id: "1", age: 21 })).toBe(false);
});

test("struct: ignores inherited prototype properties in fields definition", () => {
	const proto = { inherited: Equality.string };
	const fields = Object.assign(Object.create(proto), { id: Equality.string });
	const eq = Equality.struct(fields);
	expect(eq({ id: "1" } as any, { id: "1" } as any)).toBe(true);
});

test("tuple: compares tuples element-by-element", () => {
	const pairEq = Equality.tuple(Equality.string, Equality.number);
	expect(pairEq(["a", 1], ["a", 1])).toBe(true);
	expect(pairEq(["a", 1], ["a", 2])).toBe(false);
	expect(pairEq(["a", 1] as any, ["a", 1, "extra"] as any)).toBe(false);
});

// --- side-effect isolation ---

test("by: executes side-effect function during comparison", () => {
	let called = false;
	const eq = Equality.by((x: number) => {
		called = true;
		return x;
	})(Equality.number);
	eq(1, 1);
	expect(called).toBe(true);
});

test("and: short-circuits side effect if first comparison fails", () => {
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
