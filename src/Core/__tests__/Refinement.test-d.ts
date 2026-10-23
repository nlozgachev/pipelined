import { describe, expectTypeOf, it } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import type { Maybe } from "../Maybe.ts";
import { Refinement } from "../Refinement.ts";
import type { Result } from "../Result.ts";

describe("Refinement type-level tests", () => {
	type NonEmptyString = string & { readonly _tag: "NonEmpty"; };
	type TrimmedString = NonEmptyString & { readonly _tag: "Trimmed"; };

	it("inspects creation, composition, intersection, and union", () => {
		const isString: Refinement<unknown, string> = Refinement.from.Predicate((x): x is string => typeof x === "string");
		const isNonEmpty: Refinement<string, NonEmptyString> = Refinement.from.Predicate((s): s is NonEmptyString =>
			s.length > 0
		);
		const isTrimmed: Refinement<NonEmptyString, TrimmedString> = Refinement.from.Predicate((s): s is TrimmedString =>
			s === s.trim()
		);

		const isNonEmptyTrimmed = pipe(isNonEmpty, Refinement.compose(isTrimmed));
		expectTypeOf(isNonEmptyTrimmed).toEqualTypeOf<Refinement<string, TrimmedString>>();

		const isNonEmptyFromUnknown = pipe(isString, Refinement.compose(isNonEmpty));
		expectTypeOf(isNonEmptyFromUnknown).toEqualTypeOf<Refinement<unknown, NonEmptyString>>();

		type HasId = { readonly id: string; };
		type HasAge = { readonly age: number; };
		const hasId: Refinement<object, HasId> = Refinement.from.Predicate((x): x is HasId => "id" in x);
		const hasAge: Refinement<object, HasAge> = Refinement.from.Predicate((x): x is HasAge => "age" in x);

		const hasBoth = pipe(hasId, Refinement.and(hasAge));
		expectTypeOf(hasBoth).toEqualTypeOf<Refinement<object, HasId & HasAge>>();

		const hasEither = pipe(hasId, Refinement.or(hasAge));
		expectTypeOf(hasEither).toEqualTypeOf<Refinement<object, HasId | HasAge>>();
	});

	it("inspects conversions to Maybe and Result", () => {
		const isNonEmpty: Refinement<string, NonEmptyString> = Refinement.from.Predicate((s): s is NonEmptyString =>
			s.length > 0
		);

		const toMaybe = Refinement.to.Maybe(isNonEmpty);
		expectTypeOf(toMaybe("hello")).toEqualTypeOf<Maybe<NonEmptyString>>();

		const toResult = Refinement.to.Result(isNonEmpty, () => "empty_error");
		expectTypeOf(toResult("hello")).toEqualTypeOf<Result<string, NonEmptyString>>();
	});

	it("rejects invalid compositions where target is not a sub-refinement", () => {
		const isNumber: Refinement<unknown, number> = Refinement.from.Predicate((x): x is number => typeof x === "number");
		const isNonEmpty: Refinement<string, NonEmptyString> = Refinement.from.Predicate((s): s is NonEmptyString =>
			s.length > 0
		);

		// @ts-expect-error cannot compose number refinement with string refinement
		expectTypeOf(pipe(isNumber, Refinement.compose(isNonEmpty))).toBeFunction();
	});
});
