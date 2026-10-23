import { describe, expectTypeOf, it } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../Duration.ts";

describe("Duration type-level tests", () => {
	it("inspects constructors, converters, and arithmetic combinators", () => {
		const ms = Duration.milliseconds(500);
		const s = Duration.seconds(2);
		const m = Duration.minutes(5);
		const h = Duration.hours(1);
		const d = Duration.days(1);

		expectTypeOf(ms).toEqualTypeOf<Duration>();
		expectTypeOf(s).toEqualTypeOf<Duration>();
		expectTypeOf(m).toEqualTypeOf<Duration>();
		expectTypeOf(h).toEqualTypeOf<Duration>();
		expectTypeOf(d).toEqualTypeOf<Duration>();

		expectTypeOf(Duration.to.milliseconds(ms)).toEqualTypeOf<number>();
		expectTypeOf(Duration.to.seconds(s)).toEqualTypeOf<number>();
		expectTypeOf(Duration.to.minutes(m)).toEqualTypeOf<number>();
		expectTypeOf(Duration.to.hours(h)).toEqualTypeOf<number>();
		expectTypeOf(Duration.to.days(d)).toEqualTypeOf<number>();

		expectTypeOf(pipe(s, Duration.add(ms))).toEqualTypeOf<Duration>();
		expectTypeOf(pipe(s, Duration.subtract(ms))).toEqualTypeOf<Duration>();
	});

	it("rejects raw number assignments and invalid inputs", () => {
		// @ts-expect-error Raw number is not assignable to branded Duration
		const _dur: Duration = 1000;

		// @ts-expect-error Raw number cannot be passed to Duration.add
		expectTypeOf(pipe(Duration.seconds(1), Duration.add(500))).toBeObject();
	});
});
