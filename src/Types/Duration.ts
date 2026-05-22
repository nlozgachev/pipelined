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
 * Duration.toSeconds(total); // 2.5
 * ```
 */
export type Duration = Brand<"Duration", number>;

export namespace Duration {
	const wrap = Brand.wrap<"Duration", number>();

	/**
	 * Creates a Duration from milliseconds.
	 */
	export const milliseconds = (ms: number): Duration => wrap(ms);

	/**
	 * Creates a Duration from seconds.
	 */
	export const seconds = (s: number): Duration => wrap(s * 1000);

	/**
	 * Creates a Duration from minutes.
	 */
	export const minutes = (m: number): Duration => wrap(m * 60 * 1000);

	/**
	 * Creates a Duration from hours.
	 */
	export const hours = (h: number): Duration => wrap(h * 60 * 60 * 1000);

	/**
	 * Creates a Duration from days.
	 */
	export const days = (d: number): Duration => wrap(d * 24 * 60 * 60 * 1000);

	/**
	 * Converts a Duration back to raw milliseconds.
	 */
	export const toMilliseconds = (d: Duration): number => Brand.unwrap(d);

	/**
	 * Converts a Duration to seconds.
	 */
	export const toSeconds = (d: Duration): number => Brand.unwrap(d) / 1000;

	/**
	 * Converts a Duration to minutes.
	 */
	export const toMinutes = (d: Duration): number => Brand.unwrap(d) / (60 * 1000);

	/**
	 * Converts a Duration to hours.
	 */
	export const toHours = (d: Duration): number => Brand.unwrap(d) / (60 * 60 * 1000);

	/**
	 * Converts a Duration to days.
	 */
	export const toDays = (d: Duration): number => Brand.unwrap(d) / (24 * 60 * 60 * 1000);

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
