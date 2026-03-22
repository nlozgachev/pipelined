import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Refinement } from "../Refinement.ts";
import { Option } from "../Option.ts";
import { Result } from "../Result.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// Phantom brand types — each uses a unique symbol so intersections don't collapse
// ---------------------------------------------------------------------------

declare const _nonEmpty: unique symbol;
declare const _trimmed: unique symbol;
declare const _positive: unique symbol;
declare const _even: unique symbol;

type NonEmptyString = string & { readonly [_nonEmpty]: true };
type TrimmedString = NonEmptyString & { readonly [_trimmed]: true };
type PositiveNumber = number & { readonly [_positive]: true };
type EvenNumber = number & { readonly [_even]: true };

const isNonEmpty: Refinement<string, NonEmptyString> = Refinement.make((s) => s.length > 0);
const isTrimmed: Refinement<NonEmptyString, TrimmedString> = Refinement.make(
	(s) => s === s.trim(),
);
const isPositive: Refinement<number, PositiveNumber> = Refinement.make((n) => n > 0);
const isEven: Refinement<number, EvenNumber> = Refinement.make((n) => n % 2 === 0);

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

Deno.test("Refinement.make returns true when predicate passes", () => {
	assertStrictEquals(isNonEmpty("hello"), true);
});

Deno.test("Refinement.make returns false when predicate fails", () => {
	assertStrictEquals(isNonEmpty(""), false);
});

Deno.test("Refinement.make works as a type guard in conditional branches", () => {
	const value: string = "world";
	if (isNonEmpty(value)) {
		const _typed: NonEmptyString = value;
		assertStrictEquals(_typed as string, "world");
	}
});

// ---------------------------------------------------------------------------
// compose
// ---------------------------------------------------------------------------

Deno.test("Refinement.compose narrows A to C when both refinements pass", () => {
	const isNonEmptyTrimmed: Refinement<string, TrimmedString> = pipe(
		isNonEmpty,
		Refinement.compose(isTrimmed),
	);
	assertStrictEquals(isNonEmptyTrimmed("hello"), true);
});

Deno.test("Refinement.compose returns false when the first refinement fails", () => {
	const isNonEmptyTrimmed: Refinement<string, TrimmedString> = pipe(
		isNonEmpty,
		Refinement.compose(isTrimmed),
	);
	assertStrictEquals(isNonEmptyTrimmed(""), false);
});

Deno.test("Refinement.compose returns false when the second refinement fails", () => {
	const isNonEmptyTrimmed: Refinement<string, TrimmedString> = pipe(
		isNonEmpty,
		Refinement.compose(isTrimmed),
	);
	assertStrictEquals(isNonEmptyTrimmed("  spaces  "), false);
});

// ---------------------------------------------------------------------------
// and
// ---------------------------------------------------------------------------

Deno.test("Refinement.and returns true when both refinements pass", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	assertStrictEquals(isPositiveEven(4), true);
});

Deno.test("Refinement.and returns false when the first refinement fails", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	assertStrictEquals(isPositiveEven(-2), false);
});

Deno.test("Refinement.and returns false when the second refinement fails", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	assertStrictEquals(isPositiveEven(3), false);
});

Deno.test("Refinement.and returns false when both refinements fail", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	assertStrictEquals(isPositiveEven(-3), false);
});

// ---------------------------------------------------------------------------
// or
// ---------------------------------------------------------------------------

Deno.test("Refinement.or returns true when the first refinement passes", () => {
	const isPositiveOrEven = pipe(isPositive, Refinement.or(isEven));
	assertStrictEquals(isPositiveOrEven(3), true); // positive, odd
});

Deno.test("Refinement.or returns true when the second refinement passes", () => {
	const isPositiveOrEven = pipe(isPositive, Refinement.or(isEven));
	assertStrictEquals(isPositiveOrEven(-2), true); // negative, even
});

Deno.test("Refinement.or returns true when both refinements pass", () => {
	const isPositiveOrEven = pipe(isPositive, Refinement.or(isEven));
	assertStrictEquals(isPositiveOrEven(4), true); // positive and even
});

Deno.test("Refinement.or returns false when both refinements fail", () => {
	const isPositiveOrEven = pipe(isPositive, Refinement.or(isEven));
	assertStrictEquals(isPositiveOrEven(-3), false); // negative and odd
});

// ---------------------------------------------------------------------------
// toFilter
// ---------------------------------------------------------------------------

Deno.test("Refinement.toFilter returns Some when refinement passes", () => {
	const result = pipe("hello", Refinement.toFilter(isNonEmpty));
	assertStrictEquals(result.kind, "Some");
	assertStrictEquals(result.kind === "Some" ? result.value as string : null, "hello");
});

Deno.test("Refinement.toFilter returns None when refinement fails", () => {
	assertEquals(
		pipe("", Refinement.toFilter(isNonEmpty)) as Option<string>,
		{ kind: "None" },
	);
});

Deno.test("Refinement.toFilter works in a pipe chain with composed refinements", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	assertStrictEquals(
		Option.isSome(pipe(4, Refinement.toFilter(isPositiveEven))),
		true,
	);
	assertStrictEquals(
		Option.isNone(pipe(3, Refinement.toFilter(isPositiveEven))),
		true,
	);
	assertStrictEquals(
		Option.isNone(pipe(-2, Refinement.toFilter(isPositiveEven))),
		true,
	);
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

Deno.test("Refinement.toResult returns Ok when refinement passes", () => {
	const result = pipe("hello", Refinement.toResult(isNonEmpty, (s) => `"${s}" is empty`));
	assertStrictEquals(result.kind, "Ok");
	assertStrictEquals(result.kind === "Ok" ? result.value as string : null, "hello");
});

Deno.test("Refinement.toResult returns Err with onFail value when refinement fails", () => {
	assertEquals(
		pipe("", Refinement.toResult(isNonEmpty, (s) => `"${s}" is empty`)) as Result<string, string>,
		{ kind: "Error", error: '"" is empty' },
	);
});

Deno.test("Refinement.toResult passes the failing value to onFail", () => {
	const result = pipe(
		-5,
		Refinement.toResult(isPositive, (n) => `${n} is not positive`),
	) as Result<string, number>;
	assertEquals(result, { kind: "Error", error: "-5 is not positive" });
});

Deno.test("Refinement.toResult works in a pipe chain with composed refinements", () => {
	const isPositiveEven = pipe(isPositive, Refinement.and(isEven));
	assertStrictEquals(
		Result.isOk(pipe(4, Refinement.toResult(isPositiveEven, (n) => `${n} failed`))),
		true,
	);
	assertEquals(
		pipe(3, Refinement.toResult(isPositiveEven, (n) => `${n} failed`)) as Result<string, number>,
		{ kind: "Error", error: "3 failed" },
	);
});
