import type { WithError, WithKind, WithValue } from "../internal/InternalTypes";
import { Duration } from "../Types/Duration.ts";
import { Deferred } from "./Deferred.ts";
import { Maybe } from "./Maybe.ts";
import { Result } from "./Result.ts";
import type { Task } from "./Task.ts";

/**
 * A microtask-coalescing request demultiplexer that batches concurrent single-key lookups
 * into a single bulk query to eliminate N+1 query loops.
 *
 * Unlike traditional cache-bound loaders, `Batcher` is stateless across execution turns:
 * once a batch resolves and its callers settle, its pending queue clears. This allows
 * `Batcher` instances to live safely as long-lived application singletons without memory
 * leaks or cross-request stale state.
 *
 * @example
 * ```ts
 * const userBatcher = Batcher.make({
 *   fetch: (ids: readonly string[]) =>
 *     pipe(
 *       db.users.findMany({ where: { id: { in: ids } } }),
 *       Task.Result.map(Arr.indexBy((u) => u.id)),
 *     ),
 *   maxBatchSize: 100,
 * });
 *
 * // Resolves to a first-class tri-state outcome:
 * const outcome = await userBatcher.load("u_1");
 * ```
 */
export type Batcher<K, E, V> = {
	/**
	 * Immediately coalesces the given key into the active batch window and returns
	 * an eager `Deferred` resolving to a tri-state `Batcher.Outcome<E, V, K>`.
	 *
	 * @param key - The key to look up.
	 * @param signal - Optional AbortSignal to cancel this individual caller's lookup.
	 * @see {@link Batcher.loadMany} to coalesce multiple keys in a single call.
	 */
	readonly load: (key: K, signal?: AbortSignal) => Deferred<Batcher.Outcome<E, V, K>>;

	/**
	 * Immediately coalesces multiple keys into the batch window and returns their resolved
	 * outcomes in order.
	 *
	 * Does not short-circuit: preserves discrete per-key outcomes (`Ok`, `Missing`, or `Err`)
	 * for each requested key.
	 *
	 * @param keys - The collection of keys to look up.
	 * @param signal - Optional AbortSignal to cancel this caller's lookup batch.
	 * @see {@link Batcher.load} to look up an individual key.
	 */
	readonly loadMany: (keys: readonly K[], signal?: AbortSignal) => Deferred<readonly Batcher.Outcome<E, V, K>[]>;

	/**
	 * Immediately flushes and settles all currently queued batches without waiting
	 * for the microtask tick or window timer to elapse.
	 *
	 * Primarily used in unit tests or before transaction boundaries to guarantee
	 * deterministic batch execution.
	 *
	 * @see {@link Batcher.load} to enqueue individual lookups.
	 */
	readonly flush: () => Deferred<void>;
};

export namespace Batcher {
	/**
	 * Represents a successful batch resolution containing the found value.
	 */
	export type Ok<V> = WithKind<"BatcherOk"> & WithValue<V>;

	/**
	 * Represents a query execution failure (e.g. database down, network timeout).
	 */
	export type Err<E> = WithKind<"BatcherErr"> & WithError<E>;

	/**
	 * Represents an absent key where the batch query succeeded but the key was not found.
	 */
	export type Missing<K> = WithKind<"BatcherMissing"> & {
		/**
		 * The key that was requested but absent from the resolved map.
		 */
		readonly key: K;
	};

	/**
	 * A tri-state domain outcome representing the result of looking up a key in a batch:
	 * - `BatcherOk`: Found value `V`.
	 * - `BatcherMissing`: Absent key `K`.
	 * - `BatcherErr`: Execution error `E`.
	 */
	export type Outcome<E, V, K> = Ok<V> | Err<E> | Missing<K>;

	/**
	 * Configuration options for constructing a `Batcher`.
	 */
	export type Options<K, E, V> = {
		/**
		 * Executes the batched query for all collected unique keys.
		 * Must return a `ReadonlyMap` associating each found key to its value.
		 */
		readonly fetch: (keys: readonly K[]) => Task.Result<E, ReadonlyMap<K, V>>;

		/**
		 * Serializer used to index and deduplicate composite or structural object keys.
		 * Unnecessary for primitive keys (`string`, `number`).
		 */
		readonly serializeKey?: (key: K) => string | number;

		/**
		 * Maximum number of keys dispatched per batch query. Excess keys are chunked.
		 */
		readonly maxBatchSize?: number;

		/**
		 * Time window across which incoming calls are buffered before dispatch.
		 * Defaults to 0ms (microtask turn).
		 */
		readonly window?: Duration;

		/**
		 * Maximum number of chunked batch queries allowed to run concurrently in flight.
		 * Defaults to `Infinity` (all chunks execute in parallel).
		 */
		readonly concurrency?: number;
	};
}

// =============================================================================
// Outcome Helpers & Implementation
// =============================================================================

const makeOk = <V, E = never, K = never>(value: V): Batcher.Outcome<E, V, K> => ({ kind: "BatcherOk", value });

const makeErr = <E, V = never, K = never>(error: E): Batcher.Outcome<E, V, K> => ({ kind: "BatcherErr", error });

const makeMissing = <K, E = never, V = never>(key: K): Batcher.Outcome<E, V, K> => ({ kind: "BatcherMissing", key });

const isOk = <E, V, K>(outcome: Batcher.Outcome<E, V, K>): outcome is Batcher.Ok<V> => outcome.kind === "BatcherOk";

const isErr = <E, V, K>(outcome: Batcher.Outcome<E, V, K>): outcome is Batcher.Err<E> => outcome.kind === "BatcherErr";

const isMissing = <E, V, K>(outcome: Batcher.Outcome<E, V, K>): outcome is Batcher.Missing<K> =>
	outcome.kind === "BatcherMissing";

const matchOutcome =
	<E, V, K, B>(
		cases: { readonly ok: (value: V) => B; readonly missing: (key: K) => B; readonly err: (error: E) => B; },
	) =>
	(outcome: Batcher.Outcome<E, V, K>): B => {
		switch (outcome.kind) {
			case "BatcherOk":
				return cases.ok(outcome.value);
			case "BatcherMissing":
				return cases.missing(outcome.key);
			case "BatcherErr":
				return cases.err(outcome.error);
		}
	};

const mapOutcome =
	<V, B>(transform: (value: V) => B) =>
	<E = never, K = never>(outcome: Batcher.Outcome<E, V, K>): Batcher.Outcome<E, B, K> =>
		outcome.kind === "BatcherOk" ? makeOk(transform(outcome.value)) : outcome;

const mapErrorOutcome =
	<E, F>(transform: (error: E) => F) =>
	<V = never, K = never>(outcome: Batcher.Outcome<E, V, K>): Batcher.Outcome<F, V, K> =>
		outcome.kind === "BatcherErr" ? makeErr(transform(outcome.error)) : outcome;

const getOrElseOutcome =
	<B>(fallback: () => B) => <E = never, V = never, K = never>(outcome: Batcher.Outcome<E, V, K>): V | B =>
		outcome.kind === "BatcherOk" ? outcome.value : fallback();

const toResultOutcome =
	<K, E2>(onMissing: (key: K) => E2) => <E = never, V = never>(outcome: Batcher.Outcome<E, V, K>): Result<E | E2, V> => {
		switch (outcome.kind) {
			case "BatcherOk":
				return Result.make.ok(outcome.value);
			case "BatcherMissing":
				return Result.make.err(onMissing(outcome.key));
			case "BatcherErr":
				return Result.make.err(outcome.error);
		}
	};

const toMaybeOutcome = <E = never, V = never, K = never>(outcome: Batcher.Outcome<E, V, K>): Maybe<V> =>
	outcome.kind === "BatcherOk" ? Maybe.make.some(outcome.value) : Maybe.make.none();

const toNullableOutcome = <E = never, V = never, K = never>(outcome: Batcher.Outcome<E, V, K>): V | null =>
	outcome.kind === "BatcherOk" ? outcome.value : null;

// =============================================================================
// Batcher Engine Implementation
// =============================================================================

const defaultSerialize = <K>(key: K): unknown => key;

const makeBatcher = <K, E, V>(options: Batcher.Options<K, E, V>): Batcher<K, E, V> => {
	type KeyHash = unknown;
	type CallerEntry = { readonly resolve: (outcome: Batcher.Outcome<E, V, K>) => void; readonly signal?: AbortSignal; };
	type PendingKeySlot = { readonly key: K; readonly callers: CallerEntry[]; };

	const serialize = options.serializeKey ?? defaultSerialize;
	const maxBatchSize =
		options.maxBatchSize !== undefined && Number.isInteger(options.maxBatchSize) && options.maxBatchSize > 0
			? options.maxBatchSize
			: Infinity;
	const concurrency =
		options.concurrency !== undefined && Number.isInteger(options.concurrency) && options.concurrency > 0
			? options.concurrency
			: Infinity;

	let queue = new Map<KeyHash, PendingKeySlot>();
	let scheduled = false;
	let timerHandle: ReturnType<typeof setTimeout> | undefined;

	let inFlightBatches = 0;
	const pendingChunks: PendingKeySlot[][] = [];
	const flushWaiters: (() => void)[] = [];

	const dispatchChunk = (chunk: PendingKeySlot[]): Promise<void> => {
		const chunkLen = chunk.length;
		const keys = new Array<K>(chunkLen);
		for (let i = 0; i < chunkLen; i++) {
			keys[i] = chunk[i].key;
		}

		// Count active un-aborted callers
		let activeCallersCount = 0;
		for (let i = 0; i < chunkLen; i++) {
			const { callers } = chunk[i];
			for (let j = 0; j < callers.length; j++) {
				if (!callers[j].signal?.aborted) {
					activeCallersCount++;
				}
			}
		}

		if (activeCallersCount === 0) {
			return Promise.resolve();
		}

		return new Promise<void>((resolveDispatch) => {
			const taskDeferred = options.fetch(keys)();
			taskDeferred.then((batchResult) => {
				if (Result.is.err(batchResult)) {
					const errOutcome = makeErr<E, V, K>(batchResult.error);
					for (let i = 0; i < chunkLen; i++) {
						const { callers } = chunk[i];
						for (let j = 0; j < callers.length; j++) {
							if (!callers[j].signal?.aborted) {
								callers[j].resolve(errOutcome);
							}
						}
					}
				} else {
					const resultMap = batchResult.value;
					for (let i = 0; i < chunkLen; i++) {
						const { key, callers } = chunk[i];
						const outcome: Batcher.Outcome<E, V, K> = resultMap.has(key) ? makeOk(resultMap.get(key)!) : makeMissing(key);

						for (let j = 0; j < callers.length; j++) {
							if (!callers[j].signal?.aborted) {
								callers[j].resolve(outcome);
							}
						}
					}
				}
				resolveDispatch();
			});
		});
	};

	const notifyFlushWaitersIfDone = (): void => {
		if (queue.size === 0 && pendingChunks.length === 0 && inFlightBatches === 0) {
			while (flushWaiters.length > 0) {
				const waiter = flushWaiters.shift()!;
				waiter();
			}
		}
	};

	const pumpChunks = (): void => {
		const onChunkSettled = (): void => {
			inFlightBatches--;
			pumpChunks();
			notifyFlushWaitersIfDone();
		};

		while (inFlightBatches < concurrency && pendingChunks.length > 0) {
			const nextChunk = pendingChunks.shift()!;
			inFlightBatches++;
			void dispatchChunk(nextChunk).then(onChunkSettled);
		}
		notifyFlushWaitersIfDone();
	};

	const flushQueue = (): Promise<void> => {
		if (timerHandle !== undefined) {
			clearTimeout(timerHandle);
			timerHandle = undefined;
		}
		scheduled = false;

		if (queue.size > 0) {
			const activeQueue = queue;
			queue = new Map();

			const slots = Array.from(activeQueue.values());
			const slotsLen = slots.length;

			for (let i = 0; i < slotsLen; i += maxBatchSize) {
				pendingChunks.push(slots.slice(i, i + maxBatchSize));
			}
		}

		pumpChunks();

		if (pendingChunks.length === 0 && inFlightBatches === 0) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve) => {
			flushWaiters.push(resolve);
		});
	};

	const scheduleFlush = (): void => {
		if (scheduled) {
			return;
		}
		scheduled = true;

		if (options.window !== undefined) {
			const ms = Duration.to.milliseconds(options.window);
			timerHandle = setTimeout(() => {
				void flushQueue();
			}, ms);
		} else {
			queueMicrotask(() => {
				void flushQueue();
			});
		}
	};

	const load = (key: K, signal?: AbortSignal): Deferred<Batcher.Outcome<E, V, K>> =>
		Deferred.from.Promise(
			new Promise<Batcher.Outcome<E, V, K>>((resolve) => {
				if (signal?.aborted) {
					resolve(makeErr((signal.reason ?? new Error("Aborted")) as E));
					return;
				}

				const hash = serialize(key);
				let slot = queue.get(hash);
				if (slot === undefined) {
					slot = { key, callers: [] };
					queue.set(hash, slot);
				}

				const entry: CallerEntry = { resolve, signal };
				slot.callers.push(entry);

				if (signal !== undefined) {
					signal.addEventListener("abort", () => {
						const { callers } = slot!;
						const idx = callers.indexOf(entry);
						if (idx !== -1) {
							callers.splice(idx, 1);
						}
						if (callers.length === 0) {
							queue.delete(hash);
						}
						resolve(makeErr((signal.reason ?? new Error("Aborted")) as E));
					}, { once: true });
				}

				if (queue.size >= maxBatchSize) {
					void flushQueue();
				} else {
					scheduleFlush();
				}
			}),
		);

	const loadMany = (keys: readonly K[], signal?: AbortSignal): Deferred<readonly Batcher.Outcome<E, V, K>[]> => {
		const len = keys.length;
		if (len === 0) {
			return Deferred.from.Promise(Promise.resolve([]));
		}

		return Deferred.from.Promise(Promise.all(keys.map((k) => Deferred.to.Promise(load(k, signal)))));
	};

	const flush = (): Deferred<void> => Deferred.from.Promise(flushQueue());

	return { load, loadMany, flush };
};

export const Batcher = {
	/**
	 * Creates a stateful `Batcher` with the provided configuration options.
	 *
	 * @example
	 * ```ts
	 * const userBatcher = Batcher.make({
	 *   fetch: (ids: readonly string[]) =>
	 *     pipe(
	 *       db.users.findMany({ where: { id: { in: ids } } }),
	 *       Task.Result.map(Arr.indexBy((u) => u.id)),
	 *     ),
	 *   maxBatchSize: 100,
	 * });
	 * ```
	 */
	make: makeBatcher,

	/**
	 * Synchronous elimination, type guards, and converters for `Batcher.Outcome`.
	 */
	Outcome: {
		/**
		 * Constructors for creating `Batcher.Outcome` variants.
		 */
		make: {
			/**
			 * Creates a `BatcherOk` outcome.
			 *
			 * @see {@link Batcher.Outcome.make.err} to construct an error outcome.
			 * @see {@link Batcher.Outcome.make.missing} to construct an absent key outcome.
			 *
			 * @example
			 * ```ts
			 * const ok = Batcher.Outcome.make.ok({ id: "u1", name: "Alice" });
			 * ```
			 */
			ok: makeOk,

			/**
			 * Creates a `BatcherErr` outcome.
			 *
			 * @see {@link Batcher.Outcome.make.ok} to construct a successful outcome.
			 * @see {@link Batcher.Outcome.make.missing} to construct an absent key outcome.
			 *
			 * @example
			 * ```ts
			 * const err = Batcher.Outcome.make.err(new Error("DB connection lost"));
			 * ```
			 */
			err: makeErr,

			/**
			 * Creates a `BatcherMissing` outcome.
			 *
			 * @see {@link Batcher.Outcome.make.ok} to construct a successful outcome.
			 * @see {@link Batcher.Outcome.make.err} to construct an error outcome.
			 *
			 * @example
			 * ```ts
			 * const missing = Batcher.Outcome.make.missing("u_99");
			 * ```
			 */
			missing: makeMissing,
		},

		/**
		 * Type guards for checking `Batcher.Outcome` variants.
		 */
		is: {
			/**
			 * Checks whether an outcome is a `BatcherOk`.
			 *
			 * @see {@link Batcher.Outcome.is.err} to check for a query failure.
			 * @see {@link Batcher.Outcome.is.missing} to check for an absent key.
			 *
			 * @example
			 * ```ts
			 * if (Batcher.Outcome.is.ok(outcome)) {
			 *   console.log(outcome.value);
			 * }
			 * ```
			 */
			ok: isOk,

			/**
			 * Checks whether an outcome is a `BatcherErr`.
			 *
			 * @see {@link Batcher.Outcome.is.ok} to check for a resolved value.
			 * @see {@link Batcher.Outcome.is.missing} to check for an absent key.
			 *
			 * @example
			 * ```ts
			 * if (Batcher.Outcome.is.err(outcome)) {
			 *   console.error(outcome.error);
			 * }
			 * ```
			 */
			err: isErr,

			/**
			 * Checks whether an outcome is a `BatcherMissing`.
			 *
			 * @see {@link Batcher.Outcome.is.ok} to check for a resolved value.
			 * @see {@link Batcher.Outcome.is.err} to check for a query failure.
			 *
			 * @example
			 * ```ts
			 * if (Batcher.Outcome.is.missing(outcome)) {
			 *   console.warn(`Key missing: ${outcome.key}`);
			 * }
			 * ```
			 */
			missing: isMissing,
		},

		/**
		 * Eliminates a `Batcher.Outcome` by handling all three cases (`ok`, `missing`, `err`).
		 *
		 * @see {@link Batcher.Outcome.getOrElse} to extract the value with a fallback.
		 *
		 * @example
		 * ```ts
		 * const status = pipe(
		 *   outcome,
		 *   Batcher.Outcome.match({
		 *     ok: (user) => 200,
		 *     missing: (key) => 404,
		 *     err: (error) => 500,
		 *   }),
		 * );
		 * ```
		 */
		match: matchOutcome,

		/**
		 * Transforms the value inside a `BatcherOk` outcome. Leaves `Missing` and `Err` unchanged.
		 *
		 * @see {@link Batcher.Outcome.mapError} to transform the error channel instead.
		 *
		 * @example
		 * ```ts
		 * const nameOutcome = pipe(outcome, Batcher.Outcome.map((user) => user.name));
		 * ```
		 */
		map: mapOutcome,

		/**
		 * Transforms the error inside a `BatcherErr` outcome. Leaves `Ok` and `Missing` unchanged.
		 *
		 * @see {@link Batcher.Outcome.map} to transform the value channel instead.
		 *
		 * @example
		 * ```ts
		 * const mapped = pipe(outcome, Batcher.Outcome.mapError((err) => new CustomError(err)));
		 * ```
		 */
		mapError: mapErrorOutcome,

		/**
		 * Returns the value if `BatcherOk`, otherwise returns the fallback value.
		 *
		 * @see {@link Batcher.Outcome.match} to handle all three cases explicitly.
		 *
		 * @example
		 * ```ts
		 * const user = pipe(outcome, Batcher.Outcome.getOrElse(() => defaultGuestUser));
		 * ```
		 */
		getOrElse: getOrElseOutcome,

		/**
		 * Converters from `Batcher.Outcome` to standard library and native representations.
		 */
		to: {
			/**
			 * Converts a `Batcher.Outcome` to a `Result`, projecting `BatcherMissing` into a domain error.
			 *
			 * @see {@link Batcher.Outcome.to.Maybe} to convert to an optional value.
			 *
			 * @example
			 * ```ts
			 * const res = pipe(
			 *   outcome,
			 *   Batcher.Outcome.to.Result((id) => ({ kind: "UserNotFound" as const, id })),
			 * );
			 * ```
			 */
			Result: toResultOutcome,

			/**
			 * Converts a `Batcher.Outcome` to a `Maybe`, mapping `BatcherOk` to `Some` and both
			 * `BatcherMissing` and `BatcherErr` to `None`.
			 *
			 * @see {@link Batcher.Outcome.to.Result} to convert to a fallible Result.
			 *
			 * @example
			 * ```ts
			 * const maybe = pipe(outcome, Batcher.Outcome.to.Maybe);
			 * ```
			 */
			Maybe: toMaybeOutcome,

			/**
			 * Converts a `Batcher.Outcome` to a nullable value (`V | null`), mapping `BatcherOk`
			 * to `V` and both `BatcherMissing` and `BatcherErr` to `null`.
			 *
			 * @see {@link Batcher.Outcome.to.Maybe} to convert to a type-safe Maybe.
			 *
			 * @example
			 * ```ts
			 * const userOrNull = pipe(outcome, Batcher.Outcome.to.nullable);
			 * ```
			 */
			nullable: toNullableOutcome,
		},
	},
};
