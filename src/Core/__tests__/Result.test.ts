import { constTruthyBool } from "#test-utils";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Validation } from "../Validation.ts";

// ---------------------------------------------------------------------------
// of / ok
// ---------------------------------------------------------------------------

test("make.ok: wraps a value in Ok", () => {
	const result = Result.make.ok(42);
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("make.ok: creates an Ok with the given value", () => {
	expect(Result.make.ok("hello")).toStrictEqual({ kind: "Ok", value: "hello" });
});

test("make.ok: produces consistent result across invocations", () => {
	expect(Result.make.ok(10)).toStrictEqual(Result.make.ok(10));
});

// ---------------------------------------------------------------------------
// err
// ---------------------------------------------------------------------------

test("make.err: creates an Err with the given error", () => {
	expect(Result.make.err("something went wrong")).toStrictEqual({ kind: "Err", error: "something went wrong" });
});

test("make.err: works with complex error types", () => {
	const err = Result.make.err({ code: 404, message: "Not Found" });
	expect(err).toStrictEqual({ kind: "Err", error: { code: 404, message: "Not Found" } });
});

// ---------------------------------------------------------------------------
// isOk / isErr
// ---------------------------------------------------------------------------

test("is.ok: returns true for Ok", () => {
	expect(Result.is.ok(Result.make.ok(1))).toBe(true);
});

test("is.ok: returns false for Err", () => {
	expect(Result.is.ok(Result.make.err("e"))).toBe(false);
});

test("is.err: returns true for Err", () => {
	expect(Result.is.err(Result.make.err("e"))).toBe(true);
});

test("is.err: returns false for Ok", () => {
	expect(Result.is.err(Result.make.ok(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("tryCatch: returns Ok when function succeeds", () => {
	const result = Result.tryCatch(() => JSON.parse('{"a":1}'), { onError: (e) => `Parse error: ${e}` });
	expect(result).toStrictEqual({ kind: "Ok", value: { a: 1 } });
});

test("tryCatch: returns Err when function throws", () => {
	const result = Result.tryCatch(() => JSON.parse("invalid json!!!"), { onError: () => "Parse error" });
	expect(result).toStrictEqual({ kind: "Err", error: "Parse error" });
});

test("tryCatch: passes the thrown error to onError", () => {
	const result = Result.tryCatch(() => {
		throw new Error("boom");
	}, { onError: (e) => (e instanceof Error ? e.message : String(e)) });
	expect(result).toStrictEqual({ kind: "Err", error: "boom" });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: transforms Ok value", () => {
	const result = pipe(Result.make.ok(5), Result.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Ok", value: 10 });
});

test("map: passes through Err unchanged", () => {
	const result = pipe(Result.make.err("error"), Result.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

test("map: does not invoke transform on Err", () => {
	let called = false;
	const result = pipe(
		Result.make.err("error"),
		Result.map(() => {
			called = true;
			return 0;
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

test("map: can change the value type", () => {
	const result = pipe(Result.make.ok(42), Result.map((n: number) => `num: ${n}`));
	expect(result).toStrictEqual({ kind: "Ok", value: "num: 42" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("mapError: transforms Err value", () => {
	const result = pipe(Result.make.err("oops"), Result.mapError((e: string) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Err", error: "OOPS" });
});

test("mapError: passes through Ok unchanged", () => {
	const result = pipe(Result.make.ok(5), Result.mapError((e: string) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("mapError: does not invoke transform on Ok", () => {
	let called = false;
	const result = pipe(
		Result.make.ok(5),
		Result.mapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("chain: applies function when Ok", () => {
	const validatePositive = (n: number) => n > 0 ? Result.make.ok(n) : Result.make.err("Must be positive");

	const result = pipe(Result.make.ok(5), Result.chain(validatePositive));
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("chain: returns Err when function returns Err", () => {
	const validatePositive = (n: number) => n > 0 ? Result.make.ok(n) : Result.make.err("Must be positive");

	const result = pipe(Result.make.ok(-1), Result.chain(validatePositive));
	expect(result).toStrictEqual({ kind: "Err", error: "Must be positive" });
});

test("chain: propagates Err without calling function", () => {
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

test("chain: supports error union widening", () => {
	const step1: Result<"ERR_A", number> = Result.make.ok(42);
	const step2 = (_n: number): Result<"ERR_B", string> => Result.make.err("ERR_B");

	const res: Result<"ERR_A" | "ERR_B", string> = pipe(step1, Result.chain(step2));
	expect(res).toStrictEqual({ kind: "Err", error: "ERR_B" });
});

test("chain: infers exact error union without collapsing to unknown", () => {
	const step1 = Result.make.err("ERR_A" as const);
	const step2 = (_: unknown) => Result.make.err("ERR_B" as const);

	const res = pipe(step1, Result.chain(step2));

	expect(res).toStrictEqual({ kind: "Err", error: "ERR_A" });
});

test("ensure: infers exact error union without collapsing to unknown", () => {
	const step1 = constTruthyBool() ? Result.make.ok(15) : Result.make.err("ERR_A" as const);
	const res = pipe(step1, Result.ensure((n) => n >= 18, (n) => `Underage: ${n}` as const));

	expect(res).toStrictEqual(Result.make.err("Underage: 15"));
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("match: calls ok handler for Ok", () => {
	const result = pipe(
		Result.make.ok(5),
		Result.match({ ok: (n: number) => `got ${n}`, err: (e: string) => `failed: ${e}` }),
	);
	expect(result).toBe("got 5");
});

test("match: calls err handler for Err", () => {
	const result = pipe(
		Result.make.err("bad"),
		Result.match({ ok: (n: number) => `got ${n}`, err: (e: string) => `failed: ${e}` }),
	);
	expect(result).toBe("failed: bad");
});

test("match: is data-last (returns a function first)", () => {
	const handler = Result.match({ ok: (n) => `val: ${n}`, err: (e) => `err: ${e}` });
	expect(handler(Result.make.ok(3))).toBe("val: 3");
	expect(handler(Result.make.err("x"))).toBe("err: x");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("getOrElse: returns value for Ok", () => {
	const result = pipe(Result.make.ok(5), Result.getOrElse(() => 0));
	expect(result).toBe(5);
});

test("getOrElse: does not invoke fallback on Ok", () => {
	let called = false;
	const result = pipe(
		Result.make.ok(5),
		Result.getOrElse(() => {
			called = true;
			return 0;
		}),
	);
	expect(called).toBe(false);
	expect(result).toBe(5);
});

test("getOrElse: returns default for Err", () => {
	const result = pipe(Result.make.err("error"), Result.getOrElse(() => 0));
	expect(result).toBe(0);
});

test("getOrElse: widens return type to A | B when default is a different type", () => {
	const result = pipe(Result.make.err("error"), Result.getOrElse(() => null));
	expect(result).toBeNull();
});

test("getOrElse: returns Ok value typed as A | B when Ok", () => {
	const result = pipe(Result.make.ok(5), Result.getOrElse(() => null));
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("tap: executes side effect on Ok and returns original", () => {
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

test("tap: does not execute side effect on Err", () => {
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

test("recover: returns original Ok without calling fallback", () => {
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

test("recover: provides fallback for Err", () => {
	const result = pipe(Result.make.err("error"), Result.recover((_e) => Result.make.ok(99)));
	expect(result).toStrictEqual({ kind: "Ok", value: 99 });
});

test("recover: widens to Result<E, A | B> when fallback returns a different type", () => {
	const result = pipe(Result.make.err("error"), Result.recover((_e) => Result.make.ok("recovered")));
	expect(result).toStrictEqual({ kind: "Ok", value: "recovered" });
});

test("recover: preserves Ok typed as Result<E, A | B>", () => {
	const result = pipe(Result.make.ok(5), Result.recover((_e) => Result.make.ok("recovered")));
	expect(result).toStrictEqual({ kind: "Ok", value: 5 });
});

test("recover: passes the error to the fallback", () => {
	const result = pipe(Result.make.err("original error"), Result.recover((e) => Result.make.ok(`handled: ${e}`)));
	expect(result).toStrictEqual({ kind: "Ok", value: "handled: original error" });
});

// ---------------------------------------------------------------------------
// recoverUnless
// ---------------------------------------------------------------------------

test("recoverUnless: recovers when predicate returns false", () => {
	const result = pipe(
		Result.make.err("recoverable"),
		Result.recoverUnless((e) => e === "fatal", () => Result.make.ok(42)),
	);
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("recoverUnless: does not recover when predicate returns true", () => {
	const result = pipe(Result.make.err("fatal"), Result.recoverUnless((e) => e === "fatal", () => Result.make.ok(42)));
	expect(result).toStrictEqual({ kind: "Err", error: "fatal" });
});

test("recoverUnless: passes through Ok unchanged", () => {
	const result = pipe(Result.make.ok(10), Result.recoverUnless((e) => e === "fatal", () => Result.make.ok(42)));
	expect(result).toStrictEqual({ kind: "Ok", value: 10 });
});

test("recoverUnless: widens to Result<E, A | B> when fallback returns a different type", () => {
	const result = pipe(
		Result.make.err("recoverable"),
		Result.recoverUnless((e) => e === "fatal", () => Result.make.ok("recovered")),
	);
	expect(result).toStrictEqual({ kind: "Ok", value: "recovered" });
});

test("recoverUnless: works with object errors", () => {
	const err = new Error("recoverable");
	const result = pipe(Result.make.err(err), Result.recoverUnless((e) => e.message === "fatal", () => Result.make.ok(0)));
	expect(result).toStrictEqual({ kind: "Ok", value: 0 });
});

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

test("apply: applies Ok function to Ok value", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(Result.make.ok(add), Result.apply(Result.make.ok(5)), Result.apply(Result.make.ok(3)));
	expect(result).toStrictEqual({ kind: "Ok", value: 8 });
});

test("apply: returns Err when function is Err", () => {
	const result = pipe(Result.make.err("fn error"), Result.apply(Result.make.ok(5)));
	expect(result).toStrictEqual({ kind: "Err", error: "fn error" });
});

test("apply: returns Err when value is Err", () => {
	const result = pipe(Result.make.ok<(n: number) => number>((n) => n * 2), Result.apply(Result.make.err("val error")));
	expect(result).toStrictEqual({ kind: "Err", error: "val error" });
});

test("apply: returns first Err when both are Err", () => {
	const result = pipe(Result.make.err("fn error"), Result.apply(Result.make.err("val error")));
	expect(result).toStrictEqual({ kind: "Err", error: "fn error" });
});

test("apply: widens error types from function and argument", () => {
	const fnResult = constTruthyBool() ? Result.make.ok((n: number) => String(n)) : Result.make.err("ERR_FN" as const);
	const argResult = constTruthyBool() ? Result.make.ok(123) : Result.make.err("ERR_ARG" as const);
	const result = pipe(fnResult, Result.apply(argResult));
	expect(result).toStrictEqual(Result.make.ok("123"));
});

test("recover: widens error types when fallback can fail with different error", () => {
	const initial = constTruthyBool() ? Result.make.ok(42) : Result.make.err("INIT_ERR" as const);
	const result = pipe(initial, Result.recover((_e): Result<"FALLBACK_ERR", number> => Result.make.err("FALLBACK_ERR")));
	expect(result).toStrictEqual(Result.make.ok(42));
});

test("assignTo: returns Err when given Err", () => {
	const result = pipe(Result.make.err("err"), Result.assignTo("key"));
	expect(result).toStrictEqual(Result.make.err("err"));
});

// ---------------------------------------------------------------------------
// toMaybe
// ---------------------------------------------------------------------------

test("to.Maybe: converts Ok to Some", () => {
	const result = Result.to.Maybe(Result.make.ok(42));
	expect(result).toStrictEqual({ kind: "Some", value: 42 });
});

test("to.Maybe: converts Err to None", () => {
	const result = Result.to.Maybe(Result.make.err("oops"));
	expect(result).toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes well in pipeline", () => {
	const divide = (a: number, b: number) => b === 0 ? Result.make.err("Division by zero") : Result.make.ok(a / b);

	const result = pipe(
		divide(10, 2),
		Result.map((n: number) => n * 3),
		Result.chain((n: number) => n > 10 ? Result.make.ok(n) : (Result.make.err("Too small"))),
		Result.getOrElse(() => 0),
	);
	expect(result).toBe(15);
});

test("pipe: short-circuits on Err", () => {
	const divide = (a: number, b: number) => b === 0 ? Result.make.err("Division by zero") : Result.make.ok(a / b);

	const result = pipe(divide(10, 0), Result.map((n: number) => n * 3), Result.getOrElse(() => -1));
	expect(result).toBe(-1);
});

// ---------------------------------------------------------------------------
// tapError
// ---------------------------------------------------------------------------

test("tapError: calls side effect with error value on Err", () => {
	let captured: string | undefined;
	pipe(
		Result.make.err("oops"),
		Result.tapError((e) => {
			captured = e;
		}),
	);
	expect(captured).toBe("oops");
});

test("tapError: does not call side effect on Ok", () => {
	let called = false;
	pipe(
		Result.make.ok(1),
		Result.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("tapError: returns original Err unchanged", () => {
	const r = Result.make.err("oops");
	expect(pipe(r, Result.tapError(() => {}))).toStrictEqual(r);
});

test("tapError: returns original Ok unchanged", () => {
	const r = Result.make.ok(42);
	expect(pipe(r, Result.tapError(() => {}))).toStrictEqual(r);
});

// ---------------------------------------------------------------------------
// from.Predicate
// ---------------------------------------------------------------------------

test("from.Predicate: returns Ok when predicate passes", () => {
	expect(pipe(5, Result.from.Predicate((n) => n > 0, (n) => `${n} is not positive`))).toStrictEqual(Result.make.ok(5));
});

test("from.Predicate: returns Err when predicate fails", () => {
	expect(pipe(-1, Result.from.Predicate((n) => n > 0, (n) => `${n} is not positive`))).toStrictEqual(
		Result.make.err("-1 is not positive"),
	);
});

test("from.Predicate: returns Err for boundary value", () => {
	expect(pipe(0, Result.from.Predicate((n) => n > 0, () => "must be positive"))).toStrictEqual(
		Result.make.err("must be positive"),
	);
});

test("from.Predicate: works with string predicates", () => {
	const nonEmpty = Result.from.Predicate((s: string) => s.length > 0, () => "empty string");
	expect(pipe("hi", nonEmpty)).toStrictEqual(Result.make.ok("hi"));
	expect(pipe("", nonEmpty)).toStrictEqual(Result.make.err("empty string"));
});

test("from.Predicate: composes in pipe with chain", () => {
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

test("map: type-safe return type on mapped function output", () => {
	const r = constTruthyBool() ? Result.make.ok(42) : Result.make.err("oops");
	const double = Result.map((n: number) => String(n));
	const mapped = double(r);
	expect(mapped).toStrictEqual(Result.make.ok("42"));

	const pure = Result.make.ok(42);
	const pureMapped = double(pure);
	expect(pureMapped).toStrictEqual(Result.make.ok("42"));
});

test("mapError: type-safe return type on mapped error output", () => {
	const r = constTruthyBool() ? Result.make.ok(42) : Result.make.err("oops");
	const formatErr = Result.mapError((e: string) => e.length);
	const mapped = formatErr(r);
	expect(mapped).toStrictEqual(Result.make.ok(42));

	const pureErr = Result.make.err("oops");
	const pureMapped = formatErr(pureErr);
	expect(pureMapped).toStrictEqual(Result.make.err(4));
});

test("tap: type-safe return type on tap partial application", () => {
	let sideEffectCalled = false;
	const r = constTruthyBool() ? Result.make.ok(42) : Result.make.err("oops");
	const logVal = Result.tap((_n: number) => {
		sideEffectCalled = true;
	});
	const res = logVal(r);
	expect(sideEffectCalled).toBe(true);
	expect(res).toStrictEqual(Result.make.ok(42));

	const pure = Result.make.ok(42);
	const resPure = logVal(pure);
	expect(resPure).toStrictEqual(pure);
});

test("tapError: type-safe return type on tapError partial application", () => {
	let sideEffectCalled = false;
	const r = constTruthyBool() ? Result.make.ok(42) : Result.make.err("oops");
	const logErr = Result.tapError((_e: string) => {
		sideEffectCalled = true;
	});
	const res = logErr(r);
	expect(sideEffectCalled).toBe(false);
	expect(res).toStrictEqual(Result.make.ok(42));

	const pureErr = Result.make.err("oops");
	const resPureErr = logErr(pureErr);
	expect(sideEffectCalled).toBe(true);
	expect(resPureErr).toStrictEqual(pureErr);
});

test("from.Predicate: narrows type when passed a type guard refinement", () => {
	const isString = (val: unknown): val is string => typeof val === "string";
	const lifted = Result.from.Predicate(isString, () => "not a string");

	const resOk = lifted("hello");
	expect(resOk).toStrictEqual(Result.make.ok("hello"));

	const resErr = lifted(123);
	expect(resErr).toStrictEqual(Result.make.err("not a string"));
});

test("ensure: narrows type when passed a type guard refinement", () => {
	const isString = (val: unknown): val is string => typeof val === "string";
	const rawInput: unknown = "hello";
	const input = constTruthyBool() ? Result.make.ok(rawInput) : Result.make.err("ERR_INIT" as const);
	const narrowed = pipe(input, Result.ensure(isString, () => "NOT_A_STRING" as const));

	expect(narrowed).toStrictEqual(Result.make.ok("hello"));
});

test("getOrElse: type-safe widening to union", () => {
	const r = constTruthyBool() ? Result.make.ok(42) : Result.make.err("e");
	const fn = Result.getOrElse<null>((): null => null);
	const result = fn(r);
	expect(result).toBe(42);
});

// --- from.nullable ---

test("from.nullable: returns Ok for non-null values", () => {
	const result = Result.from.nullable(() => "is null")(42);
	expect(result).toStrictEqual(Result.make.ok(42));
});

test("from.nullable: returns Err for null", () => {
	const result = Result.from.nullable(() => "is null")(null);
	expect(result).toStrictEqual(Result.make.err("is null"));
});

test("from.nullable: returns Err for undefined", () => {
	const result = Result.from.nullable(() => "is null")(undefined);
	expect(result).toStrictEqual(Result.make.err("is null"));
});

test("from.nullable: preserves falsy values without conflating with null/undefined", () => {
	expect(Result.from.nullable(() => "err")(0)).toStrictEqual(Result.make.ok(0));
	expect(Result.from.nullable(() => "err")(false)).toStrictEqual(Result.make.ok(false));
	expect(Result.from.nullable(() => "err")("")).toStrictEqual(Result.make.ok(""));
	const nanRes = Result.from.nullable(() => "err")(Number.NaN);
	expect(Result.is.ok(nanRes)).toBe(true);
	expect(Number.isNaN(Result.getOrElse(() => 0)(nanRes))).toBe(true);
});

// --- fromMaybe ---

test("from.Maybe: returns Ok for Some", () => {
	const result = Result.from.Maybe(() => "is none")(Maybe.make.some(42));
	expect(result).toStrictEqual(Result.make.ok(42));
});

test("from.Maybe: returns Err for None", () => {
	const result = Result.from.Maybe(() => "is none")(Maybe.make.none());
	expect(result).toStrictEqual(Result.make.err("is none"));
});

// --- assignTo ---

test("assignTo: wraps a value in an accumulator object", () => {
	const result = pipe(Result.make.ok(2), Result.assignTo("a"));
	expect(result).toStrictEqual(Result.make.ok({ a: 2 }));
});

// --- assign ---

test("assign: accumulates values key-by-key in a pipeline", () => {
	const result = pipe(
		Result.make.ok(2),
		Result.assignTo("a"),
		Result.assign("b", ({ a }) => Result.make.ok(a * 3)),
		Result.assign("c", ({ a, b }) => Result.make.ok(a + b)),
	);
	expect(result).toStrictEqual(Result.make.ok({ a: 2, b: 6, c: 8 }));
});

test("assign: short-circuits on Err", () => {
	let called = false;
	const result = pipe(
		Result.make.ok(2),
		Result.assignTo("a"),
		Result.assign("b", () => Result.make.err("fail")),
		Result.assign("c", ({ b }) => {
			called = true;
			return Result.make.ok(b);
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual(Result.make.err("fail"));
});

// --- struct ---

test("struct: combines a record of Ok values into a single Ok record", () => {
	const res = Result.struct({ a: Result.make.ok(1), b: Result.make.ok("hello") });
	expect(res).toStrictEqual(Result.make.ok({ a: 1, b: "hello" }));
});

test("struct: short-circuits on the first Err encountered", () => {
	const res = Result.struct({
		a: Result.make.ok(1),
		b: Result.make.err("first fail"),
		c: Result.make.err("second fail"),
	});
	expect(res).toStrictEqual(Result.make.err("first fail"));
});

test("struct: composes in a pipe pipeline", () => {
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

test("struct: ignores inherited prototype properties", () => {
	const proto = { b: Result.make.ok(2) };
	const fields = Object.create(proto);
	fields.a = Result.make.ok(1);
	const res = Result.struct(fields);
	expect(res).toStrictEqual(Result.make.ok({ a: 1 }));
});

test("struct: returns ok({}) when given an empty object", () => {
	const res = Result.struct({});
	expect(res).toStrictEqual(Result.make.ok({}));
});

// --- sequence.Maybe ---

test("sequence.Maybe: swaps Ok(Some) to Some(Ok)", () => {
	const res = Result.sequence.Maybe(Result.make.ok(Maybe.make.some(42)));
	expect(res).toStrictEqual(Maybe.make.some(Result.make.ok(42)));
});

test("sequence.Maybe: swaps Ok(None) to None", () => {
	const res = Result.sequence.Maybe(Result.make.ok(Maybe.make.none()));
	expect(res).toStrictEqual(Maybe.make.none());
});

test("sequence.Maybe: swaps Err(e) to Some(Err(e))", () => {
	const res = Result.sequence.Maybe(Result.make.err("error"));
	expect(res).toStrictEqual(Maybe.make.some(Result.make.err("error")));
});

// --- Validation conversions ---

test("from.Validation: converts Passed to Ok", () => {
	const res = Result.from.Validation((errs: readonly string[]) => errs.join(", "))(Validation.make.passed(42));
	expect(res).toStrictEqual(Result.make.ok(42));
});

test("from.Validation: converts Failed to Err using combineErrors", () => {
	const res = Result.from.Validation((errs: readonly string[]) => errs.join("; "))(
		Validation.make.failedAll(["err1", "err2"]),
	);
	expect(res).toStrictEqual(Result.make.err("err1; err2"));
});

test("to.Validation: converts Ok to Passed", () => {
	const res = Result.to.Validation(Result.make.ok(42));
	expect(res).toStrictEqual(Validation.make.passed(42));
});

test("to.Validation: converts Err to Failed with array error", () => {
	const res = Result.to.Validation(Result.make.err("oops"));
	expect(res).toStrictEqual(Validation.make.failed("oops"));
});

// --- ensure ---

test("ensure: preserves Ok when predicate passes", () => {
	const res = pipe(Result.make.ok(42), Result.ensure((n) => n > 0, (n) => `Must be positive: ${n}`));
	expect(res).toStrictEqual(Result.make.ok(42));
});

test("ensure: converts Ok to Err when predicate fails", () => {
	const res = pipe(Result.make.ok(-5), Result.ensure((n) => n > 0, (n) => `Must be positive: ${n}`));
	expect(res).toStrictEqual(Result.make.err("Must be positive: -5"));
});

test("ensure: passes through Err unchanged", () => {
	const res = pipe(
		Result.make.err("initial_error"),
		Result.ensure((n: number) => n > 0, (n) => `Must be positive: ${n}`),
	);
	expect(res).toStrictEqual(Result.make.err("initial_error"));
});

test("ensure: does not invoke predicate or onFail on Err", () => {
	let predicateCalled = false;
	let onFailCalled = false;
	const res = pipe(
		Result.make.err("initial_error"),
		Result.ensure(() => {
			predicateCalled = true;
			return true;
		}, () => {
			onFailCalled = true;
			return "failed";
		}),
	);
	expect(predicateCalled).toBe(false);
	expect(onFailCalled).toBe(false);
	expect(res).toStrictEqual(Result.make.err("initial_error"));
});

// --- bimap ---

test("bimap: applies onOk to Ok values", () => {
	const res = pipe(Result.make.ok(5), Result.bimap((e) => `Err: ${e}`, (n) => n * 2));
	expect(res).toStrictEqual(Result.make.ok(10));
});

test("bimap: applies onErr to Err values", () => {
	const res = pipe(Result.make.err("oops"), Result.bimap((e) => `Err: ${e}`, (n: number) => n * 2));
	expect(res).toStrictEqual(Result.make.err("Err: oops"));
});

test("bimap: does not invoke onErr on Ok", () => {
	let onErrCalled = false;
	const res = pipe(
		Result.make.ok(5),
		Result.bimap(() => {
			onErrCalled = true;
			return "err";
		}, (n) => n * 2),
	);
	expect(onErrCalled).toBe(false);
	expect(res).toStrictEqual(Result.make.ok(10));
});

test("bimap: does not invoke onOk on Err", () => {
	let onOkCalled = false;
	const res = pipe(
		Result.make.err("error"),
		Result.bimap((e) => `mapped: ${e}`, () => {
			onOkCalled = true;
			return 0;
		}),
	);
	expect(onOkCalled).toBe(false);
	expect(res).toStrictEqual(Result.make.err("mapped: error"));
});

// --- prototype pollution shielding ---

test("assign: safely handles __proto__ property without prototype pollution", () => {
	const res = pipe(Result.make.ok({ a: 1 }), Result.assign("__proto__", () => Result.make.ok({ polluted: true })));
	expect(Result.is.ok(res)).toBe(true);
	const emptyFallback: Record<string, unknown> = {};
	const value = Result.getOrElse(() => emptyFallback)(res);
	expect(Object.hasOwn(value, "__proto__")).toBe(true);
	const target: Record<string, unknown> = {};
	expect(target.polluted).toBeUndefined();
});

test("struct: safely handles __proto__ property without prototype pollution", () => {
	const protoFields: Record<string, Result<string, unknown>> = {};
	Object.defineProperty(protoFields, "__proto__", {
		value: Result.make.ok({ polluted: true }),
		enumerable: true,
		configurable: true,
		writable: true,
	});
	protoFields.a = Result.make.ok(1);

	const res = Result.struct(protoFields);
	expect(Result.is.ok(res)).toBe(true);
	const emptyFallback: Record<string, unknown> = {};
	const value = Result.getOrElse(() => emptyFallback)(res);
	expect(Object.hasOwn(value, "__proto__")).toBe(true);
	const target: Record<string, unknown> = {};
	expect(target.polluted).toBeUndefined();
});
