import { assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { uncurry, uncurry3, uncurry4 } from "../uncurry.ts";

// --- uncurry: thunk () => () => C ---

Deno.test("uncurry - thunk: () => () => 42", () => {
	const nested = () => () => 42;
	const flat = uncurry(nested);
	assertStrictEquals(flat(), 42);
});

Deno.test("uncurry - thunk: () => () => string", () => {
	const nested = () => () => "hello";
	const flat = uncurry(nested);
	assertStrictEquals(flat(), "hello");
});

// --- uncurry: partial (a) => () => C ---

Deno.test("uncurry - partial: (a) => () => a", () => {
	const nested = (a: number) => () => a;
	const flat = uncurry(nested);
	assertStrictEquals(flat(42), 42);
});

Deno.test("uncurry - partial: (a) => () => a * 2", () => {
	const nested = (a: number) => () => a * 2;
	const flat = uncurry(nested);
	assertStrictEquals(flat(5), 10);
});

// --- uncurry: full (a) => (b) => C ---

Deno.test("uncurry - full: (a) => (b) => a + b", () => {
	const curriedAdd = (a: number) => (b: number) => a + b;
	const add = uncurry(curriedAdd);
	assertStrictEquals(add(3, 4), 7);
});

Deno.test("uncurry - full: string concatenation", () => {
	const curriedConcat = (a: string) => (b: string) => a + b;
	const concat = uncurry(curriedConcat);
	assertStrictEquals(concat("Hello, ", "World"), "Hello, World");
});

Deno.test("uncurry - full: different argument types", () => {
	const curriedRepeat = (s: string) => (n: number) => s.repeat(n);
	const repeat = uncurry(curriedRepeat);
	assertStrictEquals(repeat("ab", 3), "ababab");
});

// --- uncurry3 ---

Deno.test("uncurry3 - basic usage", () => {
	const curried = (a: number) => (b: number) => (c: number) => a + b + c;
	const flat = uncurry3(curried);
	assertStrictEquals(flat(1, 2, 3), 6);
});

Deno.test("uncurry3 - string formatting", () => {
	const curried = (first: string) => (middle: string) => (last: string) => `${first} ${middle} ${last}`;
	const format = uncurry3(curried);
	assertStrictEquals(format("John", "Q", "Doe"), "John Q Doe");
});

Deno.test("uncurry3 - mixed types", () => {
	const curried = (name: string) => (age: number) => (active: boolean) =>
		`${name} is ${age} and ${active ? "active" : "inactive"}`;
	const describe = uncurry3(curried);
	assertStrictEquals(describe("Alice", 30, true), "Alice is 30 and active");
});

// --- uncurry4 ---

Deno.test("uncurry4 - basic usage", () => {
	const curried = (a: number) => (b: number) => (c: number) => (d: number) => a + b + c + d;
	const flat = uncurry4(curried);
	assertStrictEquals(flat(1, 2, 3, 4), 10);
});

Deno.test("uncurry4 - string formatting", () => {
	const curried = (a: string) => (b: string) => (c: string) => (d: string) => `${a}-${b}-${c}-${d}`;
	const format = uncurry4(curried);
	assertStrictEquals(format("A", "B", "C", "D"), "A-B-C-D");
});

Deno.test("uncurry4 - multiplication", () => {
	const curried = (a: number) => (b: number) => (c: number) => (d: number) => a * b * c * d;
	const multiply = uncurry4(curried);
	assertStrictEquals(multiply(2, 3, 4, 5), 120);
});
