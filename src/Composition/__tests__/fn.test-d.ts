import { describe, expectTypeOf, it } from "vitest";
import { constant, identity, once, tuple, untuple } from "../fn.ts";

describe("fn utilities type-level tests", () => {
	it("inspects identity and constant", () => {
		expectTypeOf(identity(42)).toEqualTypeOf<number>();
		expectTypeOf(identity("hello")).toEqualTypeOf<string>();

		const const42 = constant(42);
		expectTypeOf(const42).toEqualTypeOf<() => number>();
		expectTypeOf(const42()).toEqualTypeOf<number>();
	});

	it("inspects once", () => {
		const init = once(() => ({ id: "uuid", active: true }));
		expectTypeOf(init).toEqualTypeOf<() => { id: string; active: boolean; }>();
		expectTypeOf(init()).toEqualTypeOf<{ id: string; active: boolean; }>();
	});

	it("inspects tuple and untuple conversions", () => {
		const add = (a: number, b: string): boolean => a === b.length;
		const addTuple = tuple(add);
		expectTypeOf(addTuple).toEqualTypeOf<(args: [number, string]) => boolean>();

		const untupled = untuple(addTuple);
		expectTypeOf(untupled).toEqualTypeOf<(a: number, b: string) => boolean>();
	});

	it("rejects invalid input types", () => {
		// @ts-expect-error non-function passed to once
		expectTypeOf(once(123)).toBeFunction();

		// @ts-expect-error non-function passed to tuple
		expectTypeOf(tuple("not-a-fn")).toBeFunction();
	});
});
