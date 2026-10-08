import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Combinable } from "../Combinable.ts";
import { Maybe } from "../Maybe.ts";

// ---------------------------------------------------------------------------
// string
// ---------------------------------------------------------------------------

test("string: combines two strings by concatenation", () => {
	expect(Combinable.string.combine(" world")("hello")).toBe("hello world");
});

test("string: satisfies left identity with empty", () => {
	expect(Combinable.string.combine(Combinable.string.empty)("hello")).toBe("hello");
});

test("string: satisfies right identity with empty", () => {
	expect(Combinable.string.combine("hello")(Combinable.string.empty)).toBe("hello");
});

// ---------------------------------------------------------------------------
// sum
// ---------------------------------------------------------------------------

test("sum: combines numbers by addition", () => {
	expect(Combinable.sum.combine(3)(2)).toBe(5);
});

test("sum: has 0 as neutral element", () => {
	expect(Combinable.sum.combine(0)(42)).toBe(42);
	expect(Combinable.sum.combine(42)(0)).toBe(42);
});

// ---------------------------------------------------------------------------
// product
// ---------------------------------------------------------------------------

test("product: combines numbers by multiplication", () => {
	expect(Combinable.product.combine(3)(2)).toBe(6);
});

test("product: has 1 as neutral element", () => {
	expect(Combinable.product.combine(1)(5)).toBe(5);
	expect(Combinable.product.combine(5)(1)).toBe(5);
});

// ---------------------------------------------------------------------------
// all
// ---------------------------------------------------------------------------

test("all: returns true when both values are true", () => {
	expect(Combinable.all.combine(true)(true)).toBe(true);
});

test("all: returns false when either value is false", () => {
	expect(Combinable.all.combine(false)(true)).toBe(false);
	expect(Combinable.all.combine(true)(false)).toBe(false);
});

test("all: has true as neutral element", () => {
	expect(Combinable.all.combine(true)(true)).toBe(true);
	expect(Combinable.all.combine(false)(true)).toBe(false);
});

// ---------------------------------------------------------------------------
// any
// ---------------------------------------------------------------------------

test("any: returns true when either value is true", () => {
	expect(Combinable.any.combine(true)(false)).toBe(true);
	expect(Combinable.any.combine(false)(true)).toBe(true);
});

test("any: returns false when both values are false", () => {
	expect(Combinable.any.combine(false)(false)).toBe(false);
});

test("any: has false as neutral element", () => {
	expect(Combinable.any.combine(false)(true)).toBe(true);
	expect(Combinable.any.combine(false)(false)).toBe(false);
});

// ---------------------------------------------------------------------------
// array
// ---------------------------------------------------------------------------

test("array: concatenates two arrays", () => {
	expect(Combinable.array<number>().combine([3, 4])([1, 2])).toStrictEqual([1, 2, 3, 4]);
});

test("array: has empty array as neutral element", () => {
	expect(Combinable.array<number>().combine([])([1, 2])).toStrictEqual([1, 2]);
	expect(Combinable.array<number>().combine([1, 2])([])).toStrictEqual([1, 2]);
});

// ---------------------------------------------------------------------------
// maybe
// ---------------------------------------------------------------------------

test("maybe: combines two Some values using inner Combinable", () => {
	const result = Combinable.maybe(Combinable.sum).combine(Maybe.make.some(3))(Maybe.make.some(2));
	expect(result).toStrictEqual(Maybe.make.some(5));
});

test("maybe: treats None as left neutral element", () => {
	const result = Combinable.maybe(Combinable.sum).combine(Maybe.make.none())(Maybe.make.some(5));
	expect(result).toStrictEqual(Maybe.make.some(5));
});

test("maybe: treats None as right neutral element", () => {
	const result = Combinable.maybe(Combinable.sum).combine(Maybe.make.some(5))(Maybe.make.none());
	expect(result).toStrictEqual(Maybe.make.some(5));
});

test("maybe: has None as empty element", () => {
	expect(Combinable.maybe(Combinable.sum).empty).toStrictEqual(Maybe.make.none());
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("fold: concatenates string array", () => {
	expect(pipe(["hello", ", ", "world"], Combinable.fold(Combinable.string))).toBe("hello, world");
});

test("fold: sums number array", () => {
	expect(pipe([1, 2, 3, 4, 5], Combinable.fold(Combinable.sum))).toBe(15);
});

test("fold: computes product of number array", () => {
	expect(pipe([2, 3, 4], Combinable.fold(Combinable.product))).toBe(24);
});

test("fold: returns empty element for empty array", () => {
	expect(pipe([] as number[], Combinable.fold(Combinable.sum))).toBe(0);
	expect(pipe([] as number[], Combinable.fold(Combinable.product))).toBe(1);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("fold: works in pipe with Maybe values", () => {
	const result = pipe(
		[Maybe.make.some(1), Maybe.make.some(2), Maybe.make.some(3)],
		Combinable.fold(Combinable.maybe(Combinable.sum)),
	);
	expect(result).toStrictEqual(Maybe.make.some(6));
});

// --- struct ---

test("struct: combines record structures by field combinables", () => {
	const Stats = Combinable.struct({ count: Combinable.sum, tags: Combinable.array<string>() });

	expect(Stats.empty).toStrictEqual({ count: 0, tags: [] });
	const res = Stats.combine({ count: 5, tags: ["b"] })({ count: 10, tags: ["a"] });
	expect(res).toStrictEqual({ count: 15, tags: ["a", "b"] });
});

test("struct: ignores prototype properties on fields definition", () => {
	const proto = { protoField: Combinable.sum };
	const fields = Object.create(proto);
	fields.count = Combinable.sum;
	const structCombinable = Combinable.struct(fields);
	expect(structCombinable.empty).toStrictEqual({ count: 0 });
	expect(structCombinable.combine({ count: 5 })({ count: 10 })).toStrictEqual({ count: 15 });
});

// --- side-effect isolation ---

test("fold: executes side effects during combination", () => {
	let called = false;
	const custom: Combinable<number> = {
		empty: 0,
		combine: (b) => (a) => {
			called = true;
			return a + b;
		},
	};
	pipe([1, 2], Combinable.fold(custom));
	expect(called).toBe(true);
});

test("fold: does not execute side effects on empty array", () => {
	let called = false;
	const custom: Combinable<number> = {
		empty: 0,
		combine: (b) => (a) => {
			called = true;
			return a + b;
		},
	};
	pipe([], Combinable.fold(custom));
	expect(called).toBe(false);
});
