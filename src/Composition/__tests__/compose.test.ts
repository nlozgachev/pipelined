import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { compose } from "../compose.ts";
import { Option } from "../../Core/Option.ts";
import { Result } from "../../Core/Result.ts";

Deno.test("compose - single function acts as wrapper", () => {
  const double = compose((n: number) => n * 2);
  assertStrictEquals(double(5), 10);
});

Deno.test("compose - two functions execute right-to-left", () => {
  const addOne = (n: number) => n + 1;
  const double = (n: number) => n * 2;

  // compose(addOne, double) => addOne(double(x))
  const fn = compose(addOne, double);
  assertStrictEquals(fn(5), 11); // 5 * 2 + 1 = 11
});

Deno.test("compose - three functions execute right-to-left", () => {
  const toString = (n: number) => `Value: ${n}`;
  const addOne = (n: number) => n + 1;
  const double = (n: number) => n * 2;

  // compose(toString, addOne, double) => toString(addOne(double(x)))
  const fn = compose(toString, addOne, double);
  assertStrictEquals(fn(5), "Value: 11"); // 5 * 2 + 1 = 11 => "Value: 11"
});

Deno.test("compose - right-to-left order confirmed", () => {
  const log: string[] = [];
  const a = (n: number) => {
    log.push("a");
    return n + 1;
  };
  const b = (n: number) => {
    log.push("b");
    return n * 2;
  };
  const c = (n: number) => {
    log.push("c");
    return n + 10;
  };

  const fn = compose(a, b, c);
  const result = fn(5);

  // c runs first: 5 + 10 = 15
  // b runs second: 15 * 2 = 30
  // a runs third: 30 + 1 = 31
  assertStrictEquals(result, 31);
  assertEquals(log, ["c", "b", "a"]);
});

Deno.test("compose - type transformation across functions", () => {
  const length = (s: string) => s.length;
  const toUpper = (s: string) => s.toUpperCase();

  const fn = compose(length, toUpper);
  assertStrictEquals(fn("hello"), 5);
});

Deno.test("compose - integration with Option", () => {
  const getOrDefault = Option.getOrElse(() => "none");
  const toUpper = Option.map((s: string) => s.toUpperCase());

  const fn = compose(getOrDefault, toUpper);

  assertStrictEquals(fn(Option.some("hello")), "HELLO");
  assertStrictEquals(fn(Option.none()), "none");
});

Deno.test("compose - integration with Result", () => {
  const getOrDefault = Result.getOrElse(() => 0);
  const doubleResult = Result.map((n: number) => n * 2);

  const fn = compose(getOrDefault, doubleResult);

  assertStrictEquals(fn(Result.ok<number>(5)), 10);
  assertStrictEquals(fn(Result.err("err") as Result<string, number>), 0);
});

Deno.test("compose - composed function is reusable", () => {
  const increment = (n: number) => n + 1;
  const triple = (n: number) => n * 3;

  const fn = compose(increment, triple);
  assertStrictEquals(fn(1), 4);
  assertStrictEquals(fn(2), 7);
  assertStrictEquals(fn(10), 31);
});
