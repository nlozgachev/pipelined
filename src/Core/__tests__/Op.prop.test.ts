import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";
import { Deferred } from "../Deferred.ts";
import { Op } from "../Op.ts";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Resolves immediately with the input value. */
const immediateOp = Op.create((n: number) => Promise.resolve(n), String);

/** Resolves after one microtask tick — genuinely async without a real timer. */
const tickOp = Op.create((n: number) => Promise.resolve().then(() => n), String);

/** Promise that never settles — useful for abort() tests on restartable. */
const neverOp = Op.create((_: number) => new Promise<number>(() => {}), String);

/**
 * Like neverOp but rejects when the AbortSignal fires.
 * Required for queue abort tests: the queue implementation only resolves the
 * in-flight item's Deferred after execute() settles, so the factory must
 * respect the signal to avoid hanging forever.
 */
const signalNeverOp = Op.create(
	(_: number, signal: AbortSignal) =>
		new Promise<number>((_, reject) => {
			signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
		}),
	() => "aborted",
);

const arbOkOutcome = fc.integer().map((n) => Op.ok(n) as Op.Outcome<string, number>);
const arbErrOutcome = fc.string().map((s) => Op.err(s) as Op.Outcome<string, number>);
const arbNilOutcome = fc
	.constantFrom<Op.NilReason>("aborted", "dropped", "replaced", "evicted")
	.map((r) => Op.nil(r) as Op.Outcome<string, number>);
const arbOutcome = fc.oneof(arbOkOutcome, arbErrOutcome, arbNilOutcome);

/** Already-resolved Deferred wrapping an outcome value. */
const settled = <E, A>(o: Op.Outcome<E, A>): Deferred<Op.Outcome<E, A>> => Deferred.fromPromise(Promise.resolve(o));

// ---------------------------------------------------------------------------
// Pure outcome combinators — algebraic laws
// ---------------------------------------------------------------------------

test("Op.map — identity law", () => {
	fc.assert(
		fc.property(arbOutcome, (o) => {
			expect(Op.map((x: number) => x)(o)).toEqual(o);
		}),
	);
});

test("Op.map — composition law", () => {
	fc.assert(
		fc.property(arbOutcome, fc.integer(), fc.integer(), (o, a, b) => {
			const f = (x: number) => x + a;
			const g = (x: number) => x * b;
			expect(Op.map((x: number) => f(g(x)))(o)).toEqual(Op.map(f)(Op.map(g)(o)));
		}),
	);
});

test("Op.chain — short-circuits on Err and Nil", () => {
	fc.assert(
		fc.property(fc.oneof(arbErrOutcome, arbNilOutcome), (o) => {
			expect(Op.chain((_: number) => Op.ok(0))(o)).toBe(o);
		}),
	);
});

test("Op.chain — associativity on Ok", () => {
	fc.assert(
		fc.property(arbOkOutcome, fc.integer(), (o, threshold) => {
			const f = (x: number): Op.Outcome<string, number> => x > 0 ? Op.ok(x * 2) : Op.err("non-positive");
			const g = (x: number): Op.Outcome<string, number> => x > threshold ? Op.ok(x + 1) : Op.err("too small");
			expect(Op.chain(f)(Op.chain(g)(o))).toEqual(
				Op.chain((x: number) => Op.chain(f)(g(x)))(o),
			);
		}),
	);
});

test("Op.recover — identity on Ok and Nil", () => {
	fc.assert(
		fc.property(fc.oneof(arbOkOutcome, arbNilOutcome), (o) => {
			expect(Op.recover((_: string) => Op.ok(0))(o)).toBe(o);
		}),
	);
});

test("Op.tap — always returns the identical outcome reference", () => {
	fc.assert(
		fc.property(arbOutcome, (o) => {
			expect(Op.tap(() => {})(o)).toBe(o);
		}),
	);
});

test("Op.fold — handles all outcome kinds without throwing", () => {
	fc.assert(
		fc.property(arbOutcome, (o) => {
			const result = Op.fold(
				(e: string) => `err:${e}`,
				(v: number) => `ok:${v}`,
				() => "nil",
			)(o);
			expectTypeOf(result).toBeString();
		}),
	);
});

// ---------------------------------------------------------------------------
// Op.all — algebraic laws
// ---------------------------------------------------------------------------

test("Op.all — empty array resolves to empty array", async () => {
	const result = await Op.all([]);
	expect(result).toEqual([]);
});

test("Op.all — result order matches input order", async () => {
	await fc.assert(
		fc.asyncProperty(fc.array(arbOutcome, { maxLength: 8 }), async (outcomes) => {
			const results = await Op.all(outcomes.map(settled));
			expect(results).toEqual(outcomes);
		}),
	);
});

test("Op.all — singleton resolves to that deferred's outcome", async () => {
	await fc.assert(
		fc.asyncProperty(arbOutcome, async (o) => {
			const [result] = await Op.all([settled(o)]);
			expect(result).toEqual(o);
		}),
	);
});

// ---------------------------------------------------------------------------
// Op.race — algebraic laws
// ---------------------------------------------------------------------------

test("Op.race — singleton resolves to that deferred's outcome", async () => {
	await fc.assert(
		fc.asyncProperty(arbOutcome, async (o) => {
			const result = await Op.race([settled(o)]);
			expect(result).toEqual(o);
		}),
	);
});

test("Op.race — pre-resolved deferred wins regardless of its position", async () => {
	await fc.assert(
		fc.asyncProperty(
			arbOutcome,
			fc.integer({ min: 1, max: 5 }),
			fc.integer({ min: 0, max: 4 }),
			async (winner, total, posRaw) => {
				const pos = posRaw % total;
				const deferreds: Deferred<Op.Outcome<string, number>>[] = Array.from(
					{ length: total },
					(_, i) =>
						i === pos
							? settled(winner)
							: Deferred.fromPromise(new Promise<Op.Outcome<string, number>>(() => {})),
				);
				const result = await Op.race(deferreds);
				expect(result).toEqual(winner);
			},
		),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — exclusive
// ---------------------------------------------------------------------------

test("Op.interpret exclusive — burst of N produces exactly 1 Ok and N-1 DroppedNil", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
			const manager = Op.interpret(immediateOp, { strategy: "exclusive" });
			const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
			const outcomes = (await Promise.all(
				deferreds.map(Deferred.toPromise),
			)) as Op.Outcome<string, number>[];
			expect(outcomes.filter(Op.isOk)).toHaveLength(1);
			expect(
				outcomes.filter((o) => Op.isNil(o) && (o as Op.Nil).reason === "dropped"),
			).toHaveLength(n - 1);
		}),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — restartable
// ---------------------------------------------------------------------------

test("Op.interpret restartable — burst of N produces exactly 1 Ok and N-1 ReplacedNil", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
			const manager = Op.interpret(immediateOp, { strategy: "restartable" });
			const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
			const outcomes = (await Promise.all(
				deferreds.map(Deferred.toPromise),
			)) as Op.Outcome<string, number>[];
			expect(outcomes.filter(Op.isOk)).toHaveLength(1);
			expect(
				outcomes.filter((o) => Op.isNil(o) && (o as Op.Nil).reason === "replaced"),
			).toHaveLength(n - 1);
		}),
	);
});

test("Op.interpret restartable — single run resolves to Ok", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer(), async (n) => {
			const manager = Op.interpret(immediateOp, { strategy: "restartable" });
			const outcome = await manager.run(n);
			expect(outcome).toEqual(Op.ok(n));
		}),
	);
});

test("Op.interpret restartable — abort() resolves all in-flight Deferreds as Nil", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (n) => {
			const manager = Op.interpret(neverOp, { strategy: "restartable" });
			const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
			manager.abort();
			const outcomes = (await Promise.all(
				deferreds.map(Deferred.toPromise),
			)) as Op.Outcome<string, number>[];
			expect(outcomes.every(Op.isNil)).toBe(true);
		}),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — queue
// ---------------------------------------------------------------------------

test("Op.interpret queue — all runs resolve to Ok when op always succeeds", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.array(fc.integer(), { minLength: 1, maxLength: 6 }),
			async (inputs) => {
				const manager = Op.interpret(immediateOp, { strategy: "queue" });
				const outcomes = (await Promise.all(
					inputs.map((i) => manager.run(i)).map(Deferred.toPromise),
				)) as Op.Outcome<string, number>[];
				expect(outcomes.every(Op.isOk)).toBe(true);
			},
		),
	);
});

test("Op.interpret queue — Ok values arrive in submission order", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.array(fc.integer(), { minLength: 1, maxLength: 6 }),
			async (inputs) => {
				const manager = Op.interpret(immediateOp, { strategy: "queue" });
				const outcomes = (await Promise.all(
					inputs.map((i) => manager.run(i)).map(Deferred.toPromise),
				)) as Op.Outcome<string, number>[];
				expect(outcomes.map((o) => (o as Op.Ok<number>).value)).toEqual(inputs);
			},
		),
	);
});

test("Op.interpret queue — abort() resolves all Deferreds as AbortedNil", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (n) => {
			const manager = Op.interpret(signalNeverOp, { strategy: "queue" });
			const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
			await Promise.resolve(); // let the first item start running
			manager.abort();
			const outcomes = (await Promise.all(
				deferreds.map(Deferred.toPromise),
			)) as Op.Outcome<string, number>[];
			expect(outcomes.every(Op.isNil)).toBe(true);
			expect(outcomes.every((o) => (o as Op.Nil).reason === "aborted")).toBe(true);
		}),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — once
// ---------------------------------------------------------------------------

test("Op.interpret once — first run produces Ok, subsequent burst runs produce DroppedNil", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
			const manager = Op.interpret(tickOp, { strategy: "once" });
			const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
			const outcomes = (await Promise.all(
				deferreds.map(Deferred.toPromise),
			)) as Op.Outcome<string, number>[];
			expect(outcomes[0]).toMatchObject({ kind: "Ok", value: 0 });
			expect(
				outcomes.slice(1).every((o) => Op.isNil(o) && (o as Op.Nil).reason === "dropped"),
			).toBe(true);
		}),
	);
});

test("Op.interpret once — post-completion runs always produce DroppedNil", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (n) => {
			const manager = Op.interpret(immediateOp, { strategy: "once" });
			await manager.run(0);
			const deferreds = Array.from({ length: n }, (_, i) => manager.run(i + 1));
			const outcomes = (await Promise.all(
				deferreds.map(Deferred.toPromise),
			)) as Op.Outcome<string, number>[];
			expect(
				outcomes.every((o) => Op.isNil(o) && (o as Op.Nil).reason === "dropped"),
			).toBe(true);
		}),
	);
});

// ---------------------------------------------------------------------------
// Retry count invariant
// ---------------------------------------------------------------------------

test("Op.interpret retry — factory is called exactly attempts times when always failing", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (attempts) => {
			let calls = 0;
			const countingOp = Op.create(
				(_: number) => {
					calls++;
					return Promise.reject(new Error("fail"));
				},
				(e) => (e as Error).message,
			);
			const manager = Op.interpret(countingOp, { strategy: "exclusive", retry: { attempts } });
			await manager.run(0);
			expect(calls).toBe(attempts);
		}),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — exclusive cooldown
// ---------------------------------------------------------------------------

test("Op.interpret exclusive cooldown — synchronous burst after completion all produce DroppedNil", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (n) => {
			const manager = Op.interpret(immediateOp, { strategy: "exclusive", cooldown: 200 });
			await manager.run(0); // completes; starts 200ms cooldown
			const deferreds = Array.from({ length: n }, (_, i) => manager.run(i + 1));
			const outcomes = (await Promise.all(
				deferreds.map(Deferred.toPromise),
			)) as Op.Outcome<string, number>[];
			expect(
				outcomes.every((o) => Op.isNil(o) && (o as Op.Nil).reason === "dropped"),
			).toBe(true);
		}),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — restartable minInterval
// ---------------------------------------------------------------------------

test("Op.interpret restartable with minInterval: 0 — burst still produces 1 Ok and N-1 ReplacedNil", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
			// minInterval: 0 means gap=0 so no actual wait; algebraic invariant is unchanged
			const manager = Op.interpret(immediateOp, { strategy: "restartable", minInterval: 0 });
			const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
			const outcomes = (await Promise.all(
				deferreds.map(Deferred.toPromise),
			)) as Op.Outcome<string, number>[];
			expect(outcomes.filter(Op.isOk)).toHaveLength(1);
			expect(
				outcomes.filter((o) => Op.isNil(o) && (o as Op.Nil).reason === "replaced"),
			).toHaveLength(n - 1);
		}),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — buffered size
// ---------------------------------------------------------------------------

test("Op.interpret buffered size=k — burst of N > k+1 produces exactly k+1 Ok and N-k-1 EvictedNil", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 4 }).chain((k) => fc.integer({ min: k + 2, max: k + 8 }).map((n) => ({ k, n }))),
			async ({ k, n }) => {
				const manager = Op.interpret(immediateOp, { strategy: "buffered", size: k });
				const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
				const outcomes = (await Promise.all(
					deferreds.map(Deferred.toPromise),
				)) as Op.Outcome<string, number>[];
				expect(outcomes.filter(Op.isOk)).toHaveLength(k + 1);
				expect(
					outcomes.filter((o) => Op.isNil(o) && (o as Op.Nil).reason === "evicted"),
				).toHaveLength(n - k - 1);
			},
		),
	);
});

test("Op.interpret buffered size=k — burst of N <= k+1 all resolve to Ok", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 5 }).chain((k) => fc.integer({ min: 1, max: k + 1 }).map((n) => ({ k, n }))),
			async ({ k, n }) => {
				const manager = Op.interpret(immediateOp, { strategy: "buffered", size: k });
				const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
				const outcomes = (await Promise.all(
					deferreds.map(Deferred.toPromise),
				)) as Op.Outcome<string, number>[];
				expect(outcomes.every(Op.isOk)).toBe(true);
			},
		),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — queue maxSize
// ---------------------------------------------------------------------------

test("Op.interpret queue maxSize=m — burst of N > m+1 produces m+1 Ok and N-m-1 DroppedNil", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 4 }).chain((m) => fc.integer({ min: m + 2, max: m + 8 }).map((n) => ({ m, n }))),
			async ({ m, n }) => {
				const manager = Op.interpret(immediateOp, { strategy: "queue", maxSize: m });
				const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
				const outcomes = (await Promise.all(
					deferreds.map(Deferred.toPromise),
				)) as Op.Outcome<string, number>[];
				expect(outcomes.filter(Op.isOk)).toHaveLength(m + 1);
				expect(
					outcomes.filter((o) => Op.isNil(o) && (o as Op.Nil).reason === "dropped"),
				).toHaveLength(n - m - 1);
			},
		),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — queue overflow replace-last
// ---------------------------------------------------------------------------

test("Op.interpret queue overflow replace-last — burst of N > m+1 produces m+1 Ok and N-m-1 EvictedNil", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 3 }).chain((m) => fc.integer({ min: m + 2, max: m + 6 }).map((n) => ({ m, n }))),
			async ({ m, n }) => {
				const manager = Op.interpret(immediateOp, {
					strategy: "queue",
					maxSize: m,
					overflow: "replace-last",
				});
				const deferreds = Array.from({ length: n }, (_, i) => manager.run(i));
				const outcomes = (await Promise.all(
					deferreds.map(Deferred.toPromise),
				)) as Op.Outcome<string, number>[];
				expect(outcomes.filter(Op.isOk)).toHaveLength(m + 1);
				expect(
					outcomes.filter((o) => Op.isNil(o) && (o as Op.Nil).reason === "evicted"),
				).toHaveLength(n - m - 1);
			},
		),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — queue concurrency
// ---------------------------------------------------------------------------

test("Op.interpret queue concurrency=k — all N inputs resolve to Ok when op succeeds", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 4 }),
			fc.array(fc.integer(), { minLength: 1, maxLength: 8 }),
			async (k, inputs) => {
				const manager = Op.interpret(immediateOp, { strategy: "queue", concurrency: k });
				const outcomes = (await Promise.all(
					inputs.map((i) => manager.run(i)).map(Deferred.toPromise),
				)) as Op.Outcome<string, number>[];
				expect(outcomes.every(Op.isOk)).toBe(true);
			},
		),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — queue dedupe
// ---------------------------------------------------------------------------

test("Op.interpret queue dedupe — N equal inputs produce 2 Ok and N-2 DroppedNil", async () => {
	// In-flight item is never deduped (dedupe only scans the queue).
	// Each new call drops the previous queued duplicate, so only the last queued item runs.
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 2, max: 8 }),
			fc.integer(),
			async (n, input) => {
				const manager = Op.interpret(immediateOp, {
					strategy: "queue",
					dedupe: (a, b) => a === b,
				});
				const deferreds = Array.from({ length: n }, () => manager.run(input));
				const outcomes = (await Promise.all(
					deferreds.map(Deferred.toPromise),
				)) as Op.Outcome<string, number>[];
				expect(outcomes.filter(Op.isOk)).toHaveLength(2);
				expect(
					outcomes.filter((o) => Op.isNil(o) && (o as Op.Nil).reason === "dropped"),
				).toHaveLength(n - 2);
			},
		),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — debounced leading
// ---------------------------------------------------------------------------

test("Op.interpret debounced leading — single run resolves to Ok with the input value", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer(), async (n) => {
			const manager = Op.interpret(immediateOp, { strategy: "debounced", ms: 0, leading: true });
			const result = await manager.run(n);
			expect(result).toEqual(Op.ok(n));
		}),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — throttled trailing
// ---------------------------------------------------------------------------

test("Op.interpret throttled trailing — burst of N >= 3 produces 2 Ok (leading + trailing) and N-2 EvictedNil", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer({ min: 3, max: 8 }), async (n) => {
			const manager = Op.interpret(immediateOp, { strategy: "throttled", ms: 0, trailing: true });
			const deferreds = Array.from({ length: n }, (_, i) => manager.run(i + 1));
			const outcomes = (await Promise.all(
				deferreds.map(Deferred.toPromise),
			)) as Op.Outcome<string, number>[];
			expect(outcomes.filter(Op.isOk)).toHaveLength(2);
			expect(
				outcomes.filter((o) => Op.isNil(o) && (o as Op.Nil).reason === "evicted"),
			).toHaveLength(n - 2);
		}),
	);
});

// ---------------------------------------------------------------------------
// Strategy invariants — debounced leading
// ---------------------------------------------------------------------------

test("Op.interpret debounced leading — burst of N produces Ok for first and last, EvictedNil for intermediates", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
			const manager = Op.interpret(immediateOp, { strategy: "debounced", ms: 0, leading: true });
			const deferreds = Array.from({ length: n }, (_, i) => manager.run(i + 1));
			const outcomes = (await Promise.all(
				deferreds.map(Deferred.toPromise),
			)) as Op.Outcome<string, number>[];
			expect(outcomes[0]).toMatchObject({ kind: "Ok" }); // leading
			expect(outcomes[n - 1]).toMatchObject({ kind: "Ok" }); // trailing
			expect(
				outcomes
					.slice(1, -1)
					.every((o) => Op.isNil(o) && (o as Op.Nil).reason === "evicted"),
			).toBe(true);
		}),
	);
});
