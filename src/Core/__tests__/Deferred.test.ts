import { expect, test } from "vitest";
import { Deferred } from "../Deferred.ts";

// ---------------------------------------------------------------------------
// fromPromise
// ---------------------------------------------------------------------------

test("Deferred.fromPromise resolves to the value of the Promise", async () => {
	const d = Deferred.fromPromise(Promise.resolve(42));
	const result = await d;
	expect(result).toBe(42);
});

test("Deferred.fromPromise works with async resolution", async () => {
	const d = Deferred.fromPromise(
		new Promise<string>((resolve) => setTimeout(() => resolve("done"), 10)),
	);
	const result = await d;
	expect(result).toBe("done");
});

// ---------------------------------------------------------------------------
// then is one-shot (returns void)
// ---------------------------------------------------------------------------

test("Deferred.then calls the callback with the resolved value", async () => {
	let captured: number | undefined;
	const d = Deferred.fromPromise(Promise.resolve(99));
	d.then((v) => {
		captured = v;
	});
	await d;
	expect(captured).toBe(99);
});

// ---------------------------------------------------------------------------
// await
// ---------------------------------------------------------------------------

test("Deferred can be awaited in an async function", async () => {
	const result = await Deferred.fromPromise(Promise.resolve("hello"));
	expect(result).toBe("hello");
});

// ---------------------------------------------------------------------------
// toPromise
// ---------------------------------------------------------------------------

test("Deferred.toPromise resolves to the Deferred value", async () => {
	const d = Deferred.fromPromise(Promise.resolve(42));
	const result = await Deferred.toPromise(d);
	expect(result).toBe(42);
});

test("Deferred.toPromise roundtrips with fromPromise", async () => {
	const original = Promise.resolve("roundtrip");
	const result = await Deferred.toPromise(Deferred.fromPromise(original));
	expect(result).toBe("roundtrip");
});

test("Deferred.toPromise rejects when the underlying Promise rejects", async () => {
	const d = Deferred.fromPromise(Promise.reject(new Error("boom")));
	let threw = false;
	try {
		await Deferred.toPromise(d);
	} catch {
		threw = true;
	}
	expect(threw).toBe(true);
});

test("Deferred.toPromise fallback — uses .then when deferred not in store", async () => {
	const fakeDeferred = {
		then: (f: (v: number) => void) => f(77),
	} as unknown as Deferred<number>;
	const result = await Deferred.toPromise(fakeDeferred);
	expect(result).toBe(77);
});
