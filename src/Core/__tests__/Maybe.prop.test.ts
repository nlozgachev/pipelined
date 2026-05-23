import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";
import { Maybe, Some } from "../Maybe.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbSome = fc.integer().map(Maybe.some);
const arbNone = fc.constant(Maybe.none());
const arbMaybe = fc.oneof(arbSome, arbNone);

// ---------------------------------------------------------------------------
// map — functor laws
// ---------------------------------------------------------------------------

test("Maybe.map — identity law", () => {
	fc.assert(fc.property(arbMaybe, (m) => {
		expect(Maybe.map((x: number) => x)(m)).toStrictEqual(m);
	}));
});

test("Maybe.map — composition law", () => {
	fc.assert(fc.property(arbMaybe, fc.integer(), fc.integer(), (m, a, b) => {
		const f = (x: number) => x + a;
		const g = (x: number) => x * b;
		expect(Maybe.map(f)(Maybe.map(g)(m))).toStrictEqual(Maybe.map((x: number) => f(g(x)))(m));
	}));
});

// ---------------------------------------------------------------------------
// chain — monad laws
// ---------------------------------------------------------------------------

test("Maybe.chain — left identity", () => {
	fc.assert(fc.property(fc.integer(), (a) => {
		const f = (x: number): Maybe<string> => (x > 0 ? Maybe.some(String(x)) : Maybe.none());
		expect(Maybe.chain(f)(Maybe.some(a))).toStrictEqual(f(a));
	}));
});

test("Maybe.chain — right identity", () => {
	fc.assert(fc.property(arbMaybe, (m) => {
		expect(Maybe.chain(Maybe.some)(m)).toStrictEqual(m);
	}));
});

test("Maybe.chain — associativity", () => {
	fc.assert(fc.property(arbMaybe, fc.integer(), (m, threshold) => {
		const f = (x: number): Maybe<number> => (x > 0 ? Maybe.some(x * 2) : Maybe.none());
		const g = (x: number): Maybe<number> => (x > threshold ? Maybe.some(x + 1) : Maybe.none());
		expect(Maybe.chain(f)(Maybe.chain(g)(m))).toStrictEqual(Maybe.chain((x: number) => Maybe.chain(f)(g(x)))(m));
	}));
});

test("Maybe.chain — short-circuits on None", () => {
	fc.assert(fc.property(fc.integer(), (a) => {
		expect(Maybe.chain((_: number) => Maybe.some(a))(Maybe.none())).toStrictEqual(Maybe.none());
	}));
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Maybe.getOrElse — returns value on Some", () => {
	fc.assert(fc.property(arbSome, (m) => {
		const s = m as Some<number>;
		expect(Maybe.getOrElse(() => -1)(m)).toBe(s.value);
	}));
});

test("Maybe.getOrElse — returns fallback on None", () => {
	fc.assert(fc.property(fc.integer(), (fallback) => {
		expect(Maybe.getOrElse(() => fallback)(Maybe.none())).toBe(fallback);
	}));
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Maybe.fold — handles all variants without throwing", () => {
	fc.assert(fc.property(arbMaybe, (m) => {
		const result = Maybe.fold(() => "none", (x: number) => `some:${x}`)(m);
		expectTypeOf(result).toBeString();
	}));
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("Maybe.tap — always returns the identical reference", () => {
	fc.assert(fc.property(arbMaybe, (m) => {
		expect(Maybe.tap(() => {})(m)).toBe(m);
	}));
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("Maybe.recover — identity on Some", () => {
	fc.assert(fc.property(arbSome, (m) => {
		expect(Maybe.recover(() => Maybe.some(-999))(m)).toBe(m);
	}));
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("Maybe.filter — always-true predicate is identity on Some", () => {
	fc.assert(fc.property(arbSome, (m) => {
		expect(Maybe.filter(() => true)(m)).toStrictEqual(m);
	}));
});

test("Maybe.filter — always-false predicate gives None on Some", () => {
	fc.assert(fc.property(arbSome, (_m) => {
		expect(Maybe.filter(() => false)(Maybe.some(0))).toStrictEqual(Maybe.none());
	}));
});

test("Maybe.filter — None passes through unchanged", () => {
	fc.assert(fc.property(arbNone, (m) => {
		expect(Maybe.filter(() => true)(m)).toStrictEqual(Maybe.none());
	}));
});

// ---------------------------------------------------------------------------
// fromNullable / toNullable — round-trip
// ---------------------------------------------------------------------------

test("maybe.fromNullable + Maybe.toNullable — round-trip on non-null value", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(Maybe.toNullable(Maybe.fromNullable(n))).toBe(n);
	}));
});

// ---------------------------------------------------------------------------
// fromPredicate
// ---------------------------------------------------------------------------

test("Maybe.fromPredicate — always-true gives Some with original value", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(Maybe.fromPredicate((_: number) => true)(n)).toStrictEqual(Maybe.some(n));
	}));
});

test("Maybe.fromPredicate — always-false gives None", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(Maybe.fromPredicate((_: number) => false)(n)).toStrictEqual(Maybe.none());
	}));
});
