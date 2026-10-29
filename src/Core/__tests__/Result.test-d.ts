import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Validation } from "../Validation.ts";

test("make: infers precise variant types for Ok and Err", () => {
	const okVal = Result.make.ok(42);
	expectTypeOf(okVal).toEqualTypeOf<Result.Ok<number>>();
	expectTypeOf(okVal.value).toEqualTypeOf<number>();

	const errVal = Result.make.err("failed");
	expectTypeOf(errVal).toEqualTypeOf<Result.Err<string>>();
	expectTypeOf(errVal.error).toEqualTypeOf<string>();
});

test("is guards: narrows Result to Ok and Err variant subtypes", () => {
	const naturalUnion: Result<string, number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("err");

	if (Result.is.ok(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<Result.Ok<number>>();
		expectTypeOf(naturalUnion.value).toEqualTypeOf<number>();
	} else {
		expectTypeOf(naturalUnion).toEqualTypeOf<Result.Err<string>>();
		expectTypeOf(naturalUnion.error).toEqualTypeOf<string>();
	}

	if (Result.is.err(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<Result.Err<string>>();
	} else {
		expectTypeOf(naturalUnion).toEqualTypeOf<Result.Ok<number>>();
	}
});

test("tryCatch: wraps fallible synchronous thunk into Result with typed error", () => {
	const result = Result.tryCatch(() => 42, {
		onError: (err: unknown) => (err instanceof Error ? err.message : String(err)),
	});
	expectTypeOf(result).toEqualTypeOf<Result<string, number>>();
});

test("map / mapError: preserves natural union and propagates channels", () => {
	const naturalUnion: Result<string, number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("err");

	const mapped = pipe(naturalUnion, Result.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Result<string, string>>();

	const mappedErr = pipe(naturalUnion, Result.mapError((err) => err.length));
	expectTypeOf(mappedErr).toEqualTypeOf<Result<number, number>>();
});

test("chain: unifies error channels across pipelines", () => {
	const naturalUnion: Result<"ERR_A", number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("ERR_A");

	const chained = pipe(
		naturalUnion,
		Result.chain((n) => (n > 0 ? Result.make.ok(n.toString()) : Result.make.err("ERR_B" as const))),
	);
	expectTypeOf(chained).toEqualTypeOf<Result<"ERR_A" | "ERR_B", string>>();
});

test("match: produces unified return type from exhaustive handlers", () => {
	const naturalUnion: Result<string, number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("err");

	const outcome = pipe(naturalUnion, Result.match({ ok: (val) => val > 0, err: (err) => err.length > 0 }));
	expectTypeOf(outcome).toEqualTypeOf<boolean>();
});

test("getOrElse: extracts value or widens return type with fallback thunk", () => {
	const naturalUnion: Result<string, number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("err");

	const valSameType = pipe(naturalUnion, Result.getOrElse(() => 0));
	expectTypeOf(valSameType).toEqualTypeOf<number>();

	const valWider = pipe(naturalUnion, Result.getOrElse((): null => null));
	expectTypeOf(valWider).toEqualTypeOf<number | null>();
});

test("apply: widens error types across independent evaluations", () => {
	const fnResult: Result<"ERR_FN", (n: number) => string> = constTruthyBool()
		? Result.make.ok((n: number) => String(n))
		: Result.make.err("ERR_FN");
	const argResult: Result<"ERR_ARG", number> = constTruthyBool() ? Result.make.ok(123) : Result.make.err("ERR_ARG");
	const result = pipe(fnResult, Result.apply(argResult));
	expectTypeOf(result).toEqualTypeOf<Result<"ERR_FN" | "ERR_ARG", string>>();
});

test("recover & recoverUnless: preserves or widens recovery error and value types", () => {
	const initial: Result<"INIT_ERR", number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("INIT_ERR");

	const recovered = pipe(
		initial,
		Result.recover((_e) => (constTruthyBool() ? Result.make.ok("fallback") : Result.make.err("RECOVER_ERR" as const))),
	);
	expectTypeOf(recovered).toEqualTypeOf<Result<"RECOVER_ERR", number | string>>();

	const infallibleRecovered = pipe(initial, Result.recover((_e) => Result.make.ok("fallback")));
	expectTypeOf(infallibleRecovered).toEqualTypeOf<Result<never, number | string>>();

	const recoveredUnless = pipe(initial, Result.recoverUnless((e) => e === "INIT_ERR", () => Result.make.ok("fallback")));
	expectTypeOf(recoveredUnless).toEqualTypeOf<Result<"INIT_ERR", number | string>>();
});

test("bimap: simultaneously transforms error and value channels", () => {
	const initial: Result<string, number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("fail");

	const bimapped = pipe(initial, Result.bimap((err) => err.length, (val) => val > 0));
	expectTypeOf(bimapped).toEqualTypeOf<Result<number, boolean>>();
});

test("tap & tapError: preserve exact channel types through side effects", () => {
	const naturalUnion: Result<"ERR", number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("ERR");

	const tapped = pipe(naturalUnion, Result.tap((_n) => {}));
	expectTypeOf(tapped).toEqualTypeOf<Result<"ERR", number>>();

	const tappedErr = pipe(naturalUnion, Result.tapError((_e) => {}));
	expectTypeOf(tappedErr).toEqualTypeOf<Result<"ERR", number>>();
});

test("from converters: converts nullable, Predicate, Maybe, and Validation to Result", () => {
	const isString = (val: unknown): val is string => typeof val === "string";
	const lifted = Result.from.Predicate(isString, () => "not a string" as const);
	expectTypeOf(lifted("hello")).toEqualTypeOf<Result<"not a string", string>>();

	const naturalUnion: Result<"ERR_INIT", unknown> = constTruthyBool()
		? Result.make.ok("hello")
		: Result.make.err("ERR_INIT");
	const ensured = pipe(naturalUnion, Result.ensure(isString, () => "NOT_STRING" as const));
	expectTypeOf(ensured).toEqualTypeOf<Result<"ERR_INIT" | "NOT_STRING", string>>();

	// from.nullable
	const nullableVal: string | null = "abc";
	const resNullable = Result.from.nullable(() => "is_null" as const)(nullableVal);
	expectTypeOf(resNullable).toEqualTypeOf<Result<"is_null", string>>();

	const nullLiteral = null;
	const resNull = Result.from.nullable(() => "is_null" as const)(nullLiteral);
	expectTypeOf(resNull).toEqualTypeOf<Result<"is_null", never>>();

	// from.Maybe
	const maybeVal: Maybe<number> = constTruthyBool() ? Maybe.make.some(42) : Maybe.make.none();
	const resFromMaybe = Result.from.Maybe(() => "missing" as const)(maybeVal);
	expectTypeOf(resFromMaybe).toEqualTypeOf<Result<"missing", number>>();

	// from.Validation
	const validationVal: Validation<string, number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("fail");
	const resFromValidation = Result.from.Validation((errors) => errors.join("; "))(validationVal);
	expectTypeOf(resFromValidation).toEqualTypeOf<Result<string, number>>();
});

test("to converters & sequence: converts Result to Maybe/Validation and swaps contexts", () => {
	const res: Result<string, number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("err");

	const toMaybe = Result.to.Maybe(res);
	expectTypeOf(toMaybe).toEqualTypeOf<Maybe<number>>();

	const toValidation = Result.to.Validation(res);
	expectTypeOf(toValidation).toEqualTypeOf<Validation<string, number>>();

	// sequence.Maybe
	const resMaybe: Result<string, Maybe<number>> = constTruthyBool()
		? Result.make.ok(Maybe.make.some(42))
		: Result.make.err("err");
	const sequenced = Result.sequence.Maybe(resMaybe);
	expectTypeOf(sequenced).toEqualTypeOf<Maybe<Result<string, number>>>();
});

test("struct: preserves heterogeneous error unions and object shapes", () => {
	const resA: Result<"ERR_A", number> = constTruthyBool() ? Result.make.ok(1) : Result.make.err("ERR_A");
	const resB: Result<"ERR_B", string> = constTruthyBool() ? Result.make.ok("foo") : Result.make.err("ERR_B");

	const structured = Result.struct({ a: resA, b: resB });
	expectTypeOf(structured).toEqualTypeOf<Result<"ERR_A" | "ERR_B", { a: number; b: string; }>>();
});

test("assign & assignTo: accumulates pipeline object record correctly", () => {
	const resA: Result<"ERR_A", number> = constTruthyBool() ? Result.make.ok(1) : Result.make.err("ERR_A");

	const bound = pipe(
		resA,
		Result.assignTo("a"),
		Result.assign("b", ({ a }) => (a > 0 ? Result.make.ok(a.toString()) : Result.make.err("ERR_B" as const))),
	);
	expectTypeOf(bound).toEqualTypeOf<Result<"ERR_A" | "ERR_B", { a: number; } & { b: string; }>>();
	expectTypeOf(bound).toMatchTypeOf<Result<"ERR_A" | "ERR_B", { a: number; b: string; }>>();
});

test("negative: flags missing match handlers, invalid transforms, and variant incompatibilities", () => {
	const naturalUnion: Result<string, number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("err");

	// @ts-expect-error Missing 'err' handler in match cases
	expectTypeOf(Result.match({ ok: (n: number) => n })).toBeFunction();

	// @ts-expect-error Missing 'ok' handler in match cases
	expectTypeOf(Result.match({ err: (s: string) => s })).toBeFunction();

	// @ts-expect-error Map transform must be a function
	expectTypeOf(Result.map(123)(naturalUnion)).toBeObject();

	// @ts-expect-error Chain transform must return a Result, not a bare primitive
	expectTypeOf(Result.chain((n: number) => n * 2)(naturalUnion)).toBeObject();

	// @ts-expect-error Result.make.ok requires an argument
	expectTypeOf(Result.make.ok()).toBeObject();

	// @ts-expect-error Result.make.err requires an argument
	expectTypeOf(Result.make.err()).toBeObject();

	// @ts-expect-error Struct field values must be Result instances
	expectTypeOf(Result.struct({ a: 123 })).toBeObject();

	// @ts-expect-error Result.tryCatch requires options.onError
	expectTypeOf(Result.tryCatch(() => 42)).toBeObject();

	// @ts-expect-error Result.Ok does not expose an 'error' property
	expectTypeOf(Result.make.ok(42).error).toBeUndefined();

	// @ts-expect-error Result.Err does not expose a 'value' property
	expectTypeOf(Result.make.err("err").value).toBeUndefined();

	// @ts-expect-error Ok cannot be assigned to Err
	const _okAsErr: Result.Err<string> = Result.make.ok(42);

	// @ts-expect-error Err cannot be assigned to Ok
	const _errAsOk: Result.Ok<number> = Result.make.err("err");
});
