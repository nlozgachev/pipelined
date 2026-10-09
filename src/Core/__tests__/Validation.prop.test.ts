import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";
import { Validation } from "../Validation.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbValid = fc.integer().map((n) => Validation.make.passed<string, number>(n));
const arbInvalid = fc.string().map((s): Validation<string, number> => Validation.make.failed(s));
const arbValidation = fc.oneof(arbValid, arbInvalid);

// ---------------------------------------------------------------------------
// map — functor laws
// ---------------------------------------------------------------------------

test("map: satisfies identity law", () => {
	fc.assert(fc.property(arbValidation, (v) => {
		expect(Validation.map((x: number) => x)(v)).toStrictEqual(v);
	}));
});

test("map: satisfies composition law", () => {
	fc.assert(fc.property(arbValidation, fc.integer(), fc.integer(), (v, a, b) => {
		const f = (x: number) => x + a;
		const g = (x: number) => x * b;
		expect(Validation.map(f)(Validation.map(g)(v))).toStrictEqual(Validation.map((x: number) => f(g(x)))(v));
	}));
});

test("map: identity on Invalid", () => {
	fc.assert(fc.property(arbInvalid, (v) => {
		expect(Validation.map((x: number) => x)(v)).toBe(v);
	}));
});

// ---------------------------------------------------------------------------
// apply — error accumulation
// ---------------------------------------------------------------------------

test("apply: combines Valid function and Valid argument", () => {
	fc.assert(fc.property(fc.integer(), fc.integer(), (n, delta) => {
		const vf = Validation.make.passed<string, (x: number) => number>((x: number) => x + delta);
		const va = Validation.make.passed<string, number>(n);
		expect(Validation.apply(va)(vf)).toStrictEqual(Validation.make.passed(n + delta));
	}));
});

test("apply: accumulates errors from both Invalid sides", () => {
	fc.assert(fc.property(fc.string(), fc.string(), (e1, e2) => {
		const vf: Validation<string, (x: number) => number> = Validation.make.failed(e1);
		const va: Validation<string, number> = Validation.make.failed(e2);
		const result = Validation.apply(va)(vf);
		expect(Validation.is.failed(result)).toBe(true);
		const invalid = result as unknown as { errors: string[]; };
		expect(invalid.errors).toContain(e1);
		expect(invalid.errors).toContain(e2);
	}));
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("getOrElse: returns value on Valid", () => {
	fc.assert(fc.property(arbValid, (v) => {
		const vv = v as Validation.Passed<number>;
		expect(Validation.getOrElse(() => -1)(v)).toBe(vv.value);
	}));
});

test("getOrElse: returns fallback on Invalid", () => {
	fc.assert(fc.property(arbInvalid, fc.integer(), (v, fallback) => {
		expect(Validation.getOrElse(() => fallback)(v)).toBe(fallback);
	}));
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("fold: handles all variants without throwing", () => {
	fc.assert(fc.property(arbValidation, (v) => {
		const result = Validation.fold((errors) => `invalid:${errors.join(",")}`, (x: number) => `valid:${x}`)(v);
		expectTypeOf(result).toBeString();
	}));
});

// ---------------------------------------------------------------------------
// tap / tapError
// ---------------------------------------------------------------------------

test("tap: always returns identical reference", () => {
	fc.assert(fc.property(arbValidation, (v) => {
		expect(Validation.tap(() => {})(v)).toBe(v);
	}));
});

test("tapError: always returns identical reference", () => {
	fc.assert(fc.property(arbValidation, (v) => {
		expect(Validation.tapError(() => {})(v)).toBe(v);
	}));
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("recover: identity on Valid", () => {
	fc.assert(fc.property(arbValid, (v) => {
		expect(Validation.recover((_) => Validation.make.passed(-999))(v)).toBe(v);
	}));
});

// ---------------------------------------------------------------------------
// from.Predicate
// ---------------------------------------------------------------------------

test("from.Predicate: always-true gives Valid with original value", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(Validation.from.Predicate((_: number) => true, () => "bad")(n)).toStrictEqual(Validation.make.passed(n));
	}));
});

test("from.Predicate: always-false gives Invalid via onFalse", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		const result = Validation.from.Predicate((_: number) => false, (x) => `bad:${x}`)(n);
		expect(Validation.is.failed(result)).toBe(true);
		const invalid = result as unknown as { errors: string[]; };
		expect(invalid.errors[0]).toBe(`bad:${n}`);
	}));
});

// ---------------------------------------------------------------------------
// product
// ---------------------------------------------------------------------------

test("product: combines two Valid instances into Valid tuple", () => {
	fc.assert(fc.property(fc.integer(), fc.string(), (n, s) => {
		expect(Validation.product(Validation.make.passed<string, number>(n), Validation.make.passed<string, string>(s)))
			.toStrictEqual(Validation.make.passed([n, s]));
	}));
});

test("product: accumulates errors when Invalid instances provided", () => {
	fc.assert(fc.property(fc.string(), fc.string(), (e1, e2) => {
		const result = Validation.product(
			Validation.make.failed(e1) as Validation<string, number>,
			Validation.make.failed(e2) as Validation<string, string>,
		);
		expect(Validation.is.failed(result)).toBe(true);
		const invalid = result as unknown as { errors: string[]; };
		expect(invalid.errors).toHaveLength(2);
	}));
});
