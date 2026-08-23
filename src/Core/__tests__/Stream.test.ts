import { expect, test } from "vitest";
import { Stream } from "../Stream.ts";

type TestSchema = {
	A: { value: number; };
	B: { text: string; };
	C: { flag: boolean; };
	ResetEvent: { reason: string; };
};

// --- Stream.make ---

test("Stream.make creates a stream instance", () => {
	const s = Stream.make<TestSchema>({ name: "test-stream" });
	expect(s.options?.name).toBe("test-stream");
	expect(s._listeners.size).toBe(0);
});

// --- Stream.emit ---

test("Stream.emit dispatches messages to subscribers", () => {
	const s = Stream.make<TestSchema>();
	let received: Stream.Message<TestSchema> | null = null;

	Stream.listen(s, "A").tap((msg) => {
		received = msg;
	});

	Stream.emit(s, { kind: "A", value: { value: 42 } });

	expect(received).toStrictEqual({ kind: "A", value: { value: 42 } });
});

test("Stream.emit broadcasts to multiple target streams", () => {
	const s1 = Stream.make<TestSchema>();
	const s2 = Stream.make<TestSchema>();

	let s1Count = 0;
	let s2Count = 0;

	Stream.listen(s1, "A").tap(() => {
		s1Count++;
	});
	Stream.listen(s2, "A").tap(() => {
		s2Count++;
	});

	Stream.emit([s1, s2], { kind: "A", value: { value: 10 } });

	expect(s1Count).toBe(1);
	expect(s2Count).toBe(1);
});

test("Stream.emit passes errors to onError option handler if provided", () => {
	let caughtError: unknown = null;
	const s = Stream.make<TestSchema>({
		onError: (err) => {
			caughtError = err;
		},
	});

	Stream.listen(s, "A").tap(() => {
		throw new Error("listener error");
	});

	Stream.emit(s, { kind: "A", value: { value: 1 } });
	expect(caughtError).toBeInstanceOf(Error);
	expect((caughtError as Error).message).toBe("listener error");
});

test("Stream.emit throws error if listener throws and no onError handler is provided", () => {
	const s = Stream.make<TestSchema>();
	Stream.listen(s, "A").tap(() => {
		throw new Error("uncaught error");
	});

	expect(() => Stream.emit(s, { kind: "A", value: { value: 1 } })).toThrow("uncaught error");
});

// --- Re-entrant Emissions & Trampoline Queue ---

test("Stream.emit processes re-entrant emissions breadth-first", () => {
	const s = Stream.make<TestSchema>();
	const log: string[] = [];

	Stream.listen(s, "A").tap(() => {
		log.push("L1: A");
		Stream.emit(s, { kind: "B", value: { text: "from L1" } });
	});

	Stream.listen(s, "A").tap(() => {
		log.push("L2: A");
	});

	Stream.listen(s, "B").tap(() => {
		log.push("L3: B");
	});

	Stream.emit(s, { kind: "A", value: { value: 1 } });

	// Breadth-first: L2 receives A before L3 receives B
	expect(log).toStrictEqual(["L1: A", "L2: A", "L3: B"]);
});

test("Stream.emit processes deep re-entrant emission cascades without stack overflow", () => {
	const s = Stream.make<TestSchema>();
	let count = 0;

	Stream.listen(s, "A").tap(() => {
		count++;
		if (count < 1000) {
			Stream.emit(s, { kind: "A", value: { value: count } });
		}
	});

	Stream.emit(s, { kind: "A", value: { value: 0 } });
	expect(count).toBe(1000);
});

// --- Stream.listen & reduce / tap ---

test("Stream.listen reduce accumulates state over matching events", () => {
	const s = Stream.make<TestSchema>();

	const sub = Stream.listen(s, ["A", "B"]).reduce((msg, state) => {
		if (msg.kind === "A") {
			return { ...state, sum: state.sum + msg.value.value };
		}
		if (msg.kind === "B") {
			return { ...state, texts: [...state.texts, msg.value.text] };
		}
		return state;
	}, { sum: 0, texts: [] as string[] });

	expect(sub.getState()).toStrictEqual({ sum: 0, texts: [] });

	Stream.emit(s, { kind: "A", value: { value: 5 } });
	expect(sub.getState()).toStrictEqual({ sum: 5, texts: [] });

	Stream.emit(s, { kind: "B", value: { text: "first" } });
	expect(sub.getState()).toStrictEqual({ sum: 5, texts: ["first"] });

	sub.unsubscribe();
	Stream.emit(s, { kind: "A", value: { value: 10 } });
	expect(sub.getState()).toStrictEqual({ sum: 5, texts: ["first"] });
});

test("Stream.listen reduce with once: true unsubscribes after first reduction", () => {
	const s = Stream.make<TestSchema>();
	const sub = Stream.listen(s, "A", { once: true }).reduce((_msg, state) => ({ count: state.count + 1 }), { count: 0 });

	Stream.emit(s, { kind: "A", value: { value: 1 } });
	Stream.emit(s, { kind: "A", value: { value: 2 } });

	expect(sub.getState()).toStrictEqual({ count: 1 });
	expect(s._listeners.size).toBe(0);
});

test("Stream.listen tap returns an unsubscribe function that removes the listener", () => {
	const s = Stream.make<TestSchema>();
	let count = 0;
	const unsubscribe = Stream.listen(s, "A").tap(() => {
		count++;
	});

	Stream.emit(s, { kind: "A", value: { value: 1 } });
	expect(count).toBe(1);

	unsubscribe();
	Stream.emit(s, { kind: "A", value: { value: 2 } });
	expect(count).toBe(1);
	expect(s._listeners.size).toBe(0);
});

// --- Sequence options ---

test("Stream.listen ordered matches sequence in exact order", () => {
	const s = Stream.make<TestSchema>();
	let sequenceFiredCount = 0;

	Stream.listen(s, ["A", "B"], { ordered: true }).tap(() => {
		sequenceFiredCount++;
	});

	// B before A should not trigger sequence completion
	Stream.emit(s, { kind: "B", value: { text: "early" } });
	expect(sequenceFiredCount).toBe(0);

	// A followed by B should trigger sequence completion
	Stream.emit(s, { kind: "A", value: { value: 1 } });
	expect(sequenceFiredCount).toBe(0);

	Stream.emit(s, { kind: "B", value: { text: "after A" } });
	expect(sequenceFiredCount).toBe(1);
});

test("Stream.listen strict resets sequence on unexpected event", () => {
	const s = Stream.make<TestSchema>();
	let sequenceFiredCount = 0;

	Stream.listen(s, ["A", "B"], { ordered: true, strict: true }).tap(() => {
		sequenceFiredCount++;
	});

	// Send A
	Stream.emit(s, { kind: "A", value: { value: 1 } });
	// Send non-matching event C in strict mode -> resets sequence
	Stream.emit(s, { kind: "C", value: { flag: true } });
	// Send B -> should not fire because sequence was reset
	Stream.emit(s, { kind: "B", value: { text: "test" } });

	expect(sequenceFiredCount).toBe(0);

	// Now valid consecutive sequence A -> B
	Stream.emit(s, { kind: "A", value: { value: 2 } });
	Stream.emit(s, { kind: "B", value: { text: "consecutive" } });

	expect(sequenceFiredCount).toBe(1);
});

test("Stream.listen sequence resets to index 1 when unexpected event matches first event in sequence", () => {
	const s = Stream.make<TestSchema>();
	let firedCount = 0;

	Stream.listen(s, ["A", "B"], { ordered: true, strict: true }).tap(() => {
		firedCount++;
	});

	// A -> A -> B (second A resets sequence index to 1, then B completes sequence)
	Stream.emit(s, { kind: "A", value: { value: 1 } });
	Stream.emit(s, { kind: "A", value: { value: 2 } });
	Stream.emit(s, { kind: "B", value: { text: "match" } });

	expect(firedCount).toBe(1);
});

test("Stream.listen relaxed sequence resets to index 0 when out-of-order event in eventList arrives", () => {
	const s = Stream.make<TestSchema>();
	let firedCount = 0;

	Stream.listen(s, ["A", "B", "C"], { ordered: true, strict: false }).tap(() => {
		firedCount++;
	});

	// A -> B -> B -> C (second B resets sequence index to 0 because B is in eventList but not A)
	Stream.emit(s, { kind: "A", value: { value: 1 } });
	Stream.emit(s, { kind: "B", value: { text: "1" } });
	Stream.emit(s, { kind: "B", value: { text: "2" } });
	Stream.emit(s, { kind: "C", value: { flag: true } });

	expect(firedCount).toBe(0);
});

test("Stream.listen optional skips optional events in sequence when next event matches", () => {
	const s = Stream.make<TestSchema>();
	let fired = 0;

	// B is optional in sequence A -> B -> C
	Stream.listen(s, ["A", "B", "C"], { ordered: true, optional: ["B"] }).tap(() => {
		fired++;
	});

	// Emit A -> C directly (skipping optional B)
	Stream.emit(s, { kind: "A", value: { value: 1 } });
	Stream.emit(s, { kind: "C", value: { flag: true } });

	expect(fired).toBe(1);
});

test("Stream.listen relaxed sequence resets to index 1 when out-of-order event matches eventList[0]", () => {
	const s = Stream.make<TestSchema>();
	let firedCount = 0;

	Stream.listen(s, ["A", "B", "C"], { ordered: true, strict: false }).tap(() => {
		firedCount++;
	});

	// A -> B -> A -> B -> C
	Stream.emit(s, { kind: "A", value: { value: 1 } });
	Stream.emit(s, { kind: "B", value: { text: "1" } });
	Stream.emit(s, { kind: "A", value: { value: 2 } });
	Stream.emit(s, { kind: "B", value: { text: "2" } });
	Stream.emit(s, { kind: "C", value: { flag: true } });

	expect(firedCount).toBe(1);
});

test("Stream.listen once automatically unsubscribes after first match", () => {
	const s = Stream.make<TestSchema>();
	let fireCount = 0;

	Stream.listen(s, "A", { once: true }).tap(() => {
		fireCount++;
	});

	Stream.emit(s, { kind: "A", value: { value: 1 } });
	Stream.emit(s, { kind: "A", value: { value: 2 } });

	expect(fireCount).toBe(1);
	expect(s._listeners.size).toBe(0);
});

test("Stream.listen reset option accepts array of event kinds and resets sequence tracking", () => {
	const s = Stream.make<TestSchema>();
	let sequenceFiredCount = 0;

	Stream.listen(s, ["A", "B"], { ordered: true, reset: ["ResetEvent", "C"] }).tap(() => {
		sequenceFiredCount++;
	});

	// Send A
	Stream.emit(s, { kind: "A", value: { value: 1 } });
	// Send C (in reset array)
	Stream.emit(s, { kind: "C", value: { flag: true } });
	// Send B -> should not fire because sequence was reset by C
	Stream.emit(s, { kind: "B", value: { text: "after reset" } });

	expect(sequenceFiredCount).toBe(0);
});

test("Stream.listen reset option accepts single string and resets sequence tracking", () => {
	const s = Stream.make<TestSchema>();
	let sequenceFiredCount = 0;

	Stream.listen(s, ["A", "B"], { ordered: true, reset: "C" }).tap(() => {
		sequenceFiredCount++;
	});

	// Send A
	Stream.emit(s, { kind: "A", value: { value: 1 } });
	// Send C (single reset string)
	Stream.emit(s, { kind: "C", value: { flag: true } });
	// Send B -> should not fire because sequence was reset by C
	Stream.emit(s, { kind: "B", value: { text: "after reset" } });

	expect(sequenceFiredCount).toBe(0);
});

test("Stream.listen relaxed ordered sequence resets correctly when event from eventList is received out of order", () => {
	const s = Stream.make<TestSchema>();
	let count = 0;

	Stream.listen(s, ["A", "B", "C"], { ordered: true }).tap(() => {
		count++;
	});

	// Emit A then A then B then C -> the second A resets sequenceIndex to 1, then B -> 2, C -> fires
	Stream.emit(s, { kind: "A", value: { value: 1 } });
	Stream.emit(s, { kind: "A", value: { value: 2 } });
	Stream.emit(s, { kind: "B", value: { text: "b" } });
	Stream.emit(s, { kind: "C", value: { flag: true } });
	expect(count).toBe(1);

	// Emit A then C (not B) -> sequenceIndex becomes 0 because C !== A
	count = 0;
	Stream.emit(s, { kind: "A", value: { value: 1 } });
	Stream.emit(s, { kind: "C", value: { flag: true } });
	Stream.emit(s, { kind: "B", value: { text: "b" } });
	Stream.emit(s, { kind: "C", value: { flag: true } });
	expect(count).toBe(0);
});

test("Stream.listen ordered sequence matches when an optional step is present", () => {
	const s = Stream.make<TestSchema>();
	let count = 0;

	Stream.listen(s, ["A", "B", "C"], { ordered: true, optional: "B" }).tap(() => {
		count++;
	});

	Stream.emit(s, { kind: "A", value: { value: 1 } });
	Stream.emit(s, { kind: "B", value: { text: "present" } });
	Stream.emit(s, { kind: "C", value: { flag: true } });

	expect(count).toBe(1);
});

test("Stream.listen ordered sequence matches when an optional step is skipped", () => {
	const s = Stream.make<TestSchema>();
	let count = 0;

	Stream.listen(s, ["A", "B", "C"], { ordered: true, optional: ["B"] }).tap(() => {
		count++;
	});

	// A -> C (skipping optional B)
	Stream.emit(s, { kind: "A", value: { value: 1 } });
	Stream.emit(s, { kind: "C", value: { flag: true } });

	expect(count).toBe(1);
});

// --- Stream.forward ---

test("Stream.forward pipes messages from source stream to target stream", () => {
	const s1 = Stream.make<TestSchema>();
	const s2 = Stream.make<TestSchema>();

	let s2Received: string | null = null;

	Stream.listen(s2, "B").tap((msg) => {
		if (msg.kind === "B") {
			s2Received = msg.value.text;
		}
	});

	const disconnect = Stream.forward({ from: s1, to: s2, only: ["B"] });

	// A is filtered out by 'only'
	Stream.emit(s1, { kind: "A", value: { value: 100 } });
	expect(s2Received).toBeNull();

	// B is forwarded
	Stream.emit(s1, { kind: "B", value: { text: "forwarded" } });
	expect(s2Received).toBe("forwarded");

	disconnect();
	Stream.emit(s1, { kind: "B", value: { text: "after disconnect" } });
	expect(s2Received).toBe("forwarded");
});

test("Stream.forward pipes messages to multiple target streams", () => {
	const s1 = Stream.make<TestSchema>();
	const s2 = Stream.make<TestSchema>();
	const s3 = Stream.make<TestSchema>();
	let count2 = 0;
	let count3 = 0;

	Stream.listen(s2, "A").tap(() => {
		count2++;
	});
	Stream.listen(s3, "A").tap(() => {
		count3++;
	});

	const disconnect = Stream.forward({ from: s1, to: [s2, s3] });
	Stream.emit(s1, { kind: "A", value: { value: 1 } });

	expect(count2).toBe(1);
	expect(count3).toBe(1);

	disconnect();
});
