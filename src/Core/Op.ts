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
	OP_FACTORY,
} from "../internal/Op.util";

declare const _opBrand: unique symbol;

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
 *   { onError: (e) => new ApiError(e) },
 * );
 *
 * const manager = Op.interpret(fetchUser, { strategy: "restartable" });
 * manager.subscribe(state => {
 *   if (Op.is.pending(state)) showSpinner();
 *   if (Op.Outcome.is.ok(state)) render(state.value);
 *   if (Op.Outcome.is.err(state)) showError(state.error);
 *   if (Op.Outcome.is.nil(state)) resetUI();
 * });
 * manager.run(userId);
 * ```
 */
export type Op<Args extends readonly any[] = any[], E = unknown, A = unknown> = {
	readonly [_opBrand]: { readonly _args: (...args: Args) => void; readonly _error: () => E; readonly _value: () => A; };
};

// ---------------------------------------------------------------------------
// Op.interpret — internal helpers (not part of the public Op namespace)
// ---------------------------------------------------------------------------

// `Retrying<E>` is only added to the state union when retry options are present.
type MaybeRetry<E, O> = O extends { retry: InternalRetryOptions<E>; } ? Op.Retrying<E> : never;

// Union of all valid option shapes — exposed as a single type so the TS language service
// can show all strategy literals in autocomplete (overload aggregation is unreliable).
type AllInterpretOptions<Args extends readonly any[], E> =
	| ({ strategy: "once"; retry?: InternalRetryOptions<E>; } & WithTimeout<E>)
	| ({ strategy: "restartable"; retry?: InternalRetryOptions<E>; } & WithMinInterval & WithTimeout<E>)
	| ({ strategy: "exclusive"; retry?: InternalRetryOptions<E>; } & WithCooldown & WithTimeout<E>)
	| (
		& {
			strategy: "queue";
			retry?: InternalRetryOptions<E>;
			maxSize?: number;
			overflow?: "drop" | "replace-last";
			dedupe?: (a: Args, b: Args) => boolean;
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
	| ({ strategy: "keyed"; perKey?: "exclusive" | "restartable"; key: (...args: Args) => unknown; } & WithTimeout<E>);

// Extracts the key type from the `keyed` strategy's `key` function.
type KeyType<Args extends readonly any[], O> = O extends { key: (...args: Args) => infer K; } ? K : unknown;

// Conditional return type — dispatches on strategy (and variant flags) to preserve
// precise state-union typing without needing per-strategy overloads.
// Tuple form `[O] extends [...]` prevents distribution over unions.
type InterpretResult<Args extends readonly any[], E, A, O> = [O] extends [{ strategy: "throttled"; trailing: true; }]
	? Op.Manager<Args, E, A, Op.ThrottledTrailingState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "throttled"; }] ? Op.Manager<Args, E, A, Op.ThrottledState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "debounced"; }] ? Op.Manager<Args, E, A, Op.DebouncedState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "concurrent"; overflow: "queue"; }]
		? Op.Manager<Args, E, A, Op.ConcurrentQueueState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "concurrent"; }] ? Op.Manager<Args, E, A, Op.ConcurrentDropState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "keyed"; perKey: "restartable"; }]
		? Op.KeyedManager<Args, KeyType<Args, O>, E, Op.KeyedRestartablePerKey<E, A>>
	: [O] extends [{ strategy: "keyed"; }] ? Op.KeyedManager<Args, KeyType<Args, O>, E, Op.KeyedExclusivePerKey<E, A>>
	: [O] extends [{ strategy: "once"; }] ? Op.Manager<Args, E, A, Op.OnceState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "restartable"; }] ? Op.Manager<Args, E, A, Op.RestartableState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "exclusive"; }] ? Op.Manager<Args, E, A, Op.ExclusiveState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "queue"; overflow: "replace-last"; dedupe: (a: Args, b: Args) => boolean; }]
		? Op.Manager<Args, E, A, Op.QueueDropAndReplaceState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "queue"; overflow: "replace-last"; }]
		? Op.Manager<Args, E, A, Op.QueueReplaceState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "queue"; maxSize: number; }]
		? Op.Manager<Args, E, A, Op.QueueDropState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "queue"; dedupe: (a: Args, b: Args) => boolean; }]
		? Op.Manager<Args, E, A, Op.QueueDropState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "queue"; }] ? Op.Manager<Args, E, A, Op.QueueState<E, A> | MaybeRetry<E, O>>
	: [O] extends [{ strategy: "buffered"; }] ? Op.Manager<Args, E, A, Op.BufferedState<E, A> | MaybeRetry<E, O>>
	: never;

// Helpers for implementation
const makeOk = <A>(value: A): Op.Ok<A> => ({ kind: "OpOk", value });
const makeErr = <E>(error: E): Op.Err<E> => ({ kind: "OpErr", error });
const makeNil = (reason: Op.NilReason): Op.Nil => ({ kind: "OpNil", reason });

const isIdle = <E = unknown, A = unknown>(state: Op.State<E, A>): state is Op.Idle => state.kind === "Idle";
const isPending = <E = unknown, A = unknown>(state: Op.State<E, A>): state is Op.Pending => state.kind === "Pending";
const isQueued = <E = unknown, A = unknown>(state: Op.State<E, A>): state is Op.Queued => state.kind === "Queued";
const isRetrying = <E = unknown, A = unknown>(state: Op.State<E, A>): state is Op.Retrying<E> =>
	state.kind === "Retrying";
const isOk = <A = unknown>(stateOrOutcome: { readonly kind: string; }): stateOrOutcome is Op.Ok<A> =>
	stateOrOutcome.kind === "OpOk";
const isErr = <E = unknown>(stateOrOutcome: { readonly kind: string; }): stateOrOutcome is Op.Err<E> =>
	stateOrOutcome.kind === "OpErr";
const isNil = (stateOrOutcome: { readonly kind: string; }): stateOrOutcome is Op.Nil => stateOrOutcome.kind === "OpNil";

function interpretFn<Args extends readonly any[], E, A, O extends AllInterpretOptions<Args, E>>(
	op: Op<Args, E, A>,
	options: O,
): InterpretResult<Args, E, A, O>;
function interpretFn<Args extends readonly any[], E, A>(
	op: Op<Args, E, A>,
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
		key?: (...args: Args) => unknown;
		perKey?: "exclusive" | "restartable";
		maxSize?: number;
		concurrency?: number;
		dedupe?: (a: Args, b: Args) => boolean;
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
			return makeKeyed(
				op,
				(options.key ?? ((...args: Args) => args[0])) as (...args: Args) => unknown,
				options.perKey ?? "exclusive",
				timeoutOptions,
			);
		}
	}
}

const OpOutcome = {
	make: {
		/**
		 * Creates an Ok outcome with the given value.
		 *
		 * @see {@link Op.Outcome.make.err} to create an Err outcome.
		 * @see {@link Op.Outcome.make.nil} to create a Nil outcome.
		 *
		 * @example
		 * ```ts
		 * Op.Outcome.make.ok(42); // { kind: "OpOk", value: 42 }
		 * ```
		 */
		ok: makeOk,

		/**
		 * Creates an Err outcome with the given error.
		 *
		 * @see {@link Op.Outcome.make.ok} to create an Ok outcome.
		 * @see {@link Op.Outcome.make.nil} to create a Nil outcome.
		 *
		 * @example
		 * ```ts
		 * Op.Outcome.make.err("Something went wrong"); // { kind: "OpErr", error: "Something went wrong" }
		 * ```
		 */
		err: makeErr,

		/**
		 * Creates a Nil outcome with the given cancellation or drop reason.
		 *
		 * @see {@link Op.Outcome.make.ok} to create an Ok outcome.
		 * @see {@link Op.Outcome.make.err} to create an Err outcome.
		 *
		 * @example
		 * ```ts
		 * Op.Outcome.make.nil("aborted"); // { kind: "OpNil", reason: "aborted" }
		 * ```
		 */
		nil: makeNil,
	},

	is: {
		/**
		 * Type guard that checks if an Op state or outcome is Ok.
		 *
		 * @see {@link Op.Outcome.is.err} to check if an outcome or state is Err.
		 * @see {@link Op.Outcome.is.nil} to check if an outcome or state is Nil.
		 *
		 * @example
		 * ```ts
		 * if (Op.Outcome.is.ok(outcome)) {
		 *   render(outcome.value);
		 * }
		 * ```
		 */
		ok: isOk,

		/**
		 * Type guard that checks if an Op state or outcome is Err.
		 *
		 * @see {@link Op.Outcome.is.ok} to check if an outcome or state is Ok.
		 * @see {@link Op.Outcome.is.nil} to check if an outcome or state is Nil.
		 *
		 * @example
		 * ```ts
		 * if (Op.Outcome.is.err(outcome)) {
		 *   showError(outcome.error);
		 * }
		 * ```
		 */
		err: isErr,

		/**
		 * Type guard that checks if an Op state or outcome is Nil.
		 *
		 * @see {@link Op.Outcome.is.ok} to check if an outcome or state is Ok.
		 * @see {@link Op.Outcome.is.err} to check if an outcome or state is Err.
		 *
		 * @example
		 * ```ts
		 * if (Op.Outcome.is.nil(outcome)) {
		 *   console.log("Skipped due to:", outcome.reason);
		 * }
		 * ```
		 */
		nil: isNil,
	},

	/**
	 * Matches on an Op outcome by providing handlers for each variant.
	 *
	 * @see {@link Op.Outcome.fold} for positional argument folding.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   outcome,
	 *   Op.Outcome.match({
	 *     ok: (value) => `Value: ${value}`,
	 *     err: (error) => `Error: ${error}`,
	 *     nil: (reason) => `Cancelled: ${reason}`,
	 *   }),
	 * );
	 * ```
	 */
	match:
		<E, A, B>(cases: { ok: (value: A) => B; err: (error: E) => B; nil: (reason: Op.NilReason) => B; }) =>
		(outcome: Op.Outcome<E, A>): B => {
			if (outcome.kind === "OpOk") {
				return cases.ok(outcome.value);
			}
			if (outcome.kind === "OpErr") {
				return cases.err(outcome.error);
			}
			return cases.nil(outcome.reason);
		},

	/**
	 * Extracts the value from an Op outcome by providing positional handlers for each variant.
	 *
	 * @see {@link Op.Outcome.match} for named-case pattern matching with an object literal.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   outcome,
	 *   Op.Outcome.fold(
	 *     (error) => `Error: ${error}`,
	 *     (reason) => `Cancelled: ${reason}`,
	 *     (value) => `Value: ${value}`,
	 *   ),
	 * );
	 * ```
	 */
	fold:
		<E, A, B>(onErr: (error: E) => B, onNil: (reason: Op.NilReason) => B, onOk: (value: A) => B) =>
		(outcome: Op.Outcome<E, A>): B => {
			if (outcome.kind === "OpOk") {
				return onOk(outcome.value);
			}
			if (outcome.kind === "OpErr") {
				return onErr(outcome.error);
			}
			return onNil(outcome.reason);
		},

	/**
	 * Returns the value if Ok, otherwise executes the fallback function and returns its result.
	 *
	 * @example
	 * ```ts
	 * pipe(outcome, Op.Outcome.getOrElse(() => defaultValue));
	 * ```
	 */
	getOrElse: <B>(fallback: () => B) => <E = never, A = never>(outcome: Op.Outcome<E, A>): A | B =>
		outcome.kind === "OpOk" ? outcome.value : fallback(),

	/**
	 * Transforms the value inside an Ok outcome using the provided function.
	 *
	 * @see {@link Op.Outcome.chain} to sequence operations that themselves return an Op.Outcome.
	 * @see {@link Op.Outcome.mapError} to transform the error inside an Err outcome.
	 *
	 * @example
	 * ```ts
	 * pipe(outcome, Op.Outcome.map((x) => x * 2));
	 * ```
	 */
	map: <A, B>(transform: (value: A) => B) => <E = never>(outcome: Op.Outcome<E, A>): Op.Outcome<E, B> =>
		outcome.kind === "OpOk" ? makeOk(transform(outcome.value)) : outcome as Op.Outcome<E, B>,

	/**
	 * Transforms the error inside an Err outcome using the provided function.
	 *
	 * @see {@link Op.Outcome.map} to transform the value inside an Ok outcome.
	 *
	 * @example
	 * ```ts
	 * pipe(outcome, Op.Outcome.mapError((err) => new CustomError(err)));
	 * ```
	 */
	mapError: <E, F>(transform: (error: E) => F) => <A = never>(outcome: Op.Outcome<E, A>): Op.Outcome<F, A> =>
		outcome.kind === "OpErr" ? makeErr(transform(outcome.error)) : outcome as Op.Outcome<F, A>,

	/**
	 * Sequences an operation that produces an Op.Outcome if the current outcome is Ok.
	 *
	 * @see {@link Op.Outcome.map} to transform the inner value without returning a new Op.Outcome.
	 *
	 * @example
	 * ```ts
	 * pipe(outcome, Op.Outcome.chain((val) => validate(val)));
	 * ```
	 */
	chain:
		<E2, A, B>(transform: (value: A) => Op.Outcome<E2, B>) =>
		<E1 = never>(outcome: Op.Outcome<E1, A>): Op.Outcome<E1 | E2, B> =>
			outcome.kind === "OpOk" ? transform(outcome.value) : outcome as Op.Outcome<E1 | E2, B>,

	/**
	 * Executes a side effect if the outcome is Ok and returns the original outcome unchanged.
	 *
	 * @see {@link Op.Outcome.tapError} to execute a side effect on Err outcomes.
	 *
	 * @example
	 * ```ts
	 * pipe(outcome, Op.Outcome.tap((val) => console.log(val)));
	 * ```
	 */
	tap: <A>(sideEffect: (value: A) => void) => <E = never>(outcome: Op.Outcome<E, A>): Op.Outcome<E, A> => {
		if (outcome.kind === "OpOk") {
			sideEffect(outcome.value);
		}
		return outcome;
	},

	/**
	 * Executes a side effect if the outcome is Err and returns the original outcome unchanged.
	 *
	 * @see {@link Op.Outcome.tap} to execute a side effect on Ok outcomes.
	 *
	 * @example
	 * ```ts
	 * pipe(outcome, Op.Outcome.tapError((err) => console.error(err)));
	 * ```
	 */
	tapError: <E>(sideEffect: (error: E) => void) => <A = never>(outcome: Op.Outcome<E, A>): Op.Outcome<E, A> => {
		if (outcome.kind === "OpErr") {
			sideEffect(outcome.error);
		}
		return outcome;
	},

	/**
	 * Recovers from an Err outcome by applying a recovery function that returns a new Op.Outcome.
	 *
	 * @example
	 * ```ts
	 * pipe(outcome, Op.Outcome.recover((err) => Op.Outcome.make.ok(fallbackValue)));
	 * ```
	 */
	recover:
		<E1, E2, B>(handler: (error: E1) => Op.Outcome<E2, B>) =>
		<A = never>(outcome: Op.Outcome<E1, A>): Op.Outcome<E2, A | B> =>
			outcome.kind === "OpErr" ? handler(outcome.error) : outcome as Op.Outcome<E2, A | B>,

	to: {
		/**
		 * Converts an Op.Outcome to a Result.
		 *
		 * @see {@link Op.Outcome.to.Maybe} to convert an outcome to a Maybe.
		 *
		 * @example
		 * ```ts
		 * pipe(outcome, Op.Outcome.to.Result((reason) => new Error(`Skipped: ${reason}`)));
		 * ```
		 */
		Result:
			<E2>(onNil: (reason: Op.NilReason) => E2) =>
			<E1 = never, A = never>(outcome: Op.Outcome<E1, A>): CoreResult<E1 | E2, A> => {
				if (outcome.kind === "OpOk") {
					return CoreResult.make.ok(outcome.value);
				}
				if (outcome.kind === "OpErr") {
					return CoreResult.make.err(outcome.error);
				}
				return CoreResult.make.err(onNil(outcome.reason));
			},

		/**
		 * Converts an Op.Outcome to a Maybe, mapping Ok to Some and both Err and Nil to None.
		 *
		 * @see {@link Op.Outcome.to.Result} to convert an outcome to a Result.
		 *
		 * @example
		 * ```ts
		 * pipe(outcome, Op.Outcome.to.Maybe);
		 * ```
		 */
		Maybe: <E = never, A = never>(outcome: Op.Outcome<E, A>): CoreMaybe<A> =>
			outcome.kind === "OpOk" ? CoreMaybe.make.some(outcome.value) : CoreMaybe.make.none(),
	},
};

export const Op = {
	is: {
		/**
		 * Type guard that checks if an Op state is Idle.
		 *
		 * @see {@link Op.is.pending} to check if an Op is actively executing.
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
		 * @see {@link Op.is.idle} to check if an Op is waiting to execute.
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
		 * @see {@link Op.is.pending} to check if an Op is actively executing.
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
		 * @see {@link Op.is.pending} to check if an Op is actively executing.
		 *
		 * @example
		 * ```ts
		 * if (Op.is.retrying(manager.state)) {
		 *   console.log("Retry attempt:", manager.state.attempt);
		 * }
		 * ```
		 */
		retrying: isRetrying,
	},

	/**
	 * Creates an Op from a signal-accepting factory function that returns the async action,
	 * along with an error mapping handler.
	 *
	 * Arguments to the returned function are automatically inferred as tuple parameters via `Parameters<Fn>`.
	 *
	 * @see {@link Op.lift} to construct an Op without explicit error transformation.
	 *
	 * @example
	 * ```ts
	 * const fetchUser = Op.create(
	 *   (signal) => (id: string) => fetch(`/users/${id}`, { signal }).then(r => r.json() as Promise<User>),
	 *   { onError: (error) => new ApiError(error) },
	 * );
	 * ```
	 */
	create: <Fn extends (...args: any[]) => Promise<any>, E = unknown>(
		factory: (signal: AbortSignal) => Fn,
		options: { onError: (error: unknown) => E; },
	): Op<Parameters<Fn>, E, Awaited<ReturnType<Fn>>> =>
		({
			[OP_FACTORY]: (args: Parameters<Fn>, signal: AbortSignal) =>
				Deferred.from.Promise(
					(async () => {
						const fn = factory(signal);
						return await fn(...args);
					})().then((value): CoreResult<E, Awaited<ReturnType<Fn>>> => CoreResult.make.ok(value)).catch((
						error,
					): CoreResult<E, Awaited<ReturnType<Fn>>> | null =>
						signal.aborted ? null : CoreResult.make.err(options.onError(error))
					),
				),
		}) as unknown as Op<Parameters<Fn>, E, Awaited<ReturnType<Fn>>>,

	/**
	 * Lifts an async action into an Op without requiring explicit error transformation.
	 * Unknown errors thrown by the async action are passed through untyped.
	 *
	 * @see {@link Op.create} to construct an Op with a typed error transformation.
	 *
	 * @example
	 * ```ts
	 * const fetchOp = Op.lift((signal) => (url: string) => fetch(url, { signal }));
	 * ```
	 */
	lift: <Fn extends (...args: any[]) => Promise<any>>(
		factory: (signal: AbortSignal) => Fn,
	): Op<Parameters<Fn>, unknown, Awaited<ReturnType<Fn>>> => Op.create(factory, { onError: (error) => error }),

	/**
	 * Subscribes to an Op manager and executes a side-effect whenever the manager emits an Ok outcome.
	 * Returns an unsubscribe callback.
	 *
	 * @example
	 * ```ts
	 * const unsubscribe = Op.wire(userManager, (user) => analyticsManager.run(user.id));
	 * ```
	 */
	wire: <Args extends readonly any[], E, A, S extends Op.State<E, A>>(
		source: Op.Manager<Args, E, A, S>,
		sideEffect: (value: A) => void,
	): () => void =>
		source.subscribe((state) => {
			if (isOk<A>(state)) {
				sideEffect(state.value);
			}
		}),

	/**
	 * Interprets an Op blueprint with a concurrency and lifecycle strategy, returning a Manager.
	 *
	 * @see {@link Op.create} to construct an Op blueprint.
	 *
	 * @example
	 * ```ts
	 * const manager = Op.interpret(fetchUser, { strategy: "restartable" });
	 * ```
	 */
	interpret: interpretFn,

	/**
	 * Settled outcome value constructors, type guards, eliminators, and combinators.
	 */
	Outcome: OpOutcome,
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
	export type Manager<Args extends readonly any[], E, A, S extends State<E, A>> = {
		readonly state: S;
		/**
		 * Triggers execution of the operation with the given arguments.
		 * Resolves with the settled `Op.Outcome` wrapped in a `Deferred`.
		 *
		 * Coordinate concurrent runs using `Deferred.all` or `Deferred.race`.
		 *
		 * @example
		 * ```ts
		 * const outcome = await manager.run("user_123");
		 *
		 * // Coordinate concurrent runs:
		 * const [user, settings] = await Deferred.all([
		 *   userManager.run("user_123"),
		 *   settingsManager.run(),
		 * ]);
		 * ```
		 */
		run: (...args: Args) => Deferred<Exclude<S, Idle | Pending | Queued | Retrying<E>>>;
		abort: () => void;
		subscribe: (cb: (state: S) => void) => () => void;
		reset: () => void;
		poll: (options: { interval: Duration; }) => (...args: Args) => () => void;
	};
	export type KeyedManager<Args extends readonly any[], K, E, PerKeyS> = {
		readonly state: ReadonlyMap<K, PerKeyS>;
		/**
		 * Triggers execution for the specific keyed item with the given arguments.
		 * Resolves with the settled `Op.Outcome` wrapped in a `Deferred`.
		 *
		 * Coordinate concurrent runs across keys using `Deferred.all` or `Deferred.race`.
		 *
		 * @example
		 * ```ts
		 * const [item1, item2] = await Deferred.all([
		 *   keyedManager.run("item_1"),
		 *   keyedManager.run("item_2"),
		 * ]);
		 * ```
		 */
		run: (...args: Args) => Deferred<Exclude<PerKeyS, Pending | Retrying<E>>>;
		abort: (key?: K) => void;
		subscribe: (cb: (state: ReadonlyMap<K, PerKeyS>) => void) => () => void;
		reset: () => void;
		poll: (options: { interval: Duration; }) => (...args: Args) => () => void;
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
