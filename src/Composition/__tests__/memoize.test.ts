import { assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { memoize, memoizeWeak } from "../memoize.ts";

// --- memoize ---

Deno.test("memoize - cache hit: function not called again", () => {
	let callCount = 0;
	const expensive = memoize((n: number) => {
		callCount++;
		return n * 2;
	});

	assertStrictEquals(expensive(5), 10);
	assertStrictEquals(callCount, 1);

	assertStrictEquals(expensive(5), 10);
	assertStrictEquals(callCount, 1); // not called again
});

Deno.test("memoize - different arguments compute separately", () => {
	let callCount = 0;
	const expensive = memoize((n: number) => {
		callCount++;
		return n * 2;
	});

	assertStrictEquals(expensive(5), 10);
	assertStrictEquals(expensive(3), 6);
	assertStrictEquals(expensive(7), 14);
	assertStrictEquals(callCount, 3);

	// Cached calls
	assertStrictEquals(expensive(5), 10);
	assertStrictEquals(expensive(3), 6);
	assertStrictEquals(callCount, 3); // no additional calls
});

Deno.test("memoize - caches string arguments", () => {
	let callCount = 0;
	const toUpper = memoize((s: string) => {
		callCount++;
		return s.toUpperCase();
	});

	assertStrictEquals(toUpper("hello"), "HELLO");
	assertStrictEquals(toUpper("hello"), "HELLO");
	assertStrictEquals(callCount, 1);

	assertStrictEquals(toUpper("world"), "WORLD");
	assertStrictEquals(callCount, 2);
});

Deno.test("memoize - custom key function", () => {
	let callCount = 0;
	const getLabel = memoize(
		(opts: { id: number; label: string }) => {
			callCount++;
			return opts.label.toUpperCase();
		},
		(opts) => opts.id,
	);

	assertStrictEquals(getLabel({ id: 1, label: "hello" }), "HELLO");
	assertStrictEquals(callCount, 1);

	// Same id, different label object -- should use cache
	assertStrictEquals(getLabel({ id: 1, label: "different" }), "HELLO");
	assertStrictEquals(callCount, 1);

	// Different id -- should compute
	assertStrictEquals(getLabel({ id: 2, label: "world" }), "WORLD");
	assertStrictEquals(callCount, 2);
});

Deno.test("memoize - default key uses argument directly", () => {
	let callCount = 0;
	const fn = memoize((n: number) => {
		callCount++;
		return n;
	});

	fn(1);
	fn(1);
	assertStrictEquals(callCount, 1);

	fn(2);
	assertStrictEquals(callCount, 2);
});

Deno.test("memoize - caches falsy results correctly", () => {
	let callCount = 0;
	const fn = memoize((n: number) => {
		callCount++;
		return n === 0 ? 0 : n > 0;
	});

	assertStrictEquals(fn(0), 0);
	assertStrictEquals(callCount, 1);

	// Ensure 0 (falsy) is returned from cache
	assertStrictEquals(fn(0), 0);
	assertStrictEquals(callCount, 1);
});

Deno.test("memoize - caches undefined and null results", () => {
	let callCountA = 0;
	const fnA = memoize((_n: number) => {
		callCountA++;
		return undefined;
	});

	assertStrictEquals(fnA(1), undefined);
	assertStrictEquals(fnA(1), undefined);
	assertStrictEquals(callCountA, 1);

	let callCountB = 0;
	const fnB = memoize((_n: number) => {
		callCountB++;
		return null;
	});

	assertStrictEquals(fnB(1), null);
	assertStrictEquals(fnB(1), null);
	assertStrictEquals(callCountB, 1);
});

// --- memoizeWeak ---

Deno.test("memoizeWeak - caches by object reference", () => {
	let callCount = 0;
	const process = memoizeWeak((obj: { value: number }) => {
		callCount++;
		return obj.value * 2;
	});

	const obj1 = { value: 5 };
	assertStrictEquals(process(obj1), 10);
	assertStrictEquals(callCount, 1);

	assertStrictEquals(process(obj1), 10);
	assertStrictEquals(callCount, 1); // cached
});

Deno.test("memoizeWeak - different objects compute separately", () => {
	let callCount = 0;
	const process = memoizeWeak((obj: { value: number }) => {
		callCount++;
		return obj.value * 2;
	});

	const obj1 = { value: 5 };
	const obj2 = { value: 5 }; // same shape, different reference

	assertStrictEquals(process(obj1), 10);
	assertStrictEquals(process(obj2), 10);
	assertStrictEquals(callCount, 2); // computed for each reference
});

Deno.test("memoizeWeak - works with array keys", () => {
	let callCount = 0;
	const sumArray = memoizeWeak((arr: number[]) => {
		callCount++;
		return arr.reduce((a, b) => a + b, 0);
	});

	const arr = [1, 2, 3];
	assertStrictEquals(sumArray(arr), 6);
	assertStrictEquals(sumArray(arr), 6);
	assertStrictEquals(callCount, 1);
});

Deno.test("memoizeWeak - works with function keys", () => {
	let callCount = 0;
	const describe = memoizeWeak((fn: () => void) => {
		callCount++;
		return fn.toString().length;
	});

	const fn1 = () => {};
	const fn2 = () => {};

	describe(fn1);
	describe(fn1);
	assertStrictEquals(callCount, 1);

	describe(fn2);
	assertStrictEquals(callCount, 2);
});
