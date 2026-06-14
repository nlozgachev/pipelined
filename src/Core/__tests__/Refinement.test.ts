import { pipe } from "#composition";
import { Maybe, Refinement, Result } from "#core";
import { expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Phantom brand types — each uses a unique symbol so intersections don't collapse
// ---------------------------------------------------------------------------

declare const _nonEmpty: unique symbol;
declare const _trimmed: unique symbol;
declare const _positive: unique symbol;
declare const _even: unique symbol;

type NonEmptyString = string & { readonly [_nonEmpty]: true; };
type TrimmedString = NonEmptyString & { readonly [_trimmed]: true; };
type PositiveNumber = number & { readonly [_positive]: true; };
type EvenNumber = number & { readonly [_even]: true; };

const isNonEmpty: Refinement<string, NonEmptyString> = Refinement.from.predicate((s) => s.length > 0);
const isTrimmed: Refinement<NonEmptyString, TrimmedString> = Refinement.from.predicate((s) => s === s.trim());
const isPositive: Refinement<number, PositiveNumber> = Refinement.from.predicate((n) => n > 0);
const isEven: Refinement<number, EvenNumber> = Refinement.from.predicate((n) => n % 2 === 0);

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("Refinement.from.predicate returns true when predicate passes", () => {
	expect(isNonEmpty("hello")).toBe(true);
});

test("Refinement.from.predicate returns false when predicate fails", () => {
	expect(isNonEmpty("")).toBe(false);
});

test("Refinement.from.predicate works as a type guard in conditional branches", () => {
	const value: string = "world";
	expect(isNonEmpty(value)).toBe(true);
	// TypeScript compile-time check: narrowed type must be assignable to NonEmptyString.
	if (isNonEmpty(value)) {
		const _typed: NonEmptyString = value;
		void _typed;
	}
});

// ---------------------------------------------------------------------------
// compose
// ---------------------------------------------------------------------------

test("Refinement.compose narrows A to C when both refinements pass", () => {
	const isNonEmptyTrimmed: Refinement<string, TrimmedString> = pipe(isNonEmpty, Refinement.compose(isTrimmed));
	expect(isNonEmptyTrimmed("hello")).toBe(true);
});

test("Refinement.compose returns false when the first refinement fails", () => {
	const isNonEmptyTrimmed: Refinement<string, TrimmedString> = pipe(isNonEmpty, Refinement.compose(isTrimmed));
	expect(isNonEmptyTrimmed("")).toBe(false);
});

test("Refinement.compose returns false when the second refinement fails", () => {
	const isNonEmptyTrimmed: Refinement<string, TrimmedString> = pipe(isNonEmpty, Refinement.compose(isTrimmed));
	expect(isNonEmptyTrimmed("  spaces  ")).toBe(false);
});

// ---------------------------------------------------------------------------
// and
// ---------------------------------------------------------------------------

test("Refinement.and returns true when both refinements pass", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	expect(isPositiveEven(4)).toBe(true);
});

test("Refinement.and returns false when the first refinement fails", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	expect(isPositiveEven(-2)).toBe(false);
});

test("Refinement.and returns false when the second refinement fails", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	expect(isPositiveEven(3)).toBe(false);
});

test("Refinement.and returns false when both refinements fail", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	expect(isPositiveEven(-3)).toBe(false);
});

// ---------------------------------------------------------------------------
// or
// ---------------------------------------------------------------------------

test("Refinement.or returns true when the first refinement passes", () => {
	const isPositiveOrEven = pipe(isPositive, Refinement.or(isEven));
	expect(isPositiveOrEven(3)).toBe(true); // positive, odd
});

test("Refinement.or returns true when the second refinement passes", () => {
	const isPositiveOrEven = pipe(isPositive, Refinement.or(isEven));
	expect(isPositiveOrEven(-2)).toBe(true); // negative, even
});

test("Refinement.or returns true when both refinements pass", () => {
	const isPositiveOrEven = pipe(isPositive, Refinement.or(isEven));
	expect(isPositiveOrEven(4)).toBe(true); // positive and even
});

test("Refinement.or returns false when both refinements fail", () => {
	const isPositiveOrEven = pipe(isPositive, Refinement.or(isEven));
	expect(isPositiveOrEven(-3)).toBe(false); // negative and odd
});

// ---------------------------------------------------------------------------
// toFilter
// ---------------------------------------------------------------------------

test("Refinement.to.Maybe returns Some when refinement passes", () => {
	const result = pipe("hello", Refinement.to.Maybe(isNonEmpty));
	expect(result.kind).toBe("Some");
	expect(result.kind === "Some" ? result.value as string : null).toBe("hello");
});

test("Refinement.to.Maybe returns None when refinement fails", () => {
	expect(pipe("", Refinement.to.Maybe(isNonEmpty)) as Maybe<string>).toStrictEqual({ kind: "None" });
});

test("Refinement.to.Maybe works in a pipe chain with composed refinements", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	expect(Maybe.is.some(pipe(4, Refinement.to.Maybe(isPositiveEven)))).toBe(true);
	expect(Maybe.is.none(pipe(3, Refinement.to.Maybe(isPositiveEven)))).toBe(true);
	expect(Maybe.is.none(pipe(-2, Refinement.to.Maybe(isPositiveEven)))).toBe(true);
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("Refinement.to.Result returns Ok when refinement passes", () => {
	const result = pipe("hello", Refinement.to.Result(isNonEmpty, (s) => `"${s}" is empty`));
	expect(result.kind).toBe("Ok");
	expect(result.kind === "Ok" ? result.value as string : null).toBe("hello");
});

test("Refinement.to.Result returns Err with onFail value when refinement fails", () => {
	expect(pipe("", Refinement.to.Result(isNonEmpty, (s) => `"${s}" is empty`)) as Result<string, string>).toStrictEqual({
		kind: "Err",
		error: '"" is empty',
	});
});

test("Refinement.to.Result passes the failing value to onFail", () => {
	const result = pipe(-5, Refinement.to.Result(isPositive, (n) => `${n} is not positive`)) as Result<string, number>;
	expect(result).toStrictEqual({ kind: "Err", error: "-5 is not positive" });
});

test("Refinement.to.Result works in a pipe chain with composed refinements", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	expect(Result.is.ok(pipe(4, Refinement.to.Result(isPositiveEven, (n) => `${n} failed`)))).toBe(true);
	expect(pipe(3, Refinement.to.Result(isPositiveEven, (n) => `${n} failed`)) as Result<string, number>).toStrictEqual({
		kind: "Err",
		error: "3 failed",
	});
});
