import { assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { curry, curry3, curry4 } from "../curry.ts";
import { uncurry, uncurry3, uncurry4 } from "../uncurry.ts";

// --- curry (2-argument) ---

Deno.test("curry - full application", () => {
	const add = (a: number, b: number) => a + b;
	const curried = curry(add);
	assertStrictEquals(curried(1)(2), 3);
});

Deno.test("curry - partial application", () => {
	const add = (a: number, b: number) => a + b;
	const addTen = curry(add)(10);
	assertStrictEquals(addTen(5), 15);
	assertStrictEquals(addTen(20), 30);
});

Deno.test("curry - works with string concatenation", () => {
	const concat = (a: string, b: string) => a + b;
	const greet = curry(concat)("Hello, ");
	assertStrictEquals(greet("Alice"), "Hello, Alice");
	assertStrictEquals(greet("Bob"), "Hello, Bob");
});

Deno.test("curry - preserves types", () => {
	const divide = (a: number, b: number): number => a / b;
	const curried = curry(divide);
	assertStrictEquals(curried(10)(2), 5);
});

Deno.test("curry - round-trip with uncurry", () => {
	const add = (a: number, b: number) => a + b;
	const curried = curry(add);
	const uncurried = uncurry(curried);
	assertStrictEquals(uncurried(3, 4), 7);
});

// --- curry3 ---

Deno.test("curry3 - full application", () => {
	const add3 = (a: number, b: number, c: number) => a + b + c;
	const curried = curry3(add3);
	assertStrictEquals(curried(1)(2)(3), 6);
});

Deno.test("curry3 - partial application at each level", () => {
	const add3 = (a: number, b: number, c: number) => a + b + c;
	const curried = curry3(add3);

	const withFirst = curried(10);
	const withSecond = withFirst(20);
	assertStrictEquals(withSecond(30), 60);
});

Deno.test("curry3 - reuse partial applications", () => {
	const volume = (l: number, w: number, h: number) => l * w * h;
	const curried = curry3(volume);

	const withLength10 = curried(10);
	const box10x5 = withLength10(5);
	assertStrictEquals(box10x5(2), 100);
	assertStrictEquals(box10x5(3), 150);
});

Deno.test("curry3 - round-trip with uncurry3", () => {
	const add3 = (a: number, b: number, c: number) => a + b + c;
	const curried = curry3(add3);
	const uncurried = uncurry3(curried);
	assertStrictEquals(uncurried(1, 2, 3), 6);
});

// --- curry4 ---

Deno.test("curry4 - full application", () => {
	const add4 = (a: number, b: number, c: number, d: number) => a + b + c + d;
	const curried = curry4(add4);
	assertStrictEquals(curried(1)(2)(3)(4), 10);
});

Deno.test("curry4 - partial application at each level", () => {
	const add4 = (a: number, b: number, c: number, d: number) => a + b + c + d;
	const curried = curry4(add4);

	const step1 = curried(10);
	const step2 = step1(20);
	const step3 = step2(30);
	assertStrictEquals(step3(40), 100);
});

Deno.test("curry4 - reuse partial applications", () => {
	const format = (a: string, b: string, c: string, d: string) => `${a}-${b}-${c}-${d}`;
	const curried = curry4(format);

	const withA = curried("A");
	const withAB = withA("B");
	assertStrictEquals(withAB("C")("D"), "A-B-C-D");
	assertStrictEquals(withAB("X")("Y"), "A-B-X-Y");
});

Deno.test("curry4 - round-trip with uncurry4", () => {
	const add4 = (a: number, b: number, c: number, d: number) => a + b + c + d;
	const curried = curry4(add4);
	const uncurried = uncurry4(curried);
	assertStrictEquals(uncurried(1, 2, 3, 4), 10);
});
