import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Option } from "../Option.ts";
import { Refinement } from "../Refinement.ts";
import { Result } from "../Result.ts";

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

const isNonEmpty: Refinement<string, NonEmptyString> = Refinement.make((s) => s.length > 0);
const isTrimmed: Refinement<NonEmptyString, TrimmedString> = Refinement.make(
	(s) => s === s.trim(),
);
const isPositive: Refinement<number, PositiveNumber> = Refinement.make((n) => n > 0);
const isEven: Refinement<number, EvenNumber> = Refinement.make((n) => n % 2 === 0);

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("Refinement.make returns true when predicate passes", () => {
	expect(isNonEmpty("hello")).toBe(true);
});

test("Refinement.make returns false when predicate fails", () => {
	expect(isNonEmpty("")).toBe(false);
});

test("Refinement.make works as a type guard in conditional branches", () => {
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
	const isNonEmptyTrimmed: Refinement<string, TrimmedString> = pipe(
		isNonEmpty,
		Refinement.compose(isTrimmed),
	);
	expect(isNonEmptyTrimmed("hello")).toBe(true);
});

test("Refinement.compose returns false when the first refinement fails", () => {
	const isNonEmptyTrimmed: Refinement<string, TrimmedString> = pipe(
		isNonEmpty,
		Refinement.compose(isTrimmed),
	);
	expect(isNonEmptyTrimmed("")).toBe(false);
});

test("Refinement.compose returns false when the second refinement fails", () => {
	const isNonEmptyTrimmed: Refinement<string, TrimmedString> = pipe(
		isNonEmpty,
		Refinement.compose(isTrimmed),
	);
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

test("Refinement.toFilter returns Some when refinement passes", () => {
	const result = pipe("hello", Refinement.toFilter(isNonEmpty));
	expect(result.kind).toBe("Some");
	expect(result.kind === "Some" ? result.value as string : null).toBe("hello");
});

test("Refinement.toFilter returns None when refinement fails", () => {
	expect(pipe("", Refinement.toFilter(isNonEmpty)) as Option<string>).toEqual({ kind: "None" });
});

test("Refinement.toFilter works in a pipe chain with composed refinements", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	expect(Option.isSome(pipe(4, Refinement.toFilter(isPositiveEven)))).toBe(true);
	expect(Option.isNone(pipe(3, Refinement.toFilter(isPositiveEven)))).toBe(true);
	expect(Option.isNone(pipe(-2, Refinement.toFilter(isPositiveEven)))).toBe(true);
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("Refinement.toResult returns Ok when refinement passes", () => {
	const result = pipe("hello", Refinement.toResult(isNonEmpty, (s) => `"${s}" is empty`));
	expect(result.kind).toBe("Ok");
	expect(result.kind === "Ok" ? result.value as string : null).toBe("hello");
});

test("Refinement.toResult returns Err with onFail value when refinement fails", () => {
	expect(pipe("", Refinement.toResult(isNonEmpty, (s) => `"${s}" is empty`)) as Result<string, string>).toEqual(
		{ kind: "Error", error: '"" is empty' },
	);
});

test("Refinement.toResult passes the failing value to onFail", () => {
	const result = pipe(
		-5,
		Refinement.toResult(isPositive, (n) => `${n} is not positive`),
	) as Result<string, number>;
	expect(result).toEqual({ kind: "Error", error: "-5 is not positive" });
});

test("Refinement.toResult works in a pipe chain with composed refinements", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	expect(Result.isOk(pipe(4, Refinement.toResult(isPositiveEven, (n) => `${n} failed`)))).toBe(true);
	expect(pipe(3, Refinement.toResult(isPositiveEven, (n) => `${n} failed`)) as Result<string, number>).toEqual(
		{ kind: "Error", error: "3 failed" },
	);
});
