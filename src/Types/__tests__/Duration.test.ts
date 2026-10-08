import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../Duration.ts";

// --- milliseconds ---

test("milliseconds: wraps raw milliseconds", () => {
	const d = Duration.milliseconds(500);
	expect(Duration.to.milliseconds(d)).toBe(500);
});

// --- seconds ---

test("seconds: converts seconds to milliseconds", () => {
	const d = Duration.seconds(3);
	expect(Duration.to.milliseconds(d)).toBe(3000);
});

// --- minutes ---

test("minutes: converts minutes to milliseconds", () => {
	const d = Duration.minutes(2);
	expect(Duration.to.milliseconds(d)).toBe(120_000);
});

// --- hours ---

test("hours: converts hours to milliseconds", () => {
	const d = Duration.hours(1);
	expect(Duration.to.milliseconds(d)).toBe(3_600_000);
});

// --- days ---

test("days: converts days to milliseconds", () => {
	const d = Duration.days(1);
	expect(Duration.to.milliseconds(d)).toBe(86_400_000);
});

// --- toMilliseconds ---

test("to.milliseconds: returns raw ms value", () => {
	expect(Duration.to.milliseconds(Duration.seconds(5))).toBe(5000);
});

// --- toSeconds ---

test("to.seconds: converts milliseconds to seconds", () => {
	expect(Duration.to.seconds(Duration.milliseconds(4500))).toBe(4.5);
});

// --- toMinutes ---

test("to.minutes: converts milliseconds to minutes", () => {
	expect(Duration.to.minutes(Duration.milliseconds(90_000))).toBe(1.5);
});

// --- toHours ---

test("to.hours: converts milliseconds to hours", () => {
	expect(Duration.to.hours(Duration.minutes(90))).toBe(1.5);
});

// --- toDays ---

test("to.days: converts milliseconds to days", () => {
	expect(Duration.to.days(Duration.hours(36))).toBe(1.5);
});

// --- add ---

test("add: sums two durations", () => {
	const result = Duration.add(Duration.seconds(3))(Duration.seconds(2));
	expect(Duration.to.milliseconds(result)).toBe(5000);
});

test("add: operates across different unit constructors", () => {
	const result = Duration.add(Duration.minutes(1))(Duration.seconds(30));
	expect(Duration.to.seconds(result)).toBe(90);
});

// --- subtract ---

test("subtract: subtracts other from self", () => {
	const result = Duration.subtract(Duration.seconds(1))(Duration.seconds(5));
	expect(Duration.to.milliseconds(result)).toBe(4000);
});

test("subtract: produces negative duration when subtrahend is greater", () => {
	const result = Duration.subtract(Duration.seconds(10))(Duration.seconds(3));
	expect(Duration.to.milliseconds(result)).toBe(-7000);
});

// --- pipe composition ---

test("pipe: composes add and subtract operations", () => {
	const result = pipe(Duration.minutes(5), Duration.add(Duration.seconds(30)), Duration.subtract(Duration.minutes(1)));
	expect(Duration.to.seconds(result)).toBe(270);
});
