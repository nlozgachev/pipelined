import { expectTypeOf, test } from "vitest";
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

declare const getAuthState: () => AuthState;

type AuthEvents = {
	SUBMIT: { readonly email: string; };
	RESOLVE: { readonly token: string; };
	REJECT: { readonly error: string; };
	LOGOUT: void;
};

// =============================================================================
// 1. State Construction & Contravariant Assignability
// =============================================================================

test("state: constructs states that assign cleanly to constrained unions with zero casts", () => {
	const loggedOut = Machine.state("loggedOut");
	const authenticating = Machine.state("authenticating", { email: "dev@example.com" });

	expectTypeOf(loggedOut).toEqualTypeOf<Machine.State<"loggedOut", void, string>>();
	expectTypeOf(authenticating).toEqualTypeOf<Machine.State<"authenticating", { email: string; }, string>>();

	// Positive bounds: assign directly to union variants without type assertions
	const _state1: AuthState = loggedOut;
	const _state2: AuthState = authenticating;
	expectTypeOf(_state1).toBeObject();
	expectTypeOf(_state2).toBeObject();

	// @ts-expect-error — cannot assign state with incorrect payload type
	const _badPayload: AuthState = Machine.state("authenticating", { email: 123 });
	expectTypeOf(_badPayload).toBeObject();

	// @ts-expect-error — cannot assign unknown state kind to domain union
	const _unknownKind: AuthState = Machine.state("nonexistent");
	expectTypeOf(_unknownKind).toBeObject();
});

// =============================================================================
// 2. Machine.make & Compile-Time Outbound Transition Constraints
// =============================================================================

test("make: validates transition table and enforces AllowedTargets at compile time", () => {
	const validMachine = Machine.make<AuthState, AuthEvents>({
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

	expectTypeOf(validMachine).toEqualTypeOf<Machine<AuthState, AuthEvents>>();
	expectTypeOf(validMachine.id).toEqualTypeOf<string | undefined>();
	expectTypeOf(validMachine[Symbol.toStringTag]).toEqualTypeOf<string | undefined>();

	const machineWithId = Machine.make<AuthState, AuthEvents>({
		id: "auth-machine",
		initial: Machine.state("loggedOut"),
		states: validMachine.states,
	});
	expectTypeOf(machineWithId.id).toEqualTypeOf<string | undefined>();

	// @ts-expect-error — id must be a string
	Machine.make<AuthState, AuthEvents>({ id: 123, initial: Machine.state("loggedOut"), states: validMachine.states });

	Machine.make<AuthState, AuthEvents>({
		initial: Machine.state("loggedOut"),
		states: {
			loggedOut: {
				on: {
					// @ts-expect-error — illegal outbound target: "loggedOut" cannot transition directly to "authenticated"
					SUBMIT: () => Machine.state("authenticated", { token: "bypass" }),
				},
			},
			authenticating: {},
			authenticated: {},
			failed: {},
		},
	});

	Machine.make<AuthState, AuthEvents>({
		initial: Machine.state("loggedOut"),
		// @ts-expect-error — missing state configuration: "failed" state omitted from states table
		states: { loggedOut: {}, authenticating: {}, authenticated: {} },
	});
});

// =============================================================================
// 3. Machine.is Type Guard Narrowing
// =============================================================================

test("is: refines state union down to the specific variant", () => {
	const state = getAuthState();

	if (Machine.is("authenticating")(state)) {
		expectTypeOf(state).toEqualTypeOf<
			Machine.State<"authenticating", { readonly email: string; }, "authenticated" | "failed">
		>();
		expectTypeOf(state.value.email).toEqualTypeOf<string>();
	} else {
		expectTypeOf(state).toEqualTypeOf<
			| Machine.State<"loggedOut", void, "authenticating">
			| Machine.State<"authenticated", { readonly token: string; }, "loggedOut">
			| Machine.State<"failed", { readonly error: string; }, "authenticating" | "loggedOut">
		>();
	}
});

// =============================================================================
// 4. Machine.match Exhaustive Pattern Matching
// =============================================================================

test("match: enforces exhaustive branch coverage and infers return type", () => {
	const state = getAuthState();

	const matcher = Machine.match<AuthState, string>({
		loggedOut: () => "logged-out",
		authenticating: (s) => s.value.email,
		authenticated: (s) => s.value.token,
		failed: (s) => s.value.error,
	});

	expectTypeOf(matcher(state)).toEqualTypeOf<string>();

	// @ts-expect-error — missing "failed" branch in match cases
	Machine.match<AuthState, string>({ loggedOut: () => "out", authenticating: () => "auth", authenticated: () => "ok" });
});

// =============================================================================
// 5. Machine.transition & Actor.send Event Verification
// =============================================================================

test("transition & actor: validate event types and enforce strict payloads", () => {
	const machine = Machine.make<AuthState, AuthEvents>({
		initial: Machine.state("loggedOut"),
		states: { loggedOut: {}, authenticating: {}, authenticated: {}, failed: {} },
	});

	const actor = Machine.interpret(machine);

	expectTypeOf(actor.id).toEqualTypeOf<string | undefined>();
	expectTypeOf(actor[Symbol.toStringTag]).toEqualTypeOf<string | undefined>();

	const actorWithOpts = Machine.interpret(machine, {
		id: "auth-actor",
		onError: (_err, context) => {
			expectTypeOf(context?.actorId).toEqualTypeOf<string | undefined>();
			expectTypeOf(context?.state).toEqualTypeOf<AuthState | undefined>();
			expectTypeOf(context?.phase).toEqualTypeOf<"entry" | "exit" | "listener" | "transition" | undefined>();
		},
	});
	expectTypeOf(actorWithOpts.id).toEqualTypeOf<string | undefined>();

	expectTypeOf(actor.getState()).toEqualTypeOf<AuthState>();
	expectTypeOf(actor.send({ kind: "LOGOUT" })).toEqualTypeOf<AuthState>();
	expectTypeOf(actor.send({ kind: "SUBMIT", value: { email: "dev@example.com" } })).toEqualTypeOf<AuthState>();

	// @ts-expect-error — unlisted event kind rejected
	actor.send({ kind: "UNKNOWN_EVENT" });

	// @ts-expect-error — invalid payload for SUBMIT (number instead of string)
	actor.send({ kind: "SUBMIT", value: { email: 123 } });

	// @ts-expect-error — unlisted event kind rejected in transition
	Machine.transition(machine, { kind: "UNKNOWN_EVENT" });
});

// =============================================================================
// 6. Synergy with EventBus
// =============================================================================

test("interpret: enforces EventBus schema compatibility", () => {
	const machine = Machine.make<AuthState, AuthEvents>({
		initial: Machine.state("loggedOut"),
		states: { loggedOut: {}, authenticating: {}, authenticated: {}, failed: {} },
	});

	const compatibleBus = EventBus.make<AuthEvents>();
	const incompatibleBus = EventBus.make<{ OTHER: { count: number; }; }>();

	expectTypeOf(Machine.interpret(machine, { bus: compatibleBus })).toEqualTypeOf<Machine.Actor<AuthState, AuthEvents>>();

	// @ts-expect-error — incompatible event bus schema
	Machine.interpret(machine, { bus: incompatibleBus });
});

// =============================================================================
// 7. Machine.to.reducer Type Verification
// =============================================================================

test("to.reducer: produces an uncurried reducer typed for React and Redux", () => {
	const machine = Machine.make<AuthState, AuthEvents>({
		initial: Machine.state("loggedOut"),
		states: { loggedOut: {}, authenticating: {}, authenticated: {}, failed: {} },
	});

	const reducer = Machine.to.reducer(machine);

	expectTypeOf(reducer).toEqualTypeOf<
		(state: AuthState | undefined, event: Machine.EventMessage<AuthEvents>) => AuthState
	>();

	const next = reducer(undefined, { kind: "LOGOUT" });
	expectTypeOf(next).toEqualTypeOf<AuthState>();

	// @ts-expect-error — unlisted event rejected in reducer
	reducer(undefined, { kind: "UNKNOWN_ACTION" });

	// @ts-expect-error — invalid payload rejected in reducer
	reducer(undefined, { kind: "SUBMIT", value: { email: 123 } });
});
