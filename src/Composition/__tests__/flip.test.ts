import { assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { flip } from "../flip.ts";
import { pipe } from "../pipe.ts";

Deno.test("flip - reverses argument order of curried function", () => {
	const subtract = (a: number) => (b: number) => a - b;
	const flipped = flip(subtract);

	// subtract(10)(3) = 10 - 3 = 7
	// flipped(3)(10) = subtract(10)(3) = 10 - 3 = 7
	assertStrictEquals(subtract(10)(3), 7);
	assertStrictEquals(flipped(3)(10), 7);
});

Deno.test("flip - reverses string concatenation order", () => {
	const prepend = (prefix: string) => (str: string) => prefix + str;
	const append = flip(prepend);

	assertStrictEquals(prepend("Hello, ")("World"), "Hello, World");
	assertStrictEquals(append("World")("Hello, "), "Hello, World");
});

Deno.test("flip - applied twice returns original behavior", () => {
	const divide = (a: number) => (b: number) => a / b;
	const flippedOnce = flip(divide);
	const flippedTwice = flip(flippedOnce);

	assertStrictEquals(divide(10)(2), 5);
	assertStrictEquals(flippedTwice(10)(2), 5);
});

Deno.test("flip - partial application with flipped arguments", () => {
	const greet = (greeting: string) => (name: string) => `${greeting}, ${name}!`;
	const forAlice = flip(greet)("Alice");

	assertStrictEquals(forAlice("Hello"), "Hello, Alice!");
	assertStrictEquals(forAlice("Hi"), "Hi, Alice!");
});

Deno.test("flip - works with pipe", () => {
	const format = (value: number) => (template: string) => template.replace("{}", String(value));

	const formatValue = flip(format);

	const result = pipe(42, formatValue("Value: {}"));
	assertStrictEquals(result, "Value: 42");
});

Deno.test("flip - data-last to data-first conversion", () => {
	const contains = (item: number) => (arr: number[]) => arr.includes(item);
	const containsIn = flip(contains);

	const hasThree = containsIn([1, 2, 3]);
	assertStrictEquals(hasThree(3), true);
	assertStrictEquals(hasThree(4), false);
});
