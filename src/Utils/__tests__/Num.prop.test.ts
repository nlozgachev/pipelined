import fc from "fast-check";
import { expect, test } from "vitest";
import { Num } from "../Num.ts";

const minMax = fc
	.tuple(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }))
	.map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number]);

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

test("Num.clamp — result is always within range", () => {
	fc.assert(
		fc.property(fc.integer(), minMax, (n, [min, max]) => {
			const result = Num.clamp(min, max)(n);
			expect(result >= min && result <= max).toBe(true);
		}),
	);
});

test("Num.clamp — idempotence", () => {
	fc.assert(
		fc.property(fc.integer(), minMax, (n, [min, max]) => {
			const clamped = Num.clamp(min, max)(n);
			expect(Num.clamp(min, max)(clamped)).toBe(clamped);
		}),
	);
});

test("Num.clamp — identity when already in range", () => {
	fc.assert(
		fc.property(minMax, ([min, max]) => {
			const [n] = fc.sample(fc.integer({ min, max }), 1);
			expect(Num.clamp(min, max)(n)).toBe(n);
		}),
	);
});

// ---------------------------------------------------------------------------
// between
// ---------------------------------------------------------------------------

test("Num.between — agrees with clamp", () => {
	fc.assert(
		fc.property(fc.integer(), minMax, (n, [min, max]) => {
			expect(Num.between(min, max)(n)).toBe(Num.clamp(min, max)(n) === n);
		}),
	);
});

// ---------------------------------------------------------------------------
// add / subtract
// ---------------------------------------------------------------------------

test("Num.add + Num.subtract — inverse", () => {
	fc.assert(
		fc.property(fc.integer(), fc.integer(), (n, b) => {
			expect(Num.add(b)(Num.subtract(b)(n))).toBe(n);
		}),
	);
});

// ---------------------------------------------------------------------------
// multiply / divide
// ---------------------------------------------------------------------------

test("Num.multiply + Num.divide — inverse", () => {
	fc.assert(
		fc.property(
			fc.integer({ min: -1000, max: 1000 }),
			fc.integer({ min: -100, max: 100 }).filter((b) => b !== 0),
			(n, b) => {
				// (n * b) / b === n for integers within float precision
				expect(Num.divide(b)(Num.multiply(b)(n))).toBe(n);
			},
		),
	);
});

// ---------------------------------------------------------------------------
// range
// ---------------------------------------------------------------------------

test("Num.range — length equals to - from + 1", () => {
	fc.assert(
		fc.property(
			fc.integer({ min: -500, max: 500 }),
			fc.integer({ min: 0, max: 1000 }),
			(from, delta) => {
				const to = from + delta;
				expect(Num.range(from, to)).toHaveLength(delta + 1);
			},
		),
	);
});

test("Num.range — every value is within bounds", () => {
	fc.assert(
		fc.property(
			fc.integer({ min: -500, max: 500 }),
			fc.integer({ min: 0, max: 1000 }),
			(from, delta) => {
				const to = from + delta;
				expect(Num.range(from, to).every((v) => v >= from && v <= to)).toBe(true);
			},
		),
	);
});
