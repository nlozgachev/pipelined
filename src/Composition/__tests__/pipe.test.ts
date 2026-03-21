import { assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { pipe } from "../pipe.ts";
import { Option } from "../../Core/Option.ts";
import { Result } from "../../Core/Result.ts";

Deno.test("pipe - single value (identity)", () => {
  assertStrictEquals(pipe(42), 42);
  assertStrictEquals(pipe("hello"), "hello");
  assertStrictEquals(pipe(true), true);
  assertStrictEquals(pipe(null), null);
  assertStrictEquals(pipe(undefined), undefined);
});

Deno.test("pipe - single function transformation", () => {
  const result = pipe(5, (n: number) => n * 2);
  assertStrictEquals(result, 10);
});

Deno.test("pipe - two function transformations", () => {
  const result = pipe(
    5,
    (n: number) => n * 2,
    (n: number) => n + 1,
  );
  assertStrictEquals(result, 11);
});

Deno.test("pipe - three function transformations", () => {
  const result = pipe(
    "hello",
    (s: string) => s.toUpperCase(),
    (s: string) => s + "!",
    (s: string) => s.length,
  );
  assertStrictEquals(result, 6);
});

Deno.test("pipe - type preservation through number chain", () => {
  const result = pipe(
    10,
    (n: number) => n / 2,
    (n: number) => n + 0.5,
  );
  assertStrictEquals(result, 5.5);
});

Deno.test("pipe - type transformation through chain", () => {
  const result = pipe(
    42,
    (n: number) => String(n),
    (s: string) => s.split(""),
    (arr: string[]) => arr.length,
  );
  assertStrictEquals(result, 2);
});

Deno.test("pipe - integration with Option.map", () => {
  const result = pipe(
    Option.some(5),
    Option.map((n: number) => n * 2),
    Option.map((n: number) => n + 1),
    Option.getOrElse(() => 0),
  );
  assertStrictEquals(result, 11);
});

Deno.test("pipe - integration with Option.map on None", () => {
  const result = pipe(
    Option.none() as Option<number>,
    Option.map((n: number) => n * 2),
    Option.getOrElse(() => 0),
  );
  assertStrictEquals(result, 0);
});

Deno.test("pipe - integration with Result.map on Ok", () => {
  const result = pipe(
    Result.ok<number>(10),
    Result.map((n: number) => n * 3),
    Result.getOrElse(() => 0),
  );
  assertStrictEquals(result, 30);
});

Deno.test("pipe - integration with Result.map on Err", () => {
  const result = pipe(
    Result.err("oops") as Result<string, number>,
    Result.map((n: number) => n * 3),
    Result.getOrElse(() => 0),
  );
  assertStrictEquals(result, 0);
});

Deno.test("pipe - works with objects", () => {
  const result = pipe(
    { name: "Alice", age: 30 },
    (user) => user.name,
    (name) => name.toUpperCase(),
  );
  assertStrictEquals(result, "ALICE");
});

Deno.test("pipe - works with arrays", () => {
  const result = pipe(
    [1, 2, 3, 4, 5],
    (arr) => arr.filter((n) => n % 2 === 0),
    (arr) => arr.reduce((a, b) => a + b, 0),
  );
  assertStrictEquals(result, 6);
});
