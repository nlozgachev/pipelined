import { describe, expectTypeOf, it } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Combinable } from "../Combinable.ts";
import type { Maybe } from "../Maybe.ts";

describe("Combinable type-level tests", () => {
	it("inspects built-in combinable instances and combinators", () => {
		expectTypeOf(Combinable.string).toEqualTypeOf<Combinable<string>>();
		expectTypeOf(Combinable.sum).toEqualTypeOf<Combinable<number>>();
		expectTypeOf(Combinable.product).toEqualTypeOf<Combinable<number>>();
		expectTypeOf(Combinable.all).toEqualTypeOf<Combinable<boolean>>();
		expectTypeOf(Combinable.any).toEqualTypeOf<Combinable<boolean>>();

		const arrComb = Combinable.array<number>();
		expectTypeOf(arrComb).toEqualTypeOf<Combinable<readonly number[]>>();

		const maybeComb = Combinable.maybe(Combinable.sum);
		expectTypeOf(maybeComb).toEqualTypeOf<Combinable<Maybe<number>>>();

		expectTypeOf(pipe([1, 2, 3], Combinable.combineAll(Combinable.sum))).toEqualTypeOf<number>();
		expectTypeOf(pipe(["a", "b"], Combinable.combineAll(Combinable.string))).toEqualTypeOf<string>();

		type Stats = { count: number; total: number; };
		const statsComb = Combinable.struct<Stats>({ count: Combinable.sum, total: Combinable.sum });
		expectTypeOf(statsComb).toEqualTypeOf<Combinable<Stats>>();
	});

	it("rejects mismatched types in combineAll and struct", () => {
		// @ts-expect-error cannot combine string array with sum combinable
		expectTypeOf(pipe(["a", "b"], Combinable.combineAll(Combinable.sum))).toBeNumber();
	});
});
