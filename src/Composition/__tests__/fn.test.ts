import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
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

Deno.test("identity - returns number unchanged", () => {
	assertStrictEquals(identity(42), 42);
});

Deno.test("identity - returns string unchanged", () => {
	assertStrictEquals(identity("hello"), "hello");
});

Deno.test("identity - returns boolean unchanged", () => {
	assertStrictEquals(identity(true), true);
	assertStrictEquals(identity(false), false);
});

Deno.test("identity - returns null unchanged", () => {
	assertStrictEquals(identity(null), null);
});

Deno.test("identity - returns undefined unchanged", () => {
	assertStrictEquals(identity(undefined), undefined);
});

Deno.test("identity - returns object by same reference", () => {
	const obj = { name: "Alice" };
	assertStrictEquals(identity(obj), obj);
});

Deno.test("identity - returns array by same reference", () => {
	const arr = [1, 2, 3];
	assertStrictEquals(identity(arr), arr);
});

// --- constant ---

Deno.test("constant - always returns the same value", () => {
	const always42 = constant(42);
	assertStrictEquals(always42(), 42);
	assertStrictEquals(always42(), 42);
});

Deno.test("constant - always returns the same string", () => {
	const alwaysHello = constant("hello");
	assertStrictEquals(alwaysHello(), "hello");
});

Deno.test("constant - returns same object reference", () => {
	const obj = { name: "Alice" };
	const alwaysObj = constant(obj);
	assertStrictEquals(alwaysObj(), obj);
});

Deno.test("constant - useful with map to fill arrays", () => {
	const result = [1, 2, 3].map(constant("x"));
	assertEquals(result, ["x", "x", "x"]);
});

// --- constTrue ---

Deno.test("constTrue - always returns true", () => {
	assertStrictEquals(constTrue(), true);
	assertStrictEquals(constTrue(), true);
});

// --- constFalse ---

Deno.test("constFalse - always returns false", () => {
	assertStrictEquals(constFalse(), false);
	assertStrictEquals(constFalse(), false);
});

// --- constNull ---

Deno.test("constNull - always returns null", () => {
	assertStrictEquals(constNull(), null);
	assertStrictEquals(constNull(), null);
});

// --- constUndefined ---

Deno.test("constUndefined - always returns undefined", () => {
	assertStrictEquals(constUndefined(), undefined);
	assertStrictEquals(constUndefined(), undefined);
});

// --- constVoid ---

Deno.test("constVoid - always returns undefined (void)", () => {
	assertStrictEquals(constVoid(), undefined);
});

// --- and ---

Deno.test("and - both true returns true", () => {
	const isPositive = (n: number) => n > 0;
	const isEven = (n: number) => n % 2 === 0;
	const isPositiveEven = and(isPositive, isEven);

	assertStrictEquals(isPositiveEven(4), true);
});

Deno.test("and - first false returns false", () => {
	const isPositive = (n: number) => n > 0;
	const isEven = (n: number) => n % 2 === 0;
	const isPositiveEven = and(isPositive, isEven);

	assertStrictEquals(isPositiveEven(-2), false);
});

Deno.test("and - second false returns false", () => {
	const isPositive = (n: number) => n > 0;
	const isEven = (n: number) => n % 2 === 0;
	const isPositiveEven = and(isPositive, isEven);

	assertStrictEquals(isPositiveEven(3), false);
});

Deno.test("and - both false returns false", () => {
	const isPositive = (n: number) => n > 0;
	const isEven = (n: number) => n % 2 === 0;
	const isPositiveEven = and(isPositive, isEven);

	assertStrictEquals(isPositiveEven(-3), false);
});

Deno.test("and - short circuits (second predicate not called when first is false)", () => {
	let secondCalled = false;
	const alwaysFalse = (_n: number) => false;
	const tracker = (_n: number) => {
		secondCalled = true;
		return true;
	};
	const combined = and(alwaysFalse, tracker);

	combined(1);
	assertStrictEquals(secondCalled, false);
});

Deno.test("and - works with Array.filter", () => {
	const isPositive = (n: number) => n > 0;
	const isEven = (n: number) => n % 2 === 0;

	const result = [-4, -3, -2, -1, 0, 1, 2, 3, 4].filter(
		and(isPositive, isEven),
	);
	assertEquals(result, [2, 4]);
});

// --- or ---

Deno.test("or - both true returns true", () => {
	const isNegative = (n: number) => n < 0;
	const isZero = (n: number) => n === 0;
	const isNonPositive = or(isNegative, isZero);

	assertStrictEquals(isNonPositive(-1), true);
});

Deno.test("or - first true returns true", () => {
	const isNegative = (n: number) => n < 0;
	const isZero = (n: number) => n === 0;
	const isNonPositive = or(isNegative, isZero);

	assertStrictEquals(isNonPositive(-5), true);
});

Deno.test("or - second true returns true", () => {
	const isNegative = (n: number) => n < 0;
	const isZero = (n: number) => n === 0;
	const isNonPositive = or(isNegative, isZero);

	assertStrictEquals(isNonPositive(0), true);
});

Deno.test("or - both false returns false", () => {
	const isNegative = (n: number) => n < 0;
	const isZero = (n: number) => n === 0;
	const isNonPositive = or(isNegative, isZero);

	assertStrictEquals(isNonPositive(1), false);
});

Deno.test("or - short circuits (second predicate not called when first is true)", () => {
	let secondCalled = false;
	const alwaysTrue = (_n: number) => true;
	const tracker = (_n: number) => {
		secondCalled = true;
		return false;
	};
	const combined = or(alwaysTrue, tracker);

	combined(1);
	assertStrictEquals(secondCalled, false);
});

Deno.test("or - works with Array.filter", () => {
	const isNegative = (n: number) => n < 0;
	const isGreaterThan3 = (n: number) => n > 3;

	const result = [-2, -1, 0, 1, 2, 3, 4, 5].filter(
		or(isNegative, isGreaterThan3),
	);
	assertEquals(result, [-2, -1, 4, 5]);
});

// --- once ---

Deno.test("once - first call executes the function", () => {
	let count = 0;
	const init = once(() => {
		count++;
		return "initialized";
	});

	assertStrictEquals(init(), "initialized");
	assertStrictEquals(count, 1);
});

Deno.test("once - subsequent calls return cached result", () => {
	let count = 0;
	const init = once(() => {
		count++;
		return "initialized";
	});

	init();
	init();
	init();

	assertStrictEquals(count, 1);
});

Deno.test("once - returns same value on every call", () => {
	const init = once(() => Math.random());

	const first = init();
	const second = init();
	const third = init();

	assertStrictEquals(first, second);
	assertStrictEquals(second, third);
});

Deno.test("once - works with side effects", () => {
	const effects: string[] = [];
	const setup = once(() => {
		effects.push("setup");
		return { ready: true };
	});

	const r1 = setup();
	const r2 = setup();

	assertEquals(effects, ["setup"]);
	assertStrictEquals(r1, r2); // same reference
	assertEquals(r1, { ready: true });
});

Deno.test("once - caches falsy results correctly", () => {
	let callCount = 0;

	const returnZero = once(() => {
		callCount++;
		return 0;
	});
	assertStrictEquals(returnZero(), 0);
	assertStrictEquals(returnZero(), 0);
	assertStrictEquals(callCount, 1);

	let callCount2 = 0;
	const returnFalse = once(() => {
		callCount2++;
		return false;
	});
	assertStrictEquals(returnFalse(), false);
	assertStrictEquals(returnFalse(), false);
	assertStrictEquals(callCount2, 1);

	let callCount3 = 0;
	const returnNull = once(() => {
		callCount3++;
		return null;
	});
	assertStrictEquals(returnNull(), null);
	assertStrictEquals(returnNull(), null);
	assertStrictEquals(callCount3, 1);
});
