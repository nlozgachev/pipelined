import { describe, expectTypeOf, it } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Equality } from "../Equality.ts";

describe("Equality type-level tests", () => {
	it("inspects primitive instances and adapters", () => {
		expectTypeOf(Equality.string).toEqualTypeOf<Equality<string>>();
		expectTypeOf(Equality.number).toEqualTypeOf<Equality<number>>();
		expectTypeOf(Equality.boolean).toEqualTypeOf<Equality<boolean>>();
		expectTypeOf(Equality.date).toEqualTypeOf<Equality<Date>>();

		const arrEq = Equality.array(Equality.number);
		expectTypeOf(arrEq).toEqualTypeOf<Equality<readonly number[]>>();

		type User = { id: string; age: number; };
		const byId = pipe(Equality.string, Equality.by((u: User) => u.id));
		expectTypeOf(byId).toEqualTypeOf<Equality<User>>();

		const byAge = pipe(Equality.number, Equality.by((u: User) => u.age));
		const combined = pipe(byId, Equality.and(byAge));
		expectTypeOf(combined).toEqualTypeOf<Equality<User>>();
	});

	it("inspects struct and tuple combinators", () => {
		type Product = { id: string; price: number; inStock: boolean; };
		const prodEq = Equality.struct<Product>({ id: Equality.string, price: Equality.number, inStock: Equality.boolean });
		expectTypeOf(prodEq).toEqualTypeOf<Equality<Product>>();

		const pairEq = Equality.tuple(Equality.string, Equality.number);
		expectTypeOf(pairEq).toEqualTypeOf<Equality<[string, number]>>();
	});

	it("rejects mismatched types in comparison and combinators", () => {
		// @ts-expect-error cannot compare string and number
		Equality.string("a", 1);

		// @ts-expect-error field extractor returns mismatched type
		expectTypeOf(pipe(Equality.number, Equality.by((s: string) => s.trim()))).toBeFunction();
	});
});
