/* eslint-disable no-shadow */
import { Brand } from "#types";

/**
 * A branded nominal type representing a duration of time in milliseconds.
 * Use Duration to ensure safe time-based operators and clear unit conversions.
 *
 * @example
 * ```ts
 * const halfSecond = Duration.milliseconds(500);
 * const twoSeconds = Duration.seconds(2);
 * const total = pipe(halfSecond, Duration.add(twoSeconds));
 *
 * Duration.to.seconds(total); // 2.5
 * ```
 */
export type Duration = Brand<"Duration", number>;

export namespace Duration {
	const wrap = Brand.wrap<"Duration", number>();

	/**
	 * Creates a Duration from milliseconds.
	 *
	 * @example
	 * ```ts
	 * Duration.milliseconds(500); // 500ms Duration
	 * ```
	 */
	export const milliseconds = (ms: number): Duration => wrap(ms);

	/**
	 * Creates a Duration from seconds.
	 *
	 * @example
	 * ```ts
	 * Duration.seconds(2); // 2000ms Duration
	 * ```
	 */
	export const seconds = (s: number): Duration => wrap(s * 1000);

	/**
	 * Creates a Duration from minutes.
	 *
	 * @example
	 * ```ts
	 * Duration.minutes(5); // 300000ms Duration
	 * ```
	 */
	export const minutes = (m: number): Duration => wrap(m * 60 * 1000);

	/**
	 * Creates a Duration from hours.
	 *
	 * @example
	 * ```ts
	 * Duration.hours(1); // 3600000ms Duration
	 * ```
	 */
	export const hours = (h: number): Duration => wrap(h * 60 * 60 * 1000);

	/**
	 * Creates a Duration from days.
	 *
	 * @example
	 * ```ts
	 * Duration.days(1); // 86400000ms Duration
	 * ```
	 */
	export const days = (d: number): Duration => wrap(d * 24 * 60 * 60 * 1000);

	// --- to ---
	export namespace to {
		/**
		 * Converts a Duration back to raw milliseconds.
		 *
		 * @example
		 * ```ts
		 * Duration.to.milliseconds(Duration.seconds(2)); // 2000
		 * ```
		 */
		export const milliseconds = (d: Duration): number => Brand.unwrap(d);

		/**
		 * Converts a Duration to seconds.
		 *
		 * @example
		 * ```ts
		 * Duration.to.seconds(Duration.milliseconds(2500)); // 2.5
		 * ```
		 */
		export const seconds = (d: Duration): number => Brand.unwrap(d) / 1000;

		/**
		 * Converts a Duration to minutes.
		 *
		 * @example
		 * ```ts
		 * Duration.to.minutes(Duration.seconds(120)); // 2
		 * ```
		 */
		export const minutes = (d: Duration): number => Brand.unwrap(d) / (60 * 1000);

		/**
		 * Converts a Duration to hours.
		 *
		 * @example
		 * ```ts
		 * Duration.to.hours(Duration.minutes(90)); // 1.5
		 * ```
		 */
		export const hours = (d: Duration): number => Brand.unwrap(d) / (60 * 60 * 1000);

		/**
		 * Converts a Duration to days.
		 *
		 * @example
		 * ```ts
		 * Duration.to.days(Duration.hours(36)); // 1.5
		 * ```
		 */
		export const days = (d: Duration): number => Brand.unwrap(d) / (24 * 60 * 60 * 1000);
	}

	/**
	 * Adds two Durations together.
	 *
	 * @example
	 * ```ts
	 * pipe(Duration.seconds(1), Duration.add(Duration.milliseconds(500))); // 1500ms
	 * ```
	 */
	export const add = (other: Duration) => (self: Duration): Duration => wrap(Brand.unwrap(self) + Brand.unwrap(other));

	/**
	 * Subtracts the other Duration from this one.
	 *
	 * @example
	 * ```ts
	 * pipe(Duration.seconds(1), Duration.subtract(Duration.milliseconds(500))); // 500ms
	 * ```
	 */
	export const subtract = (other: Duration) => (self: Duration): Duration =>
		wrap(Brand.unwrap(self) - Brand.unwrap(other));
}
