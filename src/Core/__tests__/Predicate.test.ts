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

test("not: negates true predicate to false", () => {
	expect(Predicate.not(isPositive)(5)).toBe(false);
});

test("not: negates false predicate to true", () => {
	expect(Predicate.not(isPositive)(-1)).toBe(true);
});

test("not: returns original result on double negation", () => {
	const doubleNot = Predicate.not(Predicate.not(isPositive));
	expect(doubleNot(5)).toBe(true);
	expect(doubleNot(-1)).toBe(false);
});

test("not: works in pipe chain", () => {
	const isNotPositive = pipe(isPositive, Predicate.not);
	expect(isNotPositive(5)).toBe(false);
	expect(isNotPositive(-1)).toBe(true);
});

// ---------------------------------------------------------------------------
// and
// ---------------------------------------------------------------------------

test("and: returns true when both predicates pass", () => {
	const isPositiveEven = pipe(isPositive, Predicate.and(isEven));
	expect(isPositiveEven(4)).toBe(true);
});

test("and: returns false when first predicate fails", () => {
	const isPositiveEven = pipe(isPositive, Predicate.and(isEven));
	expect(isPositiveEven(-2)).toBe(false);
});

test("and: returns false when second predicate fails", () => {
	const isPositiveEven = pipe(isPositive, Predicate.and(isEven));
	expect(isPositiveEven(3)).toBe(false);
});

test("and: short-circuits when first predicate fails", () => {
	let secondCalled = false;
	const second: Predicate<number> = (n) => {
		secondCalled = true;
		return n > 0;
	};
	pipe(isEven, Predicate.and(second))(-1); // first (isEven) fails → second should NOT run
	// Note: first is -1 which is odd, so isEven(-1) = false → short-circuits
	expect(secondCalled).toBe(false);
});

test("and: composes in pipe for multiple predicates", () => {
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

test("or: returns true when first predicate passes", () => {
	const isPositiveOrEven = pipe(isPositive, Predicate.or(isEven));
	expect(isPositiveOrEven(3)).toBe(true); // positive, odd
});

test("or: returns true when second predicate passes", () => {
	const isPositiveOrEven = pipe(isPositive, Predicate.or(isEven));
	expect(isPositiveOrEven(-2)).toBe(true); // negative, even
});

test("or: returns true when both predicates pass", () => {
	const isPositiveOrEven = pipe(isPositive, Predicate.or(isEven));
	expect(isPositiveOrEven(4)).toBe(true); // positive and even
});

test("or: returns false when both predicates fail", () => {
	const isPositiveOrEven = pipe(isPositive, Predicate.or(isEven));
	expect(isPositiveOrEven(-3)).toBe(false); // negative and odd
});

test("or: short-circuits when first predicate passes", () => {
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

test("using: adapts predicate to new input type", () => {
	type User = { age: number; };
	const isAdult: Predicate<number> = (n) => n >= 18;
	const isAdultUser = pipe(isAdult, Predicate.using((u: User) => u.age));

	expect(isAdultUser({ age: 30 })).toBe(true);
	expect(isAdultUser({ age: 15 })).toBe(false);
});

test("using: applies mapping function before predicate", () => {
	let mappedValue = 0;
	const capture: Predicate<number> = (n) => {
		mappedValue = n;
		return true;
	};
	const mapped = pipe(capture, Predicate.using((s: string) => s.length));
	mapped("hello");
	expect(mappedValue).toBe(5);
});

test("using: chains for nested extraction", () => {
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

test("all: returns true when all predicates pass", () => {
	const checks: Predicate<string>[] = [(s) => s.length > 0, (s) => s.length <= 10, (s) => !s.includes(" ")];
	expect(Predicate.all(checks)("hello")).toBe(true);
});

test("all: returns false when one predicate fails", () => {
	const checks: Predicate<string>[] = [(s) => s.length > 0, (s) => s.length <= 3];
	expect(Predicate.all(checks)("hello")).toBe(false); // too long
});

test("all: returns true for empty array", () => {
	expect(Predicate.all([])(42)).toBe(true);
});

test("all: short-circuits when first predicate fails", () => {
	let secondCalled = false;
	const checks: Predicate<number>[] = [() => false, () => {
		secondCalled = true;
		return true;
	}];
	Predicate.all(checks)(1);
	expect(secondCalled).toBe(false); // short-circuits via Array.every
});

// ---------------------------------------------------------------------------
// any
// ---------------------------------------------------------------------------

test("any: returns true when one predicate passes", () => {
	const formats: Predicate<string>[] = [(s) => s.endsWith(".jpg"), (s) => s.endsWith(".png")];
	expect(Predicate.any(formats)("photo.jpg")).toBe(true);
});

test("any: returns false when all predicates fail", () => {
	const formats: Predicate<string>[] = [(s) => s.endsWith(".jpg"), (s) => s.endsWith(".png")];
	expect(Predicate.any(formats)("photo.gif")).toBe(false);
});

test("any: returns false for empty array", () => {
	expect(Predicate.any([])(42)).toBe(false);
});

test("any: short-circuits when first predicate passes", () => {
	let secondCalled = false;
	const checks: Predicate<number>[] = [() => true, () => {
		secondCalled = true;
		return false;
	}];
	Predicate.any(checks)(1);
	expect(secondCalled).toBe(false); // short-circuits via Array.some
});

// ---------------------------------------------------------------------------
// fromRefinement
// ---------------------------------------------------------------------------

test("from.Refinement: returns true when refinement passes", () => {
	type NonEmptyString = string & { readonly _tag: "NonEmpty"; };
	const isNonEmptyStr: Refinement<string, NonEmptyString> = Refinement.from.Predicate((s) => s.length > 0);
	const p = Predicate.from.Refinement(isNonEmptyStr);
	expect(p("hello")).toBe(true);
});

test("from.Refinement: returns false when refinement fails", () => {
	type NonEmptyString = string & { readonly _tag: "NonEmpty"; };
	const isNonEmptyStr: Refinement<string, NonEmptyString> = Refinement.from.Predicate((s) => s.length > 0);
	const p = Predicate.from.Refinement(isNonEmptyStr);
	expect(p("")).toBe(false);
});

test("from.Refinement: composes with and or or combinators", () => {
	type LongString = string & { readonly _tag: "Long"; };
	const isLong: Refinement<string, LongString> = Refinement.from.Predicate((s) => s.length >= 5);
	const combined = pipe(Predicate.from.Refinement(isLong), Predicate.and(isNonEmpty));
	expect(combined("hello world")).toBe(true);
	expect(combined("hi")).toBe(false);
	expect(combined("")).toBe(false);
});

// --- match ---

test("match: branches over predicate-handler pairs with fallback", () => {
	const classify = Predicate.match<number, string>(
		[[(n) => n < 0, () => "negative"], [(n) => n === 0, () => "zero"]],
		() => "positive",
	);

	expect(classify(-5)).toBe("negative");
	expect(classify(0)).toBe("zero");
	expect(classify(10)).toBe("positive");
});

// --- side-effect isolation ---

test("and: executes side effect in second predicate when first passes", () => {
	let called = false;
	const first = () => true;
	const second = () => {
		called = true;
		return true;
	};
	pipe(first, Predicate.and(second))(42);
	expect(called).toBe(true);
});

test("and: short-circuits side effect in second predicate when first fails", () => {
	let called = false;
	const first = () => false;
	const second = () => {
		called = true;
		return true;
	};
	pipe(first, Predicate.and(second))(42);
	expect(called).toBe(false);
});
