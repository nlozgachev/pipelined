import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Option } from "../Option.ts";
import { Result } from "../Result.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// of / some
// ---------------------------------------------------------------------------

Deno.test("Option.some wraps a value in Some", () => {
  const result = Option.some(42);
  assertEquals(result, { kind: "Some", value: 42 });
});

Deno.test("Option.some creates a Some with the given value", () => {
  const result = Option.some("hello");
  assertEquals(result, { kind: "Some", value: "hello" });
});

Deno.test("Option.some and Option.some produce the same result", () => {
  assertEquals(Option.some(10), Option.some(10));
});

// ---------------------------------------------------------------------------
// isSome
// ---------------------------------------------------------------------------

Deno.test("Option.isSome returns true for Some", () => {
  assertStrictEquals(Option.isSome(Option.some(1)), true);
});

Deno.test("Option.isSome returns false for None", () => {
  assertStrictEquals(Option.isSome(Option.none()), false);
});

// ---------------------------------------------------------------------------
// none / isNone
// ---------------------------------------------------------------------------

Deno.test("Option.none creates a None", () => {
  assertEquals(Option.none(), { kind: "None" });
});

Deno.test("Option.isNone returns true for None", () => {
  assertStrictEquals(Option.isNone(Option.none()), true);
});

Deno.test("Option.isNone returns false for Some", () => {
  assertStrictEquals(Option.isNone(Option.some(1)), false);
});

// ---------------------------------------------------------------------------
// fromNullable
// ---------------------------------------------------------------------------

Deno.test("Option.fromNullable returns None for null", () => {
  assertEquals(Option.fromNullable(null), { kind: "None" });
});

Deno.test("Option.fromNullable returns None for undefined", () => {
  assertEquals(Option.fromNullable(undefined), { kind: "None" });
});

Deno.test("Option.fromNullable returns Some for 0", () => {
  assertEquals(Option.fromNullable(0), { kind: "Some", value: 0 });
});

Deno.test("Option.fromNullable returns Some for false", () => {
  assertEquals(Option.fromNullable(false), { kind: "Some", value: false });
});

Deno.test("Option.fromNullable returns Some for empty string", () => {
  assertEquals(Option.fromNullable(""), { kind: "Some", value: "" });
});

Deno.test("Option.fromNullable returns Some for NaN", () => {
  const result = Option.fromNullable(NaN);
  assertStrictEquals(result.kind, "Some");
  if (Option.isSome(result)) {
    assertStrictEquals(Number.isNaN(result.value), true);
  }
});

Deno.test("Option.fromNullable returns Some for a regular value", () => {
  assertEquals(Option.fromNullable(42), { kind: "Some", value: 42 });
});

Deno.test("Option.fromNullable returns Some for an object", () => {
  const obj = { a: 1 };
  const result = Option.fromNullable(obj);
  assertEquals(result, { kind: "Some", value: { a: 1 } });
});

// ---------------------------------------------------------------------------
// toNullable
// ---------------------------------------------------------------------------

Deno.test("Option.toNullable returns the value for Some", () => {
  assertStrictEquals(Option.toNullable(Option.some(42)), 42);
});

Deno.test("Option.toNullable returns null for None", () => {
  assertStrictEquals(Option.toNullable(Option.none()), null);
});

// ---------------------------------------------------------------------------
// toUndefined
// ---------------------------------------------------------------------------

Deno.test("Option.toUndefined returns the value for Some", () => {
  assertStrictEquals(Option.toUndefined(Option.some(42)), 42);
});

Deno.test("Option.toUndefined returns undefined for None", () => {
  assertStrictEquals(Option.toUndefined(Option.none()), undefined);
});

// ---------------------------------------------------------------------------
// fromUndefined
// ---------------------------------------------------------------------------

Deno.test("Option.fromUndefined returns None for undefined", () => {
  assertEquals(Option.fromUndefined(undefined), { kind: "None" });
});

Deno.test(
  "Option.fromUndefined returns Some for null (null is not undefined)",
  () => {
    assertEquals(Option.fromUndefined(null), { kind: "Some", value: null });
  },
);

Deno.test("Option.fromUndefined returns Some for a value", () => {
  assertEquals(Option.fromUndefined(42), { kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

Deno.test("Option.toResult converts Some to Ok", () => {
  const result = pipe(
    Option.some(42),
    Option.toResult(() => "missing"),
  );
  assertEquals(result, { kind: "Ok", value: 42 });
});

Deno.test(
  "Option.toResult converts None to Err using the onNone callback",
  () => {
    const result = Option.toResult(() => "error")(Option.none());
    assertEquals(result, { kind: "Error", error: "error" });
  },
);

Deno.test(
  "Option.toResult lazily evaluates the error callback only on None",
  () => {
    let called = false;
    pipe(
      Option.some(10),
      Option.toResult(() => {
        called = true;
        return "error";
      }),
    );
    assertStrictEquals(called, false);
  },
);

// ---------------------------------------------------------------------------
// fromResult
// ---------------------------------------------------------------------------

Deno.test("Option.fromResult converts Ok to Some", () => {
  const result = Option.fromResult(Result.ok(42));
  assertEquals(result, { kind: "Some", value: 42 });
});

Deno.test("Option.fromResult converts Err to None", () => {
  const result = Option.fromResult(Result.err("x"));
  assertEquals(result, { kind: "None" });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("Option.map transforms the value inside Some", () => {
  const result = pipe(
    Option.some(5),
    Option.map((n: number) => n * 2),
  );
  assertEquals(result, { kind: "Some", value: 10 });
});

Deno.test("Option.map passes through None unchanged", () => {
  const result = pipe(
    Option.none(),
    Option.map((n: number) => n * 2),
  );
  assertEquals(result, { kind: "None" });
});

Deno.test("Option.map can change the type", () => {
  const result = pipe(
    Option.some(5),
    Option.map((n: number) => String(n)),
  );
  assertEquals(result, { kind: "Some", value: "5" });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

Deno.test("Option.chain applies function when Some", () => {
  const parseNumber = (s: string) => {
    const n = parseInt(s, 10);
    return isNaN(n) ? Option.none() : Option.some(n);
  };
  const result = pipe(Option.some("42"), Option.chain(parseNumber));
  assertEquals(result, { kind: "Some", value: 42 });
});

Deno.test("Option.chain returns None when function returns None", () => {
  const parseNumber = (s: string) => {
    const n = parseInt(s, 10);
    return isNaN(n) ? Option.none() : Option.some(n);
  };
  const result = pipe(Option.some("abc"), Option.chain(parseNumber));
  assertEquals(result, { kind: "None" });
});

Deno.test("Option.chain propagates None without calling function", () => {
  let called = false;
  pipe(
    Option.none(),
    Option.chain((_s: string) => {
      called = true;
      return Option.some(1);
    }),
  );
  assertStrictEquals(called, false);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

Deno.test("Option.fold calls onSome for Some", () => {
  const result = pipe(
    Option.some(5),
    Option.fold(
      () => "none",
      (n: number) => `value: ${n}`,
    ),
  );
  assertStrictEquals(result, "value: 5");
});

Deno.test("Option.fold calls onNone for None", () => {
  const result = pipe(
    Option.none(),
    Option.fold(
      () => "none",
      (n: number) => `value: ${n}`,
    ),
  );
  assertStrictEquals(result, "none");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

Deno.test("Option.match calls some handler for Some", () => {
  const result = pipe(
    Option.some(5),
    Option.match({
      some: (n: number) => `got ${n}`,
      none: () => "nothing",
    }),
  );
  assertStrictEquals(result, "got 5");
});

Deno.test("Option.match calls none handler for None", () => {
  const result = pipe(
    Option.none(),
    Option.match({
      some: (n: number) => `got ${n}`,
      none: () => "nothing",
    }),
  );
  assertStrictEquals(result, "nothing");
});

Deno.test("Option.match is data-last (returns a function first)", () => {
  const handler = Option.match({
    some: (n) => `val: ${n}`,
    none: () => "empty",
  });
  assertStrictEquals(handler(Option.some(3)), "val: 3");
  assertStrictEquals(handler(Option.none()), "empty");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

Deno.test("Option.getOrElse returns value for Some", () => {
  const result = pipe(Option.some(5), Option.getOrElse(0));
  assertStrictEquals(result, 5);
});

Deno.test("Option.getOrElse returns default for None", () => {
  const result = pipe(Option.none(), Option.getOrElse(0));
  assertStrictEquals(result, 0);
});

Deno.test("Option.getOrElse widens return type to A | B when default is a different type", () => {
  const result = pipe(Option.none(), Option.getOrElse(null));
  assertStrictEquals(result, null);
});

Deno.test("Option.getOrElse returns Some value typed as A | B when Some", () => {
  const result = pipe(Option.some("hello"), Option.getOrElse(null));
  assertStrictEquals(result, "hello");
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

Deno.test(
  "Option.tap executes side effect on Some and returns original",
  () => {
    let sideEffect = 0;
    const result = pipe(
      Option.some(5),
      Option.tap((n: number) => {
        sideEffect = n;
      }),
    );
    assertStrictEquals(sideEffect, 5);
    assertEquals(result, { kind: "Some", value: 5 });
  },
);

Deno.test("Option.tap does not execute side effect on None", () => {
  let called = false;
  const result = pipe(
    Option.none(),
    Option.tap((_n: number) => {
      called = true;
    }),
  );
  assertStrictEquals(called, false);
  assertEquals(result, { kind: "None" });
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

Deno.test("Option.filter keeps Some when predicate is true", () => {
  const result = pipe(
    Option.some(5),
    Option.filter((n: number) => n > 3),
  );
  assertEquals(result, { kind: "Some", value: 5 });
});

Deno.test("Option.filter returns None when predicate is false", () => {
  const result = pipe(
    Option.some(2),
    Option.filter((n: number) => n > 3),
  );
  assertEquals(result, { kind: "None" });
});

Deno.test("Option.filter returns None when input is None", () => {
  const result = pipe(
    Option.none(),
    Option.filter((n: number) => n > 3),
  );
  assertEquals(result, { kind: "None" });
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

Deno.test(
  "Option.recover returns original Some without calling fallback",
  () => {
    let called = false;
    const result = pipe(
      Option.some(5),
      Option.recover(() => {
        called = true;
        return Option.some(99);
      }),
    );
    assertStrictEquals(called, false);
    assertEquals(result, { kind: "Some", value: 5 });
  },
);

Deno.test("Option.recover provides fallback for None", () => {
  const result = pipe(
    Option.none(),
    Option.recover(() => Option.some(99)),
  );
  assertEquals(result, { kind: "Some", value: 99 });
});

Deno.test("Option.recover can return None as fallback", () => {
  const result = pipe(
    Option.none(),
    Option.recover(() => Option.none()),
  );
  assertEquals(result, { kind: "None" });
});

Deno.test("Option.recover widens to Option<A | B> when fallback returns a different type", () => {
  const result = pipe(
    Option.none(),
    Option.recover(() => Option.some("fallback")),
  );
  assertEquals(result, { kind: "Some", value: "fallback" });
});

Deno.test("Option.recover preserves Some typed as Option<A | B>", () => {
  const result = pipe(
    Option.some(42),
    Option.recover(() => Option.some("fallback")),
  );
  assertEquals(result, { kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

Deno.test("Option.ap applies Some function to Some value", () => {
  const add = (a: number) => (b: number) => a + b;
  const result = pipe(
    Option.some(add),
    Option.ap(Option.some(5)),
    Option.ap(Option.some(3)),
  );
  assertEquals(result, { kind: "Some", value: 8 });
});

Deno.test("Option.ap returns None when function is None", () => {
  const result = pipe(
    Option.none(),
    Option.ap(Option.some(5)),
  );
  assertEquals(result, { kind: "None" });
});

Deno.test("Option.ap returns None when value is None", () => {
  const result = pipe(
    Option.some((n: number) => n * 2),
    Option.ap(Option.none()),
  );
  assertEquals(result, { kind: "None" });
});

Deno.test("Option.ap returns None when both are None", () => {
  const result = pipe(
    Option.none(),
    Option.ap(Option.none()),
  );
  assertEquals(result, { kind: "None" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("Option composes well in a pipe chain", () => {
  const result = pipe(
    Option.fromNullable("42" as string | null),
    Option.map((s) => parseInt(s, 10)),
    Option.filter((n) => n > 0),
    Option.map((n) => n * 2),
    Option.getOrElse(0),
  );
  assertStrictEquals(result, 84);
});

Deno.test("Option pipe short-circuits on None", () => {
  const result = pipe(
    Option.fromNullable(null as string | null),
    Option.map((s) => parseInt(s, 10)),
    Option.filter((n) => n > 0),
    Option.map((n) => n * 2),
    Option.getOrElse(0),
  );
  assertStrictEquals(result, 0);
});
