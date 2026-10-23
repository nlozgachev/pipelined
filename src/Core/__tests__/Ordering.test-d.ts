import { describe, expectTypeOf, it } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Ordering } from "../Ordering.ts";

describe("Ordering type-level tests", () => {
	it("inspects primitive orderings and composition combinators", () => {
		expectTypeOf(Ordering.string).toEqualTypeOf<Ordering<string>>();
		expectTypeOf(Ordering.number).toEqualTypeOf<Ordering<number>>();
		expectTypeOf(Ordering.date).toEqualTypeOf<Ordering<Date>>();

		expectTypeOf(Ordering.reverse(Ordering.number)).toEqualTypeOf<Ordering<number>>();

		type Employee = { name: string; salary: number; };
		const byName = pipe(Ordering.string, Ordering.by((e: Employee) => e.name));
		const bySalary = pipe(Ordering.number, Ordering.by((e: Employee) => e.salary));

		expectTypeOf(byName).toEqualTypeOf<Ordering<Employee>>();
		expectTypeOf(bySalary).toEqualTypeOf<Ordering<Employee>>();

		const composite = pipe(byName, Ordering.thenBy(bySalary));
		expectTypeOf(composite).toEqualTypeOf<Ordering<Employee>>();

		const byFields = Ordering.byFields([byName, bySalary]);
		expectTypeOf(byFields).toEqualTypeOf<Ordering<Employee>>();

		const tupleOrd = Ordering.tuple(Ordering.string, Ordering.number);
		expectTypeOf(tupleOrd).toEqualTypeOf<Ordering<[string, number]>>();
	});

	it("rejects mismatched types in comparison and combinators", () => {
		// @ts-expect-error cannot order string and number
		Ordering.number(1, "2");

		// @ts-expect-error field extractor returns mismatched type
		expectTypeOf(pipe(Ordering.number, Ordering.by((s: string) => s.trim()))).toBeFunction();
	});
});
