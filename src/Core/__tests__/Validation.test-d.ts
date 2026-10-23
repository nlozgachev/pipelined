import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Validation } from "../Validation.ts";

test("make: infers precise variant types for Passed and Failed", () => {
	const passedVal = Validation.make.passed(42);
	expectTypeOf(passedVal).toEqualTypeOf<Validation.Passed<number>>();

	const failedVal = Validation.make.failed("failed");
	expectTypeOf(failedVal).toEqualTypeOf<Validation.Failed<string>>();
});

test("map / mapError: preserves natural union and propagates channel types", () => {
	const naturalUnion: Validation<string, number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("err");

	const mapped = pipe(naturalUnion, Validation.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Validation<string, string>>();

	const mappedErr = pipe(naturalUnion, Validation.mapError((err) => err.length));
	expectTypeOf(mappedErr).toEqualTypeOf<Validation<number, number>>();
});

test("apply: accumulates error unions across applicative evaluations", () => {
	const valF: Validation<"ERR_A", (n: number) => string> = constTruthyBool()
		? Validation.make.passed((n: number) => n.toString())
		: Validation.make.failed("ERR_A");

	const valA: Validation<"ERR_B", number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("ERR_B");

	const applied = pipe(valF, Validation.apply(valA));
	expectTypeOf(applied).toEqualTypeOf<Validation<"ERR_A" | "ERR_B", string>>();
});

test("match: produces unified return type from exhaustive handlers", () => {
	const naturalUnion: Validation<string, number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("err");

	const outcome = pipe(
		naturalUnion,
		Validation.match({ passed: (val) => val > 0, failed: (errors) => errors.length > 0 }),
	);
	expectTypeOf(outcome).toEqualTypeOf<boolean>();
});

test("getOrElse: widens return type to union with fallback", () => {
	const naturalUnion: Validation<string, string> = constTruthyBool()
		? Validation.make.passed("hello")
		: Validation.make.failed("err");
	const val = pipe(naturalUnion, Validation.getOrElse((): null => null));
	expectTypeOf(val).toEqualTypeOf<string | null>();
});

test("tap & tapError: preserve channel types in pipelines", () => {
	const naturalUnion: Validation<string, number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("err");

	const tapped = pipe(naturalUnion, Validation.tap((_n) => {}));
	expectTypeOf(tapped).toEqualTypeOf<Validation<string, number>>();

	const tappedErr = pipe(naturalUnion, Validation.tapError((_errs) => {}));
	expectTypeOf(tappedErr).toEqualTypeOf<Validation<string, number>>();
});

test("apply: infers combined error type when combineErrors option is provided", () => {
	const fn = Validation.make.passed((n: number) => n * 2);
	const arg = Validation.make.passed(5);
	const res = pipe(
		fn,
		Validation.apply(arg, {
			combineErrors: (
				e1: readonly string[],
				e2: readonly number[],
			): readonly [string] => [`${e1.join(",")}-${e2.join(",")}`],
		}),
	);
	expectTypeOf(res).toEqualTypeOf<Validation<string, number>>();
});

test("keyed: narrows validated object properties when check passes", () => {
	const validateUser = Validation.keyed.make({
		name: (s: string) => (s.length > 0 ? Validation.make.passed(s) : Validation.make.failed("Name required")),
		age: (n: number) => (n >= 18 ? Validation.make.passed(n) : Validation.make.failed("Must be 18+")),
	});

	const res = validateUser({ name: "Alice", age: 30 });
	if (Validation.keyed.is.passed(res)) {
		expectTypeOf(res.name).toEqualTypeOf<Validation.Passed<string>>();
		expectTypeOf(res.age).toEqualTypeOf<Validation.Passed<number>>();
	}
});

test("from.Predicate: narrows type with type guard refinement", () => {
	const isString = (val: unknown): val is string => typeof val === "string";
	const lifted = Validation.from.Predicate(isString, () => "not a string" as const);
	expectTypeOf(lifted("hello")).toEqualTypeOf<Validation<"not a string", string>>();
});

test("struct: preserves heterogeneous error unions and object shapes", () => {
	const valA: Validation<"ERR_A", number> = constTruthyBool()
		? Validation.make.passed(1)
		: Validation.make.failed("ERR_A");
	const valB: Validation<"ERR_B", string> = constTruthyBool()
		? Validation.make.passed("foo")
		: Validation.make.failed("ERR_B");

	const structured = Validation.struct({ a: valA, b: valB });
	expectTypeOf(structured).toEqualTypeOf<Validation<"ERR_A" | "ERR_B", { a: number; b: string; }>>();
});

test("negative: flags missing match handlers, invalid transforms, and non-Validation struct fields", () => {
	const naturalUnion: Validation<string, number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("err");

	// @ts-expect-error Missing 'failed' handler in match cases
	expectTypeOf(Validation.match({ passed: (n: number) => n })).toBeFunction();

	// @ts-expect-error Map transform must be a function
	expectTypeOf(Validation.map(123)(naturalUnion)).toBeObject();

	// @ts-expect-error Validation.make.passed requires an argument
	expectTypeOf(Validation.make.passed()).toBeObject();

	// @ts-expect-error Struct field values must be Validation instances
	expectTypeOf(Validation.struct({ a: 123 })).toBeObject();
});
