import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { not } from "../not.ts";

Deno.test("not - negates a predicate function", () => {
	const isEven = (n: number) => n % 2 === 0;
	const isOdd = not(isEven);

	assertStrictEquals(isEven(0), true);
	assertStrictEquals(isOdd(0), false);

	assertStrictEquals(isEven(1), false);
	assertStrictEquals(isOdd(1), true);

	assertStrictEquals(isEven(2), true);
	assertStrictEquals(isOdd(2), false);

	assertStrictEquals(isEven(3), false);
	assertStrictEquals(isOdd(3), true);

	assertStrictEquals(isOdd(4), false);
});

Deno.test("not - works with Array.filter", () => {
	const isEven = (n: number) => n % 2 === 0;
	const numbers = [1, 2, 3, 4, 5, 6];

	const odds = numbers.filter(not(isEven));
	assertEquals(odds, [1, 3, 5]);

	const evens = numbers.filter(isEven);
	assertEquals(evens, [2, 4, 6]);
});

Deno.test("not - works with string predicates", () => {
	const isEmpty = (s: string) => s.length === 0;
	const isNonEmpty = not(isEmpty);

	assertStrictEquals(isNonEmpty("hello"), true);
	assertStrictEquals(isNonEmpty(""), false);
});

Deno.test("not - multi-argument predicates", () => {
	const isGreaterThan = (a: number, b: number) => a > b;
	const isNotGreaterThan = not(isGreaterThan);

	assertStrictEquals(isGreaterThan(5, 3), true);
	assertStrictEquals(isNotGreaterThan(5, 3), false);

	assertStrictEquals(isGreaterThan(3, 5), false);
	assertStrictEquals(isNotGreaterThan(3, 5), true);

	assertStrictEquals(isGreaterThan(3, 3), false);
	assertStrictEquals(isNotGreaterThan(3, 3), true);
});

Deno.test("not - double negation returns original result", () => {
	const isPositive = (n: number) => n > 0;
	const doubleNegated = not(not(isPositive));

	assertStrictEquals(doubleNegated(5), true);
	assertStrictEquals(doubleNegated(-5), false);
	assertStrictEquals(doubleNegated(0), false);
});

Deno.test("not - works with Array.filter and objects", () => {
	const users = [
		{ name: "Alice", admin: true },
		{ name: "Bob", admin: false },
		{ name: "Charlie", admin: true },
		{ name: "Dave", admin: false },
	];

	const isAdmin = (user: { name: string; admin: boolean }) => user.admin;
	const nonAdmins = users.filter(not(isAdmin));

	assertEquals(
		nonAdmins.map((u) => u.name),
		["Bob", "Dave"],
	);
});
