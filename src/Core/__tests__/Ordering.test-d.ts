import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Ordering } from "../Ordering.ts";

test("primitive instances and reverse: infers exact Ordering types", () => {
	expectTypeOf(Ordering.string).toEqualTypeOf<Ordering<string>>();
	expectTypeOf(Ordering.number).toEqualTypeOf<Ordering<number>>();
	expectTypeOf(Ordering.date).toEqualTypeOf<Ordering<Date>>();

	expectTypeOf(Ordering.reverse(Ordering.number)).toEqualTypeOf<Ordering<number>>();
});

test("by and thenBy: preserves and adapts ordering types in pipelines", () => {
	type Employee = { name: string; salary: number; };
	const byName = pipe(Ordering.string, Ordering.by((e: Employee) => e.name));
	const bySalary = pipe(Ordering.number, Ordering.by((e: Employee) => e.salary));

	expectTypeOf(byName).toEqualTypeOf<Ordering<Employee>>();
	expectTypeOf(bySalary).toEqualTypeOf<Ordering<Employee>>();

	const composite = pipe(byName, Ordering.thenBy(bySalary));
	expectTypeOf(composite).toEqualTypeOf<Ordering<Employee>>();
});

test("byFields and tuple: infers composite ordering types", () => {
	type Employee = { name: string; salary: number; };
	const byName = pipe(Ordering.string, Ordering.by((e: Employee) => e.name));
	const bySalary = pipe(Ordering.number, Ordering.by((e: Employee) => e.salary));

	const byFields = Ordering.byFields([byName, bySalary]);
	expectTypeOf(byFields).toEqualTypeOf<Ordering<Employee>>();

	const tupleOrd = Ordering.tuple(Ordering.string, Ordering.number);
	expectTypeOf(tupleOrd).toEqualTypeOf<Ordering<[string, number]>>();
});

test("type errors: rejects invalid types in comparison and combinators", () => {
	// @ts-expect-error cannot order string and number
	expectTypeOf(Ordering.number(1, "2")).toBeNumber();

	// @ts-expect-error field extractor returns mismatched type
	expectTypeOf(pipe(Ordering.number, Ordering.by((s: string) => s.trim()))).toBeFunction();

	// @ts-expect-error thenBy requires matching element type
	expectTypeOf(pipe(Ordering.number, Ordering.thenBy(Ordering.string))).toBeFunction();
});
