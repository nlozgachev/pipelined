import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { EventBus } from "../EventBus.ts";
import { Machine } from "../Machine.ts";

// =============================================================================
// Test Domain Types
// =============================================================================

type AuthState =
	| Machine.State<"loggedOut", void, "authenticating">
	| Machine.State<"authenticating", { readonly email: string; }, "authenticated" | "failed">
	| Machine.State<"authenticated", { readonly token: string; }, "loggedOut">
	| Machine.State<"failed", { readonly error: string; }, "authenticating" | "loggedOut">;

type AuthEvents = {
	SUBMIT: { readonly email: string; };
	RESOLVE: { readonly token: string; };
	REJECT: { readonly error: string; };
	LOGOUT: void;
};

const createAuthMachine = () =>
	Machine.make<AuthState, AuthEvents>({
		initial: Machine.state("loggedOut"),
		states: {
			loggedOut: { on: { SUBMIT: (_state, { email }) => Machine.state("authenticating", { email }) } },
			authenticating: {
				on: {
					RESOLVE: (_state, { token }) => Machine.state("authenticated", { token }),
					REJECT: (_state, { error }) => Machine.state("failed", { error }),
				},
			},
			authenticated: { on: { LOGOUT: () => Machine.state("loggedOut") } },
			failed: {
				on: {
					SUBMIT: (_state, { email }) => Machine.state("authenticating", { email }),
					LOGOUT: () => Machine.state("loggedOut"),
				},
			},
		},
	});

// =============================================================================
// 1. Machine.state & Machine.make
// =============================================================================

test("state: constructs void states without a value property", () => {
	const state = Machine.state("loggedOut");
	expect(state.kind).toBe("loggedOut");
	expect("value" in state).toBe(false);
});

test("state: constructs payload states with a value property", () => {
	const state = Machine.state("authenticating", { email: "dev@example.com" });
	expect(state.kind).toBe("authenticating");
	expect(state.value).toStrictEqual({ email: "dev@example.com" });
});

test("make: constructs an immutable machine definition", () => {
	const machine = createAuthMachine();
	expect(machine.initial).toStrictEqual({ kind: "loggedOut" });
	expect(machine.states.loggedOut.on?.SUBMIT).toBeTypeOf("function");
});

// =============================================================================
// 2. Machine.is & Machine.match
// =============================================================================

test("is: refines state variant kinds accurately", () => {
	const loggedOut = Machine.state("loggedOut");
	const authenticating = Machine.state("authenticating", { email: "dev@example.com" });

	const isLoggedOut = Machine.is("loggedOut");
	const isAuthenticating = Machine.is("authenticating");

	expect(isLoggedOut(loggedOut)).toBe(true);
	expect(isLoggedOut(authenticating)).toBe(false);
	expect(isAuthenticating(authenticating)).toBe(true);
	expect(isAuthenticating(loggedOut)).toBe(false);
});

test("match: executes the matching handler branch and returns value", () => {
	const machine = createAuthMachine();
	const state = Machine.transition(machine, { kind: "SUBMIT", value: { email: "dev@example.com" } })(machine.initial);

	let otherBranchCalled = false;
	const result = pipe(
		state,
		Machine.match({
			loggedOut: () => {
				otherBranchCalled = true;
				return "out";
			},
			authenticating: (s) => `verifying:${s.value.email}`,
			authenticated: (s) => {
				otherBranchCalled = true;
				return `token:${s.value.token}`;
			},
			failed: (s) => {
				otherBranchCalled = true;
				return `error:${s.value.error}`;
			},
		}),
	);

	expect(result).toBe("verifying:dev@example.com");
	expect(otherBranchCalled).toBe(false);
});

// =============================================================================
// 3. Machine.transition (Pure Reducer)
// =============================================================================

test("transition: performs defined transitions cleanly", () => {
	const machine = createAuthMachine();
	const initial = Machine.state("loggedOut");

	const next = pipe(initial, Machine.transition(machine, { kind: "SUBMIT", value: { email: "test@example.com" } }));

	expect(next).toStrictEqual({ kind: "authenticating", value: { email: "test@example.com" } });
});

test("transition: returns state unchanged when event is unhandled", () => {
	const machine = createAuthMachine();
	const initial = Machine.state("loggedOut");

	const next = pipe(initial, Machine.transition(machine, { kind: "LOGOUT" }));

	expect(next).toBe(initial);
});

test("transition: returns state unchanged when state is unconfigured in machine", () => {
	const machine = Machine.make<AuthState, AuthEvents>({
		initial: Machine.state("loggedOut"),
		states: { loggedOut: {}, authenticating: {}, authenticated: {}, failed: {} },
	});

	// Runtime boundary check for dynamic or untyped callers
	const untypedTransition: (state: unknown) => unknown = Machine.transition(machine, { kind: "LOGOUT" }) as any;
	const foreignState = { kind: "unconfigured" };
	const next = untypedTransition(foreignState);
	expect(next).toBe(foreignState);
});

// =============================================================================
// 4. Machine.interpret (Actor Lifecycles & Statefulness)
// =============================================================================

test("interpret: initializes with machine initial state and isRunning true", () => {
	const machine = createAuthMachine();
	const actor = Machine.interpret(machine);

	expect(actor.getState()).toStrictEqual({ kind: "loggedOut" });
	expect(actor.isRunning()).toBe(true);
});

test("interpret: sends events, updates state, and notifies subscribers", () => {
	const machine = createAuthMachine();
	const actor = Machine.interpret(machine);

	const transitions: string[] = [];
	const unsubscribe = actor.subscribe((state) => {
		transitions.push(state.kind);
	});

	actor.send({ kind: "SUBMIT", value: { email: "dev@example.com" } });
	actor.send({ kind: "RESOLVE", value: { token: "token-123" } });

	expect(transitions).toStrictEqual(["authenticating", "authenticated"]);
	expect(actor.getState()).toStrictEqual({ kind: "authenticated", value: { token: "token-123" } });

	unsubscribe();
	actor.send({ kind: "LOGOUT" });

	// Listener should not receive LOGOUT because it was unsubscribed
	expect(transitions).toStrictEqual(["authenticating", "authenticated"]);
	expect(actor.getState()).toStrictEqual({ kind: "loggedOut" });
});

test("interpret: executes entry and exit hooks with scoped AbortSignal", () => {
	let entryCount = 0;
	let exitCount = 0;
	let signalAbortedOnExit = false;
	let cleanupCalled = false;

	type TestState = Machine.State<"idle", void, "active"> | Machine.State<"active", void, "idle">;
	type TestEvents = { ACTIVATE: void; DEACTIVATE: void; };

	const machine = Machine.make<TestState, TestEvents>({
		initial: Machine.state("idle"),
		states: {
			idle: { on: { ACTIVATE: () => Machine.state("active") } },
			active: {
				entry: (_state, { signal }) => {
					entryCount++;
					signal.addEventListener("abort", () => {
						signalAbortedOnExit = signal.aborted;
					});
					return () => {
						cleanupCalled = true;
					};
				},
				exit: () => {
					exitCount++;
				},
				on: { DEACTIVATE: () => Machine.state("idle") },
			},
		},
	});

	const actor = Machine.interpret(machine);
	expect(entryCount).toBe(0);

	actor.send({ kind: "ACTIVATE" });
	expect(entryCount).toBe(1);
	expect(exitCount).toBe(0);
	expect(cleanupCalled).toBe(false);

	actor.send({ kind: "DEACTIVATE" });
	expect(exitCount).toBe(1);
	expect(signalAbortedOnExit).toBe(true);
	expect(cleanupCalled).toBe(true);
});

test("interpret: suppresses stale send calls from previous state entry", () => {
	let staleSendAttempted = false;

	type TestState =
		| Machine.State<"idle", void, "loading">
		| Machine.State<"loading", void, "ready" | "cancelled">
		| Machine.State<"ready", void, "idle">
		| Machine.State<"cancelled", void, "idle">;

	type TestEvents = { START: void; CANCEL: void; FINISH: void; };

	let delayedSend: (() => void) | null = null;

	const machine = Machine.make<TestState, TestEvents>({
		initial: Machine.state("idle"),
		states: {
			idle: { on: { START: () => Machine.state("loading") } },
			loading: {
				entry: (_state, { send }) => {
					delayedSend = () => {
						staleSendAttempted = true;
						send({ kind: "FINISH" });
					};
				},
				on: { FINISH: () => Machine.state("ready"), CANCEL: () => Machine.state("cancelled") },
			},
			ready: {},
			cancelled: {},
		},
	});

	const actor = Machine.interpret(machine);
	actor.send({ kind: "START" });
	expect(actor.getState().kind).toBe("loading");

	// Cancel before delayed send resolves
	actor.send({ kind: "CANCEL" });
	expect(actor.getState().kind).toBe("cancelled");

	// Delayed send fires after leaving loading state
	delayedSend!();
	expect(staleSendAttempted).toBe(true);
	// State must remain "cancelled", NOT transition to "ready"
	expect(actor.getState().kind).toBe("cancelled");
});

test("interpret: queues and evaluates re-entrant send calls sequentially", () => {
	const log: string[] = [];

	type TestState =
		| Machine.State<"step0", void, "step1">
		| Machine.State<"step1", void, "step2">
		| Machine.State<"step2", void, "step3">
		| Machine.State<"step3", void, never>;

	type TestEvents = { NEXT: void; };

	const machine = Machine.make<TestState, TestEvents>({
		initial: Machine.state("step0"),
		states: {
			step0: { on: { NEXT: () => Machine.state("step1") } },
			step1: {
				entry: (_state, { send }) => {
					log.push("enter:step1");
					// Re-entrant dispatch inside entry
					send({ kind: "NEXT" });
				},
				on: { NEXT: () => Machine.state("step2") },
			},
			step2: {
				entry: (_state, { send }) => {
					log.push("enter:step2");
					send({ kind: "NEXT" });
				},
				on: { NEXT: () => Machine.state("step3") },
			},
			step3: {
				entry: () => {
					log.push("enter:step3");
				},
			},
		},
	});

	const actor = Machine.interpret(machine);
	actor.send({ kind: "NEXT" });

	expect(log).toStrictEqual(["enter:step1", "enter:step2", "enter:step3"]);
	expect(actor.getState().kind).toBe("step3");
});

test("interpret: abort stops the actor and ignores subsequent dispatches", () => {
	let cleanupRan = false;

	type TestState = Machine.State<"running", void, "stopped"> | Machine.State<"stopped", void, never>;
	type TestEvents = { STOP: void; };

	const machine = Machine.make<TestState, TestEvents>({
		initial: Machine.state("running"),
		states: {
			running: {
				entry: () => () => {
					cleanupRan = true;
				},
				on: { STOP: () => Machine.state("stopped") },
			},
			stopped: {},
		},
	});

	const actor = Machine.interpret(machine);
	expect(actor.isRunning()).toBe(true);

	actor.abort();
	actor.abort();
	expect(actor.isRunning()).toBe(false);
	expect(cleanupRan).toBe(true);

	// Subsequent sends are no-ops
	actor.send({ kind: "STOP" });
	expect(actor.getState().kind).toBe("running");
});

// =============================================================================
// 5. Synergy with EventBus
// =============================================================================

test("interpret: synchronizes seamlessly with an external EventBus", () => {
	const bus = EventBus.make<AuthEvents>();
	const machine = createAuthMachine();

	const actor = Machine.interpret(machine, { bus });
	expect(actor.getState().kind).toBe("loggedOut");

	// Emitting on the bus drives transitions in the actor
	EventBus.emit(bus, { kind: "SUBMIT", value: { email: "bus@example.com" } });
	expect(actor.getState()).toStrictEqual({ kind: "authenticating", value: { email: "bus@example.com" } });

	EventBus.emit(bus, { kind: "RESOLVE", value: { token: "secret" } });
	expect(actor.getState()).toStrictEqual({ kind: "authenticated", value: { token: "secret" } });

	actor.abort();
	// After abort, bus emission should not drive transitions
	EventBus.emit(bus, { kind: "LOGOUT", value: undefined });
	expect(actor.getState().kind).toBe("authenticated");
});

// =============================================================================
// 6. Error Routing via onError
// =============================================================================

test("interpret: routes exceptions in entry, exit, and listeners to onError", () => {
	const errors: Error[] = [];

	type TestState = Machine.State<"start", void, "middle"> | Machine.State<"middle", void, "end">;
	type TestEvents = { NEXT: void; };

	const machine = Machine.make<TestState, TestEvents>({
		initial: Machine.state("start"),
		states: {
			start: {
				exit: () => {
					throw new Error("exit error");
				},
				on: { NEXT: () => Machine.state("middle") },
			},
			middle: {
				entry: () => {
					throw new Error("entry error");
				},
			},
		},
	});

	const actor = Machine.interpret(machine, {
		onError: (err) => {
			if (err instanceof Error) {
				errors.push(err);
			}
		},
	});

	actor.subscribe(() => {
		throw new Error("listener error");
	});

	actor.send({ kind: "NEXT" });

	expect(errors).toHaveLength(3);
	expect(errors[0].message).toBe("exit error");
	expect(errors[1].message).toBe("listener error");
	expect(errors[2].message).toBe("entry error");
});

test("interpret: runs immediate cleanup if entry transitions synchronously and catches throwing cleanup", () => {
	const errors: Error[] = [];
	let immediateCleanupRan = false;

	type TestState = Machine.State<"init", void, "ready"> | Machine.State<"ready", void, never>;
	type TestEvents = { GO: void; };

	const machine = Machine.make<TestState, TestEvents>({
		initial: Machine.state("init"),
		states: {
			init: {
				entry: (_state, { send }) => {
					// Synchronously transition before returning cleanup
					send({ kind: "GO" });
					return () => {
						immediateCleanupRan = true;
						throw new Error("sync cleanup error");
					};
				},
				on: { GO: () => Machine.state("ready") },
			},
			ready: {},
		},
	});

	const actor = Machine.interpret(machine, {
		onError: (err) => {
			if (err instanceof Error) {
				errors.push(err);
			}
		},
	});

	expect(actor.getState().kind).toBe("ready");
	expect(immediateCleanupRan).toBe(true);
	expect(errors).toHaveLength(1);
	expect(errors[0].message).toBe("sync cleanup error");
});

test("interpret: handles transition handler exceptions during send and routes to onError", () => {
	const errors: Error[] = [];

	type TestState = Machine.State<"start", void, "next"> | Machine.State<"next", void, never>;
	type TestEvents = { BLOW_UP: void; };

	const machine = Machine.make<TestState, TestEvents>({
		initial: Machine.state("start"),
		states: {
			start: {
				on: {
					BLOW_UP: () => {
						throw new Error("handler explosion");
					},
				},
			},
			next: {},
		},
	});

	const actor = Machine.interpret(machine, {
		onError: (err) => {
			if (err instanceof Error) {
				errors.push(err);
			}
		},
	});

	actor.send({ kind: "BLOW_UP" });

	expect(actor.getState().kind).toBe("start");
	expect(errors).toHaveLength(1);
	expect(errors[0].message).toBe("handler explosion");
});

test("interpret: stops queue processing immediately if actor is aborted during transition", () => {
	type TestState =
		| Machine.State<"step1", void, "step2">
		| Machine.State<"step2", void, "step3">
		| Machine.State<"step3", void, never>;

	type TestEvents = { RUN: void; };

	const holder: { actor?: Machine.Actor<TestState, TestEvents>; } = {};

	const machine = Machine.make<TestState, TestEvents>({
		initial: Machine.state("step1"),
		states: {
			step1: {
				on: {
					RUN: () => {
						// Abort actor mid-dispatch while another event is queued
						holder.actor?.send({ kind: "RUN" });
						holder.actor?.abort();
						return Machine.state("step2");
					},
				},
			},
			step2: { on: { RUN: () => Machine.state("step3") } },
			step3: {},
		},
	});

	const actor = Machine.interpret(machine);
	holder.actor = actor;
	actor.send({ kind: "RUN" });

	expect(actor.isRunning()).toBe(false);
	expect(actor.getState().kind).toBe("step2");
});

test("interpret: handles throwing cleanup during state exit", () => {
	const errors: Error[] = [];

	type TestState = Machine.State<"a", void, "b"> | Machine.State<"b", void, never>;
	type TestEvents = { NEXT: void; };

	const machine = Machine.make<TestState, TestEvents>({
		initial: Machine.state("a"),
		states: {
			a: {
				entry: () => () => {
					throw new Error("exit cleanup error");
				},
				on: { NEXT: () => Machine.state("b") },
			},
			b: {},
		},
	});

	const actor = Machine.interpret(machine, {
		onError: (err) => {
			if (err instanceof Error) {
				errors.push(err);
			}
		},
	});

	actor.send({ kind: "NEXT" });

	expect(actor.getState().kind).toBe("b");
	expect(errors).toHaveLength(1);
	expect(errors[0].message).toBe("exit cleanup error");
});

test("interpret: catches throwing onError handler and throwing bus subscription disposer", () => {
	const bus = EventBus.make<AuthEvents>();
	const machine = createAuthMachine();

	// Force bus disposer to throw on abort
	const actor = Machine.interpret(machine, {
		bus,
		onError: () => {
			throw new Error("onError exploded");
		},
	});

	// Trigger onError throw safely
	actor.subscribe(() => {
		throw new Error("listener fail");
	});
	actor.send({ kind: "SUBMIT", value: { email: "a@b.com" } });

	// Abort with bus
	actor.abort();
	actor.abort();
	expect(actor.isRunning()).toBe(false);
});

test("interpret: ignores unhandled events without transitioning or notifying subscribers", () => {
	const machine = createAuthMachine();
	const actor = Machine.interpret(machine);

	let listenerCalled = false;
	actor.subscribe(() => {
		listenerCalled = true;
	});

	// LOGOUT is not handled while in loggedOut state
	const resultState = actor.send({ kind: "LOGOUT" });

	expect(resultState).toStrictEqual({ kind: "loggedOut" });
	expect(actor.getState()).toStrictEqual({ kind: "loggedOut" });
	expect(listenerCalled).toBe(false);
});

test("interpret: swallows error when no onError handler is provided", () => {
	type TestState = Machine.State<"idle", void, "active"> | Machine.State<"active", void, "idle">;
	type TestEvents = { EXPLODE: void; };

	const machine = Machine.make<TestState, TestEvents>({
		initial: Machine.state("idle"),
		states: {
			idle: {
				on: {
					EXPLODE: () => {
						throw new Error("handler unhandled error");
					},
				},
			},
			active: {},
		},
	});

	const actor = Machine.interpret(machine); // no onError provided

	expect(() => actor.send({ kind: "EXPLODE" })).not.toThrow();
	expect(actor.getState()).toStrictEqual({ kind: "idle" });
});

// =============================================================================
// 7. React useReducer & Redux Integration
// =============================================================================

test("to.reducer: integrates directly with React useReducer pattern", () => {
	const machine = createAuthMachine();
	const reducer = Machine.to.reducer(machine);

	// Simulating React's useReducer runtime loop
	let currentState = machine.initial;
	const dispatch = (action: Machine.EventMessage<AuthEvents>) => {
		currentState = reducer(currentState, action);
	};

	expect(currentState).toStrictEqual({ kind: "loggedOut" });

	dispatch({ kind: "SUBMIT", value: { email: "react@example.com" } });
	expect(currentState).toStrictEqual({ kind: "authenticating", value: { email: "react@example.com" } });

	dispatch({ kind: "RESOLVE", value: { token: "token-react" } });
	expect(currentState).toStrictEqual({ kind: "authenticated", value: { token: "token-react" } });

	// Unhandled action preserves exact state reference
	const beforeUnhandled = currentState;
	dispatch({ kind: "SUBMIT", value: { email: "other@example.com" } });
	expect(currentState).toBe(beforeUnhandled);
});

test("to.reducer: integrates with Redux createStore contract (initializes on undefined state)", () => {
	const machine = createAuthMachine();
	const reducer = Machine.to.reducer(machine);

	// Redux store pattern simulation conforming to Redux core API
	type Store<S, A> = {
		readonly getState: () => S;
		readonly dispatch: (action: A) => A;
		readonly subscribe: (listener: () => void) => () => void;
	};

	const createReduxStore = <S, A>(rootReducer: (state: S | undefined, action: any) => S): Store<S, A> => {
		let state: S = rootReducer(undefined, { kind: "@@redux/INIT" });
		const listeners = new Set<() => void>();

		return {
			getState: () => state,
			dispatch: (action: A) => {
				state = rootReducer(state, action);
				for (const listener of listeners) {
					listener();
				}
				return action;
			},
			subscribe: (listener: () => void) => {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			},
		};
	};

	const store = createReduxStore(reducer);

	// Redux initializes with machine.initial
	expect(store.getState()).toStrictEqual({ kind: "loggedOut" });

	let notifications = 0;
	store.subscribe(() => {
		notifications++;
	});

	store.dispatch({ kind: "SUBMIT", value: { email: "redux@example.com" } });
	expect(notifications).toBe(1);
	expect(store.getState()).toStrictEqual({ kind: "authenticating", value: { email: "redux@example.com" } });

	store.dispatch({ kind: "RESOLVE", value: { token: "redux-token" } });
	expect(notifications).toBe(2);
	expect(store.getState()).toStrictEqual({ kind: "authenticated", value: { token: "redux-token" } });
});

// =============================================================================
// 8. Realistic Multi-Domain Workflow Scenarios
// =============================================================================

test("scenario: multi-step e-commerce checkout with accumulated order context", () => {
	type CheckoutState =
		| Machine.State<
			"cart",
			{ readonly items: readonly string[]; readonly subtotalCents: number; },
			"shipping" | "cancelled"
		>
		| Machine.State<
			"shipping",
			{
				readonly items: readonly string[];
				readonly subtotalCents: number;
				readonly address: string;
				readonly shippingCents: number;
			},
			"payment" | "cart" | "cancelled"
		>
		| Machine.State<"payment", { readonly orderId: string; readonly totalCents: number; }, "completed" | "shipping">
		| Machine.State<"completed", { readonly orderId: string; readonly receiptUrl: string; }, never>
		| Machine.State<"cancelled", { readonly reason: string; }, never>;

	type CheckoutEvents = {
		ADD_ITEM: { readonly item: string; readonly priceCents: number; };
		SET_SHIPPING: { readonly address: string; readonly shippingCents: number; };
		PROCEED_TO_PAYMENT: { readonly orderId: string; };
		PAYMENT_SUCCESS: { readonly receiptUrl: string; };
		BACK_TO_CART: void;
		CANCEL: { readonly reason: string; };
	};

	const checkoutMachine = Machine.make<CheckoutState, CheckoutEvents>({
		initial: Machine.state("cart", { items: [], subtotalCents: 0 }),
		states: {
			cart: {
				on: {
					ADD_ITEM: (state, { item, priceCents }) =>
						Machine.state("cart", {
							items: [...state.value.items, item],
							subtotalCents: state.value.subtotalCents + priceCents,
						}),
					SET_SHIPPING: (state, { address, shippingCents }) =>
						Machine.state("shipping", {
							items: state.value.items,
							subtotalCents: state.value.subtotalCents,
							address,
							shippingCents,
						}),
					CANCEL: (_state, { reason }) => Machine.state("cancelled", { reason }),
				},
			},
			shipping: {
				on: {
					PROCEED_TO_PAYMENT: (state, { orderId }) =>
						Machine.state("payment", { orderId, totalCents: state.value.subtotalCents + state.value.shippingCents }),
					BACK_TO_CART: (state) =>
						Machine.state("cart", { items: state.value.items, subtotalCents: state.value.subtotalCents }),
					CANCEL: (_state, { reason }) => Machine.state("cancelled", { reason }),
				},
			},
			payment: {
				on: {
					PAYMENT_SUCCESS: (state, { receiptUrl }) =>
						Machine.state("completed", { orderId: state.value.orderId, receiptUrl }),
				},
			},
			completed: {},
			cancelled: {},
		},
	});

	const actor = Machine.interpret(checkoutMachine);

	// 1. Add items in cart
	actor.send({ kind: "ADD_ITEM", value: { item: "Mechanical Keyboard", priceCents: 15000 } });
	actor.send({ kind: "ADD_ITEM", value: { item: "USB-C Cable", priceCents: 2000 } });

	expect(actor.getState()).toStrictEqual({
		kind: "cart",
		value: { items: ["Mechanical Keyboard", "USB-C Cable"], subtotalCents: 17000 },
	});

	// 2. Select shipping address
	actor.send({ kind: "SET_SHIPPING", value: { address: "123 Tech Blvd, Silicon Valley", shippingCents: 1500 } });

	expect(actor.getState()).toStrictEqual({
		kind: "shipping",
		value: {
			items: ["Mechanical Keyboard", "USB-C Cable"],
			subtotalCents: 17000,
			address: "123 Tech Blvd, Silicon Valley",
			shippingCents: 1500,
		},
	});

	// 3. Proceed to payment (total = 17000 + 1500 = 18500)
	actor.send({ kind: "PROCEED_TO_PAYMENT", value: { orderId: "ord_9981" } });

	expect(actor.getState()).toStrictEqual({ kind: "payment", value: { orderId: "ord_9981", totalCents: 18500 } });

	// 4. Complete checkout
	actor.send({ kind: "PAYMENT_SUCCESS", value: { receiptUrl: "https://pay.example.com/receipts/ord_9981" } });

	expect(actor.getState()).toStrictEqual({
		kind: "completed",
		value: { orderId: "ord_9981", receiptUrl: "https://pay.example.com/receipts/ord_9981" },
	});
});

test("scenario: document approval lifecycle with revision and feedback loops", () => {
	type DocState =
		| Machine.State<"draft", { readonly docId: string; readonly content: string; }, "inReview">
		| Machine.State<
			"inReview",
			{ readonly docId: string; readonly content: string; readonly assignedReviewer: string; },
			"approved" | "changesRequested"
		>
		| Machine.State<
			"changesRequested",
			{ readonly docId: string; readonly content: string; readonly feedback: string; },
			"inReview"
		>
		| Machine.State<"approved", { readonly docId: string; readonly publishedUrl: string; }, never>;

	type DocEvents = {
		SUBMIT_REVIEW: { readonly reviewer: string; };
		REQUEST_CHANGES: { readonly feedback: string; };
		UPDATE_CONTENT: { readonly newContent: string; readonly reviewer: string; };
		PUBLISH: { readonly publishedUrl: string; };
	};

	const docMachine = Machine.make<DocState, DocEvents>({
		initial: Machine.state("draft", { docId: "doc_1", content: "Initial draft text" }),
		states: {
			draft: {
				on: {
					SUBMIT_REVIEW: (state, { reviewer }) =>
						Machine.state("inReview", { docId: state.value.docId, content: state.value.content, assignedReviewer: reviewer }),
				},
			},
			inReview: {
				on: {
					REQUEST_CHANGES: (state, { feedback }) =>
						Machine.state("changesRequested", { docId: state.value.docId, content: state.value.content, feedback }),
					PUBLISH: (state, { publishedUrl }) => Machine.state("approved", { docId: state.value.docId, publishedUrl }),
				},
			},
			changesRequested: {
				on: {
					UPDATE_CONTENT: (state, { newContent, reviewer }) =>
						Machine.state("inReview", { docId: state.value.docId, content: newContent, assignedReviewer: reviewer }),
				},
			},
			approved: {},
		},
	});

	const actor = Machine.interpret(docMachine);

	// 1. Submit draft to reviewer
	actor.send({ kind: "SUBMIT_REVIEW", value: { reviewer: "alice@company.com" } });
	expect(actor.getState().kind).toBe("inReview");

	// 2. Reviewer requests changes
	actor.send({ kind: "REQUEST_CHANGES", value: { feedback: "Add error handling section" } });
	expect(actor.getState()).toStrictEqual({
		kind: "changesRequested",
		value: { docId: "doc_1", content: "Initial draft text", feedback: "Add error handling section" },
	});

	// 3. Author updates content and resubmits
	actor.send({
		kind: "UPDATE_CONTENT",
		value: { newContent: "Initial draft text with error handling section", reviewer: "alice@company.com" },
	});
	expect(actor.getState().kind).toBe("inReview");

	// 4. Reviewer approves and publishes
	actor.send({ kind: "PUBLISH", value: { publishedUrl: "https://docs.company.com/rfc/doc_1" } });
	expect(actor.getState()).toStrictEqual({
		kind: "approved",
		value: { docId: "doc_1", publishedUrl: "https://docs.company.com/rfc/doc_1" },
	});
});
