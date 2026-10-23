import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Equality } from "../Equality.ts";

test("primitive instances: infers exact Equality types", () => {
	expectTypeOf(Equality.string).toEqualTypeOf<Equality<string>>();
	expectTypeOf(Equality.number).toEqualTypeOf<Equality<number>>();
	expectTypeOf(Equality.boolean).toEqualTypeOf<Equality<boolean>>();
	expectTypeOf(Equality.date).toEqualTypeOf<Equality<Date>>();

	const arrEq = Equality.array(Equality.number);
	expectTypeOf(arrEq).toEqualTypeOf<Equality<readonly number[]>>();
});

test("by and and: preserves and adapts equality types in pipelines", () => {
	type User = { id: string; age: number; };
	const byId = pipe(Equality.string, Equality.by((u: User) => u.id));
	expectTypeOf(byId).toEqualTypeOf<Equality<User>>();

	const byAge = pipe(Equality.number, Equality.by((u: User) => u.age));
	const combined = pipe(byId, Equality.and(byAge));
	expectTypeOf(combined).toEqualTypeOf<Equality<User>>();
});

test("struct and tuple: infers composite structured equality types", () => {
	type Product = { id: string; price: number; inStock: boolean; };
	const prodEq = Equality.struct<Product>({ id: Equality.string, price: Equality.number, inStock: Equality.boolean });
	expectTypeOf(prodEq).toEqualTypeOf<Equality<Product>>();

	const pairEq = Equality.tuple(Equality.string, Equality.number);
	expectTypeOf(pairEq).toEqualTypeOf<Equality<[string, number]>>();
});

test("type errors: rejects invalid types in comparison, adaptors, and struct fields", () => {
	// @ts-expect-error cannot compare string and number
	expectTypeOf(Equality.string("a", 1)).toBeBoolean();

	// @ts-expect-error field extractor returns mismatched type
	expectTypeOf(pipe(Equality.number, Equality.by((s: string) => s.trim()))).toBeFunction();

	// @ts-expect-error struct fields mismatch with target record type
	expectTypeOf(Equality.struct<{ id: string; }>({ id: Equality.number })).toBeFunction();
});
