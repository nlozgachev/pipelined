import { describe, expectTypeOf, it } from "vitest";
import { Duration } from "../Duration.ts";
import { type RetryEvent, RetryPolicy } from "../RetryPolicy.ts";

describe("RetryPolicy type-level tests", () => {
	it("inspects policy constructors and return shapes", () => {
		const constPolicy = RetryPolicy.constant({ attempts: 3, delay: Duration.seconds(1) });
		expectTypeOf(constPolicy).toEqualTypeOf<RetryPolicy>();
		expectTypeOf(constPolicy.attempts).toEqualTypeOf<number>();
		expectTypeOf(constPolicy.getDelay(1)).toEqualTypeOf<Duration>();

		const expPolicy = RetryPolicy.exponential({
			attempts: 5,
			initial: Duration.milliseconds(100),
			factor: 2,
			jitter: true,
			maxDelay: Duration.seconds(5),
		});
		expectTypeOf(expPolicy).toEqualTypeOf<RetryPolicy>();
		expectTypeOf(expPolicy.attempts).toEqualTypeOf<number>();
		expectTypeOf(expPolicy.getDelay(2)).toEqualTypeOf<Duration>();
	});

	it("inspects RetryEvent type shape", () => {
		type Event = RetryEvent<string>;
		expectTypeOf<Event>().toEqualTypeOf<
			{ readonly attempt: number; readonly error: string; readonly delay: Duration; }
		>();
	});

	it("rejects invalid options and unbranded delay numbers", () => {
		// @ts-expect-error raw number passed instead of Duration
		expectTypeOf(RetryPolicy.constant({ attempts: 3, delay: 1000 })).toBeObject();

		// @ts-expect-error missing initial in exponential
		expectTypeOf(RetryPolicy.exponential({ attempts: 5 })).toBeObject();
	});
});
