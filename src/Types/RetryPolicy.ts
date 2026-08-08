import { Duration } from "./Duration.ts";

/**
 * An immutable policy describing retry limits and backoff delay strategies.
 *
 * @example
 * ```ts
 * const policy: RetryPolicy = RetryPolicy.constant({
 *   attempts: 3,
 *   delay: Duration.seconds(1),
 * });
 * ```
 */
export type RetryPolicy = { readonly attempts: number; readonly getDelay: (attempt: number) => Duration; };

export namespace RetryPolicy {
	/**
	 * Creates a RetryPolicy with a constant delay between retry attempts.
	 *
	 * @example
	 * ```ts
	 * const policy = RetryPolicy.constant({
	 *   attempts: 3,
	 *   delay: Duration.seconds(1),
	 * });
	 * ```
	 */
	export const constant = (options: { attempts: number; delay: Duration; }): RetryPolicy => ({
		attempts: Math.max(1, options.attempts),
		getDelay: () => options.delay,
	});

	/**
	 * Creates a RetryPolicy with exponential backoff delays between attempts.
	 * An optional `factor` (default 2) controls the growth rate.
	 * An optional `jitter` (default false) adds randomized variance to prevent thundering herd problems.
	 *
	 * @example
	 * ```ts
	 * const policy = RetryPolicy.exponential({
	 *   attempts: 5,
	 *   initial: Duration.milliseconds(100),
	 *   factor: 2,
	 *   jitter: true,
	 * });
	 * ```
	 */
	export const exponential = (
		options: { attempts: number; initial: Duration; factor?: number; jitter?: boolean; },
	): RetryPolicy => {
		const attempts = Math.max(1, options.attempts);
		const initialMs = Duration.to.milliseconds(options.initial);
		const factor = options.factor ?? 2;
		const jitter = options.jitter ?? false;

		return {
			attempts,
			getDelay: (attempt: number) => {
				const rawMs = initialMs * (factor ** Math.max(0, attempt - 1));
				const finalMs = jitter ? Math.random() * rawMs : rawMs;
				return Duration.milliseconds(finalMs);
			},
		};
	};
}
