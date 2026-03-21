import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Deferred } from "../Deferred.ts";

// ---------------------------------------------------------------------------
// fromPromise
// ---------------------------------------------------------------------------

Deno.test("Deferred.fromPromise resolves to the value of the Promise", async () => {
  const d = Deferred.fromPromise(Promise.resolve(42));
  const result = await d;
  assertEquals(result, 42);
});

Deno.test("Deferred.fromPromise works with async resolution", async () => {
  const d = Deferred.fromPromise(
    new Promise<string>((resolve) => setTimeout(() => resolve("done"), 10)),
  );
  const result = await d;
  assertEquals(result, "done");
});

// ---------------------------------------------------------------------------
// then is one-shot (returns void)
// ---------------------------------------------------------------------------

Deno.test("Deferred.then calls the callback with the resolved value", async () => {
  let captured: number | undefined;
  const d = Deferred.fromPromise(Promise.resolve(99));
  d.then((v) => {
    captured = v;
  });
  await d;
  assertEquals(captured, 99);
});

// ---------------------------------------------------------------------------
// await
// ---------------------------------------------------------------------------

Deno.test("Deferred can be awaited in an async function", async () => {
  const result = await Deferred.fromPromise(Promise.resolve("hello"));
  assertEquals(result, "hello");
});

// ---------------------------------------------------------------------------
// toPromise
// ---------------------------------------------------------------------------

Deno.test("Deferred.toPromise resolves to the Deferred value", async () => {
  const d = Deferred.fromPromise(Promise.resolve(42));
  const result = await Deferred.toPromise(d);
  assertStrictEquals(result, 42);
});

Deno.test("Deferred.toPromise roundtrips with fromPromise", async () => {
  const original = Promise.resolve("roundtrip");
  const result = await Deferred.toPromise(Deferred.fromPromise(original));
  assertStrictEquals(result, "roundtrip");
});

Deno.test("Deferred.toPromise rejects when the underlying Promise rejects", async () => {
  const d = Deferred.fromPromise(Promise.reject(new Error("boom")));
  let threw = false;
  try {
    await Deferred.toPromise(d);
  } catch {
    threw = true;
  }
  assertStrictEquals(threw, true);
});
