import type { WithKind, WithValue } from "../internal/InternalTypes";
import { EventBus } from "./EventBus.ts";

// =============================================================================
// Phantom Brand Symbols
// =============================================================================
declare const _targetsBrand: unique symbol;

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a state variant within a finite state machine.
 *
 * Each variant is branded with its discriminator `kind`, an optional payload `value`,
 * and compile-time outbound transition constraints `AllowedTargets`.
 *
 * `AllowedTargets` is placed in a contravariant phantom position, allowing states
 * created via {@link Machine.state} to assign directly to constrained state unions
 * without forced type assertions.
 *
 * @example
 * ```ts
 * type AuthState =
 *   | Machine.State<"loggedOut", void, "authenticating">
 *   | Machine.State<"authenticating", { readonly email: string }, "authenticated" | "failed">
 *   | Machine.State<"authenticated", { readonly token: string }, "loggedOut">
 *   | Machine.State<"failed", { readonly error: string }, "authenticating" | "loggedOut">;
 * ```
 */
type MachineState<Kind extends string, Data = void, AllowedTargets extends string = string> = [Data] extends [void]
	? WithKind<Kind> & { readonly [_targetsBrand]?: (target: AllowedTargets) => void; }
	: WithKind<Kind> & WithValue<Data> & { readonly [_targetsBrand]?: (target: AllowedTargets) => void; };

type AnyMachineState = MachineState<string, any, never>;

type TargetsOf<S> = S extends { readonly [_targetsBrand]?: (target: infer T) => void; } ? T : string;

/**
 * A discriminated union of event messages accepted by a state machine.
 *
 * Conforms to `{ kind: Key, value: Events[Key] }` (where `void` or `undefined`
 * event payloads allow `value` to be omitted), ensuring direct compatibility
 * with {@link EventBus.Message}.
 */
type MachineEventMessage<Events extends Record<string, unknown>> = {
	[K in keyof Events & string]: [Events[K]] extends [void | undefined] ? WithKind<K> & { readonly value?: void; }
		: WithKind<K> & WithValue<Events[K]>;
}[keyof Events & string];

/**
 * Transition handler function for a specific event within a state.
 *
 * The return type is constrained to either an allowed target state (as specified by
 * the state's `AllowedTargets` generic parameter) or the current state `S` (self-transition).
 */
type MachineTransitionHandler<S extends AnyMachineState, Payload, States extends AnyMachineState> = (
	state: S,
	payload: Payload,
) => Extract<States, { readonly kind: NonNullable<TargetsOf<S>>; }> | S;

/**
 * Context provided to state entry lifecycle effects.
 */
type MachineEntryContext<Events extends Record<string, unknown>> = {
	/**
	 * Dispatches an event to the state machine actor.
	 * Calls originating from stale or aborted state generations are automatically ignored.
	 */
	readonly send: (event: MachineEventMessage<Events>) => void;

	/**
	 * Scoped `AbortSignal` for the active state generation.
	 * Triggered when transitioning out of this state or when the actor is aborted.
	 */
	readonly signal: AbortSignal;
};

/**
 * Configuration for a single state variant.
 */
type MachineStateConfig<
	S extends AnyMachineState,
	States extends AnyMachineState,
	Events extends Record<string, unknown>,
> = {
	/**
	 * Event transition handlers.
	 */
	readonly on?: { readonly [E in keyof Events & string]?: MachineTransitionHandler<S, Events[E], States>; };

	/**
	 * Lifecycle effect invoked when entering this state.
	 * May return a cleanup disposer function that executes when transitioning out of the state.
	 */
	readonly entry?: (state: S, context: MachineEntryContext<Events>) => void | (() => void);

	/**
	 * Lifecycle effect invoked when exiting this state.
	 */
	readonly exit?: (state: S) => void;
};

/**
 * Complete transition table mapping every state variant in `States` to its configuration.
 */
type MachineTransitionTable<States extends AnyMachineState, Events extends Record<string, unknown>> = {
	readonly [K in States["kind"]]: MachineStateConfig<Extract<States, { readonly kind: K; }>, States, Events>;
};

/**
 * Stateful execution actor returned by {@link Machine.interpret}.
 */
type MachineActor<States extends AnyMachineState, Events extends Record<string, unknown>> = {
	/**
	 * Diagnostic identifier for this running actor instance.
	 */
	readonly id?: string;
	readonly [Symbol.toStringTag]?: string;

	/**
	 * Returns the current active state of the machine.
	 */
	readonly getState: () => States;

	/**
	 * Sends an event to the actor, triggering a state transition if configured.
	 * Re-entrant dispatches are safely queued and evaluated in FIFO order.
	 */
	readonly send: (event: MachineEventMessage<Events>) => States;

	/**
	 * Subscribes a listener to state changes.
	 * Returns an unsubscribe disposer function.
	 */
	readonly subscribe: (listener: (state: States) => void) => () => void;

	/**
	 * Halts the actor, aborts active state controllers, and runs exit cleanups.
	 */
	readonly abort: () => void;

	/**
	 * Returns whether the actor is currently running.
	 */
	readonly isRunning: () => boolean;
};

/**
 * Options for configuring {@link Machine.interpret}.
 */
type MachineInterpretOptions<States extends AnyMachineState, Events extends Record<string, unknown>> = {
	/**
	 * An optional diagnostic identifier for this running actor instance.
	 */
	readonly id?: string;

	/**
	 * An optional {@link EventBus} to synchronize with.
	 * All messages emitted on the bus will be forwarded to the actor.
	 */
	readonly bus?: EventBus<Events>;

	/**
	 * Error handler for exceptions thrown inside entry, exit, transition, or subscriber callbacks.
	 */
	readonly onError?: (
		error: unknown,
		context?: {
			readonly actorId?: string;
			readonly state: States;
			readonly phase: "entry" | "exit" | "listener" | "transition";
		},
	) => void;
};

/**
 * A typed statechart and finite state machine specification.
 */
export type Machine<States extends AnyMachineState, Events extends Record<string, unknown>> = {
	readonly id?: string;
	readonly [Symbol.toStringTag]?: string;
	readonly initial: States;
	readonly states: Machine.TransitionTable<States, Events>;
};

// =============================================================================
// Helper Functions
// =============================================================================

function makeState<Kind extends string>(kind: Kind): MachineState<Kind, void, string>;
function makeState<Kind extends string, Data>(kind: Kind, value: Data): MachineState<Kind, Data, string>;
function makeState<Kind extends string, Data = void>(kind: Kind, value?: Data): MachineState<Kind, Data, string> {
	return (arguments.length > 1 ? { kind, value } : { kind }) as unknown as MachineState<Kind, Data, string>;
}

// =============================================================================
// Module Namespace and Const Literal
// =============================================================================

export namespace Machine {
	export type State<Kind extends string, Data = void, AllowedTargets extends string = string> = MachineState<
		Kind,
		Data,
		AllowedTargets
	>;

	export type EventMessage<Events extends Record<string, unknown>> = MachineEventMessage<Events>;

	export type TransitionHandler<S extends AnyMachineState, Payload, States extends AnyMachineState> =
		MachineTransitionHandler<S, Payload, States>;

	export type EntryContext<Events extends Record<string, unknown>> = MachineEntryContext<Events>;

	export type StateConfig<
		S extends AnyMachineState,
		States extends AnyMachineState,
		Events extends Record<string, unknown>,
	> = MachineStateConfig<S, States, Events>;

	export type TransitionTable<States extends AnyMachineState, Events extends Record<string, unknown>> =
		MachineTransitionTable<States, Events>;

	export type Actor<States extends AnyMachineState, Events extends Record<string, unknown>> = MachineActor<
		States,
		Events
	>;

	export type InterpretOptions<
		Events extends Record<string, unknown>,
		States extends AnyMachineState = AnyMachineState,
	> = MachineInterpretOptions<States, Events>;
}

export const Machine = {
	/**
	 * Creates a validated, immutable state machine definition.
	 *
	 * @example
	 * ```ts
	 * type AuthState =
	 *   | Machine.State<"loggedOut", void, "authenticating">
	 *   | Machine.State<"authenticating", { readonly email: string }, "authenticated" | "failed">
	 *   | Machine.State<"authenticated", { readonly token: string }, "loggedOut">
	 *   | Machine.State<"failed", { readonly error: string }, "authenticating" | "loggedOut">;
	 *
	 * type AuthEvents = {
	 *   SUBMIT: { readonly email: string };
	 *   RESOLVE: { readonly token: string };
	 *   REJECT: { readonly error: string };
	 *   LOGOUT: void;
	 * };
	 *
	 * const authMachine = Machine.make<AuthState, AuthEvents>({
	 *   id: "auth",
	 *   initial: Machine.state("loggedOut"),
	 *   states: {
	 *     loggedOut: {
	 *       on: {
	 *         SUBMIT: (_state, { email }) => Machine.state("authenticating", { email }),
	 *       },
	 *     },
	 *     authenticating: {
	 *       on: {
	 *         RESOLVE: (_state, { token }) => Machine.state("authenticated", { token }),
	 *         REJECT: (_state, { error }) => Machine.state("failed", { error }),
	 *       },
	 *     },
	 *     authenticated: {
	 *       on: {
	 *         LOGOUT: () => Machine.state("loggedOut"),
	 *       },
	 *     },
	 *     failed: {
	 *       on: {
	 *         SUBMIT: (_state, { email }) => Machine.state("authenticating", { email }),
	 *         LOGOUT: () => Machine.state("loggedOut"),
	 *       },
	 *     },
	 *   },
	 * });
	 * ```
	 */
	make: <States extends AnyMachineState, Events extends Record<string, unknown>>(
		config: { readonly id?: string; readonly initial: States; readonly states: MachineTransitionTable<States, Events>; },
	): Machine<States, Events> => ({
		...(config.id !== undefined ? { id: config.id } : {}),
		[Symbol.toStringTag]: config.id !== undefined ? `Machine(${config.id})` : "Machine",
		initial: config.initial,
		states: { ...config.states },
	}),

	/**
	 * Constructs a state variant without requiring manual type assertions.
	 *
	 * @example
	 * ```ts
	 * const idle = Machine.state("idle");
	 * const active = Machine.state("active", { count: 1 });
	 * ```
	 */
	state: makeState,

	/**
	 * Curried type guard that refines a state to a specific variant kind.
	 *
	 * @example
	 * ```ts
	 * if (Machine.is("authenticating")(state)) {
	 *   console.log(state.value.email);
	 * }
	 * ```
	 */
	is: <K extends string>(kind: K) => <S extends AnyMachineState>(state: S): state is Extract<S, { readonly kind: K; }> =>
		state.kind === kind,

	/**
	 * Curried exhaustive pattern matcher across all state variants of a machine.
	 *
	 * @example
	 * ```ts
	 * const title = pipe(
	 *   actor.getState(),
	 *   Machine.match<AuthState, string>({
	 *     loggedOut: () => "Please Sign In",
	 *     authenticating: ({ value }) => `Verifying ${value.email}...`,
	 *     authenticated: ({ value }) => `Logged in with token ${value.token}`,
	 *     failed: ({ value }) => `Error: ${value.error}`,
	 *   }),
	 * );
	 * ```
	 */
	match:
		<States extends AnyMachineState, R>(
			cases: { readonly [K in States["kind"]]: (state: Extract<States, { readonly kind: K; }>) => R; },
		) =>
		(state: States): R => {
			const handler = cases[state.kind as States["kind"]];
			return handler(state as any);
		},

	/**
	 * Pure, data-last transition function. Evaluates a transition on the provided state
	 * and returns the next state without executing lifecycle side effects.
	 *
	 * If the state does not handle the event, the current state is returned unchanged.
	 *
	 * @see {@link Machine.interpret} to run a stateful actor with async lifecycle effects.
	 *
	 * @example
	 * ```ts
	 * const nextState = pipe(
	 *   currentState,
	 *   Machine.transition(authMachine, { kind: "SUBMIT", value: { email: "dev@example.com" } }),
	 * );
	 * ```
	 */
	transition:
		<States extends AnyMachineState, Events extends Record<string, unknown>>(
			machine: Machine<States, Events>,
			event: MachineEventMessage<Events>,
		) =>
		(state: States): States => {
			const config = machine.states[state.kind as States["kind"]];
			if (!config || !config.on) {
				return state;
			}
			const handler = config.on[event.kind as keyof Events & string];
			if (!handler) {
				return state;
			}
			return handler(state as any, (event as { readonly value?: unknown; }).value as any) as States;
		},

	/**
	 * Converters to standard external runtime structures.
	 */
	to: {
		/**
		 * Converts a state machine into an uncurried reducer function `(state, event) => nextState`
		 * directly compatible with React `useReducer` and Redux.
		 *
		 * If `state` is `undefined` (such as during Redux store initialization),
		 * defaults to `machine.initial`.
		 *
		 * @see {@link Machine.transition} for pure, curried data-last pipeline transitions.
		 *
		 * @example
		 * ```ts
		 * // In React:
		 * const [state, dispatch] = useReducer(
		 *   Machine.to.reducer(checkoutMachine),
		 *   checkoutMachine.initial,
		 * );
		 *
		 * // In Redux:
		 * const store = createStore(Machine.to.reducer(checkoutMachine));
		 * ```
		 */
		reducer:
			<States extends AnyMachineState, Events extends Record<string, unknown>>(machine: Machine<States, Events>) =>
			(state: States | undefined, event: MachineEventMessage<Events>): States => {
				const current = state === undefined ? machine.initial : state;
				return Machine.transition(machine, event)(current);
			},
	},

	/**
	 * Spawns an execution actor for a machine.
	 *
	 * Manages active state lifecycles:
	 * - Runs `entry` effects on state entry, providing an `AbortSignal` and guarded `send`.
	 * - Automatically aborts active controllers and executes cleanup disposers when exiting a state.
	 * - Suppresses stale async dispatches from previously active states.
	 * - Queues re-entrant `send` calls to preserve sequential transition semantics.
	 * - Optionally synchronizes with an {@link EventBus}.
	 *
	 * @see {@link Machine.transition} for pure stateless transitions.
	 *
	 * @example
	 * ```ts
	 * const actor = Machine.interpret(authMachine);
	 *
	 * const unsubscribe = actor.subscribe((state) => {
	 *   console.log("Current state:", state.kind);
	 * });
	 *
	 * actor.send({ kind: "SUBMIT", value: { email: "dev@example.com" } });
	 * ```
	 */
	interpret: <States extends AnyMachineState, Events extends Record<string, unknown>>(
		machine: Machine<States, Events>,
		options?: MachineInterpretOptions<States, Events>,
	): MachineActor<States, Events> => {
		const actorId = options?.id;
		let currentState: States = machine.initial;
		let isRunning = true;
		let generation = 0;
		let currentAbortController: AbortController | null = null;
		let currentCleanup: (() => void) | null = null;
		let isProcessing = false;
		let busDisposer: (() => void) | null = null;

		const listeners = new Set<(state: States) => void>();
		const queue: MachineEventMessage<Events>[] = [];

		const reportError = (error: unknown, phase: "entry" | "exit" | "listener" | "transition", state: States): void => {
			if (options?.onError) {
				try {
					options.onError(error, { ...(actorId !== undefined ? { actorId } : {}), state, phase });
				} catch {
					// Guard against re-entrant throw in user error handler
				}
			}
		};

		const exitState = (state: States): void => {
			if (currentAbortController) {
				currentAbortController.abort();
				currentAbortController = null;
			}
			if (currentCleanup) {
				try {
					currentCleanup();
				} catch (error) {
					reportError(error, "exit", state);
				}
				currentCleanup = null;
			}
			const config = machine.states[state.kind as States["kind"]];
			if (config?.exit) {
				try {
					config.exit(state as any);
				} catch (error) {
					reportError(error, "exit", state);
				}
			}
		};

		const enterState = (
			state: States,
			currentGen: number,
			dispatch: (event: MachineEventMessage<Events>) => void,
		): void => {
			const controller = new AbortController();
			currentAbortController = controller;

			const config = machine.states[state.kind as States["kind"]];
			if (!config?.entry) {
				return;
			}

			const guardedSend = (event: MachineEventMessage<Events>): void => {
				if (!isRunning || currentGen !== generation || controller.signal.aborted) {
					return;
				}
				dispatch(event);
			};

			try {
				const cleanup = config.entry(state as any, { send: guardedSend, signal: controller.signal });
				if (typeof cleanup === "function") {
					if (!isRunning || currentGen !== generation || controller.signal.aborted) {
						// Already transitioned while entry ran synchronously
						try {
							cleanup();
						} catch (error) {
							reportError(error, "exit", state);
						}
					} else {
						currentCleanup = cleanup;
					}
				}
			} catch (error) {
				reportError(error, "entry", state);
			}
		};

		const send = (event: MachineEventMessage<Events>): States => {
			if (!isRunning) {
				return currentState;
			}

			queue.push(event);
			if (isProcessing) {
				return currentState;
			}

			isProcessing = true;
			try {
				while (queue.length > 0) {
					const nextEvent = queue.shift()!;
					const prevState = currentState;
					let nextState: States | null = null;
					try {
						nextState = Machine.transition(machine, nextEvent)(prevState);
					} catch (error) {
						reportError(error, "transition", prevState);
					}

					if (nextState !== null && nextState !== prevState) {
						exitState(prevState);
						currentState = nextState;
						generation++;
						const currentGen = generation;

						for (const listener of listeners) {
							try {
								listener(nextState);
							} catch (error) {
								reportError(error, "listener", nextState);
							}
						}

						enterState(nextState, currentGen, send);
					}
				}
			} finally {
				isProcessing = false;
			}

			return currentState;
		};

		// If an EventBus is provided, subscribe to incoming events
		if (options?.bus) {
			busDisposer = EventBus.subscribe(options.bus).tap((msg) => {
				send(msg as unknown as MachineEventMessage<Events>);
			});
		}

		// Run initial state entry effect
		enterState(currentState, generation, send);

		return {
			...(actorId !== undefined ? { id: actorId } : {}),
			[Symbol.toStringTag]: actorId !== undefined
				? machine.id !== undefined ? `Machine.Actor(${actorId})[${machine.id}]` : `Machine.Actor(${actorId})`
				: machine.id !== undefined
				? `Machine.Actor[${machine.id}]`
				: "Machine.Actor",
			getState: () => currentState,
			send,
			subscribe: (listener: (state: States) => void) => {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			},
			abort: () => {
				if (!isRunning) {
					return;
				}
				isRunning = false;
				queue.length = 0;
				exitState(currentState);
				if (busDisposer) {
					busDisposer();
					busDisposer = null;
				}
			},
			isRunning: () => isRunning,
		};
	},
};
