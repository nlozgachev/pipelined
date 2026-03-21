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
    TaskValidation.recover((_errors) => {
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
    TaskValidation.recover((_errors) => TaskValidation.valid<string, number>(99)),
  )();
  assertEquals(result, { kind: "Valid", value: 99 });
});

Deno.test("TaskValidation.recover exposes the error list to the fallback", async () => {
  let received: string[] = [];
  await pipe(
    TaskValidation.invalidAll<string, number>(["first", "second"]),
    TaskValidation.recover((errors) => {
      received = [...errors];
      return TaskValidation.valid<string, number>(0);
    }),
  )();
  assertEquals(received, ["first", "second"]);
});

Deno.test(
  "TaskValidation.recover widens to TaskValidation<E, A | B> when fallback returns a different type",
  async () => {
    const result = await pipe(
      TaskValidation.invalid("err"),
      TaskValidation.recover((_errors) => TaskValidation.valid("recovered")),
    )();
    assertEquals(result, { kind: "Valid", value: "recovered" });
  },
);

Deno.test("TaskValidation.recover preserves Valid typed as TaskValidation<E, A | B>", async () => {
  const result = await pipe(
    TaskValidation.valid(5),
    TaskValidation.recover((_errors) => TaskValidation.valid("recovered")),
  )();
  assertEquals(result, { kind: "Valid", value: 5 });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("TaskValidation composes well in a pipe chain", async () => {
  const validateName = (name: string): TaskValidation<string, string> =>
    name.length > 0 ? TaskValidation.valid(name) : TaskValidation.invalid("Name required");
  const validateAge = (age: number): TaskValidation<string, number> =>
    age >= 0 ? TaskValidation.valid(age) : TaskValidation.invalid("Age must be >= 0");
  const build = (name: string) => (age: number) => ({ name, age });
  const result = await pipe(
    TaskValidation.valid<string, typeof build>(build),
    TaskValidation.ap(validateName("Alice")),
    TaskValidation.ap(validateAge(30)),
    TaskValidation.map((user) => user.name),
    TaskValidation.getOrElse(() => "unknown"),
  )();
  assertStrictEquals(result, "Alice");
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

// ---------------------------------------------------------------------------
// product
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.product returns tuple when both are Valid", async () => {
  const result = await TaskValidation.product(
    TaskValidation.valid<string, string>("alice"),
    TaskValidation.valid<string, number>(30),
  )();
  assertEquals(result, { kind: "Valid", value: ["alice", 30] });
});

Deno.test("TaskValidation.product accumulates errors when first is Invalid", async () => {
  const result = await TaskValidation.product(
    TaskValidation.invalid<string, string>("Name required"),
    TaskValidation.valid<string, number>(30),
  )();
  assertEquals(result, { kind: "Invalid", errors: ["Name required"] });
});

Deno.test("TaskValidation.product accumulates errors from both sides", async () => {
  const result = await TaskValidation.product(
    TaskValidation.invalid<string, string>("Name required"),
    TaskValidation.invalid<string, number>("Age required"),
  )();
  assertEquals(result, { kind: "Invalid", errors: ["Name required", "Age required"] });
});

// ---------------------------------------------------------------------------
// productAll
// ---------------------------------------------------------------------------

Deno.test("TaskValidation.productAll returns all values when all are Valid", async () => {
  const result = await TaskValidation.productAll([
    TaskValidation.valid<string, number>(1),
    TaskValidation.valid<string, number>(2),
    TaskValidation.valid<string, number>(3),
  ])();
  assertEquals(result, { kind: "Valid", value: [1, 2, 3] });
});

Deno.test("TaskValidation.productAll accumulates all errors", async () => {
  const result = await TaskValidation.productAll([
    TaskValidation.invalid<string, number>("err1"),
    TaskValidation.valid<string, number>(2),
    TaskValidation.invalid<string, number>("err2"),
  ])();
  assertEquals(result, { kind: "Invalid", errors: ["err1", "err2"] });
});

Deno.test("TaskValidation.productAll with single element returns singleton array", async () => {
  const result = await TaskValidation.productAll([
    TaskValidation.valid<string, number>(42),
  ])();
  assertEquals(result, { kind: "Valid", value: [42] });
});
