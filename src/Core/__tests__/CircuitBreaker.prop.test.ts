import fc from "fast-check";
import { assert, expect, test } from "vitest";
import { Duration } from "../../Types/Duration.ts";
import { CircuitBreaker } from "../CircuitBreaker.ts";
import { Deferred } from "../Deferred.ts";
import { Result } from "../Result.ts";
import type { Task } from "../Task.ts";

const makeOkTask = <A>(value: A): Task.Result<never, A> => () =>
	Deferred.from.Promise(Promise.resolve(Result.make.ok(value)));

const makeErrTask = <E>(error: E): Task.Result<E, never> => () =>
	Deferred.from.Promise(Promise.resolve(Result.make.err(error)));

test("property: failures strictly below threshold remain in Closed state with exact count", async () => {
	await fc.assert(fc.asyncProperty(fc.integer({ min: 2, max: 10 }), async (failureThreshold) => {
		const numFailures = failureThreshold - 1;
		const breaker = CircuitBreaker.make<string>({ failureThreshold, resetTimeout: Duration.seconds(10) });

		for (let i = 0; i < numFailures; i++) {
			await breaker.protect(makeErrTask(`err_${i}`))();
		}

		expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: numFailures });
	}));
});

test("property: failures reaching or exceeding threshold trip to Open state", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 10 }),
			fc.integer({ min: 0, max: 5 }),
			async (failureThreshold, extraFailures) => {
				const totalFailures = failureThreshold + extraFailures;
				const breaker = CircuitBreaker.make<string>({ failureThreshold, resetTimeout: Duration.seconds(10) });

				for (let i = 0; i < totalFailures; i++) {
					await breaker.protect(makeErrTask(`err_${i}`))();
				}

				const state = breaker.state();
				expect(CircuitBreaker.is.open(state)).toBe(true);
				assert(state.kind === "Open");
				expect(state.lastError).toBe(`err_${failureThreshold - 1}`);
			},
		),
	);
});

test("property: reset() idempotency returns state to Closed(0) from any state", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 5 }),
			fc.integer({ min: 0, max: 10 }),
			async (failureThreshold, failureCount) => {
				const breaker = CircuitBreaker.make<string>({ failureThreshold, resetTimeout: Duration.seconds(10) });

				for (let i = 0; i < failureCount; i++) {
					await breaker.protect(makeErrTask(`err_${i}`))();
				}

				breaker.reset();
				expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });

				// Multiple resets are idempotent
				breaker.reset();
				expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });
			},
		),
	);
});

test("property: non-integer float and non-finite thresholds are normalized safely to >= 1 and trip correctly", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.oneof(
				fc.double({ min: -100, max: 100, noInteger: true }),
				fc.constant(Number.NaN),
				fc.constant(Number.POSITIVE_INFINITY),
				fc.constant(-0),
			),
			async (rawFailureThreshold) => {
				const breaker = CircuitBreaker.make({ failureThreshold: rawFailureThreshold, resetTimeout: Duration.seconds(1) });

				expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });

				const effectiveThreshold = Number.isFinite(rawFailureThreshold) ? Math.max(1, Math.floor(rawFailureThreshold)) : 1;

				for (let i = 0; i < effectiveThreshold; i++) {
					await breaker.protect(makeErrTask(`err_${i}`))();
				}

				expect(CircuitBreaker.is.open(breaker.state())).toBe(true);
			},
		),
	);
});

test("property: any success following sub-threshold failures resets failure count to 0", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 2, max: 10 }),
			fc.integer({ min: 1, max: 5 }),
			async (thresholdModifier, attempts) => {
				const failureThreshold = thresholdModifier + 2;
				const breaker = CircuitBreaker.make<string>({ failureThreshold, resetTimeout: Duration.seconds(10) });

				for (let i = 0; i < attempts; i++) {
					await breaker.protect(makeErrTask("err"))();
					await breaker.protect(makeOkTask("ok"))();
				}

				expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });
			},
		),
	);
});
