import EventEmitter from "node:events";
import { bench, describe } from "vitest";
import { EventBus } from "../EventBus.ts";

type AppSchema = {
	ping: { count: number; };
	pong: { text: string; };
	step1: { id: string; };
	step2: { id: string; };
	step3: { id: string; };
};

const setup1Listener = () => {
	const bus = EventBus.make<AppSchema>();
	EventBus.listen(bus, "ping").tap(() => {});

	const ee = new EventEmitter();
	ee.on("ping", () => {});

	return { bus, ee };
};

const setup10Listeners = () => {
	const bus = EventBus.make<AppSchema>();
	for (let i = 0; i < 10; i++) {
		EventBus.listen(bus, "ping").tap(() => {});
	}

	const ee = new EventEmitter();
	for (let i = 0; i < 10; i++) {
		ee.on("ping", () => {});
	}

	return { bus, ee };
};

const setupSequenceMatching = () => {
	const bus = EventBus.make<AppSchema>();
	let sequenceMatches = 0;
	EventBus.listen(bus, ["step1", "step2", "step3"], { ordered: true }).tap(() => {
		sequenceMatches++;
	});
	return { bus, getMatches: () => sequenceMatches };
};

const setupStateReduction = () => {
	const bus = EventBus.make<{ ping: { count: number; }; }>();
	const sub = EventBus.listen(bus, "ping").reduce((msg, state) => ({ total: state.total + msg.value.count }), {
		total: 0,
	});
	return { bus, sub };
};

// =============================================================================
// Scenario 1: Emission throughput across subscribers
// =============================================================================

describe("event-bus-emission-1-listener", () => {
	const { bus, ee } = setup1Listener();

	bench("1. (current) EventBus.emit (1 listener)", () => {
		EventBus.emit(bus, { kind: "ping", value: { count: 1 } });
	});

	bench("2. EventEmitter.emit (1 listener)", () => {
		ee.emit("ping", { count: 1 });
	});
});

describe("event-bus-emission-10-listeners", () => {
	const { bus, ee } = setup10Listeners();

	bench("1. (current) EventBus.emit (10 listeners)", () => {
		EventBus.emit(bus, { kind: "ping", value: { count: 1 } });
	});

	bench("2. EventEmitter.emit (10 listeners)", () => {
		ee.emit("ping", { count: 1 });
	});
});

// =============================================================================
// Scenario 2: Sequence Pattern Matching
// =============================================================================

describe("event-bus-sequence-matching", () => {
	const { bus, getMatches } = setupSequenceMatching();

	bench("1. EventBus ordered sequence matching (step1 -> step2 -> step3)", () => {
		EventBus.emit(bus, { kind: "step1", value: { id: "a" } });
		EventBus.emit(bus, { kind: "step2", value: { id: "a" } });
		EventBus.emit(bus, { kind: "step3", value: { id: "a" } });
		getMatches();
	});
});

// =============================================================================
// Scenario 3: State Reduction
// =============================================================================

describe("event-bus-state-reduction", () => {
	const { bus, sub } = setupStateReduction();

	bench("1. EventBus state reduction", () => {
		EventBus.emit(bus, { kind: "ping", value: { count: 5 } });
		sub.getState();
	});
});
