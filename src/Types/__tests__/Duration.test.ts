import { pipe } from "#composition";
import { Duration } from "#types";
import { expect, test } from "vitest";

// --- milliseconds ---

test("Duration.milliseconds wraps raw milliseconds", () => {
	const d = Duration.milliseconds(500);
	expect(Duration.to.milliseconds(d)).toBe(500);
});

// --- seconds ---

test("Duration.seconds converts seconds to milliseconds", () => {
	const d = Duration.seconds(3);
	expect(Duration.to.milliseconds(d)).toBe(3000);
});

// --- minutes ---

test("Duration.minutes converts minutes to milliseconds", () => {
	const d = Duration.minutes(2);
	expect(Duration.to.milliseconds(d)).toBe(120_000);
});

// --- hours ---

test("Duration.hours converts hours to milliseconds", () => {
	const d = Duration.hours(1);
	expect(Duration.to.milliseconds(d)).toBe(3_600_000);
});

// --- days ---

test("Duration.days converts days to milliseconds", () => {
	const d = Duration.days(1);
	expect(Duration.to.milliseconds(d)).toBe(86_400_000);
});

// --- toMilliseconds ---

test("Duration.to.milliseconds returns the raw ms value", () => {
	expect(Duration.to.milliseconds(Duration.seconds(5))).toBe(5000);
});

// --- toSeconds ---

test("Duration.to.seconds converts milliseconds to seconds", () => {
	expect(Duration.to.seconds(Duration.milliseconds(4500))).toBe(4.5);
});

// --- toMinutes ---

test("Duration.to.minutes converts milliseconds to minutes", () => {
	expect(Duration.to.minutes(Duration.milliseconds(90_000))).toBe(1.5);
});

// --- toHours ---

test("Duration.to.hours converts milliseconds to hours", () => {
	expect(Duration.to.hours(Duration.minutes(90))).toBe(1.5);
});

// --- toDays ---

test("Duration.to.days converts milliseconds to days", () => {
	expect(Duration.to.days(Duration.hours(36))).toBe(1.5);
});

// --- add ---

test("Duration.add sums two durations", () => {
	const result = Duration.add(Duration.seconds(3))(Duration.seconds(2));
	expect(Duration.to.milliseconds(result)).toBe(5000);
});

test("Duration.add works with different unit constructors", () => {
	const result = Duration.add(Duration.minutes(1))(Duration.seconds(30));
	expect(Duration.to.seconds(result)).toBe(90);
});

// --- subtract ---

test("Duration.subtract subtracts other from self", () => {
	const result = Duration.subtract(Duration.seconds(1))(Duration.seconds(5));
	expect(Duration.to.milliseconds(result)).toBe(4000);
});

test("Duration.subtract can produce a negative duration", () => {
	const result = Duration.subtract(Duration.seconds(10))(Duration.seconds(3));
	expect(Duration.to.milliseconds(result)).toBe(-7000);
});

// --- pipe composition ---

test("Duration.add and subtract compose in a pipe", () => {
	const result = pipe(Duration.minutes(5), Duration.add(Duration.seconds(30)), Duration.subtract(Duration.minutes(1)));
	expect(Duration.to.seconds(result)).toBe(270);
});
