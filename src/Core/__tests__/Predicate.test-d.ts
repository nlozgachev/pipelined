import { describe, expectTypeOf, it } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Predicate } from "../Predicate.ts";
import { Refinement } from "../Refinement.ts";

describe("Predicate type-level tests", () => {
	it("inspects combinators and adapters", () => {
		const isPositive: Predicate<number> = (n) => n > 0;
		const isEven: Predicate<number> = (n) => n % 2 === 0;

		expectTypeOf(Predicate.not(isPositive)).toEqualTypeOf<Predicate<number>>();
		expectTypeOf(pipe(isPositive, Predicate.and(isEven))).toEqualTypeOf<Predicate<number>>();
		expectTypeOf(pipe(isPositive, Predicate.or(isEven))).toEqualTypeOf<Predicate<number>>();

		type User = { age: number; };
		const isAdultUser = pipe((n: number) => n >= 18, Predicate.using((u: User) => u.age));
		expectTypeOf(isAdultUser).toEqualTypeOf<Predicate<User>>();

		expectTypeOf(Predicate.all([isPositive, isEven])).toEqualTypeOf<Predicate<number>>();
		expectTypeOf(Predicate.any([isPositive, isEven])).toEqualTypeOf<Predicate<number>>();

		const isString: Refinement<unknown, string> = Refinement.from.Predicate((x): x is string => typeof x === "string");
		expectTypeOf(Predicate.from.Refinement(isString)).toEqualTypeOf<Predicate<unknown>>();

		const classify = Predicate.match(
			[[(n: number) => n < 0, () => "negative"], [(n: number) => n === 0, () => "zero"]],
			() => "positive",
		);
		expectTypeOf(classify).toEqualTypeOf<(a: number) => string>();

		const classifyWidened = Predicate.match([[(n: number) => n > 0, () => "positive"]], () => null);
		expectTypeOf(classifyWidened).toEqualTypeOf<(a: number) => string | null>();
	});

	it("rejects mismatched types in combinators", () => {
		const isPositive: Predicate<number> = (n) => n > 0;
		const isString: Predicate<string> = (s) => s.length > 0;

		// @ts-expect-error cannot combine number predicate and string predicate
		expectTypeOf(pipe(isPositive, Predicate.and(isString))).toBeFunction();
	});
});
