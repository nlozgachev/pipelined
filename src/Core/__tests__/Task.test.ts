import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Task } from "../Task.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// of
// ---------------------------------------------------------------------------

Deno.test(
  "Task.resolve creates a Task that resolves to the given value",
  async () => {
    const result = await Task.resolve(42)();
    assertStrictEquals(result, 42);
  },
);

// ---------------------------------------------------------------------------
// from
// ---------------------------------------------------------------------------

Deno.test(
  "Task.from creates a Task from a function returning a Promise",
  async () => {
    const task = Task.from(() => Promise.resolve(99));
    const result = await task();
    assertStrictEquals(result, 99);
  },
);

Deno.test("Task.from is lazy - does not execute until called", async () => {
  let executed = false;
  const task = Task.from(() => {
    executed = true;
    return Promise.resolve(1);
  });
  assertStrictEquals(executed, false);
  await task();
  assertStrictEquals(executed, true);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("Task.map transforms the resolved value", async () => {
  const result = await pipe(
    Task.resolve(5),
    Task.map((n: number) => n * 2),
  )();
  assertStrictEquals(result, 10);
});

Deno.test("Task.map can change the type", async () => {
  const result = await pipe(
    Task.resolve(42),
    Task.map((n: number) => `num: ${n}`),
  )();
  assertStrictEquals(result, "num: 42");
});

Deno.test("Task.map chains multiple transformations", async () => {
  const result = await pipe(
    Task.resolve(2),
    Task.map((n: number) => n + 3),
    Task.map((n: number) => n * 10),
  )();
  assertStrictEquals(result, 50);
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

Deno.test("Task.chain sequences async computations", async () => {
  const double = (n: number): Task<number> => Task.resolve(n * 2);
  const result = await pipe(Task.resolve(5), Task.chain(double))();
  assertStrictEquals(result, 10);
});

Deno.test(
  "Task.chain can create new Tasks based on previous result",
  async () => {
    const fetchById = (id: number): Task<string> => Task.resolve(`item-${id}`);

    const result = await pipe(Task.resolve(42), Task.chain(fetchById))();
    assertStrictEquals(result, "item-42");
  },
);

Deno.test("Task.chain composes multiple async steps", async () => {
  const result = await pipe(
    Task.resolve(1),
    Task.chain((n: number) => Task.resolve(n + 1)),
    Task.chain((n: number) => Task.resolve(n * 10)),
  )();
  assertStrictEquals(result, 20);
});

// ---------------------------------------------------------------------------
// ap (value first, function second)
// ---------------------------------------------------------------------------

Deno.test("Task.ap applies a Task function to a Task value", async () => {
  const add = (a: number) => (b: number) => a + b;
  const result = await pipe(
    Task.resolve(add),
    Task.ap(Task.resolve(5)),
    Task.ap(Task.resolve(3)),
  )();
  assertStrictEquals(result, 8);
});

Deno.test("Task.ap runs Tasks in parallel", async () => {
  const start = Date.now();
  const slowValue = Task.from(
    () => new Promise<number>((resolve) => setTimeout(() => resolve(10), 50)),
  );
  const slowFn = Task.from(
    () =>
      new Promise<(n: number) => number>((resolve) =>
        setTimeout(() => resolve((n: number) => n * 2), 50)
      ),
  );

  const result = await pipe(slowFn, Task.ap(slowValue))();
  const elapsed = Date.now() - start;

  assertStrictEquals(result, 20);
  // Both should run in parallel, so total time should be around 50ms, not 100ms
  // Using 90ms as a generous upper bound
  assertStrictEquals(elapsed < 90, true);
});

Deno.test("Task.ap with single argument function", async () => {
  const double = (n: number) => n * 2;
  const result = await pipe(Task.resolve(double), Task.ap(Task.resolve(7)))();
  assertStrictEquals(result, 14);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

Deno.test(
  "Task.tap executes side effect and returns original value",
  async () => {
    let sideEffect = 0;
    const result = await pipe(
      Task.resolve(5),
      Task.tap((n: number) => {
        sideEffect = n;
      }),
    )();
    assertStrictEquals(sideEffect, 5);
    assertStrictEquals(result, 5);
  },
);

Deno.test("Task.tap does not alter the resolved value", async () => {
  const result = await pipe(
    Task.resolve("hello"),
    Task.tap(() => {
      // side effect that doesn't affect the value
    }),
    Task.map((s: string) => s.toUpperCase()),
  )();
  assertStrictEquals(result, "HELLO");
});

// ---------------------------------------------------------------------------
// all
// ---------------------------------------------------------------------------

Deno.test(
  "Task.all runs multiple Tasks in parallel and collects results",
  async () => {
    const result = await Task.all(
      [
        Task.resolve(1),
        Task.resolve("two"),
        Task.resolve(true),
      ] as const,
    )();
    assertEquals(result, [1, "two", true]);
  },
);

Deno.test("Task.all with empty array returns empty array", async () => {
  const result = await Task.all([] as const)();
  assertEquals(result, []);
});

Deno.test(
  "Task.all preserves order regardless of completion time",
  async () => {
    const slow = Task.from(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 50)),
    );
    const fast = Task.from(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("fast"), 10)),
    );

    const result = await Task.all([slow, fast] as const)();
    assertEquals(result, ["slow", "fast"]);
  },
);

Deno.test("Task.all runs Tasks in parallel (not sequentially)", async () => {
  const start = Date.now();
  const t1 = Task.from(
    () => new Promise<number>((resolve) => setTimeout(() => resolve(1), 50)),
  );
  const t2 = Task.from(
    () => new Promise<number>((resolve) => setTimeout(() => resolve(2), 50)),
  );
  const t3 = Task.from(
    () => new Promise<number>((resolve) => setTimeout(() => resolve(3), 50)),
  );

  const result = await Task.all([t1, t2, t3] as const)();
  const elapsed = Date.now() - start;

  assertEquals(result, [1, 2, 3]);
  // All 3 should run in ~50ms parallel, not 150ms sequential
  assertStrictEquals(elapsed < 100, true);
});

// ---------------------------------------------------------------------------
// delay
// ---------------------------------------------------------------------------

Deno.test("Task.delay delays the execution of a Task", async () => {
  const start = Date.now();
  const result = await pipe(Task.resolve(42), Task.delay(50))();
  const elapsed = Date.now() - start;

  assertStrictEquals(result, 42);
  assertStrictEquals(elapsed >= 40, true); // allow small timing variance
});

Deno.test("Task.delay with 0ms behaves like setTimeout(fn, 0)", async () => {
  const result = await pipe(Task.resolve("instant"), Task.delay(0))();
  assertStrictEquals(result, "instant");
});

Deno.test("Task.delay preserves the Task value after delay", async () => {
  const result = await pipe(
    Task.resolve(5),
    Task.delay(30),
    Task.map((n: number) => n * 2),
  )();
  assertStrictEquals(result, 10);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("Task composes well in a pipe chain", async () => {
  const result = await pipe(
    Task.resolve(5),
    Task.map((n: number) => n * 2),
    Task.chain((n: number) => Task.resolve(n + 1)),
    Task.map((n: number) => `result: ${n}`),
  )();
  assertStrictEquals(result, "result: 11");
});

Deno.test("Task is lazy and only executes when invoked", () => {
  let executed = false;
  const _task = pipe(
    Task.resolve(1),
    Task.map((_n: number) => {
      executed = true;
      return _n;
    }),
  );
  // Task not invoked yet
  assertStrictEquals(executed, false);
  // Clean up: don't actually invoke it
});

// ---------------------------------------------------------------------------
// race
// ---------------------------------------------------------------------------

Deno.test({
  name: "Task.race resolves with the fastest Task",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const fast = Task.from<string>(
      () => new Promise((r) => setTimeout(() => r("fast"), 10)),
    );
    const slow = Task.from<string>(
      () => new Promise((r) => setTimeout(() => r("slow"), 100)),
    );
    const result = await Task.race([fast, slow])();
    assertStrictEquals(result, "fast");
  },
});

Deno.test({
  name: "Task.race resolves immediately when a resolved Task is included",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const immediate = Task.resolve("immediate");
    const slow = Task.from<string>(
      () => new Promise((r) => setTimeout(() => r("slow"), 100)),
    );
    const result = await Task.race([slow, immediate])();
    assertStrictEquals(result, "immediate");
  },
});

Deno.test("Task.race with a single Task resolves to its value", async () => {
  const result = await Task.race([Task.resolve(42)])();
  assertStrictEquals(result, 42);
});

Deno.test({
  name: "Task.race starts all Tasks immediately (parallel, not sequential)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const start = Date.now();
    const t1 = Task.from<number>(
      () => new Promise((r) => setTimeout(() => r(1), 50)),
    );
    const t2 = Task.from<number>(
      () => new Promise((r) => setTimeout(() => r(2), 10)),
    );
    const result = await Task.race([t1, t2])();
    const elapsed = Date.now() - start;
    assertStrictEquals(result, 2);
    assertStrictEquals(elapsed < 45, true); // would be ~50ms if sequential
  },
});

// ---------------------------------------------------------------------------
// sequential
// ---------------------------------------------------------------------------

Deno.test("Task.sequential runs Tasks in order and collects results", async () => {
  const result = await Task.sequential([
    Task.resolve(1),
    Task.resolve(2),
    Task.resolve(3),
  ])();
  assertEquals(result, [1, 2, 3]);
});

Deno.test("Task.sequential with empty array returns empty array", async () => {
  const result = await Task.sequential([])();
  assertEquals(result, []);
});

Deno.test({
  name: "Task.sequential executes each Task only after the previous resolves",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const order: number[] = [];
    const makeTask = (n: number, ms: number) =>
      Task.from<number>(() =>
        new Promise((r) =>
          setTimeout(() => {
            order.push(n);
            r(n);
          }, ms)
        )
      );

    await Task.sequential([
      makeTask(1, 30),
      makeTask(2, 10),
      makeTask(3, 20),
    ])();
    assertEquals(order, [1, 2, 3]);
  },
});

Deno.test("Task.sequential with a single Task returns single-element array", async () => {
  const result = await Task.sequential([Task.resolve(99)])();
  assertEquals(result, [99]);
});

// ---------------------------------------------------------------------------
// timeout
// ---------------------------------------------------------------------------

Deno.test(
  "Task.timeout returns Ok when task resolves before timeout",
  async () => {
    const result = await pipe(
      Task.resolve(42),
      Task.timeout(100, () => "timed out"),
    )();
    assertEquals(result, { kind: "Ok", value: 42 });
  },
);

Deno.test({
  name: "Task.timeout returns Err when task exceeds timeout",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const slow = Task.from<number>(
      () => new Promise((r) => setTimeout(() => r(42), 200)),
    );
    const result = await pipe(
      slow,
      Task.timeout(10, () => "timed out"),
    )();
    assertEquals(result, { kind: "Error", error: "timed out" });
  },
});

Deno.test({
  name: "Task.timeout uses the onTimeout return value as the error",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const slow = Task.from<number>(
      () => new Promise((r) => setTimeout(() => r(42), 200)),
    );
    const error = new Error("request timed out");
    const result = await pipe(
      slow,
      Task.timeout(10, () => error),
    )();
    assertEquals(result, { kind: "Error", error });
  },
});

// ---------------------------------------------------------------------------
// repeat
// ---------------------------------------------------------------------------

Deno.test("Task.repeat runs the task the given number of times", async () => {
  let calls = 0;
  const task = Task.from(() => {
    calls++;
    return Promise.resolve(calls);
  });
  const result = await pipe(task, Task.repeat({ times: 3 }))();
  assertEquals(result, [1, 2, 3]);
  assertStrictEquals(calls, 3);
});

Deno.test(
  "Task.repeat with times: 1 runs once and returns single-element array",
  async () => {
    const result = await pipe(Task.resolve(42), Task.repeat({ times: 1 }))();
    assertEquals(result, [42]);
  },
);

Deno.test(
  "Task.repeat with times: 0 returns empty array without running",
  async () => {
    let calls = 0;
    const task = Task.from(() => {
      calls++;
      return Promise.resolve(42);
    });
    const result = await pipe(task, Task.repeat({ times: 0 }))();
    assertEquals(result, []);
    assertStrictEquals(calls, 0);
  },
);

Deno.test("Task.repeat collects results in order", async () => {
  let n = 0;
  const task = Task.from(() => Promise.resolve(n++));
  const result = await pipe(task, Task.repeat({ times: 4 }))();
  assertEquals(result, [0, 1, 2, 3]);
});

Deno.test(
  "Task.repeat inserts delay between runs but not after the last",
  async () => {
    const start = Date.now();
    await pipe(Task.resolve(1), Task.repeat({ times: 3, delay: 30 }))();
    const elapsed = Date.now() - start;
    // 3 runs = 2 delays = ~60ms; allow generous bounds
    assertStrictEquals(elapsed >= 50, true);
    assertStrictEquals(elapsed < 120, true);
  },
);

// ---------------------------------------------------------------------------
// repeatUntil
// ---------------------------------------------------------------------------

Deno.test(
  "Task.repeatUntil returns immediately when predicate holds on first run",
  async () => {
    let calls = 0;
    const task = Task.from(() => {
      calls++;
      return Promise.resolve(42);
    });
    const result = await pipe(
      task,
      Task.repeatUntil({ when: (n) => n === 42 }),
    )();
    assertStrictEquals(result, 42);
    assertStrictEquals(calls, 1);
  },
);

Deno.test("Task.repeatUntil keeps running until predicate holds", async () => {
  let calls = 0;
  const task = Task.from(() => {
    calls++;
    return Promise.resolve(calls);
  });
  const result = await pipe(task, Task.repeatUntil({ when: (n) => n === 3 }))();
  assertStrictEquals(result, 3);
  assertStrictEquals(calls, 3);
});

Deno.test(
  "Task.repeatUntil returns the value that satisfied the predicate",
  async () => {
    const values = ["a", "b", "stop", "c"];
    let i = 0;
    const task = Task.from(() => Promise.resolve(values[i++]));
    const result = await pipe(
      task,
      Task.repeatUntil({ when: (s) => s === "stop" }),
    )();
    assertStrictEquals(result, "stop");
  },
);

Deno.test("Task.repeatUntil inserts delay between runs", async () => {
  let calls = 0;
  const task = Task.from(() => {
    calls++;
    return Promise.resolve(calls);
  });
  const start = Date.now();
  await pipe(task, Task.repeatUntil({ when: (n) => n === 3, delay: 30 }))();
  const elapsed = Date.now() - start;
  // 3 runs = 2 delays = ~60ms
  assertStrictEquals(elapsed >= 50, true);
  assertStrictEquals(elapsed < 120, true);
});
