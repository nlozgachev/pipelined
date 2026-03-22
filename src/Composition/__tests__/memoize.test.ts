import { expect, test } from "vitest";
import { memoize, memoizeWeak } from "../memoize.ts";

// --- memoize ---

test("memoize - cache hit: function not called again", () => {
	let callCount = 0;
	const expensive = memoize((n: number) => {
		callCount++;
		return n * 2;
	});

	expect(expensive(5)).toBe(10);
	expect(callCount).toBe(1);

	expect(expensive(5)).toBe(10);
	expect(callCount).toBe(1); // not called again
});

test("memoize - different arguments compute separately", () => {
	let callCount = 0;
	const expensive = memoize((n: number) => {
		callCount++;
		return n * 2;
	});

	expect(expensive(5)).toBe(10);
	expect(expensive(3)).toBe(6);
	expect(expensive(7)).toBe(14);
	expect(callCount).toBe(3);

	// Cached calls
	expect(expensive(5)).toBe(10);
	expect(expensive(3)).toBe(6);
	expect(callCount).toBe(3); // no additional calls
});

test("memoize - caches string arguments", () => {
	let callCount = 0;
	const toUpper = memoize((s: string) => {
		callCount++;
		return s.toUpperCase();
	});

	expect(toUpper("hello")).toBe("HELLO");
	expect(toUpper("hello")).toBe("HELLO");
	expect(callCount).toBe(1);

	expect(toUpper("world")).toBe("WORLD");
	expect(callCount).toBe(2);
});

test("memoize - custom key function", () => {
	let callCount = 0;
	const getLabel = memoize(
		(opts: { id: number; label: string; }) => {
			callCount++;
			return opts.label.toUpperCase();
		},
		(opts) => opts.id,
	);

	expect(getLabel({ id: 1, label: "hello" })).toBe("HELLO");
	expect(callCount).toBe(1);

	// Same id, different label object -- should use cache
	expect(getLabel({ id: 1, label: "different" })).toBe("HELLO");
	expect(callCount).toBe(1);

	// Different id -- should compute
	expect(getLabel({ id: 2, label: "world" })).toBe("WORLD");
	expect(callCount).toBe(2);
});

test("memoize - default key uses argument directly", () => {
	let callCount = 0;
	const fn = memoize((n: number) => {
		callCount++;
		return n;
	});

	fn(1);
	fn(1);
	expect(callCount).toBe(1);

	fn(2);
	expect(callCount).toBe(2);
});

test("memoize - caches falsy results correctly", () => {
	let callCount = 0;
	const fn = memoize((n: number) => {
		callCount++;
		return n === 0 ? 0 : n > 0;
	});

	expect(fn(0)).toBe(0);
	expect(callCount).toBe(1);

	// Ensure 0 (falsy) is returned from cache
	expect(fn(0)).toBe(0);
	expect(callCount).toBe(1);
});

test("memoize - caches undefined and null results", () => {
	let callCountA = 0;
	const fnA = memoize((_n: number) => {
		callCountA++;
		return undefined;
	});

	expect(fnA(1)).toBeUndefined();
	expect(fnA(1)).toBeUndefined();
	expect(callCountA).toBe(1);

	let callCountB = 0;
	const fnB = memoize((_n: number) => {
		callCountB++;
		return null;
	});

	expect(fnB(1)).toBeNull();
	expect(fnB(1)).toBeNull();
	expect(callCountB).toBe(1);
});

// --- memoizeWeak ---

test("memoizeWeak - caches by object reference", () => {
	let callCount = 0;
	const process = memoizeWeak((obj: { value: number; }) => {
		callCount++;
		return obj.value * 2;
	});

	const obj1 = { value: 5 };
	expect(process(obj1)).toBe(10);
	expect(callCount).toBe(1);

	expect(process(obj1)).toBe(10);
	expect(callCount).toBe(1); // cached
});

test("memoizeWeak - different objects compute separately", () => {
	let callCount = 0;
	const process = memoizeWeak((obj: { value: number; }) => {
		callCount++;
		return obj.value * 2;
	});

	const obj1 = { value: 5 };
	const obj2 = { value: 5 }; // same shape, different reference

	expect(process(obj1)).toBe(10);
	expect(process(obj2)).toBe(10);
	expect(callCount).toBe(2); // computed for each reference
});

test("memoizeWeak - works with array keys", () => {
	let callCount = 0;
	const sumArray = memoizeWeak((arr: number[]) => {
		callCount++;
		return arr.reduce((a, b) => a + b, 0);
	});

	const arr = [1, 2, 3];
	expect(sumArray(arr)).toBe(6);
	expect(sumArray(arr)).toBe(6);
	expect(callCount).toBe(1);
});

test("memoizeWeak - works with function keys", () => {
	let callCount = 0;
	const describe = memoizeWeak((fn: () => void) => {
		callCount++;
		return fn.toString().length;
	});

	const fn1 = () => {};
	const fn2 = () => {};

	describe(fn1);
	describe(fn1);
	expect(callCount).toBe(1);

	describe(fn2);
	expect(callCount).toBe(2);
});
