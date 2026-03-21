import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Validation } from "../Validation.ts";
import { TaskValidation } from "../TaskValidation.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// valid
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.valid creates a Task that resolves to Valid", async () => {
  assertEquals(await TaskValidation.valid<string, number>(42)(), { kind: "Valid", value: 42 });
});

// ---------------------------------------------------------------------------
// invalid
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.invalid creates a Task that resolves to Invalid with one error", async () => {
  assertEquals(
    await TaskValidation.invalid<string, number>("bad")(),
    { kind: "Invalid", errors: ["bad"] },
  );
});

// ---------------------------------------------------------------------------
// invalidAll
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.invalidAll creates a Task that resolves to Invalid with multiple errors", async () => {
  assertEquals(
    await TaskValidation.invalidAll<string, number>(["err1", "err2"])(),
    { kind: "Invalid", errors: ["err1", "err2"] },
  );
});

// ---------------------------------------------------------------------------
// fromValidation
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.fromValidation lifts a Valid into a Task", async () => {
  assertEquals(
    await TaskValidation.fromValidation(Validation.valid<string, number>(5))(),
    { kind: "Valid", value: 5 },
  );
});

Deno.test("TaskValidation.fromValidation lifts an Invalid into a Task", async () => {
  assertEquals(
    await TaskValidation.fromValidation(Validation.invalid("e"))(),
    { kind: "Invalid", errors: ["e"] },
  );
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.tryCatch returns Valid when Promise resolves", async () => {
  assertEquals(
    await TaskValidation.tryCatch(() => Promise.resolve(42), (e) => String(e))(),
    { kind: "Valid", value: 42 },
  );
});

Deno.test("TaskValidation.tryCatch returns Invalid when Promise rejects", async () => {
  assertEquals(
    await TaskValidation.tryCatch(
      () => Promise.reject(new Error("boom")),
      (e) => (e as Error).message,
    )(),
    { kind: "Invalid", errors: ["boom"] },
  );
});

Deno.test("TaskValidation.tryCatch catches async throws", async () => {
  assertEquals(
    await TaskValidation.tryCatch(
      // deno-lint-ignore require-await
      async () => {
        throw new Error("bang");
      },
      (e) => (e as Error).message,
    )(),
    { kind: "Invalid", errors: ["bang"] },
  );
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.map transforms Valid value", async () => {
  assertEquals(
    await pipe(TaskValidation.valid<string, number>(5), TaskValidation.map((n: number) => n * 2))(),
    { kind: "Valid", value: 10 },
  );
});

Deno.test("TaskValidation.map passes through Invalid unchanged", async () => {
  assertEquals(
    await pipe(
      TaskValidation.invalid<string, number>("err"),
      TaskValidation.map((n: number) => n * 2),
    )(),
    { kind: "Invalid", errors: ["err"] },
  );
});

Deno.test("TaskValidation.map can change the value type", async () => {
  assertEquals(
    await pipe(
      TaskValidation.valid<string, number>(3),
      TaskValidation.map((n: number) => `n:${n}`),
    )(),
    { kind: "Valid", value: "n:3" },
  );
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.chain applies function when Valid", async () => {
  const result = await pipe(
    TaskValidation.valid<string, number>(5),
    TaskValidation.chain((n: number) => TaskValidation.valid(n * 2)),
  )();
  assertEquals(result, { kind: "Valid", value: 10 });
});

Deno.test("TaskValidation.chain propagates Invalid without calling function", async () => {
  let called = false;
  await pipe(
    TaskValidation.invalid<string, number>("err"),
    TaskValidation.chain((_n: number) => {
      called = true;
      return TaskValidation.valid(_n);
    }),
  )();
  assertStrictEquals(called, false);
});

Deno.test("TaskValidation.chain returns Invalid when function returns Invalid", async () => {
  assertEquals(
    await pipe(
      TaskValidation.valid<string, number>(5),
      TaskValidation.chain((_n: number) => TaskValidation.invalid<string, number>("bad")),
    )(),
    { kind: "Invalid", errors: ["bad"] },
  );
});

Deno.test("TaskValidation.chain composes multiple async steps", async () => {
  const result = await pipe(
    TaskValidation.valid<string, number>(1),
    TaskValidation.chain((n: number) => TaskValidation.valid<string, number>(n + 1)),
    TaskValidation.chain((n: number) => TaskValidation.valid<string, number>(n * 10)),
  )();
  assertEquals(result, { kind: "Valid", value: 20 });
});

// ---------------------------------------------------------------------------
// ap (error accumulation)
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.ap applies Valid function to Valid value", async () => {
  const result = await pipe(
    TaskValidation.valid<string, (n: number) => number>((n) => n * 3),
    TaskValidation.ap(TaskValidation.valid<string, number>(4)),
  )();
  assertEquals(result, { kind: "Valid", value: 12 });
});

Deno.test("TaskValidation.ap accumulates errors from both Invalid sides", async () => {
  const add = (a: number) => (b: number) => a + b;
  const result = await pipe(
    TaskValidation.valid<string, (a: number) => (b: number) => number>(add),
    TaskValidation.ap(TaskValidation.invalid<string, number>("bad a")),
    TaskValidation.ap(TaskValidation.invalid<string, number>("bad b")),
  )();
  assertEquals(result, { kind: "Invalid", errors: ["bad a", "bad b"] });
});

Deno.test("TaskValidation.ap returns Invalid when function side is Invalid", async () => {
  const result = await pipe(
    TaskValidation.invalid<string, (n: number) => number>("bad fn"),
    TaskValidation.ap(TaskValidation.valid<string, number>(4)),
  )();
  assertEquals(result, { kind: "Invalid", errors: ["bad fn"] });
});

Deno.test("TaskValidation.ap collects errors from both sides simultaneously", async () => {
  const result = await pipe(
    TaskValidation.invalid<string, (n: number) => number>("bad fn"),
    TaskValidation.ap(TaskValidation.invalid<string, number>("bad arg")),
  )();
  assertEquals(result, { kind: "Invalid", errors: ["bad fn", "bad arg"] });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.fold calls onValid for Valid", async () => {
  assertStrictEquals(
    await pipe(
      TaskValidation.valid(5),
      TaskValidation.fold((errs) => `invalid:${errs}`, (n: number) => `valid:${n}`),
    )(),
    "valid:5",
  );
});

Deno.test("TaskValidation.fold calls onInvalid for Invalid", async () => {
  assertStrictEquals(
    await pipe(
      TaskValidation.invalid<string, number>("e"),
      TaskValidation.fold((errs) => `invalid:${errs.join(",")}`, (n: number) => `valid:${n}`),
    )(),
    "invalid:e",
  );
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.match calls valid handler for Valid", async () => {
  assertStrictEquals(
    await pipe(
      TaskValidation.valid<string, number>(5),
      TaskValidation.match({
        valid: (n: number) => `got:${n}`,
        invalid: (errs) => `errs:${errs.join(",")}`,
      }),
    )(),
    "got:5",
  );
});

Deno.test("TaskValidation.match calls invalid handler for Invalid", async () => {
  assertStrictEquals(
    await pipe(
      TaskValidation.invalid<string, number>("oops"),
      TaskValidation.match({
        valid: (n: number) => `got:${n}`,
        invalid: (errs) => `errs:${errs.join(",")}`,
      }),
    )(),
    "errs:oops",
  );
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.getOrElse returns value for Valid", async () => {
  assertStrictEquals(
    await pipe(TaskValidation.valid<string, number>(5), TaskValidation.getOrElse(() => 0))(),
    5,
  );
});

Deno.test("TaskValidation.getOrElse returns default for Invalid", async () => {
  assertStrictEquals(
    await pipe(TaskValidation.invalid<string, number>("e"), TaskValidation.getOrElse(() => 0))(),
    0,
  );
});

Deno.test(
  "TaskValidation.getOrElse widens return type to A | B when default is a different type",
  async () => {
    const result = await pipe(
      TaskValidation.invalid("e"),
      TaskValidation.getOrElse(() => null),
    )();
    assertStrictEquals(result, null);
  },
);

Deno.test("TaskValidation.getOrElse returns Valid value typed as A | B when Valid", async () => {
  const result = await pipe(
    TaskValidation.valid(5),
    TaskValidation.getOrElse(() => null),
  )();
  assertStrictEquals(result, 5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.tap executes side effect on Valid and returns original", async () => {
  let seen = 0;
  const result = await pipe(
    TaskValidation.valid<string, number>(5),
    TaskValidation.tap((n: number) => {
      seen = n;
    }),
  )();
  assertStrictEquals(seen, 5);
  assertEquals(result, { kind: "Valid", value: 5 });
});

Deno.test("TaskValidation.tap does not execute side effect on Invalid", async () => {
  let called = false;
  await pipe(
    TaskValidation.invalid<string, number>("err"),
    TaskValidation.tap(() => {
      called = true;
    }),
  )();
  assertStrictEquals(called, false);
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.recover returns original Valid without calling fallback", async () => {
  let called = false;
  const result = await pipe(
    TaskValidation.valid<string, number>(5),
    TaskValidation.recover(() => {
      called = true;
      return TaskValidation.valid<string, number>(99);
    }),
  )();
  assertStrictEquals(called, false);
  assertEquals(result, { kind: "Valid", value: 5 });
});

Deno.test("TaskValidation.recover provides fallback for Invalid", async () => {
  const result = await pipe(
    TaskValidation.invalid<string, number>("err"),
    TaskValidation.recover(() => TaskValidation.valid<string, number>(99)),
  )();
  assertEquals(result, { kind: "Valid", value: 99 });
});

Deno.test(
  "TaskValidation.recover widens to TaskValidation<E, A | B> when fallback returns a different type",
  async () => {
    const result = await pipe(
      TaskValidation.invalid("err"),
      TaskValidation.recover(() => TaskValidation.valid("recovered")),
    )();
    assertEquals(result, { kind: "Valid", value: "recovered" });
  },
);

Deno.test("TaskValidation.recover preserves Valid typed as TaskValidation<E, A | B>", async () => {
  const result = await pipe(
    TaskValidation.valid(5),
    TaskValidation.recover(() => TaskValidation.valid("recovered")),
  )();
  assertEquals(result, { kind: "Valid", value: 5 });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("TaskValidation composes well in a pipe chain", async () => {
  const result = await pipe(
    TaskValidation.valid<string, number>(5),
    TaskValidation.map((n: number) => n * 2),
    TaskValidation.chain((n: number) =>
      n > 5
        ? TaskValidation.valid<string, number>(n)
        : TaskValidation.invalid<string, number>("Too small")
    ),
    TaskValidation.getOrElse(() => 0),
  )();
  assertStrictEquals(result, 10);
});

Deno.test("TaskValidation ap accumulates all errors across multiple validations", async () => {
  const validate = (name: string) => (age: number) => ({ name, age });
  const result = await pipe(
    TaskValidation.valid<string, typeof validate>(validate),
    TaskValidation.ap(TaskValidation.invalid<string, string>("Name required")),
    TaskValidation.ap(TaskValidation.invalid<string, number>("Age required")),
  )();
  assertEquals(result, { kind: "Invalid", errors: ["Name required", "Age required"] });
});
