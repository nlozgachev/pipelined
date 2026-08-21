import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Validation } from "../Validation.ts";

// ---------------------------------------------------------------------------
// of / ok
// ---------------------------------------------------------------------------

test("Result.make.ok wraps a value in Ok", () => {
	const result = Result.make.ok(42);
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("Result.make.ok creates an Ok with the given value", () => {
	expect(Result.make.ok("hello")).toStrictEqual({ kind: "Ok", value: "hello" });
});

test("result.ok and Result.make.ok produce equivalent results", () => {
	expect(Result.make.ok(10)).toStrictEqual(Result.make.ok(10));
});

// ---------------------------------------------------------------------------
// err
// ---------------------------------------------------------------------------

test("Result.make.err creates an Err with the given error", () => {
	expect(Result.make.err("something went wrong")).toStrictEqual({ kind: "Err", error: "something went wrong" });
});

test("Result.make.err works with complex error types", () => {
	const err = Result.make.err({ code: 404, message: "Not Found" });
	expect(err).toStrictEqual({ kind: "Err", error: { code: 404, message: "Not Found" } });
});

// ---------------------------------------------------------------------------
// isOk / isErr
// ---------------------------------------------------------------------------

test("Result.is.ok returns true for Ok", () => {
	expect(Result.is.ok(Result.make.ok(1))).toBe(true);
});

test("Result.is.ok returns false for Err", () => {
	expect(Result.is.ok(Result.make.err("e"))).toBe(false);
});

test("Result.is.err returns true for Err", () => {
	expect(Result.is.err(Result.make.err("e"))).toBe(true);
});

test("Result.is.err returns false for Ok", () => {
	expect(Result.is.err(Result.make.ok(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("Result.tryCatch returns Ok when function succeeds", () => {
	const result = Result.tryCatch(() => JSON.parse('{"a":1}'), { onError: (e) => `Parse error: ${e}` });
	expect(result).toStrictEqual({ kind: "Ok", value: { a: 1 } });
});

test("Result.tryCatch returns Err when function throws", () => {
	const result = Result.tryCatch(() => JSON.parse("invalid json!!!"), { onError: () => "Parse error" });
	expect(result).toStrictEqual({ kind: "Err", error: "Parse error" });
});

test("Result.tryCatch passes the thrown error to onError", () => {
	const result = Result.tryCatch(() => {
		throw new Error("boom");
	}, { onError: (e) => (e as Error).message });
	expect(result).toStrictEqual({ kind: "Err", error: "boom" });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Result.map transforms Ok value", () => {
	const result = pipe(Result.make.ok(5), Result.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Ok", value: 10 });
});

test("Result.map passes through Err unchanged", () => {
	const result = pipe(Result.make.err("error"), Result.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

test("Result.map can change the value type", () => {
	const result = pipe(Result.make.ok(42), Result.map((n: number) => `num: ${n}`));
	expect(result).toStrictEqual({ kind: "Ok", value: "num: 42" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("Result.mapError transforms Err value", () => {
	const result = pipe(Result.make.err("oops"), Result.mapError((e: string) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Err", error: "OOPS" });
});

test("Result.mapError passes through Ok unchanged", () => {
	const result = pipe(Result.make.ok(5), Result.mapError((e: string) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Result.chain applies function when Ok", () => {
	const validatePositive = (n: number) => n > 0 ? Result.make.ok(n) : Result.make.err("Must be positive");

	const result = pipe(Result.make.ok(5), Result.chain(validatePositive));
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("Result.chain returns Err when function returns Err", () => {
	const validatePositive = (n: number) => n > 0 ? Result.make.ok(n) : Result.make.err("Must be positive");

	const result = pipe(Result.make.ok(-1), Result.chain(validatePositive));
	expect(result).toStrictEqual({ kind: "Err", error: "Must be positive" });
});

test("Result.chain propagates Err without calling function", () => {
	let called = false;
	pipe(
		Result.make.err("error"),
		Result.chain((_n: number) => {
			called = true;
			return Result.make.ok(_n);
		}),
	);
	expect(called).toBe(false);
});

test("Result.chain supports error union widening", () => {
	const step1: Result<"ERR_A", number> = Result.make.ok(42);
	const step2 = (_n: number): Result<"ERR_B", string> => Result.make.err("ERR_B");

	const res: Result<"ERR_A" | "ERR_B", string> = pipe(step1, Result.chain(step2));
	expect(res).toStrictEqual({ kind: "Err", error: "ERR_B" });
});

test("Result.chain infers exact error union without collapsing to unknown", () => {
	const step1 = Result.make.err("ERR_A" as const);
	const step2 = (_: unknown) => Result.make.err("ERR_B" as const);

	const res = pipe(step1, Result.chain(step2));

	expectTypeOf(res).toEqualTypeOf<Result<"ERR_A" | "ERR_B", unknown>>();
	expect(res).toStrictEqual({ kind: "Err", error: "ERR_A" });
});

test("Result.ensure infers exact error union without collapsing to unknown", () => {
	const step1 = Result.make.ok(15) as Result<"ERR_A", number>;
	const res = pipe(step1, Result.ensure((n) => n >= 18, (n) => `Underage: ${n}` as const));

	expectTypeOf(res).toEqualTypeOf<Result<"ERR_A" | `Underage: ${number}`, number>>();
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Result.fold calls onOk for Ok", () => {
	const result = pipe(Result.make.ok(5), Result.fold((e: string) => `Error: ${e}`, (n: number) => `Value: ${n}`));
	expect(result).toBe("Value: 5");
});

test("Result.fold calls onErr for Err", () => {
	const result = pipe(Result.make.err("bad"), Result.fold((e: string) => `Error: ${e}`, (n: number) => `Value: ${n}`));
	expect(result).toBe("Error: bad");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("Result.match calls ok handler for Ok", () => {
	const result = pipe(
		Result.make.ok(5),
		Result.match({ ok: (n: number) => `got ${n}`, err: (e: string) => `failed: ${e}` }),
	);
	expect(result).toBe("got 5");
});

test("Result.match calls err handler for Err", () => {
	const result = pipe(
		Result.make.err("bad"),
		Result.match({ ok: (n: number) => `got ${n}`, err: (e: string) => `failed: ${e}` }),
	);
	expect(result).toBe("failed: bad");
});

test("Result.match is data-last (returns a function first)", () => {
	const handler = Result.match({ ok: (n) => `val: ${n}`, err: (e) => `err: ${e}` });
	expect(handler(Result.make.ok(3))).toBe("val: 3");
	expect(handler(Result.make.err("x"))).toBe("err: x");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Result.getOrElse returns value for Ok", () => {
	const result = pipe(Result.make.ok(5), Result.getOrElse(() => 0));
	expect(result).toBe(5);
});

test("Result.getOrElse returns default for Err", () => {
	const result = pipe(Result.make.err("error"), Result.getOrElse(() => 0));
	expect(result).toBe(0);
});

test("Result.getOrElse widens return type to A | B when default is a different type", () => {
	const result = pipe(Result.make.err("error"), Result.getOrElse(() => null));
	expect(result).toBeNull();
});

test("Result.getOrElse returns Ok value typed as A | B when Ok", () => {
	const result = pipe(Result.make.ok(5), Result.getOrElse(() => null));
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("Result.tap executes side effect on Ok and returns original", () => {
	let sideEffect = 0;
	const result = pipe(
		Result.make.ok(5),
		Result.tap((n: number) => {
			sideEffect = n;
		}),
	);
	expect(sideEffect).toBe(5);
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("Result.tap does not execute side effect on Err", () => {
	let called = false;
	const result = pipe(
		Result.make.err("error"),
		Result.tap((_n: number) => {
			called = true;
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("Result.recover returns original Ok without calling fallback", () => {
	let called = false;
	const result = pipe(
		Result.make.ok(5),
		Result.recover((_e) => {
			called = true;
			return Result.make.ok(99);
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("Result.recover provides fallback for Err", () => {
	const result = pipe(Result.make.err("error"), Result.recover((_e) => Result.make.ok(99)));
	expect(result).toStrictEqual({ kind: "Ok", value: 99 });
});

test("Result.recover widens to Result<E, A | B> when fallback returns a different type", () => {
	const result = pipe(Result.make.err("error"), Result.recover((_e) => Result.make.ok("recovered")));
	expect(result).toStrictEqual({ kind: "Ok", value: "recovered" });
});

test("Result.recover preserves Ok typed as Result<E, A | B>", () => {
	const result = pipe(Result.make.ok(5), Result.recover((_e) => Result.make.ok("recovered")));
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("Result.recover passes the error to the fallback", () => {
	const result = pipe(Result.make.err("original error"), Result.recover((e) => Result.make.ok(`handled: ${e}`)));
	expect(result).toStrictEqual({ kind: "Ok", value: "handled: original error" });
});

// ---------------------------------------------------------------------------
// recoverUnless
// ---------------------------------------------------------------------------

test("result.recoverUnless recovers when predicate returns false", () => {
	const result = pipe(
		Result.make.err("recoverable"),
		Result.recoverUnless((e) => e === "fatal", () => Result.make.ok(42)),
	);
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("result.recoverUnless does NOT recover when predicate returns true", () => {
	const result = pipe(Result.make.err("fatal"), Result.recoverUnless((e) => e === "fatal", () => Result.make.ok(42)));
	expect(result).toStrictEqual({ kind: "Err", error: "fatal" });
});

test("Result.recoverUnless passes through Ok unchanged", () => {
	const result = pipe(Result.make.ok(10), Result.recoverUnless((e) => e === "fatal", () => Result.make.ok(42)));
	expect(result).toStrictEqual({ kind: "Ok", value: 10 });
});

test("result.recoverUnless widens to Result<E, A | B> when fallback returns a different type", () => {
	const result = pipe(
		Result.make.err("recoverable"),
		Result.recoverUnless((e) => e === "fatal", () => Result.make.ok("recovered")),
	);
	expect(result).toStrictEqual({ kind: "Ok", value: "recovered" });
});

test("result.recoverUnless uses predicate — works with object errors", () => {
	const err = new Error("recoverable");
	const result = pipe(Result.make.err(err), Result.recoverUnless((e) => e.message === "fatal", () => Result.make.ok(0)));
	expect(result).toStrictEqual({ kind: "Ok", value: 0 });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("Result.ap applies Ok function to Ok value", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(Result.make.ok(add), Result.ap(Result.make.ok(5)), Result.ap(Result.make.ok(3)));
	expect(result).toStrictEqual({ kind: "Ok", value: 8 });
});

test("Result.ap returns Err when function is Err", () => {
	const result = pipe(Result.make.err("fn error"), Result.ap(Result.make.ok(5)));
	expect(result).toStrictEqual({ kind: "Err", error: "fn error" });
});

test("Result.ap returns Err when value is Err", () => {
	const result = pipe(Result.make.ok<(n: number) => number>((n) => n * 2), Result.ap(Result.make.err("val error")));
	expect(result).toStrictEqual({ kind: "Err", error: "val error" });
});

test("Result.ap returns first Err when both are Err", () => {
	const result = pipe(Result.make.err("fn error"), Result.ap(Result.make.err("val error")));
	expect(result).toStrictEqual({ kind: "Err", error: "fn error" });
});

// ---------------------------------------------------------------------------
// toMaybe
// ---------------------------------------------------------------------------

test("Result.toMaybe converts Ok to Some", () => {
	const result = Result.to.Maybe(Result.make.ok(42));
	expect(result).toStrictEqual({ kind: "Some", value: 42 });
});

test("Result.toMaybe converts Err to None", () => {
	const result = Result.to.Maybe(Result.make.err("oops"));
	expect(result).toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("result composes well in a pipe chain", () => {
	const divide = (a: number, b: number) => b === 0 ? Result.make.err("Division by zero") : Result.make.ok(a / b);

	const result = pipe(
		divide(10, 2),
		Result.map((n: number) => n * 3),
		Result.chain((n: number) => n > 10 ? Result.make.ok(n) : (Result.make.err("Too small"))),
		Result.getOrElse(() => 0),
	);
	expect(result).toBe(15);
});

test("result pipe short-circuits on Err", () => {
	const divide = (a: number, b: number) => b === 0 ? Result.make.err("Division by zero") : Result.make.ok(a / b);

	const result = pipe(divide(10, 0), Result.map((n: number) => n * 3), Result.getOrElse(() => -1));
	expect(result).toBe(-1);
});

// ---------------------------------------------------------------------------
// tapError
// ---------------------------------------------------------------------------

test("Result.tapError calls side effect with error value on Err", () => {
	let captured: string | undefined;
	pipe(
		Result.make.err("oops"),
		Result.tapError((e) => {
			captured = e;
		}),
	);
	expect(captured).toBe("oops");
});

test("Result.tapError does not call side effect on Ok", () => {
	let called = false;
	pipe(
		Result.make.ok(1),
		Result.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("Result.tapError returns original Err unchanged", () => {
	const r = Result.make.err("oops");
	expect(pipe(r, Result.tapError(() => {}))).toStrictEqual(r);
});

test("Result.tapError returns original Ok unchanged", () => {
	const r = Result.make.ok(42);
	expect(pipe(r, Result.tapError(() => {}))).toStrictEqual(r);
});

// ---------------------------------------------------------------------------
// from.Predicate
// ---------------------------------------------------------------------------

test("Result.from.Predicate returns Ok when predicate passes", () => {
	expect(pipe(5, Result.from.Predicate((n) => n > 0, (n) => `${n} is not positive`))).toStrictEqual(Result.make.ok(5));
});

test("Result.from.Predicate returns Err when predicate fails", () => {
	expect(pipe(-1, Result.from.Predicate((n) => n > 0, (n) => `${n} is not positive`))).toStrictEqual(
		Result.make.err("-1 is not positive"),
	);
});

test("Result.from.Predicate returns Err for boundary value", () => {
	expect(pipe(0, Result.from.Predicate((n) => n > 0, () => "must be positive"))).toStrictEqual(
		Result.make.err("must be positive"),
	);
});

test("Result.from.Predicate works with string predicates", () => {
	const nonEmpty = Result.from.Predicate((s: string) => s.length > 0, () => "empty string");
	expect(pipe("hi", nonEmpty)).toStrictEqual(Result.make.ok("hi"));
	expect(pipe("", nonEmpty)).toStrictEqual(Result.make.err("empty string"));
});

test("Result.from.Predicate composes in pipe with chain", () => {
	const result = pipe(
		-5,
		Result.from.Predicate((n: number) => n >= 0, (n) => `${n} is negative`),
		Result.map((n) => n * 2),
	);
	expect(result).toStrictEqual(Result.make.err("-5 is negative"));
});

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

test("Result.map — type-safe return type on mapped function output", () => {
	const r: Result<string, number> = Result.make.ok(42);
	const mapped = Result.map<string, number, string>((n: number) => String(n))(r);
	expect(mapped).toStrictEqual({ kind: "Ok", value: "42" });
});

test("Result.mapError — type-safe return type on mapped error output", () => {
	const r: Result<string, number> = Result.make.err("oops");
	const mapped = Result.mapError<string, number, number>((e: string) => e.length)(r);
	expect(mapped).toStrictEqual({ kind: "Err", error: 4 });
});

test("Result.getOrElse — type-safe widening to A | B", () => {
	const r: Result<string, number> = Result.make.err("e");
	const fn = Result.getOrElse<null>((): null => null);
	const result = fn(r);
	expect(result).toBeNull();
});

test("Result.fold — type-safe return type from both branches", () => {
	const r: Result<string, number> = Result.make.ok(1);
	const result = Result.fold<string, number, string>(
		(e: string): string => `err:${e}`,
		(n: number): string => `ok:${n}`,
	)(r);
	expect(result).toBe("ok:1");
});

// --- from.nullable ---

test("Result.from.nullable returns Ok for non-null values", () => {
	const result = Result.from.nullable(() => "is null")(42);
	expect(result).toStrictEqual(Result.make.ok(42));
});

test("Result.from.nullable returns Err for null", () => {
	const result = Result.from.nullable(() => "is null")(null);
	expect(result).toStrictEqual(Result.make.err("is null"));
});

test("Result.from.nullable returns Err for undefined", () => {
	const result = Result.from.nullable(() => "is null")(undefined);
	expect(result).toStrictEqual(Result.make.err("is null"));
});

// --- fromMaybe ---

test("Result.fromMaybe returns Ok for Some", () => {
	const result = Result.from.Maybe(() => "is none")(Maybe.make.some(42));
	expect(result).toStrictEqual(Result.make.ok(42));
});

test("Result.fromMaybe returns Err for None", () => {
	const result = Result.from.Maybe(() => "is none")(Maybe.make.none());
	expect(result).toStrictEqual(Result.make.err("is none"));
});

// --- fromThrowable ---

test("Result.fromThrowable creates a safe function that returns Ok when it succeeds", () => {
	const parse = Result.from.throwable((s: string) => JSON.parse(s), {
		onError: (e: unknown) => `error: ${(e as Error).message}`,
	});
	expect(parse('{"a":1}')).toStrictEqual(Result.make.ok({ a: 1 }));
});

test("Result.fromThrowable creates a safe function that returns Err when it throws", () => {
	const parse = Result.from.throwable((s: string) => JSON.parse(s), { onError: () => "parse error" });
	expect(parse("invalid")).toStrictEqual(Result.make.err("parse error"));
});

// --- bindTo ---

test("Result.bindTo wraps a value in an accumulator object", () => {
	const result = pipe(Result.make.ok(2), Result.bindTo("a"));
	expect(result).toStrictEqual(Result.make.ok({ a: 2 }));
});

// --- bind ---

test("Result.bind accumulates values key-by-key in a pipeline", () => {
	const result = pipe(
		Result.make.ok(2),
		Result.bindTo("a"),
		Result.bind("b", ({ a }) => Result.make.ok(a * 3)),
		Result.bind("c", ({ a, b }) => Result.make.ok(a + b)),
	);
	expect(result).toStrictEqual(Result.make.ok({ a: 2, b: 6, c: 8 }));
});

test("Result.bind short-circuits on Err", () => {
	let called = false;
	const result = pipe(
		Result.make.ok(2),
		Result.bindTo("a"),
		Result.bind("b", () => Result.make.err("fail")),
		Result.bind("c", ({ b }) => {
			called = true;
			return Result.make.ok(b);
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual(Result.make.err("fail"));
});

// --- struct ---

test("Result.struct combines a record of Ok values into a single Ok record", () => {
	const res = Result.struct({ a: Result.make.ok(1), b: Result.make.ok("hello") });
	expect(res).toStrictEqual(Result.make.ok({ a: 1, b: "hello" }));
});

test("Result.struct short-circuits on the first Err encountered", () => {
	const res = Result.struct({
		a: Result.make.ok(1),
		b: Result.make.err("first fail"),
		c: Result.make.err("second fail"),
	});
	expect(res).toStrictEqual(Result.make.err("first fail"));
});

test("Result.struct composes in a pipe pipeline", () => {
	const res = pipe(
		Result.make.ok({ name: "Alice" }),
		Result.map((u) => u.name),
		Result.chain((name) =>
			Result.struct({
				name: Result.make.ok(name),
				valid: Result.from.Predicate((n: string) => n.length > 0, () => "invalid")(name),
			})
		),
	);
	expect(res).toStrictEqual(Result.make.ok({ name: "Alice", valid: "Alice" }));
});

test("Result.struct ignores inherited prototype properties", () => {
	const proto = { b: Result.make.ok(2) };
	const fields = Object.create(proto);
	fields.a = Result.make.ok(1);
	const res = Result.struct(fields);
	expect(res).toStrictEqual(Result.make.ok({ a: 1 }));
});

test("Result.struct returns ok({}) when given an empty object", () => {
	const res = Result.struct({});
	expect(res).toStrictEqual(Result.make.ok({}));
});

// --- transposeMaybe ---

test("Result.transposeMaybe swaps Ok(Some) to Some(Ok)", () => {
	const res = Result.transposeMaybe(Result.make.ok(Maybe.make.some(42)));
	expect(res).toStrictEqual(Maybe.make.some(Result.make.ok(42)));
});

test("Result.transposeMaybe swaps Ok(None) to None", () => {
	const res = Result.transposeMaybe(Result.make.ok(Maybe.make.none()));
	expect(res).toStrictEqual(Maybe.make.none());
});

test("Result.transposeMaybe swaps Err(e) to Some(Err(e))", () => {
	const res = Result.transposeMaybe(Result.make.err("error"));
	expect(res).toStrictEqual(Maybe.make.some(Result.make.err("error")));
});

// --- Validation conversions ---

test("Result.from.Validation converts Passed to Ok", () => {
	const res = Result.from.Validation((errs: readonly string[]) => errs.join(", "))(Validation.make.passed(42));
	expect(res).toStrictEqual(Result.make.ok(42));
});

test("Result.from.Validation converts Failed to Err using combineErrors", () => {
	const res = Result.from.Validation((errs: readonly string[]) => errs.join("; "))(
		Validation.make.failedAll(["err1", "err2"]),
	);
	expect(res).toStrictEqual(Result.make.err("err1; err2"));
});

test("Result.to.Validation converts Ok to Passed", () => {
	const res = Result.to.Validation(Result.make.ok(42));
	expect(res).toStrictEqual(Validation.make.passed(42));
});

test("Result.to.Validation converts Err to Failed with array error", () => {
	const res = Result.to.Validation(Result.make.err("oops"));
	expect(res).toStrictEqual(Validation.make.failed("oops"));
});

// --- ensure ---

test("Result.ensure preserves Ok when predicate passes", () => {
	const res = pipe(Result.make.ok(42), Result.ensure((n) => n > 0, (n) => `Must be positive: ${n}`));
	expect(res).toStrictEqual(Result.make.ok(42));
});

test("Result.ensure converts Ok to Err when predicate fails", () => {
	const res = pipe(Result.make.ok(-5), Result.ensure((n) => n > 0, (n) => `Must be positive: ${n}`));
	expect(res).toStrictEqual(Result.make.err("Must be positive: -5"));
});

test("Result.ensure passes through Err unchanged", () => {
	const res = pipe(
		Result.make.err("initial_error"),
		Result.ensure((n: number) => n > 0, (n) => `Must be positive: ${n}`),
	);
	expect(res).toStrictEqual(Result.make.err("initial_error"));
});

// --- bimap ---

test("Result.bimap applies onOk to Ok values", () => {
	const res = pipe(Result.make.ok(5), Result.bimap((e) => `Err: ${e}`, (n) => n * 2));
	expect(res).toStrictEqual(Result.make.ok(10));
});

test("Result.bimap applies onErr to Err values", () => {
	const res = pipe(Result.make.err("oops"), Result.bimap((e) => `Err: ${e}`, (n: number) => n * 2));
	expect(res).toStrictEqual(Result.make.err("Err: oops"));
});
