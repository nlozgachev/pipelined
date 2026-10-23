import type { NonEmptyArr } from "#internal";
import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Validation } from "../Validation.ts";

test("make: infers precise variant types for Passed and Failed", () => {
	const passedVal = Validation.make.passed(42);
	expectTypeOf(passedVal).toEqualTypeOf<Validation.Passed<number>>();
	expectTypeOf(passedVal.value).toEqualTypeOf<number>();

	const failedVal = Validation.make.failed("failed");
	expectTypeOf(failedVal).toEqualTypeOf<Validation.Failed<string>>();
	expectTypeOf(failedVal.errors).toEqualTypeOf<NonEmptyArr<string>>();

	const failedAllVal = Validation.make.failedAll(["err1", "err2"]);
	expectTypeOf(failedAllVal).toEqualTypeOf<Validation.Failed<string>>();
	expectTypeOf(failedAllVal.errors).toEqualTypeOf<NonEmptyArr<string>>();
});

test("is guards: narrows Validation to Passed and Failed variant subtypes", () => {
	const naturalUnion: Validation<string, number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("err");

	if (Validation.is.passed(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<Validation.Passed<number>>();
		expectTypeOf(naturalUnion.value).toEqualTypeOf<number>();
	} else {
		expectTypeOf(naturalUnion).toEqualTypeOf<Validation.Failed<string>>();
		expectTypeOf(naturalUnion.errors).toEqualTypeOf<NonEmptyArr<string>>();
	}

	if (Validation.is.failed(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<Validation.Failed<string>>();
		expectTypeOf(naturalUnion.errors).toEqualTypeOf<NonEmptyArr<string>>();
	} else {
		expectTypeOf(naturalUnion).toEqualTypeOf<Validation.Passed<number>>();
		expectTypeOf(naturalUnion.value).toEqualTypeOf<number>();
	}
});

test("tryCatch: wraps fallible synchronous thunk into Validation with typed error", () => {
	const result = Validation.tryCatch(() => 42, {
		onError: (err: unknown) => (err instanceof Error ? err.message : String(err)),
	});
	expectTypeOf(result).toEqualTypeOf<Validation<string, number>>();
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

	// Custom combineErrors
	const customCombine = pipe(
		valF,
		Validation.apply(valA, {
			combineErrors: (
				e1: NonEmptyArr<"ERR_A">,
				e2: NonEmptyArr<"ERR_B">,
			): NonEmptyArr<string> => [`${e1.join(",")}-${e2.join(",")}`],
		}),
	);
	expectTypeOf(customCombine).toEqualTypeOf<Validation<string, string>>();
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

test("getOrElse: extracts value or widens return type with fallback thunk", () => {
	const naturalUnion: Validation<string, number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("err");

	const valSameType = pipe(naturalUnion, Validation.getOrElse(() => 0));
	expectTypeOf(valSameType).toEqualTypeOf<number>();

	const valWider = pipe(naturalUnion, Validation.getOrElse((): null => null));
	expectTypeOf(valWider).toEqualTypeOf<number | null>();
});

test("tap & tapError: preserve exact channel types through side effects", () => {
	const naturalUnion: Validation<"ERR", number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("ERR");

	const tapped = pipe(naturalUnion, Validation.tap((_n) => {}));
	expectTypeOf(tapped).toEqualTypeOf<Validation<"ERR", number>>();

	const tappedErr = pipe(naturalUnion, Validation.tapError((_errs) => {}));
	expectTypeOf(tappedErr).toEqualTypeOf<Validation<"ERR", number>>();
});

test("recover & recoverUnless: preserves or widens recovery error and value types", () => {
	const initial: Validation<"INIT_ERR", number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("INIT_ERR");

	// Fallible recovery
	const recovered = pipe(
		initial,
		Validation.recover((_errors) =>
			constTruthyBool() ? Validation.make.passed("fallback") : Validation.make.failed("RECOVER_ERR" as const)
		),
	);
	expectTypeOf(recovered).toEqualTypeOf<Validation<"RECOVER_ERR", number | string>>();

	// Infallible recovery (does not collapse E2 to unknown)
	const recoveredInfallible = pipe(initial, Validation.recover((_errors) => Validation.make.passed("fallback")));
	expectTypeOf(recoveredInfallible).toEqualTypeOf<Validation<never, number | string>>();

	// recoverUnless
	const recoveredUnless = pipe(
		initial,
		Validation.recoverUnless((e) => e === "INIT_ERR", () => Validation.make.passed("fallback")),
	);
	expectTypeOf(recoveredUnless).toEqualTypeOf<Validation<"INIT_ERR", number | string>>();
});

test("from converters: converts nullable, Predicate, Maybe, and Result to Validation", () => {
	// from.Predicate
	const isString = (val: unknown): val is string => typeof val === "string";
	const lifted = Validation.from.Predicate(isString, () => "not a string" as const);
	expectTypeOf(lifted("hello")).toEqualTypeOf<Validation<"not a string", string>>();

	// from.nullable
	const nullableVal: string | null = "abc";
	const resNullable = Validation.from.nullable(() => "is_null" as const)(nullableVal);
	expectTypeOf(resNullable).toEqualTypeOf<Validation<"is_null", string>>();

	const nullLiteral = null;
	const resNull = Validation.from.nullable(() => "is_null" as const)(nullLiteral);
	expectTypeOf(resNull).toEqualTypeOf<Validation<"is_null", never>>();

	const undefLiteral = undefined;
	const resUndef = Validation.from.nullable(() => "is_null" as const)(undefLiteral);
	expectTypeOf(resUndef).toEqualTypeOf<Validation<"is_null", never>>();

	// from.Maybe
	const maybeVal: Maybe<number> = constTruthyBool() ? Maybe.make.some(42) : Maybe.make.none();
	const resFromMaybe = Validation.from.Maybe(() => "missing" as const)(maybeVal);
	expectTypeOf(resFromMaybe).toEqualTypeOf<Validation<"missing", number>>();

	// from.Result
	const resultVal: Result<string, number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("err");
	const resFromResult = Validation.from.Result(resultVal);
	expectTypeOf(resFromResult).toEqualTypeOf<Validation<string, number>>();
});

test("to converters: converts Validation to Result and Maybe", () => {
	const naturalUnion: Validation<string, number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("err");

	// to.Result uncurried
	const toResultDirect = Validation.to.Result(naturalUnion);
	expectTypeOf(toResultDirect).toEqualTypeOf<Result<NonEmptyArr<string>, number>>();

	// to.Result curried
	const toResultCurried = pipe(naturalUnion, Validation.to.Result((errors) => errors.join("; ")));
	expectTypeOf(toResultCurried).toEqualTypeOf<Result<string, number>>();

	// to.Maybe
	const toMaybe = Validation.to.Maybe(naturalUnion);
	expectTypeOf(toMaybe).toEqualTypeOf<Maybe<number>>();
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

	const hasFailed = Validation.keyed.is.failed(res);
	expectTypeOf(hasFailed).toEqualTypeOf<boolean>();

	const errors = Validation.keyed.getErrors(res);
	expectTypeOf(errors).toEqualTypeOf<Maybe<Validation.KeyedErrors<{ name: string; age: number; }, unknown>>>();

	const passedFields = Validation.keyed.getPassed(res);
	expectTypeOf(passedFields).toEqualTypeOf<Maybe<{ name: string; age: number; }>>();

	const validateUserTyped = Validation.keyed.make<{ name: string; age: number; }, string>({
		name: (s) => (s.length > 0 ? Validation.make.passed(s) : Validation.make.failed("Name required")),
		age: (n) => (n >= 18 ? Validation.make.passed(n) : Validation.make.failed("Must be 18+")),
	});
	const resTyped = validateUserTyped({ name: "Bob", age: 25 });
	const typedErrors = Validation.keyed.getErrors(resTyped);
	expectTypeOf(typedErrors).toEqualTypeOf<Maybe<Validation.KeyedErrors<{ name: string; age: number; }, string>>>();
});

test("negative: flags missing match handlers, invalid transforms, and variant incompatibilities", () => {
	const naturalUnion: Validation<string, number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("err");

	// @ts-expect-error Missing 'failed' handler in match cases
	expectTypeOf(Validation.match({ passed: (n: number) => n })).toBeFunction();

	// @ts-expect-error Missing 'passed' handler in match cases
	expectTypeOf(Validation.match({ failed: (errors: NonEmptyArr<string>) => errors.length })).toBeFunction();

	// @ts-expect-error Map transform must be a function
	expectTypeOf(Validation.map(123)(naturalUnion)).toBeObject();

	// @ts-expect-error Validation.make.passed requires an argument
	expectTypeOf(Validation.make.passed()).toBeObject();

	// @ts-expect-error Validation.make.failed requires an argument
	expectTypeOf(Validation.make.failed()).toBeObject();

	// @ts-expect-error Validation.tryCatch requires options.onError
	expectTypeOf(Validation.tryCatch(() => 42)).toBeObject();

	// @ts-expect-error Struct field values must be Validation instances
	expectTypeOf(Validation.struct({ a: 123 })).toBeObject();

	// @ts-expect-error Validation.Passed does not expose an 'errors' property
	expectTypeOf(Validation.make.passed(42).errors).toBeUndefined();

	// @ts-expect-error Validation.Failed does not expose a 'value' property
	expectTypeOf(Validation.make.failed("err").value).toBeUndefined();

	// @ts-expect-error Passed cannot be assigned to Failed
	const _passedAsFailed: Validation.Failed<string> = Validation.make.passed(42);

	// @ts-expect-error Failed cannot be assigned to Passed
	const _failedAsPassed: Validation.Passed<number> = Validation.make.failed("err");
});
