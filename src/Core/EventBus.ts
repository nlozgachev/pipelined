import { EVENT_BUS_STATE, toInternalEventBus, WithKind, WithValue } from "#internal";

// ---------------------------------------------------------------------------
// EventBus<S>
// ---------------------------------------------------------------------------

declare const _eventBusBrand: unique symbol;

/**
 * An event bus pipeline for a typed message schema `S`.
 *
 * `EventBus` provides typed event emission, sequence matching, state reduction,
 * and structural event bus forwarding with zero-overhead reentrant queuing.
 *
 * @example
 * ```ts
 * type AppMessages = {
 *   userLoggedIn: { userId: string };
 *   checkoutStarted: { amount: number };
 * };
 *
 * const appBus = EventBus.make<AppMessages>();
 *
 * const subscription = EventBus.listen(
 *   appBus,
 *   ["userLoggedIn", "checkoutStarted"],
 *   { ordered: true }
 * ).collect((payloads) => {
 *   console.log("Checkout started for:", payloads.userLoggedIn.userId);
 * });
 *
 * EventBus.emit(appBus, {
 *   kind: "userLoggedIn",
 *   value: { userId: "user-1" },
 * });
 * ```
 */
export type EventBus<S extends Record<string, unknown>> = { readonly [_eventBusBrand]: (schema: S) => S; };

export namespace EventBus {
	/**
	 * A discriminated union of all message types defined in an event schema `S`,
	 * optionally restricted to specific message keys `K`.
	 *
	 * Each variant conforms to `{ kind: Key, value: S[Key] }`.
	 */
	export type Message<S extends Record<string, unknown>, K extends keyof S & string = keyof S & string> = {
		[Key in K]: WithKind<Key> & WithValue<S[Key]>;
	}[K];

	/**
	 * Configuration options for creating an `EventBus`.
	 */
	export type Options = {
		/**
		 * An optional diagnostic label for debugging, logging, and inspection.
		 */
		readonly name?: string;

		/**
		 * An optional error handler invoked when a listener callback throws an unhandled error during event emission.
		 * If omitted, listener exceptions propagate synchronously to the caller of `EventBus.emit`.
		 */
		readonly onError?: (error: unknown) => void;
	};

	/**
	 * Configuration options controlling event sequence matching, strictness, and lifecycle for `EventBus.listen`.
	 *
	 * @example
	 * ```ts
	 * const sub = EventBus.listen(
	 *   authBus,
	 *   ["credentialsSubmitted", "mfaPrompted", "sessionCreated"],
	 *   {
	 *     ordered: true,
	 *     strict: true,
	 *     reset: "authCancelled",
	 *     optional: ["mfaPrompted"],
	 *   },
	 * ).collect((payloads) => {
	 *   console.log("Onboarding complete", payloads);
	 * });
	 * ```
	 */
	export type SequenceOptions<S extends Record<string, unknown>, Opt extends keyof S & string = never> = {
		/**
		 * When `true`, events must be emitted in the exact order specified in the array.
		 * Intermediate out-of-order events are ignored (in relaxed mode) or reset the sequence (in strict mode).
		 *
		 * Defaults to `false` (events match independently or in any order).
		 */
		readonly ordered?: boolean;

		/**
		 * When `true` (and `ordered` is `true`), requires events in the sequence to be emitted consecutively
		 * without any intervening events. An unexpected event immediately resets sequence tracking to index 0.
		 *
		 * Defaults to `false` (events from outside the sequence are ignored while the sequence is in progress).
		 */
		readonly strict?: boolean;

		/**
		 * When `true`, automatically unsubscribes the listener immediately after the first successful
		 * match or sequence completion.
		 *
		 * Defaults to `false` (listener remains active for future emissions).
		 */
		readonly once?: boolean;

		/**
		 * One or more event kinds that, when emitted, immediately reset sequence progress back to index 0
		 * and clear any partially collected payloads.
		 */
		readonly reset?: (keyof S & string) | ReadonlyArray<keyof S & string>;

		/**
		 * One or more event kinds in the sequence that may be skipped. If the subsequent expected event
		 * arrives before an optional event, the optional step is bypassed without breaking the sequence.
		 *
		 * In `.collect()`, skipped optional events evaluate to `undefined` in the returned payloads.
		 */
		readonly optional?: Opt | ReadonlyArray<Opt>;
	};

	/**
	 * An active subscription handle returned by `EventBus.listen(...).reduce(...)`.
	 *
	 * Provides a getter for current accumulated state and an `unsubscribe` disposal function.
	 */
	export type Subscription<State> = { readonly unsubscribe: () => void; readonly getState: () => State; };

	/**
	 * Configuration options for forwarding events from one bus to another.
	 *
	 * When `only` is specified, allows forwarding between different event schemas as long as
	 * the selected event keys exist in both buses and their payload types are compatible.
	 * When `only` is omitted, the target bus schema must accept all events defined in the source bus.
	 */
	export type ForwardOptions<
		FromSchema extends Record<string, unknown>,
		ToSchema extends Record<string, unknown> = FromSchema,
		K extends keyof FromSchema & string = keyof FromSchema & string,
	> = {
		readonly from: EventBus<FromSchema>;
		readonly to: EventBus<ToSchema> | ReadonlyArray<EventBus<ToSchema>>;
		readonly only: ReadonlyArray<K>;
	} | {
		readonly from: EventBus<FromSchema>;
		readonly to: EventBus<ToSchema> | ReadonlyArray<EventBus<ToSchema>>;
		readonly only?: undefined;
	};

	/**
	 * Typed record of aggregated sequence payloads. Required sequence steps are strictly typed
	 * as non-nullable values, while steps configured in `optional` evaluate to optional properties (`T | undefined`).
	 */
	export type CollectedPayloads<
		S extends Record<string, unknown>,
		K extends keyof S & string,
		Opt extends keyof S & string = never,
	> = { readonly [Key in Exclude<K, Opt>]: S[Key]; } & { readonly [Key in Extract<K, Opt>]?: S[Key]; };

	/**
	 * Builder for registering listeners, reducers, and sequence collectors on an `EventBus`.
	 */
	export type ListenerBuilder<
		S extends Record<string, unknown>,
		K extends keyof S & string = keyof S & string,
		Opt extends keyof S & string = never,
	> = {
		/**
		 * Accumulates state over incoming matching events using a pure reducer function.
		 *
		 * @see {@link tap} for stateless side-effects without accumulating values.
		 * @see {@link collect} for aggregating sequence payloads into a typed object.
		 *
		 * @example
		 * ```ts
		 * const sub = EventBus.listen(cartBus, ["itemAdded", "itemRemoved"]).reduce(
		 *   (msg, count) => msg.kind === "itemAdded" ? count + 1 : count - 1,
		 *   0,
		 * );
		 * ```
		 */
		readonly reduce: <State>(
			reducer: (msg: Message<S, K>, state: State) => State,
			initialState: State,
		) => Subscription<State>;

		/**
		 * Registers a side-effect callback invoked when a matching event or completed sequence arrives.
		 *
		 * @see {@link reduce} for accumulating state over time.
		 * @see {@link collect} for aggregating sequence payloads into a typed object.
		 *
		 * @example
		 * ```ts
		 * const unsubscribe = EventBus.listen(authBus, "userLoggedIn").tap((msg) => {
		 *   analytics.track("login", msg.value);
		 * });
		 * ```
		 */
		readonly tap: (effect: (msg: Message<S, K>) => void) => () => void;

		/**
		 * Aggregates all payloads from the specified events or sequence into a single typed dictionary,
		 * returning an unsubscribe disposer function.
		 *
		 * In ordered mode (`{ ordered: true }`), the callback fires each time the sequence completes in order
		 * (recurring on every completed sequence unless `{ once: true }` is set).
		 * In unordered mode, the callback fires each time all required events have been emitted at least once.
		 *
		 * Optional events that were skipped during sequence matching evaluate to `undefined`.
		 *
		 * @see {@link reduce} for continuous state reduction.
		 * @see {@link tap} for firing on individual matching events.
		 *
		 * @example
		 * ```ts
		 * EventBus.listen(
		 *   checkoutBus,
		 *   ["addressEntered", "paymentSubmitted"],
		 *   { ordered: true },
		 * ).collect((payloads) => {
		 *   completeCheckout(payloads.addressEntered, payloads.paymentSubmitted);
		 * });
		 * ```
		 */
		readonly collect: (effect: (payloads: CollectedPayloads<S, K, Opt>) => void) => () => void;
	};
}

const setProperty = <O extends object, K extends PropertyKey, V>(target: O, key: K, value: V): O => {
	if (key === "__proto__") {
		Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
	} else {
		(target as Record<PropertyKey, unknown>)[key] = value;
	}
	return target;
};

const makeEventBus = <S extends Record<string, unknown>>(options?: EventBus.Options): EventBus<S> =>
	({
		[EVENT_BUS_STATE]: { options, listeners: new Set(), listenerArray: null, queue: [], isEmitting: false },
	}) as unknown as EventBus<S>;

const emitSingleBus = (
	bus: EventBus<Record<string, unknown>>,
	msg: EventBus.Message<Record<string, unknown>>,
): void => {
	const internal = toInternalEventBus(bus)[EVENT_BUS_STATE];
	internal.queue.push(msg);
	if (internal.isEmitting) {
		return;
	}
	internal.isEmitting = true;
	try {
		let queueHead = 0;
		while (queueHead < internal.queue.length) {
			const nextMsg = internal.queue[queueHead++];
			internal.listenerArray ??= Array.from(internal.listeners);
			const listeners = internal.listenerArray;
			for (let i = 0; i < listeners.length; i++) {
				try {
					listeners[i](nextMsg);
				} catch (err) {
					if (internal.options?.onError) {
						internal.options.onError(err);
					} else {
						throw err;
					}
				}
			}
		}
	} finally {
		internal.queue.length = 0;
		internal.isEmitting = false;
	}
};

const emitEventBus = <S extends Record<string, unknown>, K extends keyof S & string>(
	target: EventBus<S> | ReadonlyArray<EventBus<S>>,
	message: WithKind<K> & WithValue<S[K]>,
): void => {
	const msg = message as unknown as EventBus.Message<Record<string, unknown>>;
	if (Array.isArray(target)) {
		for (let i = 0; i < target.length; i++) {
			emitSingleBus(target[i] as unknown as EventBus<Record<string, unknown>>, msg);
		}
	} else {
		emitSingleBus(target as unknown as EventBus<Record<string, unknown>>, msg);
	}
};

function forwardEventBus<
	FromSchema extends Record<string, unknown>,
	ToSchema extends { [P in K]: FromSchema[P]; },
	const K extends keyof FromSchema & string,
>(
	options: {
		readonly from: EventBus<FromSchema>;
		readonly to: EventBus<ToSchema> | ReadonlyArray<EventBus<ToSchema>>;
		readonly only: ReadonlyArray<K>;
	},
): () => void;
function forwardEventBus<
	FromSchema extends Record<string, unknown>,
	ToSchema extends { [P in keyof FromSchema]: FromSchema[P]; },
>(
	options: {
		readonly from: EventBus<FromSchema>;
		readonly to: EventBus<ToSchema> | ReadonlyArray<EventBus<ToSchema>>;
		readonly only?: undefined;
	},
): () => void;
function forwardEventBus(
	options: {
		readonly from: EventBus<Record<string, unknown>>;
		readonly to: EventBus<Record<string, unknown>> | ReadonlyArray<EventBus<Record<string, unknown>>>;
		readonly only?: ReadonlyArray<string>;
	},
): () => void {
	const filterSet = options.only ? new Set<string>(options.only) : null;

	const handler = (msg: unknown) => {
		const typedMsg = msg as EventBus.Message<Record<string, unknown>>;
		if (filterSet !== null && !filterSet.has(typedMsg.kind)) {
			return;
		}
		emitEventBus(options.to, typedMsg as any);
	};

	const internalFrom = toInternalEventBus(options.from)[EVENT_BUS_STATE];
	internalFrom.listeners.add(handler);
	internalFrom.listenerArray = null;

	return () => {
		internalFrom.listeners.delete(handler);
		internalFrom.listenerArray = null;
	};
}

const listenEventBus = <
	S extends Record<string, unknown>,
	K extends keyof S & string,
	Opt extends keyof S & string = never,
>(
	bus: EventBus<S>,
	events: K | ReadonlyArray<K>,
	options?: EventBus.SequenceOptions<S, Opt>,
): EventBus.ListenerBuilder<S, K, Opt> => {
	const eventList: ReadonlyArray<string> = Array.isArray(events) ? events : [events];
	const isOrdered = options?.ordered ?? false;
	const isStrict = options?.strict ?? false;
	const isOnce = options?.once ?? false;
	const resetKinds = options?.reset
		? new Set<string>(Array.isArray(options.reset) ? options.reset : [options.reset])
		: null;
	const optionalKinds = options?.optional
		? new Set<string>(Array.isArray(options.optional) ? options.optional : [options.optional])
		: null;
	const internal = toInternalEventBus(bus)[EVENT_BUS_STATE];

	const createMatcher = (onMatch: (msg: EventBus.Message<S, K>) => void) => {
		let sequenceIndex = 0;

		return (rawMsg: unknown) => {
			const msg = rawMsg as EventBus.Message<S, K>;
			if (resetKinds !== null && resetKinds.has(msg.kind)) {
				sequenceIndex = 0;
				return;
			}

			if (!isOrdered) {
				if (eventList.includes(msg.kind)) {
					onMatch(msg);
				}
				return;
			}

			let expectedKind = eventList[sequenceIndex];

			if (expectedKind !== msg.kind && optionalKinds !== null) {
				let lookaheadIndex = sequenceIndex;
				while (
					lookaheadIndex < eventList.length
					&& optionalKinds.has(eventList[lookaheadIndex])
					&& eventList[lookaheadIndex] !== msg.kind
				) {
					lookaheadIndex++;
				}
				if (lookaheadIndex < eventList.length && eventList[lookaheadIndex] === msg.kind) {
					sequenceIndex = lookaheadIndex;
					expectedKind = eventList[sequenceIndex];
				}
			}

			if (msg.kind === expectedKind) {
				sequenceIndex++;
				if (sequenceIndex === eventList.length) {
					sequenceIndex = 0;
					onMatch(msg);
				}
			} else if (isStrict) {
				sequenceIndex = msg.kind === eventList[0] ? 1 : 0;
			} else if (eventList.includes(msg.kind)) {
				sequenceIndex = msg.kind === eventList[0] ? 1 : 0;
			}
		};
	};

	return {
		reduce: <State>(
			reducer: (msg: EventBus.Message<S, K>, state: State) => State,
			initialState: State,
		): EventBus.Subscription<State> => {
			let currentState = initialState;

			const listenerFn = createMatcher((msg) => {
				if (isOnce) {
					internal.listeners.delete(listenerFn);
					internal.listenerArray = null;
				}
				currentState = reducer(msg, currentState);
			});

			const unsubscribe = () => {
				internal.listeners.delete(listenerFn);
				internal.listenerArray = null;
			};

			internal.listeners.add(listenerFn);
			internal.listenerArray = null;

			return { unsubscribe, getState: () => currentState };
		},

		tap: (effect: (msg: EventBus.Message<S, K>) => void): () => void => {
			const listenerFn = createMatcher((msg) => {
				if (isOnce) {
					internal.listeners.delete(listenerFn);
					internal.listenerArray = null;
				}
				effect(msg);
			});

			const unsubscribe = () => {
				internal.listeners.delete(listenerFn);
				internal.listenerArray = null;
			};

			internal.listeners.add(listenerFn);
			internal.listenerArray = null;

			return unsubscribe;
		},

		collect: (effect: (payloads: EventBus.CollectedPayloads<S, K, Opt>) => void): () => void => {
			let sequenceIndex = 0;
			let collected: Record<string, unknown> = {};

			const listenerFn = (rawMsg: unknown) => {
				const msg = rawMsg as EventBus.Message<S, K>;

				if (resetKinds !== null && resetKinds.has(msg.kind)) {
					sequenceIndex = 0;
					collected = {};
					return;
				}

				if (!isOrdered) {
					if (eventList.includes(msg.kind)) {
						setProperty(collected, msg.kind, msg.value);
						let hasAll = true;
						for (let i = 0; i < eventList.length; i++) {
							const k = eventList[i];
							if (!(k in collected) && (optionalKinds === null || !optionalKinds.has(k))) {
								hasAll = false;
								break;
							}
						}
						if (hasAll) {
							const result = { ...collected } as unknown as EventBus.CollectedPayloads<S, K, Opt>;
							collected = {};
							if (isOnce) {
								internal.listeners.delete(listenerFn);
								internal.listenerArray = null;
							}
							effect(result);
						}
					}
					return;
				}

				let expectedKind = eventList[sequenceIndex];

				if (expectedKind !== msg.kind && optionalKinds !== null) {
					let lookaheadIndex = sequenceIndex;
					while (
						lookaheadIndex < eventList.length
						&& optionalKinds.has(eventList[lookaheadIndex])
						&& eventList[lookaheadIndex] !== msg.kind
					) {
						lookaheadIndex++;
					}
					if (lookaheadIndex < eventList.length && eventList[lookaheadIndex] === msg.kind) {
						sequenceIndex = lookaheadIndex;
						expectedKind = eventList[sequenceIndex];
					}
				}

				if (msg.kind === expectedKind) {
					setProperty(collected, msg.kind, msg.value);
					sequenceIndex++;
					if (sequenceIndex === eventList.length) {
						sequenceIndex = 0;
						const result = { ...collected } as unknown as EventBus.CollectedPayloads<S, K, Opt>;
						collected = {};
						if (isOnce) {
							internal.listeners.delete(listenerFn);
							internal.listenerArray = null;
						}
						effect(result);
					}
				} else if (isStrict) {
					if (msg.kind === eventList[0]) {
						sequenceIndex = 1;
						collected = setProperty({}, msg.kind, msg.value);
					} else {
						sequenceIndex = 0;
						collected = {};
					}
				} else if (eventList.includes(msg.kind)) {
					if (msg.kind === eventList[0]) {
						sequenceIndex = 1;
						collected = setProperty({}, msg.kind, msg.value);
					} else {
						sequenceIndex = 0;
						collected = {};
					}
				}
			};

			const unsubscribe = () => {
				internal.listeners.delete(listenerFn);
				internal.listenerArray = null;
			};

			internal.listeners.add(listenerFn);
			internal.listenerArray = null;

			return unsubscribe;
		},
	};
};

export const EventBus = {
	/**
	 * Constructs a new `EventBus` instance.
	 *
	 * @example
	 * ```ts
	 * const bus = EventBus.make<AppMessages>({ name: "app" });
	 * ```
	 */
	make: makeEventBus,

	/**
	 * Emits a message payload to one or more target event buses.
	 *
	 * Uses a synchronous breadth-first trampoline queue to handle re-entrant emissions deterministically.
	 *
	 * @see {@link EventBus.listen} for subscribing to emitted messages.
	 * @see {@link EventBus.forward} for routing messages between event buses.
	 *
	 * @example
	 * ```ts
	 * EventBus.emit(busA, {
	 *   kind: "userLoggedIn",
	 *   value: { userId: "user-1" },
	 * });
	 *
	 * EventBus.emit([busA, busB], {
	 *   kind: "userLoggedIn",
	 *   value: { userId: "user-1" },
	 * });
	 * ```
	 */
	emit: emitEventBus,

	/**
	 * Forwards messages from one event bus to another (or multiple).
	 *
	 * @see {@link EventBus.emit} for publishing messages directly.
	 * @see {@link EventBus.listen} for consuming events on a bus.
	 *
	 * @example
	 * ```ts
	 * const stop = EventBus.forward({
	 *   from: authBus,
	 *   to: analyticsBus,
	 *   only: ["userLoggedIn"],
	 * });
	 * ```
	 */
	forward: forwardEventBus,

	/**
	 * Initiates listener registration on an event bus for specific event kind(s) or sequence.
	 *
	 * @see {@link EventBus.emit} for dispatching messages to listeners.
	 * @see {@link EventBus.forward} for bridging events across buses.
	 *
	 * @example
	 * ```ts
	 * const sub = EventBus.listen(
	 *   appBus,
	 *   ["userLoggedIn", "checkoutStarted"],
	 *   { ordered: true }
	 * ).collect((payloads) => {
	 *   console.log("Checkout initiated by", payloads.userLoggedIn.userId);
	 * });
	 * ```
	 */
	listen: listenEventBus,
};
