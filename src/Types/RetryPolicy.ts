import { Duration } from "./Duration.ts";

/**
 * Observational telemetry event emitted immediately before each retry delay.
 *
 * Provides context on the current attempt count, the error that triggered the retry,
 * and the calculated backoff delay before the next attempt executes.
 *
 * @see {@link RetryPolicy} for configuring retry attempts and backoff strategies.
 *
 * @example
 * ```ts
 * const onRetry = (event: RetryEvent<Error>) => {
 *   console.warn(`Attempt ${event.attempt} failed: ${event.error.message}. Retrying in ${Duration.to.milliseconds(event.delay)}ms.`);
 * };
 * ```
 */
export type RetryEvent<E = unknown> = { readonly attempt: number; readonly error: E; readonly delay: Duration; };

/**
 * An immutable policy describing retry limits, backoff delay strategies,
 * transient failure filters, and observational telemetry.
 *
 * @example
 * ```ts
 * const policy: RetryPolicy<Error> = RetryPolicy.exponential({
 *   attempts: 3,
 *   initial: Duration.milliseconds(100),
 *   when: (err) => err.name === "NetworkError",
 *   onRetry: (event) => console.warn(`Retrying attempt ${event.attempt}: ${event.error.message}`),
 * });
 * ```
 */
export type RetryPolicy<E = unknown> = {
	readonly attempts: number;
	readonly getDelay: (attempt: number) => Duration;
	readonly when?: (error: E) => boolean;
	readonly onRetry?: (event: RetryEvent<E>) => void;
};

export const RetryPolicy = {
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
	constant: <E = unknown>(
		options: {
			readonly attempts: number;
			readonly delay: Duration;
			readonly when?: (error: E) => boolean;
			readonly onRetry?: (event: RetryEvent<E>) => void;
		},
	): RetryPolicy<E> => ({
		attempts: Math.max(1, options.attempts),
		getDelay: () => options.delay,
		...(options.when !== undefined ? { when: options.when } : {}),
		...(options.onRetry !== undefined ? { onRetry: options.onRetry } : {}),
	}),

	/**
	 * Creates a RetryPolicy with exponential backoff delays between attempts.
	 * An optional `factor` (default 2) controls the growth rate.
	 * An optional `jitter` (default false) adds randomized variance to prevent thundering herd problems.
	 * An optional `maxDelay` caps the maximum duration between retry attempts.
	 * An optional `when` predicate filters which errors qualify for retry.
	 * An optional `onRetry` callback executes telemetry side-effects before each retry delay.
	 *
	 * @example
	 * ```ts
	 * const policy = RetryPolicy.exponential({
	 *   attempts: 5,
	 *   initial: Duration.milliseconds(100),
	 *   factor: 2,
	 *   jitter: true,
	 *   maxDelay: Duration.seconds(5),
	 *   when: (err: Error) => err.name === "NetworkError",
	 *   onRetry: (event) => console.warn(`Retry attempt ${event.attempt}`),
	 * });
	 * ```
	 */
	exponential: <E = unknown>(
		options: {
			readonly attempts: number;
			readonly initial: Duration;
			readonly factor?: number;
			readonly jitter?: boolean;
			readonly maxDelay?: Duration;
			readonly when?: (error: E) => boolean;
			readonly onRetry?: (event: RetryEvent<E>) => void;
		},
	): RetryPolicy<E> => {
		const attempts = Math.max(1, options.attempts);
		const initialMs = Duration.to.milliseconds(options.initial);
		const factor = options.factor ?? 2;
		const jitter = options.jitter ?? false;
		const maxMs = options.maxDelay ? Duration.to.milliseconds(options.maxDelay) : undefined;

		return {
			attempts,
			getDelay: (attempt: number) => {
				const rawMs = initialMs * (factor ** Math.max(0, attempt - 1));
				const cappedMs = maxMs !== undefined ? Math.min(rawMs, maxMs) : rawMs;
				const finalMs = jitter ? Math.random() * cappedMs : cappedMs;
				return Duration.milliseconds(finalMs);
			},
			...(options.when !== undefined ? { when: options.when } : {}),
			...(options.onRetry !== undefined ? { onRetry: options.onRetry } : {}),
		};
	},
};
