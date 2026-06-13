import { Maybe, Validation } from "#core";
import { isNonEmptyArr, type NonEmptyArr } from "#internal";
import { expect, expectTypeOf, test } from "vitest";
import { Arr } from "../../Data/Arr.ts";

test("isNonEmptyArr - returns true for non-empty array", () => {
	expect(isNonEmptyArr([1, 2, 3])).toBe(true);
});

test("isNonEmptyArr - returns false for empty array", () => {
	expect(isNonEmptyArr([])).toBe(false);
});

test("Arr.map on NonEmptyArr - maps values type-safely", () => {
	const list: NonEmptyArr<number> = [1, 2, 3];
	const result: NonEmptyArr<number> = Arr.map((n: number) => n * 2)(list);
	expect(result).toStrictEqual([2, 4, 6]);
});

test("Arr.NonEmpty.singleton - creates a single-element list", () => {
	const result = Arr.NonEmpty.singleton(42);
	expect(result).toStrictEqual([42]);
});

test("Arr.NonEmpty.fromArray - returns Some for non-empty array", () => {
	const result = Arr.NonEmpty.fromArray([1, 2]);
	expect(result).toStrictEqual(Maybe.some([1, 2]));
});

test("Arr.NonEmpty.fromArray - returns None for empty array", () => {
	const result = Arr.NonEmpty.fromArray([]);
	expect(result).toStrictEqual(Maybe.none());
});

test("Arr.NonEmpty.head - returns the first element", () => {
	const list: NonEmptyArr<number> = [1, 2, 3];
	expect(Arr.NonEmpty.head(list)).toBe(1);
});

test("Arr.NonEmpty.last - returns the last element", () => {
	const list: NonEmptyArr<number> = [1, 2, 3];
	expect(Arr.NonEmpty.last(list)).toBe(3);
});

test("Arr.NonEmpty.tail - returns elements after the first", () => {
	const list: NonEmptyArr<number> = [1, 2, 3];
	expect(Arr.NonEmpty.tail(list)).toStrictEqual([2, 3]);
});

test("Arr.concat on NonEmptyArr - concatenates list with array", () => {
	const list: NonEmptyArr<number> = [1, 2];
	const result: NonEmptyArr<number> = Arr.concat([3, 4])(list);
	expect(result).toStrictEqual([1, 2, 3, 4]);
});

test("Arr.NonEmpty.reduce - accumulates values without initial seed", () => {
	const list: NonEmptyArr<number> = [1, 2, 3, 4];
	const result = Arr.NonEmpty.reduce((a: number, b: number) => a + b)(list);
	expect(result).toBe(10);
});

test("Arr.prepend - prepends value to array", () => {
	const result: NonEmptyArr<number> = Arr.prepend(0)([1, 2]);
	expect(result).toStrictEqual([0, 1, 2]);
});

test("Arr.append - appends value to array", () => {
	const result: NonEmptyArr<number> = Arr.append(3)([1, 2]);
	expect(result).toStrictEqual([1, 2, 3]);
});

test("Validation failure errors are type-compatible with Arr.NonEmpty", () => {
	const failedVal = Validation.failed("error");
	expect(Validation.isFailed(failedVal)).toBe(true);

	if (!Validation.isFailed(failedVal)) {
		throw new Error("Expected failed validation");
	}

	const { errors } = failedVal;
	const typedErrors: Arr.NonEmpty<string> = errors;
	expect(typedErrors).toStrictEqual(["error"]);

	const firstError = Arr.NonEmpty.head(errors);
	expect(firstError).toBe("error");

	expectTypeOf(errors).toEqualTypeOf<Arr.NonEmpty<string>>();
});
