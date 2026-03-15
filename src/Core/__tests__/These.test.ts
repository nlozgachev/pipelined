import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { These, TheseBoth } from "../These.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// first / second / both
// ---------------------------------------------------------------------------

Deno.test("These.first creates a These with only a first value", () => {
  assertEquals(These.first(42), { kind: "First", first: 42 });
});

Deno.test("These.second creates a These with only a second value", () => {
  assertEquals(These.second("oops"), { kind: "Second", second: "oops" });
});

Deno.test("These.both creates a These with both values", () => {
  const result: TheseBoth<number, string> = These.both(42, "warn");
  assertEquals(result, { kind: "Both", first: 42, second: "warn" });
});

// ---------------------------------------------------------------------------
// isFirst / isSecond / isBoth
// ---------------------------------------------------------------------------

Deno.test("These.isFirst returns true for First", () => {
  assertStrictEquals(These.isFirst(These.first(1)), true);
});

Deno.test("These.isFirst returns false for Second", () => {
  assertStrictEquals(These.isFirst(These.second("e")), false);
});

Deno.test("These.isFirst returns false for Both", () => {
  assertStrictEquals(These.isFirst(These.both(1, "w")), false);
});

Deno.test("These.isSecond returns true for Second", () => {
  assertStrictEquals(These.isSecond(These.second("e")), true);
});

Deno.test("These.isSecond returns false for First", () => {
  assertStrictEquals(These.isSecond(These.first(1)), false);
});

Deno.test("These.isSecond returns false for Both", () => {
  assertStrictEquals(These.isSecond(These.both(1, "w")), false);
});

Deno.test("These.isBoth returns true for Both", () => {
  assertStrictEquals(These.isBoth(These.both(1, "w")), true);
});

Deno.test("These.isBoth returns false for First", () => {
  assertStrictEquals(These.isBoth(These.first(1)), false);
});

Deno.test("These.isBoth returns false for Second", () => {
  assertStrictEquals(These.isBoth(These.second("e")), false);
});

// ---------------------------------------------------------------------------
// hasFirst / hasSecond
// ---------------------------------------------------------------------------

Deno.test("These.hasFirst returns true for First", () => {
  assertStrictEquals(These.hasFirst(These.first(1)), true);
});

Deno.test("These.hasFirst returns true for Both", () => {
  assertStrictEquals(These.hasFirst(These.both(1, "w")), true);
});

Deno.test("These.hasFirst returns false for Second", () => {
  assertStrictEquals(These.hasFirst(These.second("e")), false);
});

Deno.test("These.hasSecond returns true for Second", () => {
  assertStrictEquals(These.hasSecond(These.second("e")), true);
});

Deno.test("These.hasSecond returns true for Both", () => {
  assertStrictEquals(These.hasSecond(These.both(1, "w")), true);
});

Deno.test("These.hasSecond returns false for First", () => {
  assertStrictEquals(These.hasSecond(These.first(1)), false);
});

// ---------------------------------------------------------------------------
// mapFirst
// ---------------------------------------------------------------------------

Deno.test("These.mapFirst transforms First value", () => {
  assertEquals(
    pipe(These.first(5), These.mapFirst((n: number) => n * 2)),
    { kind: "First", first: 10 },
  );
});

Deno.test("These.mapFirst transforms first value inside Both", () => {
  assertEquals(
    pipe(These.both(5, "warn"), These.mapFirst((n: number) => n * 2)),
    { kind: "Both", first: 10, second: "warn" },
  );
});

Deno.test("These.mapFirst passes through Second unchanged", () => {
  assertEquals(
    pipe(These.second<string>("err"), These.mapFirst((n: number) => n * 2)),
    { kind: "Second", second: "err" },
  );
});

// ---------------------------------------------------------------------------
// mapSecond
// ---------------------------------------------------------------------------

Deno.test("These.mapSecond transforms Second value", () => {
  assertEquals(
    pipe(These.second("warn"), These.mapSecond((e: string) => e.toUpperCase())),
    { kind: "Second", second: "WARN" },
  );
});

Deno.test("These.mapSecond transforms second value inside Both", () => {
  assertEquals(
    pipe(These.both(5, "warn"), These.mapSecond((e: string) => e.toUpperCase())),
    { kind: "Both", first: 5, second: "WARN" },
  );
});

Deno.test("These.mapSecond passes through First unchanged", () => {
  assertEquals(
    pipe(These.first<number>(5), These.mapSecond((e: string) => e.toUpperCase())),
    { kind: "First", first: 5 },
  );
});

// ---------------------------------------------------------------------------
// mapBoth
// ---------------------------------------------------------------------------

Deno.test("These.mapBoth maps the first side for First", () => {
  assertEquals(
    pipe(
      These.first(5),
      These.mapBoth(
        (n: number) => n * 2,
        (e: string) => e.toUpperCase(),
      ),
    ),
    { kind: "First", first: 10 },
  );
});

Deno.test("These.mapBoth maps the second side for Second", () => {
  assertEquals(
    pipe(
      These.second("warn"),
      These.mapBoth(
        (n: number) => n * 2,
        (e: string) => e.toUpperCase(),
      ),
    ),
    { kind: "Second", second: "WARN" },
  );
});

Deno.test("These.mapBoth maps both sides for Both", () => {
  assertEquals(
    pipe(
      These.both(5, "warn"),
      These.mapBoth(
        (n: number) => n * 2,
        (e: string) => e.toUpperCase(),
      ),
    ),
    { kind: "Both", first: 10, second: "WARN" },
  );
});

// ---------------------------------------------------------------------------
// chainFirst
// ---------------------------------------------------------------------------

Deno.test("These.chainFirst applies function to First value", () => {
  assertEquals(
    pipe(
      These.first(5),
      These.chainFirst((n: number) => These.first(n * 2)),
    ),
    { kind: "First", first: 10 },
  );
});

Deno.test("These.chainFirst propagates Second without calling function", () => {
  let called = false;
  pipe(
    These.second<string>("warn"),
    These.chainFirst((_n: number) => {
      called = true;
      return These.first(_n);
    }),
  );
  assertStrictEquals(called, false);
});

Deno.test("These.chainFirst on Both applies function to first value", () => {
  assertEquals(
    pipe(
      These.both(5, "warn"),
      These.chainFirst((n: number) => These.first(n * 2)),
    ),
    { kind: "First", first: 10 },
  );
});

Deno.test("These.chainFirst can change the first value type", () => {
  assertEquals(
    pipe(
      These.first(42),
      These.chainFirst((n: number) => These.first(`num: ${n}`)),
    ),
    { kind: "First", first: "num: 42" },
  );
});

// ---------------------------------------------------------------------------
// chainSecond
// ---------------------------------------------------------------------------

Deno.test("These.chainSecond applies function to Second value", () => {
  assertEquals(
    pipe(
      These.second("warn"),
      These.chainSecond((s: string) => These.second(s.toUpperCase())),
    ),
    { kind: "Second", second: "WARN" },
  );
});

Deno.test("These.chainSecond propagates First without calling function", () => {
  let called = false;
  pipe(
    These.first<number>(5),
    These.chainSecond((_s: string) => {
      called = true;
      return These.second(_s);
    }),
  );
  assertStrictEquals(called, false);
});

Deno.test("These.chainSecond on Both applies function to second value", () => {
  assertEquals(
    pipe(
      These.both(5, "warn"),
      These.chainSecond((s: string) => These.second(s.toUpperCase())),
    ),
    { kind: "Second", second: "WARN" },
  );
});

Deno.test("These.chainSecond can change the second value type", () => {
  assertEquals(
    pipe(
      These.second("warn"),
      These.chainSecond((s: string) => These.second(s.length)),
    ),
    { kind: "Second", second: 4 },
  );
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

Deno.test("These.fold calls onFirst for First", () => {
  assertStrictEquals(
    pipe(
      These.first(5),
      These.fold(
        (a: number) => `first:${a}`,
        (b: string) => `second:${b}`,
        (a: number, b: string) => `both:${a}/${b}`,
      ),
    ),
    "first:5",
  );
});

Deno.test("These.fold calls onSecond for Second", () => {
  assertStrictEquals(
    pipe(
      These.second("e"),
      These.fold(
        (a: number) => `first:${a}`,
        (b: string) => `second:${b}`,
        (a: number, b: string) => `both:${a}/${b}`,
      ),
    ),
    "second:e",
  );
});

Deno.test("These.fold calls onBoth for Both", () => {
  assertStrictEquals(
    pipe(
      These.both(5, "w"),
      These.fold(
        (a: number) => `first:${a}`,
        (b: string) => `second:${b}`,
        (a: number, b: string) => `both:${a}/${b}`,
      ),
    ),
    "both:5/w",
  );
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

Deno.test("These.match calls first handler for First", () => {
  assertStrictEquals(
    pipe(
      These.first(5),
      These.match({
        first: (a: number) => `first:${a}`,
        second: (b: string) => `second:${b}`,
        both: (a: number, b: string) => `both:${a}/${b}`,
      }),
    ),
    "first:5",
  );
});

Deno.test("These.match calls second handler for Second", () => {
  assertStrictEquals(
    pipe(
      These.second("e"),
      These.match({
        first: (a: number) => `first:${a}`,
        second: (b: string) => `second:${b}`,
        both: (a: number, b: string) => `both:${a}/${b}`,
      }),
    ),
    "second:e",
  );
});

Deno.test("These.match calls both handler for Both", () => {
  assertStrictEquals(
    pipe(
      These.both(5, "w"),
      These.match({
        first: (a: number) => `first:${a}`,
        second: (b: string) => `second:${b}`,
        both: (a: number, b: string) => `both:${a}/${b}`,
      }),
    ),
    "both:5/w",
  );
});

// ---------------------------------------------------------------------------
// getFirstOrElse / getSecondOrElse
// ---------------------------------------------------------------------------

Deno.test("These.getFirstOrElse returns first value for First", () => {
  assertStrictEquals(pipe(These.first(5), These.getFirstOrElse(0)), 5);
});

Deno.test("These.getFirstOrElse returns first value for Both", () => {
  assertStrictEquals(pipe(These.both(5, "w"), These.getFirstOrElse(0)), 5);
});

Deno.test("These.getFirstOrElse returns default for Second", () => {
  assertStrictEquals(pipe(These.second<string>("warn"), These.getFirstOrElse(0)), 0);
});

Deno.test("These.getFirstOrElse widens return type to A | C when default is a different type", () => {
  const result = pipe(These.second("warn"), These.getFirstOrElse(null));
  assertStrictEquals(result, null);
});

Deno.test("These.getFirstOrElse returns first value typed as A | C when present", () => {
  const result = pipe(These.first(5), These.getFirstOrElse(null));
  assertStrictEquals(result, 5);
});

Deno.test("These.getSecondOrElse returns second value for Second", () => {
  assertStrictEquals(pipe(These.second("warn"), These.getSecondOrElse("none")), "warn");
});

Deno.test("These.getSecondOrElse returns second value for Both", () => {
  assertStrictEquals(pipe(These.both(5, "warn"), These.getSecondOrElse("none")), "warn");
});

Deno.test("These.getSecondOrElse returns default for First", () => {
  assertStrictEquals(pipe(These.first<number>(5), These.getSecondOrElse("none")), "none");
});

Deno.test("These.getSecondOrElse widens return type to B | D when default is a different type", () => {
  const result = pipe(These.first(5), These.getSecondOrElse(null));
  assertStrictEquals(result, null);
});

Deno.test("These.getSecondOrElse returns second value typed as B | D when present", () => {
  const result = pipe(These.second("warn"), These.getSecondOrElse(null));
  assertStrictEquals(result, "warn");
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

Deno.test("These.tap executes side effect on First and returns original", () => {
  let seen = 0;
  const result = pipe(
    These.first(5),
    These.tap((n: number) => {
      seen = n;
    }),
  );
  assertStrictEquals(seen, 5);
  assertEquals(result, { kind: "First", first: 5 });
});

Deno.test("These.tap executes side effect on Both and returns original", () => {
  let seen = 0;
  const result = pipe(
    These.both(7, "w"),
    These.tap((n: number) => {
      seen = n;
    }),
  );
  assertStrictEquals(seen, 7);
  assertEquals(result, { kind: "Both", first: 7, second: "w" });
});

Deno.test("These.tap does not execute side effect on Second", () => {
  let called = false;
  pipe(
    These.second<string>("e"),
    These.tap((_n: number) => {
      called = true;
    }),
  );
  assertStrictEquals(called, false);
});

// ---------------------------------------------------------------------------
// swap
// ---------------------------------------------------------------------------

Deno.test("These.swap converts First to Second", () => {
  assertEquals(These.swap(These.first(5)), { kind: "Second", second: 5 });
});

Deno.test("These.swap converts Second to First", () => {
  assertEquals(These.swap(These.second("e")), { kind: "First", first: "e" });
});

Deno.test("These.swap swaps Both sides", () => {
  assertEquals(These.swap(These.both(5, "w")), {
    kind: "Both",
    first: "w",
    second: 5,
  });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("These composes well in a pipe chain", () => {
  const result = pipe(
    These.first(5),
    These.mapFirst((n: number) => n * 2),
    These.chainFirst((n: number) => n > 5 ? These.first(n) : These.second<string>("Too small")),
    These.getFirstOrElse(0),
  );
  assertStrictEquals(result, 10);
});

Deno.test("These chainFirst on Both discards second", () => {
  const result = pipe(
    These.both(5, "original warning"),
    These.mapFirst((n: number) => n + 1),
    These.chainFirst((n: number) => These.first(n * 2)),
  );
  assertEquals(result, { kind: "First", first: 12 });
});
