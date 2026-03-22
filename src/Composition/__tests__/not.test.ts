import { expect, test } from "vitest";
import { not } from "../not.ts";

test("not - negates a predicate function", () => {
	const isEven = (n: number) => n % 2 === 0;
	const isOdd = not(isEven);

	expect(isEven(0)).toBe(true);
	expect(isOdd(0)).toBe(false);

	expect(isEven(1)).toBe(false);
	expect(isOdd(1)).toBe(true);

	expect(isEven(2)).toBe(true);
	expect(isOdd(2)).toBe(false);

	expect(isEven(3)).toBe(false);
	expect(isOdd(3)).toBe(true);

	expect(isOdd(4)).toBe(false);
});

test("not - works with Array.filter", () => {
	const isEven = (n: number) => n % 2 === 0;
	const numbers = [1, 2, 3, 4, 5, 6];

	const odds = numbers.filter(not(isEven));
	expect(odds).toEqual([1, 3, 5]);

	const evens = numbers.filter(isEven);
	expect(evens).toEqual([2, 4, 6]);
});

test("not - works with string predicates", () => {
	const isEmpty = (s: string) => s.length === 0;
	const isNonEmpty = not(isEmpty);

	expect(isNonEmpty("hello")).toBe(true);
	expect(isNonEmpty("")).toBe(false);
});

test("not - multi-argument predicates", () => {
	const isGreaterThan = (a: number, b: number) => a > b;
	const isNotGreaterThan = not(isGreaterThan);

	expect(isGreaterThan(5, 3)).toBe(true);
	expect(isNotGreaterThan(5, 3)).toBe(false);

	expect(isGreaterThan(3, 5)).toBe(false);
	expect(isNotGreaterThan(3, 5)).toBe(true);

	expect(isGreaterThan(3, 3)).toBe(false);
	expect(isNotGreaterThan(3, 3)).toBe(true);
});

test("not - double negation returns original result", () => {
	const isPositive = (n: number) => n > 0;
	const doubleNegated = not(not(isPositive));

	expect(doubleNegated(5)).toBe(true);
	expect(doubleNegated(-5)).toBe(false);
	expect(doubleNegated(0)).toBe(false);
});

test("not - works with Array.filter and objects", () => {
	const users = [
		{ name: "Alice", admin: true },
		{ name: "Bob", admin: false },
		{ name: "Charlie", admin: true },
		{ name: "Dave", admin: false },
	];

	const isAdmin = (user: { name: string; admin: boolean; }) => user.admin;
	const nonAdmins = users.filter(not(isAdmin));

	expect(nonAdmins.map((u) => u.name)).toEqual(["Bob", "Dave"]);
});
