import { expect, test } from "vitest";
import { curry, curry3, curry4 } from "../curry.ts";
import { uncurry, uncurry3, uncurry4 } from "../uncurry.ts";

// --- curry (2-argument) ---

test("curry - full application", () => {
	const add = (a: number, b: number) => a + b;
	const curried = curry(add);
	expect(curried(1)(2)).toBe(3);
});

test("curry - partial application", () => {
	const add = (a: number, b: number) => a + b;
	const addTen = curry(add)(10);
	expect(addTen(5)).toBe(15);
	expect(addTen(20)).toBe(30);
});

test("curry - works with string concatenation", () => {
	const concat = (a: string, b: string) => a + b;
	const greet = curry(concat)("Hello, ");
	expect(greet("Alice")).toBe("Hello, Alice");
	expect(greet("Bob")).toBe("Hello, Bob");
});

test("curry - preserves types", () => {
	const divide = (a: number, b: number): number => a / b;
	const curried = curry(divide);
	expect(curried(10)(2)).toBe(5);
});

test("curry - round-trip with uncurry", () => {
	const add = (a: number, b: number) => a + b;
	const curried = curry(add);
	const uncurried = uncurry(curried);
	expect(uncurried(3, 4)).toBe(7);
});

// --- curry3 ---

test("curry3 - full application", () => {
	const add3 = (a: number, b: number, c: number) => a + b + c;
	const curried = curry3(add3);
	expect(curried(1)(2)(3)).toBe(6);
});

test("curry3 - partial application at each level", () => {
	const add3 = (a: number, b: number, c: number) => a + b + c;
	const curried = curry3(add3);

	const withFirst = curried(10);
	const withSecond = withFirst(20);
	expect(withSecond(30)).toBe(60);
});

test("curry3 - reuse partial applications", () => {
	const volume = (l: number, w: number, h: number) => l * w * h;
	const curried = curry3(volume);

	const withLength10 = curried(10);
	const box10x5 = withLength10(5);
	expect(box10x5(2)).toBe(100);
	expect(box10x5(3)).toBe(150);
});

test("curry3 - round-trip with uncurry3", () => {
	const add3 = (a: number, b: number, c: number) => a + b + c;
	const curried = curry3(add3);
	const uncurried = uncurry3(curried);
	expect(uncurried(1, 2, 3)).toBe(6);
});

// --- curry4 ---

test("curry4 - full application", () => {
	const add4 = (a: number, b: number, c: number, d: number) => a + b + c + d;
	const curried = curry4(add4);
	expect(curried(1)(2)(3)(4)).toBe(10);
});

test("curry4 - partial application at each level", () => {
	const add4 = (a: number, b: number, c: number, d: number) => a + b + c + d;
	const curried = curry4(add4);

	const step1 = curried(10);
	const step2 = step1(20);
	const step3 = step2(30);
	expect(step3(40)).toBe(100);
});

test("curry4 - reuse partial applications", () => {
	const format = (a: string, b: string, c: string, d: string) => `${a}-${b}-${c}-${d}`;
	const curried = curry4(format);

	const withA = curried("A");
	const withAB = withA("B");
	expect(withAB("C")("D")).toBe("A-B-C-D");
	expect(withAB("X")("Y")).toBe("A-B-X-Y");
});

test("curry4 - round-trip with uncurry4", () => {
	const add4 = (a: number, b: number, c: number, d: number) => a + b + c + d;
	const curried = curry4(add4);
	const uncurried = uncurry4(curried);
	expect(uncurried(1, 2, 3, 4)).toBe(10);
});
