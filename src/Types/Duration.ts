import { Brand } from "./Brand.ts";

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

const wrap = (milliseconds: number): Duration => milliseconds as Duration;

export const Duration = {
	/**
	 * Creates a Duration from milliseconds.
	 *
	 * @example
	 * ```ts
	 * Duration.milliseconds(500); // 500ms Duration
	 * ```
	 */
	milliseconds: (milliseconds: number): Duration => wrap(milliseconds),

	/**
	 * Creates a Duration from seconds.
	 *
	 * @example
	 * ```ts
	 * Duration.seconds(2); // 2000ms Duration
	 * ```
	 */
	seconds: (seconds: number): Duration => wrap(seconds * 1000),

	/**
	 * Creates a Duration from minutes.
	 *
	 * @example
	 * ```ts
	 * Duration.minutes(5); // 300000ms Duration
	 * ```
	 */
	minutes: (minutes: number): Duration => wrap(minutes * 60 * 1000),

	/**
	 * Creates a Duration from hours.
	 *
	 * @example
	 * ```ts
	 * Duration.hours(1); // 3600000ms Duration
	 * ```
	 */
	hours: (hours: number): Duration => wrap(hours * 60 * 60 * 1000),

	/**
	 * Creates a Duration from days.
	 *
	 * @example
	 * ```ts
	 * Duration.days(1); // 86400000ms Duration
	 * ```
	 */
	days: (days: number): Duration => wrap(days * 24 * 60 * 60 * 1000),

	// --- to ---
	to: {
		/**
		 * Converts a Duration back to raw milliseconds.
		 *
		 * @example
		 * ```ts
		 * Duration.to.milliseconds(Duration.seconds(2)); // 2000
		 * ```
		 */
		milliseconds: (duration: Duration): number => Brand.unwrap(duration),

		/**
		 * Converts a Duration to seconds.
		 *
		 * @example
		 * ```ts
		 * Duration.to.seconds(Duration.milliseconds(2500)); // 2.5
		 * ```
		 */
		seconds: (duration: Duration): number => Brand.unwrap(duration) / 1000,

		/**
		 * Converts a Duration to minutes.
		 *
		 * @example
		 * ```ts
		 * Duration.to.minutes(Duration.seconds(120)); // 2
		 * ```
		 */
		minutes: (duration: Duration): number => Brand.unwrap(duration) / (60 * 1000),

		/**
		 * Converts a Duration to hours.
		 *
		 * @example
		 * ```ts
		 * Duration.to.hours(Duration.minutes(90)); // 1.5
		 * ```
		 */
		hours: (duration: Duration): number => Brand.unwrap(duration) / (60 * 60 * 1000),

		/**
		 * Converts a Duration to days.
		 *
		 * @example
		 * ```ts
		 * Duration.to.days(Duration.hours(36)); // 1.5
		 * ```
		 */
		days: (duration: Duration): number => Brand.unwrap(duration) / (24 * 60 * 60 * 1000),
	},

	/**
	 * Adds two Durations together.
	 *
	 * @example
	 * ```ts
	 * pipe(Duration.seconds(1), Duration.add(Duration.milliseconds(500))); // 1500ms
	 * ```
	 */
	add: (amount: Duration) => (duration: Duration): Duration => wrap(Brand.unwrap(duration) + Brand.unwrap(amount)),

	/**
	 * Subtracts the other Duration from this one.
	 *
	 * @example
	 * ```ts
	 * pipe(Duration.seconds(1), Duration.subtract(Duration.milliseconds(500))); // 500ms
	 * ```
	 */
	subtract: (amount: Duration) => (from: Duration): Duration => wrap(Brand.unwrap(from) - Brand.unwrap(amount)),
};
