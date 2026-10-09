import EventEmitter from "node:events";
import { test } from "vitest";
import { EventBus } from "../EventBus.ts";

const eventBusMake = EventBus.make;
const eventBusListen = EventBus.listen;
const eventBusEmit = EventBus.emit;

type AppSchema = {
	ping: { count: number; };
	pong: { text: string; };
	step1: { id: string; };
	step2: { id: string; };
	step3: { id: string; };
};

const setup1Listener = () => {
	const bus = eventBusMake<AppSchema>();
	eventBusListen(bus, "ping").tap(() => {});

	const ee = new EventEmitter();
	ee.on("ping", () => {});

	return { bus, ee };
};

const setup10Listeners = () => {
	const bus = eventBusMake<AppSchema>();
	for (let i = 0; i < 10; i++) {
		eventBusListen(bus, "ping").tap(() => {});
	}

	const ee = new EventEmitter();
	for (let i = 0; i < 10; i++) {
		ee.on("ping", () => {});
	}

	return { bus, ee };
};

const setupSequenceMatching = () => {
	const bus = eventBusMake<AppSchema>();
	let sequenceMatches = 0;
	eventBusListen(bus, ["step1", "step2", "step3"], { ordered: true }).tap(() => {
		sequenceMatches++;
	});
	return { bus, getMatches: () => sequenceMatches };
};

const setupStateReduction = () => {
	const bus = eventBusMake<{ ping: { count: number; }; }>();
	const sub = eventBusListen(bus, "ping").reduce((msg, state) => ({ total: state.total + msg.value.count }), {
		total: 0,
	});
	return { bus, sub };
};

// =============================================================================
// Scenario 1: Emission throughput across subscribers
// =============================================================================

test("event-bus-emission-1-listener", async ({ bench }) => {
	const { bus, ee } = setup1Listener();

	await bench.compare(
		bench("1. (current) EventBus.emit (1 listener)", () => {
			eventBusEmit(bus, { kind: "ping", value: { count: 1 } });
		}),
		bench("2. EventEmitter.emit (1 listener)", () => {
			ee.emit("ping", { count: 1 });
		}),
	);
});

test("event-bus-emission-10-listeners", async ({ bench }) => {
	const { bus, ee } = setup10Listeners();

	await bench.compare(
		bench("1. (current) EventBus.emit (10 listeners)", () => {
			eventBusEmit(bus, { kind: "ping", value: { count: 1 } });
		}),
		bench("2. EventEmitter.emit (10 listeners)", () => {
			ee.emit("ping", { count: 1 });
		}),
	);
});

// =============================================================================
// Scenario 2: Sequence Pattern Matching
// =============================================================================

test("event-bus-sequence-matching", async ({ bench }) => {
	const { bus, getMatches } = setupSequenceMatching();

	await bench("1. EventBus ordered sequence matching (step1 -> step2 -> step3)", () => {
		eventBusEmit(bus, { kind: "step1", value: { id: "a" } });
		eventBusEmit(bus, { kind: "step2", value: { id: "a" } });
		eventBusEmit(bus, { kind: "step3", value: { id: "a" } });
		getMatches();
	}).run();
});

// =============================================================================
// Scenario 3: State Reduction
// =============================================================================

test("event-bus-state-reduction", async ({ bench }) => {
	const { bus, sub } = setupStateReduction();

	await bench("1. EventBus state reduction", () => {
		eventBusEmit(bus, { kind: "ping", value: { count: 5 } });
		sub.getState();
	}).run();
});
