import { expect, test } from "vitest";
import { on } from "../on.ts";
import { pipe } from "../pipe.ts";

// --- on ---

test("on: projects arguments prior to binary function invocation", () => {
	const compareByLength = on((a: number, b: number) => a - b, (s: string) => s.length);

	expect(compareByLength("hi", "hello")).toBe(-3);
});

test("on: compares items by projected property", () => {
	const byLength = on((a: number, b: number) => a - b, (s: string) => s.length);

	const result = ["banana", "fig", "apple"].toSorted(byLength);

	expect(result).toStrictEqual(["fig", "apple", "banana"]);
});

test("on: sorts objects by numeric field projection", () => {
	type Product = { name: string; price: number; };
	const byPrice = on((a: number, b: number) => a - b, (p: Product) => p.price);

	const products: Product[] = [{ name: "Chair", price: 120 }, { name: "Desk", price: 350 }, { name: "Lamp", price: 45 }];

	const result = [...products].toSorted(byPrice).map((p) => p.name);

	expect(result).toStrictEqual(["Lamp", "Chair", "Desk"]);
});

test("on: checks equality after projection", () => {
	const sameLength = on((a: number, b: number) => a === b, (s: string) => s.length);

	expect(sameLength("cat", "dog")).toBe(true);
	expect(sameLength("cat", "elephant")).toBe(false);
});

test("on: applies projection to arguments independently", () => {
	const seen: string[] = [];
	const track = on((a: number, b: number) => a - b, (s: string) => {
		seen.push(s);
		return s.length;
	});

	track("hi", "hello");

	expect(seen).toStrictEqual(["hi", "hello"]);
});

test("pipe: integrates in pipeline", () => {
	const byLength = on((a: number, b: number) => a - b, (s: string) => s.length);

	const result = pipe(["banana", "fig", "apple"], (arr) => [...arr].toSorted(byLength));

	expect(result).toStrictEqual(["fig", "apple", "banana"]);
});
