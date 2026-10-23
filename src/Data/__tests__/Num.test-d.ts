import { describe, expectTypeOf, it } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import type { Maybe } from "../../Core/Maybe.ts";
import { Num } from "../Num.ts";

describe("Num type-level tests", () => {
	it("inspects predicates", () => {
		expectTypeOf(Num.is.zero(0)).toEqualTypeOf<boolean>();
		expectTypeOf(Num.is.integer(42)).toEqualTypeOf<boolean>();
		expectTypeOf(Num.is.float(3.14)).toEqualTypeOf<boolean>();
		expectTypeOf(Num.is.finite(100)).toEqualTypeOf<boolean>();
		expectTypeOf(Num.is.nan(NaN)).toEqualTypeOf<boolean>();
		expectTypeOf(Num.is.even(2)).toEqualTypeOf<boolean>();
		expectTypeOf(Num.is.odd(3)).toEqualTypeOf<boolean>();
		expectTypeOf(Num.is.positive(1)).toEqualTypeOf<boolean>();
		expectTypeOf(Num.is.negative(-1)).toEqualTypeOf<boolean>();
	});

	it("inspects numeric operations and combinators", () => {
		expectTypeOf(Num.range(0, 5)).toEqualTypeOf<readonly number[]>();
		expectTypeOf(Num.range(0, 5, 2)).toEqualTypeOf<readonly number[]>();
		expectTypeOf(pipe(10, Num.clamp(0, 100))).toEqualTypeOf<number>();
		expectTypeOf(pipe(5, Num.between(1, 10))).toEqualTypeOf<boolean>();
		expectTypeOf(pipe(5, Num.inRange(1, 10))).toEqualTypeOf<boolean>();

		expectTypeOf(Num.from.string("42")).toEqualTypeOf<Maybe<number>>();

		expectTypeOf(pipe(5, Num.add(3))).toEqualTypeOf<number>();
		expectTypeOf(pipe(5, Num.subtract(3))).toEqualTypeOf<number>();
		expectTypeOf(pipe(5, Num.multiply(3))).toEqualTypeOf<number>();
		expectTypeOf(pipe(10, Num.divide(2))).toEqualTypeOf<Maybe<number>>();
		expectTypeOf(pipe(10, Num.remainder(3))).toEqualTypeOf<Maybe<number>>();

		expectTypeOf(pipe(-5, Num.abs)).toEqualTypeOf<number>();
		expectTypeOf(pipe(5, Num.negate)).toEqualTypeOf<number>();
		expectTypeOf(pipe(3.5, Num.round)).toEqualTypeOf<number>();
		expectTypeOf(pipe(3.5, Num.floor)).toEqualTypeOf<number>();
		expectTypeOf(pipe(3.5, Num.ceil)).toEqualTypeOf<number>();

		expectTypeOf(Num.sum([1, 2, 3])).toEqualTypeOf<number>();
		expectTypeOf(Num.mean([1, 2, 3])).toEqualTypeOf<Maybe<number>>();
		expectTypeOf(Num.min([1, 2, 3])).toEqualTypeOf<Maybe<number>>();
		expectTypeOf(Num.max([1, 2, 3])).toEqualTypeOf<Maybe<number>>();

		expectTypeOf(pipe(1234.5, Num.format())).toEqualTypeOf<Maybe<string>>();
		expectTypeOf(pipe(1234.5, Num.format({ style: "currency", currency: "USD" }, "en-US"))).toEqualTypeOf<
			Maybe<string>
		>();
	});

	it("rejects invalid input types", () => {
		// @ts-expect-error non-number cannot be checked for zero
		expectTypeOf(Num.is.zero("0")).toBeBoolean();

		// @ts-expect-error non-number cannot be added
		expectTypeOf(pipe("5", Num.add(3))).toBeNumber();

		// @ts-expect-error non-number cannot be range bound
		expectTypeOf(Num.range("0", 5)).toBeObject();

		// @ts-expect-error non-string cannot be converted from string
		expectTypeOf(Num.from.string(42)).toBeObject();
	});
});
