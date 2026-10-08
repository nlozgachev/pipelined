import { expect, test } from "vitest";
import { memoize, memoizeWeak } from "../memoize.ts";

// --- memoize ---

test("memoize: returns cached result without re-invoking function on cache hit", () => {
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

test("memoize: computes distinct arguments independently", () => {
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

test("memoize: caches string argument results", () => {
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

test("memoize: computes cache key using custom key function", () => {
	let callCount = 0;
	const getLabel = memoize((opts: { id: number; label: string; }) => {
		callCount++;
		return opts.label.toUpperCase();
	}, { key: (opts) => opts.id });

	expect(getLabel({ id: 1, label: "hello" })).toBe("HELLO");
	expect(getLabel({ id: 1, label: "changed" })).toBe("HELLO"); // Cached by id
	expect(callCount).toBe(1);

	// Same id, different label object -- should use cache
	expect(getLabel({ id: 1, label: "different" })).toBe("HELLO");
	expect(callCount).toBe(1);

	// Different id -- should compute
	expect(getLabel({ id: 2, label: "world" })).toBe("WORLD");
	expect(callCount).toBe(2);
});

test("memoize: evicts oldest entry when reaching maxSize limit", () => {
	let callCount = 0;
	const cached = memoize((n: number) => {
		callCount++;
		return n * 10;
	}, { maxSize: 2 });

	expect(cached(1)).toBe(10);
	expect(cached(2)).toBe(20);
	expect(callCount).toBe(2);

	// Key 1 is accessed, refreshing its LRU priority (now keys order: 2, 1)
	expect(cached(1)).toBe(10);
	expect(callCount).toBe(2);

	// Key 3 is added -> exceeds maxSize 2 -> evicts key 2 (oldest)
	expect(cached(3)).toBe(30);
	expect(callCount).toBe(3);

	// Key 1 is still cached
	expect(cached(1)).toBe(10);
	expect(callCount).toBe(3);

	// Key 2 was evicted, so calling 2 recomputes
	expect(cached(2)).toBe(20);
	expect(callCount).toBe(4);
});

test("memoize: defaults to using argument directly as cache key", () => {
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

test("memoize: preserves cached falsy results", () => {
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

test("memoize: caches undefined and null return values", () => {
	let callCountA = 0;
	const fnA = memoize((_n: number) => {
		callCountA++;
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

test("memoizeWeak: caches results by object reference identity", () => {
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

test("memoizeWeak: evaluates distinct object instances separately", () => {
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

test("memoizeWeak: caches results keyed by array reference", () => {
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

test("memoizeWeak: caches results keyed by function reference", () => {
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
