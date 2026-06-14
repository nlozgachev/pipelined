import { Deferred } from "#core";
import { expect, test } from "vitest";

// ---------------------------------------------------------------------------
// fromPromise
// ---------------------------------------------------------------------------

test("Deferred.from.Promise resolves to the value of the Promise", async () => {
	const d = Deferred.from.Promise(Promise.resolve(42));
	const result = await d;
	expect(result).toBe(42);
});

test("Deferred.from.Promise works with async resolution", async () => {
	const d = Deferred.from.Promise(new Promise<string>((resolve) => setTimeout(() => resolve("done"), 10)));
	const result = await d;
	expect(result).toBe("done");
});

// ---------------------------------------------------------------------------
// then is one-shot (returns void)
// ---------------------------------------------------------------------------

test("Deferred.then calls the callback with the resolved value", async () => {
	let captured: number | undefined;
	const d = Deferred.from.Promise(Promise.resolve(99));
	d.then((v) => {
		captured = v;
	});
	await d;
	expect(captured).toBe(99);
});

// ---------------------------------------------------------------------------
// await
// ---------------------------------------------------------------------------

test("deferred can be awaited in an async function", async () => {
	const result = await Deferred.from.Promise(Promise.resolve("hello"));
	expect(result).toBe("hello");
});

// ---------------------------------------------------------------------------
// toPromise
// ---------------------------------------------------------------------------

test("Deferred.to.Promise resolves to the Deferred value", async () => {
	const d = Deferred.from.Promise(Promise.resolve(42));
	const result = await Deferred.to.Promise(d);
	expect(result).toBe(42);
});

test("Deferred.to.Promise roundtrips with fromPromise", async () => {
	const original = Promise.resolve("roundtrip");
	const result = await Deferred.to.Promise(Deferred.from.Promise(original));
	expect(result).toBe("roundtrip");
});
