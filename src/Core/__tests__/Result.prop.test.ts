import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";
import { Maybe } from "../Maybe.ts";
import { Result, Ok } from "../Result.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbOk = fc.integer().map(Result.ok);
const arbErr = fc.string().map(Result.error);
const arbResult = fc.oneof(arbOk, arbErr);

// ---------------------------------------------------------------------------
// map — functor laws
// ---------------------------------------------------------------------------

test("Result.map — identity law", () => {
	fc.assert(
		fc.property(arbResult, (r) => {
			expect(Result.map((x: number) => x)(r)).toEqual(r);
		}),
	);
});

test("Result.map — composition law", () => {
	fc.assert(
		fc.property(arbResult, fc.integer(), fc.integer(), (r, a, b) => {
			const f = (x: number) => x + a;
			const g = (x: number) => x * b;
			expect(Result.map(f)(Result.map(g)(r))).toEqual(Result.map((x: number) => f(g(x)))(r));
		}),
	);
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("Result.mapError — identity on Ok", () => {
	fc.assert(
		fc.property(arbOk, (r) => {
			expect(Result.mapError((e: string) => e.toUpperCase())(r)).toBe(r);
		}),
	);
});

test("Result.mapError — identity law on error value", () => {
	fc.assert(
		fc.property(arbErr, (r) => {
			expect(Result.mapError((x: string) => x)(r)).toEqual(r);
		}),
	);
});

// ---------------------------------------------------------------------------
// chain — monad laws
// ---------------------------------------------------------------------------

test("Result.chain — left identity", () => {
	fc.assert(
		fc.property(fc.integer(), (a) => {
			const f = (x: number): Result<string, string> =>
				x > 0 ? Result.ok(String(x)) : Result.error("non-positive");
			expect(Result.chain(f)(Result.ok(a))).toEqual(f(a));
		}),
	);
});

test("Result.chain — right identity", () => {
	fc.assert(
		fc.property(arbResult, (r) => {
			expect(Result.chain(Result.ok)(r)).toEqual(r);
		}),
	);
});

test("Result.chain — associativity", () => {
	fc.assert(
		fc.property(arbResult, fc.integer(), (r, threshold) => {
			const f = (x: number): Result<string, number> =>
				x > 0 ? Result.ok(x * 2) : Result.error("non-positive");
			const g = (x: number): Result<string, number> =>
				x > threshold ? Result.ok(x + 1) : Result.error("too small");
			expect(Result.chain(f)(Result.chain(g)(r))).toEqual(
				Result.chain((x: number) => Result.chain(f)(g(x)))(r),
			);
		}),
	);
});

test("Result.chain — short-circuits on Error", () => {
	fc.assert(
		fc.property(arbErr, (r) => {
			expect(Result.chain((_: number) => Result.ok(0))(r)).toBe(r);
		}),
	);
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Result.getOrElse — returns value on Ok", () => {
	fc.assert(
		fc.property(arbOk, (r) => {
			const o = r as Ok<number>;
			expect(Result.getOrElse(() => -1)(r)).toBe(o.value);
		}),
	);
});

test("Result.getOrElse — returns fallback on Error", () => {
	fc.assert(
		fc.property(arbErr, fc.integer(), (r, fallback) => {
			expect(Result.getOrElse(() => fallback)(r)).toBe(fallback);
		}),
	);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Result.fold — handles all variants without throwing", () => {
	fc.assert(
		fc.property(arbResult, (r) => {
			const result = Result.fold(
				(e: string) => `err:${e}`,
				(v: number) => `ok:${v}`,
			)(r);
			expectTypeOf(result).toBeString();
		}),
	);
});

// ---------------------------------------------------------------------------
// tap / tapError
// ---------------------------------------------------------------------------

test("Result.tap — always returns the identical reference", () => {
	fc.assert(
		fc.property(arbResult, (r) => {
			expect(Result.tap(() => {})(r)).toBe(r);
		}),
	);
});

test("Result.tapError — always returns the identical reference", () => {
	fc.assert(
		fc.property(arbResult, (r) => {
			expect(Result.tapError(() => {})(r)).toBe(r);
		}),
	);
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("Result.recover — identity on Ok", () => {
	fc.assert(
		fc.property(arbOk, (r) => {
			expect(Result.recover((_: string) => Result.ok(-999))(r)).toBe(r);
		}),
	);
});

// ---------------------------------------------------------------------------
// fromPredicate
// ---------------------------------------------------------------------------

test("Result.fromPredicate — always-true gives Ok with original value", () => {
	fc.assert(
		fc.property(fc.integer(), (n) => {
			expect(Result.fromPredicate((_: number) => true, () => "bad")(n)).toEqual(Result.ok(n));
		}),
	);
});

test("Result.fromPredicate — always-false gives Error via onFalse", () => {
	fc.assert(
		fc.property(fc.integer(), (n) => {
			expect(Result.fromPredicate((_: number) => false, (x) => `bad:${x}`)(n)).toEqual(
				Result.error(`bad:${n}`),
			);
		}),
	);
});

// ---------------------------------------------------------------------------
// toMaybe
// ---------------------------------------------------------------------------

test("Result.toMaybe — Ok maps to Some", () => {
	fc.assert(
		fc.property(arbOk, (r) => {
			const o = r as Ok<number>;
			expect(Result.toMaybe(r)).toEqual(Maybe.some(o.value));
		}),
	);
});

test("Result.toMaybe — Error maps to None", () => {
	fc.assert(
		fc.property(arbErr, (r) => {
			expect(Result.toMaybe(r)).toEqual(Maybe.none());
		}),
	);
});
