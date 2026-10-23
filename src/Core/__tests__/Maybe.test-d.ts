import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";

test("make: infers precise variant types for Some and None", () => {
	const someVal = Maybe.make.some(42);
	expectTypeOf(someVal).toEqualTypeOf<Maybe.Some<number>>();

	const noneVal = Maybe.make.none();
	expectTypeOf(noneVal).toEqualTypeOf<Maybe.None>();
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
	const val = pipe(naturalUnion, Maybe.getOrElse((): null => null));
	expectTypeOf(val).toEqualTypeOf<string | null>();
});

test("from.Predicate & filter: narrows type with type guard refinement", () => {
	const isString = (val: unknown): val is string => typeof val === "string";
	const lifted = Maybe.from.Predicate(isString);
	expectTypeOf(lifted("hello")).toEqualTypeOf<Maybe<string>>();

	const naturalUnion: Maybe<unknown> = constTruthyBool() ? Maybe.make.some("hello") : Maybe.make.none();
	const filtered = pipe(naturalUnion, Maybe.filter(isString));
	expectTypeOf(filtered).toEqualTypeOf<Maybe<string>>();
});

test("struct: combines homogeneous and heterogeneous Maybes into single object record", () => {
	const optA = constTruthyBool() ? Maybe.make.some(1) : Maybe.make.none();
	const optB = constTruthyBool() ? Maybe.make.some("foo") : Maybe.make.none();

	const structured = Maybe.struct({ a: optA, b: optB });
	expectTypeOf(structured).toEqualTypeOf<Maybe<{ a: number; b: string; }>>();
});

test("bind & bindTo: accumulates pipeline object record correctly", () => {
	const optA = constTruthyBool() ? Maybe.make.some(1) : Maybe.make.none();

	const bound = pipe(
		optA,
		Maybe.bindTo("a"),
		Maybe.bind("b", ({ a }) => (a > 0 ? Maybe.make.some(a.toString()) : Maybe.make.none())),
	);
	expectTypeOf(bound).toEqualTypeOf<Maybe<{ a: number; } & { b: string; }>>();
	expectTypeOf(bound).toMatchTypeOf<Maybe<{ a: number; b: string; }>>();
});

test("negative: flags missing match handlers, invalid transforms, and non-Maybe struct fields", () => {
	const naturalUnion: Maybe<number> = constTruthyBool() ? Maybe.make.some(42) : Maybe.make.none();

	// @ts-expect-error Missing 'none' handler in match cases
	expectTypeOf(Maybe.match({ some: (n: number) => n })).toBeFunction();

	// @ts-expect-error Map transform must be a function
	expectTypeOf(Maybe.map(123)(naturalUnion)).toBeObject();

	// @ts-expect-error Chain transform must return a Maybe
	expectTypeOf(Maybe.chain((n: number) => n * 2)(naturalUnion)).toBeObject();

	// @ts-expect-error Maybe.make.some requires an argument
	expectTypeOf(Maybe.make.some()).toBeObject();

	// @ts-expect-error Struct field values must be Maybe instances
	expectTypeOf(Maybe.struct({ a: 123 })).toBeObject();
});
