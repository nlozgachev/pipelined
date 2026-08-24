import { Deferred, Maybe as CoreMaybe, Result as CoreResult } from "#core";
import { Duration } from "#types";
import {
	type RetryOptions as InternalRetryOptions,
	type WithConcurrency,
	type WithCooldown,
	type WithDuration,
	type WithError,
	type WithKind,
	type WithMinInterval,
	type WithN,
	type WithSize,
	type WithTimeout,
	type WithValue,
} from "../internal/InternalTypes";
import {
	makeBuffered,
	makeConcurrent,
	makeDebounced,
	makeExclusive,
	makeKeyed,
	makeOnce,
	makeQueue,
	makeRestartable,
	makeThrottled,
} from "../internal/Op.util";

// ---------------------------------------------------------------------------
// Op<I, E, A>
// ---------------------------------------------------------------------------

/**
 * A reusable description of async work — decoupled from execution strategy and lifetime.
 *
 * Separate concerns:
 * - **What** to do: encoded in the `Op` via `Op.create`
 * - **How** to execute: chosen at `Op.interpret` time (restartable, exclusive, queue, etc.)
 *
 * An `Op` never runs on its own. It only executes when passed to `Op.interpret`, which
 * attaches a concurrency strategy and returns a `Manager` that owns the execution.
 *
 * @example
 * ```ts
 * const fetchUser = Op.create(
 *   (signal) => (id: string) =>
 *     fetch(`/users/${id}`, { signal }).then(r => {
 *       if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
 *       return r.json() as Promise<User>;
 *     }),
 *   (e) => new ApiError(e),
 * );
 *
 * const manager = Op.interpret(fetchUser, { strategy: "restartable" });
 * manager.subscribe(state => {
 *   if (Op.is.pending(state)) showSpinner();
 *   if (Op.is.ok(state))      render(state.value);
 *   if (Op.is.err(state))     showError(state.error);
 *   if (Op.is.nil(state))     resetUI();
 * });
 * manager.run(userId);
 * ```
 */
export type Op<I, E, A> = {
	/**
	 * @internal — Used by `Op.interpret`. Do not call directly.
	 * Returns `null` when the operation was aborted (signal fired before factory resolved).
	 */
	readonly _factory: (input: I, signal: AbortSignal) => Deferred<CoreResult<E, A> | null>;
};

// ---------------------------------------------------------------------------
// Op.interpret — internal helpers (not part of the public Op namespace)
// ---------------------------------------------------------------------------

// `Retrying<E>` is only added to the state union when retry options are present.
type MaybeRetry<E, O> = O extends { retry: InternalRetryOptions<E>; } ? Op.Retrying<E> : never;

// Union of all valid option shapes — exposed as a single type so the TS language service
// can show all strategy literals in autocomplete (overload aggregation is unreliable).
type AllInterpretOptions<I, E> =
	| ({ strategy: "once"; retry?: InternalRetryOptions<E>; } & WithTimeout<E>)
	| ({ strategy: "restartable"; retry?: InternalRetryOptions<E>; } & WithMinInterval & WithTimeout<E>)
	| ({ strategy: "exclusive"; retry?: InternalRetryOptions<E>; } & WithCooldown & WithTimeout<E>)
	| (
		& {
			strategy: "queue";
			retry?: InternalRetryOptions<E>;
			maxSize?: number;
			overflow?: "drop" | "replace-last";
			dedupe?: (a: I, b: I) => boolean;
		}
		& WithConcurrency
		& WithTimeout<E>
	)
	| ({ strategy: "buffered"; retry?: InternalRetryOptions<E>; } & WithSize & WithTimeout<E>)
	| (
		& { strategy: "debounced"; retry?: InternalRetryOptions<E>; leading?: true; maxWait?: Duration; }
		& WithDuration
		& WithTimeout<E>
	)
	| ({ strategy: "throttled"; retry?: InternalRetryOptions<E>; trailing?: true; } & WithDuration & WithTimeout<E>)
	| ({ strategy: "concurrent"; retry?: InternalRetryOptions<E>; overflow?: "queue" | "drop"; } & WithN & WithTimeout<E>)
	| ({ strategy: "keyed"; perKey?: "exclusive" | "restartable"; key: (input: I) => unknown; } & WithTimeout<E>);

// Extracts the key type from the `keyed` strategy's `key` function.
type KeyType<I, O> = O extends { key: (input: I) => infer K; } ? K : unknown;

// Conditional return type — dispatches on strategy (and variant flags) to preserve
// precise state-union typing without needing per-strategy overloads.
// Tuple form `[O] extends [...]` prevents distribution over unions.
type InterpretResult<I, E, A, O> = [O] extends [{ strategy: "throttled"; trailing: true; }]
	? Op.Manager<I, E, A, Op.ThrottledTrailingState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "throttled"; }] ? Op.Manager<I, E, A, Op.ThrottledState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "debounced"; }] ? Op.Manager<I, E, A, Op.DebouncedState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "concurrent"; overflow: "queue"; }]
		? Op.Manager<I, E, A, Op.ConcurrentQueueState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "concurrent"; }] ? Op.Manager<I, E, A, Op.ConcurrentDropState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "keyed"; perKey: "restartable"; }]
		? Op.KeyedManager<I, KeyType<I, O>, E, Op.KeyedRestartablePerKey<E, A>>
	: [O] extends [{ strategy: "keyed"; }] ? Op.KeyedManager<I, KeyType<I, O>, E, Op.KeyedExclusivePerKey<E, A>>
	: [O] extends [{ strategy: "once"; }] ? Op.Manager<I, E, A, Op.OnceState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "restartable"; }] ? Op.Manager<I, E, A, Op.RestartableState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "exclusive"; }] ? Op.Manager<I, E, A, Op.ExclusiveState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "queue"; overflow: "replace-last"; dedupe: (a: I, b: I) => boolean; }]
		? Op.Manager<I, E, A, Op.QueueDropAndReplaceState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "queue"; overflow: "replace-last"; }]
		? Op.Manager<I, E, A, Op.QueueReplaceState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "queue"; maxSize: number; }]
		? Op.Manager<I, E, A, Op.QueueDropState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "queue"; dedupe: (a: I, b: I) => boolean; }]
		? Op.Manager<I, E, A, Op.QueueDropState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "queue"; }] ? Op.Manager<I, E, A, Op.QueueState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "buffered"; }] ? Op.Manager<I, E, A, Op.BufferedState<E, A> | MaybeRetry<E, O>>
	: never;

// Helpers for implementation
const makeOk = <A>(value: A): Op.Ok<A> => ({ kind: "OpOk", value });
const makeErr = <E>(error: E): Op.Err<E> => ({ kind: "OpErr", error });
const makeNil = (reason: Op.NilReason): Op.Nil => ({ kind: "OpNil", reason });

const isIdle = <E, A>(state: Op.State<E, A>): state is Op.Idle => state.kind === "Idle";
const isPending = <E, A>(state: Op.State<E, A>): state is Op.Pending => state.kind === "Pending";
const isQueued = <E, A>(state: Op.State<E, A>): state is Op.Queued => state.kind === "Queued";
const isRetrying = <E, A>(state: Op.State<E, A>): state is Op.Retrying<E> => state.kind === "Retrying";
const isOk = <E, A>(state: Op.State<E, A>): state is Op.Ok<A> => state.kind === "OpOk";
const isErr = <E, A>(state: Op.State<E, A>): state is Op.Err<E> => state.kind === "OpErr";
const isNil = <E, A>(state: Op.State<E, A>): state is Op.Nil => state.kind === "OpNil";

function interpretFn<I, E, A, O extends AllInterpretOptions<I, E>>(
	op: Op<I, E, A>,
	options: O,
): InterpretResult<I, E, A, O>;
function interpretFn<I, E, A>(
	op: Op<I, E, A>,
	options: {
		strategy:
			| "once"
			| "restartable"
			| "exclusive"
			| "queue"
			| "buffered"
			| "debounced"
			| "throttled"
			| "concurrent"
			| "keyed";
		duration?: Duration;
		trailing?: boolean;
		leading?: boolean;
		maxWait?: Duration;
		n?: number;
		overflow?: "queue" | "drop" | "replace-last";
		key?: (input: I) => unknown;
		perKey?: "exclusive" | "restartable";
		maxSize?: number;
		concurrency?: number;
		dedupe?: (a: I, b: I) => boolean;
		size?: number;
		cooldown?: Duration;
		minInterval?: Duration;
		retry?: InternalRetryOptions<E>;
		timeout?: Op.TimeoutOptions<E>;
	},
): any {
	const { strategy, retry: retryOptions, timeout: timeoutOptions } = options;
	switch (strategy) {
		case "once": {
			return makeOnce(op, retryOptions, timeoutOptions);
		}
		case "restartable": {
			return makeRestartable(op, options.minInterval, retryOptions, timeoutOptions);
		}
		case "exclusive": {
			return makeExclusive(op, options.cooldown, retryOptions, timeoutOptions);
		}
		case "queue": {
			return makeQueue(
				op,
				options.maxSize,
				options.overflow as "drop" | "replace-last" | undefined,
				options.concurrency,
				options.dedupe,
				retryOptions,
				timeoutOptions,
			);
		}
		case "buffered": {
			return makeBuffered(op, options.size, retryOptions, timeoutOptions);
		}
		case "debounced": {
			return makeDebounced(op, options.duration!, options.leading ?? false, options.maxWait, retryOptions, timeoutOptions);
		}
		case "throttled": {
			return makeThrottled(op, options.duration!, options.trailing ?? false, retryOptions, timeoutOptions);
		}
		case "concurrent": {
			return makeConcurrent(
				op,
				options.n ?? 1,
				options.overflow as "queue" | "drop" ?? "drop",
				retryOptions,
				timeoutOptions,
			);
		}
		case "keyed": {
			return makeKeyed(op, options.key ?? ((i: I) => i), options.perKey ?? "exclusive", timeoutOptions);
		}
	}
}

export const Op = {
	make: {
		/**
		 * Creates an Ok outcome with the given value.
		 *
		 * @example
		 * ```ts
		 * Op.make.ok(42); // { kind: "OpOk", value: 42 }
		 * ```
		 */
		ok: makeOk,

		/**
		 * Creates an Err outcome with the given error.
		 *
		 * @example
		 * ```ts
		 * Op.make.err("Something went wrong"); // { kind: "OpErr", error: "Something went wrong" }
		 * ```
		 */
		err: makeErr,

		/**
		 * Creates a Nil outcome with the given cancellation/drop reason.
		 *
		 * @example
		 * ```ts
		 * Op.make.nil("aborted"); // { kind: "OpNil", reason: "aborted" }
		 * ```
		 */
		nil: makeNil,
	},

	is: {
		/**
		 * Type guard that checks if an Op state is Idle.
		 *
		 * @example
		 * ```ts
		 * if (Op.is.idle(manager.state)) {
		 *   console.log("Ready to execute");
		 * }
		 * ```
		 */
		idle: isIdle,

		/**
		 * Type guard that checks if an Op state is Pending (actively executing).
		 *
		 * @example
		 * ```ts
		 * if (Op.is.pending(manager.state)) {
		 *   showSpinner();
		 * }
		 * ```
		 */
		pending: isPending,

		/**
		 * Type guard that checks if an Op state is Queued (waiting in a concurrency queue).
		 *
		 * @example
		 * ```ts
		 * if (Op.is.queued(manager.state)) {
		 *   console.log("Position in queue:", manager.state.position);
		 * }
		 * ```
		 */
		queued: isQueued,

		/**
		 * Type guard that checks if an Op state is Retrying after a failure.
		 *
		 * @example
		 * ```ts
		 * if (Op.is.retrying(manager.state)) {
		 *   console.log("Retry attempt:", manager.state.attempt);
		 * }
		 * ```
		 */
		retrying: isRetrying,

		/**
		 * Type guard that checks if an Op state or outcome is Ok.
		 *
		 * @example
		 * ```ts
		 * if (Op.is.ok(outcome)) {
		 *   render(outcome.value);
		 * }
		 * ```
		 */
		ok: isOk,

		/**
		 * Type guard that checks if an Op state or outcome is Err.
		 *
		 * @example
		 * ```ts
		 * if (Op.is.err(outcome)) {
		 *   showError(outcome.error);
		 * }
		 * ```
		 */
		err: isErr,

		/**
		 * Type guard that checks if an Op state or outcome is Nil.
		 *
		 * @example
		 * ```ts
		 * if (Op.is.nil(outcome)) {
		 *   console.log("Skipped due to:", outcome.reason);
		 * }
		 * ```
		 */
		nil: isNil,
	},

	create: <E, A, I = void>(
		factory: (signal: AbortSignal) => (input: I) => Promise<A>,
		onError: (e: unknown) => E,
	): Op<I, E, A> => ({
		_factory: (input, signal) =>
			Deferred.from.Promise(
				factory(signal)(input).then((value): CoreResult<E, A> => CoreResult.make.ok(value)).catch((
					error,
				): CoreResult<E, A> | null => signal.aborted ? null : CoreResult.make.err(onError(error))),
			),
	}),

	lift: <I, A>(f: (input: I, signal: AbortSignal) => Promise<A>): Op<I, unknown, A> =>
		Op.create((signal) => (input: I) => f(input, signal), (e) => e),

	match: <E, A, B>(cases: { ok: (a: A) => B; err: (e: E) => B; nil: () => B; }) => (outcome: Op.Outcome<E, A>): B => {
		if (outcome.kind === "OpOk") { return cases.ok(outcome.value); }
		if (outcome.kind === "OpErr") { return cases.err(outcome.error); }
		return cases.nil();
	},

	fold: <E, A, B>(onErr: (e: E) => B, onNil: () => B, onOk: (a: A) => B) => (outcome: Op.Outcome<E, A>): B => {
		if (outcome.kind === "OpOk") { return onOk(outcome.value); }
		if (outcome.kind === "OpErr") { return onErr(outcome.error); }
		return onNil();
	},

	getOrElse: <E, A, B>(defaultValue: () => B) => (outcome: Op.Outcome<E, A>): A | B =>
		outcome.kind === "OpOk" ? outcome.value : defaultValue(),

	map: <E, A, B>(f: (a: A) => B) => (outcome: Op.Outcome<E, A>): Op.Outcome<E, B> =>
		outcome.kind === "OpOk" ? makeOk(f(outcome.value)) : outcome as Op.Outcome<E, B>,

	mapError: <E, F, A>(f: (e: E) => F) => (outcome: Op.Outcome<E, A>): Op.Outcome<F, A> =>
		outcome.kind === "OpErr" ? makeErr(f(outcome.error)) : outcome as Op.Outcome<F, A>,

	chain: <E, A, B>(f: (a: A) => Op.Outcome<E, B>) => (outcome: Op.Outcome<E, A>): Op.Outcome<E, B> =>
		outcome.kind === "OpOk" ? f(outcome.value) : outcome as Op.Outcome<E, B>,

	tap: <E, A>(f: (a: A) => void) => (outcome: Op.Outcome<E, A>): Op.Outcome<E, A> => {
		if (outcome.kind === "OpOk") { f(outcome.value); }
		return outcome;
	},

	recover: <E, A, B>(f: (e: E) => Op.Outcome<E, B>) => (outcome: Op.Outcome<E, A>): Op.Outcome<E, A | B> =>
		outcome.kind === "OpErr" ? f(outcome.error) : outcome as Op.Outcome<E, A | B>,

	to: {
		Result: <E, A>(onNil: () => E) => (outcome: Op.Outcome<E, A>): CoreResult<E, A> => {
			if (outcome.kind === "OpOk") { return CoreResult.make.ok(outcome.value); }
			if (outcome.kind === "OpErr") { return CoreResult.make.err(outcome.error); }
			return CoreResult.make.err(onNil());
		},

		Maybe: <E, A>(outcome: Op.Outcome<E, A>): CoreMaybe<A> =>
			outcome.kind === "OpOk" ? CoreMaybe.make.some(outcome.value) : CoreMaybe.make.none(),
	},

	all: <E, A>(invocations: ReadonlyArray<Deferred<Op.Outcome<E, A>>>): Deferred<ReadonlyArray<Op.Outcome<E, A>>> =>
		Deferred.from.Promise(Promise.all(invocations.map(Deferred.to.Promise))),

	race: <E, A>(invocations: ReadonlyArray<Deferred<Op.Outcome<E, A>>>): Deferred<Op.Outcome<E, A>> =>
		Deferred.from.Promise(Promise.race(invocations.map(Deferred.to.Promise))),

	wire: <I, E, A, S extends Op.State<E, A>>(source: Op.Manager<I, E, A, S>, f: (a: A) => void): () => void =>
		source.subscribe((state) => {
			if (isOk(state)) { f(state.value); }
		}),

	interpret: interpretFn,
};

export namespace Op {
	export type Outcome<E, A> = Ok<A> | Err<E> | Nil;
	export type Ok<A> = WithKind<"OpOk"> & WithValue<A>;
	export type Err<E> = WithKind<"OpErr"> & WithError<E>;
	export type Nil = WithKind<"OpNil"> & { readonly reason: NilReason; };
	export type NilReason = "aborted" | "dropped" | "replaced" | "evicted";
	export type AbortedNil = Nil & { readonly reason: "aborted"; };
	export type DroppedNil = Nil & { readonly reason: "dropped"; };
	export type ReplacedNil = Nil & { readonly reason: "replaced"; };
	export type EvictedNil = Nil & { readonly reason: "evicted"; };
	export type State<E, A> = Idle | Pending | Queued | Retrying<E> | Outcome<E, A>;
	export type Idle = WithKind<"Idle">;
	export type Pending = WithKind<"Pending">;
	export type Queued = WithKind<"Queued"> & { readonly position: number; };
	export type Retrying<E> = WithKind<"Retrying"> & {
		readonly attempt: number;
		readonly lastError: E;
		readonly nextRetryIn?: number;
	};
	export type Manager<I, E, A, S extends State<E, A>> = {
		readonly state: S;
		run: (input: I) => Deferred<Exclude<S, Idle | Pending | Queued | Retrying<E>>>;
		abort: () => void;
		subscribe: (cb: (state: S) => void) => () => void;
		reset: () => void;
		poll: (input: I, options: { interval: Duration; }) => () => void;
	};
	export type KeyedManager<I, K, E, PerKeyS> = {
		readonly state: ReadonlyMap<K, PerKeyS>;
		run: (input: I) => Deferred<Exclude<PerKeyS, Pending | Retrying<E>>>;
		abort: (key?: K) => void;
		subscribe: (cb: (state: ReadonlyMap<K, PerKeyS>) => void) => () => void;
		reset: () => void;
		poll: (input: I, options: { interval: Duration; }) => () => void;
	};
	export type OnceState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	export type RetryableOnceState<E, A> = Idle | Pending | Retrying<E> | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	export type RestartableState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | ReplacedNil;
	export type RetryableRestartableState<E, A> = Idle | Pending | Retrying<E> | Ok<A> | Err<E> | AbortedNil | ReplacedNil;
	export type ExclusiveState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	export type RetryableExclusiveState<E, A> = Idle | Pending | Retrying<E> | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	export type QueueState<E, A> = Idle | Pending | Queued | Ok<A> | Err<E> | AbortedNil;
	export type RetryableQueueState<E, A> = Idle | Pending | Queued | Retrying<E> | Ok<A> | Err<E> | AbortedNil;
	export type QueueDropState<E, A> = Idle | Pending | Queued | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	export type RetryableQueueDropState<E, A> =
		| Idle
		| Pending
		| Queued
		| Retrying<E>
		| Ok<A>
		| Err<E>
		| AbortedNil
		| DroppedNil;
	export type QueueReplaceState<E, A> = Idle | Pending | Queued | Ok<A> | Err<E> | AbortedNil | EvictedNil;
	export type RetryableQueueReplaceState<E, A> =
		| Idle
		| Pending
		| Queued
		| Retrying<E>
		| Ok<A>
		| Err<E>
		| AbortedNil
		| EvictedNil;
	export type QueueDropAndReplaceState<E, A> =
		| Idle
		| Pending
		| Queued
		| Ok<A>
		| Err<E>
		| AbortedNil
		| DroppedNil
		| EvictedNil;
	export type RetryableQueueDropAndReplaceState<E, A> =
		| Idle
		| Pending
		| Queued
		| Retrying<E>
		| Ok<A>
		| Err<E>
		| AbortedNil
		| DroppedNil
		| EvictedNil;
	export type BufferedState<E, A> = Idle | Pending | Queued | Ok<A> | Err<E> | AbortedNil | EvictedNil;
	export type RetryableBufferedState<E, A> =
		| Idle
		| Pending
		| Queued
		| Retrying<E>
		| Ok<A>
		| Err<E>
		| AbortedNil
		| EvictedNil;
	export type DebouncedState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | EvictedNil;
	export type RetryableDebouncedState<E, A> = Idle | Pending | Retrying<E> | Ok<A> | Err<E> | AbortedNil | EvictedNil;
	export type ThrottledState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	export type RetryableThrottledState<E, A> = Idle | Pending | Retrying<E> | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	export type ThrottledTrailingState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | EvictedNil;
	export type RetryableThrottledTrailingState<E, A> =
		| Idle
		| Pending
		| Retrying<E>
		| Ok<A>
		| Err<E>
		| AbortedNil
		| EvictedNil;
	export type ConcurrentQueueState<E, A> = Idle | Pending | Queued | Ok<A> | Err<E> | AbortedNil;
	export type RetryableConcurrentQueueState<E, A> = Idle | Pending | Queued | Retrying<E> | Ok<A> | Err<E> | AbortedNil;
	export type ConcurrentDropState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	export type RetryableConcurrentDropState<E, A> =
		| Idle
		| Pending
		| Retrying<E>
		| Ok<A>
		| Err<E>
		| AbortedNil
		| DroppedNil;
	export type KeyedExclusivePerKey<E, A> = Pending | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	export type KeyedRestartablePerKey<E, A> = Pending | Ok<A> | Err<E> | AbortedNil | ReplacedNil;
	export type RetryOptions<E> = import("#internal").RetryOptions<E>;
	export type TimeoutOptions<E> = import("#internal").TimeoutOptions<E>;
}
