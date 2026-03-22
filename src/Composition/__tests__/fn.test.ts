import { expect, test } from "vitest";
import {
	and,
	constant,
	constFalse,
	constNull,
	constTrue,
	constUndefined,
	constVoid,
	identity,
	once,
	or,
} from "../fn.ts";

// --- identity ---

test("identity - returns number unchanged", () => {
	expect(identity(42)).toBe(42);
});

test("identity - returns string unchanged", () => {
	expect(identity("hello")).toBe("hello");
});

test("identity - returns boolean unchanged", () => {
	expect(identity(true)).toBe(true);
	expect(identity(false)).toBe(false);
});

test("identity - returns null unchanged", () => {
	expect(identity(null)).toBeNull();
});

test("identity - returns undefined unchanged", () => {
	expect(identity(undefined)).toBeUndefined();
});

test("identity - returns object by same reference", () => {
	const obj = { name: "Alice" };
	expect(identity(obj)).toBe(obj);
});

test("identity - returns array by same reference", () => {
	const arr = [1, 2, 3];
	expect(identity(arr)).toBe(arr);
});

// --- constant ---

test("constant - always returns the same value", () => {
	const always42 = constant(42);
	expect(always42()).toBe(42);
	expect(always42()).toBe(42);
});

test("constant - always returns the same string", () => {
	const alwaysHello = constant("hello");
	expect(alwaysHello()).toBe("hello");
});

test("constant - returns same object reference", () => {
	const obj = { name: "Alice" };
	const alwaysObj = constant(obj);
	expect(alwaysObj()).toBe(obj);
});

test("constant - useful with map to fill arrays", () => {
	const result = [1, 2, 3].map(constant("x"));
	expect(result).toEqual(["x", "x", "x"]);
});

// --- constTrue ---

test("constTrue - always returns true", () => {
	expect(constTrue()).toBe(true);
	expect(constTrue()).toBe(true);
});

// --- constFalse ---

test("constFalse - always returns false", () => {
	expect(constFalse()).toBe(false);
	expect(constFalse()).toBe(false);
});

// --- constNull ---

test("constNull - always returns null", () => {
	expect(constNull()).toBeNull();
	expect(constNull()).toBeNull();
});

// --- constUndefined ---

test("constUndefined - always returns undefined", () => {
	expect(constUndefined()).toBeUndefined();
	expect(constUndefined()).toBeUndefined();
});

// --- constVoid ---

test("constVoid - always returns undefined (void)", () => {
	expect(constVoid()).toBeUndefined();
});

// --- and ---

test("and - both true returns true", () => {
	const isPositive = (n: number) => n > 0;
	const isEven = (n: number) => n % 2 === 0;
	const isPositiveEven = and(isPositive, isEven);

	expect(isPositiveEven(4)).toBe(true);
});

test("and - first false returns false", () => {
	const isPositive = (n: number) => n > 0;
	const isEven = (n: number) => n % 2 === 0;
	const isPositiveEven = and(isPositive, isEven);

	expect(isPositiveEven(-2)).toBe(false);
});

test("and - second false returns false", () => {
	const isPositive = (n: number) => n > 0;
	const isEven = (n: number) => n % 2 === 0;
	const isPositiveEven = and(isPositive, isEven);

	expect(isPositiveEven(3)).toBe(false);
});

test("and - both false returns false", () => {
	const isPositive = (n: number) => n > 0;
	const isEven = (n: number) => n % 2 === 0;
	const isPositiveEven = and(isPositive, isEven);

	expect(isPositiveEven(-3)).toBe(false);
});

test("and - short circuits (second predicate not called when first is false)", () => {
	let secondCalled = false;
	const alwaysFalse = (_n: number) => false;
	const tracker = (_n: number) => {
		secondCalled = true;
		return true;
	};
	const combined = and(alwaysFalse, tracker);

	combined(1);
	expect(secondCalled).toBe(false);
});

test("and - works with Array.filter", () => {
	const isPositive = (n: number) => n > 0;
	const isEven = (n: number) => n % 2 === 0;

	const result = [-4, -3, -2, -1, 0, 1, 2, 3, 4].filter(
		and(isPositive, isEven),
	);
	expect(result).toEqual([2, 4]);
});

// --- or ---

test("or - both true returns true", () => {
	const isNegative = (n: number) => n < 0;
	const isZero = (n: number) => n === 0;
	const isNonPositive = or(isNegative, isZero);

	expect(isNonPositive(-1)).toBe(true);
});

test("or - first true returns true", () => {
	const isNegative = (n: number) => n < 0;
	const isZero = (n: number) => n === 0;
	const isNonPositive = or(isNegative, isZero);

	expect(isNonPositive(-5)).toBe(true);
});

test("or - second true returns true", () => {
	const isNegative = (n: number) => n < 0;
	const isZero = (n: number) => n === 0;
	const isNonPositive = or(isNegative, isZero);

	expect(isNonPositive(0)).toBe(true);
});

test("or - both false returns false", () => {
	const isNegative = (n: number) => n < 0;
	const isZero = (n: number) => n === 0;
	const isNonPositive = or(isNegative, isZero);

	expect(isNonPositive(1)).toBe(false);
});

test("or - short circuits (second predicate not called when first is true)", () => {
	let secondCalled = false;
	const alwaysTrue = (_n: number) => true;
	const tracker = (_n: number) => {
		secondCalled = true;
		return false;
	};
	const combined = or(alwaysTrue, tracker);

	combined(1);
	expect(secondCalled).toBe(false);
});

test("or - works with Array.filter", () => {
	const isNegative = (n: number) => n < 0;
	const isGreaterThan3 = (n: number) => n > 3;

	const result = [-2, -1, 0, 1, 2, 3, 4, 5].filter(
		or(isNegative, isGreaterThan3),
	);
	expect(result).toEqual([-2, -1, 4, 5]);
});

// --- once ---

test("once - first call executes the function", () => {
	let count = 0;
	const init = once(() => {
		count++;
		return "initialized";
	});

	expect(init()).toBe("initialized");
	expect(count).toBe(1);
});

test("once - subsequent calls return cached result", () => {
	let count = 0;
	const init = once(() => {
		count++;
		return "initialized";
	});

	init();
	init();
	init();

	expect(count).toBe(1);
});

test("once - returns same value on every call", () => {
	const init = once(() => Math.random());

	const first = init();
	const second = init();
	const third = init();

	expect(first).toBe(second);
	expect(second).toBe(third);
});

test("once - works with side effects", () => {
	const effects: string[] = [];
	const setup = once(() => {
		effects.push("setup");
		return { ready: true };
	});

	const r1 = setup();
	const r2 = setup();

	expect(effects).toEqual(["setup"]);
	expect(r1).toBe(r2); // same reference
	expect(r1).toEqual({ ready: true });
});

test("once - caches falsy results correctly", () => {
	let callCount = 0;

	const returnZero = once(() => {
		callCount++;
		return 0;
	});
	expect(returnZero()).toBe(0);
	expect(returnZero()).toBe(0);
	expect(callCount).toBe(1);

	let callCount2 = 0;
	const returnFalse = once(() => {
		callCount2++;
		return false;
	});
	expect(returnFalse()).toBe(false);
	expect(returnFalse()).toBe(false);
	expect(callCount2).toBe(1);

	let callCount3 = 0;
	const returnNull = once(() => {
		callCount3++;
		return null;
	});
	expect(returnNull()).toBeNull();
	expect(returnNull()).toBeNull();
	expect(callCount3).toBe(1);
});
