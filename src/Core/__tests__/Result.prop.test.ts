import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbOk = fc.integer().map(Result.make.ok);
const arbErr = fc.string().map(Result.make.err);
const arbResult = fc.oneof(arbOk, arbErr);

// ---------------------------------------------------------------------------
// map — functor laws
// ---------------------------------------------------------------------------

test("map: satisfies identity law", () => {
	fc.assert(fc.property(arbResult, (r) => {
		expect(Result.map((x: number) => x)(r)).toStrictEqual(r);
	}));
});

test("map: satisfies composition law", () => {
	fc.assert(fc.property(arbResult, fc.integer(), fc.integer(), (r, a, b) => {
		const f = (x: number) => x + a;
		const g = (x: number) => x * b;
		expect(Result.map(f)(Result.map(g)(r))).toStrictEqual(Result.map((x: number) => f(g(x)))(r));
	}));
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("mapError: identity on Ok", () => {
	fc.assert(fc.property(arbOk, (r) => {
		expect(Result.mapError((e: string) => e.toUpperCase())(r)).toBe(r);
	}));
});

test("mapError: satisfies identity law on error value", () => {
	fc.assert(fc.property(arbErr, (r) => {
		expect(Result.mapError((x: string) => x)(r)).toStrictEqual(r);
	}));
});

// ---------------------------------------------------------------------------
// chain — monad laws
// ---------------------------------------------------------------------------

test("chain: satisfies left identity", () => {
	fc.assert(fc.property(fc.integer(), (a) => {
		const f = (x: number): Result<string, string> => x > 0 ? Result.make.ok(String(x)) : Result.make.err("non-positive");
		expect(Result.chain(f)(Result.make.ok(a))).toStrictEqual(f(a));
	}));
});

test("chain: satisfies right identity", () => {
	fc.assert(fc.property(arbResult, (r) => {
		expect(Result.chain(Result.make.ok)(r)).toStrictEqual(r);
	}));
});

test("chain: satisfies associativity", () => {
	fc.assert(fc.property(arbResult, fc.integer(), (r, threshold) => {
		const f = (x: number): Result<string, number> => x > 0 ? Result.make.ok(x * 2) : Result.make.err("non-positive");
		const g = (x: number): Result<string, number> => x > threshold ? Result.make.ok(x + 1) : Result.make.err("too small");
		expect(Result.chain(f)(Result.chain(g)(r))).toStrictEqual(Result.chain((x: number) => Result.chain(f)(g(x)))(r));
	}));
});

test("chain: short-circuits on Error", () => {
	fc.assert(fc.property(arbErr, (r) => {
		expect(Result.chain((_: number) => Result.make.ok(0))(r)).toBe(r);
	}));
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("getOrElse: returns value on Ok", () => {
	fc.assert(fc.property(arbOk, (r) => {
		const o = r as Result.Ok<number>;
		expect(Result.getOrElse(() => -1)(r)).toBe(o.value);
	}));
});

test("getOrElse: returns fallback on Error", () => {
	fc.assert(fc.property(arbErr, fc.integer(), (r, fallback) => {
		expect(Result.getOrElse(() => fallback)(r)).toBe(fallback);
	}));
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("fold: handles all variants without throwing", () => {
	fc.assert(fc.property(arbResult, (r) => {
		const result = Result.fold((e: string) => `err:${e}`, (v: number) => `ok:${v}`)(r);
		expectTypeOf(result).toBeString();
	}));
});

// ---------------------------------------------------------------------------
// tap / tapError
// ---------------------------------------------------------------------------

test("tap: always returns identical reference", () => {
	fc.assert(fc.property(arbResult, (r) => {
		expect(Result.tap(() => {})(r)).toBe(r);
	}));
});

test("tapError: always returns identical reference", () => {
	fc.assert(fc.property(arbResult, (r) => {
		expect(Result.tapError(() => {})(r)).toBe(r);
	}));
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("recover: identity on Ok", () => {
	fc.assert(fc.property(arbOk, (r) => {
		expect(Result.recover((_: string) => Result.make.ok(-999))(r)).toBe(r);
	}));
});

// ---------------------------------------------------------------------------
// from.Predicate
// ---------------------------------------------------------------------------

test("from.Predicate: always-true gives Ok with original value", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(Result.from.Predicate((_: number) => true, () => "bad")(n)).toStrictEqual(Result.make.ok(n));
	}));
});

test("from.Predicate: always-false gives Err via onFalse", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(Result.from.Predicate((_: number) => false, (x) => `bad:${x}`)(n)).toStrictEqual(Result.make.err(`bad:${n}`));
	}));
});

// ---------------------------------------------------------------------------
// toMaybe
// ---------------------------------------------------------------------------

test("to.Maybe: maps Ok to Some", () => {
	fc.assert(fc.property(arbOk, (r) => {
		const o = r as Result.Ok<number>;
		expect(Result.to.Maybe(r)).toStrictEqual(Maybe.make.some(o.value));
	}));
});

test("to.Maybe: maps Err to None", () => {
	fc.assert(fc.property(arbErr, (r) => {
		expect(Result.to.Maybe(r)).toStrictEqual(Maybe.make.none());
	}));
});
