import { Deferred, Maybe, Result } from "#core";
import { Duration } from "#types";
import {
	type RetryOptions,
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
 *   if (Op.isPending(state)) showSpinner();
 *   if (Op.isOk(state))      render(state.value);
 *   if (Op.isErr(state))   showError(state.error);
 *   if (Op.isNil(state))     resetUI();
 * });
 * manager.run(userId);
 * ```
 */
export type Op<I, E, A> = {
	/**
	 * @internal — Used by `Op.interpret`. Do not call directly.
	 * Returns `null` when the operation was aborted (signal fired before factory resolved).
	 */
	readonly _factory: (input: I, signal: AbortSignal) => Deferred<Result<E, A> | null>;
};

// ---------------------------------------------------------------------------
// Op.interpret — internal helpers (not part of the public Op namespace)
// ---------------------------------------------------------------------------

// `Retrying<E>` is only added to the state union when retry options are present.
type MaybeRetry<E, O> = O extends { retry: RetryOptions<E>; } ? Op.Retrying<E> : never;

// Union of all valid option shapes — exposed as a single type so the TS language service
// can show all strategy literals in autocomplete (overload aggregation is unreliable).
type AllInterpretOptions<I, E> =
	| ({ strategy: "once"; retry?: RetryOptions<E>; } & WithTimeout<E>)
	| ({ strategy: "restartable"; retry?: RetryOptions<E>; } & WithMinInterval & WithTimeout<E>)
	| ({ strategy: "exclusive"; retry?: RetryOptions<E>; } & WithCooldown & WithTimeout<E>)
	| (
		& {
			strategy: "queue";
			retry?: RetryOptions<E>;
			maxSize?: number;
			overflow?: "drop" | "replace-last";
			dedupe?: (a: I, b: I) => boolean;
		}
		& WithConcurrency
		& WithTimeout<E>
	)
	| ({ strategy: "buffered"; retry?: RetryOptions<E>; } & WithSize & WithTimeout<E>)
	| (
		& { strategy: "debounced"; retry?: RetryOptions<E>; leading?: true; maxWait?: Duration; }
		& WithDuration
		& WithTimeout<E>
	)
	| ({ strategy: "throttled"; retry?: RetryOptions<E>; trailing?: true; } & WithDuration & WithTimeout<E>)
	| ({ strategy: "concurrent"; retry?: RetryOptions<E>; overflow?: "queue" | "drop"; } & WithN & WithTimeout<E>)
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

// ---------------------------------------------------------------------------
// Op namespace — all types and operations
// ---------------------------------------------------------------------------

export namespace Op {
	// -------------------------------------------------------------------------
	// Types — Outcome
	// -------------------------------------------------------------------------

	/**
	 * The three terminal states of a completed async operation.
	 *
	 * - `Ok` — produced a value.
	 * - `Err` — produced a typed error.
	 * - `Nil` — completed without a value or error. The `reason` field says why:
	 *   `"aborted"` — `abort()` was called; `"dropped"` — a new `run()` was ignored
	 *   because the strategy was already busy; `"replaced"` — a newer `run()` took
	 *   over a call that was already running; `"evicted"` — a newer `run()` took over
	 *   a call that was waiting and had not yet started.
	 */
	export type Outcome<E, A> = Ok<A> | Err<E> | Nil;

	/** A successful outcome with a value. */
	export type Ok<A> = WithKind<"OpOk"> & WithValue<A>;
	/** A failed outcome with a typed error. */
	export type Err<E> = WithKind<"OpErr"> & WithError<E>;
	/**
	 * An outcome that produced nothing. `reason` identifies why:
	 * - `"aborted"` — `abort()` was called explicitly.
	 * - `"dropped"` — the invocation was ignored because the strategy was busy.
	 * - `"replaced"` — a newer invocation took over a call that was already running.
	 * - `"evicted"` — a newer invocation took a slot from a call that was waiting and
	 *   had not yet started (buffered slot, debounce timer, throttle trailing slot).
	 */
	export type Nil = WithKind<"OpNil"> & { readonly reason: NilReason; };

	/** The reason a `Nil` outcome was produced. */
	export type NilReason = "aborted" | "dropped" | "replaced" | "evicted";

	/** A `Nil` produced by an explicit `abort()` call. */
	export type AbortedNil = Nil & { readonly reason: "aborted"; };
	/** A `Nil` produced when an invocation was silently ignored (strategy was busy). */
	export type DroppedNil = Nil & { readonly reason: "dropped"; };
	/** A `Nil` produced when a newer invocation took over a call that was already running. */
	export type ReplacedNil = Nil & { readonly reason: "replaced"; };
	/** A `Nil` produced when a newer invocation took a slot from a call that was waiting and had not yet started. */
	export type EvictedNil = Nil & { readonly reason: "evicted"; };

	// -------------------------------------------------------------------------
	// Types — State machine
	// -------------------------------------------------------------------------

	/** The full set of states a manager can emit, including transient states. */
	export type State<E, A> = Idle | Pending | Queued | Retrying<E> | Outcome<E, A>;

	/** The manager has not been run yet (initial state). */
	export type Idle = WithKind<"Idle">;
	/** An operation is in-flight. */
	export type Pending = WithKind<"Pending">;
	/** An operation is waiting in a queue. `position` is 0-indexed (0 = next to run). */
	export type Queued = WithKind<"Queued"> & { readonly position: number; };
	/** A retry attempt is about to start. */
	export type Retrying<E> = WithKind<"Retrying"> & {
		readonly attempt: number;
		readonly lastError: E;
		readonly nextRetryIn?: number;
	};

	// -------------------------------------------------------------------------
	// Types — Manager
	// -------------------------------------------------------------------------

	/**
	 * A stateful execution manager. `run()` both emits state transitions through
	 * subscribers and returns a `Deferred` tied to that specific invocation.
	 * `S` is narrowed to only the states reachable for this manager's strategy
	 * and configuration.
	 *
	 * @example
	 * ```ts
	 * const manager = Op.interpret(saveConfig, { strategy: "exclusive" });
	 *
	 * manager.subscribe(state => {
	 *   if (Op.isPending(state)) lockForm();
	 *   if (Op.isOk(state))     toast("Saved");
	 *   if (Op.isErr(state))  toast(`Error: ${state.error.message}`);
	 * });
	 *
	 * // Fire and subscribe (subscriber pattern)
	 * manager.run(formData);
	 *
	 * // Or await the specific invocation's outcome
	 * const result = await manager.run(formData);
	 * if (Op.isNil(result)) return; // dropped — another save was in-flight
	 * ```
	 */
	export type Manager<I, E, A, S extends State<E, A>> = {
		/** The current state. Useful for synchronous reads (e.g., `useSyncExternalStore`). */
		readonly state: S;
		/**
		 * Submits an invocation. Emits state transitions via subscribers and returns a
		 * `Deferred` that resolves to the terminal outcome for this specific invocation.
		 * `Nil` means this invocation was not executed (dropped, replaced, or aborted).
		 */
		run: (input: I) => Deferred<Exclude<S, Idle | Pending | Queued | Retrying<E>>>;
		/**
		 * Cancels any in-flight operation and clears the queue.
		 * Every pending `run()` Deferred — including queued invocations — settles to `AbortedNil`.
		 * Resolution is asynchronous; no Deferred hangs indefinitely.
		 */
		abort: () => void;
		/**
		 * Registers a subscriber for state transitions. Returns an unsubscribe function.
		 * The callback fires immediately with the current state if the manager is not idle.
		 */
		subscribe: (cb: (state: S) => void) => () => void;
		/** Returns state to Idle. Does not cancel any in-flight operation. */
		reset: () => void;
		/**
		 * Runs the input immediately, then every `interval` milliseconds.
		 * Returns a stop handle — call it to cancel future runs.
		 */
		poll: (input: I, options: { interval: Duration; }) => () => void;
	};

	// -------------------------------------------------------------------------
	// Types — KeyedManager
	// -------------------------------------------------------------------------

	/**
	 * A stateful manager that maintains independent per-key execution slots.
	 * Different keys run in parallel; the same key follows the `perKey` sub-strategy.
	 * `abort(key)` cancels a specific key; `abort()` cancels all.
	 * `state` is a map of each key's last known state — updated on every transition.
	 *
	 * @example
	 * ```ts
	 * const getUser = Op.interpret(fetchUser, {
	 *   strategy: "keyed",
	 *   key: (input) => input.id,
	 *   perKey: "exclusive",
	 * });
	 *
	 * getUser.subscribe((map) => {
	 *   for (const [id, state] of map) {
	 *     if (Op.isPending(state)) showSpinner(id);
	 *     if (Op.isOk(state))     render(id, state.value);
	 *   }
	 * });
	 *
	 * getUser.run({ id: "user-1" }); // starts key "user-1"
	 * getUser.run({ id: "user-2" }); // starts key "user-2" in parallel
	 * ```
	 */
	export type KeyedManager<I, K, E, PerKeyS> = {
		/** Current state map. Keys are present from first `run()` through their last terminal state. */
		readonly state: ReadonlyMap<K, PerKeyS>;
		/**
		 * Submits an invocation for the key derived from the input. Returns a `Deferred` tied
		 * to this specific invocation. Same-key behaviour is controlled by `perKey`.
		 */
		run: (input: I) => Deferred<Exclude<PerKeyS, Pending | Retrying<E>>>;
		/** Cancels the in-flight operation for a specific key, or all keys if omitted. */
		abort: (key?: K) => void;
		/**
		 * Registers a subscriber. The callback receives a fresh snapshot of the state map
		 * on every transition. Returns an unsubscribe function.
		 * Fires immediately with the current map if any key is active.
		 */
		subscribe: (cb: (state: ReadonlyMap<K, PerKeyS>) => void) => () => void;
		/** Clears all per-key state and notifies subscribers. Does not cancel in-flight operations. */
		reset: () => void;
		/**
		 * Runs the input immediately, then every `interval` milliseconds.
		 * Returns a stop handle — call it to cancel future runs.
		 */
		poll: (input: I, options: { interval: Duration; }) => () => void;
	};

	// -------------------------------------------------------------------------
	// Types — Narrow state unions per strategy
	// -------------------------------------------------------------------------

	/** States reachable by a `once` manager (no retry). */
	export type OnceState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	/** States reachable by a `once` manager with retry configured. */
	export type RetryableOnceState<E, A> = Idle | Pending | Retrying<E> | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	/** States reachable by a `restartable` manager (no retry). */
	export type RestartableState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | ReplacedNil;
	/** States reachable by a `restartable` manager with retry configured. */
	export type RetryableRestartableState<E, A> = Idle | Pending | Retrying<E> | Ok<A> | Err<E> | AbortedNil | ReplacedNil;
	/** States reachable by an `exclusive` manager (no retry). */
	export type ExclusiveState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	/** States reachable by an `exclusive` manager with retry configured. */
	export type RetryableExclusiveState<E, A> = Idle | Pending | Retrying<E> | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	/** States reachable by a `queue` manager (no retry, no overflow, no dedupe). */
	export type QueueState<E, A> = Idle | Pending | Queued | Ok<A> | Err<E> | AbortedNil;
	/** States reachable by a `queue` manager with retry (no overflow, no dedupe). */
	export type RetryableQueueState<E, A> = Idle | Pending | Queued | Retrying<E> | Ok<A> | Err<E> | AbortedNil;
	/** States reachable by a `queue` manager with `overflow:"drop"` or `dedupe` (no retry). */
	export type QueueDropState<E, A> = Idle | Pending | Queued | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	/** States reachable by a `queue` manager with `overflow:"drop"` or `dedupe`, with retry. */
	export type RetryableQueueDropState<E, A> =
		| Idle
		| Pending
		| Queued
		| Retrying<E>
		| Ok<A>
		| Err<E>
		| AbortedNil
		| DroppedNil;
	/** States reachable by a `queue` manager with `overflow:"replace-last"` and no `dedupe` (no retry). */
	export type QueueReplaceState<E, A> = Idle | Pending | Queued | Ok<A> | Err<E> | AbortedNil | EvictedNil;
	/** States reachable by a `queue` manager with `overflow:"replace-last"` and no `dedupe`, with retry. */
	export type RetryableQueueReplaceState<E, A> =
		| Idle
		| Pending
		| Queued
		| Retrying<E>
		| Ok<A>
		| Err<E>
		| AbortedNil
		| EvictedNil;
	/** States reachable by a `queue` manager with `overflow:"replace-last"` AND `dedupe` (no retry). */
	export type QueueDropAndReplaceState<E, A> =
		| Idle
		| Pending
		| Queued
		| Ok<A>
		| Err<E>
		| AbortedNil
		| DroppedNil
		| EvictedNil;
	/** States reachable by a `queue` manager with `overflow:"replace-last"` AND `dedupe`, with retry. */
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
	/** States reachable by a `buffered` manager (no retry). */
	export type BufferedState<E, A> = Idle | Pending | Queued | Ok<A> | Err<E> | AbortedNil | EvictedNil;
	/** States reachable by a `buffered` manager with retry configured. */
	export type RetryableBufferedState<E, A> =
		| Idle
		| Pending
		| Queued
		| Retrying<E>
		| Ok<A>
		| Err<E>
		| AbortedNil
		| EvictedNil;
	/** States reachable by a `debounced` manager (no retry). */
	export type DebouncedState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | EvictedNil;
	/** States reachable by a `debounced` manager with retry configured. */
	export type RetryableDebouncedState<E, A> = Idle | Pending | Retrying<E> | Ok<A> | Err<E> | AbortedNil | EvictedNil;
	/** States reachable by a `throttled` manager (leading-only, no retry). */
	export type ThrottledState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	/** States reachable by a `throttled` manager (leading-only, with retry). */
	export type RetryableThrottledState<E, A> = Idle | Pending | Retrying<E> | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	/** States reachable by a `throttled` manager with `trailing: true` (no retry). */
	export type ThrottledTrailingState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | EvictedNil;
	/** States reachable by a `throttled` manager with `trailing: true` and retry. */
	export type RetryableThrottledTrailingState<E, A> =
		| Idle
		| Pending
		| Retrying<E>
		| Ok<A>
		| Err<E>
		| AbortedNil
		| EvictedNil;
	/** States reachable by a `concurrent` manager with `overflow: "queue"` (no retry). */
	export type ConcurrentQueueState<E, A> = Idle | Pending | Queued | Ok<A> | Err<E> | AbortedNil;
	/** States reachable by a `concurrent` manager with `overflow: "queue"` and retry. */
	export type RetryableConcurrentQueueState<E, A> = Idle | Pending | Queued | Retrying<E> | Ok<A> | Err<E> | AbortedNil;
	/** States reachable by a `concurrent` manager with `overflow: "drop"` (no retry). */
	export type ConcurrentDropState<E, A> = Idle | Pending | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	/** States reachable by a `concurrent` manager with `overflow: "drop"` and retry. */
	export type RetryableConcurrentDropState<E, A> =
		| Idle
		| Pending
		| Retrying<E>
		| Ok<A>
		| Err<E>
		| AbortedNil
		| DroppedNil;
	/** Per-key state union for a `keyed` manager with `perKey: "exclusive"`. */
	export type KeyedExclusivePerKey<E, A> = Pending | Ok<A> | Err<E> | AbortedNil | DroppedNil;
	/** Per-key state union for a `keyed` manager with `perKey: "restartable"`. */
	export type KeyedRestartablePerKey<E, A> = Pending | Ok<A> | Err<E> | AbortedNil | ReplacedNil;

	// -------------------------------------------------------------------------
	// Types — Options (defined in InternalTypes.ts, re-exported here for convenience)
	// -------------------------------------------------------------------------

	// eslint-disable-next-line no-shadow
	export type RetryOptions<E> = import("#internal").RetryOptions<E>;
	export type TimeoutOptions<E> = import("#internal").TimeoutOptions<E>;

	// -------------------------------------------------------------------------
	// Nil constructor
	// -------------------------------------------------------------------------

	/**
	 * Creates a `Nil` outcome with a reason.
	 *
	 * @example
	 * ```ts
	 * Op.nil("aborted");  // { kind: "OpNil", reason: "aborted" }
	 * Op.nil("dropped");  // { kind: "OpNil", reason: "dropped" }
	 * Op.nil("replaced"); // { kind: "OpNil", reason: "replaced" }
	 * Op.nil("evicted");  // { kind: "OpNil", reason: "evicted" }
	 * ```
	 */
	export const nil = (reason: NilReason): Nil => ({ kind: "OpNil", reason });

	// -------------------------------------------------------------------------
	// Constructors
	// -------------------------------------------------------------------------

	/**
	 * Creates an `Op` from an async factory and an error mapper.
	 *
	 * The factory receives an `AbortSignal` and returns a function that takes the input. Capture
	 * the signal in the outer closure and pass it to cancellable APIs like `fetch`. The error
	 * mapper converts any thrown value into a typed error; it is never called for aborts.
	 *
	 * **If the factory ignores the signal**, cancellation silently stops working: the operation
	 * runs to completion and emits `Ok` even after the strategy has aborted it. This is harmless
	 * for `exclusive` and `once` (which do not abort in-flight work), but causes stale `Ok`
	 * emissions on `restartable`, `debounced`, `throttled`, `buffered`, and `queue` strategies
	 * where in-flight runs are regularly replaced or dropped.
	 *
	 * @example
	 * ```ts
	 * // With cancellation — fetch is aborted when the Op is replaced or aborted
	 * const saveProfile = Op.create(
	 *   (signal) => (data: ProfileData) =>
	 *     fetch("/profile", { method: "POST", body: JSON.stringify(data), signal })
	 *       .then(r => {
	 *         if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
	 *         return r.json() as Promise<ProfileData>;
	 *       }),
	 *   (e) => new ApiError(e),
	 * );
	 *
	 * // No input — fetches the current user; manager.run() takes no arguments
	 * const fetchCurrentUser = Op.create(
	 *   (signal) => () => fetch("/me", { signal }).then(r => {
	 *     if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
	 *     return r.json() as Promise<User>;
	 *   }),
	 *   (e) => new ApiError(e),
	 * );
	 * const manager = Op.interpret(fetchCurrentUser, { strategy: "once" });
	 * manager.run(); // no argument needed
	 * ```
	 */
	export const create = <E, A, I = void>(
		factory: (signal: AbortSignal) => (input: I) => Promise<A>,
		onError: (e: unknown) => E,
	): Op<I, E, A> => ({
		_factory: (input, signal) =>
			Deferred.fromPromise(
				factory(signal)(input).then((value): Result<E, A> => Result.ok(value)).catch((error): Result<E, A> | null =>
					signal.aborted ? null : Result.err(onError(error))
				),
			),
	});

	/**
	 * Lifts a plain async function into an Op, treating all errors as `unknown`.
	 *
	 * Use this when you have a simple async function that doesn't need custom error mapping.
	 * The signal is passed so the operation can respect cancellation.
	 *
	 * @example
	 * ```ts
	 * const fetchUser = Op.lift((id: number, signal: AbortSignal) =>
	 *   fetch(`/api/users/${id}`, { signal }).then(r => r.json())
	 * );
	 * const manager = Op.interpret(fetchUser, { strategy: "restartable" });
	 * const outcome = await manager.run(42);
	 * if (Op.isOk(outcome)) console.log(outcome.value);
	 * ```
	 */
	export const lift = <I, A>(f: (input: I, signal: AbortSignal) => Promise<A>): Op<I, unknown, A> =>
		create((signal) => (input: I) => f(input, signal), (e) => e);

	/**
	 * Creates a successful Outcome.
	 *
	 * @example
	 * ```ts
	 * Op.ok(42); // { kind: "OpOk", value: 42 }
	 * ```
	 */
	export const ok = <A>(value: A): Ok<A> => ({ kind: "OpOk", value });

	/**
	 * Creates a failed Outcome with a typed error.
	 *
	 * @example
	 * ```ts
	 * Op.err(new ApiError("not found")); // { kind: "OpErr", error: ApiError }
	 * ```
	 */
	export const err = <E>(error: E): Err<E> => ({ kind: "OpErr", error });

	// -------------------------------------------------------------------------
	// Type guards
	// -------------------------------------------------------------------------

	/**
	 * Returns `true` if the state is `Idle`.
	 *
	 * @example
	 * ```ts
	 * manager.subscribe(state => {
	 *   if (Op.isIdle(state)) hideSpinner();
	 * });
	 * ```
	 */
	export const isIdle = <E, A>(state: State<E, A>): state is Idle => state.kind === "Idle";

	/**
	 * Returns `true` if the state is `Pending` (an operation is in-flight).
	 *
	 * @example
	 * ```ts
	 * manager.subscribe(state => {
	 *   if (Op.isPending(state)) showSpinner();
	 * });
	 * ```
	 */
	export const isPending = <E, A>(state: State<E, A>): state is Pending => state.kind === "Pending";

	/**
	 * Returns `true` if the state is `Queued` (an invocation is waiting to run).
	 *
	 * @example
	 * ```ts
	 * manager.subscribe(state => {
	 *   if (Op.isQueued(state)) showQueuePosition(state.position);
	 * });
	 * ```
	 */
	export const isQueued = <E, A>(state: State<E, A>): state is Queued => state.kind === "Queued";

	/**
	 * Returns `true` if the state is `Retrying`.
	 *
	 * @example
	 * ```ts
	 * manager.subscribe(state => {
	 *   if (Op.isRetrying(state)) showRetryBadge(state.attempt);
	 * });
	 * ```
	 */
	export const isRetrying = <E, A>(state: State<E, A>): state is Retrying<E> => state.kind === "Retrying";

	/**
	 * Returns `true` if the state is `Ok` (the operation produced a value).
	 *
	 * @example
	 * ```ts
	 * manager.subscribe(state => {
	 *   if (Op.isOk(state)) render(state.value);
	 * });
	 * ```
	 */
	export const isOk = <E, A>(state: State<E, A>): state is Ok<A> => state.kind === "OpOk";

	/**
	 * Returns `true` if the state is `Err` (the operation failed with a typed error).
	 *
	 * @example
	 * ```ts
	 * manager.subscribe(state => {
	 *   if (Op.isErr(state)) showError(state.error);
	 * });
	 * ```
	 */
	export const isErr = <E, A>(state: State<E, A>): state is Err<E> => state.kind === "OpErr";

	/**
	 * Returns `true` if the state is `Nil` (the operation completed without a value or error).
	 *
	 * @example
	 * ```ts
	 * manager.subscribe(state => {
	 *   if (Op.isNil(state)) resetUI();
	 * });
	 * ```
	 */
	export const isNil = <E, A>(state: State<E, A>): state is Nil => state.kind === "OpNil";

	// -------------------------------------------------------------------------
	// Outcome operations
	// -------------------------------------------------------------------------

	/**
	 * Pattern matches on an Outcome using named case handlers.
	 *
	 * @example
	 * ```ts
	 * Op.match({
	 *   ok:  (user) => render(user),
	 *   err: (e)    => showError(e.message),
	 *   nil: ()     => resetUI(),
	 * })(outcome);
	 * ```
	 */
	export const match =
		<E, A, B>(cases: { ok: (a: A) => B; err: (e: E) => B; nil: () => B; }) => (outcome: Outcome<E, A>): B => {
			if (outcome.kind === "OpOk") { return cases.ok(outcome.value); }
			if (outcome.kind === "OpErr") { return cases.err(outcome.error); }
			return cases.nil();
		};

	/**
	 * Eliminates an Outcome with positional handlers.
	 * Order: `onErr`, `onNil`, `onOk` — mirrors `Result.fold` for the first and last cases.
	 *
	 * @example
	 * ```ts
	 * Op.fold(
	 *   (e) => `error: ${e.message}`,
	 *   ()  => "nothing",
	 *   (v) => `value: ${v}`,
	 * )(outcome);
	 * ```
	 */
	export const fold =
		<E, A, B>(onErr: (e: E) => B, onNil: () => B, onOk: (a: A) => B) => (outcome: Outcome<E, A>): B => {
			if (outcome.kind === "OpOk") { return onOk(outcome.value); }
			if (outcome.kind === "OpErr") { return onErr(outcome.error); }
			return onNil();
		};

	/**
	 * Returns the success value, or the result of `defaultValue()` for `Err` or `Nil`.
	 *
	 * @example
	 * ```ts
	 * Op.getOrElse(() => [] as User[])(outcome);
	 * ```
	 */
	export const getOrElse = <E, A, B>(defaultValue: () => B) => (outcome: Outcome<E, A>): A | B =>
		outcome.kind === "OpOk" ? outcome.value : defaultValue();

	/**
	 * Transforms the success value. `Err` and `Nil` pass through unchanged.
	 *
	 * @example
	 * ```ts
	 * pipe(outcome, Op.map(user => user.name));
	 * ```
	 */
	export const map = <E, A, B>(f: (a: A) => B) => (outcome: Outcome<E, A>): Outcome<E, B> =>
		outcome.kind === "OpOk" ? ok(f(outcome.value)) : outcome as Outcome<E, B>;

	/**
	 * Transforms the error value. `Ok` and `Nil` pass through unchanged.
	 *
	 * @example
	 * ```ts
	 * pipe(outcome, Op.mapError(e => e.message));
	 * ```
	 */
	export const mapError = <E, F, A>(f: (e: E) => F) => (outcome: Outcome<E, A>): Outcome<F, A> =>
		outcome.kind === "OpErr" ? err(f(outcome.error)) : outcome as Outcome<F, A>;

	/**
	 * Chains Outcome computations. Runs `f` on `Ok`; `Err` and `Nil` pass through.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   outcome,
	 *   Op.chain(user => user.active ? Op.ok(user) : Op.err(new Error("inactive"))),
	 * );
	 * ```
	 */
	export const chain = <E, A, B>(f: (a: A) => Outcome<E, B>) => (outcome: Outcome<E, A>): Outcome<E, B> =>
		outcome.kind === "OpOk" ? f(outcome.value) : outcome as Outcome<E, B>;

	/**
	 * Runs a side effect on the success value without changing the Outcome.
	 *
	 * @example
	 * ```ts
	 * pipe(outcome, Op.tap(user => console.log("loaded", user.id)));
	 * ```
	 */
	export const tap = <E, A>(f: (a: A) => void) => (outcome: Outcome<E, A>): Outcome<E, A> => {
		if (outcome.kind === "OpOk") { f(outcome.value); }
		return outcome;
	};

	/**
	 * Provides a fallback Outcome when the result is `Err`. `Ok` and `Nil` pass through.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   outcome,
	 *   Op.recover(e => e.isRetryable ? Op.ok(cachedValue) : Op.err(e)),
	 * );
	 * ```
	 */
	export const recover = <E, A, B>(f: (e: E) => Outcome<E, B>) => (outcome: Outcome<E, A>): Outcome<E, A | B> =>
		outcome.kind === "OpErr" ? f(outcome.error) : outcome as Outcome<E, A | B>;

	/**
	 * Converts an Outcome to a `Result`. `Nil` becomes `Err(onNil())`.
	 *
	 * @example
	 * ```ts
	 * Op.toResult(() => new ApiError("no result"))(outcome);
	 * ```
	 */
	export const toResult = <E, A>(onNil: () => E) => (outcome: Outcome<E, A>): Result<E, A> => {
		if (outcome.kind === "OpOk") { return Result.ok(outcome.value); }
		if (outcome.kind === "OpErr") { return Result.err(outcome.error); }
		return Result.err(onNil());
	};

	/**
	 * Converts an Outcome to a `Maybe`. `Ok` becomes `Some`; `Err` and `Nil` become `None`.
	 *
	 * @example
	 * ```ts
	 * Op.toMaybe(outcome); // Maybe<User>
	 * ```
	 */
	export const toMaybe = <E, A>(outcome: Outcome<E, A>): Maybe<A> =>
		outcome.kind === "OpOk" ? Maybe.some(outcome.value) : Maybe.none();

	// -------------------------------------------------------------------------
	// Combinators for invocation-level results
	// -------------------------------------------------------------------------

	/**
	 * Resolves when all invocations settle, returning their outcomes in order.
	 * An alternative to `Promise.all` that stays within the `Op` type system.
	 *
	 * @example
	 * ```ts
	 * const [a, b] = await Op.all([manager.run(inputA), manager.run(inputB)]);
	 * ```
	 */
	export const all = <E, A>(
		invocations: ReadonlyArray<Deferred<Outcome<E, A>>>,
	): Deferred<ReadonlyArray<Outcome<E, A>>> => Deferred.fromPromise(Promise.all(invocations.map(Deferred.toPromise)));

	/**
	 * Resolves to the outcome of whichever invocation settles first.
	 * An alternative to `Promise.race` that stays within the `Op` type system.
	 *
	 * @example
	 * ```ts
	 * const winner = await Op.race([manager.run(inputA), manager.run(inputB)]);
	 * ```
	 */
	export const race = <E, A>(invocations: ReadonlyArray<Deferred<Outcome<E, A>>>): Deferred<Outcome<E, A>> =>
		Deferred.fromPromise(Promise.race(invocations.map(Deferred.toPromise)));

	/**
	 * Subscribes to a manager and calls a handler when the state reaches `OpOk`.
	 * Returns an unsubscribe function.
	 *
	 * @example
	 * ```ts
	 * const manager = Op.interpret(fetchUser, { strategy: "restartable" });
	 * const stop = Op.wire(manager, (user) => {
	 *   console.log("User loaded:", user.name);
	 * });
	 * manager.run(userId);
	 * // ... later
	 * stop(); // removes the subscription
	 * ```
	 */
	export const wire = <I, E, A, S extends State<E, A>>(source: Manager<I, E, A, S>, f: (a: A) => void): () => void =>
		source.subscribe((state) => {
			if (isOk(state)) { f(state.value); }
		});

	// -------------------------------------------------------------------------
	// Op.interpret — single entry point for managed execution
	// -------------------------------------------------------------------------

	/**
	 * Attaches a concurrency strategy to an `Op`, returning a `Manager`.
	 *
	 * Strategy is data, not a method name. The `S` type parameter is narrowed to only
	 * the states reachable for the chosen strategy and options — subscribers cannot
	 * reference states that cannot occur.
	 *
	 * **Strategies:**
	 * - `once`        — fires once. Only the first `run()` executes; subsequent calls
	 *                   return `DroppedNil` immediately. State is permanent after completion.
	 * - `restartable` — new call cancels the previous (`ReplacedNil`). Only the latest result matters.
	 * - `exclusive`   — new calls while in-flight return `DroppedNil` immediately.
	 * - `queue`       — calls run in submission order. `Queued` state shows position.
	 * - `buffered`    — 1 in-flight + 1 waiting slot. Newer calls evict the slot (`EvictedNil`).
	 * - `debounced`   — waits `ms` ms of quiet before starting. Earlier calls get `EvictedNil`.
	 *
	 * **`retry` and `timeout`** can be combined with any strategy. Both are applied
	 * internally per `run()` call — set the policy once, not at every call site.
	 * The timeout wraps the entire retry sequence (one deadline for all attempts).
	 * When `retry` is present, `Retrying` is added to the subscriber type.
	 *
	 * @example
	 * ```ts
	 * // Load once on mount — further calls are no-ops
	 * const getUser = Op.interpret(fetchUser, { strategy: "once" });
	 * getUser.subscribe(state => {
	 *   if (state.kind === "Pending") showSpinner();
	 *   if (state.kind === "OpOk")      render(state.value);
	 * });
	 * getUser.run(userId);
	 *
	 * // Search: cancel the previous query when a new one starts
	 * const search = Op.interpret(searchOp, { strategy: "restartable" });
	 *
	 * // Form submit: ignore double-clicks while in-flight
	 * const submit = Op.interpret(submitOp, {
	 *   strategy: "exclusive",
	 *   retry: { attempts: 3, backoff: n => n * 500 },
	 *   timeout: { ms: 10_000, onTimeout: () => new ApiError("timed out") },
	 * });
	 *
	 * // Auto-save: current save commits fully; latest pending edit saves next
	 * const save = Op.interpret(saveOp, { strategy: "buffered" });
	 * ```
	 */
	export function interpret<I, E, A, O extends AllInterpretOptions<I, E>>(
		op: Op<I, E, A>,
		options: O,
	): InterpretResult<I, E, A, O>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export function interpret<I, E, A>(
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
			retry?: RetryOptions<E>;
			timeout?: TimeoutOptions<E>;
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
				return makeDebounced(
					op,
					options.duration!,
					options.leading ?? false,
					options.maxWait,
					retryOptions,
					timeoutOptions,
				);
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
}
