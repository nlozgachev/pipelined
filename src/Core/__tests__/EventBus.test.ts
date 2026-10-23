import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { EventBus } from "../EventBus.ts";

type TestSchema = {
	A: { value: number; };
	B: { text: string; };
	C: { flag: boolean; };
	ResetEvent: { reason: string; };
};

// --- EventBus.make ---

test("make: creates an opaque event bus instance with no public properties", () => {
	const s = EventBus.make<TestSchema>({ name: "test-bus" });
	expect(Object.keys(s)).toStrictEqual([]);
	expect(Reflect.ownKeys(s).filter((k) => typeof k === "string")).toStrictEqual([]);
});

// --- EventBus.emit ---

test("emit: dispatches messages to subscribers", () => {
	const s = EventBus.make<TestSchema>();
	let received: EventBus.Message<TestSchema> | null = null;

	EventBus.listen(s, "A").tap((msg) => {
		received = msg;
	});

	EventBus.emit(s, { kind: "A", value: { value: 42 } });

	expect(received).toStrictEqual({ kind: "A", value: { value: 42 } });
});

test("emit: broadcasts to multiple target event buses", () => {
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

test("emit: passes errors to onError option handler if provided", () => {
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

test("emit: throws error if listener throws and no onError handler is provided", () => {
	const s = EventBus.make<TestSchema>();
	EventBus.listen(s, "A").tap(() => {
		throw new Error("uncaught error");
	});

	expect(() => EventBus.emit(s, { kind: "A", value: { value: 1 } })).toThrow("uncaught error");
});

// --- Re-entrant Emissions & Trampoline Queue ---

test("emit: processes re-entrant emissions breadth-first", () => {
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

test("emit: processes deep re-entrant emission cascades without stack overflow", () => {
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

test("listen: accumulates state over matching events with reduce", () => {
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

test("listen: unsubscribes after first reduction when once is true", () => {
	const s = EventBus.make<TestSchema>();
	const sub = EventBus.listen(s, "A", { once: true }).reduce((_msg, state) => ({ count: state.count + 1 }), {
		count: 0,
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "A", value: { value: 2 } });

	expect(sub.getState()).toStrictEqual({ count: 1 });
});

test("listen: returns an unsubscribe function that removes the listener from tap", () => {
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
});

// --- Sequence options ---

test("listen: matches sequence in exact order with ordered", () => {
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

test("listen: resets sequence on unexpected event with strict", () => {
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

test("listen: resets sequence to index 1 when unexpected event matches first event in sequence", () => {
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

test("listen: resets relaxed sequence to index 0 when out-of-order event in eventList arrives", () => {
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

test("listen: skips optional events in sequence when next event matches", () => {
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

test("listen: resets relaxed sequence to index 1 when out-of-order event matches eventList[0]", () => {
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

test("listen: ignores lookahead if unexpected event does not match after optional items", () => {
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

test("listen: ignores events not present in eventList in relaxed sequence", () => {
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

test("listen: automatically unsubscribes after first match with once", () => {
	const s = EventBus.make<TestSchema>();
	let fireCount = 0;

	EventBus.listen(s, "A", { once: true }).tap(() => {
		fireCount++;
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "A", value: { value: 2 } });

	expect(fireCount).toBe(1);
});

test("listen: accepts array of event kinds and resets sequence tracking", () => {
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

test("listen: accepts single string and resets sequence tracking", () => {
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

test("listen: resets correctly when event from eventList is received out of order", () => {
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

test("listen: matches sequence when an optional step is present", () => {
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

test("listen: matches sequence when an optional step is skipped", () => {
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

test("forward: pipes messages from source to target event bus", () => {
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

test("forward: pipes messages to multiple target event buses", () => {
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

// --- Type Narrowing & Safe Indexing ---

test("listen: narrows msg.kind to listened keys in reduce", () => {
	const s = EventBus.make<TestSchema>();
	const memo: { A: number; B: number; } = { A: 10, B: 20 };
	const matchedValues: number[] = [];

	EventBus.listen(s, ["A", "B"]).reduce((msg, state) => {
		// Safe indexing without type errors because msg.kind is narrowed to "A" | "B"
		const val = memo[msg.kind];
		matchedValues.push(val);
		return state;
	}, 0);

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "B", value: { text: "hello" } });

	expect(matchedValues).toStrictEqual([10, 20]);
});

test("listen: narrows msg.kind to listened keys in tap", () => {
	const s = EventBus.make<TestSchema>();
	let receivedKind: "A" | null = null;

	EventBus.listen(s, "A").tap((msg) => {
		receivedKind = msg.kind;
	});

	EventBus.emit(s, { kind: "A", value: { value: 42 } });
	expect(receivedKind).toBe("A");
});

// --- EventBus.listen & collect ---

test("collect: delivers completed payload snapshot in ordered sequence", () => {
	const s = EventBus.make<TestSchema>();
	const snapshots: Array<{ A: { value: number; }; B: { text: string; }; }> = [];

	EventBus.listen(s, ["A", "B"], { ordered: true }).collect((payloads) => {
		snapshots.push(payloads);
	});

	// Out of order: B alone does not fire
	EventBus.emit(s, { kind: "B", value: { text: "early" } });
	expect(snapshots).toStrictEqual([]);

	// A followed by B fires with composite snapshot
	EventBus.emit(s, { kind: "A", value: { value: 10 } });
	expect(snapshots).toStrictEqual([]);

	EventBus.emit(s, { kind: "B", value: { text: "first" } });
	expect(snapshots).toStrictEqual([{ A: { value: 10 }, B: { text: "first" } }]);

	// Consecutive sequence fires again with fresh snapshot
	EventBus.emit(s, { kind: "A", value: { value: 20 } });
	EventBus.emit(s, { kind: "B", value: { text: "second" } });
	expect(snapshots).toStrictEqual([{ A: { value: 10 }, B: { text: "first" } }, {
		A: { value: 20 },
		B: { text: "second" },
	}]);
});

test("collect: clears buffer on strict mismatch", () => {
	const s = EventBus.make<TestSchema>();
	let fired = 0;

	EventBus.listen(s, ["A", "B"], { ordered: true, strict: true }).collect(() => {
		fired++;
	});

	// A -> C (intervening event in strict mode resets buffer and index) -> B
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });
	EventBus.emit(s, { kind: "B", value: { text: "b" } });
	expect(fired).toBe(0);

	// Now consecutive sequence completes
	EventBus.emit(s, { kind: "A", value: { value: 2 } });
	EventBus.emit(s, { kind: "B", value: { text: "b2" } });
	expect(fired).toBe(1);
});

test("collect: updates buffer when unexpected event matches step 0", () => {
	const s = EventBus.make<TestSchema>();
	let captured: { A: { value: number; }; B: { text: string; }; } | null = null;

	EventBus.listen(s, ["A", "B"], { ordered: true, strict: true }).collect((payloads) => {
		captured = payloads;
	});

	// A (val 1) -> A (val 2, resets sequence to index 1 with new val) -> B
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "A", value: { value: 2 } });
	EventBus.emit(s, { kind: "B", value: { text: "match" } });

	expect(captured).toStrictEqual({ A: { value: 2 }, B: { text: "match" } });
});

test("collect: resets buffer when reset event arrives", () => {
	const s = EventBus.make<TestSchema>();
	let fired = 0;

	EventBus.listen(s, ["A", "B"], { ordered: true, reset: "ResetEvent" }).collect(() => {
		fired++;
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "ResetEvent", value: { reason: "abort" } });
	EventBus.emit(s, { kind: "B", value: { text: "after reset" } });

	expect(fired).toBe(0);
});

test("collect: skips optional step and sets its value to undefined", () => {
	const s = EventBus.make<TestSchema>();
	let captured: { A: { value: number; }; C: { flag: boolean; }; B?: { text: string; }; } | null = null;

	EventBus.listen(s, ["A", "B", "C"], { ordered: true, optional: ["B"] }).collect((payloads) => {
		captured = payloads;
	});

	// A -> C (skipping optional B)
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });

	expect(captured).toStrictEqual({ A: { value: 1 }, C: { flag: true } });
	expect((captured as any)?.B).toBeUndefined();
});

test("collect: safely handles __proto__ event kind without prototype pollution", () => {
	type ProtoSchema = { __proto__: { injected: string; }; normal: { data: number; }; };
	const s = EventBus.make<ProtoSchema>();
	let received: unknown = null;

	EventBus.listen(s, ["__proto__", "normal"] as any).collect((payloads) => {
		received = payloads;
	});

	EventBus.emit(s, { kind: "__proto__", value: { injected: "polluted" } } as any);
	EventBus.emit(s, { kind: "normal", value: { data: 123 } });

	expect(received).toBeDefined();
	expect(({} as any).injected).toBeUndefined();
	expect(Object.hasOwn(received as object, "__proto__")).toBe(true);
});

test("collect: captures optional step when present in sequence", () => {
	const s = EventBus.make<TestSchema>();
	let captured: { A: { value: number; }; C: { flag: boolean; }; B?: { text: string; }; } | null = null;

	EventBus.listen(s, ["A", "B", "C"], { ordered: true, optional: "B" }).collect((payloads) => {
		captured = payloads;
	});

	// A -> B -> C (optional B is present)
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "B", value: { text: "present" } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });

	expect(captured).toStrictEqual({ A: { value: 1 }, B: { text: "present" }, C: { flag: true } });
});

test("collect: unsubscribes after first completion with once option", () => {
	const s = EventBus.make<TestSchema>();
	let count = 0;

	EventBus.listen(s, ["A", "B"], { ordered: true, once: true }).collect(() => {
		count++;
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "B", value: { text: "1" } });
	expect(count).toBe(1);

	EventBus.emit(s, { kind: "A", value: { value: 2 } });
	EventBus.emit(s, { kind: "B", value: { text: "2" } });
	expect(count).toBe(1);
});

test("collect: aggregates unordered events once all required have arrived", () => {
	const s = EventBus.make<TestSchema>();
	let captured: { A: { value: number; }; B: { text: string; }; } | null = null;

	EventBus.listen(s, ["A", "B"]).collect((payloads) => {
		captured = payloads;
	});

	// B arrives first
	EventBus.emit(s, { kind: "B", value: { text: "first" } });
	expect(captured).toBeNull();

	// A arrives second -> fires!
	EventBus.emit(s, { kind: "A", value: { value: 42 } });
	expect(captured).toStrictEqual({ A: { value: 42 }, B: { text: "first" } });
});

test("collect: unsubscribes after first completion in unordered mode with once option", () => {
	const s = EventBus.make<TestSchema>();
	let count = 0;

	EventBus.listen(s, ["A", "B"], { once: true }).collect(() => {
		count++;
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "B", value: { text: "1" } });
	expect(count).toBe(1);

	EventBus.emit(s, { kind: "A", value: { value: 2 } });
	EventBus.emit(s, { kind: "B", value: { text: "2" } });
	expect(count).toBe(1);
});

test("collect: supports optional events in unordered mode", () => {
	const s = EventBus.make<TestSchema>();
	let captured: { A: { value: number; }; B?: { text: string; }; C: { flag: boolean; }; } | null = null;

	EventBus.listen(s, ["A", "B", "C"], { optional: ["B"] }).collect((payloads) => {
		captured = payloads;
	});

	// Emitting only A and C satisfies all required events in unordered mode
	EventBus.emit(s, { kind: "A", value: { value: 10 } });
	expect(captured).toBeNull();

	EventBus.emit(s, { kind: "C", value: { flag: true } });
	expect(captured).toStrictEqual({ A: { value: 10 }, C: { flag: true } });
});

test("collect: ignores lookahead mismatch when unexpected event arrives after optional item", () => {
	const s = EventBus.make<TestSchema>();
	let captured: { A: { value: number; }; B?: { text: string; }; C: { flag: boolean; }; } | null = null;

	EventBus.listen(s, ["A", "B", "C"], { ordered: true, optional: ["B"] }).collect((payloads) => {
		captured = payloads;
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	// ResetEvent is not in lookahead; sequence should not fire
	EventBus.emit(s, { kind: "ResetEvent", value: { reason: "test" } });
	expect(captured).toBeNull();
});

test("collect: ignores irrelevant events in relaxed ordered sequence", () => {
	const s = EventBus.make<TestSchema>();
	let captured: { A: { value: number; }; B: { text: string; }; } | null = null;

	EventBus.listen(s, ["A", "B"], { ordered: true, strict: false }).collect((payloads) => {
		captured = payloads;
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	// C is not in eventList and ignored in relaxed mode
	EventBus.emit(s, { kind: "C", value: { flag: true } });
	expect(captured).toBeNull();

	EventBus.emit(s, { kind: "B", value: { text: "after C" } });
	expect(captured).toStrictEqual({ A: { value: 1 }, B: { text: "after C" } });
});

test("collect: ignores non-matching events in unordered mode", () => {
	const s = EventBus.make<TestSchema>();
	let captured: { A: { value: number; }; B: { text: string; }; } | null = null;

	EventBus.listen(s, ["A", "B"]).collect((payloads) => {
		captured = payloads;
	});

	// C is not in eventList and ignored
	EventBus.emit(s, { kind: "C", value: { flag: true } });
	expect(captured).toBeNull();

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "B", value: { text: "b" } });
	expect(captured).toStrictEqual({ A: { value: 1 }, B: { text: "b" } });
});

test("collect: resets relaxed sequence to step 1 when out-of-order event matches step 0", () => {
	const s = EventBus.make<TestSchema>();
	let captured: { A: { value: number; }; B: { text: string; }; C: { flag: boolean; }; } | null = null;

	// A -> B -> A -> B -> C in relaxed mode
	EventBus.listen(s, ["A", "B", "C"], { ordered: true, strict: false }).collect((payloads) => {
		captured = payloads;
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "B", value: { text: "1" } });
	// Out-of-order A resets sequence to 1 and buffer to { A: 2 }
	EventBus.emit(s, { kind: "A", value: { value: 2 } });
	EventBus.emit(s, { kind: "B", value: { text: "2" } });
	EventBus.emit(s, { kind: "C", value: { flag: true } });

	expect(captured).toStrictEqual({ A: { value: 2 }, B: { text: "2" }, C: { flag: true } });
});

test("collect: returns an unsubscribe function that removes the listener", () => {
	const s = EventBus.make<TestSchema>();
	let count = 0;

	const unsubscribe = EventBus.listen(s, ["A", "B"]).collect(() => {
		count++;
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "B", value: { text: "1" } });
	expect(count).toBe(1);

	unsubscribe();

	EventBus.emit(s, { kind: "A", value: { value: 2 } });
	EventBus.emit(s, { kind: "B", value: { text: "2" } });
	expect(count).toBe(1);
});

// --- Once Lifecycle, Concurrency & Edge Cases ---

test("listen: ensures once listener stays unsubscribed when callback throws under onError", () => {
	let caught = 0;
	const s = EventBus.make<TestSchema>({
		onError: () => {
			caught++;
		},
	});
	let executions = 0;

	EventBus.listen(s, "A", { once: true }).tap(() => {
		executions++;
		throw new Error("once error");
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	expect(caught).toBe(1);
	expect(executions).toBe(1);

	// Second emission must NOT trigger the once listener again
	EventBus.emit(s, { kind: "A", value: { value: 2 } });
	expect(caught).toBe(1);
	expect(executions).toBe(1);
});

test("listen: unsubscribes once listener before executing callback to prevent re-entrant loops", () => {
	const s = EventBus.make<TestSchema>();
	let executions = 0;

	EventBus.listen(s, "A", { once: true }).tap(() => {
		executions++;
		EventBus.emit(s, { kind: "A", value: { value: 99 } });
	});

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	expect(executions).toBe(1);
});

test("emit: discards pending queue when listener throws uncaught error", () => {
	const s = EventBus.make<TestSchema>();
	let secondaryReceived = false;

	EventBus.listen(s, "A").tap(() => {
		EventBus.emit(s, { kind: "B", value: { text: "queued" } });
		throw new Error("uncaught in emit");
	});

	EventBus.listen(s, "B").tap(() => {
		secondaryReceived = true;
	});

	expect(() => EventBus.emit(s, { kind: "A", value: { value: 1 } })).toThrow("uncaught in emit");

	// A new emission should not run stale queued events from the crashed emission
	EventBus.emit(s, { kind: "C", value: { flag: true } });
	expect(secondaryReceived).toBe(false);
});

test("listen: skips multiple consecutive optional steps in ordered sequence", () => {
	const s = EventBus.make<TestSchema>();
	let fired = 0;

	EventBus.listen(s, ["A", "B", "C", "ResetEvent"], { ordered: true, optional: ["B", "C"] }).tap(() => {
		fired++;
	});

	// Emit A then ResetEvent directly (skipping consecutive optional B and C)
	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	EventBus.emit(s, { kind: "ResetEvent", value: { reason: "skip-both" } });

	expect(fired).toBe(1);
});

test("emit: handles empty target array as safe no-op", () => {
	expect(() => {
		EventBus.emit([], { kind: "A", value: { value: 1 } });
	}).not.toThrow();
});

test("listen: unsubscribe is idempotent and safe when invoked repeatedly", () => {
	const s = EventBus.make<TestSchema>();
	let count = 0;
	const unsubTap = EventBus.listen(s, "A").tap(() => {
		count++;
	});
	const subReduce = EventBus.listen(s, "A").reduce((_, n) => n + 1, 0);

	unsubTap();
	unsubTap();
	subReduce.unsubscribe();
	subReduce.unsubscribe();

	EventBus.emit(s, { kind: "A", value: { value: 1 } });
	expect(count).toBe(0);
	expect(subReduce.getState()).toBe(0);
});

test("composition: integrates with pipe to process messages", () => {
	const s = EventBus.make<TestSchema>();
	const states: number[] = [];

	const sub = EventBus.listen(s, "A").reduce((msg, current) => current + msg.value.value, 0);

	pipe([10, 20, 30], (nums) => nums.map((n) => ({ kind: "A" as const, value: { value: n } })), (messages) => {
		for (let i = 0; i < messages.length; i++) {
			EventBus.emit(s, messages[i]);
			states.push(sub.getState());
		}
	});

	expect(states).toStrictEqual([10, 30, 60]);
	sub.unsubscribe();
});
