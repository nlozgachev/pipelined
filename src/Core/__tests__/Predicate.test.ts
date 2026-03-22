import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Predicate } from "../Predicate.ts";
import { Refinement } from "../Refinement.ts";

// ---------------------------------------------------------------------------
// Shared test predicates
// ---------------------------------------------------------------------------

const isPositive: Predicate<number> = (n) => n > 0;
const isEven: Predicate<number> = (n) => n % 2 === 0;
const isNonEmpty: Predicate<string> = (s) => s.length > 0;

// ---------------------------------------------------------------------------
// not
// ---------------------------------------------------------------------------

test("Predicate.not negates a true predicate to false", () => {
	expect(Predicate.not(isPositive)(5)).toBe(false);
});

test("Predicate.not negates a false predicate to true", () => {
	expect(Predicate.not(isPositive)(-1)).toBe(true);
});

test("Predicate.not double negation returns the original result", () => {
	const doubleNot = Predicate.not(Predicate.not(isPositive));
	expect(doubleNot(5)).toBe(true);
	expect(doubleNot(-1)).toBe(false);
});

test("Predicate.not works in a pipe chain", () => {
	const isNotPositive = pipe(isPositive, Predicate.not);
	expect(isNotPositive(5)).toBe(false);
	expect(isNotPositive(-1)).toBe(true);
});

// ---------------------------------------------------------------------------
// and
// ---------------------------------------------------------------------------

test("Predicate.and returns true when both predicates pass", () => {
	const isPositiveEven = pipe(isPositive, Predicate.and(isEven));
	expect(isPositiveEven(4)).toBe(true);
});

test("Predicate.and returns false when the first predicate fails", () => {
	const isPositiveEven = pipe(isPositive, Predicate.and(isEven));
	expect(isPositiveEven(-2)).toBe(false);
});

test("Predicate.and returns false when the second predicate fails", () => {
	const isPositiveEven = pipe(isPositive, Predicate.and(isEven));
	expect(isPositiveEven(3)).toBe(false);
});

test("Predicate.and short-circuits: second is not called when first fails", () => {
	let secondCalled = false;
	const second: Predicate<number> = (n) => {
		secondCalled = true;
		return n > 0;
	};
	pipe(isEven, Predicate.and(second))(-1); // first (isEven) fails → second should NOT run
	// Note: first is -1 which is odd, so isEven(-1) = false → short-circuits
	expect(secondCalled).toBe(false);
});

test("Predicate.and is composable with pipe for three predicates", () => {
	const isInRange: Predicate<number> = (n) => n <= 100;
	const isValidScore = pipe(isPositive, Predicate.and(isEven), Predicate.and(isInRange));
	expect(isValidScore(50)).toBe(true);
	expect(isValidScore(101)).toBe(false);
	expect(isValidScore(-2)).toBe(false);
	expect(isValidScore(3)).toBe(false);
});

// ---------------------------------------------------------------------------
// or
// ---------------------------------------------------------------------------

test("Predicate.or returns true when the first predicate passes", () => {
	const isPositiveOrEven = pipe(isPositive, Predicate.or(isEven));
	expect(isPositiveOrEven(3)).toBe(true); // positive, odd
});

test("Predicate.or returns true when the second predicate passes", () => {
	const isPositiveOrEven = pipe(isPositive, Predicate.or(isEven));
	expect(isPositiveOrEven(-2)).toBe(true); // negative, even
});

test("Predicate.or returns true when both predicates pass", () => {
	const isPositiveOrEven = pipe(isPositive, Predicate.or(isEven));
	expect(isPositiveOrEven(4)).toBe(true); // positive and even
});

test("Predicate.or returns false when both predicates fail", () => {
	const isPositiveOrEven = pipe(isPositive, Predicate.or(isEven));
	expect(isPositiveOrEven(-3)).toBe(false); // negative and odd
});

test("Predicate.or short-circuits: second is not called when first passes", () => {
	let secondCalled = false;
	const second: Predicate<number> = (n) => {
		secondCalled = true;
		return n > 0;
	};
	pipe(isEven, Predicate.or(second))(2); // first (isEven(2)) passes → second should NOT run
	expect(secondCalled).toBe(false);
});

// ---------------------------------------------------------------------------
// contramap
// ---------------------------------------------------------------------------

test("Predicate.using adapts predicate to a new input type", () => {
	type User = { age: number; };
	const isAdult: Predicate<number> = (n) => n >= 18;
	const isAdultUser = pipe(isAdult, Predicate.using((u: User) => u.age));

	expect(isAdultUser({ age: 30 })).toBe(true);
	expect(isAdultUser({ age: 15 })).toBe(false);
});

test("Predicate.using applies the mapping function before the predicate", () => {
	let mappedValue = 0;
	const capture: Predicate<number> = (n) => {
		mappedValue = n;
		return true;
	};
	const mapped = pipe(capture, Predicate.using((s: string) => s.length));
	mapped("hello");
	expect(mappedValue).toBe(5);
});

test("Predicate.using can be chained for nested extraction", () => {
	type Order = { user: { age: number; }; };
	const isAdult: Predicate<number> = (n) => n >= 18;
	const isAdultOrder = pipe(
		isAdult,
		Predicate.using((u: { age: number; }) => u.age),
		Predicate.using((o: Order) => o.user),
	);

	expect(isAdultOrder({ user: { age: 25 } })).toBe(true);
	expect(isAdultOrder({ user: { age: 16 } })).toBe(false);
});

// ---------------------------------------------------------------------------
// all
// ---------------------------------------------------------------------------

test("Predicate.all returns true when all predicates pass", () => {
	const checks: Predicate<string>[] = [
		(s) => s.length > 0,
		(s) => s.length <= 10,
		(s) => !s.includes(" "),
	];
	expect(Predicate.all(checks)("hello")).toBe(true);
});

test("Predicate.all returns false when one predicate fails", () => {
	const checks: Predicate<string>[] = [
		(s) => s.length > 0,
		(s) => s.length <= 3,
	];
	expect(Predicate.all(checks)("hello")).toBe(false); // too long
});

test("Predicate.all returns true for an empty array", () => {
	expect(Predicate.all([])(42)).toBe(true);
});

test("Predicate.all returns false when first predicate fails", () => {
	let secondCalled = false;
	const checks: Predicate<number>[] = [
		() => false,
		() => {
			secondCalled = true;
			return true;
		},
	];
	Predicate.all(checks)(1);
	expect(secondCalled).toBe(false); // short-circuits via Array.every
});

// ---------------------------------------------------------------------------
// any
// ---------------------------------------------------------------------------

test("Predicate.any returns true when one predicate passes", () => {
	const formats: Predicate<string>[] = [
		(s) => s.endsWith(".jpg"),
		(s) => s.endsWith(".png"),
	];
	expect(Predicate.any(formats)("photo.jpg")).toBe(true);
});

test("Predicate.any returns false when all predicates fail", () => {
	const formats: Predicate<string>[] = [
		(s) => s.endsWith(".jpg"),
		(s) => s.endsWith(".png"),
	];
	expect(Predicate.any(formats)("photo.gif")).toBe(false);
});

test("Predicate.any returns false for an empty array", () => {
	expect(Predicate.any([])(42)).toBe(false);
});

test("Predicate.any short-circuits when first predicate passes", () => {
	let secondCalled = false;
	const checks: Predicate<number>[] = [
		() => true,
		() => {
			secondCalled = true;
			return false;
		},
	];
	Predicate.any(checks)(1);
	expect(secondCalled).toBe(false); // short-circuits via Array.some
});

// ---------------------------------------------------------------------------
// fromRefinement
// ---------------------------------------------------------------------------

test("Predicate.fromRefinement returns true when refinement passes", () => {
	type NonEmptyString = string & { readonly _tag: "NonEmpty"; };
	const isNonEmptyStr: Refinement<string, NonEmptyString> = Refinement.make((s) => s.length > 0);
	const p = Predicate.fromRefinement(isNonEmptyStr);
	expect(p("hello")).toBe(true);
});

test("Predicate.fromRefinement returns false when refinement fails", () => {
	type NonEmptyString = string & { readonly _tag: "NonEmpty"; };
	const isNonEmptyStr: Refinement<string, NonEmptyString> = Refinement.make((s) => s.length > 0);
	const p = Predicate.fromRefinement(isNonEmptyStr);
	expect(p("")).toBe(false);
});

test("Predicate.fromRefinement result composes with and/or", () => {
	type LongString = string & { readonly _tag: "Long"; };
	const isLong: Refinement<string, LongString> = Refinement.make((s) => s.length >= 5);
	const combined = pipe(
		Predicate.fromRefinement(isLong),
		Predicate.and(isNonEmpty),
	);
	expect(combined("hello world")).toBe(true);
	expect(combined("hi")).toBe(false);
	expect(combined("")).toBe(false);
});
