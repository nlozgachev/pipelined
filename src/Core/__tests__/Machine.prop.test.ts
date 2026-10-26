import fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Machine } from "../Machine.ts";

// =============================================================================
// Counter Machine Model for Property Verification
// =============================================================================

type CounterState =
	| Machine.State<"zero", void, "positive" | "negative">
	| Machine.State<"positive", { readonly count: number; }, "positive" | "zero">
	| Machine.State<"negative", { readonly count: number; }, "negative" | "zero">;

type CounterEvents = { INC: void; DEC: void; RESET: void; NOOP: void; };

const counterMachine = Machine.make<CounterState, CounterEvents>({
	initial: Machine.state("zero"),
	states: {
		zero: {
			on: {
				INC: () => Machine.state("positive", { count: 1 }),
				DEC: () => Machine.state("negative", { count: -1 }),
				RESET: (s) => s,
			},
		},
		positive: {
			on: {
				INC: (s) => Machine.state("positive", { count: s.value.count + 1 }),
				DEC: (s) =>
					s.value.count - 1 === 0 ? Machine.state("zero") : Machine.state("positive", { count: s.value.count - 1 }),
				RESET: () => Machine.state("zero"),
			},
		},
		negative: {
			on: {
				INC: (s) =>
					s.value.count + 1 === 0 ? Machine.state("zero") : Machine.state("negative", { count: s.value.count + 1 }),
				DEC: (s) => Machine.state("negative", { count: s.value.count - 1 }),
				RESET: () => Machine.state("zero"),
			},
		},
	},
});

const arbEvent = fc.constantFrom<Machine.EventMessage<CounterEvents>>({ kind: "INC" }, { kind: "DEC" }, {
	kind: "RESET",
});

const arbEventsList = fc.array(arbEvent, { maxLength: 50 });

// =============================================================================
// 1. Transition Determinism & Equivalence
// =============================================================================

test("transition: pure reducer matches actor execution for any event sequence", () => {
	fc.assert(fc.property(arbEventsList, (events) => {
		// 1. Compute state via pure transitions
		let pureState: CounterState = counterMachine.initial;
		for (const event of events) {
			pureState = pipe(pureState, Machine.transition(counterMachine, event));
		}

		// 2. Compute state via stateful actor
		const actor = Machine.interpret(counterMachine);
		for (const event of events) {
			actor.send(event);
		}

		expect(actor.getState()).toStrictEqual(pureState);
	}));
});

// =============================================================================
// 2. Identity on Unhandled Events
// =============================================================================

test("transition: preserves state identity on unhandled events", () => {
	const arbState: fc.Arbitrary<CounterState> = fc.integer({ min: -20, max: 20 }).map((n): CounterState => {
		if (n === 0) {
			return Machine.state("zero");
		}
		if (n > 0) {
			return Machine.state("positive", { count: n });
		}
		return Machine.state("negative", { count: n });
	});

	fc.assert(fc.property(arbState, (state) => {
		const result = pipe(state, Machine.transition(counterMachine, { kind: "NOOP" }));
		expect(result).toBe(state);
	}));
});

// =============================================================================
// 3. Exhaustive Matching Invariance
// =============================================================================

test("match: executes the exact case branch corresponding to the state kind", () => {
	const arbCount = fc.integer({ min: 1, max: 1000 });

	fc.assert(fc.property(arbCount, (n) => {
		const pos: CounterState = Machine.state("positive", { count: n });
		const neg: CounterState = Machine.state("negative", { count: -n });
		const zero: CounterState = Machine.state("zero");

		const matcher = Machine.match<CounterState, string>({
			zero: () => "zero",
			positive: (s) => `pos:${s.value.count}`,
			negative: (s) => `neg:${s.value.count}`,
		});

		expect(matcher(pos)).toBe(`pos:${n}`);
		expect(matcher(neg)).toBe(`neg:${-n}`);
		expect(matcher(zero)).toBe("zero");
	}));
});

// =============================================================================
// 4. Idempotence of Abort
// =============================================================================

test("abort: repeatedly calling abort preserves state and remains stopped", () => {
	fc.assert(fc.property(arbEventsList, fc.integer({ min: 1, max: 10 }), (events, abortCalls) => {
		const actor = Machine.interpret(counterMachine);
		for (const event of events) {
			actor.send(event);
		}

		const stateBeforeAbort = actor.getState();

		for (let i = 0; i < abortCalls; i++) {
			actor.abort();
			expect(actor.isRunning()).toBe(false);
			expect(actor.getState()).toStrictEqual(stateBeforeAbort);
		}

		// Further events are ignored
		actor.send({ kind: "INC" });
		expect(actor.getState()).toStrictEqual(stateBeforeAbort);
	}));
});

// =============================================================================
// 5. FIFO Queue Preservation Law
// =============================================================================

test("send: evaluates all dispatched events in strict arrival order", () => {
	fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 50 }), (items) => {
		const recorded: number[] = [];

		type AccumulatorState = Machine.State<"active", { readonly total: number; }>;
		type AccumulatorEvents = { ADD: { readonly amount: number; }; };

		const accMachine = Machine.make<AccumulatorState, AccumulatorEvents>({
			initial: Machine.state("active", { total: 0 }),
			states: {
				active: {
					on: {
						ADD: (s, { amount }) => {
							recorded.push(amount);
							return Machine.state("active", { total: s.value.total + amount });
						},
					},
				},
			},
		});

		const actor = Machine.interpret(accMachine);
		for (const item of items) {
			actor.send({ kind: "ADD", value: { amount: item } });
		}

		expect(recorded).toStrictEqual(items);
		const expectedTotal = items.reduce((acc, x) => acc + x, 0);
		expect(actor.getState().value.total).toBe(expectedTotal);
	}));
});
