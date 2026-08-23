import EventEmitter from "node:events";
import { bench, describe } from "vitest";
import { Stream } from "../Stream.ts";

type AppSchema = {
	ping: { count: number; };
	pong: { text: string; };
	step1: { id: string; };
	step2: { id: string; };
	step3: { id: string; };
};

// =============================================================================
// Scenario 1: Emission throughput across subscribers
// =============================================================================

describe("stream-emission-1-listener", () => {
	const stream = Stream.make<AppSchema>();
	Stream.listen(stream, "ping").tap(() => {});

	const ee = new EventEmitter();
	ee.on("ping", () => {});

	bench("1. (current) Stream.emit (1 listener)", () => {
		Stream.emit(stream, { kind: "ping", value: { count: 1 } });
	});

	bench("2. EventEmitter.emit (1 listener)", () => {
		ee.emit("ping", { count: 1 });
	});
});

describe("stream-emission-10-listeners", () => {
	const stream = Stream.make<AppSchema>();
	for (let i = 0; i < 10; i++) {
		Stream.listen(stream, "ping").tap(() => {});
	}

	const ee = new EventEmitter();
	for (let i = 0; i < 10; i++) {
		ee.on("ping", () => {});
	}

	bench("1. (current) Stream.emit (10 listeners)", () => {
		Stream.emit(stream, { kind: "ping", value: { count: 1 } });
	});

	bench("2. EventEmitter.emit (10 listeners)", () => {
		ee.emit("ping", { count: 1 });
	});
});

// =============================================================================
// Scenario 2: Sequence Pattern Matching
// =============================================================================

describe("stream-sequence-matching", () => {
	const stream = Stream.make<AppSchema>();
	let _sequenceMatches = 0;

	Stream.listen(stream, ["step1", "step2", "step3"], { ordered: true }).tap(() => {
		_sequenceMatches++;
	});

	bench("1. Stream ordered sequence matching (step1 -> step2 -> step3)", () => {
		Stream.emit(stream, { kind: "step1", value: { id: "a" } });
		Stream.emit(stream, { kind: "step2", value: { id: "a" } });
		Stream.emit(stream, { kind: "step3", value: { id: "a" } });
	});
});

// =============================================================================
// Scenario 3: State Reduction
// =============================================================================

describe("stream-state-reduction", () => {
	const stream = Stream.make<{ ping: { count: number; }; }>();
	const sub = Stream.listen(stream, "ping").reduce((msg, state) => ({ total: state.total + msg.value.count }), {
		total: 0,
	});

	bench("1. Stream state reduction", () => {
		Stream.emit(stream, { kind: "ping", value: { count: 5 } });
		sub.getState();
	});
});
