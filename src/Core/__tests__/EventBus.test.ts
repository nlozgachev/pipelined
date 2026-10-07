import { expect, test } from "vitest";
import { EventBus } from "../EventBus.ts";

type TestSchema = {
	A: { value: number; };
	B: { text: string; };
	C: { flag: boolean; };
	ResetEvent: { reason: string; };
};

// --- EventBus.make ---

test("EventBus.make creates an event bus instance", () => {
	const s = EventBus.make<TestSchema>({ name: "test-bus" });
	expect(s.options?.name).toBe("test-bus");
	expect(s._listeners.size).toBe(0);
});

// --- EventBus.emit ---

test("EventBus.emit dispatches messages to subscribers", () => {
	const s = EventBus.make<TestSchema>();
	let received: EventBus.Message<TestSchema> | null = null;

	EventBus.listen(s, "A").tap((msg) => {
		received = msg;
	});

	EventBus.emit(s, { kind: "A", value: { value: 42 } });

	expect(received).toStrictEqual({ kind: "A", value: { value: 42 } });
});

test("EventBus.emit broadcasts to multiple target event buses", () => {
	const s1 = EventBus.make<TestSchema>();
	const s2 = EventBus.make<TestSchema>();

	let s1Count = 0;
	let s2Count = 0;

	EventBus.listen(s1, "A").tap(() => {
		s1Count++;
	});
	EventBus.listen(s2, "A").tap(() => {
		s2Count++;
	});

	EventBus.emit([s1, s2], { kind: "A", value: { value: 10 } });

	expect(s1Count).toBe(1);
	expect(s2Count).toBe(1);
});

test("EventBus.emit passes errors to onError option handler if provided", () => {
	let caughtError: unknown = null;
	const s = EventBus.make<TestSchema>({
		onError: (err) => {
			caughtError = err;
		},
	});

	EventBus.listen(s, "A").tap(() => {
		throw new Error("listener error");
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	expect(caughtError).toBeInstanceOf(Error);
	expect((caughtError as Error).message).toBe("listener error");
});

test("EventBus.emit throws error if listener throws and no onError handler is provided", () => {
	const s = EventBus.make<TestSchema>();
	EventBus.listen(s, "A").tap(() => {
		throw new Error("uncaught error");
	});

	expect(() => EventBus.emit(s, { kind: "A", value: { value: 1 } })).toThrow("uncaught error");
});

// --- Re-entrant Emissions & Trampoline Queue ---

test("EventBus.emit processes re-entrant emissions breadth-first", () => {
	const s = EventBus.make<TestSchema>();
	const log: string[] = [];

	EventBus.listen(s, "A").tap(() => {
		log.push("L1: A");
		EventBus.emit(s, { kind: "B", value: { text: "from L1" } });
	});

	EventBus.listen(s, "A").tap(() => {
		log.push("L2: A");
	});

	EventBus.listen(s, "B").tap(() => {
		log.push("L3: B");
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });

	// Breadth-first: L2 receives A before L3 receives B
	expect(log).toStrictEqual(["L1: A", "L2: A", "L3: B"]);
});

test("EventBus.emit processes deep re-entrant emission cascades without stack overflow", () => {
	const s = EventBus.make<TestSchema>();
	let count = 0;

	EventBus.listen(s, "A").tap(() => {
		count++;
		if (count < 1000) {
			EventBus.emit(s, { kind: "A", value: { value: count } });
		}
	});

	EventBus.emit(s, { kind: "A", value: { value: 0 } });
	expect(count).toBe(1000);
});

// --- EventBus.listen & reduce / tap ---

test("EventBus.listen reduce accumulates state over matching events", () => {
	const s = EventBus.make<TestSchema>();

	const sub = EventBus.listen(s, ["A", "B"]).reduce((msg, state) => {
		if (msg.kind === "A") {
			return { ...state, sum: state.sum + msg.value.value };
		}
		if (msg.kind === "B") {
			return { ...state, texts: [...state.texts, msg.value.text] };
		}
		return state;
	}, { sum: 0, texts: [] as string[] });

	expect(sub.getState()).toStrictEqual({ sum: 0, texts: [] });

	EventBus.emit(s, { kind: "A", value: { value: 5 } });
	expect(sub.getState()).toStrictEqual({ sum: 5, texts: [] });

	EventBus.emit(s, { kind: "B", value: { text: "first" } });
	expect(sub.getState()).toStrictEqual({ sum: 5, texts: ["first"] });

	sub.unsubscribe();
	EventBus.emit(s, { kind: "A", value: { value: 10 } });
	expect(sub.getState()).toStrictEqual({ sum: 5, texts: ["first"] });
});

test("EventBus.listen reduce with once: true unsubscribes after first reduction", () => {
	const s = EventBus.make<TestSchema>();
	const sub = EventBus.listen(s, "A", { once: true }).reduce((_msg, state) => ({ count: state.count + 1 }), {
		count: 0,
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "A", value: { value: 2 } });

	expect(sub.getState()).toStrictEqual({ count: 1 });
	expect(s._listeners.size).toBe(0);
});

test("EventBus.listen tap returns an unsubscribe function that removes the listener", () => {
	const s = EventBus.make<TestSchema>();
	let count = 0;
	const unsubscribe = EventBus.listen(s, "A").tap(() => {
		count++;
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	expect(count).toBe(1);

	unsubscribe();
	EventBus.emit(s, { kind: "A", value: { value: 2 } });
	expect(count).toBe(1);
	expect(s._listeners.size).toBe(0);
});

// --- Sequence options ---

test("EventBus.listen ordered matches sequence in exact order", () => {
	const s = EventBus.make<TestSchema>();
	let sequenceFiredCount = 0;

	EventBus.listen(s, ["A", "B"], { ordered: true }).tap(() => {
		sequenceFiredCount++;
	});

	// B before A should not trigger sequence completion
	EventBus.emit(s, { kind: "B", value: { text: "early" } });
	expect(sequenceFiredCount).toBe(0);

	// A followed by B should trigger sequence completion
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	expect(sequenceFiredCount).toBe(0);

	EventBus.emit(s, { kind: "B", value: { text: "after A" } });
	expect(sequenceFiredCount).toBe(1);
});

test("EventBus.listen strict resets sequence on unexpected event", () => {
	const s = EventBus.make<TestSchema>();
	let sequenceFiredCount = 0;

	EventBus.listen(s, ["A", "B"], { ordered: true, strict: true }).tap(() => {
		sequenceFiredCount++;
	});

	// Send A
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	// Send non-matching event C in strict mode -> resets sequence
	EventBus.emit(s, { kind: "C", value: { flag: true } });
	// Send B -> should not fire because sequence was reset
	EventBus.emit(s, { kind: "B", value: { text: "test" } });

	expect(sequenceFiredCount).toBe(0);

	// Now valid consecutive sequence A -> B
	EventBus.emit(s, { kind: "A", value: { value: 2 } });
	EventBus.emit(s, { kind: "B", value: { text: "consecutive" } });

	expect(sequenceFiredCount).toBe(1);
});

test("EventBus.listen sequence resets to index 1 when unexpected event matches first event in sequence", () => {
	const s = EventBus.make<TestSchema>();
	let firedCount = 0;

	EventBus.listen(s, ["A", "B"], { ordered: true, strict: true }).tap(() => {
		firedCount++;
	});

	// A -> A -> B (second A resets sequence index to 1, then B completes sequence)
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "A", value: { value: 2 } });
	EventBus.emit(s, { kind: "B", value: { text: "match" } });

	expect(firedCount).toBe(1);
});

test("EventBus.listen relaxed sequence resets to index 0 when out-of-order event in eventList arrives", () => {
	const s = EventBus.make<TestSchema>();
	let firedCount = 0;

	EventBus.listen(s, ["A", "B", "C"], { ordered: true, strict: false }).tap(() => {
		firedCount++;
	});

	// A -> B -> B -> C (second B resets sequence index to 0 because B is in eventList but not A)
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "B", value: { text: "1" } });
	EventBus.emit(s, { kind: "B", value: { text: "2" } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });

	expect(firedCount).toBe(0);
});

test("EventBus.listen optional skips optional events in sequence when next event matches", () => {
	const s = EventBus.make<TestSchema>();
	let fired = 0;

	// B is optional in sequence A -> B -> C
	EventBus.listen(s, ["A", "B", "C"], { ordered: true, optional: ["B"] }).tap(() => {
		fired++;
	});

	// Emit A -> C directly (skipping optional B)
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });

	expect(fired).toBe(1);
});

test("EventBus.listen relaxed sequence resets to index 1 when out-of-order event matches eventList[0]", () => {
	const s = EventBus.make<TestSchema>();
	let firedCount = 0;

	EventBus.listen(s, ["A", "B", "C"], { ordered: true, strict: false }).tap(() => {
		firedCount++;
	});

	// A -> B -> A -> B -> C
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "B", value: { text: "1" } });
	EventBus.emit(s, { kind: "A", value: { value: 2 } });
	EventBus.emit(s, { kind: "B", value: { text: "2" } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });

	expect(firedCount).toBe(1);
});

test("EventBus.listen optional ignores lookahead if unexpected event does not match after optional items", () => {
	const s = EventBus.make<TestSchema>();
	let fired = 0;
	EventBus.listen(s, ["A", "B", "C"], { ordered: true, optional: ["B"] }).tap(() => {
		fired++;
	});
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "ResetEvent", value: { reason: "skip" } });
	expect(fired).toBe(0);
	EventBus.emit(s, { kind: "C", value: { flag: true } });
	expect(fired).toBe(1);
});

test("EventBus.listen relaxed sequence ignores events not present in eventList", () => {
	const s = EventBus.make<TestSchema>();
	let fired = 0;
	EventBus.listen(s, ["A", "B"], { ordered: true, strict: false }).tap(() => {
		fired++;
	});
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });
	EventBus.emit(s, { kind: "B", value: { text: "after C" } });
	expect(fired).toBe(1);
});

test("EventBus.listen once automatically unsubscribes after first match", () => {
	const s = EventBus.make<TestSchema>();
	let fireCount = 0;

	EventBus.listen(s, "A", { once: true }).tap(() => {
		fireCount++;
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "A", value: { value: 2 } });

	expect(fireCount).toBe(1);
	expect(s._listeners.size).toBe(0);
});

test("EventBus.listen reset option accepts array of event kinds and resets sequence tracking", () => {
	const s = EventBus.make<TestSchema>();
	let sequenceFiredCount = 0;

	EventBus.listen(s, ["A", "B"], { ordered: true, reset: ["ResetEvent", "C"] }).tap(() => {
		sequenceFiredCount++;
	});

	// Send A
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	// Send C (in reset array)
	EventBus.emit(s, { kind: "C", value: { flag: true } });
	// Send B -> should not fire because sequence was reset by C
	EventBus.emit(s, { kind: "B", value: { text: "after reset" } });

	expect(sequenceFiredCount).toBe(0);
});

test("EventBus.listen reset option accepts single string and resets sequence tracking", () => {
	const s = EventBus.make<TestSchema>();
	let sequenceFiredCount = 0;

	EventBus.listen(s, ["A", "B"], { ordered: true, reset: "C" }).tap(() => {
		sequenceFiredCount++;
	});

	// Send A
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	// Send C (single reset string)
	EventBus.emit(s, { kind: "C", value: { flag: true } });
	// Send B -> should not fire because sequence was reset by C
	EventBus.emit(s, { kind: "B", value: { text: "after reset" } });

	expect(sequenceFiredCount).toBe(0);
});

test("EventBus.listen relaxed ordered sequence resets correctly when event from eventList is received out of order", () => {
	const s = EventBus.make<TestSchema>();
	let count = 0;

	EventBus.listen(s, ["A", "B", "C"], { ordered: true }).tap(() => {
		count++;
	});

	// Emit A then A then B then C -> the second A resets sequenceIndex to 1, then B -> 2, C -> fires
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "A", value: { value: 2 } });
	EventBus.emit(s, { kind: "B", value: { text: "b" } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });
	expect(count).toBe(1);

	// Emit A then C (not B) -> sequenceIndex becomes 0 because C !== A
	count = 0;
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });
	EventBus.emit(s, { kind: "B", value: { text: "b" } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });
	expect(count).toBe(0);
});

test("EventBus.listen ordered sequence matches when an optional step is present", () => {
	const s = EventBus.make<TestSchema>();
	let count = 0;

	EventBus.listen(s, ["A", "B", "C"], { ordered: true, optional: "B" }).tap(() => {
		count++;
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "B", value: { text: "present" } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });

	expect(count).toBe(1);
});

test("EventBus.listen ordered sequence matches when an optional step is skipped", () => {
	const s = EventBus.make<TestSchema>();
	let count = 0;

	EventBus.listen(s, ["A", "B", "C"], { ordered: true, optional: ["B"] }).tap(() => {
		count++;
	});

	// A -> C (skipping optional B)
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });

	expect(count).toBe(1);
});

// --- EventBus.forward ---

test("EventBus.forward pipes messages from source event bus to target event bus", () => {
	const s1 = EventBus.make<TestSchema>();
	const s2 = EventBus.make<TestSchema>();

	let s2Received: string | null = null;

	EventBus.listen(s2, "B").tap((msg) => {
		if (msg.kind === "B") {
			s2Received = msg.value.text;
		}
	});

	const disconnect = EventBus.forward({ from: s1, to: s2, only: ["B"] });

	// A is filtered out by 'only'
	EventBus.emit(s1, { kind: "A", value: { value: 100 } });
	expect(s2Received).toBeNull();

	// B is forwarded
	EventBus.emit(s1, { kind: "B", value: { text: "forwarded" } });
	expect(s2Received).toBe("forwarded");

	disconnect();
	EventBus.emit(s1, { kind: "B", value: { text: "after disconnect" } });
	expect(s2Received).toBe("forwarded");
});

test("EventBus.forward pipes messages to multiple target event buses", () => {
	const s1 = EventBus.make<TestSchema>();
	const s2 = EventBus.make<TestSchema>();
	const s3 = EventBus.make<TestSchema>();
	let count2 = 0;
	let count3 = 0;

	EventBus.listen(s2, "A").tap(() => {
		count2++;
	});
	EventBus.listen(s3, "A").tap(() => {
		count3++;
	});

	const disconnect = EventBus.forward({ from: s1, to: [s2, s3] });
	EventBus.emit(s1, { kind: "A", value: { value: 1 } });

	expect(count2).toBe(1);
	expect(count3).toBe(1);

	disconnect();
});
