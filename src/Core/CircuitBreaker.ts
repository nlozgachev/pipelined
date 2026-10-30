import type { WithKind } from "#internal";
import { Duration } from "../Types/Duration.ts";
import { Deferred } from "./Deferred.ts";
import { Result } from "./Result.ts";
import type { Task } from "./Task.ts";

/**
 * A stateful fault-isolation barrier that protects downstream services from retry storms.
 *
 * `CircuitBreaker` monitors task failures and temporarily blocks execution ("trips")
 * when failures exceed a configured threshold, fast-failing subsequent calls in 0ms with
 * `CircuitBreaker.OpenError` to give the failing service time to recover.
 *
 * ### Operating States
 * - **Closed**: Normal execution. Every success resets failure counts (or prunes the sliding window).
 *   If failures reach `failureThreshold`, transitions to **Open**.
 * - **Open**: Downstream service is failing. Calls immediately fast-fail in 0ms with
 *   `CircuitBreaker.OpenError`. Once `resetTimeout` elapses, transitions on-demand to **HalfOpen**.
 * - **HalfOpen**: Trial recovery mode. Allows limited single-probe calls through while fast-failing
 *   concurrent callers. If `successThreshold` consecutive probes succeed, resets to **Closed**. If any
 *   probe fails with a tripping error, immediately transitions back to **Open**.
 *
 * @example
 * ```ts
 * const paymentBreaker = CircuitBreaker.make<PaymentGatewayError>({
 *   failureThreshold: 5,
 *   resetTimeout: Duration.seconds(30),
 *   successThreshold: 2,
 *   shouldTrip: (err) => err.status >= 500 || err.kind === "NetworkTimeout",
 * });
 *
 * const chargeCard = (payload: ChargeInput) =>
 *   pipe(
 *     callPaymentGateway(payload),
 *     paymentBreaker.protect,
 *   );
 * ```
 */
export type CircuitBreaker<E = unknown> = {
	/**
	 * Returns the current observable lifecycle state of the circuit breaker.
	 *
	 * When the circuit is `Open` and `resetTimeout` has elapsed, this evaluates to `HalfOpen`
	 * with `probeInFlight: false`, signaling that the circuit is ready to test downstream recovery.
	 */
	readonly state: () => CircuitBreaker.State<E>;

	/**
	 * Protects a fallible task with the circuit breaker's fault-isolation policies.
	 *
	 * - While `Closed`: executes the task normally, tracking failures.
	 * - While `Open`: fast-fails immediately in 0ms with `CircuitBreaker.OpenError<E>`.
	 * - While `HalfOpen`: allows a single probe call while fast-failing concurrent requests.
	 *
	 * @see {@link CircuitBreaker.reset} to manually force circuit recovery back to Closed state.
	 *
	 * @param task - The fallible async computation to protect.
	 */
	readonly protect: <EIn extends E = E, A = unknown>(
		task: Task.Result<EIn, A>,
	) => Task.Result<EIn | CircuitBreaker.OpenError<E>, A>;

	/**
	 * Manually forces the circuit breaker back to its initial `Closed` state with zero recorded failures.
	 *
	 * @see {@link CircuitBreaker.protect} for protecting fallible tasks under circuit breaker policies.
	 */
	readonly reset: () => void;

	/**
	 * Subscribes a listener callback to state transitions.
	 *
	 * Returns an unsubscribe function. Listener exceptions are isolated and never disrupt circuit execution.
	 *
	 * @param listener - The callback invoked upon each state transition.
	 */
	readonly subscribe: (listener: (state: CircuitBreaker.State<E>) => void) => () => void;
};

export namespace CircuitBreaker {
	/**
	 * An error returned when a protected task is fast-failed because the circuit breaker is open or probing.
	 */
	export type OpenError<E = unknown> = WithKind<"CircuitOpenError"> & {
		/**
		 * The error from the failed task that caused the circuit to trip open.
		 */
		readonly lastError: E;

		/**
		 * Estimated remaining cooldown in milliseconds before the next trial probe is permitted.
		 * Evaluates to `0` during `HalfOpen` probe execution.
		 */
		readonly retryAfterMs: number;
	};

	/**
	 * Normal operating state: calls are passed through to the downstream service.
	 */
	export type ClosedState = WithKind<"Closed"> & {
		/**
		 * The number of recorded failures currently counted towards `failureThreshold`.
		 */
		readonly failures: number;
	};

	/**
	 * Tripped operating state: downstream calls are blocked and fast-failed in 0ms.
	 */
	export type OpenState<E = unknown> = WithKind<"Open"> & {
		/**
		 * Epoch timestamp (milliseconds) when the circuit tripped to Open.
		 */
		readonly openedAt: number;

		/**
		 * Estimated remaining cooldown in milliseconds before the circuit permits trial probes.
		 */
		readonly retryAfterMs: number;

		/**
		 * The error that caused the circuit to trip open.
		 */
		readonly lastError: E;
	};

	/**
	 * Trial recovery state: allows single-probe trial requests to evaluate downstream recovery.
	 */
	export type HalfOpenState = WithKind<"HalfOpen"> & {
		/**
		 * Whether a trial probe is currently executing against the downstream service.
		 */
		readonly probeInFlight: boolean;

		/**
		 * Number of consecutive successful probes completed during the current recovery phase.
		 */
		readonly consecutiveSuccesses: number;
	};

	/**
	 * Discriminated union of all possible circuit breaker lifecycle states.
	 */
	export type State<E = unknown> = ClosedState | OpenState<E> | HalfOpenState;

	/**
	 * Configuration options for initializing a CircuitBreaker.
	 */
	export type Config<E = unknown> = {
		/**
		 * The number of failures that must occur before the circuit trips to `Open`.
		 * Must be an integer greater than or equal to 1.
		 */
		readonly failureThreshold: number;

		/**
		 * The cooldown duration the circuit remains `Open` before allowing trial probes in `HalfOpen`.
		 */
		readonly resetTimeout: Duration;

		/**
		 * The number of consecutive successful probes required in `HalfOpen` to reset the circuit to `Closed`.
		 * Defaults to `1`.
		 */
		readonly successThreshold?: number;

		/**
		 * Optional sliding time window for tracking failures.
		 * If specified, only failures within the last `failureWindow` are counted towards `failureThreshold`.
		 * If omitted, consecutive failures are counted, and any success resets the count to `0`.
		 */
		readonly failureWindow?: Duration;

		/**
		 * Optional predicate to determine if a given error should count towards tripping the circuit.
		 * Defaults to all errors (`() => true`). Non-tripping errors (e.g. 404 Not Found) pass through
		 * without incrementing failure counts or tripping the circuit.
		 */
		readonly shouldTrip?: (error: E) => boolean;
	};
}

const isCircuitOpenError = <E = unknown>(value: unknown): value is CircuitBreaker.OpenError<E> =>
	typeof value === "object" && value !== null && (value as { kind?: unknown; }).kind === "CircuitOpenError";

const isClosedState = (state: CircuitBreaker.State<unknown>): state is CircuitBreaker.ClosedState =>
	state.kind === "Closed";

const isOpenState = <E = unknown>(state: CircuitBreaker.State<E>): state is CircuitBreaker.OpenState<E> =>
	state.kind === "Open";

const isHalfOpenState = (state: CircuitBreaker.State<unknown>): state is CircuitBreaker.HalfOpenState =>
	state.kind === "HalfOpen";

const makeCircuitBreaker = <E = unknown>(config: CircuitBreaker.Config<E>): CircuitBreaker<E> => {
	const failureThreshold = Number.isFinite(config.failureThreshold)
		? Math.max(1, Math.floor(config.failureThreshold))
		: 1;
	const rawResetMs = Duration.to.milliseconds(config.resetTimeout);
	const resetTimeoutMs = Number.isFinite(rawResetMs) ? Math.max(0, Math.floor(rawResetMs)) : 0;
	const successThreshold = Number.isFinite(config.successThreshold)
		? Math.max(1, Math.floor(config.successThreshold!))
		: 1;
	const rawWindowMs = config.failureWindow !== undefined ? Duration.to.milliseconds(config.failureWindow) : undefined;
	const windowMs = rawWindowMs !== undefined && Number.isFinite(rawWindowMs)
		? Math.max(0, Math.floor(rawWindowMs))
		: undefined;
	const shouldTrip = config.shouldTrip ?? (() => true);

	type InternalKind = "Closed" | "Open" | "HalfOpen";

	let currentKind: InternalKind = "Closed";
	let consecutiveFailures = 0;
	let failureTimestamps: number[] = [];
	let openedAt = 0;
	let lastError: E | undefined = undefined;
	let probeInFlight = false;
	let consecutiveSuccesses = 0;

	const subscribers = new Set<(state: CircuitBreaker.State<E>) => void>();

	const pruneWindowFailures = (now: number): void => {
		if (windowMs === undefined) { return; }
		const cutoff = now - windowMs;
		let validIdx = 0;
		const len = failureTimestamps.length;
		while (validIdx < len && failureTimestamps[validIdx]! < cutoff) {
			validIdx++;
		}
		if (validIdx > 0) {
			failureTimestamps.splice(0, validIdx);
		}
	};

	const getState = (): CircuitBreaker.State<E> => {
		const now = Date.now();

		if (currentKind === "Closed") {
			if (windowMs !== undefined) {
				pruneWindowFailures(now);
				return { kind: "Closed", failures: failureTimestamps.length };
			}
			return { kind: "Closed", failures: consecutiveFailures };
		}

		if (currentKind === "Open") {
			const elapsed = now - openedAt;
			if (elapsed >= resetTimeoutMs) {
				return { kind: "HalfOpen", probeInFlight: false, consecutiveSuccesses: 0 };
			}
			return { kind: "Open", openedAt, retryAfterMs: Math.max(0, resetTimeoutMs - elapsed), lastError: lastError as E };
		}

		return { kind: "HalfOpen", probeInFlight, consecutiveSuccesses };
	};

	const notifySubscribers = (): void => {
		if (subscribers.size === 0) { return; }
		const snapshot = getState();
		for (const listener of subscribers) {
			try {
				listener(snapshot);
			} catch {
				// Isolated: subscriber errors do not disrupt circuit breaker operation
			}
		}
	};

	const recordClosedFailure = (err: E): void => {
		const now = Date.now();
		if (windowMs !== undefined) {
			failureTimestamps.push(now);
			pruneWindowFailures(now);
			if (failureTimestamps.length >= failureThreshold) {
				currentKind = "Open";
				openedAt = now;
				lastError = err;
				consecutiveFailures = 0;
				failureTimestamps = [];
				notifySubscribers();
			}
		} else {
			consecutiveFailures++;
			if (consecutiveFailures >= failureThreshold) {
				currentKind = "Open";
				openedAt = now;
				lastError = err;
				consecutiveFailures = 0;
				notifySubscribers();
			}
		}
	};

	const executeClosed = <EIn extends E, A>(
		task: Task.Result<EIn, A>,
		signal?: AbortSignal,
	): Deferred<Result<EIn | CircuitBreaker.OpenError<E>, A>> =>
		Deferred.from.Promise(
			new Promise<Result<EIn | CircuitBreaker.OpenError<E>, A>>((resolve) => {
				let deferred: Deferred<Result<EIn, A>>;
				try {
					deferred = task(signal);
				} catch (thrown) {
					recordClosedFailure(thrown as E);
					resolve(Result.make.err(thrown as EIn));
					return;
				}

				deferred.then((result) => {
					if (signal?.aborted) {
						resolve(result);
						return;
					}

					if (Result.is.ok(result)) {
						consecutiveFailures = 0;
						resolve(result);
						return;
					}

					const err = result.error;
					let trips = false;
					try {
						trips = shouldTrip(err as E);
					} catch {
						trips = true;
					}

					if (trips) {
						recordClosedFailure(err as E);
					}

					resolve(result);
				});
			}),
		);

	const executeProbe = <EIn extends E, A>(
		task: Task.Result<EIn, A>,
		signal?: AbortSignal,
	): Deferred<Result<EIn | CircuitBreaker.OpenError<E>, A>> =>
		Deferred.from.Promise(
			new Promise<Result<EIn | CircuitBreaker.OpenError<E>, A>>((resolve) => {
				let deferred: Deferred<Result<EIn, A>>;
				try {
					deferred = task(signal);
				} catch (thrown) {
					probeInFlight = false;
					currentKind = "Open";
					openedAt = Date.now();
					lastError = thrown as E;
					consecutiveSuccesses = 0;
					notifySubscribers();
					resolve(Result.make.err(thrown as EIn));
					return;
				}

				const onAbort = () => {
					if (currentKind === "HalfOpen" && probeInFlight) {
						probeInFlight = false;
						notifySubscribers();
					}
				};

				if (signal) {
					signal.addEventListener("abort", onAbort, { once: true });
				}

				deferred.then((result) => {
					if (signal) {
						signal.removeEventListener("abort", onAbort);
					}

					if (signal?.aborted) {
						probeInFlight = false;
						notifySubscribers();
						resolve(result);
						return;
					}

					probeInFlight = false;

					if (Result.is.ok(result)) {
						consecutiveSuccesses++;
						if (consecutiveSuccesses >= successThreshold) {
							currentKind = "Closed";
							consecutiveFailures = 0;
							failureTimestamps = [];
							lastError = undefined;
							consecutiveSuccesses = 0;
							notifySubscribers();
						} else {
							notifySubscribers();
						}
						resolve(result);
						return;
					}

					const err = result.error;
					let trips = false;
					try {
						trips = shouldTrip(err as E);
					} catch {
						trips = true;
					}

					if (trips) {
						currentKind = "Open";
						openedAt = Date.now();
						lastError = err as E;
						consecutiveSuccesses = 0;
						notifySubscribers();
					} else {
						consecutiveSuccesses++;
						if (consecutiveSuccesses >= successThreshold) {
							currentKind = "Closed";
							consecutiveFailures = 0;
							failureTimestamps = [];
							lastError = undefined;
							consecutiveSuccesses = 0;
							notifySubscribers();
						} else {
							notifySubscribers();
						}
					}

					resolve(result);
				});
			}),
		);

	const protect =
		<EIn extends E = E, A = unknown>(task: Task.Result<EIn, A>): Task.Result<EIn | CircuitBreaker.OpenError<E>, A> =>
		(signal?: AbortSignal) => {
			const now = Date.now();

			if (currentKind === "Closed") {
				if (signal?.aborted) {
					return task(signal);
				}
				return executeClosed(task, signal);
			}

			if (currentKind === "Open") {
				const elapsed = now - openedAt;
				if (elapsed < resetTimeoutMs) {
					const retryAfterMs = Math.max(0, resetTimeoutMs - elapsed);
					const openErr: CircuitBreaker.OpenError<E> = { kind: "CircuitOpenError", lastError: lastError as E, retryAfterMs };
					return Deferred.from.Promise(Promise.resolve(Result.make.err(openErr)));
				}

				if (signal?.aborted) {
					return task(signal);
				}

				currentKind = "HalfOpen";
				probeInFlight = true;
				consecutiveSuccesses = 0;
				notifySubscribers();
				return executeProbe(task, signal);
			}

			// currentKind === "HalfOpen"
			if (probeInFlight) {
				const openErr: CircuitBreaker.OpenError<E> = {
					kind: "CircuitOpenError",
					lastError: lastError as E,
					retryAfterMs: 0,
				};
				return Deferred.from.Promise(Promise.resolve(Result.make.err(openErr)));
			}

			if (signal?.aborted) {
				return task(signal);
			}

			probeInFlight = true;
			notifySubscribers();
			return executeProbe(task, signal);
		};

	const reset = (): void => {
		const wasClosed = currentKind === "Closed" && consecutiveFailures === 0 && failureTimestamps.length === 0;
		currentKind = "Closed";
		consecutiveFailures = 0;
		failureTimestamps = [];
		openedAt = 0;
		lastError = undefined;
		probeInFlight = false;
		consecutiveSuccesses = 0;
		if (!wasClosed) {
			notifySubscribers();
		}
	};

	const subscribe = (listener: (state: CircuitBreaker.State<E>) => void): () => void => {
		subscribers.add(listener);
		return () => {
			subscribers.delete(listener);
		};
	};

	return { state: getState, protect, reset, subscribe };
};

export const CircuitBreaker = {
	/**
	 * Creates a stateful CircuitBreaker with the provided configuration options.
	 *
	 * @example
	 * ```ts
	 * const breaker = CircuitBreaker.make<NetworkError>({
	 *   failureThreshold: 5,
	 *   resetTimeout: Duration.seconds(30),
	 *   successThreshold: 2,
	 *   shouldTrip: (err) => err.isTimeout || err.status >= 500,
	 * });
	 * ```
	 */
	make: makeCircuitBreaker,

	/**
	 * Type guards for checking circuit breaker states and errors.
	 */
	is: {
		/**
		 * Checks whether a value is a CircuitOpenError.
		 *
		 * @example
		 * ```ts
		 * if (CircuitBreaker.is.openError(error)) {
		 *   console.warn(`Circuit is open. Retry after ${error.retryAfterMs}ms`);
		 * }
		 * ```
		 */
		openError: isCircuitOpenError,

		/**
		 * Checks whether a circuit breaker state is Closed.
		 *
		 * @see {@link CircuitBreaker.is.open} for checking if the circuit is tripped Open.
		 * @see {@link CircuitBreaker.is.halfOpen} for checking if the circuit is in trial recovery HalfOpen.
		 *
		 * @example
		 * ```ts
		 * const state = breaker.state();
		 * if (CircuitBreaker.is.closed(state)) {
		 *   console.log("Downstream dependency is healthy");
		 * }
		 * ```
		 */
		closed: isClosedState,

		/**
		 * Checks whether a circuit breaker state is Open.
		 *
		 * @see {@link CircuitBreaker.is.closed} for checking if the circuit is healthy Closed.
		 * @see {@link CircuitBreaker.is.halfOpen} for checking if the circuit is in trial recovery HalfOpen.
		 *
		 * @example
		 * ```ts
		 * const state = breaker.state();
		 * if (CircuitBreaker.is.open(state)) {
		 *   console.log(`Downstream cooling down. Last error:`, state.lastError);
		 * }
		 * ```
		 */
		open: isOpenState,

		/**
		 * Checks whether a circuit breaker state is HalfOpen.
		 *
		 * @see {@link CircuitBreaker.is.closed} for checking if the circuit is healthy Closed.
		 * @see {@link CircuitBreaker.is.open} for checking if the circuit is tripped Open.
		 *
		 * @example
		 * ```ts
		 * const state = breaker.state();
		 * if (CircuitBreaker.is.halfOpen(state)) {
		 *   console.log("Testing downstream recovery with trial probes");
		 * }
		 * ```
		 */
		halfOpen: isHalfOpenState,
	},
};
