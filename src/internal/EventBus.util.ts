import type { EventBus } from "../Core/EventBus.ts";

export const EVENT_BUS_STATE: unique symbol = Symbol.for("@nlozgachev/pipelined/EventBus.state") as any;

export type EventBusOptions = { readonly name?: string; readonly onError?: (error: unknown) => void; };

export type EventBusInternalState = {
	readonly options?: EventBusOptions;
	readonly listeners: Set<(msg: any) => void>;
	listenerArray: Array<(msg: any) => void> | null;
	readonly queue: Array<any>;
	isEmitting: boolean;
};

export type InternalEventBus<S extends Record<string, unknown>> = EventBus<S> & {
	readonly [EVENT_BUS_STATE]: EventBusInternalState;
};

export const toInternalEventBus = <S extends Record<string, unknown>>(bus: EventBus<S>): InternalEventBus<S> =>
	bus as unknown as InternalEventBus<S>;
