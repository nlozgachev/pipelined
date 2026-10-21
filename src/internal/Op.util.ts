/**
 * Internal helpers for `Op` — execution utilities and concurrency strategy factories.
 * Not part of the public API.
 */

import { Duration } from "#types";
import { Deferred } from "../Core/Deferred.ts";
import type { Op } from "../Core/Op.ts";
import { Result } from "../Core/Result.ts";

// ---------------------------------------------------------------------------
// Internal singletons & helpers
// ---------------------------------------------------------------------------

const _abortedNil: Op.Nil = { kind: "OpNil", reason: "aborted" };
const _droppedNil: Op.Nil = { kind: "OpNil", reason: "dropped" };
const _replacedNil: Op.Nil = { kind: "OpNil", reason: "replaced" };
const _evictedNil: Op.Nil = { kind: "OpNil", reason: "evicted" };
const _idle: Op.Idle = { kind: "Idle" };
const _pending: Op.Pending = { kind: "Pending" };
const ok = <A>(value: A): Op.Ok<A> => ({ kind: "OpOk", value });
const err = <E>(error: E): Op.Err<E> => ({ kind: "OpErr", error });

const getMs = (duration: Duration): number => Duration.to.milliseconds(duration);

// ---------------------------------------------------------------------------
// OP_FACTORY private symbol & internal type
// ---------------------------------------------------------------------------

export const OP_FACTORY: unique symbol = Symbol.for("@nlozgachev/pipelined/Op.factory") as typeof OP_FACTORY;

export type InternalOp<Args extends readonly unknown[] = readonly unknown[], E = unknown, A = unknown> =
	& Op<Args, E, A>
	& { readonly [OP_FACTORY]: (args: Args, signal: AbortSignal) => Deferred<Result<E, A> | null>; };

export const toInternalOp = <Args extends readonly unknown[], E, A>(op: Op<Args, E, A>): InternalOp<Args, E, A> =>
	op as unknown as InternalOp<Args, E, A>;

// ---------------------------------------------------------------------------
// cancellableWait
// ---------------------------------------------------------------------------

/** Waits by the specified duration. Resolves early if the signal fires (non-blocking abort). */
export const cancellableWait = (duration: Duration, signal: AbortSignal): Promise<void> => {
	const rawMs = getMs(duration);
	if (rawMs <= 0 || signal.aborted) { return Promise.resolve(); }
	return new Promise<void>((resolve) => {
		// oxlint-disable-next-line prefer-const
		let timerId: ReturnType<typeof setTimeout>;
		const onAbort = (): void => {
			clearTimeout(timerId);
			resolve();
		};
		timerId = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, rawMs);
		signal.addEventListener("abort", onAbort, { once: true });
	});
};

// ---------------------------------------------------------------------------
// runWithRetry
// ---------------------------------------------------------------------------

/**
 * Runs the factory with retry logic. Calls `onRetrying` before each retry delay.
 * Stops on Ok, Nil (null), abort, or exhausted attempts.
 */
export const runWithRetry = <Args extends readonly unknown[], E, A>(
	op: Op<Args, E, A>,
	args: Args,
	signal: AbortSignal,
	options: Op.RetryOptions<E>,
	onRetrying: (state: Op.Retrying<E>) => void,
): Promise<Result<E, A> | null> => {
	const { attempts, backoff, when: shouldRetry } = options;
	const getDelay = (n: number): Duration | undefined => {
		if (backoff === undefined) { return undefined; }
		if (typeof backoff === "function") { return backoff(n); }
		if (typeof backoff === "object" && backoff !== null && "getDelay" in backoff) {
			return backoff.getDelay(n);
		}
		return backoff;
	};

	const attempt = async (left: number): Promise<Result<E, A> | null> => {
		const result = await Deferred.to.Promise(toInternalOp(op)[OP_FACTORY](args, signal));
		if (result === null || signal.aborted) { return null; }
		if (result.kind === "Ok") { return result; }
		if (left <= 1) { return result; }
		if (shouldRetry !== undefined) {
			try {
				if (!shouldRetry(result.error)) { return result; }
			} catch (whenError) {
				return Result.make.err(whenError as E);
			}
		}
		const attemptNumber = attempts - left + 1;
		const delayDuration = getDelay(attemptNumber);
		const ms = delayDuration ? getMs(delayDuration) : 0;
		onRetrying({
			kind: "Retrying",
			attempt: attemptNumber,
			lastError: result.error,
			...(ms > 0 ? { nextRetryIn: ms } : {}),
		});
		if (delayDuration) {
			await cancellableWait(delayDuration, signal);
		}
		if (signal.aborted) { return null; }
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
export const execute = <Args extends readonly unknown[], E, A>(
	op: Op<Args, E, A>,
	args: Args,
	controller: AbortController,
	retryOptions?: Op.RetryOptions<E>,
	timeoutOptions?: Op.TimeoutOptions<any>,
	onRetrying?: (state: Op.Retrying<E>) => void,
): Deferred<Op.Outcome<E, A>> => {
	const { signal } = controller;

	const toOutcome = (r: Result<E, A> | null): Op.Outcome<E, A> =>
		r === null ? _abortedNil : (r.kind === "Ok" ? ok(r.value) : err(r.error));

	const runPromise: Promise<Op.Outcome<E, A>> = retryOptions !== undefined && onRetrying !== undefined
		? runWithRetry(op, args, signal, retryOptions, onRetrying).then(toOutcome)
		: Deferred.to.Promise(toInternalOp(op)[OP_FACTORY](args, signal)).then(toOutcome);

	if (timeoutOptions === undefined) { return Deferred.from.Promise(runPromise); }

	let timerId: ReturnType<typeof setTimeout>;
	return Deferred.from.Promise(Promise.race([
		runPromise.then((outcome) => {
			clearTimeout(timerId);
			return outcome;
		}),
		new Promise<Op.Outcome<E, A>>((resolve) => {
			timerId = setTimeout(() => {
				controller.abort();
				try {
					resolve(err(timeoutOptions.onTimeout()));
				} catch (timeoutHandlerError) {
					resolve(err(timeoutHandlerError as any));
				}
			}, getMs(timeoutOptions.duration));
		}),
	]));
};

// ---------------------------------------------------------------------------
// Strategy factories
// ---------------------------------------------------------------------------

export const makeRestartable = <Args extends readonly unknown[], E, A>(
	op: Op<Args, E, A>,
	minInterval?: Duration,
	retryOptions?: Op.RetryOptions<E>,
	timeoutOptions?: Op.TimeoutOptions<any>,
): Op.Manager<Args, E, A, Op.State<E, A>> => {
	let currentState: Op.State<E, A> = _idle;
	let currentController: AbortController | undefined;
	let currentResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	let waitController: AbortController | undefined;
	let lastStartTime = 0;
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		for (const cb of subscribers) {
			cb(state);
		}
	};

	const run = (...args: Args): Deferred<Op.Outcome<E, A>> =>
		Deferred.from.Promise(
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
					if (currentController !== controller) { return; // superseded
					 }
					lastStartTime = Date.now();
					emit(_pending);

					// Passing emit directly is safe: superseding or aborting calls controller.abort(),
					// causing runWithRetry to exit early before onRetrying is ever invoked.
					const onRetrying = retryOptions ? emit : undefined;

					execute(op, args, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
						if (currentController !== controller) { return; // superseded — already resolved by next run()
						 }
						const r = currentResolve;
						currentResolve = undefined;
						currentController = undefined;
						emit(outcome);
						r?.(outcome);
					});
				};

				const gap = minInterval !== undefined ? Math.max(0, getMs(minInterval) - (Date.now() - lastStartTime)) : 0;

				if (gap > 0) {
					waitController = new AbortController();
					const wc = waitController;
					cancellableWait(Duration.milliseconds(gap), wc.signal).then(() => {
						if (waitController === wc) { waitController = undefined; }
						startExecution();
					});
				} else {
					startExecution();
				}
			}),
		);

	const abort = (): void => {
		const hadWork = currentController !== undefined || waitController !== undefined;
		waitController?.abort();
		waitController = undefined;
		currentController?.abort();
		currentController = undefined;
		const r = currentResolve;
		currentResolve = undefined;
		if (hadWork) { emit(_abortedNil); }
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
			if (currentState.kind !== "Idle") { cb(currentState); }
			return () => subscribers.delete(cb);
		},
		reset: () => {
			waitController?.abort();
			waitController = undefined;
			currentController?.abort();
			currentController = undefined;
			const r = currentResolve;
			currentResolve = undefined;
			emit(_idle);
			r?.(_abortedNil);
		},
		poll: ({ interval }: { interval: Duration; }) => (...args: Args) => {
			void run(...args);
			const id = setInterval(() => void run(...args), getMs(interval));
			return () => clearInterval(id);
		},
	};
};

export const makeExclusive = <Args extends readonly unknown[], E, A>(
	op: Op<Args, E, A>,
	cooldown?: Duration,
	retryOptions?: Op.RetryOptions<E>,
	timeoutOptions?: Op.TimeoutOptions<any>,
): Op.Manager<Args, E, A, Op.State<E, A>> => {
	let currentState: Op.State<E, A> = _idle;
	let currentController: AbortController | undefined;
	let currentResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	let cooldownTimer: ReturnType<typeof setTimeout> | undefined;
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		for (const cb of subscribers) {
			cb(state);
		}
	};

	const run = (...args: Args): Deferred<Op.Outcome<E, A>> => {
		if (currentController !== undefined || cooldownTimer !== undefined) {
			// In-flight or in cooldown — drop this call immediately.
			return Deferred.from.Promise(Promise.resolve(_droppedNil));
		}
		return Deferred.from.Promise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				currentResolve = resolve;
				currentController = new AbortController();
				const controller = currentController;
				emit(_pending);

				// Passing emit directly is safe: exclusive drops overlapping runs, and abort()
				// calls controller.abort(), causing runWithRetry to exit before onRetrying fires.
				const onRetrying = retryOptions ? emit : undefined;

				execute(op, args, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
					if (currentController !== controller) { return; }
					const r = currentResolve;
					currentResolve = undefined;
					currentController = undefined;
					emit(outcome);
					r?.(outcome);
					if (cooldown !== undefined) {
						const rawCooldown = getMs(cooldown);
						if (rawCooldown > 0) {
							cooldownTimer = setTimeout(() => {
								cooldownTimer = undefined;
							}, rawCooldown);
						}
					}
				});
			}),
		);
	};

	const abort = (): void => {
		const hadWork = currentController !== undefined;
		if (cooldownTimer !== undefined) {
			clearTimeout(cooldownTimer);
			cooldownTimer = undefined;
		}
		currentController?.abort();
		currentController = undefined;
		const r = currentResolve;
		currentResolve = undefined;
		if (hadWork) { emit(_abortedNil); }
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
			if (currentState.kind !== "Idle") { cb(currentState); }
			return () => subscribers.delete(cb);
		},
		reset: () => {
			if (cooldownTimer !== undefined) {
				clearTimeout(cooldownTimer);
				cooldownTimer = undefined;
			}
			currentController?.abort();
			currentController = undefined;
			const r = currentResolve;
			currentResolve = undefined;
			emit(_idle);
			r?.(_abortedNil);
		},
		poll: ({ interval }: { interval: Duration; }) => (...args: Args) => {
			void run(...args);
			const id = setInterval(() => void run(...args), getMs(interval));
			return () => clearInterval(id);
		},
	};
};

export const makeQueue = <Args extends readonly unknown[], E, A>(
	op: Op<Args, E, A>,
	maxSize?: number,
	overflow?: "drop" | "replace-last",
	concurrency?: number,
	dedupe?: (a: Args, b: Args) => boolean,
	retryOptions?: Op.RetryOptions<E>,
	timeoutOptions?: Op.TimeoutOptions<any>,
): Op.Manager<Args, E, A, Op.State<E, A>> => {
	const maxConcurrency = concurrency ?? 1;
	let currentState: Op.State<E, A> = _idle;
	let generation = 0;
	let inFlight = 0;
	const queue: Array<{ input: Args; resolve: (o: Op.Outcome<E, A>) => void; }> = [];
	const inflightControllers = new Set<AbortController>();
	const inflightResolvers: Array<(o: Op.Outcome<E, A>) => void> = [];
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		for (const cb of subscribers) {
			cb(state);
		}
	};

	const startOne = (args: Args, resolve: (o: Op.Outcome<E, A>) => void, myGeneration: number): void => {
		inFlight++;
		const controller = new AbortController();
		inflightControllers.add(controller);
		inflightResolvers.push(resolve);
		emit(_pending);

		// Passing emit directly is safe: abort() aborts all inflightControllers,
		// causing runWithRetry to exit early before onRetrying fires.
		const onRetrying = retryOptions ? emit : undefined;

		execute(op, args, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
			inflightControllers.delete(controller);
			const idx = inflightResolvers.indexOf(resolve);
			if (idx !== -1) { inflightResolvers.splice(idx, 1); }

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

	const run = (...args: Args): Deferred<Op.Outcome<E, A>> => {
		const myGeneration = generation;

		// Dedupe: scan queue for a matching item — drop the duplicate, new item takes its place.
		if (dedupe !== undefined) {
			const idx = queue.findIndex((item) => {
				try {
					return dedupe(args, item.input);
				} catch {
					return false;
				}
			});
			if (idx !== -1) {
				// oxlint-disable-next-line prefer-destructuring
				const dup = queue.splice(idx, 1)[0];
				dup.resolve(_droppedNil);
			}
		}

		// Slot available — start immediately.
		if (inFlight < maxConcurrency) {
			return Deferred.from.Promise(
				new Promise<Op.Outcome<E, A>>((resolve) => {
					startOne(args, resolve, myGeneration);
				}),
			);
		}

		// Queue has capacity (unbounded when maxSize is undefined).
		if (maxSize === undefined || queue.length < maxSize) {
			return Deferred.from.Promise(
				new Promise<Op.Outcome<E, A>>((resolve) => {
					queue.push({ input: args, resolve });
					emit({ kind: "Queued", position: queue.length - 1 });
				}),
			);
		}

		// Queue is full — apply overflow policy.
		if (overflow === "replace-last") {
			return Deferred.from.Promise(
				new Promise<Op.Outcome<E, A>>((resolve) => {
					const tail = queue.pop()!;
					tail.resolve(_evictedNil);
					queue.push({ input: args, resolve });
					emit({ kind: "Queued", position: queue.length - 1 });
				}),
			);
		}

		// Drop (default when maxSize is set).
		return Deferred.from.Promise(Promise.resolve(_droppedNil));
	};

	const abort = (): void => {
		const hadWork = inFlight > 0 || queue.length > 0;
		generation++;
		for (const c of inflightControllers) {
			c.abort();
		}
		inflightControllers.clear();
		for (const r of inflightResolvers) {
			r(_abortedNil);
		}
		inflightResolvers.length = 0;
		for (const item of queue) {
			item.resolve(_abortedNil);
		}
		queue.length = 0;
		inFlight = 0;
		if (hadWork) { emit(_abortedNil); }
	};

	return {
		get state() {
			return currentState;
		},
		run,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (currentState.kind !== "Idle") { cb(currentState); }
			return () => subscribers.delete(cb);
		},
		reset: () => {
			generation++;
			for (const c of inflightControllers) {
				c.abort();
			}
			inflightControllers.clear();
			for (const r of inflightResolvers) {
				r(_abortedNil);
			}
			inflightResolvers.length = 0;
			for (const item of queue) {
				item.resolve(_abortedNil);
			}
			queue.length = 0;
			inFlight = 0;
			emit(_idle);
		},
		poll: ({ interval }: { interval: Duration; }) => (...args: Args) => {
			void run(...args);
			const id = setInterval(() => void run(...args), getMs(interval));
			return () => clearInterval(id);
		},
	};
};

export const makeBuffered = <Args extends readonly unknown[], E, A>(
	op: Op<Args, E, A>,
	size?: number,
	retryOptions?: Op.RetryOptions<E>,
	timeoutOptions?: Op.TimeoutOptions<any>,
): Op.Manager<Args, E, A, Op.State<E, A>> => {
	const bufferSize = size ?? 1;
	let currentState: Op.State<E, A> = _idle;
	let currentController: AbortController | undefined;
	let currentResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	const buffer: Array<{ input: Args; resolve: (o: Op.Outcome<E, A>) => void; }> = [];
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		for (const cb of subscribers) {
			cb(state);
		}
	};

	const startRun = (args: Args, resolve: (o: Op.Outcome<E, A>) => void): void => {
		currentResolve = resolve;
		currentController = new AbortController();
		const controller = currentController;
		emit(_pending);

		// Passing emit directly is safe: buffered calls run strictly sequentially, and abort()
		// calls controller.abort(), causing runWithRetry to exit early before onRetrying fires.
		const onRetrying = retryOptions ? emit : undefined;

		execute(op, args, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
			if (currentController !== controller) { return; }
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

	const run = (...args: Args): Deferred<Op.Outcome<E, A>> =>
		Deferred.from.Promise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				if (currentController === undefined) {
					startRun(args, resolve);
				} else if (buffer.length < bufferSize) {
					// Buffer has capacity — enqueue.
					buffer.push({ input: args, resolve });
					emit({ kind: "Queued", position: buffer.length - 1 });
				} else {
					// Buffer full — evict oldest (head) and enqueue new item.
					const evicted = buffer.shift()!;
					evicted.resolve(_evictedNil);
					buffer.push({ input: args, resolve });
					emit({ kind: "Queued", position: buffer.length - 1 });
				}
			}),
		);

	const abort = (): void => {
		const hadWork = currentController !== undefined || buffer.length > 0;
		currentController?.abort();
		currentController = undefined;
		const cr = currentResolve;
		currentResolve = undefined;
		if (hadWork) { emit(_abortedNil); }
		cr?.(_abortedNil);
		for (const item of buffer) {
			item.resolve(_abortedNil);
		}
		buffer.length = 0;
	};

	return {
		get state() {
			return currentState;
		},
		run,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (currentState.kind !== "Idle") { cb(currentState); }
			return () => subscribers.delete(cb);
		},
		reset: () => {
			currentController?.abort();
			currentController = undefined;
			const cr = currentResolve;
			currentResolve = undefined;
			for (const item of buffer) {
				item.resolve(_abortedNil);
			}
			buffer.length = 0;
			emit(_idle);
			cr?.(_abortedNil);
		},
		poll: ({ interval }: { interval: Duration; }) => (...args: Args) => {
			void run(...args);
			const id = setInterval(() => void run(...args), getMs(interval));
			return () => clearInterval(id);
		},
	};
};

export const makeDebounced = <Args extends readonly unknown[], E, A>(
	op: Op<Args, E, A>,
	duration: Duration,
	leading: boolean,
	maxWait?: Duration,
	retryOptions?: Op.RetryOptions<E>,
	timeoutOptions?: Op.TimeoutOptions<any>,
): Op.Manager<Args, E, A, Op.State<E, A>> => {
	let currentState: Op.State<E, A> = _idle;
	// Trailing execution state
	let latestTrailingController: AbortController | undefined;
	const trailingResolvers = new Map<AbortController, (o: Op.Outcome<E, A>) => void>();
	// Leading execution state
	let leadingController: AbortController | undefined;
	let leadingResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	// Pending (waiting for timer) state
	let pendingResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	let timerId: ReturnType<typeof setTimeout> | undefined;
	let pendingInput: Args | undefined;
	let firstCallAt = 0; // timestamp of first call in current burst; 0 = no burst
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		for (const cb of subscribers) {
			cb(state);
		}
	};

	const fireLeading = (args: Args, resolve: (o: Op.Outcome<E, A>) => void): void => {
		leadingController = new AbortController();
		const controller = leadingController;
		leadingResolve = resolve;
		emit(_pending);

		// Passing emit directly is safe: leading calls fire only on fresh bursts, and abort()
		// calls controller.abort(), causing runWithRetry to exit early before onRetrying fires.
		const onRetrying = retryOptions ? emit : undefined;

		execute(op, args, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
			if (leadingController !== controller) { return; }
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
		if (capturedResolve === undefined) { return; // leading-only burst — no trailing call pending
		 }
		const toRun = pendingInput as Args;
		pendingInput = undefined;
		const controller = new AbortController();
		latestTrailingController = controller;
		trailingResolvers.set(controller, capturedResolve);
		emit(_pending);

		// Guard required: fireTrailing runs when the debounce timer expires without aborting
		// an in-flight execution, so retries from the predecessor must not overwrite current state.
		const onRetrying = retryOptions
			? (r: Op.Retrying<E>) => {
				if (latestTrailingController === controller) { emit(r); }
			}
			: undefined;

		execute(op, toRun, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
			const r = trailingResolvers.get(controller);
			trailingResolvers.delete(controller);
			r?.(outcome);
			if (latestTrailingController === controller) {
				latestTrailingController = undefined;
				emit(outcome);
			}
		});
	};

	const scheduleTrailing = (): void => {
		if (timerId !== undefined) { clearTimeout(timerId); }
		let delay = getMs(duration);
		if (maxWait !== undefined && firstCallAt > 0) {
			const maxDelay = firstCallAt + getMs(maxWait) - Date.now();
			delay = Math.min(getMs(duration), Math.max(0, maxDelay));
		}
		timerId = setTimeout(fireTrailing, delay);
	};

	const inDebounceWindow = (): boolean =>
		timerId !== undefined || leadingController !== undefined || trailingResolvers.size > 0;

	const run = (...args: Args): Deferred<Op.Outcome<E, A>> =>
		Deferred.from.Promise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				if (!inDebounceWindow()) {
					// Fresh start.
					firstCallAt = Date.now();
					if (leading) {
						fireLeading(args, resolve);
						scheduleTrailing(); // start timer to track debounce window
					} else {
						pendingInput = args;
						pendingResolve = resolve;
						scheduleTrailing();
					}
				} else {
					// In debounce window — replace pending trailing call.
					const prev = pendingResolve;
					pendingInput = args;
					pendingResolve = resolve;
					prev?.(_evictedNil);
					scheduleTrailing();
				}
			}),
		);

	const abort = (): void => {
		const hadWork = leadingController !== undefined || trailingResolvers.size > 0;
		if (timerId !== undefined) {
			clearTimeout(timerId);
			timerId = undefined;
			pendingInput = undefined;
			firstCallAt = 0;
		}
		const pr = pendingResolve;
		pendingResolve = undefined;
		const lr = leadingResolve;
		leadingResolve = undefined;
		leadingController?.abort();
		leadingController = undefined;
		for (const [c, r] of trailingResolvers) {
			c.abort();
			r(_abortedNil);
		}
		trailingResolvers.clear();
		latestTrailingController = undefined;
		if (hadWork) { emit(_abortedNil); }
		pr?.(_abortedNil);
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
			if (currentState.kind !== "Idle") { cb(currentState); }
			return () => subscribers.delete(cb);
		},
		reset: () => {
			if (timerId !== undefined) {
				clearTimeout(timerId);
				timerId = undefined;
			}
			pendingInput = undefined;
			const pr = pendingResolve;
			pendingResolve = undefined;
			firstCallAt = 0;
			leadingController?.abort();
			leadingController = undefined;
			const lr = leadingResolve;
			leadingResolve = undefined;
			for (const [c, r] of trailingResolvers) {
				c.abort();
				r(_abortedNil);
			}
			trailingResolvers.clear();
			latestTrailingController = undefined;
			emit(_idle);
			pr?.(_abortedNil);
			lr?.(_abortedNil);
		},
		poll: ({ interval }: { interval: Duration; }) => (...args: Args) => {
			void run(...args);
			const id = setInterval(() => void run(...args), getMs(interval));
			return () => clearInterval(id);
		},
	};
};

export const makeThrottled = <Args extends readonly unknown[], E, A>(
	op: Op<Args, E, A>,
	duration: Duration,
	trailing: boolean,
	retryOptions?: Op.RetryOptions<E>,
	timeoutOptions?: Op.TimeoutOptions<any>,
): Op.Manager<Args, E, A, Op.State<E, A>> => {
	let currentState: Op.State<E, A> = _idle;
	let latestController: AbortController | undefined;
	const inFlightResolvers = new Map<AbortController, (o: Op.Outcome<E, A>) => void>();
	let cooldownTimer: ReturnType<typeof setTimeout> | undefined;
	let pendingInput: Args | undefined;
	let pendingResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		for (const cb of subscribers) {
			cb(state);
		}
	};

	const fireOp = (args: Args, resolve: (o: Op.Outcome<E, A>) => void): void => {
		const controller = new AbortController();
		latestController = controller;
		inFlightResolvers.set(controller, resolve);
		emit(_pending);

		// Guard required: fireOp for trailing execution starts when cooldown expires without aborting
		// an in-flight execution, so retries from the predecessor must not overwrite current state.
		const onRetrying = retryOptions
			? (r: Op.Retrying<E>) => {
				if (latestController === controller) { emit(r); }
			}
			: undefined;

		execute(op, args, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
			const r = inFlightResolvers.get(controller);
			inFlightResolvers.delete(controller);
			r?.(outcome);
			if (latestController === controller) {
				latestController = undefined;
				emit(outcome);
			}
		});
	};

	const startCooldown = (): void => {
		cooldownTimer = setTimeout(() => {
			cooldownTimer = undefined;
			if (trailing && pendingInput !== undefined) {
				const toRun = pendingInput as Args;
				const resolve = pendingResolve!;
				pendingInput = undefined;
				pendingResolve = undefined;
				fireOp(toRun, resolve);
				startCooldown(); // trailing fire holds its own cooldown window
			}
		}, getMs(duration));
	};

	const run = (...args: Args): Deferred<Op.Outcome<E, A>> => {
		if (cooldownTimer !== undefined) {
			if (!trailing) {
				return Deferred.from.Promise(Promise.resolve(_droppedNil));
			}
			return Deferred.from.Promise(
				new Promise<Op.Outcome<E, A>>((resolve) => {
					const prev = pendingResolve;
					pendingInput = args;
					pendingResolve = resolve;
					prev?.(_evictedNil);
				}),
			);
		}
		return Deferred.from.Promise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				fireOp(args, resolve);
				startCooldown();
			}),
		);
	};

	const abort = (): void => {
		const hadWork = inFlightResolvers.size > 0 || pendingResolve !== undefined;
		if (cooldownTimer !== undefined) {
			clearTimeout(cooldownTimer);
			cooldownTimer = undefined;
		}
		for (const [c, r] of inFlightResolvers) {
			c.abort();
			r(_abortedNil);
		}
		inFlightResolvers.clear();
		latestController = undefined;
		const pr = pendingResolve;
		pendingResolve = undefined;
		pendingInput = undefined;
		if (hadWork) { emit(_abortedNil); }
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
			if (currentState.kind !== "Idle") { cb(currentState); }
			return () => subscribers.delete(cb);
		},
		reset: () => {
			if (cooldownTimer !== undefined) {
				clearTimeout(cooldownTimer);
				cooldownTimer = undefined;
			}
			for (const [c, r] of inFlightResolvers) {
				c.abort();
				r(_abortedNil);
			}
			inFlightResolvers.clear();
			latestController = undefined;
			pendingInput = undefined;
			const pr = pendingResolve;
			pendingResolve = undefined;
			emit(_idle);
			pr?.(_abortedNil);
		},
		poll: ({ interval }: { interval: Duration; }) => (...args: Args) => {
			void run(...args);
			const id = setInterval(() => void run(...args), getMs(interval));
			return () => clearInterval(id);
		},
	};
};

export const makeConcurrent = <Args extends readonly unknown[], E, A>(
	op: Op<Args, E, A>,
	n: number,
	overflow: "queue" | "drop",
	retryOptions?: Op.RetryOptions<E>,
	timeoutOptions?: Op.TimeoutOptions<any>,
): Op.Manager<Args, E, A, Op.State<E, A>> => {
	let currentState: Op.State<E, A> = _idle;
	let inflight = 0;
	let generation = 0;
	const controllers = new Set<AbortController>();
	const inflightResolvers: Array<(o: Op.Outcome<E, A>) => void> = [];
	const overflowQueue: Array<{ input: Args; resolve: (o: Op.Outcome<E, A>) => void; }> = [];
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		for (const cb of subscribers) {
			cb(state);
		}
	};

	const startOne = (args: Args, resolve: (o: Op.Outcome<E, A>) => void, myGeneration: number): void => {
		inflight++;
		const controller = new AbortController();
		controllers.add(controller);
		inflightResolvers.push(resolve);
		emit(_pending);

		// Passing emit directly is safe: abort() aborts all controllers,
		// causing runWithRetry to exit early before onRetrying fires.
		const onRetrying = retryOptions ? emit : undefined;

		execute(op, args, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
			controllers.delete(controller);
			const idx = inflightResolvers.indexOf(resolve);
			if (idx !== -1) { inflightResolvers.splice(idx, 1); }

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

	const run = (...args: Args): Deferred<Op.Outcome<E, A>> => {
		const myGeneration = generation;

		if (inflight < n) {
			return Deferred.from.Promise(
				new Promise<Op.Outcome<E, A>>((resolve) => {
					startOne(args, resolve, myGeneration);
				}),
			);
		}

		if (overflow === "drop") {
			return Deferred.from.Promise(Promise.resolve(_droppedNil));
		}

		return Deferred.from.Promise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				overflowQueue.push({ input: args, resolve });
				emit({ kind: "Queued", position: overflowQueue.length - 1 });
			}),
		);
	};

	const abort = (): void => {
		const hadWork = inflight > 0 || overflowQueue.length > 0;
		generation++;
		for (const c of controllers) {
			c.abort();
		}
		controllers.clear();
		for (const r of inflightResolvers) {
			r(_abortedNil);
		}
		inflightResolvers.length = 0;
		for (const item of overflowQueue) {
			item.resolve(_abortedNil);
		}
		overflowQueue.length = 0;
		inflight = 0;
		if (hadWork) { emit(_abortedNil); }
	};

	return {
		get state() {
			return currentState;
		},
		run,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (currentState.kind !== "Idle") { cb(currentState); }
			return () => subscribers.delete(cb);
		},
		reset: () => {
			generation++;
			for (const c of controllers) {
				c.abort();
			}
			controllers.clear();
			for (const r of inflightResolvers) {
				r(_abortedNil);
			}
			inflightResolvers.length = 0;
			for (const item of overflowQueue) {
				item.resolve(_abortedNil);
			}
			overflowQueue.length = 0;
			inflight = 0;
			emit(_idle);
		},
		poll: ({ interval }: { interval: Duration; }) => (...args: Args) => {
			void run(...args);
			const id = setInterval(() => void run(...args), getMs(interval));
			return () => clearInterval(id);
		},
	};
};

export const makeKeyed = <Args extends readonly unknown[], K, E, A>(
	op: Op<Args, E, A>,
	keyFn: (...args: Args) => K,
	perKey: "exclusive" | "restartable",
	timeoutOptions?: Op.TimeoutOptions<any>,
): Op.KeyedManager<Args, K, E, Op.KeyedExclusivePerKey<E, A> | Op.KeyedRestartablePerKey<E, A>> => {
	type PerKeyS = Op.KeyedExclusivePerKey<E, A> | Op.KeyedRestartablePerKey<E, A>;
	const stateMap = new Map<K, PerKeyS>();
	const slots = new Map<K, { controller: AbortController; resolve: (o: Op.Outcome<E, A>) => void; }>();
	const subscribers = new Set<(state: ReadonlyMap<K, PerKeyS>) => void>();

	const emitSnapshot = (): void => {
		const snapshot = new Map(stateMap) as ReadonlyMap<K, PerKeyS>;
		for (const cb of subscribers) {
			cb(snapshot);
		}
	};

	const run = (...args: Args): Deferred<Op.Outcome<E, A>> => {
		let k: K;
		try {
			k = keyFn(...args);
		} catch (keyError) {
			return Deferred.from.Promise(Promise.resolve(err(keyError as E)));
		}

		if (slots.has(k)) {
			if (perKey === "exclusive") {
				return Deferred.from.Promise(Promise.resolve(_droppedNil));
			}
			// restartable: cancel existing slot
			const existing = slots.get(k)!;
			existing.controller.abort();
			const prev = existing.resolve;
			slots.delete(k);
			prev(_replacedNil);
		}

		return Deferred.from.Promise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				const controller = new AbortController();
				slots.set(k, { controller, resolve });
				stateMap.set(k, _pending as PerKeyS);
				emitSnapshot();

				execute(op, args, controller, undefined, timeoutOptions).then((outcome) => {
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
			const hadWork = slots.size > 0;
			for (const [k, slot] of slots) {
				slot.controller.abort();
				stateMap.set(k, _abortedNil as PerKeyS);
				slot.resolve(_abortedNil);
			}
			slots.clear();
			if (hadWork) { emitSnapshot(); }
		}
	};

	return {
		get state() {
			return new Map(stateMap) as ReadonlyMap<K, PerKeyS>;
		},
		run: run as (...args: Args) => Deferred<Exclude<PerKeyS, Op.Pending | Op.Retrying<E>>>,
		abort,
		subscribe: (cb) => {
			subscribers.add(cb);
			if (stateMap.size > 0) { cb(new Map(stateMap) as ReadonlyMap<K, PerKeyS>); }
			return () => subscribers.delete(cb);
		},
		reset: () => {
			for (const [, slot] of slots) {
				slot.controller.abort();
				slot.resolve(_abortedNil);
			}
			slots.clear();
			stateMap.clear();
			emitSnapshot();
		},
		poll: ({ interval }: { interval: Duration; }) => (...args: Args) => {
			void run(...args);
			const id = setInterval(() => void run(...args), getMs(interval));
			return () => clearInterval(id);
		},
	};
};

export const makeOnce = <Args extends readonly unknown[], E, A>(
	op: Op<Args, E, A>,
	retryOptions?: Op.RetryOptions<E>,
	timeoutOptions?: Op.TimeoutOptions<any>,
): Op.Manager<Args, E, A, Op.State<E, A>> => {
	let currentState: Op.State<E, A> = _idle;
	let currentController: AbortController | undefined;
	let currentResolve: ((o: Op.Outcome<E, A>) => void) | undefined;
	const subscribers = new Set<(state: Op.State<E, A>) => void>();

	const emit = (state: Op.State<E, A>): void => {
		currentState = state;
		for (const cb of subscribers) {
			cb(state);
		}
	};

	const run = (...args: Args): Deferred<Op.Outcome<E, A>> => {
		// Terminal: once the manager leaves Idle, all subsequent calls are dropped.
		if (currentState.kind !== "Idle") {
			return Deferred.from.Promise(Promise.resolve(_droppedNil));
		}
		return Deferred.from.Promise(
			new Promise<Op.Outcome<E, A>>((resolve) => {
				currentResolve = resolve;
				currentController = new AbortController();
				const controller = currentController;
				emit(_pending);

				// Passing emit directly is safe: once drops subsequent runs, and abort()
				// calls controller.abort(), causing runWithRetry to exit early before onRetrying fires.
				const onRetrying = retryOptions ? emit : undefined;

				execute(op, args, controller, retryOptions, timeoutOptions, onRetrying).then((outcome) => {
					if (currentController !== controller) { return; }
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
		const hadWork = currentController !== undefined;
		currentController?.abort();
		currentController = undefined;
		const r = currentResolve;
		currentResolve = undefined;
		if (hadWork) { emit(_abortedNil); }
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
			if (currentState.kind !== "Idle") { cb(currentState); }
			return () => subscribers.delete(cb);
		},
		reset: () => {
			currentController?.abort();
			currentController = undefined;
			const r = currentResolve;
			currentResolve = undefined;
			emit(_idle);
			r?.(_abortedNil);
		},
		poll: ({ interval }: { interval: Duration; }) => (...args: Args) => {
			void run(...args);
			const id = setInterval(() => void run(...args), getMs(interval));
			return () => clearInterval(id);
		},
	};
};
