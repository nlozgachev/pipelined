import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";
import { Passed, Validation } from "../Validation.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbValid = fc.integer().map((n) => Validation.passed<string, number>(n));
const arbInvalid = fc.string().map((s): Validation<string, number> => Validation.failed(s));
const arbValidation = fc.oneof(arbValid, arbInvalid);

// ---------------------------------------------------------------------------
// map — functor laws
// ---------------------------------------------------------------------------

test("Validation.map — identity law", () => {
	fc.assert(fc.property(arbValidation, (v) => {
		expect(Validation.map((x: number) => x)(v)).toStrictEqual(v);
	}));
});

test("Validation.map — composition law", () => {
	fc.assert(fc.property(arbValidation, fc.integer(), fc.integer(), (v, a, b) => {
		const f = (x: number) => x + a;
		const g = (x: number) => x * b;
		expect(Validation.map(f)(Validation.map(g)(v))).toStrictEqual(Validation.map((x: number) => f(g(x)))(v));
	}));
});

test("Validation.map — identity on Invalid", () => {
	fc.assert(fc.property(arbInvalid, (v) => {
		expect(Validation.map((x: number) => x)(v)).toBe(v);
	}));
});

// ---------------------------------------------------------------------------
// ap — error accumulation
// ---------------------------------------------------------------------------

test("Validation.ap — Valid(f) + Valid(a) = Valid(f(a))", () => {
	fc.assert(fc.property(fc.integer(), fc.integer(), (n, delta) => {
		const vf = Validation.passed<string, (x: number) => number>((x: number) => x + delta);
		const va = Validation.passed<string, number>(n);
		expect(Validation.ap(va)(vf)).toStrictEqual(Validation.passed(n + delta));
	}));
});

test("Validation.ap — Invalid(f) + Invalid(a) accumulates both error lists", () => {
	fc.assert(fc.property(fc.string(), fc.string(), (e1, e2) => {
		const vf: Validation<string, (x: number) => number> = Validation.failed(e1);
		const va: Validation<string, number> = Validation.failed(e2);
		const result = Validation.ap(va)(vf);
		expect(Validation.isFailed(result)).toBe(true);
		const invalid = result as unknown as { errors: string[]; };
		expect(invalid.errors).toContain(e1);
		expect(invalid.errors).toContain(e2);
	}));
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Validation.getOrElse — returns value on Valid", () => {
	fc.assert(fc.property(arbValid, (v) => {
		const vv = v as Passed<number>;
		expect(Validation.getOrElse(() => -1)(v)).toBe(vv.value);
	}));
});

test("Validation.getOrElse — returns fallback on Invalid", () => {
	fc.assert(fc.property(arbInvalid, fc.integer(), (v, fallback) => {
		expect(Validation.getOrElse(() => fallback)(v)).toBe(fallback);
	}));
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Validation.fold — handles all variants without throwing", () => {
	fc.assert(fc.property(arbValidation, (v) => {
		const result = Validation.fold((errors) => `invalid:${errors.join(",")}`, (x: number) => `valid:${x}`)(v);
		expectTypeOf(result).toBeString();
	}));
});

// ---------------------------------------------------------------------------
// tap / tapError
// ---------------------------------------------------------------------------

test("Validation.tap — always returns the identical reference", () => {
	fc.assert(fc.property(arbValidation, (v) => {
		expect(Validation.tap(() => {})(v)).toBe(v);
	}));
});

test("Validation.tapError — always returns the identical reference", () => {
	fc.assert(fc.property(arbValidation, (v) => {
		expect(Validation.tapError(() => {})(v)).toBe(v);
	}));
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("Validation.recover — identity on Valid", () => {
	fc.assert(fc.property(arbValid, (v) => {
		expect(Validation.recover((_) => Validation.passed(-999))(v)).toBe(v);
	}));
});

// ---------------------------------------------------------------------------
// fromPredicate
// ---------------------------------------------------------------------------

test("Validation.fromPredicate — always-true gives Valid with original value", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(Validation.fromPredicate((_: number) => true, () => "bad")(n)).toStrictEqual(Validation.passed(n));
	}));
});

test("Validation.fromPredicate — always-false gives Invalid via onFalse", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		const result = Validation.fromPredicate((_: number) => false, (x) => `bad:${x}`)(n);
		expect(Validation.isFailed(result)).toBe(true);
		const invalid = result as unknown as { errors: string[]; };
		expect(invalid.errors[0]).toBe(`bad:${n}`);
	}));
});

// ---------------------------------------------------------------------------
// product
// ---------------------------------------------------------------------------

test("Validation.product — two Valid produces Valid tuple", () => {
	fc.assert(fc.property(fc.integer(), fc.string(), (n, s) => {
		expect(Validation.product(Validation.passed<string, number>(n), Validation.passed<string, string>(s))).toStrictEqual(
			Validation.passed([n, s]),
		);
	}));
});

test("Validation.product — at least one Invalid produces Invalid with accumulated errors", () => {
	fc.assert(fc.property(fc.string(), fc.string(), (e1, e2) => {
		const result = Validation.product(
			Validation.failed(e1) as Validation<string, number>,
			Validation.failed(e2) as Validation<string, string>,
		);
		expect(Validation.isFailed(result)).toBe(true);
		const invalid = result as unknown as { errors: string[]; };
		expect(invalid.errors).toHaveLength(2);
	}));
});
