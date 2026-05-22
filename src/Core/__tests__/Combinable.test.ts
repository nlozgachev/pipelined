import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Combinable } from "../Combinable.ts";
import { Maybe } from "../Maybe.ts";

// ---------------------------------------------------------------------------
// string
// ---------------------------------------------------------------------------

test("Combinable.string combines two strings by concatenation", () => {
	expect(Combinable.string.combine(" world")("hello")).toBe("hello world");
});

test("Combinable.string empty is a left identity: combine(empty)(a) = a", () => {
	expect(Combinable.string.combine(Combinable.string.empty)("hello")).toBe("hello");
});

test("Combinable.string empty is a right identity: combine(a)(empty) = a", () => {
	expect(Combinable.string.combine("hello")(Combinable.string.empty)).toBe("hello");
});

// ---------------------------------------------------------------------------
// sum
// ---------------------------------------------------------------------------

test("Combinable.sum combines numbers by addition", () => {
	expect(Combinable.sum.combine(3)(2)).toBe(5);
});

test("Combinable.sum has 0 as its neutral element", () => {
	expect(Combinable.sum.combine(0)(42)).toBe(42);
	expect(Combinable.sum.combine(42)(0)).toBe(42);
});

// ---------------------------------------------------------------------------
// product
// ---------------------------------------------------------------------------

test("Combinable.product combines numbers by multiplication", () => {
	expect(Combinable.product.combine(3)(2)).toBe(6);
});

test("Combinable.product has 1 as its neutral element", () => {
	expect(Combinable.product.combine(1)(5)).toBe(5);
	expect(Combinable.product.combine(5)(1)).toBe(5);
});

// ---------------------------------------------------------------------------
// all
// ---------------------------------------------------------------------------

test("Combinable.all returns true when both values are true", () => {
	expect(Combinable.all.combine(true)(true)).toBe(true);
});

test("Combinable.all returns false when either value is false", () => {
	expect(Combinable.all.combine(false)(true)).toBe(false);
	expect(Combinable.all.combine(true)(false)).toBe(false);
});

test("Combinable.all has true as its neutral element", () => {
	expect(Combinable.all.combine(true)(true)).toBe(true);
	expect(Combinable.all.combine(false)(true)).toBe(false);
});

// ---------------------------------------------------------------------------
// any
// ---------------------------------------------------------------------------

test("Combinable.any returns true when either value is true", () => {
	expect(Combinable.any.combine(true)(false)).toBe(true);
	expect(Combinable.any.combine(false)(true)).toBe(true);
});

test("Combinable.any returns false when both values are false", () => {
	expect(Combinable.any.combine(false)(false)).toBe(false);
});

test("Combinable.any has false as its neutral element", () => {
	expect(Combinable.any.combine(false)(true)).toBe(true);
	expect(Combinable.any.combine(false)(false)).toBe(false);
});

// ---------------------------------------------------------------------------
// array
// ---------------------------------------------------------------------------

test("Combinable.array concatenates two arrays", () => {
	expect(Combinable.array<number>().combine([3, 4])([1, 2])).toEqual([1, 2, 3, 4]);
});

test("Combinable.array has empty array as its neutral element", () => {
	expect(Combinable.array<number>().combine([])([1, 2])).toEqual([1, 2]);
	expect(Combinable.array<number>().combine([1, 2])([])).toEqual([1, 2]);
});

// ---------------------------------------------------------------------------
// maybe
// ---------------------------------------------------------------------------

test("Combinable.maybe combines two Somes using the inner Combinable", () => {
	const result = Combinable.maybe(Combinable.sum).combine(Maybe.some(3))(Maybe.some(2));
	expect(result).toEqual(Maybe.some(5));
});

test("Combinable.maybe treats None as neutral: combine(None)(Some(x)) = Some(x)", () => {
	const result = Combinable.maybe(Combinable.sum).combine(Maybe.none())(Maybe.some(5));
	expect(result).toEqual(Maybe.some(5));
});

test("Combinable.maybe treats None as neutral: combine(Some(x))(None) = Some(x)", () => {
	const result = Combinable.maybe(Combinable.sum).combine(Maybe.some(5))(Maybe.none());
	expect(result).toEqual(Maybe.some(5));
});

test("Combinable.maybe empty is None", () => {
	expect(Combinable.maybe(Combinable.sum).empty).toEqual(Maybe.none());
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Combinable.fold concatenates a string array", () => {
	expect(pipe(["hello", ", ", "world"], Combinable.fold(Combinable.string))).toBe("hello, world");
});

test("Combinable.fold sums a number array", () => {
	expect(pipe([1, 2, 3, 4, 5], Combinable.fold(Combinable.sum))).toBe(15);
});

test("Combinable.fold computes the product of a number array", () => {
	expect(pipe([2, 3, 4], Combinable.fold(Combinable.product))).toBe(24);
});

test("Combinable.fold returns the empty element for an empty array", () => {
	expect(pipe([] as number[], Combinable.fold(Combinable.sum))).toBe(0);
	expect(pipe([] as number[], Combinable.fold(Combinable.product))).toBe(1);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Combinable.fold works in a pipe with Maybe values", () => {
	const result = pipe(
		[Maybe.some(1), Maybe.some(2), Maybe.some(3)],
		Combinable.fold(Combinable.maybe(Combinable.sum)),
	);
	expect(result).toEqual(Maybe.some(6));
});
