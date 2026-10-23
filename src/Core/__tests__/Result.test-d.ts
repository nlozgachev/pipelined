import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Result } from "../Result.ts";

test("make: infers precise variant types for Ok and Err", () => {
	const okVal = Result.make.ok(42);
	expectTypeOf(okVal).toEqualTypeOf<Result.Ok<number>>();

	const errVal = Result.make.err("failed");
	expectTypeOf(errVal).toEqualTypeOf<Result.Err<string>>();
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

test("apply: widens error types across independent evaluations", () => {
	const fnResult: Result<"ERR_FN", (n: number) => string> = constTruthyBool()
		? Result.make.ok((n: number) => String(n))
		: Result.make.err("ERR_FN");
	const argResult: Result<"ERR_ARG", number> = constTruthyBool() ? Result.make.ok(123) : Result.make.err("ERR_ARG");
	const result = pipe(fnResult, Result.apply(argResult));
	expectTypeOf(result).toEqualTypeOf<Result<"ERR_FN" | "ERR_ARG", string>>();
});

test("recover: preserves or widens recovery error and value types", () => {
	const initial: Result<"INIT_ERR", number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("INIT_ERR");
	const recovered = pipe(
		initial,
		Result.recover((_e) => (constTruthyBool() ? Result.make.ok("fallback") : Result.make.err("RECOVER_ERR" as const))),
	);
	expectTypeOf(recovered).toEqualTypeOf<Result<"RECOVER_ERR", number | string>>();
});

test("tap & tapError: preserve exact channel types through side effects", () => {
	const naturalUnion: Result<"ERR", number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("ERR");

	const tapped = pipe(naturalUnion, Result.tap((_n) => {}));
	expectTypeOf(tapped).toEqualTypeOf<Result<"ERR", number>>();

	const tappedErr = pipe(naturalUnion, Result.tapError((_e) => {}));
	expectTypeOf(tappedErr).toEqualTypeOf<Result<"ERR", number>>();
});

test("from.Predicate & ensure: narrows type with type guard refinement", () => {
	const isString = (val: unknown): val is string => typeof val === "string";
	const lifted = Result.from.Predicate(isString, () => "not a string" as const);
	expectTypeOf(lifted("hello")).toEqualTypeOf<Result<"not a string", string>>();

	const naturalUnion: Result<"ERR_INIT", unknown> = constTruthyBool()
		? Result.make.ok("hello")
		: Result.make.err("ERR_INIT");
	const ensured = pipe(naturalUnion, Result.ensure(isString, () => "NOT_STRING" as const));
	expectTypeOf(ensured).toEqualTypeOf<Result<"ERR_INIT" | "NOT_STRING", string>>();
});

test("struct: preserves heterogeneous error unions and object shapes", () => {
	const resA: Result<"ERR_A", number> = constTruthyBool() ? Result.make.ok(1) : Result.make.err("ERR_A");
	const resB: Result<"ERR_B", string> = constTruthyBool() ? Result.make.ok("foo") : Result.make.err("ERR_B");

	const structured = Result.struct({ a: resA, b: resB });
	expectTypeOf(structured).toEqualTypeOf<Result<"ERR_A" | "ERR_B", { a: number; b: string; }>>();
});

test("bind & bindTo: accumulates pipeline object record correctly", () => {
	const resA: Result<"ERR_A", number> = constTruthyBool() ? Result.make.ok(1) : Result.make.err("ERR_A");

	const bound = pipe(
		resA,
		Result.bindTo("a"),
		Result.bind("b", ({ a }) => (a > 0 ? Result.make.ok(a.toString()) : Result.make.err("ERR_B" as const))),
	);
	expectTypeOf(bound).toEqualTypeOf<Result<"ERR_A" | "ERR_B", { a: number; } & { b: string; }>>();
	expectTypeOf(bound).toMatchTypeOf<Result<"ERR_A" | "ERR_B", { a: number; b: string; }>>();
});

test("negative: flags missing match handlers and invalid transforms", () => {
	const naturalUnion: Result<string, number> = constTruthyBool() ? Result.make.ok(42) : Result.make.err("err");

	// @ts-expect-error Missing 'err' handler in match cases
	expectTypeOf(Result.match({ ok: (n: number) => n })).toBeFunction();

	// @ts-expect-error Map transform must be a function
	expectTypeOf(Result.map(123)(naturalUnion)).toBeObject();

	// @ts-expect-error Chain transform must return a Result, not a bare primitive
	expectTypeOf(Result.chain((n: number) => n * 2)(naturalUnion)).toBeObject();

	// @ts-expect-error Result.make.ok requires an argument
	expectTypeOf(Result.make.ok()).toBeObject();

	// @ts-expect-error Struct field values must be Result instances
	expectTypeOf(Result.struct({ a: 123 })).toBeObject();
});
