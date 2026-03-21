import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Option } from "../Option.ts";
import { Task } from "../Task.ts";
import { TaskOption } from "../TaskOption.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// of
// ---------------------------------------------------------------------------

Deno.test("TaskOption.some creates a Task that resolves to Some", async () => {
  assertEquals(await TaskOption.some(42)(), { kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// none
// ---------------------------------------------------------------------------

Deno.test("TaskOption.none creates a Task that resolves to None", async () => {
  assertEquals(await TaskOption.none()(), { kind: "None" });
});

// ---------------------------------------------------------------------------
// fromOption
// ---------------------------------------------------------------------------

Deno.test("TaskOption.fromOption lifts Some into a Task", async () => {
  assertEquals(await TaskOption.fromOption(Option.some(10))(), {
    kind: "Some",
    value: 10,
  });
});

Deno.test("TaskOption.fromOption lifts None into a Task", async () => {
  assertEquals(await TaskOption.fromOption(Option.none())(), { kind: "None" });
});

// ---------------------------------------------------------------------------
// fromTask
// ---------------------------------------------------------------------------

Deno.test("TaskOption.fromTask wraps a Task result in Some", async () => {
  const task = Task.resolve(5);
  assertEquals(await TaskOption.fromTask(task)(), { kind: "Some", value: 5 });
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

Deno.test(
  "TaskOption.tryCatch returns Some when Promise resolves",
  async () => {
    assertEquals(await TaskOption.tryCatch(() => Promise.resolve(99))(), {
      kind: "Some",
      value: 99,
    });
  },
);

Deno.test("TaskOption.tryCatch returns None when Promise rejects", async () => {
  assertEquals(
    await TaskOption.tryCatch(() => Promise.reject(new Error("boom")))(),
    { kind: "None" },
  );
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("TaskOption.map transforms Some value", async () => {
  assertEquals(
    await pipe(
      TaskOption.some(5),
      TaskOption.map((n: number) => n * 2),
    )(),
    { kind: "Some", value: 10 },
  );
});

Deno.test("TaskOption.map passes through None unchanged", async () => {
  assertEquals(
    await pipe(
      TaskOption.none<number>(),
      TaskOption.map((n: number) => n * 2),
    )(),
    { kind: "None" },
  );
});

Deno.test("TaskOption.map can change the value type", async () => {
  assertEquals(
    await pipe(
      TaskOption.some(7),
      TaskOption.map((n: number) => `val:${n}`),
    )(),
    { kind: "Some", value: "val:7" },
  );
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

Deno.test("TaskOption.chain applies function when Some", async () => {
  const result = await pipe(
    TaskOption.some(5),
    TaskOption.chain((n: number) => TaskOption.some(n * 2)),
  )();
  assertEquals(result, { kind: "Some", value: 10 });
});

Deno.test(
  "TaskOption.chain propagates None without calling function",
  async () => {
    let called = false;
    await pipe(
      TaskOption.none<number>(),
      TaskOption.chain((_n: number) => {
        called = true;
        return TaskOption.some(_n);
      }),
    )();
    assertStrictEquals(called, false);
  },
);

Deno.test(
  "TaskOption.chain returns None when function returns None",
  async () => {
    assertEquals(
      await pipe(
        TaskOption.some(5),
        TaskOption.chain((_n: number) => TaskOption.none()),
      )(),
      { kind: "None" },
    );
  },
);

Deno.test("TaskOption.chain composes multiple async steps", async () => {
  const result = await pipe(
    TaskOption.some(1),
    TaskOption.chain((n: number) => TaskOption.some(n + 1)),
    TaskOption.chain((n: number) => TaskOption.some(n * 10)),
  )();
  assertEquals(result, { kind: "Some", value: 20 });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

Deno.test("TaskOption.ap applies Some function to Some value", async () => {
  const result = await pipe(
    TaskOption.some((n: number) => n * 3),
    TaskOption.ap(TaskOption.some(4)),
  )();
  assertEquals(result, { kind: "Some", value: 12 });
});

Deno.test("TaskOption.ap returns None when function is None", async () => {
  assertEquals(
    await pipe(
      TaskOption.none<(n: number) => number>(),
      TaskOption.ap(TaskOption.some(4)),
    )(),
    { kind: "None" },
  );
});

Deno.test("TaskOption.ap returns None when argument is None", async () => {
  assertEquals(
    await pipe(
      TaskOption.some((n: number) => n * 3),
      TaskOption.ap(TaskOption.none<number>()),
    )(),
    { kind: "None" },
  );
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

Deno.test("TaskOption.fold calls onSome for Some", async () => {
  assertStrictEquals(
    await pipe(
      TaskOption.some(5),
      TaskOption.fold(
        () => "none",
        (n: number) => `some:${n}`,
      ),
    )(),
    "some:5",
  );
});

Deno.test("TaskOption.fold calls onNone for None", async () => {
  assertStrictEquals(
    await pipe(
      TaskOption.none(),
      TaskOption.fold(
        () => "none",
        (n: number) => `some:${n}`,
      ),
    )(),
    "none",
  );
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

Deno.test("TaskOption.match calls some handler for Some", async () => {
  assertStrictEquals(
    await pipe(
      TaskOption.some(5),
      TaskOption.match({
        some: (n: number) => `got:${n}`,
        none: () => "empty",
      }),
    )(),
    "got:5",
  );
});

Deno.test("TaskOption.match calls none handler for None", async () => {
  assertStrictEquals(
    await pipe(
      TaskOption.none(),
      TaskOption.match({
        some: (n: number) => `got:${n}`,
        none: () => "empty",
      }),
    )(),
    "empty",
  );
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

Deno.test("TaskOption.getOrElse returns value for Some", async () => {
  assertStrictEquals(
    await pipe(TaskOption.some(5), TaskOption.getOrElse(() => 0))(),
    5,
  );
});

Deno.test("TaskOption.getOrElse returns default for None", async () => {
  assertStrictEquals(
    await pipe(TaskOption.none<number>(), TaskOption.getOrElse(() => 0))(),
    0,
  );
});

Deno.test("TaskOption.getOrElse widens return type to A | B when default is a different type", async () => {
  const result = await pipe(TaskOption.none(), TaskOption.getOrElse(() => null))();
  assertStrictEquals(result, null);
});

Deno.test("TaskOption.getOrElse returns Some value typed as A | B when Some", async () => {
  const result = await pipe(TaskOption.some(5), TaskOption.getOrElse(() => null))();
  assertStrictEquals(result, 5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

Deno.test(
  "TaskOption.tap executes side effect on Some and returns original",
  async () => {
    let seen = 0;
    const result = await pipe(
      TaskOption.some(5),
      TaskOption.tap((n: number) => {
        seen = n;
      }),
    )();
    assertStrictEquals(seen, 5);
    assertEquals(result, { kind: "Some", value: 5 });
  },
);

Deno.test("TaskOption.tap does not execute side effect on None", async () => {
  let called = false;
  await pipe(
    TaskOption.none(),
    TaskOption.tap(() => {
      called = true;
    }),
  )();
  assertStrictEquals(called, false);
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

Deno.test("TaskOption.filter keeps Some when predicate passes", async () => {
  assertEquals(
    await pipe(
      TaskOption.some(5),
      TaskOption.filter((n: number) => n > 3),
    )(),
    { kind: "Some", value: 5 },
  );
});

Deno.test("TaskOption.filter returns None when predicate fails", async () => {
  assertEquals(
    await pipe(
      TaskOption.some(2),
      TaskOption.filter((n: number) => n > 3),
    )(),
    { kind: "None" },
  );
});

Deno.test("TaskOption.filter passes through None unchanged", async () => {
  assertEquals(
    await pipe(
      TaskOption.none<number>(),
      TaskOption.filter((_n) => true),
    )(),
    { kind: "None" },
  );
});

// ---------------------------------------------------------------------------
// toTaskResult
// ---------------------------------------------------------------------------

Deno.test("TaskOption.toTaskResult returns Ok for Some", async () => {
  assertEquals(
    await pipe(
      TaskOption.some(42),
      TaskOption.toTaskResult(() => "missing"),
    )(),
    { kind: "Ok", value: 42 },
  );
});

Deno.test(
  "TaskOption.toTaskResult returns Err for None using onNone",
  async () => {
    assertEquals(
      await pipe(
        TaskOption.none<number>(),
        TaskOption.toTaskResult(() => "missing"),
      )(),
      { kind: "Error", error: "missing" },
    );
  },
);

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("TaskOption composes well in a pipe chain", async () => {
  const result = await pipe(
    TaskOption.some(5),
    TaskOption.map((n: number) => n * 2),
    TaskOption.filter((n: number) => n > 5),
    TaskOption.chain((n: number) => TaskOption.some(n + 1)),
    TaskOption.getOrElse(() => 0),
  )();
  assertStrictEquals(result, 11);
});

Deno.test("TaskOption pipe short-circuits on None", async () => {
  const result = await pipe(
    TaskOption.some(2),
    TaskOption.filter((n: number) => n > 5),
    TaskOption.map((n: number) => n * 10),
    TaskOption.getOrElse(() => 0),
  )();
  assertStrictEquals(result, 0);
});
