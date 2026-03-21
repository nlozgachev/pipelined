import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Result } from "../Result.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// of / ok
// ---------------------------------------------------------------------------

Deno.test("Result.ok wraps a value in Ok", () => {
  const result = Result.ok(42);
  assertEquals(result, { kind: "Ok", value: 42 });
});

Deno.test("Result.ok creates an Ok with the given value", () => {
  assertEquals(Result.ok("hello"), { kind: "Ok", value: "hello" });
});

Deno.test("Result.ok and Result.ok produce equivalent results", () => {
  assertEquals(Result.ok(10), Result.ok(10));
});

// ---------------------------------------------------------------------------
// err
// ---------------------------------------------------------------------------

Deno.test("Result.err creates an Err with the given error", () => {
  assertEquals(Result.err("something went wrong"), {
    kind: "Error",
    error: "something went wrong",
  });
});

Deno.test("Result.err works with complex error types", () => {
  const err = Result.err({ code: 404, message: "Not Found" });
  assertEquals(err, {
    kind: "Error",
    error: { code: 404, message: "Not Found" },
  });
});

// ---------------------------------------------------------------------------
// isOk / isErr
// ---------------------------------------------------------------------------

Deno.test("Result.isOk returns true for Ok", () => {
  assertStrictEquals(Result.isOk(Result.ok(1)), true);
});

Deno.test("Result.isOk returns false for Err", () => {
  assertStrictEquals(Result.isOk(Result.err("e")), false);
});

Deno.test("Result.isErr returns true for Err", () => {
  assertStrictEquals(Result.isErr(Result.err("e")), true);
});

Deno.test("Result.isErr returns false for Ok", () => {
  assertStrictEquals(Result.isErr(Result.ok(1)), false);
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

Deno.test("Result.tryCatch returns Ok when function succeeds", () => {
  const result = Result.tryCatch(
    () => JSON.parse('{"a":1}'),
    (e) => `Parse error: ${e}`,
  );
  assertEquals(result, { kind: "Ok", value: { a: 1 } });
});

Deno.test("Result.tryCatch returns Err when function throws", () => {
  const result = Result.tryCatch(
    () => JSON.parse("invalid json!!!"),
    () => "Parse error",
  );
  assertEquals(result, { kind: "Error", error: "Parse error" });
});

Deno.test("Result.tryCatch passes the thrown error to onError", () => {
  const result = Result.tryCatch(
    () => {
      throw new Error("boom");
    },
    (e) => (e as Error).message,
  );
  assertEquals(result, { kind: "Error", error: "boom" });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("Result.map transforms Ok value", () => {
  const result = pipe(
    Result.ok(5),
    Result.map((n: number) => n * 2),
  );
  assertEquals(result, { kind: "Ok", value: 10 });
});

Deno.test("Result.map passes through Err unchanged", () => {
  const result = pipe(
    Result.err("error"),
    Result.map((n: number) => n * 2),
  );
  assertEquals(result, { kind: "Error", error: "error" });
});

Deno.test("Result.map can change the value type", () => {
  const result = pipe(
    Result.ok(42),
    Result.map((n: number) => `num: ${n}`),
  );
  assertEquals(result, { kind: "Ok", value: "num: 42" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

Deno.test("Result.mapError transforms Err value", () => {
  const result = pipe(
    Result.err("oops"),
    Result.mapError((e: string) => e.toUpperCase()),
  );
  assertEquals(result, { kind: "Error", error: "OOPS" });
});

Deno.test("Result.mapError passes through Ok unchanged", () => {
  const result = pipe(
    Result.ok(5),
    Result.mapError((e: string) => e.toUpperCase()),
  );
  assertEquals(result, { kind: "Ok", value: 5 });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

Deno.test("Result.chain applies function when Ok", () => {
  const validatePositive = (n: number) => n > 0 ? Result.ok(n) : Result.err("Must be positive");

  const result = pipe(
    Result.ok(5),
    Result.chain(validatePositive),
  );
  assertEquals(result, { kind: "Ok", value: 5 });
});

Deno.test("Result.chain returns Err when function returns Err", () => {
  const validatePositive = (n: number) => n > 0 ? Result.ok(n) : Result.err("Must be positive");

  const result = pipe(
    Result.ok(-1),
    Result.chain(validatePositive),
  );
  assertEquals(result, { kind: "Error", error: "Must be positive" });
});

Deno.test("Result.chain propagates Err without calling function", () => {
  let called = false;
  pipe(
    Result.err("error"),
    Result.chain((_n: number) => {
      called = true;
      return Result.ok(_n);
    }),
  );
  assertStrictEquals(called, false);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

Deno.test("Result.fold calls onOk for Ok", () => {
  const result = pipe(
    Result.ok(5),
    Result.fold(
      (e: string) => `Error: ${e}`,
      (n: number) => `Value: ${n}`,
    ),
  );
  assertStrictEquals(result, "Value: 5");
});

Deno.test("Result.fold calls onErr for Err", () => {
  const result = pipe(
    Result.err("bad"),
    Result.fold(
      (e: string) => `Error: ${e}`,
      (n: number) => `Value: ${n}`,
    ),
  );
  assertStrictEquals(result, "Error: bad");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

Deno.test("Result.match calls ok handler for Ok", () => {
  const result = pipe(
    Result.ok(5),
    Result.match({
      ok: (n: number) => `got ${n}`,
      err: (e: string) => `failed: ${e}`,
    }),
  );
  assertStrictEquals(result, "got 5");
});

Deno.test("Result.match calls err handler for Err", () => {
  const result = pipe(
    Result.err("bad"),
    Result.match({
      ok: (n: number) => `got ${n}`,
      err: (e: string) => `failed: ${e}`,
    }),
  );
  assertStrictEquals(result, "failed: bad");
});

Deno.test("Result.match is data-last (returns a function first)", () => {
  const handler = Result.match({
    ok: (n) => `val: ${n}`,
    err: (e) => `err: ${e}`,
  });
  assertStrictEquals(handler(Result.ok(3)), "val: 3");
  assertStrictEquals(handler(Result.err("x")), "err: x");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

Deno.test("Result.getOrElse returns value for Ok", () => {
  const result = pipe(
    Result.ok(5),
    Result.getOrElse(() => 0),
  );
  assertStrictEquals(result, 5);
});

Deno.test("Result.getOrElse returns default for Err", () => {
  const result = pipe(
    Result.err("error"),
    Result.getOrElse(() => 0),
  );
  assertStrictEquals(result, 0);
});

Deno.test("Result.getOrElse widens return type to A | B when default is a different type", () => {
  const result = pipe(
    Result.err("error"),
    Result.getOrElse(() => null),
  );
  assertStrictEquals(result, null);
});

Deno.test("Result.getOrElse returns Ok value typed as A | B when Ok", () => {
  const result = pipe(
    Result.ok(5),
    Result.getOrElse(() => null),
  );
  assertStrictEquals(result, 5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

Deno.test("Result.tap executes side effect on Ok and returns original", () => {
  let sideEffect = 0;
  const result = pipe(
    Result.ok(5),
    Result.tap((n: number) => {
      sideEffect = n;
    }),
  );
  assertStrictEquals(sideEffect, 5);
  assertEquals(result, { kind: "Ok", value: 5 });
});

Deno.test("Result.tap does not execute side effect on Err", () => {
  let called = false;
  const result = pipe(
    Result.err("error"),
    Result.tap((_n: number) => {
      called = true;
    }),
  );
  assertStrictEquals(called, false);
  assertEquals(result, { kind: "Error", error: "error" });
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

Deno.test("Result.recover returns original Ok without calling fallback", () => {
  let called = false;
  const result = pipe(
    Result.ok(5),
    Result.recover((_e) => {
      called = true;
      return Result.ok(99);
    }),
  );
  assertStrictEquals(called, false);
  assertEquals(result, { kind: "Ok", value: 5 });
});

Deno.test("Result.recover provides fallback for Err", () => {
  const result = pipe(
    Result.err("error"),
    Result.recover((_e) => Result.ok(99)),
  );
  assertEquals(result, { kind: "Ok", value: 99 });
});

Deno.test("Result.recover widens to Result<E, A | B> when fallback returns a different type", () => {
  const result = pipe(
    Result.err("error"),
    Result.recover((_e) => Result.ok("recovered")),
  );
  assertEquals(result, { kind: "Ok", value: "recovered" });
});

Deno.test("Result.recover preserves Ok typed as Result<E, A | B>", () => {
  const result = pipe(
    Result.ok(5),
    Result.recover((_e) => Result.ok("recovered")),
  );
  assertEquals(result, { kind: "Ok", value: 5 });
});

Deno.test("Result.recover passes the error to the fallback", () => {
  const result = pipe(
    Result.err("original error"),
    Result.recover((e) => Result.ok(`handled: ${e}`)),
  );
  assertEquals(result, { kind: "Ok", value: "handled: original error" });
});

// ---------------------------------------------------------------------------
// recoverUnless
// ---------------------------------------------------------------------------

Deno.test(
  "Result.recoverUnless recovers when error does not match blockedErr",
  () => {
    const result = pipe(
      Result.err("recoverable"),
      Result.recoverUnless(
        "fatal",
        () => Result.ok(42),
      ),
    );
    assertEquals(result, { kind: "Ok", value: 42 });
  },
);

Deno.test(
  "Result.recoverUnless does NOT recover when error matches blockedErr",
  () => {
    const result = pipe(
      Result.err("fatal"),
      Result.recoverUnless(
        "fatal",
        () => Result.ok(42),
      ),
    );
    assertEquals(result, { kind: "Error", error: "fatal" });
  },
);

Deno.test("Result.recoverUnless passes through Ok unchanged", () => {
  const result = pipe(
    Result.ok(10),
    Result.recoverUnless(
      "fatal",
      () => Result.ok(42),
    ),
  );
  assertEquals(result, { kind: "Ok", value: 10 });
});

Deno.test(
  "Result.recoverUnless widens to Result<E, A | B> when fallback returns a different type",
  () => {
    const result = pipe(
      Result.err("recoverable"),
      Result.recoverUnless("fatal", () => Result.ok("recovered")),
    );
    assertEquals(result, { kind: "Ok", value: "recovered" });
  },
);

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

Deno.test("Result.ap applies Ok function to Ok value", () => {
  const add = (a: number) => (b: number) => a + b;
  const result = pipe(
    Result.ok(add),
    Result.ap(Result.ok(5)),
    Result.ap(Result.ok(3)),
  );
  assertEquals(result, { kind: "Ok", value: 8 });
});

Deno.test("Result.ap returns Err when function is Err", () => {
  const result = pipe(
    Result.err("fn error"),
    Result.ap(Result.ok(5)),
  );
  assertEquals(result, { kind: "Error", error: "fn error" });
});

Deno.test("Result.ap returns Err when value is Err", () => {
  const result = pipe(
    Result.ok<(n: number) => number>((n) => n * 2),
    Result.ap(Result.err("val error")),
  );
  assertEquals(result, { kind: "Error", error: "val error" });
});

Deno.test("Result.ap returns first Err when both are Err", () => {
  const result = pipe(
    Result.err("fn error"),
    Result.ap(Result.err("val error")),
  );
  assertEquals(result, { kind: "Error", error: "fn error" });
});

// ---------------------------------------------------------------------------
// toOption
// ---------------------------------------------------------------------------

Deno.test("Result.toOption converts Ok to Some", () => {
  const result = Result.toOption(Result.ok(42));
  assertEquals(result, { kind: "Some", value: 42 });
});

Deno.test("Result.toOption converts Err to None", () => {
  const result = Result.toOption(Result.err("oops"));
  assertEquals(result, { kind: "None" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("Result composes well in a pipe chain", () => {
  const divide = (a: number, b: number) =>
    b === 0 ? Result.err("Division by zero") : Result.ok(a / b);

  const result = pipe(
    divide(10, 2),
    Result.map((n: number) => n * 3),
    Result.chain((n: number) => n > 10 ? Result.ok(n) : (Result.err("Too small"))),
    Result.getOrElse(() => 0),
  );
  assertStrictEquals(result, 15);
});

Deno.test("Result pipe short-circuits on Err", () => {
  const divide = (a: number, b: number) =>
    b === 0 ? Result.err("Division by zero") : Result.ok(a / b);

  const result = pipe(
    divide(10, 0),
    Result.map((n: number) => n * 3),
    Result.getOrElse(() => -1),
  );
  assertStrictEquals(result, -1);
});
