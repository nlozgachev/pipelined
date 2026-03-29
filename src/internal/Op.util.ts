/**
 * Internal helpers for `Op` — execution utilities and concurrency strategy factories.
 * Not part of the public API.
 */

import { Deferred } from "../Core/Deferred.ts";
import type { Op } from "../Core/Op.ts";
import { Result } from "../Core/Result.ts";

// ---------------------------------------------------------------------------
// Internal singletons
// ---------------------------------------------------------------------------

const _abortedNil: Op.Nil = { kind: "Nil", reason: "aborted" };
const _droppedNil: Op.Nil = { kind: "Nil", reason: "dropped" };
const _replacedNil: Op.Nil = { kind: "Nil", reason: "replaced" };
const _evictedNil: Op.Nil = { kind: "Nil", reason: "evicted" };
const _idle: Op.Idle = { kind: "Idle" };
const _pending: Op.Pending = { kind: "Pending" };
const ok = <A>(value: A): Op.Ok<A> => ({ kind: "Ok", value });
const err = <E>(error: E): Op.Err<E> => ({ kind: "Err", error });

// ---------------------------------------------------------------------------
// cancellableWait
// ---------------------------------------------------------------------------

/** Waits `ms` milliseconds. Resolves early if the signal fires (non-blocking abort). */
export const cancellableWait = (ms: number, signal: AbortSignal): Promise<void> => {
	if (ms <= 0) return Promise.resolve();
	return new Promise<void>((resolve) => {
		const id = setTimeout(resolve, ms);
		signal.addEventListener("abort", () => {
			clearTimeout(id);
			resolve();
		}, { once: true });
	});
};

// ---------------------------------------------------------------------------
// runWithRetry
// ---------------------------------------------------------------------------

/**
 * Runs the factory with retry logic. Calls `onRetrying` before each retry delay.
 * Stops on Ok, Nil (null), abort, or exhausted attempts.
 */
export const runWithRetry = <I, E, A>(
	op: Op<I, E, A>,
	input: I,
	signal: AbortSignal,
	options: Op.RetryOptions<E>,
	onRetrying: (state: Op.Retrying<E>) => void,
): Promise<Result<E, A> | null> => {
	const { attempts, backoff, when: shouldRetry } = options;
	const getDelay = (n: number): number =>
		backoff === undefined ? 0 : typeof backoff === "function" ? backoff(n) : backoff;

	const attempt = async (left: number): Promise<Result<E, A> | null> => {
		const result = await Deferred.toPromise(op._factory(input, signal));
		if (result === null || signal.aborted) return null;
		if (result.kind === "Ok") return result;
		if (left <= 1) return result;
		if (shouldRetry !== undefined && !shouldRetry(result.error)) return result;
		const attemptNumber = attempts - left + 1;
		const ms = getDelay(attemptNumber);
		onRetrying({
			kind: "Retrying",
			attempt: attemptNumber,
			lastError: result.error,
			...(ms > 0 ? { nextRetryIn: ms } : {}),
		});
		await cancellableWait(ms, signal);
		if (signal.aborted) return null;
		return attempt(left - 1);
	};

	return attempt(attempts);
};

// ---------------------------------------------------------------------------
// execute
// ---------------------------------------------------------------------------

/**
 * Executes the op (with optional retry), racing against an optional timeout deadline.
 * The timeout wraps the entire retry sequence — one deadline for all attempts.
 * If the deadline fires, it aborts the `controller` and returns `Err(onTimeout())`.
 * A null result from the factory (signal aborted) becomes `_abortedNil`.
 */
export const execute = <I, E, A>(
	op: Op<I, E, A>,
	input: I,
	controller: AbortController,
	retryOptions: Op.RetryOptions<E> | undefined,
	timeoutOptions: Op.TimeoutOptions<E> | undefined,
	onRetrying: ((state: Op.Retrying<E>) => void) | undefined,
): Deferred<Op.Outcome<E, A>> => {
	const { signal } = controller;

	const toOutcome = (r: Result<E, A> | null): Op.Outcome<E, A> =>
		r === null ? _abortedNil : r.kind === "Ok" ? ok(r.value) : err(r.error);

	const runPromise: Promise<Op.Outcome<E, A>> = retryOptions !== undefined && onRetrying !== undefined
		? runWithRetry(op, input, signal, retryOptions, onRetrying).then(toOutcome)
		: Deferred.toPromise(op._factory(input, signal)).then(toOutcome);

	if (timeoutOptions === undefined) return Deferred.fromPromise(runPromise);

	let timerId: ReturnType<typeof setTimeout>;
	return Deferred.fromPromise(Promise.race([
		runPromise.then((outcome) => {
			clearTimeout(timerId);
			return outcome;
		}),
		new Promise<Op.Outcome<E, A>>((resolve) => {
			timerId = setTimeout(() => {
				controller.abort();
				resolve(err(timeoutOptions.onTimeout()));
			}, timeoutOptions.ms);
		}),
	]));
};

// ---------------------------------------------------------------------------
// Strategy factories
// ---------------------------------------------------------------------------

export const makeRestartable = <I, E, A>(
	op: Op<I, E, A>,
	minInterval: number | undefined,
	retryOptions: Op.RetryOptions<E> | undefined,
	timeoutOptions: Op.TimeoutOptions<E> | undefined,
): Op.Manager<I, E, A, Op.State<E, A>> => {
	let currentState: Op.State<E, A> = _idle;
	let currentController: AbortController | undefined;
	let currentResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	let waitController: AbortController | undefined;
	let lastStartTime = 0;
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		subscribers.forEach((cb) => cb(state));
	};

	const run = (input: I): Deferred<Op.Outcome<E, A>> =>
		Deferred.fromPromise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				// Cancel any in-progress wait and the previous invocation.
				waitController?.abort();
				waitController = undefined;
				currentController?.abort();
				const prev = currentResolve;
				currentResolve = resolve;
				currentController = new AbortController();
				const controller = currentController;
				prev?.(_replacedNil); // resolve previous after updating state

				const startExecution = (): void => {
					if (currentController !== controller) return; // superseded
					lastStartTime = Date.now();
					emit(_pending);

					const onRetrying = retryOptions
						? (r: Op.Retrying<E>) => {
							if (currentController === controller) emit(r);
						}
						: undefined;

					execute(op, input, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
						if (currentController !== controller) return; // superseded — already resolved by next run()
						const r = currentResolve;
						currentResolve = undefined;
						currentController = undefined;
						emit(outcome);
						r?.(outcome);
					});
				};

				const gap = minInterval !== undefined
					? Math.max(0, minInterval - (Date.now() - lastStartTime))
					: 0;

				if (gap > 0) {
					waitController = new AbortController();
					const wc = waitController;
					cancellableWait(gap, wc.signal).then(() => {
						if (waitController === wc) waitController = undefined;
						startExecution();
					});
				} else {
					startExecution();
				}
			}),
		);

	const abort = (): void => {
		waitController?.abort();
		waitController = undefined;
		currentController?.abort();
		currentController = undefined;
		const r = currentResolve;
		currentResolve = undefined;
		if (currentState.kind !== "Idle") emit(_abortedNil);
		r?.(_abortedNil);
	};

	return {
		get state() {
			return currentState;
		},
		run,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (currentState.kind !== "Idle") cb(currentState);
			return () => subscribers.delete(cb);
		},
	};
};

export const makeExclusive = <I, E, A>(
	op: Op<I, E, A>,
	cooldown: number | undefined,
	retryOptions: Op.RetryOptions<E> | undefined,
	timeoutOptions: Op.TimeoutOptions<E> | undefined,
): Op.Manager<I, E, A, Op.State<E, A>> => {
	let currentState: Op.State<E, A> = _idle;
	let currentController: AbortController | undefined;
	let currentResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	let cooldownTimer: ReturnType<typeof setTimeout> | undefined;
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		subscribers.forEach((cb) => cb(state));
	};

	const run = (input: I): Deferred<Op.Outcome<E, A>> => {
		if (currentController !== undefined || cooldownTimer !== undefined) {
			// In-flight or in cooldown — drop this call immediately.
			return Deferred.fromPromise(Promise.resolve(_droppedNil));
		}
		return Deferred.fromPromise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				currentResolve = resolve;
				currentController = new AbortController();
				const controller = currentController;
				emit(_pending);

				const onRetrying = retryOptions
					? (r: Op.Retrying<E>) => {
						if (currentController === controller) emit(r);
					}
					: undefined;

				execute(op, input, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
					if (currentController !== controller) return;
					const r = currentResolve;
					currentResolve = undefined;
					currentController = undefined;
					emit(outcome);
					r?.(outcome);
					if (cooldown !== undefined && cooldown > 0) {
						cooldownTimer = setTimeout(() => {
							cooldownTimer = undefined;
						}, cooldown);
					}
				});
			}),
		);
	};

	const abort = (): void => {
		if (cooldownTimer !== undefined) {
			clearTimeout(cooldownTimer);
			cooldownTimer = undefined;
		}
		currentController?.abort();
		currentController = undefined;
		const r = currentResolve;
		currentResolve = undefined;
		if (currentState.kind !== "Idle") emit(_abortedNil);
		r?.(_abortedNil);
	};

	return {
		get state() {
			return currentState;
		},
		run,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (currentState.kind !== "Idle") cb(currentState);
			return () => subscribers.delete(cb);
		},
	};
};

export const makeQueue = <I, E, A>(
	op: Op<I, E, A>,
	maxSize: number | undefined,
	overflow: "drop" | "replace-last" | undefined,
	concurrency: number | undefined,
	dedupe: ((a: I, b: I) => boolean) | undefined,
	retryOptions: Op.RetryOptions<E> | undefined,
	timeoutOptions: Op.TimeoutOptions<E> | undefined,
): Op.Manager<I, E, A, Op.State<E, A>> => {
	const maxConcurrency = concurrency ?? 1;
	let currentState: Op.State<E, A> = _idle;
	let generation = 0;
	let inFlight = 0;
	const queue: Array<{ input: I; resolve: (o: Op.Outcome<E, A>) => void }> = [];
	const inflightControllers = new Set<AbortController>();
	const inflightResolvers: Array<(o: Op.Outcome<E, A>) => void> = [];
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		subscribers.forEach((cb) => cb(state));
	};

	const startOne = (input: I, resolve: (o: Op.Outcome<E, A>) => void, myGeneration: number): void => {
		inFlight++;
		const controller = new AbortController();
		inflightControllers.add(controller);
		inflightResolvers.push(resolve);
		emit(_pending);

		const onRetrying = retryOptions
			? (r: Op.Retrying<E>) => {
				if (generation === myGeneration && inflightControllers.has(controller)) emit(r);
			}
			: undefined;

		execute(op, input, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
			inflightControllers.delete(controller);
			const idx = inflightResolvers.indexOf(resolve);
			if (idx !== -1) inflightResolvers.splice(idx, 1);

			if (generation !== myGeneration) {
				resolve(_abortedNil);
				return;
			}

			inFlight--;
			emit(outcome);
			resolve(outcome);

			if (queue.length > 0) {
				const next = queue.shift()!;
				startOne(next.input, next.resolve, generation);
			}
		});
	};

	const run = (input: I): Deferred<Op.Outcome<E, A>> => {
		const myGeneration = generation;

		// Dedupe: scan queue for a matching item — drop the duplicate, new item takes its place.
		if (dedupe !== undefined) {
			const idx = queue.findIndex((item) => dedupe(input, item.input));
			if (idx !== -1) {
				const dup = queue.splice(idx, 1)[0];
				dup.resolve(_droppedNil);
			}
		}

		// Slot available — start immediately.
		if (inFlight < maxConcurrency) {
			return Deferred.fromPromise(
				new Promise<Op.Outcome<E, A>>((resolve) => {
					startOne(input, resolve, myGeneration);
				}),
			);
		}

		// Queue has capacity (unbounded when maxSize is undefined).
		if (maxSize === undefined || queue.length < maxSize) {
			return Deferred.fromPromise(
				new Promise<Op.Outcome<E, A>>((resolve) => {
					queue.push({ input, resolve });
					emit({ kind: "Queued", position: queue.length - 1 });
				}),
			);
		}

		// Queue is full — apply overflow policy.
		if (overflow === "replace-last") {
			return Deferred.fromPromise(
				new Promise<Op.Outcome<E, A>>((resolve) => {
					const tail = queue.pop()!;
					tail.resolve(_evictedNil);
					queue.push({ input, resolve });
					emit({ kind: "Queued", position: queue.length - 1 });
				}),
			);
		}

		// Drop (default when maxSize is set).
		return Deferred.fromPromise(Promise.resolve(_droppedNil));
	};

	const abort = (): void => {
		generation++;
		inflightControllers.forEach((c) => c.abort());
		inflightControllers.clear();
		const toResolve = inflightResolvers.splice(0);
		const queuedResolvers = queue.splice(0).map((item) => item.resolve);
		inFlight = 0;
		if (currentState.kind !== "Idle") emit(_abortedNil);
		toResolve.forEach((r) => r(_abortedNil));
		queuedResolvers.forEach((r) => r(_abortedNil));
	};

	return {
		get state() {
			return currentState;
		},
		run,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (currentState.kind !== "Idle") cb(currentState);
			return () => subscribers.delete(cb);
		},
	};
};

export const makeBuffered = <I, E, A>(
	op: Op<I, E, A>,
	size: number | undefined,
	retryOptions: Op.RetryOptions<E> | undefined,
	timeoutOptions: Op.TimeoutOptions<E> | undefined,
): Op.Manager<I, E, A, Op.State<E, A>> => {
	const bufferSize = size ?? 1;
	let currentState: Op.State<E, A> = _idle;
	let currentController: AbortController | undefined;
	let currentResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	const buffer: Array<{ input: I; resolve: (o: Op.Outcome<E, A>) => void }> = [];
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		subscribers.forEach((cb) => cb(state));
	};

	const startRun = (input: I, resolve: (o: Op.Outcome<E, A>) => void): void => {
		currentResolve = resolve;
		currentController = new AbortController();
		const controller = currentController;
		emit(_pending);

		const onRetrying = retryOptions
			? (r: Op.Retrying<E>) => {
				if (currentController === controller) emit(r);
			}
			: undefined;

		execute(op, input, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
			if (currentController !== controller) return;
			const r = currentResolve;
			currentResolve = undefined;
			currentController = undefined;
			emit(outcome);
			r?.(outcome);
			if (buffer.length > 0) {
				const next = buffer.shift()!;
				startRun(next.input, next.resolve);
			}
		});
	};

	const run = (input: I): Deferred<Op.Outcome<E, A>> =>
		Deferred.fromPromise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				if (currentController === undefined) {
					startRun(input, resolve);
				} else if (buffer.length < bufferSize) {
					// Buffer has capacity — enqueue.
					buffer.push({ input, resolve });
					emit({ kind: "Queued", position: buffer.length - 1 });
				} else {
					// Buffer full — evict oldest (head) and enqueue new item.
					const evicted = buffer.shift()!;
					evicted.resolve(_evictedNil);
					buffer.push({ input, resolve });
					emit({ kind: "Queued", position: buffer.length - 1 });
				}
			}),
		);

	const abort = (): void => {
		currentController?.abort();
		currentController = undefined;
		const cr = currentResolve;
		currentResolve = undefined;
		const bufferedResolvers = buffer.splice(0).map((item) => item.resolve);
		if (currentState.kind !== "Idle") emit(_abortedNil);
		cr?.(_abortedNil);
		bufferedResolvers.forEach((r) => r(_abortedNil));
	};

	return {
		get state() {
			return currentState;
		},
		run,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (currentState.kind !== "Idle") cb(currentState);
			return () => subscribers.delete(cb);
		},
	};
};

export const makeDebounced = <I, E, A>(
	op: Op<I, E, A>,
	ms: number,
	leading: boolean,
	maxWait: number | undefined,
	retryOptions: Op.RetryOptions<E> | undefined,
	timeoutOptions: Op.TimeoutOptions<E> | undefined,
): Op.Manager<I, E, A, Op.State<E, A>> => {
	let currentState: Op.State<E, A> = _idle;
	// Trailing execution state
	let currentController: AbortController | undefined;
	let currentResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	// Leading execution state
	let leadingController: AbortController | undefined;
	let leadingResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	// Pending (waiting for timer) state
	let pendingResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	let timerId: ReturnType<typeof setTimeout> | undefined;
	let pendingInput: I | undefined;
	let firstCallAt = 0; // timestamp of first call in current burst; 0 = no burst
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		subscribers.forEach((cb) => cb(state));
	};

	const fireLeading = (input: I, resolve: (o: Op.Outcome<E, A>) => void): void => {
		leadingController = new AbortController();
		const controller = leadingController;
		leadingResolve = resolve;
		emit(_pending);

		const onRetrying = retryOptions
			? (r: Op.Retrying<E>) => {
				if (leadingController === controller) emit(r);
			}
			: undefined;

		execute(op, input, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
			if (leadingController !== controller) return;
			const r = leadingResolve;
			leadingResolve = undefined;
			leadingController = undefined;
			emit(outcome);
			r?.(outcome);
		});
	};

	const fireTrailing = (): void => {
		timerId = undefined;
		firstCallAt = 0;
		const capturedResolve = pendingResolve;
		pendingResolve = undefined;
		if (capturedResolve === undefined) return; // leading-only burst — no trailing call pending
		currentResolve = capturedResolve;
		const toRun = pendingInput as I;
		pendingInput = undefined;
		currentController = new AbortController();
		const controller = currentController;
		emit(_pending);

		const onRetrying = retryOptions
			? (r: Op.Retrying<E>) => {
				if (currentController === controller) emit(r);
			}
			: undefined;

		execute(op, toRun, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
			if (currentController !== controller) return;
			const r = currentResolve;
			currentResolve = undefined;
			currentController = undefined;
			emit(outcome);
			r?.(outcome);
		});
	};

	const scheduleTrailing = (): void => {
		if (timerId !== undefined) clearTimeout(timerId);
		let delay = ms;
		if (maxWait !== undefined && firstCallAt > 0) {
			const maxDelay = firstCallAt + maxWait - Date.now();
			delay = Math.min(ms, Math.max(0, maxDelay));
		}
		timerId = setTimeout(fireTrailing, delay);
	};

	const inDebounceWindow = (): boolean =>
		timerId !== undefined || leadingController !== undefined || currentController !== undefined;

	const run = (input: I): Deferred<Op.Outcome<E, A>> =>
		Deferred.fromPromise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				if (!inDebounceWindow()) {
					// Fresh start.
					firstCallAt = Date.now();
					if (leading) {
						fireLeading(input, resolve);
						scheduleTrailing(); // start timer to track debounce window
					} else {
						pendingInput = input;
						pendingResolve = resolve;
						scheduleTrailing();
					}
				} else {
					// In debounce window — replace pending trailing call.
					const prev = pendingResolve;
					pendingInput = input;
					pendingResolve = resolve;
					prev?.(_evictedNil);
					scheduleTrailing();
				}
			}),
		);

	const abort = (): void => {
		if (timerId !== undefined) {
			clearTimeout(timerId);
			timerId = undefined;
			pendingInput = undefined;
			firstCallAt = 0;
		}
		const pr = pendingResolve;
		pendingResolve = undefined;
		const cr = currentResolve;
		currentResolve = undefined;
		currentController?.abort();
		currentController = undefined;
		const lr = leadingResolve;
		leadingResolve = undefined;
		leadingController?.abort();
		leadingController = undefined;
		if (currentState.kind !== "Idle") emit(_abortedNil);
		pr?.(_abortedNil);
		cr?.(_abortedNil);
		lr?.(_abortedNil);
	};

	return {
		get state() {
			return currentState;
		},
		run,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (currentState.kind !== "Idle") cb(currentState);
			return () => subscribers.delete(cb);
		},
	};
};

export const makeThrottled = <I, E, A>(
	op: Op<I, E, A>,
	ms: number,
	trailing: boolean,
	retryOptions: Op.RetryOptions<E> | undefined,
	timeoutOptions: Op.TimeoutOptions<E> | undefined,
): Op.Manager<I, E, A, Op.State<E, A>> => {
	let currentState: Op.State<E, A> = _idle;
	let currentController: AbortController | undefined;
	let currentResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	let cooldownTimer: ReturnType<typeof setTimeout> | undefined;
	let pendingInput: I | undefined;
	let pendingResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		subscribers.forEach((cb) => cb(state));
	};

	const fireOp = (input: I, resolve: (o: Op.Outcome<E, A>) => void): void => {
		currentResolve = resolve;
		currentController = new AbortController();
		const controller = currentController;
		emit(_pending);

		const onRetrying = retryOptions
			? (r: Op.Retrying<E>) => {
				if (currentController === controller) emit(r);
			}
			: undefined;

		execute(op, input, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
			if (currentController !== controller) return;
			const r = currentResolve;
			currentResolve = undefined;
			currentController = undefined;
			emit(outcome);
			r?.(outcome);
		});
	};

	const startCooldown = (): void => {
		cooldownTimer = setTimeout(() => {
			cooldownTimer = undefined;
			if (trailing && pendingInput !== undefined) {
				const input = pendingInput as I;
				const resolve = pendingResolve!;
				pendingInput = undefined;
				pendingResolve = undefined;
				fireOp(input, resolve);
				startCooldown(); // trailing fire holds its own cooldown window
			}
		}, ms);
	};

	const run = (input: I): Deferred<Op.Outcome<E, A>> => {
		if (cooldownTimer !== undefined) {
			if (!trailing) {
				return Deferred.fromPromise(Promise.resolve(_droppedNil));
			}
			return Deferred.fromPromise(
				new Promise<Op.Outcome<E, A>>((resolve) => {
					const prev = pendingResolve;
					pendingInput = input;
					pendingResolve = resolve;
					prev?.(_evictedNil);
				}),
			);
		}
		return Deferred.fromPromise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				fireOp(input, resolve);
				startCooldown();
			}),
		);
	};

	const abort = (): void => {
		if (cooldownTimer !== undefined) {
			clearTimeout(cooldownTimer);
			cooldownTimer = undefined;
		}
		currentController?.abort();
		currentController = undefined;
		const cr = currentResolve;
		currentResolve = undefined;
		const pr = pendingResolve;
		pendingResolve = undefined;
		pendingInput = undefined;
		if (currentState.kind !== "Idle") emit(_abortedNil);
		cr?.(_abortedNil);
		pr?.(_abortedNil);
	};

	return {
		get state() {
			return currentState;
		},
		run,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (currentState.kind !== "Idle") cb(currentState);
			return () => subscribers.delete(cb);
		},
	};
};

export const makeConcurrent = <I, E, A>(
	op: Op<I, E, A>,
	n: number,
	overflow: "queue" | "drop",
	retryOptions: Op.RetryOptions<E> | undefined,
	timeoutOptions: Op.TimeoutOptions<E> | undefined,
): Op.Manager<I, E, A, Op.State<E, A>> => {
	let currentState: Op.State<E, A> = _idle;
	let inflight = 0;
	let generation = 0;
	const controllers = new Set<AbortController>();
	const inflightResolvers: Array<(o: Op.Outcome<E, A>) => void> = [];
	const overflowQueue: Array<{ input: I; resolve: (o: Op.Outcome<E, A>) => void }> = [];
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		subscribers.forEach((cb) => cb(state));
	};

	const startOne = (input: I, resolve: (o: Op.Outcome<E, A>) => void, myGeneration: number): void => {
		inflight++;
		const controller = new AbortController();
		controllers.add(controller);
		inflightResolvers.push(resolve);
		emit(_pending);

		const onRetrying = retryOptions
			? (r: Op.Retrying<E>) => {
				if (generation === myGeneration && controllers.has(controller)) emit(r);
			}
			: undefined;

		execute(op, input, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
			controllers.delete(controller);
			const idx = inflightResolvers.indexOf(resolve);
			if (idx !== -1) inflightResolvers.splice(idx, 1);

			if (generation !== myGeneration) {
				resolve(_abortedNil);
				return;
			}

			inflight--;
			emit(outcome);
			resolve(outcome);

			if (overflowQueue.length > 0) {
				const next = overflowQueue.shift()!;
				startOne(next.input, next.resolve, generation);
			}
		});
	};

	const run = (input: I): Deferred<Op.Outcome<E, A>> => {
		const myGeneration = generation;

		if (inflight < n) {
			return Deferred.fromPromise(
				new Promise<Op.Outcome<E, A>>((resolve) => {
					startOne(input, resolve, myGeneration);
				}),
			);
		}

		if (overflow === "drop") {
			return Deferred.fromPromise(Promise.resolve(_droppedNil));
		}

		return Deferred.fromPromise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				overflowQueue.push({ input, resolve });
				emit({ kind: "Queued", position: overflowQueue.length - 1 });
			}),
		);
	};

	const abort = (): void => {
		generation++;
		controllers.forEach((c) => c.abort());
		controllers.clear();
		const toResolve = inflightResolvers.splice(0);
		const queuedResolvers = overflowQueue.splice(0).map((item) => item.resolve);
		inflight = 0;
		if (currentState.kind !== "Idle") emit(_abortedNil);
		toResolve.forEach((r) => r(_abortedNil));
		queuedResolvers.forEach((r) => r(_abortedNil));
	};

	return {
		get state() {
			return currentState;
		},
		run,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (currentState.kind !== "Idle") cb(currentState);
			return () => subscribers.delete(cb);
		},
	};
};

export const makeKeyed = <I, K, E, A>(
	op: Op<I, E, A>,
	keyFn: (input: I) => K,
	perKey: "exclusive" | "restartable",
	timeoutOptions: Op.TimeoutOptions<E> | undefined,
): Op.KeyedManager<I, K, E, Op.KeyedExclusivePerKey<E, A> | Op.KeyedRestartablePerKey<E, A>> => {
	type PerKeyS = Op.KeyedExclusivePerKey<E, A> | Op.KeyedRestartablePerKey<E, A>;
	const stateMap = new Map<K, PerKeyS>();
	const slots = new Map<K, { controller: AbortController; resolve: (o: Op.Outcome<E, A>) => void }>();
	const subscribers = new Set<(state: ReadonlyMap<K, PerKeyS>) => void>();

	const emitSnapshot = (): void => {
		const snapshot = new Map(stateMap) as ReadonlyMap<K, PerKeyS>;
		subscribers.forEach((cb) => cb(snapshot));
	};

	const run = (input: I): Deferred<Op.Outcome<E, A>> => {
		const k = keyFn(input);

		if (slots.has(k)) {
			if (perKey === "exclusive") {
				return Deferred.fromPromise(Promise.resolve(_droppedNil));
			}
			// restartable: cancel existing slot
			const existing = slots.get(k)!;
			existing.controller.abort();
			const prev = existing.resolve;
			slots.delete(k);
			prev(_replacedNil);
		}

		return Deferred.fromPromise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				const controller = new AbortController();
				slots.set(k, { controller, resolve });
				stateMap.set(k, _pending as PerKeyS);
				emitSnapshot();

				execute(op, input, controller, undefined, timeoutOptions, undefined).then((outcome) => {
					const slot = slots.get(k);
					if (!slot || slot.controller !== controller) {
						resolve(_abortedNil);
						return;
					}
					slots.delete(k);
					stateMap.set(k, outcome as PerKeyS);
					emitSnapshot();
					resolve(outcome);
				});
			}),
		);
	};

	const abort = (key?: K): void => {
		if (key !== undefined) {
			const slot = slots.get(key);
			if (slot) {
				slot.controller.abort();
				const r = slot.resolve;
				slots.delete(key);
				stateMap.set(key, _abortedNil as PerKeyS);
				emitSnapshot();
				r(_abortedNil);
			}
		} else {
			const toResolve: Array<(o: Op.Outcome<E, A>) => void> = [];
			for (const [k, slot] of slots) {
				slot.controller.abort();
				toResolve.push(slot.resolve);
				stateMap.set(k, _abortedNil as PerKeyS);
			}
			slots.clear();
			if (toResolve.length > 0) emitSnapshot();
			toResolve.forEach((r) => r(_abortedNil));
		}
	};

	return {
		get state() {
			return new Map(stateMap) as ReadonlyMap<K, PerKeyS>;
		},
		run: run as (input: I) => Deferred<Exclude<PerKeyS, Op.Pending | Op.Retrying<E>>>,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (stateMap.size > 0) cb(new Map(stateMap) as ReadonlyMap<K, PerKeyS>);
			return () => subscribers.delete(cb);
		},
	};
};

export const makeOnce = <I, E, A>(
	op: Op<I, E, A>,
	retryOptions: Op.RetryOptions<E> | undefined,
	timeoutOptions: Op.TimeoutOptions<E> | undefined,
): Op.Manager<I, E, A, Op.State<E, A>> => {
	let currentState: Op.State<E, A> = _idle;
	let currentController: AbortController | undefined;
	let currentResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		subscribers.forEach((cb) => cb(state));
	};

	const run = (input: I): Deferred<Op.Outcome<E, A>> => {
		// Terminal: once the manager leaves Idle, all subsequent calls are dropped.
		if (currentState.kind !== "Idle") {
			return Deferred.fromPromise(Promise.resolve(_droppedNil));
		}
		return Deferred.fromPromise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				currentResolve = resolve;
				currentController = new AbortController();
				const controller = currentController;
				emit(_pending);

				const onRetrying = retryOptions
					? (r: Op.Retrying<E>) => {
						if (currentController === controller) emit(r);
					}
					: undefined;

				execute(op, input, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
					if (currentController !== controller) return;
					const r = currentResolve;
					currentResolve = undefined;
					currentController = undefined;
					emit(outcome);
					r?.(outcome);
				});
			}),
		);
	};

	const abort = (): void => {
		currentController?.abort();
		currentController = undefined;
		const r = currentResolve;
		currentResolve = undefined;
		if (currentState.kind !== "Idle") emit(_abortedNil);
		r?.(_abortedNil);
	};

	return {
		get state() {
			return currentState;
		},
		run,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (currentState.kind !== "Idle") cb(currentState);
			return () => subscribers.delete(cb);
		},
	};
};
