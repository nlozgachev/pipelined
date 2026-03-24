import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Result } from "../Result.ts";

// ---------------------------------------------------------------------------
// of / ok
// ---------------------------------------------------------------------------

test("Result.ok wraps a value in Ok", () => {
	const result = Result.ok(42);
	expect(result).toEqual({ kind: "Ok", value: 42 });
});

test("Result.ok creates an Ok with the given value", () => {
	expect(Result.ok("hello")).toEqual({ kind: "Ok", value: "hello" });
});

test("Result.ok and Result.ok produce equivalent results", () => {
	expect(Result.ok(10)).toEqual(Result.ok(10));
});

// ---------------------------------------------------------------------------
// err
// ---------------------------------------------------------------------------

test("Result.err creates an Err with the given error", () => {
	expect(Result.err("something went wrong")).toEqual({
		kind: "Error",
		error: "something went wrong",
	});
});

test("Result.err works with complex error types", () => {
	const err = Result.err({ code: 404, message: "Not Found" });
	expect(err).toEqual({
		kind: "Error",
		error: { code: 404, message: "Not Found" },
	});
});

// ---------------------------------------------------------------------------
// isOk / isErr
// ---------------------------------------------------------------------------

test("Result.isOk returns true for Ok", () => {
	expect(Result.isOk(Result.ok(1))).toBe(true);
});

test("Result.isOk returns false for Err", () => {
	expect(Result.isOk(Result.err("e"))).toBe(false);
});

test("Result.isErr returns true for Err", () => {
	expect(Result.isErr(Result.err("e"))).toBe(true);
});

test("Result.isErr returns false for Ok", () => {
	expect(Result.isErr(Result.ok(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("Result.tryCatch returns Ok when function succeeds", () => {
	const result = Result.tryCatch(
		() => JSON.parse('{"a":1}'),
		(e) => `Parse error: ${e}`,
	);
	expect(result).toEqual({ kind: "Ok", value: { a: 1 } });
});

test("Result.tryCatch returns Err when function throws", () => {
	const result = Result.tryCatch(
		() => JSON.parse("invalid json!!!"),
		() => "Parse error",
	);
	expect(result).toEqual({ kind: "Error", error: "Parse error" });
});

test("Result.tryCatch passes the thrown error to onError", () => {
	const result = Result.tryCatch(
		() => {
			throw new Error("boom");
		},
		(e) => (e as Error).message,
	);
	expect(result).toEqual({ kind: "Error", error: "boom" });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Result.map transforms Ok value", () => {
	const result = pipe(
		Result.ok(5),
		Result.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "Ok", value: 10 });
});

test("Result.map passes through Err unchanged", () => {
	const result = pipe(
		Result.err("error"),
		Result.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "Error", error: "error" });
});

test("Result.map can change the value type", () => {
	const result = pipe(
		Result.ok(42),
		Result.map((n: number) => `num: ${n}`),
	);
	expect(result).toEqual({ kind: "Ok", value: "num: 42" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("Result.mapError transforms Err value", () => {
	const result = pipe(
		Result.err("oops"),
		Result.mapError((e: string) => e.toUpperCase()),
	);
	expect(result).toEqual({ kind: "Error", error: "OOPS" });
});

test("Result.mapError passes through Ok unchanged", () => {
	const result = pipe(
		Result.ok(5),
		Result.mapError((e: string) => e.toUpperCase()),
	);
	expect(result).toEqual({ kind: "Ok", value: 5 });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Result.chain applies function when Ok", () => {
	const validatePositive = (n: number) => n > 0 ? Result.ok(n) : Result.err("Must be positive");

	const result = pipe(
		Result.ok(5),
		Result.chain(validatePositive),
	);
	expect(result).toEqual({ kind: "Ok", value: 5 });
});

test("Result.chain returns Err when function returns Err", () => {
	const validatePositive = (n: number) => n > 0 ? Result.ok(n) : Result.err("Must be positive");

	const result = pipe(
		Result.ok(-1),
		Result.chain(validatePositive),
	);
	expect(result).toEqual({ kind: "Error", error: "Must be positive" });
});

test("Result.chain propagates Err without calling function", () => {
	let called = false;
	pipe(
		Result.err("error"),
		Result.chain((_n: number) => {
			called = true;
			return Result.ok(_n);
		}),
	);
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Result.fold calls onOk for Ok", () => {
	const result = pipe(
		Result.ok(5),
		Result.fold(
			(e: string) => `Error: ${e}`,
			(n: number) => `Value: ${n}`,
		),
	);
	expect(result).toBe("Value: 5");
});

test("Result.fold calls onErr for Err", () => {
	const result = pipe(
		Result.err("bad"),
		Result.fold(
			(e: string) => `Error: ${e}`,
			(n: number) => `Value: ${n}`,
		),
	);
	expect(result).toBe("Error: bad");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("Result.match calls ok handler for Ok", () => {
	const result = pipe(
		Result.ok(5),
		Result.match({
			ok: (n: number) => `got ${n}`,
			err: (e: string) => `failed: ${e}`,
		}),
	);
	expect(result).toBe("got 5");
});

test("Result.match calls err handler for Err", () => {
	const result = pipe(
		Result.err("bad"),
		Result.match({
			ok: (n: number) => `got ${n}`,
			err: (e: string) => `failed: ${e}`,
		}),
	);
	expect(result).toBe("failed: bad");
});

test("Result.match is data-last (returns a function first)", () => {
	const handler = Result.match({
		ok: (n) => `val: ${n}`,
		err: (e) => `err: ${e}`,
	});
	expect(handler(Result.ok(3))).toBe("val: 3");
	expect(handler(Result.err("x"))).toBe("err: x");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Result.getOrElse returns value for Ok", () => {
	const result = pipe(
		Result.ok(5),
		Result.getOrElse(() => 0),
	);
	expect(result).toBe(5);
});

test("Result.getOrElse returns default for Err", () => {
	const result = pipe(
		Result.err("error"),
		Result.getOrElse(() => 0),
	);
	expect(result).toBe(0);
});

test("Result.getOrElse widens return type to A | B when default is a different type", () => {
	const result = pipe(
		Result.err("error"),
		Result.getOrElse(() => null),
	);
	expect(result).toBeNull();
});

test("Result.getOrElse returns Ok value typed as A | B when Ok", () => {
	const result = pipe(
		Result.ok(5),
		Result.getOrElse(() => null),
	);
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("Result.tap executes side effect on Ok and returns original", () => {
	let sideEffect = 0;
	const result = pipe(
		Result.ok(5),
		Result.tap((n: number) => {
			sideEffect = n;
		}),
	);
	expect(sideEffect).toBe(5);
	expect(result).toEqual({ kind: "Ok", value: 5 });
});

test("Result.tap does not execute side effect on Err", () => {
	let called = false;
	const result = pipe(
		Result.err("error"),
		Result.tap((_n: number) => {
			called = true;
		}),
	);
	expect(called).toBe(false);
	expect(result).toEqual({ kind: "Error", error: "error" });
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("Result.recover returns original Ok without calling fallback", () => {
	let called = false;
	const result = pipe(
		Result.ok(5),
		Result.recover((_e) => {
			called = true;
			return Result.ok(99);
		}),
	);
	expect(called).toBe(false);
	expect(result).toEqual({ kind: "Ok", value: 5 });
});

test("Result.recover provides fallback for Err", () => {
	const result = pipe(
		Result.err("error"),
		Result.recover((_e) => Result.ok(99)),
	);
	expect(result).toEqual({ kind: "Ok", value: 99 });
});

test("Result.recover widens to Result<E, A | B> when fallback returns a different type", () => {
	const result = pipe(
		Result.err("error"),
		Result.recover((_e) => Result.ok("recovered")),
	);
	expect(result).toEqual({ kind: "Ok", value: "recovered" });
});

test("Result.recover preserves Ok typed as Result<E, A | B>", () => {
	const result = pipe(
		Result.ok(5),
		Result.recover((_e) => Result.ok("recovered")),
	);
	expect(result).toEqual({ kind: "Ok", value: 5 });
});

test("Result.recover passes the error to the fallback", () => {
	const result = pipe(
		Result.err("original error"),
		Result.recover((e) => Result.ok(`handled: ${e}`)),
	);
	expect(result).toEqual({ kind: "Ok", value: "handled: original error" });
});

// ---------------------------------------------------------------------------
// recoverUnless
// ---------------------------------------------------------------------------

test(
	"Result.recoverUnless recovers when error does not match blockedErr",
	() => {
		const result = pipe(
			Result.err("recoverable"),
			Result.recoverUnless(
				"fatal",
				() => Result.ok(42),
			),
		);
		expect(result).toEqual({ kind: "Ok", value: 42 });
	},
);

test(
	"Result.recoverUnless does NOT recover when error matches blockedErr",
	() => {
		const result = pipe(
			Result.err("fatal"),
			Result.recoverUnless(
				"fatal",
				() => Result.ok(42),
			),
		);
		expect(result).toEqual({ kind: "Error", error: "fatal" });
	},
);

test("Result.recoverUnless passes through Ok unchanged", () => {
	const result = pipe(
		Result.ok(10),
		Result.recoverUnless(
			"fatal",
			() => Result.ok(42),
		),
	);
	expect(result).toEqual({ kind: "Ok", value: 10 });
});

test(
	"Result.recoverUnless widens to Result<E, A | B> when fallback returns a different type",
	() => {
		const result = pipe(
			Result.err("recoverable"),
			Result.recoverUnless("fatal", () => Result.ok("recovered")),
		);
		expect(result).toEqual({ kind: "Ok", value: "recovered" });
	},
);

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("Result.ap applies Ok function to Ok value", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		Result.ok(add),
		Result.ap(Result.ok(5)),
		Result.ap(Result.ok(3)),
	);
	expect(result).toEqual({ kind: "Ok", value: 8 });
});

test("Result.ap returns Err when function is Err", () => {
	const result = pipe(
		Result.err("fn error"),
		Result.ap(Result.ok(5)),
	);
	expect(result).toEqual({ kind: "Error", error: "fn error" });
});

test("Result.ap returns Err when value is Err", () => {
	const result = pipe(
		Result.ok<(n: number) => number>((n) => n * 2),
		Result.ap(Result.err("val error")),
	);
	expect(result).toEqual({ kind: "Error", error: "val error" });
});

test("Result.ap returns first Err when both are Err", () => {
	const result = pipe(
		Result.err("fn error"),
		Result.ap(Result.err("val error")),
	);
	expect(result).toEqual({ kind: "Error", error: "fn error" });
});

// ---------------------------------------------------------------------------
// toMaybe
// ---------------------------------------------------------------------------

test("Result.toMaybe converts Ok to Some", () => {
	const result = Result.toMaybe(Result.ok(42));
	expect(result).toEqual({ kind: "Some", value: 42 });
});

test("Result.toMaybe converts Err to None", () => {
	const result = Result.toMaybe(Result.err("oops"));
	expect(result).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Result composes well in a pipe chain", () => {
	const divide = (a: number, b: number) => b === 0 ? Result.err("Division by zero") : Result.ok(a / b);

	const result = pipe(
		divide(10, 2),
		Result.map((n: number) => n * 3),
		Result.chain((n: number) => n > 10 ? Result.ok(n) : (Result.err("Too small"))),
		Result.getOrElse(() => 0),
	);
	expect(result).toBe(15);
});

test("Result pipe short-circuits on Err", () => {
	const divide = (a: number, b: number) => b === 0 ? Result.err("Division by zero") : Result.ok(a / b);

	const result = pipe(
		divide(10, 0),
		Result.map((n: number) => n * 3),
		Result.getOrElse(() => -1),
	);
	expect(result).toBe(-1);
});
