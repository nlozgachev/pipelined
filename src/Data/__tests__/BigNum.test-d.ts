import { describe, expectTypeOf, it } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import type { Maybe } from "../../Core/Maybe.ts";
import { BigNum } from "../BigNum.ts";

describe("BigNum type-level tests", () => {
	it("inspects predicates", () => {
		expectTypeOf(BigNum.is.zero(0n)).toEqualTypeOf<boolean>();
		expectTypeOf(BigNum.is.even(2n)).toEqualTypeOf<boolean>();
		expectTypeOf(BigNum.is.odd(3n)).toEqualTypeOf<boolean>();
		expectTypeOf(BigNum.is.positive(1n)).toEqualTypeOf<boolean>();
		expectTypeOf(BigNum.is.negative(-1n)).toEqualTypeOf<boolean>();
	});

	it("inspects conversions", () => {
		expectTypeOf(BigNum.from.string("100")).toEqualTypeOf<Maybe<bigint>>();
		expectTypeOf(BigNum.from.number(42)).toEqualTypeOf<Maybe<bigint>>();
		expectTypeOf(BigNum.to.number(42n)).toEqualTypeOf<Maybe<number>>();
	});

	it("inspects arithmetic operations and combinators", () => {
		expectTypeOf(pipe(10n, BigNum.add(5n))).toEqualTypeOf<bigint>();
		expectTypeOf(pipe(10n, BigNum.subtract(5n))).toEqualTypeOf<bigint>();
		expectTypeOf(pipe(10n, BigNum.multiply(5n))).toEqualTypeOf<bigint>();
		expectTypeOf(pipe(10n, BigNum.divide(2n))).toEqualTypeOf<Maybe<bigint>>();
		expectTypeOf(pipe(10n, BigNum.remainder(3n))).toEqualTypeOf<Maybe<bigint>>();

		expectTypeOf(pipe(150n, BigNum.clamp(0n, 100n))).toEqualTypeOf<bigint>();
		expectTypeOf(pipe(5n, BigNum.between(1n, 10n))).toEqualTypeOf<boolean>();
		expectTypeOf(pipe(5n, BigNum.inRange(1n, 10n))).toEqualTypeOf<boolean>();
		expectTypeOf(BigNum.abs(-42n)).toEqualTypeOf<bigint>();

		expectTypeOf(BigNum.min([1n, 2n, 3n])).toEqualTypeOf<Maybe<bigint>>();
		expectTypeOf(BigNum.max([1n, 2n, 3n])).toEqualTypeOf<Maybe<bigint>>();
		expectTypeOf(BigNum.sum([1n, 2n, 3n])).toEqualTypeOf<bigint>();
	});

	it("rejects invalid input types", () => {
		// @ts-expect-error non-bigint cannot be checked for zero
		expectTypeOf(BigNum.is.zero(0)).toBeBoolean();

		// @ts-expect-error number cannot be added to BigNum directly
		expectTypeOf(pipe(10n, BigNum.add(5))).toBeObject();

		// @ts-expect-error non-string passed to from.string
		expectTypeOf(BigNum.from.string(123)).toBeObject();

		// @ts-expect-error non-number passed to from.number
		expectTypeOf(BigNum.from.number("42")).toBeObject();
	});
});
