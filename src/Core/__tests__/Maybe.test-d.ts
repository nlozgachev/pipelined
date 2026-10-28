import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Validation } from "../Validation.ts";

test("make: infers precise variant types for Some and None", () => {
	const someVal = Maybe.make.some(42);
	expectTypeOf(someVal).toEqualTypeOf<Maybe.Some<number>>();
	expectTypeOf(someVal.value).toEqualTypeOf<number>();

	const noneVal = Maybe.make.none();
	expectTypeOf(noneVal).toEqualTypeOf<Maybe.None>();
});

test("is guards: narrows Maybe to Some and None variant subtypes", () => {
	const naturalUnion: Maybe<number> = constTruthyBool() ? Maybe.make.some(42) : Maybe.make.none();

	if (Maybe.is.some(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<Maybe.Some<number>>();
		expectTypeOf(naturalUnion.value).toEqualTypeOf<number>();
	} else {
		expectTypeOf(naturalUnion).toEqualTypeOf<Maybe.None>();
	}

	if (Maybe.is.none(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<Maybe.None>();
	} else {
		expectTypeOf(naturalUnion).toEqualTypeOf<Maybe.Some<number>>();
	}
});

test("tryCatch: wraps fallible synchronous thunk into Maybe", () => {
	const result = Maybe.tryCatch(() => 42);
	expectTypeOf(result).toEqualTypeOf<Maybe<number>>();
});

test("map: preserves natural union and propagates value channel", () => {
	const naturalUnion: Maybe<number> = constTruthyBool() ? Maybe.make.some(42) : Maybe.make.none();

	const mapped = pipe(naturalUnion, Maybe.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Maybe<string>>();
});

test("chain: flattens nested optional contexts", () => {
	const naturalUnion: Maybe<number> = constTruthyBool() ? Maybe.make.some(42) : Maybe.make.none();

	const chained = pipe(naturalUnion, Maybe.chain((n) => (n > 0 ? Maybe.make.some(n.toString()) : Maybe.make.none())));
	expectTypeOf(chained).toEqualTypeOf<Maybe<string>>();
});

test("match: produces unified return type from exhaustive handlers", () => {
	const naturalUnion: Maybe<number> = constTruthyBool() ? Maybe.make.some(42) : Maybe.make.none();

	const outcome = pipe(naturalUnion, Maybe.match({ some: (val) => val > 0, none: () => false }));
	expectTypeOf(outcome).toEqualTypeOf<boolean>();
});

test("getOrElse: widens return type to union with fallback", () => {
	const naturalUnion: Maybe<string> = constTruthyBool() ? Maybe.make.some("hello") : Maybe.make.none();

	const valSameType = pipe(naturalUnion, Maybe.getOrElse(() => "fallback"));
	expectTypeOf(valSameType).toEqualTypeOf<string>();

	const valWider = pipe(naturalUnion, Maybe.getOrElse((): null => null));
	expectTypeOf(valWider).toEqualTypeOf<string | null>();
});

test("tap & tapNone: executes side effects without modifying inner value", () => {
	const naturalUnion: Maybe<number> = constTruthyBool() ? Maybe.make.some(42) : Maybe.make.none();

	const tapped = pipe(naturalUnion, Maybe.tap((_n) => {}));
	expectTypeOf(tapped).toEqualTypeOf<Maybe<number>>();

	const tappedNone = pipe(naturalUnion, Maybe.tapNone(() => {}));
	expectTypeOf(tappedNone).toEqualTypeOf<Maybe<number>>();
});

test("from.Predicate & filter: narrows type with type guard refinement", () => {
	const isString = (val: unknown): val is string => typeof val === "string";
	const lifted = Maybe.from.Predicate(isString);
	expectTypeOf(lifted("hello")).toEqualTypeOf<Maybe<string>>();

	const naturalUnion: Maybe<unknown> = constTruthyBool() ? Maybe.make.some("hello") : Maybe.make.none();
	const filtered = pipe(naturalUnion, Maybe.filter(isString));
	expectTypeOf(filtered).toEqualTypeOf<Maybe<string>>();
});

test("from converters: converts nullable, Result, and Validation to Maybe", () => {
	// from.nullable
	const nullableVal: string | null = "abc";
	const resNullable = Maybe.from.nullable(nullableVal);
	expectTypeOf(resNullable).toEqualTypeOf<Maybe<string>>();

	const undefVal: string | undefined = "abc";
	const resUndef = Maybe.from.nullable(undefVal);
	expectTypeOf(resUndef).toEqualTypeOf<Maybe<string>>();

	const nullVal = null;
	const resNull = Maybe.from.nullable(nullVal);
	expectTypeOf(resNull).toEqualTypeOf<Maybe<never>>();

	// from.Result
	const okVal: Result<string, number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("err");
	const resFromResult = Maybe.from.Result(okVal);
	expectTypeOf(resFromResult).toEqualTypeOf<Maybe<number>>();

	// from.Validation
	const validationVal: Validation<string, number> = constTruthyBool()
		? Validation.make.passed(42)
		: Validation.make.failed("err");
	const resFromValidation = Maybe.from.Validation(validationVal);
	expectTypeOf(resFromValidation).toEqualTypeOf<Maybe<number>>();
});

test("to converters & sequence: converts Maybe to primitives/Result/Validation and swaps contexts", () => {
	const naturalUnion: Maybe<number> = constTruthyBool() ? Maybe.make.some(42) : Maybe.make.none();

	const toNullable = Maybe.to.nullable(naturalUnion);
	expectTypeOf(toNullable).toEqualTypeOf<number | null>();

	const toUndef = Maybe.to.undefined(naturalUnion);
	expectTypeOf(toUndef).toEqualTypeOf<number | undefined>();

	const toResult = pipe(naturalUnion, Maybe.to.Result(() => "missing" as const));
	expectTypeOf(toResult).toEqualTypeOf<Result<"missing", number>>();

	const toValidation = pipe(naturalUnion, Maybe.to.Validation(() => "missing" as const));
	expectTypeOf(toValidation).toEqualTypeOf<Validation<"missing", number>>();

	// sequence.Result
	const maybeResult: Maybe<Result<string, number>> = constTruthyBool()
		? Maybe.make.some(Result.make.ok(42))
		: Maybe.make.none();
	const sequenced = Maybe.sequence.Result(maybeResult);
	expectTypeOf(sequenced).toEqualTypeOf<Result<string, Maybe<number>>>();
});

test("apply: evaluates applicative computation inside Maybe", () => {
	const fnMaybe: Maybe<(n: number) => string> = constTruthyBool()
		? Maybe.make.some((n: number) => String(n))
		: Maybe.make.none();
	const argMaybe: Maybe<number> = constTruthyBool() ? Maybe.make.some(42) : Maybe.make.none();

	const applied = pipe(fnMaybe, Maybe.apply(argMaybe));
	expectTypeOf(applied).toEqualTypeOf<Maybe<string>>();
});

test("recover: provides fallback Maybe on None", () => {
	const naturalUnion: Maybe<number> = constTruthyBool() ? Maybe.make.some(42) : Maybe.make.none();

	const recoveredSame = pipe(naturalUnion, Maybe.recover(() => Maybe.make.some(0)));
	expectTypeOf(recoveredSame).toEqualTypeOf<Maybe<number>>();

	const recoveredWider = pipe(naturalUnion, Maybe.recover(() => Maybe.make.some("fallback")));
	expectTypeOf(recoveredWider).toEqualTypeOf<Maybe<number | string>>();
});

test("struct: combines homogeneous and heterogeneous Maybes into single object record", () => {
	const optA = constTruthyBool() ? Maybe.make.some(1) : Maybe.make.none();
	const optB = constTruthyBool() ? Maybe.make.some("foo") : Maybe.make.none();

	const structured = Maybe.struct({ a: optA, b: optB });
	expectTypeOf(structured).toEqualTypeOf<Maybe<{ a: number; b: string; }>>();
});

test("assign & assignTo: accumulates pipeline object record correctly", () => {
	const optA = constTruthyBool() ? Maybe.make.some(1) : Maybe.make.none();

	const bound = pipe(
		optA,
		Maybe.assignTo("a"),
		Maybe.assign("b", ({ a }) => (a > 0 ? Maybe.make.some(a.toString()) : Maybe.make.none())),
	);
	expectTypeOf(bound).toEqualTypeOf<Maybe<{ a: number; } & { b: string; }>>();
	expectTypeOf(bound).toMatchTypeOf<Maybe<{ a: number; b: string; }>>();
});

test("negative: flags missing match handlers, invalid transforms, and variant incompatibilities", () => {
	const naturalUnion: Maybe<number> = constTruthyBool() ? Maybe.make.some(42) : Maybe.make.none();

	// @ts-expect-error Missing 'none' handler in match cases
	expectTypeOf(Maybe.match({ some: (n: number) => n })).toBeFunction();

	// @ts-expect-error Missing 'some' handler in match cases
	expectTypeOf(Maybe.match({ none: () => false })).toBeFunction();

	// @ts-expect-error Map transform must be a function
	expectTypeOf(Maybe.map(123)(naturalUnion)).toBeObject();

	// @ts-expect-error Chain transform must return a Maybe
	expectTypeOf(Maybe.chain((n: number) => n * 2)(naturalUnion)).toBeObject();

	// @ts-expect-error Maybe.make.some requires an argument
	expectTypeOf(Maybe.make.some()).toBeObject();

	// @ts-expect-error Struct field values must be Maybe instances
	expectTypeOf(Maybe.struct({ a: 123 })).toBeObject();

	// @ts-expect-error Maybe.None does not expose a 'value' property
	expectTypeOf(Maybe.make.none().value).toBeUndefined();

	// @ts-expect-error Some cannot be assigned to None
	const _someAsNone: Maybe.None = Maybe.make.some(42);

	// @ts-expect-error None cannot be assigned to Some
	const _noneAsSome: Maybe.Some<number> = Maybe.make.none();
});
