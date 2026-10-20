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
export type EventBus<S extends Record<string, unknown>> = { readonly [_eventBusBrand]: (schema: S) => void; };

const makeEventBus = <S extends Record<string, unknown>>(options?: EventBus.Options): EventBus<S> =>
	({
		[EVENT_BUS_STATE]: { options, listeners: new Set(), listenerArray: null, queue: [], isEmitting: false },
	}) as unknown as EventBus<S>;

const emitEventBus = <S extends Record<string, unknown>, K extends keyof S & string>(
	target: EventBus<S> | ReadonlyArray<EventBus<S>>,
	message: WithKind<K> & WithValue<S[K]>,
): void => {
	const targets = Array.isArray(target) ? target : [target];
	const msg = message as EventBus.Message<S>;

	for (const bus of targets) {
		const internal = toInternalEventBus(bus)[EVENT_BUS_STATE];
		internal.queue.push(msg);
		if (!internal.isEmitting) {
			internal.isEmitting = true;
			try {
				while (internal.queue.length > 0) {
					const nextMsg = internal.queue.shift()!;
					internal.listenerArray ??= Array.from(internal.listeners);
					const listeners = internal.listenerArray;
					for (const listener of listeners) {
						try {
							listener(nextMsg);
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
				internal.isEmitting = false;
			}
		}
	}
};

const forwardEventBus = <S extends Record<string, unknown>>(options: EventBus.ForwardOptions<S>): () => void => {
	const targets = Array.isArray(options.to) ? options.to : [options.to];
	const filterSet = options.only ? new Set<string>(options.only) : null;

	const handler = (msg: EventBus.Message<S>) => {
		if (filterSet !== null && !filterSet.has(msg.kind)) {
			return;
		}
		for (const target of targets) {
			emitEventBus(target, msg);
		}
	};

	const internalFrom = toInternalEventBus(options.from)[EVENT_BUS_STATE];
	internalFrom.listeners.add(handler);
	internalFrom.listenerArray = null;

	return () => {
		internalFrom.listeners.delete(handler);
		internalFrom.listenerArray = null;
	};
};

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

		return (rawMsg: EventBus.Message<S>) => {
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
				currentState = reducer(msg, currentState);
				if (isOnce) {
					internal.listeners.delete(listenerFn);
					internal.listenerArray = null;
				}
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
				effect(msg);
				if (isOnce) {
					internal.listeners.delete(listenerFn);
					internal.listenerArray = null;
				}
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

			const listenerFn = (rawMsg: EventBus.Message<S>) => {
				const msg = rawMsg as EventBus.Message<S, K>;

				if (resetKinds !== null && resetKinds.has(msg.kind)) {
					sequenceIndex = 0;
					collected = {};
					return;
				}

				if (!isOrdered) {
					if (eventList.includes(msg.kind)) {
						collected[msg.kind] = msg.value;
						const hasAll = eventList.every((k) => k in collected || (optionalKinds !== null && optionalKinds.has(k)));
						if (hasAll) {
							const result = { ...collected } as unknown as EventBus.CollectedPayloads<S, K, Opt>;
							collected = {};
							effect(result);
							if (isOnce) {
								internal.listeners.delete(listenerFn);
								internal.listenerArray = null;
							}
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
					collected[msg.kind] = msg.value;
					sequenceIndex++;
					if (sequenceIndex === eventList.length) {
						sequenceIndex = 0;
						const result = { ...collected } as unknown as EventBus.CollectedPayloads<S, K, Opt>;
						collected = {};
						effect(result);
						if (isOnce) {
							internal.listeners.delete(listenerFn);
							internal.listenerArray = null;
						}
					}
				} else if (isStrict) {
					if (msg.kind === eventList[0]) {
						sequenceIndex = 1;
						collected = { [msg.kind]: msg.value };
					} else {
						sequenceIndex = 0;
						collected = {};
					}
				} else if (eventList.includes(msg.kind)) {
					if (msg.kind === eventList[0]) {
						sequenceIndex = 1;
						collected = { [msg.kind]: msg.value };
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

export namespace EventBus {
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

	export type Subscription<State> = { readonly unsubscribe: () => void; readonly getState: () => State; };

	/**
	 * Configuration options for forwarding events from one bus to another.
	 */
	export type ForwardOptions<S extends Record<string, unknown>> = {
		readonly from: EventBus<S>;
		readonly to: EventBus<S> | ReadonlyArray<EventBus<S>>;
		readonly only?: ReadonlyArray<keyof S & string>;
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
