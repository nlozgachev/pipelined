import fc from "fast-check";
import { expect, test } from "vitest";
import { BigNum } from "../BigNum.ts";

const minMaxBigInt = fc.tuple(fc.bigInt({ min: -1000n, max: 1000n }), fc.bigInt({ min: -1000n, max: 1000n })).map((
	[a, b],
) => [a < b ? a : b, a < b ? b : a] as [bigint, bigint]);

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

test("clamp: keeps result within range", () => {
	fc.assert(fc.property(fc.bigInt(), minMaxBigInt, (n, [min, max]) => {
		const result = BigNum.clamp(min, max)(n);
		expect(result >= min && result <= max).toBe(true);
	}));
});

test("clamp: satisfies idempotence", () => {
	fc.assert(fc.property(fc.bigInt(), minMaxBigInt, (n, [min, max]) => {
		const clamped = BigNum.clamp(min, max)(n);
		expect(BigNum.clamp(min, max)(clamped)).toBe(clamped);
	}));
});

test("clamp: behaves as identity when already in range", () => {
	fc.assert(fc.property(minMaxBigInt, ([min, max]) => {
		const [n] = fc.sample(fc.bigInt({ min, max }), 1);
		expect(BigNum.clamp(min, max)(n)).toBe(n);
	}));
});

// ---------------------------------------------------------------------------
// between & inRange
// ---------------------------------------------------------------------------

test("between: agrees with clamp", () => {
	fc.assert(fc.property(fc.bigInt(), minMaxBigInt, (n, [min, max]) => {
		expect(BigNum.between(min, max)(n)).toBe(BigNum.clamp(min, max)(n) === n);
	}));
});

test("inRange: agrees with half-open range definition", () => {
	fc.assert(fc.property(fc.bigInt(), minMaxBigInt, (n, [min, max]) => {
		expect(BigNum.inRange(min, max)(n)).toBe(n >= min && n < max);
	}));
});

// ---------------------------------------------------------------------------
// add / subtract
// ---------------------------------------------------------------------------

test("add: acts as inverse of subtract", () => {
	fc.assert(fc.property(fc.bigInt(), fc.bigInt(), (n, b) => {
		expect(BigNum.add(b)(BigNum.subtract(b)(n))).toBe(n);
	}));
});

test("add: is commutative", () => {
	fc.assert(fc.property(fc.bigInt(), fc.bigInt(), (a, b) => {
		expect(BigNum.add(a)(b)).toBe(BigNum.add(b)(a));
	}));
});

// ---------------------------------------------------------------------------
// multiply / divide / remainder
// ---------------------------------------------------------------------------

test("multiply: is commutative", () => {
	fc.assert(fc.property(fc.bigInt(), fc.bigInt(), (a, b) => {
		expect(BigNum.multiply(a)(b)).toBe(BigNum.multiply(b)(a));
	}));
});

test("divide: satisfies Euclidean division invariant with remainder", () => {
	fc.assert(fc.property(fc.bigInt(), fc.bigInt().filter((b) => b !== 0n), (a, b) => {
		const q = BigNum.divide(b)(a);
		const r = BigNum.remainder(b)(a);
		expect(q.kind).toBe("Some");
		expect(r.kind).toBe("Some");
		expect((q as { value: bigint; }).value * b + (r as { value: bigint; }).value).toBe(a);
	}));
});

// ---------------------------------------------------------------------------
// abs
// ---------------------------------------------------------------------------

test("abs: returns non-negative value and satisfies idempotence", () => {
	fc.assert(fc.property(fc.bigInt(), (n) => {
		const result = BigNum.abs(n);
		expect(result).toBeGreaterThanOrEqual(0n);
		expect(BigNum.abs(result)).toBe(result);
	}));
});

// ---------------------------------------------------------------------------
// min / max / sum
// ---------------------------------------------------------------------------

test("min: returns element from collection that is <= all elements", () => {
	fc.assert(fc.property(fc.array(fc.bigInt(), { minLength: 1 }), (items) => {
		const res = BigNum.min(items);
		expect(res.kind).toBe("Some");
		const minVal = (res as { value: bigint; }).value;
		expect(items).toContain(minVal);
		expect(items.every((item) => minVal <= item)).toBe(true);
	}));
});

test("max: returns element from collection that is >= all elements", () => {
	fc.assert(fc.property(fc.array(fc.bigInt(), { minLength: 1 }), (items) => {
		const res = BigNum.max(items);
		expect(res.kind).toBe("Some");
		const maxVal = (res as { value: bigint; }).value;
		expect(items).toContain(maxVal);
		expect(items.every((item) => maxVal >= item)).toBe(true);
	}));
});

test("sum: satisfies additive homomorphism on concatenation", () => {
	fc.assert(fc.property(fc.array(fc.bigInt()), fc.array(fc.bigInt()), (a, b) => {
		expect(BigNum.sum([...a, ...b])).toBe(BigNum.sum(a) + BigNum.sum(b));
	}));
});
