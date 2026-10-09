import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";
import { Duration } from "../../Types/Duration.ts";
import { Deferred } from "../Deferred.ts";
import { Op } from "../Op.ts";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Resolves immediately with the input value. */
const immediateOp = Op.create((_signal: AbortSignal) => (n: number) => Promise.resolve(n), { onError: String });

/** Resolves after one microtask tick — genuinely async without a real timer. */
const tickOp = Op.create((_signal: AbortSignal) => (n: number) => Promise.resolve().then(() => n), { onError: String });

/** Promise that never settles — useful for abort() tests on restartable. */
const neverOp = Op.create((_signal: AbortSignal) => (_: number) => new Promise<number>(() => {}), { onError: String });

/**
 * Like neverOp but rejects when the AbortSignal fires.
 * Required for queue abort tests: the queue implementation only resolves the
 * in-flight item's Deferred after execute() settles, so the factory must
 * respect the signal to avoid hanging forever.
 */
const signalNeverOp = Op.create((signal: AbortSignal) => (_: number) =>
	new Promise<number>((res, reject) => {
		signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
	}), { onError: () => "aborted" });

const arbOkOutcome = fc.integer().map((n) => Op.Outcome.make.ok(n) as Op.Outcome<string, number>);
const arbErrOutcome = fc.string().map((s) => Op.Outcome.make.err(s) as Op.Outcome<string, number>);
const arbNilOutcome = fc.constantFrom<Op.NilReason>("aborted", "dropped", "replaced", "evicted").map((r) =>
	Op.Outcome.make.nil(r) as Op.Outcome<string, number>
);
const arbOutcome = fc.oneof(arbOkOutcome, arbErrOutcome, arbNilOutcome);

/** Already-resolved Deferred wrapping an outcome value. */
const settled = <E, A>(o: Op.Outcome<E, A>): Deferred<Op.Outcome<E, A>> => Deferred.from.Promise(Promise.resolve(o));

// ---------------------------------------------------------------------------
// Pure outcome combinators — algebraic laws
// ---------------------------------------------------------------------------

test("map: preserves identity", () => {
	fc.assert(fc.property(arbOutcome, (o) => {
		expect(Op.Outcome.map((x: number) => x)(o)).toStrictEqual(o);
	}));
});

test("map: preserves composition", () => {
	fc.assert(fc.property(arbOutcome, fc.integer(), fc.integer(), (o, a, b) => {
		const f = (x: number) => x + a;
		const g = (x: number) => x * b;
		expect(Op.Outcome.map((x: number) => f(g(x)))(o)).toStrictEqual(Op.Outcome.map(f)(Op.Outcome.map(g)(o)));
	}));
});

test("chain: short-circuits on Err and Nil", () => {
	fc.assert(fc.property(fc.oneof(arbErrOutcome, arbNilOutcome), (o) => {
		expect(Op.Outcome.chain((_: number) => Op.Outcome.make.ok(0))(o)).toBe(o);
	}));
});

test("chain: is associative on Ok", () => {
	fc.assert(fc.property(arbOkOutcome, fc.integer(), (o, threshold) => {
		const f = (x: number): Op.Outcome<string, number> =>
			x > 0 ? Op.Outcome.make.ok(x * 2) : Op.Outcome.make.err("non-positive");
		const g = (x: number): Op.Outcome<string, number> =>
			x > threshold ? Op.Outcome.make.ok(x + 1) : Op.Outcome.make.err("too small");
		expect(Op.Outcome.chain(f)(Op.Outcome.chain(g)(o))).toStrictEqual(
			Op.Outcome.chain((x: number) => Op.Outcome.chain(f)(g(x)))(o),
		);
	}));
});

test("recover: preserves identity on Ok and Nil", () => {
	fc.assert(fc.property(fc.oneof(arbOkOutcome, arbNilOutcome), (o) => {
		expect(Op.Outcome.recover((_: string) => Op.Outcome.make.ok(0))(o)).toBe(o);
	}));
});

test("tap: returns identical outcome reference", () => {
	fc.assert(fc.property(arbOutcome, (o) => {
		expect(Op.Outcome.tap(() => {})(o)).toBe(o);
	}));
});

test("fold: handles all outcome kinds without throwing", () => {
	fc.assert(fc.property(arbOutcome, (o) => {
		const result = Op.Outcome.fold((e: string) => `err:${e}`, (r) => `nil:${r}`, (v: number) => `ok:${v}`)(o);
		expectTypeOf(result).toBeString();
	}));
});

// ---------------------------------------------------------------------------
// Deferred.all & Deferred.race — coordinating Op outcomes
// ---------------------------------------------------------------------------

test("Deferred.all: empty array resolves to empty array", async () => {
	const result = await Deferred.all([]);
	expect(result).toStrictEqual([]);
});

test("Deferred.all: result order matches input order", async () => {
	await fc.assert(fc.asyncProperty(fc.array(arbOutcome, { maxLength: 8 }), async (outcomes) => {
		const results = await Deferred.all(outcomes.map(settled));
		expect(results).toStrictEqual(outcomes);
	}));
});

test("Deferred.all: singleton resolves to deferred outcome", async () => {
	await fc.assert(fc.asyncProperty(arbOutcome, async (o) => {
		const [result] = await Deferred.all([settled(o)]);
		expect(result).toStrictEqual(o);
	}));
});

test("Deferred.race: singleton resolves to deferred outcome", async () => {
	await fc.assert(fc.asyncProperty(arbOutcome, async (o) => {
		const result = await Deferred.race([settled(o)]);
		expect(result).toStrictEqual(o);
	}));
});

test("Deferred.race: pre-resolved deferred wins regardless of position", async () => {
	await fc.assert(
		fc.asyncProperty(
			arbOutcome,
			fc.integer({ min: 1, max: 5 }),
			fc.integer({ min: 0, max: 4 }),
			async (winner, total, posRaw) => {
				const pos = posRaw % total;
				const deferreds: Deferred<Op.Outcome<string, number>>[] = Array.from(
					{ length: total },
					(_, i) => i === pos ? settled(winner) : Deferred.from.Promise(new Promise<Op.Outcome<string, number>>(() => {})),
				);
				const result = await Deferred.race(deferreds);
				expect(result).toStrictEqual(winner);
			},
		),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — exclusive
// ---------------------------------------------------------------------------

test("interpret: exclusive burst produces exactly 1 Ok and N-1 DroppedNil", async () => {
	await fc.assert(fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
		const manager = Op.interpret(immediateOp, { strategy: "exclusive" });
		const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
		const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
		expect(outcomes.filter(Op.Outcome.is.ok)).toHaveLength(1);
		expect(outcomes.filter((o) => Op.Outcome.is.nil(o) && (o as Op.Nil).reason === "dropped")).toHaveLength(n - 1);
	}));
});

// ---------------------------------------------------------------------------
// Strategy invariants — restartable
// ---------------------------------------------------------------------------

test("interpret: restartable burst produces exactly 1 Ok and N-1 ReplacedNil", async () => {
	await fc.assert(fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
		const manager = Op.interpret(immediateOp, { strategy: "restartable" });
		const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
		const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
		expect(outcomes.filter(Op.Outcome.is.ok)).toHaveLength(1);
		expect(outcomes.filter((o) => Op.Outcome.is.nil(o) && (o as Op.Nil).reason === "replaced")).toHaveLength(n - 1);
	}));
});

test("interpret: restartable single run resolves to Ok", async () => {
	await fc.assert(fc.asyncProperty(fc.integer(), async (n) => {
		const manager = Op.interpret(immediateOp, { strategy: "restartable" });
		const outcome = await manager.run(n);
		expect(outcome).toStrictEqual(Op.Outcome.make.ok(n));
	}));
});

test("interpret: restartable abort resolves all in-flight Deferreds as Nil", async () => {
	await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (n) => {
		const manager = Op.interpret(neverOp, { strategy: "restartable" });
		const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
		manager.abort();
		const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
		expect(outcomes.every(Op.Outcome.is.nil)).toBe(true);
	}));
});

// ---------------------------------------------------------------------------
// Strategy invariants — queue
// ---------------------------------------------------------------------------

test("interpret: queue resolves all runs to Ok when op succeeds", async () => {
	await fc.assert(fc.asyncProperty(fc.array(fc.integer(), { minLength: 1, maxLength: 6 }), async (inputs) => {
		const manager = Op.interpret(immediateOp, { strategy: "queue" });
		const outcomes = (await Promise.all(inputs.map((i) => manager.run(i)).map(Deferred.to.Promise))) as Op.Outcome<
			string,
			number
		>[];
		expect(outcomes.every(Op.Outcome.is.ok)).toBe(true);
	}));
});

test("interpret: queue preserves submission order for Ok values", async () => {
	await fc.assert(fc.asyncProperty(fc.array(fc.integer(), { minLength: 1, maxLength: 6 }), async (inputs) => {
		const manager = Op.interpret(immediateOp, { strategy: "queue" });
		const outcomes = (await Promise.all(inputs.map((i) => manager.run(i)).map(Deferred.to.Promise))) as Op.Outcome<
			string,
			number
		>[];
		expect(outcomes.map((o) => (o as Op.Ok<number>).value)).toStrictEqual(inputs);
	}));
});

test("interpret: queue abort resolves all Deferreds as AbortedNil", async () => {
	await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (n) => {
		const manager = Op.interpret(signalNeverOp, { strategy: "queue" });
		const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
		await Promise.resolve(); // let the first item start running
		manager.abort();
		const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
		expect(outcomes.every(Op.Outcome.is.nil)).toBe(true);
		expect(outcomes.every((o) => (o as Op.Nil).reason === "aborted")).toBe(true);
	}));
});

// ---------------------------------------------------------------------------
// Strategy invariants — once
// ---------------------------------------------------------------------------

test("interpret: once produces Ok on first run and DroppedNil on subsequent burst", async () => {
	await fc.assert(fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
		const manager = Op.interpret(tickOp, { strategy: "once" });
		const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
		const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
		expect(outcomes[0]).toMatchObject({ kind: "OpOk", value: 0 });
		expect(outcomes.slice(1).every((o) => Op.Outcome.is.nil(o) && (o as Op.Nil).reason === "dropped")).toBe(true);
	}));
});

test("interpret: once post-completion runs produce DroppedNil", async () => {
	await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (n) => {
		const manager = Op.interpret(immediateOp, { strategy: "once" });
		await manager.run(0);
		const deferreds = Array.from({ length: n }, (_, i) => manager.run(i + 1));
		const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
		expect(outcomes.every((o) => Op.Outcome.is.nil(o) && (o as Op.Nil).reason === "dropped")).toBe(true);
	}));
});

// ---------------------------------------------------------------------------
// Retry count invariant
// ---------------------------------------------------------------------------

test("interpret: retries factory exactly specified attempts when failing", async () => {
	await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (attempts) => {
		let calls = 0;
		const countingOp = Op.create((_signal: AbortSignal) => (_: number) => {
			calls++;
			return Promise.reject(new Error("fail"));
		}, { onError: (e) => (e as Error).message });
		const manager = Op.interpret(countingOp, { strategy: "exclusive", retry: { attempts } });
		await manager.run(0);
		expect(calls).toBe(attempts);
	}));
});

// ---------------------------------------------------------------------------
// Strategy invariants — exclusive cooldown
// ---------------------------------------------------------------------------

test("interpret: exclusive cooldown synchronous burst after completion produces DroppedNil", async () => {
	await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (n) => {
		const manager = Op.interpret(immediateOp, { strategy: "exclusive", cooldown: Duration.milliseconds(200) });
		await manager.run(0); // completes; starts 200ms cooldown
		const deferreds = Array.from({ length: n }, (_, i) => manager.run(i + 1));
		const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
		expect(outcomes.every((o) => Op.Outcome.is.nil(o) && (o as Op.Nil).reason === "dropped")).toBe(true);
	}));
});

// ---------------------------------------------------------------------------
// Strategy invariants — restartable minInterval
// ---------------------------------------------------------------------------

test("interpret: restartable with zero minInterval burst produces 1 Ok and N-1 ReplacedNil", async () => {
	await fc.assert(fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
		// minInterval: 0 means gap=0 so no actual wait; algebraic invariant is unchanged
		const manager = Op.interpret(immediateOp, { strategy: "restartable", minInterval: Duration.milliseconds(0) });
		const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
		const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
		expect(outcomes.filter(Op.Outcome.is.ok)).toHaveLength(1);
		expect(outcomes.filter((o) => Op.Outcome.is.nil(o) && (o as Op.Nil).reason === "replaced")).toHaveLength(n - 1);
	}));
});

// ---------------------------------------------------------------------------
// Strategy invariants — buffered size
// ---------------------------------------------------------------------------

test("interpret: buffered size burst exceeding capacity produces EvictedNil", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 4 }).chain((k) => fc.integer({ min: k + 2, max: k + 8 }).map((n) => ({ k, n }))),
			async ({ k, n }) => {
				const manager = Op.interpret(immediateOp, { strategy: "buffered", size: k });
				const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
				const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
				expect(outcomes.filter(Op.Outcome.is.ok)).toHaveLength(k + 1);
				expect(outcomes.filter((o) => Op.Outcome.is.nil(o) && (o as Op.Nil).reason === "evicted")).toHaveLength(n - k - 1);
			},
		),
	);
});

test("interpret: buffered size burst within capacity all resolve to Ok", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 5 }).chain((k) => fc.integer({ min: 1, max: k + 1 }).map((n) => ({ k, n }))),
			async ({ k, n }) => {
				const manager = Op.interpret(immediateOp, { strategy: "buffered", size: k });
				const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
				const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
				expect(outcomes.every(Op.Outcome.is.ok)).toBe(true);
			},
		),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — queue maxSize
// ---------------------------------------------------------------------------

test("interpret: queue maxSize burst exceeding capacity produces DroppedNil", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 4 }).chain((m) => fc.integer({ min: m + 2, max: m + 8 }).map((n) => ({ m, n }))),
			async ({ m, n }) => {
				const manager = Op.interpret(immediateOp, { strategy: "queue", maxSize: m });
				const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
				const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
				expect(outcomes.filter(Op.Outcome.is.ok)).toHaveLength(m + 1);
				expect(outcomes.filter((o) => Op.Outcome.is.nil(o) && (o as Op.Nil).reason === "dropped")).toHaveLength(n - m - 1);
			},
		),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — queue overflow replace-last
// ---------------------------------------------------------------------------

test("interpret: queue replace-last overflow burst produces EvictedNil", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 3 }).chain((m) => fc.integer({ min: m + 2, max: m + 6 }).map((n) => ({ m, n }))),
			async ({ m, n }) => {
				const manager = Op.interpret(immediateOp, { strategy: "queue", maxSize: m, overflow: "replace-last" });
				const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
				const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
				expect(outcomes.filter(Op.Outcome.is.ok)).toHaveLength(m + 1);
				expect(outcomes.filter((o) => Op.Outcome.is.nil(o) && (o as Op.Nil).reason === "evicted")).toHaveLength(n - m - 1);
			},
		),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — queue concurrency
// ---------------------------------------------------------------------------

test("interpret: queue concurrency resolves all inputs to Ok when op succeeds", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 4 }),
			fc.array(fc.integer(), { minLength: 1, maxLength: 8 }),
			async (k, inputs) => {
				const manager = Op.interpret(immediateOp, { strategy: "queue", concurrency: k });
				const outcomes = (await Promise.all(inputs.map((i) => manager.run(i)).map(Deferred.to.Promise))) as Op.Outcome<
					string,
					number
				>[];
				expect(outcomes.every(Op.Outcome.is.ok)).toBe(true);
			},
		),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — queue dedupe
// ---------------------------------------------------------------------------

test("interpret: queue dedupe drops duplicate queued inputs", async () => {
	// In-flight item is never deduped (dedupe only scans the queue).
	// Each new call drops the previous queued duplicate, so only the last queued item runs.
	await fc.assert(fc.asyncProperty(fc.integer({ min: 2, max: 8 }), fc.integer(), async (n, input) => {
		const manager = Op.interpret(immediateOp, { strategy: "queue", dedupe: (a, b) => a[0] === b[0] });
		const deferreds = Array.from({ length: n }, () => manager.run(input));
		const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
		expect(outcomes.filter(Op.Outcome.is.ok)).toHaveLength(2);
		expect(outcomes.filter((o) => Op.Outcome.is.nil(o) && (o as Op.Nil).reason === "dropped")).toHaveLength(n - 2);
	}));
});

// ---------------------------------------------------------------------------
// Strategy invariants — debounced leading
// ---------------------------------------------------------------------------

test("interpret: debounced leading single run resolves to Ok with input value", async () => {
	await fc.assert(fc.asyncProperty(fc.integer(), async (n) => {
		const manager = Op.interpret(immediateOp, {
			strategy: "debounced",
			duration: Duration.milliseconds(0),
			leading: true,
		});
		const result = await manager.run(n);
		expect(result).toStrictEqual(Op.Outcome.make.ok(n));
	}));
});

// ---------------------------------------------------------------------------
// Strategy invariants — throttled trailing
// ---------------------------------------------------------------------------

test("interpret: throttled trailing burst produces leading and trailing Ok with EvictedNil", async () => {
	await fc.assert(fc.asyncProperty(fc.integer({ min: 3, max: 8 }), async (n) => {
		const manager = Op.interpret(immediateOp, {
			strategy: "throttled",
			duration: Duration.milliseconds(0),
			trailing: true,
		});
		const deferreds = Array.from({ length: n }, (_, i) => manager.run(i + 1));
		const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
		expect(outcomes.filter(Op.Outcome.is.ok)).toHaveLength(2);
		expect(outcomes.filter((o) => Op.Outcome.is.nil(o) && (o as Op.Nil).reason === "evicted")).toHaveLength(n - 2);
	}));
});

// ---------------------------------------------------------------------------
// Strategy invariants — debounced leading
// ---------------------------------------------------------------------------

test("interpret: debounced leading burst produces Ok for first and last and EvictedNil for intermediates", async () => {
	await fc.assert(fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
		const manager = Op.interpret(immediateOp, {
			strategy: "debounced",
			duration: Duration.milliseconds(0),
			leading: true,
		});
		const deferreds = Array.from({ length: n }, (_, i) => manager.run(i + 1));
		const outcomes = (await Promise.all(deferreds.map(Deferred.to.Promise))) as Op.Outcome<string, number>[];
		expect(outcomes[0]).toMatchObject({ kind: "OpOk" }); // leading
		expect(outcomes[n - 1]).toMatchObject({ kind: "OpOk" }); // trailing
		expect(outcomes.slice(1, -1).every((o) => Op.Outcome.is.nil(o) && (o as Op.Nil).reason === "evicted")).toBe(true);
	}));
});
