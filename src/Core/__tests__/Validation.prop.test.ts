import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";
import { Validation } from "../Validation.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbValid = fc.integer().map(Validation.make.passed);
const arbInvalid = fc.string().map(Validation.make.failed);
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
// apply — error accumulation & applicative laws
// ---------------------------------------------------------------------------

test("apply: satisfies applicative identity law", () => {
	const id = (x: number) => x;
	fc.assert(fc.property(arbValidation, (v) => {
		const res = Validation.apply(v)(Validation.make.passed(id));
		expect(res).toStrictEqual(v);
	}));
});

test("apply: satisfies applicative homomorphism law", () => {
	fc.assert(fc.property(fc.integer(), fc.integer(), (x, c) => {
		const f = (n: number) => n + c;
		const lhs = Validation.apply(Validation.make.passed(x))(Validation.make.passed(f));
		const rhs = Validation.make.passed(f(x));
		expect(lhs).toStrictEqual(rhs);
	}));
});

test("apply: satisfies applicative interchange law", () => {
	fc.assert(fc.property(fc.integer(), fc.integer(), (y, c) => {
		const u = Validation.make.passed((n: number) => n * c);
		const lhs = Validation.apply(Validation.make.passed(y))(u);
		const evalY = (f: (n: number) => number) => f(y);
		const rhs = Validation.apply(u)(Validation.make.passed(evalY));
		expect(lhs).toStrictEqual(rhs);
	}));
});

test("apply: combines Valid function and Valid argument", () => {
	fc.assert(fc.property(fc.integer(), fc.integer(), (n, delta) => {
		const vf = Validation.make.passed((x: number) => x + delta);
		const va = Validation.make.passed(n);
		expect(Validation.apply(va)(vf)).toStrictEqual(Validation.make.passed(n + delta));
	}));
});

test("apply: accumulates errors from both Invalid sides", () => {
	fc.assert(fc.property(fc.string(), fc.string(), (e1, e2) => {
		const vf = Validation.make.failed(e1);
		const va = Validation.make.failed(e2);
		const result = Validation.apply(va)(vf);
		expect(Validation.is.failed(result)).toBe(true);
		const errors = Validation.match({ passed: (): readonly unknown[] => [], failed: (errs): readonly unknown[] => errs })(
			result,
		);
		expect(errors).toContain(e1);
		expect(errors).toContain(e2);
	}));
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("getOrElse: returns value on Valid", () => {
	fc.assert(fc.property(arbValid, (v) => {
		expect(Validation.getOrElse(() => -1)(v)).toBe(v.value);
	}));
});

test("getOrElse: returns fallback on Invalid", () => {
	fc.assert(fc.property(arbInvalid, fc.integer(), (v, fallback) => {
		expect(Validation.getOrElse(() => fallback)(v)).toBe(fallback);
	}));
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("match: handles all variants without throwing", () => {
	fc.assert(fc.property(arbValidation, (v) => {
		const result = Validation.match({
			failed: (errors) => `invalid:${errors.join(",")}`,
			passed: (x: number) => `valid:${x}`,
		})(v);
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
// struct
// ---------------------------------------------------------------------------

test("struct: combines Valid instances into Valid record", () => {
	fc.assert(fc.property(fc.integer(), fc.string(), (n, s) => {
		expect(Validation.struct({ n: Validation.make.passed(n), s: Validation.make.passed(s) })).toStrictEqual(
			Validation.make.passed({ n, s }),
		);
	}));
});

test("struct: accumulates errors when Invalid instances provided", () => {
	fc.assert(fc.property(fc.string(), fc.string(), (e1, e2) => {
		const result = Validation.struct({ a: Validation.make.failed(e1), b: Validation.make.failed(e2) });
		expect(Validation.is.failed(result)).toBe(true);
		const invalid = result as unknown as { errors: string[]; };
		expect(invalid.errors).toHaveLength(2);
	}));
});
