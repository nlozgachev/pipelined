import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Ordering } from "../Ordering.ts";

// ---------------------------------------------------------------------------
// string
// ---------------------------------------------------------------------------

test("Ordering.string returns negative when a comes before b alphabetically", () => {
	expect(Ordering.string("apple", "banana")).toBeLessThan(0);
});

test("Ordering.string returns positive when a comes after b alphabetically", () => {
	expect(Ordering.string("banana", "apple")).toBeGreaterThan(0);
});

test("Ordering.string returns 0 for equal strings", () => {
	expect(Ordering.string("abc", "abc")).toBe(0);
});

// ---------------------------------------------------------------------------
// number
// ---------------------------------------------------------------------------

test("Ordering.number returns negative when a < b", () => {
	expect(Ordering.number(1, 2)).toBeLessThan(0);
});

test("Ordering.number returns positive when a > b", () => {
	expect(Ordering.number(2, 1)).toBeGreaterThan(0);
});

test("Ordering.number returns 0 for equal numbers", () => {
	expect(Ordering.number(5, 5)).toBe(0);
});

// ---------------------------------------------------------------------------
// date
// ---------------------------------------------------------------------------

test("Ordering.date returns negative when a is earlier than b", () => {
	expect(Ordering.date(new Date("2024-01-01"), new Date("2024-06-01"))).toBeLessThan(0);
});

test("Ordering.date returns positive when a is later than b", () => {
	expect(Ordering.date(new Date("2024-06-01"), new Date("2024-01-01"))).toBeGreaterThan(0);
});

test("Ordering.date returns 0 for equal dates", () => {
	expect(Ordering.date(new Date("2024-01-01"), new Date("2024-01-01"))).toBe(0);
});

// ---------------------------------------------------------------------------
// reverse
// ---------------------------------------------------------------------------

test("Ordering.reverse flips a negative result to positive", () => {
	expect(Ordering.reverse(Ordering.number)(1, 2)).toBeGreaterThan(0);
});

test("Ordering.reverse flips a positive result to negative", () => {
	expect(Ordering.reverse(Ordering.number)(2, 1)).toBeLessThan(0);
});

test("Ordering.reverse preserves 0 for equal values", () => {
	expect(Ordering.reverse(Ordering.number)(5, 5)).toBe(0);
});

// ---------------------------------------------------------------------------
// thenBy
// ---------------------------------------------------------------------------

test("Ordering.thenBy uses the second ordering when the first returns 0", () => {
	type Item = { name: string; priority: number; };
	const byName = pipe(Ordering.string, Ordering.by((x: Item) => x.name));
	const byPriority = pipe(Ordering.number, Ordering.by((x: Item) => x.priority));
	const ord = pipe(byName, Ordering.thenBy(byPriority));

	const a = { name: "Task", priority: 1 };
	const b = { name: "Task", priority: 2 };
	expect(ord(a, b)).toBeLessThan(0);
});

test("Ordering.thenBy ignores the second ordering when the first is decisive", () => {
	type Item = { name: string; priority: number; };
	const byName = pipe(Ordering.string, Ordering.by((x: Item) => x.name));
	const byPriority = pipe(Ordering.number, Ordering.by((x: Item) => x.priority));
	const ord = pipe(byName, Ordering.thenBy(byPriority));

	const a = { name: "Alpha", priority: 99 };
	const b = { name: "Beta", priority: 1 };
	expect(ord(a, b)).toBeLessThan(0);
});

// ---------------------------------------------------------------------------
// by
// ---------------------------------------------------------------------------

test("Ordering.by orders objects by an extracted field", () => {
	type User = { name: string; };
	const byName = pipe(Ordering.string, Ordering.by((u: User) => u.name));
	expect(byName({ name: "Alice" }, { name: "Bob" })).toBeLessThan(0);
	expect(byName({ name: "Bob" }, { name: "Alice" })).toBeGreaterThan(0);
	expect(byName({ name: "Alice" }, { name: "Alice" })).toBe(0);
});
