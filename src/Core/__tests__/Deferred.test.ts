import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Deferred } from "../Deferred.ts";

// --- fromPromise ---

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

// --- then is one-shot (returns void) ---

test("Deferred.then calls the callback with the resolved value", async () => {
	let captured: number | undefined;
	const d = Deferred.from.Promise(Promise.resolve(99));
	d.then((v) => {
		captured = v;
	});
	await d;
	expect(captured).toBe(99);
});

// --- side-effect isolation ---

test("Deferred.then executes side effect callback when resolved", async () => {
	let called = false;
	const d = Deferred.from.Promise(Promise.resolve(42));
	d.then(() => {
		called = true;
	});
	await d;
	expect(called).toBe(true);
});

test("Deferred.then does not execute side effect callback before resolution", () => {
	let called = false;
	let resolveFn!: (v: number) => void;
	const promise = new Promise<number>((r) => {
		resolveFn = r;
	});
	const d = Deferred.from.Promise(promise);
	d.then(() => {
		called = true;
	});
	expect(called).toBe(false);
	resolveFn(42);
});

// --- await ---

test("deferred can be awaited in an async function", async () => {
	const result = await Deferred.from.Promise(Promise.resolve("hello"));
	expect(result).toBe("hello");
});

// --- toPromise ---

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

// --- all & race ---

test("Deferred.all combines multiple Deferreds into a single Deferred tuple", async () => {
	const d1 = Deferred.from.Promise(Promise.resolve(1));
	const d2 = Deferred.from.Promise(Promise.resolve("a"));
	const result = await Deferred.all([d1, d2]);
	expect(result).toStrictEqual([1, "a"]);
});

test("Deferred.race resolves with the first settled Deferred", async () => {
	const d1 = Deferred.from.Promise(new Promise<number>((r) => setTimeout(() => r(1), 50)));
	const d2 = Deferred.from.Promise(new Promise<number>((r) => setTimeout(() => r(2), 5)));
	const result = await Deferred.race([d1, d2]);
	expect(result).toBe(2);
});

// --- pipe composition ---

test("Deferred composes in a pipe with from.Promise and to.Promise", async () => {
	const result = await pipe(Promise.resolve(42), Deferred.from.Promise, Deferred.to.Promise);
	expect(result).toBe(42);
});

test("Deferred.all composes in a pipe chain", async () => {
	const result = await pipe(
		[Deferred.from.Promise(Promise.resolve("a")), Deferred.from.Promise(Promise.resolve("b"))],
		Deferred.all,
		Deferred.to.Promise,
	);
	expect(result).toStrictEqual(["a", "b"]);
});
