import type { EventBus } from "../Core/EventBus.ts";

/**
 * Unique symbol key used to access the private internal execution state of an `EventBus`.
 *
 * @internal
 */
export const EVENT_BUS_STATE: unique symbol = Symbol.for("@pplnd/core/EventBus.state") as typeof EVENT_BUS_STATE;

/**
 * Configuration options stored in the internal state of an `EventBus`.
 *
 * @internal
 */
export type EventBusOptions = {
	readonly id?: string;
	readonly onError?: (error: unknown, context?: { readonly busId?: string; readonly message: unknown; }) => void;
};

/**
 * Low-level operational state backing an `EventBus` instance.
 *
 * Manages subscriber registration, cached snapshot arrays for zero-allocation emission loops,
 * and a synchronous reentrant emission queue to ensure deterministic FIFO event dispatch.
 *
 * @internal
 */
export type EventBusInternalState = {
	/**
	 * Diagnostic label and error-handling options provided at bus construction.
	 */
	readonly options?: EventBusOptions;

	/**
	 * Primary mutable subscriber registry providing O(1) subscription addition, removal,
	 * and reference identity deduplication.
	 */
	readonly subscribers: Set<(msg: unknown) => void>;

	/**
	 * Cached array snapshot of `subscribers`.
	 *
	 * Avoids allocating new array instances on every `emit` call (~3x throughput gain, 0 heap allocations
	 * on hot paths). Invalidated to `null` whenever `subscribers` is mutated (`add` / `delete`).
	 * Lazily rebuilt on the next emission loop.
	 *
	 * Guarantees snapshot isolation during emission so newly added subscribers do not execute
	 * prematurely for in-flight events.
	 */
	subscriberArray: Array<(msg: unknown) => void> | null;

	/**
	 * Breadth-first reentrancy queue buffering events emitted synchronously by subscriber callbacks.
	 *
	 * Processed sequentially in FIFO order by the active emission trampoline loop.
	 */
	readonly queue: Array<unknown>;

	/**
	 * Guard flag tracking whether an emission trampoline loop is actively draining the queue.
	 *
	 * When `true`, subsequent reentrant emissions push to `queue` and return immediately,
	 * preventing recursive stack growth and ensuring deterministic ordering.
	 */
	isEmitting: boolean;
};

/**
 * Representation of an `EventBus` exposing its hidden internal state symbol.
 *
 * @internal
 */
export type InternalEventBus<S extends Record<string, unknown>> = EventBus<S> & {
	readonly [EVENT_BUS_STATE]: EventBusInternalState;
};

/**
 * Unwraps an `EventBus` instance to expose its internal state structure.
 *
 * @internal
 */
export const toInternalEventBus = <S extends Record<string, unknown>>(bus: EventBus<S>): InternalEventBus<S> =>
	bus as unknown as InternalEventBus<S>;
