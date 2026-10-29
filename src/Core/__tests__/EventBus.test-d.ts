import { expectTypeOf, test } from "vitest";
import { EventBus } from "../EventBus.ts";

type TestSchema = {
	A: { value: number; };
	B: { text: string; };
	C: { flag: boolean; };
	ResetEvent: { reason: string; };
};

type IncompatibleSchema = { X: { count: number; }; };

test("make: infers EventBus<S> from schema type and accepts valid options", () => {
	const bus = EventBus.make<TestSchema>();
	expectTypeOf(bus).toEqualTypeOf<EventBus<TestSchema>>();

	const namedBus = EventBus.make<TestSchema>({ id: "app-bus", onError: (_err) => {} });
	expectTypeOf(namedBus).toEqualTypeOf<EventBus<TestSchema>>();
	expectTypeOf(namedBus.id).toEqualTypeOf<string | undefined>();
	expectTypeOf(namedBus[Symbol.toStringTag]).toEqualTypeOf<string | undefined>();

	const contextualBus = EventBus.make<TestSchema>({
		id: "app-bus",
		onError: (_err, context) => {
			expectTypeOf(context?.busId).toEqualTypeOf<string | undefined>();
			expectTypeOf(context?.message).toEqualTypeOf<EventBus.Message<TestSchema> | undefined>();
		},
	});
	expectTypeOf(contextualBus).toEqualTypeOf<EventBus<TestSchema>>();

	// @ts-expect-error — schema must be a Record<string, unknown>
	expectTypeOf(EventBus.make<string>).toBeFunction();

	// @ts-expect-error — id option must be a string
	expectTypeOf(EventBus.make<TestSchema>({ id: 123 })).toBeObject();

	// @ts-expect-error — onError handler parameter cannot be restricted to number
	expectTypeOf(EventBus.make<TestSchema>({ onError: (_err: number) => {} })).toBeObject();
});

test("nominal brand: prevents unbranded plain objects from satisfying EventBus", () => {
	// @ts-expect-error — plain object is missing phantom event bus brand symbol
	const _fakeBus: EventBus<TestSchema> = {};
	expectTypeOf(_fakeBus).toBeObject();
});

test("Message: extracts discriminated union across schema or narrow event subset", () => {
	type AllMessages = EventBus.Message<TestSchema>;
	expectTypeOf<AllMessages>().toEqualTypeOf<
		{ kind: "A"; value: { value: number; }; } | { kind: "B"; value: { text: string; }; } | {
			kind: "C";
			value: { flag: boolean; };
		} | { kind: "ResetEvent"; value: { reason: string; }; }
	>();

	type SingleMessage = EventBus.Message<TestSchema, "A">;
	expectTypeOf<SingleMessage>().toEqualTypeOf<{ kind: "A"; value: { value: number; }; }>();

	type SubsetMessages = EventBus.Message<TestSchema, "A" | "B">;
	expectTypeOf<SubsetMessages>().toEqualTypeOf<
		{ kind: "A"; value: { value: number; }; } | { kind: "B"; value: { text: string; }; }
	>();

	// @ts-expect-error — nonexistent event key in Message subset
	type _Invalid = EventBus.Message<TestSchema, "NONEXISTENT">;
});

test("emit: validates message kind and payload matching schema", () => {
	const bus = EventBus.make<TestSchema>();
	const bus2 = EventBus.make<TestSchema>();

	// Emitting valid single message
	const emitCall = EventBus.emit(bus, { kind: "A", value: { value: 42 } });
	expectTypeOf(emitCall).toEqualTypeOf<void>();

	// Emitting valid broadcast to array of buses
	EventBus.emit([bus, bus2], { kind: "B", value: { text: "broadcast" } });

	// @ts-expect-error — unknown event kind
	expectTypeOf(EventBus.emit(bus, { kind: "UNKNOWN", value: {} })).toBeVoid();

	// @ts-expect-error — wrong payload type for event kind "A"
	expectTypeOf(EventBus.emit(bus, { kind: "A", value: { value: "not-a-number" } })).toBeVoid();

	// @ts-expect-error — missing payload property
	expectTypeOf(EventBus.emit(bus, { kind: "B", value: {} })).toBeVoid();
});

test("subscribe: schema-wide subscription observes all events and forbids collect", () => {
	const bus = EventBus.make<TestSchema>();

	const subBuilder = EventBus.subscribe(bus);

	const unsub = subBuilder.tap((msg) => {
		expectTypeOf(msg).toEqualTypeOf<EventBus.Message<TestSchema>>();
	});
	expectTypeOf(unsub).toEqualTypeOf<() => void>();

	const sub = subBuilder.reduce((msg, count: number) => {
		expectTypeOf(msg).toEqualTypeOf<EventBus.Message<TestSchema>>();
		return count + 1;
	}, 0);
	expectTypeOf(sub).toEqualTypeOf<EventBus.Subscription<number>>();

	// @ts-expect-error — collect does not exist on schema-wide subscription
	expectTypeOf(subBuilder.collect).toBeFunction();
});

test("subscribe: single event subscriber narrows message kind and payload", () => {
	const bus = EventBus.make<TestSchema>();

	EventBus.subscribe(bus, "A").tap((msg) => {
		expectTypeOf(msg.kind).toEqualTypeOf<"A">();
		expectTypeOf(msg.value).toEqualTypeOf<{ value: number; }>();
	});

	const sub = EventBus.subscribe(bus, "A").reduce((msg, count: number) => {
		expectTypeOf(msg.kind).toEqualTypeOf<"A">();
		expectTypeOf(msg.value).toEqualTypeOf<{ value: number; }>();
		return count + msg.value.value;
	}, 0);
	expectTypeOf(sub).toEqualTypeOf<EventBus.Subscription<number>>();
	expectTypeOf(sub.getState()).toEqualTypeOf<number>();
	expectTypeOf(sub.unsubscribe).toEqualTypeOf<() => void>();

	EventBus.subscribe(bus, "A").collect((payloads) => {
		expectTypeOf(payloads).toEqualTypeOf<EventBus.CollectedPayloads<TestSchema, "A">>();
		expectTypeOf(payloads).toMatchTypeOf<{ readonly A: { value: number; }; }>();
		expectTypeOf(payloads.A).toEqualTypeOf<{ value: number; }>();
	});

	// @ts-expect-error — subscribing to nonexistent event kind
	expectTypeOf(EventBus.subscribe(bus, "NONEXISTENT")).toBeObject();
});

test("subscribe: multiple events array narrows message kind and union payload", () => {
	const bus = EventBus.make<TestSchema>();

	EventBus.subscribe(bus, ["A", "B"]).tap((msg) => {
		expectTypeOf(msg.kind).toEqualTypeOf<"A" | "B">();
		if (msg.kind === "A") {
			expectTypeOf(msg.value).toEqualTypeOf<{ value: number; }>();
		} else {
			expectTypeOf(msg.value).toEqualTypeOf<{ text: string; }>();
		}
	});

	EventBus.subscribe(bus, ["A", "B"]).reduce((msg, state: string) => {
		expectTypeOf(msg.kind).toEqualTypeOf<"A" | "B">();
		return state + msg.kind;
	}, "");

	EventBus.subscribe(bus, ["A", "B"]).collect((payloads) => {
		expectTypeOf(payloads).toEqualTypeOf<EventBus.CollectedPayloads<TestSchema, "A" | "B">>();
		expectTypeOf(payloads).toMatchTypeOf<{ readonly A: { value: number; }; readonly B: { text: string; }; }>();
		expectTypeOf(payloads.A).toEqualTypeOf<{ value: number; }>();
		expectTypeOf(payloads.B).toEqualTypeOf<{ text: string; }>();
	});
});

test("subscribe: sequence options with optional steps types skipped events as undefined", () => {
	const bus = EventBus.make<TestSchema>();

	EventBus.subscribe(bus, ["A", "B", "C"], {
		ordered: true,
		optional: ["B"],
		reset: "ResetEvent",
		strict: true,
		once: true,
	}).collect((payloads) => {
		expectTypeOf(payloads).toEqualTypeOf<EventBus.CollectedPayloads<TestSchema, "A" | "B" | "C", "B">>();
		expectTypeOf(payloads.A).toEqualTypeOf<{ value: number; }>();
		expectTypeOf(payloads.C).toEqualTypeOf<{ flag: boolean; }>();
		expectTypeOf(payloads.B).toEqualTypeOf<{ text: string; } | undefined>();
		expectTypeOf(payloads).toMatchTypeOf<
			{ readonly A: { value: number; }; readonly C: { flag: boolean; }; readonly B?: { text: string; }; }
		>();
	});

	// Multiple optional steps in sequence
	EventBus.subscribe(bus, ["A", "B", "C"], { ordered: true, optional: ["B", "C"] }).collect((payloads) => {
		expectTypeOf(payloads).toEqualTypeOf<EventBus.CollectedPayloads<TestSchema, "A" | "B" | "C", "B" | "C">>();
		expectTypeOf(payloads.A).toEqualTypeOf<{ value: number; }>();
		expectTypeOf(payloads.B).toEqualTypeOf<{ text: string; } | undefined>();
		expectTypeOf(payloads.C).toEqualTypeOf<{ flag: boolean; } | undefined>();
	});

	// @ts-expect-error — optional event must be a valid key in schema
	expectTypeOf(EventBus.subscribe(bus, ["A", "C"], { optional: ["NONEXISTENT"] })).toBeObject();

	// @ts-expect-error — reset event must be a valid key in schema
	expectTypeOf(EventBus.subscribe(bus, ["A"], { reset: "INVALID_RESET" })).toBeObject();

	// Array of reset events
	EventBus.subscribe(bus, ["A", "B"], { ordered: true, strict: true, reset: ["ResetEvent", "C"] }).collect(
		(payloads) => {
			expectTypeOf(payloads).toEqualTypeOf<EventBus.CollectedPayloads<TestSchema, "A" | "B">>();
			expectTypeOf(payloads.A).toEqualTypeOf<{ value: number; }>();
			expectTypeOf(payloads.B).toEqualTypeOf<{ text: string; }>();
		},
	);

	// @ts-expect-error — reset array contains invalid event key
	expectTypeOf(EventBus.subscribe(bus, ["A", "B"], { reset: ["NONEXISTENT"] })).toBeObject();
});

type AuthSchema = { userLoggedIn: { userId: string; }; sessionExpired: { at: number; }; };

type AnalyticsSchema = { userLoggedIn: { userId: string; }; pageView: { url: string; }; };

type SpecificSchema = { A: { value: number; }; };

type IncompatiblePayloadSchema = { userLoggedIn: { userId: number; }; };

test("forward: validates compatibility between bus schemas and filters", () => {
	const busA = EventBus.make<TestSchema>();
	const busB = EventBus.make<TestSchema>();
	const busC = EventBus.make<TestSchema>();
	const busIncompatible = EventBus.make<IncompatibleSchema>();

	const stop1 = EventBus.forward({ from: busA, to: busB });
	expectTypeOf(stop1).toEqualTypeOf<() => void>();

	const stop2 = EventBus.forward({ from: busA, to: [busB, busC], only: ["A", "B"] });
	expectTypeOf(stop2).toEqualTypeOf<() => void>();

	// Cross-schema forwarding via `only` with shared event key
	const authBus = EventBus.make<AuthSchema>();
	const analyticsBus = EventBus.make<AnalyticsSchema>();
	const stopCross = EventBus.forward({ from: authBus, to: analyticsBus, only: ["userLoggedIn"] });
	expectTypeOf(stopCross).toEqualTypeOf<() => void>();

	// Subset schema forwarding without `only` (target has superset of source events)
	const specificBus = EventBus.make<SpecificSchema>();
	const stopSubset = EventBus.forward({ from: specificBus, to: busA });
	expectTypeOf(stopSubset).toEqualTypeOf<() => void>();

	// @ts-expect-error — target bus has incompatible schema without only
	expectTypeOf(EventBus.forward({ from: busA, to: busIncompatible })).toBeFunction();

	// @ts-expect-error — broad bus cannot forward to specific bus without `only` (missing B, C, ResetEvent)
	expectTypeOf(EventBus.forward({ from: busA, to: specificBus })).toBeFunction();

	// @ts-expect-error — only filter contains event key not present in target schema
	expectTypeOf(EventBus.forward({ from: authBus, to: analyticsBus, only: ["sessionExpired"] })).toBeFunction();

	// @ts-expect-error — only filter contains event key not present in source schema
	expectTypeOf(EventBus.forward({ from: authBus, to: analyticsBus, only: ["pageView"] })).toBeFunction();

	const incompatiblePayloadBus = EventBus.make<IncompatiblePayloadSchema>();
	// @ts-expect-error — only filter contains event key with incompatible payload type
	expectTypeOf(EventBus.forward({ from: authBus, to: incompatiblePayloadBus, only: ["userLoggedIn"] })).toBeFunction();
});
