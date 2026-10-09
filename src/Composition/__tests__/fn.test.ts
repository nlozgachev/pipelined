import { expect, test } from "vitest";
import { flow } from "../flow.ts";
import {
	constant,
	constFalse,
	constNull,
	constTrue,
	constUndefined,
	constVoid,
	defaultTo,
	identity,
	once,
	tuple,
	untuple,
} from "../fn.ts";

// --- identity ---

test("identity: returns number unchanged", () => {
	expect(identity(42)).toBe(42);
});

test("identity: returns string unchanged", () => {
	expect(identity("hello")).toBe("hello");
});

test("identity: returns boolean unchanged", () => {
	expect(identity(true)).toBe(true);
	expect(identity(false)).toBe(false);
});

test("identity: returns null unchanged", () => {
	expect(identity(null)).toBeNull();
});

test("identity: returns undefined unchanged", () => {
	expect(identity(undefined)).toBeUndefined();
});

test("identity: returns object by same reference", () => {
	const obj = { name: "Alice" };
	expect(identity(obj)).toBe(obj);
});

test("identity: returns array by same reference", () => {
	const arr = [1, 2, 3];
	expect(identity(arr)).toBe(arr);
});

// --- constant ---

test("constant: always returns the same value", () => {
	const always42 = constant(42);
	expect(always42()).toBe(42);
	expect(always42()).toBe(42);
});

test("constant: always returns the same string", () => {
	const alwaysHello = constant("hello");
	expect(alwaysHello()).toBe("hello");
});

test("constant: returns same object reference", () => {
	const obj = { name: "Alice" };
	const alwaysObj = constant(obj);
	expect(alwaysObj()).toBe(obj);
});

test("constant: fills arrays when used with map", () => {
	const result = [1, 2, 3].map(constant("x"));
	expect(result).toStrictEqual(["x", "x", "x"]);
});

// --- constTrue ---

test("constTrue: always returns true", () => {
	expect(constTrue()).toBe(true);
	expect(constTrue()).toBe(true);
});

// --- constFalse ---

test("constFalse: always returns false", () => {
	expect(constFalse()).toBe(false);
	expect(constFalse()).toBe(false);
});

// --- constNull ---

test("constNull: always returns null", () => {
	expect(constNull()).toBeNull();
	expect(constNull()).toBeNull();
});

// --- constUndefined ---

test("constUndefined: always returns undefined", () => {
	expect(constUndefined()).toBeUndefined();
	expect(constUndefined()).toBeUndefined();
});

// --- constVoid ---

test("constVoid: always returns undefined", () => {
	expect(constVoid()).toBeUndefined();
});

// --- once ---

test("once: executes function on first call", () => {
	let count = 0;
	const init = once(() => {
		count++;
		return "initialized";
	});

	expect(init()).toBe("initialized");
	expect(count).toBe(1);
});

test("once: returns cached result on subsequent calls", () => {
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

test("once: returns same value on every call", () => {
	const init = once(() => Math.random());

	const first = init();
	const second = init();
	const third = init();

	expect(first).toBe(second);
	expect(second).toBe(third);
});

test("once: preserves side-effect result reference across calls", () => {
	const effects: string[] = [];
	const setup = once(() => {
		effects.push("setup");
		return { ready: true };
	});

	const r1 = setup();
	const r2 = setup();

	expect(effects).toStrictEqual(["setup"]);
	expect(r1).toBe(r2); // same reference
	expect(r1).toStrictEqual({ ready: true });
});

test("once: caches falsy results correctly", () => {
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

// --- defaultTo ---

test("defaultTo: returns non-nullable value unchanged", () => {
	const fallback = defaultTo("Guest");
	expect(fallback("Alice")).toBe("Alice");
	expect(fallback(0)).toBe(0);
	expect(fallback(false)).toBe(false);
	expect(fallback({ name: "Bob" })).toStrictEqual({ name: "Bob" });
});

test("defaultTo: returns fallback value for null or undefined", () => {
	const fallback = defaultTo("Guest");
	expect(fallback(null)).toBe("Guest");
	expect(fallback(undefined)).toBe("Guest");
});

test("defaultTo: integrates into pipeline with flow", () => {
	const getName = flow((u: { name?: string | null; }) => u.name, defaultTo("Guest"), (name) => name.toUpperCase());

	expect(getName({ name: "Alice" })).toBe("ALICE");
	expect(getName({ name: null })).toBe("GUEST");
	expect(getName({})).toBe("GUEST");
});

// --- tuple & untuple ---

test("tuple: converts multi-argument function into tuple function", () => {
	const add = (a: number, b: number) => a + b;
	const addTuple = tuple(add);
	expect(addTuple([2, 3])).toBe(5);
});

test("untuple: converts tuple function into multi-argument function", () => {
	const addTuple = ([a, b]: readonly [number, number]) => a + b;
	const add = untuple(addTuple);
	expect(add(2, 3)).toBe(5);
});
