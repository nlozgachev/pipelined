import { expect, test } from "vitest";
import { Duration } from "../Duration.ts";
import { RetryPolicy } from "../RetryPolicy.ts";

// --- RetryPolicy.constant ---

test("constant: returns constant delay across attempts", () => {
	const policy = RetryPolicy.constant({ attempts: 3, delay: Duration.seconds(1) });
	expect(policy.attempts).toBe(3);
	expect(Duration.to.seconds(policy.getDelay(1))).toBe(1);
	expect(Duration.to.seconds(policy.getDelay(2))).toBe(1);
	expect(Duration.to.seconds(policy.getDelay(3))).toBe(1);
});

test("constant: clamps negative attempts to minimum of 1", () => {
	const policy = RetryPolicy.constant({ attempts: -1, delay: Duration.seconds(1) });
	expect(policy.attempts).toBe(1);
});

// --- RetryPolicy.exponential ---

test("exponential: scales delays by factor without jitter", () => {
	const policy = RetryPolicy.exponential({ attempts: 4, initial: Duration.milliseconds(100), factor: 2, jitter: false });

	expect(policy.attempts).toBe(4);
	expect(Duration.to.milliseconds(policy.getDelay(1))).toBe(100);
	expect(Duration.to.milliseconds(policy.getDelay(2))).toBe(200);
	expect(Duration.to.milliseconds(policy.getDelay(3))).toBe(400);
	expect(Duration.to.milliseconds(policy.getDelay(4))).toBe(800);
});

test("exponential: defaults factor to 2", () => {
	const policy = RetryPolicy.exponential({ attempts: 3, initial: Duration.milliseconds(50) });

	expect(Duration.to.milliseconds(policy.getDelay(1))).toBe(50);
	expect(Duration.to.milliseconds(policy.getDelay(2))).toBe(100);
	expect(Duration.to.milliseconds(policy.getDelay(3))).toBe(200);
});

test("exponential: bounds jittered delay within [0, base]", () => {
	const policy = RetryPolicy.exponential({ attempts: 3, initial: Duration.milliseconds(100), factor: 2, jitter: true });

	const delay1 = Duration.to.milliseconds(policy.getDelay(1));
	expect(delay1).toBeGreaterThanOrEqual(0);
	expect(delay1).toBeLessThanOrEqual(100);

	const delay2 = Duration.to.milliseconds(policy.getDelay(2));
	expect(delay2).toBeGreaterThanOrEqual(0);
	expect(delay2).toBeLessThanOrEqual(200);
});

test("exponential: clamps delays at maxDelay limit", () => {
	const policy = RetryPolicy.exponential({
		attempts: 5,
		initial: Duration.milliseconds(100),
		factor: 2,
		maxDelay: Duration.milliseconds(300),
		jitter: false,
	});

	expect(Duration.to.milliseconds(policy.getDelay(1))).toBe(100);
	expect(Duration.to.milliseconds(policy.getDelay(2))).toBe(200);
	expect(Duration.to.milliseconds(policy.getDelay(3))).toBe(300);
	expect(Duration.to.milliseconds(policy.getDelay(4))).toBe(300);
});
