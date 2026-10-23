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

	const namedBus = EventBus.make<TestSchema>({ name: "app-bus", onError: (_err) => {} });
	expectTypeOf(namedBus).toEqualTypeOf<EventBus<TestSchema>>();

	// @ts-expect-error — schema must be a Record<string, unknown>
	EventBus.make<string>();
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
	EventBus.emit(bus, { kind: "UNKNOWN", value: {} });

	// @ts-expect-error — wrong payload type for event kind "A"
	EventBus.emit(bus, { kind: "A", value: { value: "not-a-number" } });

	// @ts-expect-error — missing payload property
	EventBus.emit(bus, { kind: "B", value: {} });
});

test("listen: single event listener narrows message kind and payload", () => {
	const bus = EventBus.make<TestSchema>();

	EventBus.listen(bus, "A").tap((msg) => {
		expectTypeOf(msg.kind).toEqualTypeOf<"A">();
		expectTypeOf(msg.value).toEqualTypeOf<{ value: number; }>();
	});

	const sub = EventBus.listen(bus, "A").reduce((msg, count: number) => {
		expectTypeOf(msg.kind).toEqualTypeOf<"A">();
		expectTypeOf(msg.value).toEqualTypeOf<{ value: number; }>();
		return count + msg.value.value;
	}, 0);
	expectTypeOf(sub).toEqualTypeOf<EventBus.Subscription<number>>();
	expectTypeOf(sub.getState()).toEqualTypeOf<number>();
	expectTypeOf(sub.unsubscribe).toEqualTypeOf<() => void>();

	EventBus.listen(bus, "A").collect((payloads) => {
		expectTypeOf(payloads).toEqualTypeOf<EventBus.CollectedPayloads<TestSchema, "A">>();
		expectTypeOf(payloads).toMatchTypeOf<{ readonly A: { value: number; }; }>();
		expectTypeOf(payloads.A).toEqualTypeOf<{ value: number; }>();
	});

	// @ts-expect-error — listening to nonexistent event kind
	EventBus.listen(bus, "NONEXISTENT");
});

test("listen: multiple events array narrows message kind and union payload", () => {
	const bus = EventBus.make<TestSchema>();

	EventBus.listen(bus, ["A", "B"]).tap((msg) => {
		expectTypeOf(msg.kind).toEqualTypeOf<"A" | "B">();
		if (msg.kind === "A") {
			expectTypeOf(msg.value).toEqualTypeOf<{ value: number; }>();
		} else {
			expectTypeOf(msg.value).toEqualTypeOf<{ text: string; }>();
		}
	});

	EventBus.listen(bus, ["A", "B"]).reduce((msg, state: string) => {
		expectTypeOf(msg.kind).toEqualTypeOf<"A" | "B">();
		return state + msg.kind;
	}, "");

	EventBus.listen(bus, ["A", "B"]).collect((payloads) => {
		expectTypeOf(payloads).toEqualTypeOf<EventBus.CollectedPayloads<TestSchema, "A" | "B">>();
		expectTypeOf(payloads).toMatchTypeOf<{ readonly A: { value: number; }; readonly B: { text: string; }; }>();
		expectTypeOf(payloads.A).toEqualTypeOf<{ value: number; }>();
		expectTypeOf(payloads.B).toEqualTypeOf<{ text: string; }>();
	});
});

test("listen: sequence options with optional steps types skipped events as undefined", () => {
	const bus = EventBus.make<TestSchema>();

	EventBus.listen(bus, ["A", "B", "C"], {
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

	// @ts-expect-error — optional event must be a valid key in schema
	EventBus.listen(bus, ["A", "C"], { optional: ["NONEXISTENT"] });

	// @ts-expect-error — reset event must be a valid key in schema
	EventBus.listen(bus, ["A"], { reset: "INVALID_RESET" });
});

test("forward: validates compatibility between bus schemas and filters", () => {
	const busA = EventBus.make<TestSchema>();
	const busB = EventBus.make<TestSchema>();
	const busC = EventBus.make<TestSchema>();
	const busIncompatible = EventBus.make<IncompatibleSchema>();

	const stop1 = EventBus.forward({ from: busA, to: busB });
	expectTypeOf(stop1).toEqualTypeOf<() => void>();

	const stop2 = EventBus.forward({ from: busA, to: [busB, busC], only: ["A", "B"] });
	expectTypeOf(stop2).toEqualTypeOf<() => void>();

	// @ts-expect-error — target bus has incompatible schema
	EventBus.forward({ from: busA, to: busIncompatible });

	// @ts-expect-error — only filter contains event key not present in schema
	EventBus.forward({ from: busA, to: busB, only: ["NONEXISTENT"] });
});
