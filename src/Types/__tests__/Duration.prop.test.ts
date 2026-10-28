import * as fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../Duration.ts";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const arbDuration = fc.integer({ min: -10_000_000, max: 10_000_000 }).map(Duration.milliseconds);
const arbSafeInt = fc.integer({ min: -1_000_000, max: 1_000_000 });

// ---------------------------------------------------------------------------
// Group Laws
// ---------------------------------------------------------------------------

test("Duration: satisfies additive identity (Duration.milliseconds(0))", () => {
	const zero = Duration.milliseconds(0);

	fc.assert(fc.property(arbDuration, (d) => {
		expect(Duration.to.milliseconds(pipe(d, Duration.add(zero)))).toBe(Duration.to.milliseconds(d));
		expect(Duration.to.milliseconds(pipe(zero, Duration.add(d)))).toBe(Duration.to.milliseconds(d));
	}));
});

test("Duration: satisfies additive commutativity", () => {
	fc.assert(fc.property(arbDuration, arbDuration, (a, b) => {
		const ab = pipe(a, Duration.add(b));
		const ba = pipe(b, Duration.add(a));
		expect(Duration.to.milliseconds(ab)).toBe(Duration.to.milliseconds(ba));
	}));
});

test("Duration: satisfies additive associativity", () => {
	fc.assert(fc.property(arbDuration, arbDuration, arbDuration, (a, b, c) => {
		const left = pipe(a, Duration.add(b), Duration.add(c));
		const right = pipe(a, Duration.add(pipe(b, Duration.add(c))));
		expect(Duration.to.milliseconds(left)).toBe(Duration.to.milliseconds(right));
	}));
});

test("Duration: satisfies inverse subtraction", () => {
	fc.assert(fc.property(arbDuration, arbDuration, (a, b) => {
		const result = pipe(a, Duration.add(b), Duration.subtract(b));
		expect(Duration.to.milliseconds(result)).toBe(Duration.to.milliseconds(a));
	}));
});

// ---------------------------------------------------------------------------
// Unit Conversion Roundtrips
// ---------------------------------------------------------------------------

test("Duration: unit conversion roundtrips", () => {
	fc.assert(fc.property(arbSafeInt, (n) => {
		expect(Duration.to.milliseconds(Duration.milliseconds(n))).toBe(n);
		expect(Duration.to.seconds(Duration.seconds(n))).toBe(n);
		expect(Duration.to.minutes(Duration.minutes(n))).toBe(n);
		expect(Duration.to.hours(Duration.hours(n))).toBe(n);
		expect(Duration.to.days(Duration.days(n))).toBe(n);
	}));
});
