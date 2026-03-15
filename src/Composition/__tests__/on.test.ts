import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { on } from "../on.ts";
import { pipe } from "../pipe.ts";

Deno.test("on - projects both arguments before calling the binary function", () => {
  const compareByLength = on((a: number, b: number) => a - b, (s: string) => s.length);

  assertStrictEquals(compareByLength("hi", "hello"), -3);
});

Deno.test("on - sorts strings by length", () => {
  const byLength = on((a: number, b: number) => a - b, (s: string) => s.length);

  const result = ["banana", "fig", "apple"].sort(byLength);

  assertEquals(result, ["fig", "apple", "banana"]);
});

Deno.test("on - sorts objects by a numeric field", () => {
  type Product = { name: string; price: number };
  const byPrice = on((a: number, b: number) => a - b, (p: Product) => p.price);

  const products: Product[] = [
    { name: "Chair", price: 120 },
    { name: "Desk", price: 350 },
    { name: "Lamp", price: 45 },
  ];

  const result = [...products].sort(byPrice).map((p) => p.name);

  assertEquals(result, ["Lamp", "Chair", "Desk"]);
});

Deno.test("on - checks equality after projection", () => {
  const sameLength = on((a: number, b: number) => a === b, (s: string) => s.length);

  assertStrictEquals(sameLength("cat", "dog"), true);
  assertStrictEquals(sameLength("cat", "elephant"), false);
});

Deno.test("on - projection is applied to both arguments independently", () => {
  const seen: string[] = [];
  const track = on(
    (a: number, b: number) => a - b,
    (s: string) => {
      seen.push(s);
      return s.length;
    },
  );

  track("hi", "hello");

  assertEquals(seen, ["hi", "hello"]);
});

Deno.test("on - works in a pipe chain", () => {
  const byLength = on((a: number, b: number) => a - b, (s: string) => s.length);

  const result = pipe(
    ["banana", "fig", "apple"],
    (arr) => [...arr].sort(byLength),
  );

  assertEquals(result, ["fig", "apple", "banana"]);
});
