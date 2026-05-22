import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../Duration.ts";

// --- milliseconds ---

test("Duration.milliseconds wraps raw milliseconds", () => {
	const d = Duration.milliseconds(500);
	expect(Duration.toMilliseconds(d)).toBe(500);
});

// --- seconds ---

test("Duration.seconds converts seconds to milliseconds", () => {
	const d = Duration.seconds(3);
	expect(Duration.toMilliseconds(d)).toBe(3000);
});

// --- minutes ---

test("Duration.minutes converts minutes to milliseconds", () => {
	const d = Duration.minutes(2);
	expect(Duration.toMilliseconds(d)).toBe(120_000);
});

// --- hours ---

test("Duration.hours converts hours to milliseconds", () => {
	const d = Duration.hours(1);
	expect(Duration.toMilliseconds(d)).toBe(3_600_000);
});

// --- days ---

test("Duration.days converts days to milliseconds", () => {
	const d = Duration.days(1);
	expect(Duration.toMilliseconds(d)).toBe(86_400_000);
});

// --- toMilliseconds ---

test("Duration.toMilliseconds returns the raw ms value", () => {
	expect(Duration.toMilliseconds(Duration.seconds(5))).toBe(5000);
});

// --- toSeconds ---

test("Duration.toSeconds converts milliseconds to seconds", () => {
	expect(Duration.toSeconds(Duration.milliseconds(4500))).toBe(4.5);
});

// --- toMinutes ---

test("Duration.toMinutes converts milliseconds to minutes", () => {
	expect(Duration.toMinutes(Duration.milliseconds(90_000))).toBe(1.5);
});

// --- toHours ---

test("Duration.toHours converts milliseconds to hours", () => {
	expect(Duration.toHours(Duration.minutes(90))).toBe(1.5);
});

// --- toDays ---

test("Duration.toDays converts milliseconds to days", () => {
	expect(Duration.toDays(Duration.hours(36))).toBe(1.5);
});

// --- add ---

test("Duration.add sums two durations", () => {
	const result = Duration.add(Duration.seconds(3))(Duration.seconds(2));
	expect(Duration.toMilliseconds(result)).toBe(5000);
});

test("Duration.add works with different unit constructors", () => {
	const result = Duration.add(Duration.minutes(1))(Duration.seconds(30));
	expect(Duration.toSeconds(result)).toBe(90);
});

// --- subtract ---

test("Duration.subtract subtracts other from self", () => {
	const result = Duration.subtract(Duration.seconds(1))(Duration.seconds(5));
	expect(Duration.toMilliseconds(result)).toBe(4000);
});

test("Duration.subtract can produce a negative duration", () => {
	const result = Duration.subtract(Duration.seconds(10))(Duration.seconds(3));
	expect(Duration.toMilliseconds(result)).toBe(-7000);
});

// --- pipe composition ---

test("Duration.add and subtract compose in a pipe", () => {
	const result = pipe(
		Duration.minutes(5),
		Duration.add(Duration.seconds(30)),
		Duration.subtract(Duration.minutes(1)),
	);
	expect(Duration.toSeconds(result)).toBe(270);
});
