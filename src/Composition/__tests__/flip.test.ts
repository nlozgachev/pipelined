import { expect, test } from "vitest";
import { flip } from "../flip.ts";
import { pipe } from "../pipe.ts";

test("flip - reverses argument order of curried function", () => {
	const subtract = (a: number) => (b: number) => a - b;
	const flipped = flip(subtract);

	// subtract(10)(3) = 10 - 3 = 7
	// flipped(3)(10) = subtract(10)(3) = 10 - 3 = 7
	expect(subtract(10)(3)).toBe(7);
	expect(flipped(3)(10)).toBe(7);
});

test("flip - reverses string concatenation order", () => {
	const prepend = (prefix: string) => (str: string) => prefix + str;
	const append = flip(prepend);

	expect(prepend("Hello, ")("World")).toBe("Hello, World");
	expect(append("World")("Hello, ")).toBe("Hello, World");
});

test("flip - applied twice returns original behavior", () => {
	const divide = (a: number) => (b: number) => a / b;
	const flippedOnce = flip(divide);
	const flippedTwice = flip(flippedOnce);

	expect(divide(10)(2)).toBe(5);
	expect(flippedTwice(10)(2)).toBe(5);
});

test("flip - partial application with flipped arguments", () => {
	const greet = (greeting: string) => (name: string) => `${greeting}, ${name}!`;
	const forAlice = flip(greet)("Alice");

	expect(forAlice("Hello")).toBe("Hello, Alice!");
	expect(forAlice("Hi")).toBe("Hi, Alice!");
});

test("flip - works with pipe", () => {
	const format = (value: number) => (template: string) => template.replace("{}", String(value));

	const formatValue = flip(format);

	const result = pipe(42, formatValue("Value: {}"));
	expect(result).toBe("Value: 42");
});

test("flip - data-last to data-first conversion", () => {
	const contains = (item: number) => (arr: number[]) => arr.includes(item);
	const containsIn = flip(contains);

	const hasThree = containsIn([1, 2, 3]);
	expect(hasThree(3)).toBe(true);
	expect(hasThree(4)).toBe(false);
});
