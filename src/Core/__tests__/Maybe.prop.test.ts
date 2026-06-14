import { Maybe, Some } from "#core";
import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbSome = fc.integer().map(Maybe.make.some);
const arbNone = fc.constant(Maybe.make.none());
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
		const f = (x: number): Maybe<string> => (x > 0 ? Maybe.make.some(String(x)) : Maybe.make.none());
		expect(Maybe.chain(f)(Maybe.make.some(a))).toStrictEqual(f(a));
	}));
});

test("Maybe.chain — right identity", () => {
	fc.assert(fc.property(arbMaybe, (m) => {
		expect(Maybe.chain(Maybe.make.some)(m)).toStrictEqual(m);
	}));
});

test("Maybe.chain — associativity", () => {
	fc.assert(fc.property(arbMaybe, fc.integer(), (m, threshold) => {
		const f = (x: number): Maybe<number> => (x > 0 ? Maybe.make.some(x * 2) : Maybe.make.none());
		const g = (x: number): Maybe<number> => (x > threshold ? Maybe.make.some(x + 1) : Maybe.make.none());
		expect(Maybe.chain(f)(Maybe.chain(g)(m))).toStrictEqual(Maybe.chain((x: number) => Maybe.chain(f)(g(x)))(m));
	}));
});

test("Maybe.chain — short-circuits on None", () => {
	fc.assert(fc.property(fc.integer(), (a) => {
		expect(Maybe.chain((_: number) => Maybe.make.some(a))(Maybe.make.none())).toStrictEqual(Maybe.make.none());
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
		expect(Maybe.getOrElse(() => fallback)(Maybe.make.none())).toBe(fallback);
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
		expect(Maybe.recover(() => Maybe.make.some(-999))(m)).toBe(m);
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
		expect(Maybe.filter(() => false)(Maybe.make.some(0))).toStrictEqual(Maybe.make.none());
	}));
});

test("Maybe.filter — None passes through unchanged", () => {
	fc.assert(fc.property(arbNone, (m) => {
		expect(Maybe.filter(() => true)(m)).toStrictEqual(Maybe.make.none());
	}));
});

// ---------------------------------------------------------------------------
// from.nullable / to.nullable — round-trip
// ---------------------------------------------------------------------------

test("maybe.from.nullable + Maybe.to.nullable — round-trip on non-null value", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(Maybe.to.nullable(Maybe.from.nullable(n))).toBe(n);
	}));
});

// ---------------------------------------------------------------------------
// from.Predicate
// ---------------------------------------------------------------------------

test("Maybe.from.Predicate — always-true gives Some with original value", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(Maybe.from.Predicate((_: number) => true)(n)).toStrictEqual(Maybe.make.some(n));
	}));
});

test("Maybe.from.Predicate — always-false gives None", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(Maybe.from.Predicate((_: number) => false)(n)).toStrictEqual(Maybe.make.none());
	}));
});
