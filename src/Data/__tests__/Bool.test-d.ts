import { describe, expectTypeOf, it } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import type { Maybe } from "../../Core/Maybe.ts";
import type { Result } from "../../Core/Result.ts";
import { Bool } from "../Bool.ts";

describe("Bool type-level tests", () => {
	it("inspects type guards and narrowing", () => {
		const checkUnknown = (val: unknown) => {
			if (Bool.is.boolean(val)) {
				expectTypeOf(val).toEqualTypeOf<boolean>();
			}
			if (Bool.is.true(val)) {
				expectTypeOf(val).toEqualTypeOf<true>();
			}
			if (Bool.is.false(val)) {
				expectTypeOf(val).toEqualTypeOf<false>();
			}
		};
		checkUnknown(true);

		const checkNullable = (maybeStr: string | null) => {
			if (Bool.is.truthy(maybeStr)) {
				expectTypeOf(maybeStr).toEqualTypeOf<string>();
			}
			if (Bool.is.falsy(maybeStr)) {
				expectTypeOf(maybeStr).toEqualTypeOf<"" | null>();
			}
		};
		checkNullable("test");
	});

	it("inspects boolean combinators and lazy evaluation", () => {
		expectTypeOf(Bool.not(true)).toEqualTypeOf<boolean>();
		expectTypeOf(pipe(true, Bool.and(false))).toEqualTypeOf<boolean>();
		expectTypeOf(pipe(true, Bool.or(false))).toEqualTypeOf<boolean>();
		expectTypeOf(pipe(true, Bool.xor(false))).toEqualTypeOf<boolean>();

		expectTypeOf(pipe(true, Bool.andLazy(() => false))).toEqualTypeOf<boolean>();
		expectTypeOf(pipe(true, Bool.orLazy(() => true))).toEqualTypeOf<boolean>();

		expectTypeOf(Bool.all([true, false])).toEqualTypeOf<boolean>();
		expectTypeOf(Bool.any([true, false])).toEqualTypeOf<boolean>();

		const matched = pipe(true, Bool.match({ true: () => "yes", false: () => 0 }));
		expectTypeOf(matched).toEqualTypeOf<string | number>();
	});

	it("inspects conversions", () => {
		expectTypeOf(Bool.from.string("true")).toEqualTypeOf<Maybe<boolean>>();
		expectTypeOf(Bool.from.number(1)).toEqualTypeOf<Maybe<boolean>>();
		expectTypeOf(Bool.from.truthy("content")).toEqualTypeOf<boolean>();

		expectTypeOf(pipe(true, Bool.to.Maybe(() => 42))).toEqualTypeOf<Maybe<number>>();
		expectTypeOf(pipe(true, Bool.to.Result(() => "error", () => 42))).toEqualTypeOf<Result<string, number>>();
		expectTypeOf(Bool.to.number(true)).toEqualTypeOf<1 | 0>();
		expectTypeOf(Bool.to.string(true)).toEqualTypeOf<"true" | "false">();
	});

	it("rejects invalid input types", () => {
		// @ts-expect-error non-boolean passed to not
		expectTypeOf(Bool.not("true")).toBeBoolean();

		// @ts-expect-error non-boolean passed to and
		expectTypeOf(pipe("true", Bool.and(true))).toBeBoolean();

		// @ts-expect-error non-boolean array passed to all
		expectTypeOf(Bool.all([1, 2, 3])).toBeBoolean();

		// @ts-expect-error missing false case in match
		expectTypeOf(Bool.match({ true: () => 1 })).toBeFunction();
	});
});
