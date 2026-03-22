import { assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Predicate } from "../Predicate.ts";
import { Refinement } from "../Refinement.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// Shared test predicates
// ---------------------------------------------------------------------------

const isPositive: Predicate<number> = (n) => n > 0;
const isEven: Predicate<number> = (n) => n % 2 === 0;
const isNonEmpty: Predicate<string> = (s) => s.length > 0;

// ---------------------------------------------------------------------------
// not
// ---------------------------------------------------------------------------

Deno.test("Predicate.not negates a true predicate to false", () => {
	assertStrictEquals(Predicate.not(isPositive)(5), false);
});

Deno.test("Predicate.not negates a false predicate to true", () => {
	assertStrictEquals(Predicate.not(isPositive)(-1), true);
});

Deno.test("Predicate.not double negation returns the original result", () => {
	const doubleNot = Predicate.not(Predicate.not(isPositive));
	assertStrictEquals(doubleNot(5), true);
	assertStrictEquals(doubleNot(-1), false);
});

Deno.test("Predicate.not works in a pipe chain", () => {
	const isNotPositive = pipe(isPositive, Predicate.not);
	assertStrictEquals(isNotPositive(5), false);
	assertStrictEquals(isNotPositive(-1), true);
});

// ---------------------------------------------------------------------------
// and
// ---------------------------------------------------------------------------

Deno.test("Predicate.and returns true when both predicates pass", () => {
	const isPositiveEven = pipe(isPositive, Predicate.and(isEven));
	assertStrictEquals(isPositiveEven(4), true);
});

Deno.test("Predicate.and returns false when the first predicate fails", () => {
	const isPositiveEven = pipe(isPositive, Predicate.and(isEven));
	assertStrictEquals(isPositiveEven(-2), false);
});

Deno.test("Predicate.and returns false when the second predicate fails", () => {
	const isPositiveEven = pipe(isPositive, Predicate.and(isEven));
	assertStrictEquals(isPositiveEven(3), false);
});

Deno.test("Predicate.and short-circuits: second is not called when first fails", () => {
	let secondCalled = false;
	const second: Predicate<number> = (n) => {
		secondCalled = true;
		return n > 0;
	};
	pipe(isEven, Predicate.and(second))(-1); // first (isEven) fails → second should NOT run
	// Note: first is -1 which is odd, so isEven(-1) = false → short-circuits
	assertStrictEquals(secondCalled, false);
});

Deno.test("Predicate.and is composable with pipe for three predicates", () => {
	const isInRange: Predicate<number> = (n) => n <= 100;
	const isValidScore = pipe(isPositive, Predicate.and(isEven), Predicate.and(isInRange));
	assertStrictEquals(isValidScore(50), true);
	assertStrictEquals(isValidScore(101), false);
	assertStrictEquals(isValidScore(-2), false);
	assertStrictEquals(isValidScore(3), false);
});

// ---------------------------------------------------------------------------
// or
// ---------------------------------------------------------------------------

Deno.test("Predicate.or returns true when the first predicate passes", () => {
	const isPositiveOrEven = pipe(isPositive, Predicate.or(isEven));
	assertStrictEquals(isPositiveOrEven(3), true); // positive, odd
});

Deno.test("Predicate.or returns true when the second predicate passes", () => {
	const isPositiveOrEven = pipe(isPositive, Predicate.or(isEven));
	assertStrictEquals(isPositiveOrEven(-2), true); // negative, even
});

Deno.test("Predicate.or returns true when both predicates pass", () => {
	const isPositiveOrEven = pipe(isPositive, Predicate.or(isEven));
	assertStrictEquals(isPositiveOrEven(4), true); // positive and even
});

Deno.test("Predicate.or returns false when both predicates fail", () => {
	const isPositiveOrEven = pipe(isPositive, Predicate.or(isEven));
	assertStrictEquals(isPositiveOrEven(-3), false); // negative and odd
});

Deno.test("Predicate.or short-circuits: second is not called when first passes", () => {
	let secondCalled = false;
	const second: Predicate<number> = (n) => {
		secondCalled = true;
		return n > 0;
	};
	pipe(isEven, Predicate.or(second))(2); // first (isEven(2)) passes → second should NOT run
	assertStrictEquals(secondCalled, false);
});

// ---------------------------------------------------------------------------
// contramap
// ---------------------------------------------------------------------------

Deno.test("Predicate.using adapts predicate to a new input type", () => {
	type User = { age: number };
	const isAdult: Predicate<number> = (n) => n >= 18;
	const isAdultUser = pipe(isAdult, Predicate.using((u: User) => u.age));

	assertStrictEquals(isAdultUser({ age: 30 }), true);
	assertStrictEquals(isAdultUser({ age: 15 }), false);
});

Deno.test("Predicate.using applies the mapping function before the predicate", () => {
	let mappedValue = 0;
	const capture: Predicate<number> = (n) => {
		mappedValue = n;
		return true;
	};
	const mapped = pipe(capture, Predicate.using((s: string) => s.length));
	mapped("hello");
	assertStrictEquals(mappedValue, 5);
});

Deno.test("Predicate.using can be chained for nested extraction", () => {
	type Order = { user: { age: number } };
	const isAdult: Predicate<number> = (n) => n >= 18;
	const isAdultOrder = pipe(
		isAdult,
		Predicate.using((u: { age: number }) => u.age),
		Predicate.using((o: Order) => o.user),
	);

	assertStrictEquals(isAdultOrder({ user: { age: 25 } }), true);
	assertStrictEquals(isAdultOrder({ user: { age: 16 } }), false);
});

// ---------------------------------------------------------------------------
// all
// ---------------------------------------------------------------------------

Deno.test("Predicate.all returns true when all predicates pass", () => {
	const checks: Predicate<string>[] = [
		(s) => s.length > 0,
		(s) => s.length <= 10,
		(s) => !s.includes(" "),
	];
	assertStrictEquals(Predicate.all(checks)("hello"), true);
});

Deno.test("Predicate.all returns false when one predicate fails", () => {
	const checks: Predicate<string>[] = [
		(s) => s.length > 0,
		(s) => s.length <= 3,
	];
	assertStrictEquals(Predicate.all(checks)("hello"), false); // too long
});

Deno.test("Predicate.all returns true for an empty array", () => {
	assertStrictEquals(Predicate.all([])(42), true);
});

Deno.test("Predicate.all returns false when first predicate fails", () => {
	let secondCalled = false;
	const checks: Predicate<number>[] = [
		() => false,
		() => {
			secondCalled = true;
			return true;
		},
	];
	Predicate.all(checks)(1);
	assertStrictEquals(secondCalled, false); // short-circuits via Array.every
});

// ---------------------------------------------------------------------------
// any
// ---------------------------------------------------------------------------

Deno.test("Predicate.any returns true when one predicate passes", () => {
	const formats: Predicate<string>[] = [
		(s) => s.endsWith(".jpg"),
		(s) => s.endsWith(".png"),
	];
	assertStrictEquals(Predicate.any(formats)("photo.jpg"), true);
});

Deno.test("Predicate.any returns false when all predicates fail", () => {
	const formats: Predicate<string>[] = [
		(s) => s.endsWith(".jpg"),
		(s) => s.endsWith(".png"),
	];
	assertStrictEquals(Predicate.any(formats)("photo.gif"), false);
});

Deno.test("Predicate.any returns false for an empty array", () => {
	assertStrictEquals(Predicate.any([])(42), false);
});

Deno.test("Predicate.any short-circuits when first predicate passes", () => {
	let secondCalled = false;
	const checks: Predicate<number>[] = [
		() => true,
		() => {
			secondCalled = true;
			return false;
		},
	];
	Predicate.any(checks)(1);
	assertStrictEquals(secondCalled, false); // short-circuits via Array.some
});

// ---------------------------------------------------------------------------
// fromRefinement
// ---------------------------------------------------------------------------

Deno.test("Predicate.fromRefinement returns true when refinement passes", () => {
	type NonEmptyString = string & { readonly _tag: "NonEmpty" };
	const isNonEmptyStr: Refinement<string, NonEmptyString> = Refinement.make((s) => s.length > 0);
	const p = Predicate.fromRefinement(isNonEmptyStr);
	assertStrictEquals(p("hello"), true);
});

Deno.test("Predicate.fromRefinement returns false when refinement fails", () => {
	type NonEmptyString = string & { readonly _tag: "NonEmpty" };
	const isNonEmptyStr: Refinement<string, NonEmptyString> = Refinement.make((s) => s.length > 0);
	const p = Predicate.fromRefinement(isNonEmptyStr);
	assertStrictEquals(p(""), false);
});

Deno.test("Predicate.fromRefinement result composes with and/or", () => {
	type LongString = string & { readonly _tag: "Long" };
	const isLong: Refinement<string, LongString> = Refinement.make((s) => s.length >= 5);
	const combined = pipe(
		Predicate.fromRefinement(isLong),
		Predicate.and(isNonEmpty),
	);
	assertStrictEquals(combined("hello world"), true);
	assertStrictEquals(combined("hi"), false);
	assertStrictEquals(combined(""), false);
});
