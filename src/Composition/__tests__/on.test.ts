import { expect, test } from "vitest";
import { on } from "../on.ts";
import { pipe } from "../pipe.ts";

test("on - projects both arguments before calling the binary function", () => {
	const compareByLength = on((a: number, b: number) => a - b, (s: string) => s.length);

	expect(compareByLength("hi", "hello")).toBe(-3);
});

test("on - sorts strings by length", () => {
	const byLength = on((a: number, b: number) => a - b, (s: string) => s.length);

	const result = ["banana", "fig", "apple"].sort(byLength);

	expect(result).toEqual(["fig", "apple", "banana"]);
});

test("on - sorts objects by a numeric field", () => {
	type Product = { name: string; price: number; };
	const byPrice = on((a: number, b: number) => a - b, (p: Product) => p.price);

	const products: Product[] = [
		{ name: "Chair", price: 120 },
		{ name: "Desk", price: 350 },
		{ name: "Lamp", price: 45 },
	];

	const result = [...products].sort(byPrice).map((p) => p.name);

	expect(result).toEqual(["Lamp", "Chair", "Desk"]);
});

test("on - checks equality after projection", () => {
	const sameLength = on((a: number, b: number) => a === b, (s: string) => s.length);

	expect(sameLength("cat", "dog")).toBe(true);
	expect(sameLength("cat", "elephant")).toBe(false);
});

test("on - projection is applied to both arguments independently", () => {
	const seen: string[] = [];
	const track = on(
		(a: number, b: number) => a - b,
		(s: string) => {
			seen.push(s);
			return s.length;
		},
	);

	track("hi", "hello");

	expect(seen).toEqual(["hi", "hello"]);
});

test("on - works in a pipe chain", () => {
	const byLength = on((a: number, b: number) => a - b, (s: string) => s.length);

	const result = pipe(
		["banana", "fig", "apple"],
		(arr) => [...arr].sort(byLength),
	);

	expect(result).toEqual(["fig", "apple", "banana"]);
});
