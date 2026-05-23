import { expect, expectTypeOf, test } from "vitest";
import { Duration } from "../../Types/Duration.ts";
import { Maybe } from "../Maybe.ts";
import { Op } from "../Op.ts";
import { Result } from "../Result.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Op that resolves with the input value after an optional delay. */
const delayedOp = (delayMs = 0): Op<number, string, number> =>
	Op.create((signal) => (input: number) =>
		new Promise<number>((resolve, reject) => {
			const id = setTimeout(() => resolve(input), delayMs);
			signal.addEventListener("abort", () => {
				clearTimeout(id);
				reject(new Error("abort"));
			}, { once: true });
		}), (e) => String(e));

/** Op that always rejects with `error` after an optional delay. */
const failingOp = (error: string, delayMs = 0): Op<number, string, number> =>
	Op.create((signal) => (_input: number) =>
		new Promise<never>((_resolve, reject) => {
			const id = setTimeout(() => reject(new Error(error)), delayMs);
			signal.addEventListener("abort", () => {
				clearTimeout(id);
				reject(new Error("abort"));
			}, { once: true });
		}), (e) => (e as Error).message);

/**
 * Subscribes to a manager, calls run(input), and collects states until a terminal one arrives.
 * Subscribes before run() so the manager is Idle when subscribing (no immediate notification).
 */
const runAndCollect = <I, E, A, S extends Op.State<E, A>>(manager: Op.Manager<I, E, A, S>, input: I): Promise<S[]> => {
	const states: S[] = [];
	return new Promise((resolve) => {
		const unsub = manager.subscribe((s) => {
			states.push(s);
			if (Op.isOk(s) || Op.isErr(s) || Op.isNil(s)) {
				unsub();
				resolve(states);
			}
		});
		manager.run(input);
	});
};

// ---------------------------------------------------------------------------
// Op.create
// ---------------------------------------------------------------------------

test("Op.create produces an Op with a _factory function", () => {
	const op = Op.create((_signal) => () => Promise.resolve(1), String);
	expectTypeOf(op._factory).toBeFunction();
});

test("Op.create infers Op<void> when factory takes no input", () => {
	const op = Op.create((_signal) => () => Promise.resolve(42), String);
	expectTypeOf(op).toEqualTypeOf<Op<void, string, number>>();
});

test("op.create void: manager.run() accepts no arguments", async () => {
	const op = Op.create((_signal) => () => Promise.resolve(99), String);
	const manager = Op.interpret(op, { strategy: "once" });
	// run() with no args must type-check and resolve Ok
	const result = await manager.run();
	expect(result).toStrictEqual(Op.ok(99));
});

// ---------------------------------------------------------------------------
// Op.lift
// ---------------------------------------------------------------------------

test("Op.lift creates a manager from a plain async function", async () => {
	const op = Op.lift((n: number, _signal: AbortSignal) => Promise.resolve(n * 2));
	const manager = Op.interpret(op, { strategy: "restartable" });
	const outcome = await manager.run(5);
	expect(Op.isOk(outcome)).toBe(true);
	expect((outcome as Op.Ok<number>).value).toBe(10);
});

test("Op.lift captures rejection as Err with unknown error type", async () => {
	const op = Op.lift((_: number, _signal: AbortSignal) => Promise.reject(new Error("boom")));
	const manager = Op.interpret(op, { strategy: "restartable" });
	const outcome = await manager.run(0);
	expect(Op.isErr(outcome)).toBe(true);
	expect((outcome as Op.Err<Error>).error.message).toBe("boom");
});

test("Op.lift passes the signal to the async function", async () => {
	let capturedSignal: AbortSignal | undefined;
	const op = Op.lift((_: number, signal: AbortSignal) => {
		capturedSignal = signal;
		return Promise.resolve(0);
	});
	const manager = Op.interpret(op, { strategy: "restartable" });
	await manager.run(0);
	expect(capturedSignal).toBeInstanceOf(AbortSignal);
});

// ---------------------------------------------------------------------------
// Outcome constructors
// ---------------------------------------------------------------------------

test("Op.ok creates an Ok outcome", () => {
	expect(Op.ok(42)).toStrictEqual({ kind: "OpOk", value: 42 });
});

test("Op.err creates an Err outcome", () => {
	expect(Op.err("oops")).toStrictEqual({ kind: "OpErr", error: "oops" });
});

test("Op.nil creates a Nil outcome with the given reason", () => {
	expect(Op.nil("aborted")).toStrictEqual({ kind: "OpNil", reason: "aborted" });
	expect(Op.nil("dropped")).toStrictEqual({ kind: "OpNil", reason: "dropped" });
	expect(Op.nil("replaced")).toStrictEqual({ kind: "OpNil", reason: "replaced" });
	expect(Op.nil("evicted")).toStrictEqual({ kind: "OpNil", reason: "evicted" });
});

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

test("Op.isOk returns true only for Ok", () => {
	const ok = Op.ok(1) as Op.Outcome<string, number>;
	const e = Op.err("e") as Op.Outcome<string, number>;
	const n = Op.nil("aborted") as Op.Outcome<string, number>;
	expect(Op.isOk(ok)).toBe(true);
	expect(Op.isOk(e)).toBe(false);
	expect(Op.isOk(n)).toBe(false);
});

test("Op.isErr returns true only for Err", () => {
	const ok = Op.ok(1) as Op.Outcome<string, number>;
	const e = Op.err("e") as Op.Outcome<string, number>;
	const n = Op.nil("aborted") as Op.Outcome<string, number>;
	expect(Op.isErr(e)).toBe(true);
	expect(Op.isErr(ok)).toBe(false);
	expect(Op.isErr(n)).toBe(false);
});

test("Op.isNil returns true only for Nil", () => {
	const ok = Op.ok(1) as Op.Outcome<string, number>;
	const e = Op.err("e") as Op.Outcome<string, number>;
	const n = Op.nil("aborted") as Op.Outcome<string, number>;
	expect(Op.isNil(n)).toBe(true);
	expect(Op.isNil(ok)).toBe(false);
	expect(Op.isNil(e)).toBe(false);
});

test("Op.isIdle returns true only for Idle state", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	expect(Op.isIdle(manager.state)).toBe(true);
	const run = manager.run(1);
	expect(Op.isIdle(manager.state)).toBe(false);
	await run;
});

test("Op.isQueued returns true only for Queued state", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "queue" });
	manager.run(1);
	manager.run(2);
	expect(Op.isQueued(manager.state)).toBe(true);
	expect(Op.isOk(manager.state)).toBe(false);
	expect(Op.isIdle(manager.state)).toBe(false);
	manager.abort();
	await new Promise((r) => setTimeout(r, 50));
});

test("Op.isRetrying returns true only for Retrying state", async () => {
	let attempt = 0;
	const op = Op.create((_signal) => (_: number) => {
		attempt++;
		if (attempt < 2) { return Promise.reject(new Error("fail")); }
		return Promise.resolve(42);
	}, (e) => String(e));
	const manager = Op.interpret(op, {
		strategy: "restartable",
		retry: { attempts: 2, backoff: () => Duration.milliseconds(0) },
	});
	let sawRetrying = false;
	manager.subscribe((s) => {
		if (Op.isRetrying(s)) { sawRetrying = true; }
	});
	await manager.run(1);
	expect(sawRetrying).toBe(true);
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

const matchCases = { ok: (v: number) => `ok:${v}`, err: (e: string) => `err:${e}`, nil: () => "nil" };

test("Op.match handles Ok", () => {
	expect(Op.match(matchCases)(Op.ok(5))).toBe("ok:5");
});

test("Op.match handles Err", () => {
	expect(Op.match(matchCases)(Op.err("boom"))).toBe("err:boom");
});

test("Op.match handles Nil", () => {
	expect(Op.match(matchCases)(Op.nil("aborted"))).toBe("nil");
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Op.fold handles all three cases", () => {
	const fold = Op.fold((e: string) => `err:${e}`, () => "nil", (v: number) => `ok:${v}`);
	expect(fold(Op.ok(3))).toBe("ok:3");
	expect(fold(Op.err("x"))).toBe("err:x");
	expect(fold(Op.nil("aborted"))).toBe("nil");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Op.getOrElse returns value for Ok", () => {
	expect(Op.getOrElse(() => 0)(Op.ok(42))).toBe(42);
});

test("Op.getOrElse returns default for Err", () => {
	expect(Op.getOrElse(() => 0)(Op.err("e") as Op.Outcome<string, number>)).toBe(0);
});

test("Op.getOrElse returns default for Nil", () => {
	expect(Op.getOrElse(() => 0)(Op.nil("aborted") as Op.Outcome<string, number>)).toBe(0);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Op.map transforms Ok value", () => {
	expect(Op.map((n: number) => n * 2)(Op.ok(5))).toStrictEqual(Op.ok(10));
});

test("Op.map passes Err through unchanged", () => {
	const outcome = Op.err("e") as Op.Outcome<string, number>;
	expect(Op.map((n: number) => n * 2)(outcome)).toStrictEqual(Op.err("e"));
});

test("Op.map passes Nil through — same reference", () => {
	const outcome = Op.nil("aborted") as Op.Outcome<string, number>;
	expect(Op.map((n: number) => n * 2)(outcome)).toBe(outcome);
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("Op.mapError transforms Err", () => {
	const outcome = Op.err("oops") as Op.Outcome<string, number>;
	expect(Op.mapError((e: string) => e.toUpperCase())(outcome)).toStrictEqual(Op.err("OOPS"));
});

test("Op.mapError passes Ok through unchanged", () => {
	const outcome = Op.ok(1) as Op.Outcome<string, number>;
	expect(Op.mapError((e: string) => e.toUpperCase())(outcome)).toStrictEqual(Op.ok(1));
});

test("Op.mapError passes Nil through — same reference", () => {
	const outcome = Op.nil("aborted") as Op.Outcome<string, number>;
	expect(Op.mapError((e: string) => e.toUpperCase())(outcome)).toBe(outcome);
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Op.chain runs f on Ok and returns new Outcome", () => {
	const outcome = Op.ok(5) as Op.Outcome<string, number>;
	expect(Op.chain((n: number) => (n > 0 ? Op.ok(n * 2) : Op.err("negative")))(outcome)).toStrictEqual(Op.ok(10));
});

test("Op.chain does not call f on Err", () => {
	let called = false;
	const outcome = Op.err("e") as Op.Outcome<string, number>;
	const result = Op.chain((n: number) => {
		called = true;
		return Op.ok(n);
	})(outcome);
	expect(called).toBe(false);
	expect(result).toStrictEqual(Op.err("e"));
});

test("Op.chain does not call f on Nil — same reference", () => {
	let called = false;
	const outcome = Op.nil("aborted") as Op.Outcome<string, number>;
	const result = Op.chain((n: number) => {
		called = true;
		return Op.ok(n);
	})(outcome);
	expect(called).toBe(false);
	expect(result).toBe(outcome);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("Op.tap runs side effect on Ok and returns unchanged outcome", () => {
	let seen: number | undefined;
	const outcome = Op.ok(7) as Op.Outcome<string, number>;
	const result = Op.tap((n: number) => {
		seen = n;
	})(outcome);
	expect(seen).toBe(7);
	expect(result).toStrictEqual(Op.ok(7));
});

test("Op.tap does not run on Err", () => {
	let called = false;
	const outcome = Op.err("e") as Op.Outcome<string, number>;
	Op.tap((_: number) => {
		called = true;
	})(outcome);
	expect(called).toBe(false);
});

test("Op.tap does not run on Nil", () => {
	let called = false;
	const outcome = Op.nil("aborted") as Op.Outcome<string, number>;
	Op.tap((_: number) => {
		called = true;
	})(outcome);
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("Op.recover provides fallback on Err", () => {
	const outcome = Op.err("oops") as Op.Outcome<string, number>;
	expect(Op.recover((e: string) => Op.ok(`recovered:${e}`))(outcome)).toStrictEqual(Op.ok("recovered:oops"));
});

test("Op.recover does not call f on Ok", () => {
	let called = false;
	const outcome = Op.ok(5) as Op.Outcome<string, number>;
	const result = Op.recover((_: string) => {
		called = true;
		return Op.ok(0);
	})(outcome);
	expect(called).toBe(false);
	expect(result).toStrictEqual(Op.ok(5));
});

test("Op.recover does not call f on Nil — same reference", () => {
	let called = false;
	const outcome = Op.nil("aborted") as Op.Outcome<string, number>;
	const result = Op.recover((_: string) => {
		called = true;
		return Op.ok(0);
	})(outcome);
	expect(called).toBe(false);
	expect(result).toBe(outcome);
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("op.toResult converts Ok to Result.ok", () => {
	expect(Op.toResult(() => "no-result")(Op.ok(1))).toStrictEqual(Result.ok(1));
});

test("op.toResult converts Err to Result.err", () => {
	const outcome = Op.err("boom") as Op.Outcome<string, number>;
	expect(Op.toResult(() => "no-result")(outcome)).toStrictEqual(Result.err("boom"));
});

test("Op.toResult converts Nil via onNil", () => {
	const outcome = Op.nil("aborted") as Op.Outcome<string, number>;
	expect(Op.toResult(() => "no-result")(outcome)).toStrictEqual(Result.err("no-result"));
});

// ---------------------------------------------------------------------------
// toMaybe
// ---------------------------------------------------------------------------

test("Op.toMaybe converts Ok to Some", () => {
	expect(Op.toMaybe(Op.ok(7))).toStrictEqual(Maybe.some(7));
});

test("Op.toMaybe converts Err to None", () => {
	expect(Op.toMaybe(Op.err("e") as Op.Outcome<string, number>)).toStrictEqual(Maybe.none());
});

test("Op.toMaybe converts Nil to None", () => {
	expect(Op.toMaybe(Op.nil("aborted") as Op.Outcome<string, number>)).toStrictEqual(Maybe.none());
});

// ---------------------------------------------------------------------------
// Op.interpret — restartable
// ---------------------------------------------------------------------------

test("Op.interpret restartable emits Pending then Ok on success", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	const states = await runAndCollect(manager, 42);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 42 }]);
});

test("Op.interpret restartable emits Pending then Err on failure", async () => {
	const manager = Op.interpret(failingOp("boom"), { strategy: "restartable" });
	const states = await runAndCollect(manager, 1);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpErr", error: "boom" }]);
});

test("Op.interpret restartable new run cancels previous — only latest result arrives", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "restartable" });
	const outcomes: Op.Outcome<string, number>[] = [];
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			if (Op.isOk(s) || Op.isErr(s) || Op.isNil(s)) {
				outcomes.push(s);
				if (outcomes.length === 1) { resolve(); // wait for the second run to finish
				 }
			}
		});
	});
	manager.run(1); // will be cancelled
	manager.run(2); // cancels run(1), starts fresh
	await done;
	// Only one outcome: run(2)'s result
	expect(outcomes).toHaveLength(1);
	expect(outcomes[0]).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("Op.interpret restartable abort emits Nil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "restartable" });
	const states: Op.RestartableState<string, number>[] = [];
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			states.push(s);
			if (Op.isNil(s)) { resolve(); }
		});
	});
	manager.run(1);
	manager.abort();
	await done;
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpNil", reason: "aborted" }]);
});

test("Op.interpret restartable state is readable synchronously", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "restartable" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.run(1);
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

test("Op.interpret restartable subscribe fires immediately with current non-Idle state", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "restartable" });
	manager.run(1); // state is Pending (emit is synchronous)
	const seen: Op.RestartableState<string, number>[] = [];
	manager.subscribe((s) => seen.push(s)); // fires immediately with Pending
	expect(seen).toStrictEqual([{ kind: "Pending" }]);
	manager.abort();
});

// ---------------------------------------------------------------------------
// Op.interpret — restartable with retry
// ---------------------------------------------------------------------------

test("Op.interpret restartable with retry emits Retrying between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, (e) => (e as Error).message);
	const manager = Op.interpret(op, { strategy: "restartable", retry: { attempts: 3 } });
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[0]).toStrictEqual({ kind: "Pending" });
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
	expect(states[2]).toStrictEqual({ kind: "Retrying", attempt: 2, lastError: "fail" });
	expect(states[3]).toStrictEqual({ kind: "OpErr", error: "fail" });
});

test("Op.interpret restartable with retry stops retrying on Ok", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (_: number) => {
		calls++;
		return calls < 2 ? Promise.reject(new Error("not yet")) : Promise.resolve(99);
	}, (e) => (e as Error).message);
	const manager = Op.interpret(op, { strategy: "restartable", retry: { attempts: 5 } });
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(2);
	expect(states.at(-1)).toStrictEqual({ kind: "OpOk", value: 99 });
});

test("Op.interpret restartable with retry respects when guard", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("non-retryable"));
	}, (e) => (e as Error).message);
	const manager = Op.interpret(op, {
		strategy: "restartable",
		retry: { attempts: 5, when: (e) => e !== "non-retryable" },
	});
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(1);
	expect(states.at(-1)).toStrictEqual({ kind: "OpErr", error: "non-retryable" });
});

// ---------------------------------------------------------------------------
// Op.interpret — restartable with timeout
// ---------------------------------------------------------------------------

test("Op.interpret restartable with timeout emits Err when deadline fires", async () => {
	const manager = Op.interpret(delayedOp(100), {
		strategy: "restartable",
		timeout: { duration: Duration.milliseconds(10), onTimeout: () => "timed out" },
	});
	const states = await runAndCollect(manager, 1);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpErr", error: "timed out" }]);
});

test("Op.interpret restartable with timeout resolves Ok when op finishes in time", async () => {
	const manager = Op.interpret(delayedOp(0), {
		strategy: "restartable",
		timeout: { duration: Duration.milliseconds(500), onTimeout: () => "timed out" },
	});
	const states = await runAndCollect(manager, 42);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 42 }]);
});

// ---------------------------------------------------------------------------
// Op.interpret — restartable with retry + timeout
// ---------------------------------------------------------------------------

test("Op.interpret restartable retry + timeout — deadline wraps entire retry sequence", async () => {
	let calls = 0;
	const op = Op.create((signal) => (_: number) =>
		new Promise<never>((res, reject) => {
			calls++;
			const id = setTimeout(() => reject(new Error("fail")), 20);
			signal.addEventListener("abort", () => {
				clearTimeout(id);
				reject(new Error("abort"));
			}, { once: true });
		}), (e) => (e as Error).message);
	const manager = Op.interpret(op, {
		strategy: "restartable",
		retry: { attempts: 10 },
		timeout: { duration: Duration.milliseconds(35), onTimeout: () => "timed out" },
	});
	const states = await runAndCollect(manager, 1);
	// Timeout at 35ms fires before 10 attempts (each 20ms) can complete
	expect(states.at(-1)).toStrictEqual({ kind: "OpErr", error: "timed out" });
	expect(calls).toBeGreaterThanOrEqual(1);
	expect(calls).toBeLessThan(10);
});

// ---------------------------------------------------------------------------
// Op.interpret — exclusive
// ---------------------------------------------------------------------------

test("Op.interpret exclusive emits Pending then Ok on success", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive" });
	const states = await runAndCollect(manager, 10);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 10 }]);
});

test("Op.interpret exclusive drops second run while in-flight — no extra state emitted", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "exclusive" });
	const states: Op.ExclusiveState<string, number>[] = [];
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			states.push(s);
			if (Op.isOk(s)) { resolve(); }
		});
	});
	manager.run(1); // starts
	manager.run(2); // dropped — no state change
	await done;
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 1 }]);
});

test("Op.interpret exclusive abort emits Nil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "exclusive" });
	const states: Op.ExclusiveState<string, number>[] = [];
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			states.push(s);
			if (Op.isNil(s)) { resolve(); }
		});
	});
	manager.run(1);
	manager.abort();
	await done;
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpNil", reason: "aborted" }]);
});

// ---------------------------------------------------------------------------
// Op.interpret — queue
// ---------------------------------------------------------------------------

test("Op.interpret queue runs calls in submission order", async () => {
	const results: number[] = [];
	const manager = Op.interpret(delayedOp(10), { strategy: "queue" });
	const done = new Promise<void>((resolve) => {
		let okCount = 0;
		manager.subscribe((s) => {
			if (Op.isOk(s)) {
				results.push((s as Op.Ok<number>).value);
				okCount++;
				if (okCount === 3) { resolve(); }
			}
		});
	});
	manager.run(1);
	manager.run(2);
	manager.run(3);
	await done;
	expect(results).toStrictEqual([1, 2, 3]);
});

test("Op.interpret queue emits Queued state for waiting call", async () => {
	const states: Op.QueueState<string, number>[] = [];
	const manager = Op.interpret(delayedOp(30), { strategy: "queue" });
	const done = new Promise<void>((resolve) => {
		let okCount = 0;
		manager.subscribe((s) => {
			states.push(s);
			if (Op.isOk(s)) {
				okCount++;
				if (okCount === 2) { resolve(); }
			}
		});
	});
	manager.run(1);
	// Yield to microtasks so isRunning becomes true before run(2) checks it
	await Promise.resolve();
	manager.run(2);
	await done;
	expect(states[0]).toStrictEqual({ kind: "Pending" });
	expect(states[1]).toStrictEqual({ kind: "Queued", position: 0 });
	expect(states[2]).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(states[3]).toStrictEqual({ kind: "Pending" });
	expect(states[4]).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("Op.interpret queue abort drains queue — emits Nil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "queue" });
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			if (Op.isNil(s)) { resolve(); }
		});
	});
	manager.run(1);
	manager.run(2);
	// Yield to microtasks so the first run starts (isRunning = true, state = Pending)
	// before abort() checks whether there is anything to cancel.
	await Promise.resolve();
	manager.abort();
	await done;
	expect(manager.state).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

// ---------------------------------------------------------------------------
// Op.interpret — buffered
// ---------------------------------------------------------------------------

test("Op.interpret buffered in-flight always completes before waiting slot runs", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "buffered" });
	const okValues: number[] = [];
	const done = new Promise<void>((resolve) => {
		let okCount = 0;
		manager.subscribe((s) => {
			if (Op.isOk(s)) {
				okValues.push((s as Op.Ok<number>).value);
				okCount++;
				if (okCount === 2) { resolve(); }
			}
		});
	});
	manager.run(1); // starts immediately
	manager.run(2); // waits in slot
	await done;
	expect(okValues).toStrictEqual([1, 2]);
});

test("Op.interpret buffered newer call replaces waiting slot", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "buffered" });
	const okValues: number[] = [];
	const done = new Promise<void>((resolve) => {
		let okCount = 0;
		manager.subscribe((s) => {
			if (Op.isOk(s)) {
				okValues.push((s as Op.Ok<number>).value);
				okCount++;
				if (okCount === 2) { resolve(); }
			}
		});
	});
	manager.run(1); // in-flight
	manager.run(2); // waiting slot
	manager.run(3); // replaces slot — run(2) is dropped
	await done;
	expect(okValues).toStrictEqual([1, 3]); // run(2) was replaced
});

test("Op.interpret buffered abort emits Nil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "buffered" });
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			if (Op.isNil(s)) { resolve(); }
		});
	});
	manager.run(1);
	manager.run(2);
	manager.abort();
	await done;
	expect(manager.state).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

// ---------------------------------------------------------------------------
// Op.interpret — debounced
// ---------------------------------------------------------------------------

test("Op.interpret debounced waits for idle period before running", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(20) });
	expect(manager.state).toStrictEqual({ kind: "Idle" }); // state does not change immediately
	const states = await runAndCollect(manager, 42);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 42 }]);
});

test("Op.interpret debounced resets timer on new call — only latest input runs", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (input: number) => {
		calls++;
		return Promise.resolve(input);
	}, String);
	const manager = Op.interpret(op, { strategy: "debounced", duration: Duration.milliseconds(20) });
	const states: Op.DebouncedState<string, number>[] = [];
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			states.push(s);
			if (Op.isOk(s) || Op.isErr(s) || Op.isNil(s)) { resolve(); }
		});
	});
	manager.run(1); // timer starts
	await new Promise((r) => setTimeout(r, 10)); // wait 10ms (timer has 10ms left)
	manager.run(2); // resets timer
	await done;
	expect(calls).toBe(1); // only one factory invocation
	expect(states.at(-1)).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("Op.interpret debounced abort cancels pending timer — state stays Idle", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(50) });
	manager.run(1); // timer starts; state stays Idle
	manager.abort(); // clears timer; state is Idle so no Nil emitted
	await new Promise((r) => setTimeout(r, 100)); // wait past the timer deadline
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

// ---------------------------------------------------------------------------
// Op.interpret — once
// ---------------------------------------------------------------------------

test("Op.interpret once emits Pending then Ok on success", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	const states = await runAndCollect(manager, 7);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 7 }]);
});

test("Op.interpret once emits Pending then Err on failure", async () => {
	const manager = Op.interpret(failingOp("boom"), { strategy: "once" });
	const states = await runAndCollect(manager, 1);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpErr", error: "boom" }]);
});

test("Op.interpret once subsequent start() calls are ignored — only first runs", async () => {
	let calls = 0;
	const op = Op.create((signal) => (input: number) =>
		new Promise<number>((resolve, reject) => {
			calls++;
			const id = setTimeout(() => resolve(input), 20);
			signal.addEventListener("abort", () => {
				clearTimeout(id);
				reject(new Error("abort"));
			}, { once: true });
		}), String);
	const manager = Op.interpret(op, { strategy: "once" });
	const states: Op.State<string, number>[] = [];
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			states.push(s);
			if (Op.isOk(s) || Op.isErr(s) || Op.isNil(s)) { resolve(); }
		});
	});
	manager.run(1); // fires
	manager.run(2); // ignored — operation already started
	manager.run(3); // ignored
	await done;
	expect(calls).toBe(1);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 1 }]);
});

test("Op.interpret once state is permanent after completion — further start() is no-op", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	const states = await runAndCollect(manager, 5);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 5 }]);
	// Operation has completed — further calls must not change state
	manager.run(99);
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 5 });
});

test("Op.interpret once abort() emits Nil and further start() is no-op", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "once" });
	const states: Op.State<string, number>[] = [];
	manager.subscribe((s) => states.push(s));
	manager.run(1);
	manager.abort();
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpNil", reason: "aborted" }]);
	manager.run(2); // no-op — state is Nil (not Idle)
	expect(manager.state).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("Op.interpret once with retry — retries on Err, then settles", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (_: number) => {
		calls++;
		return calls < 3 ? Promise.reject(new Error("not yet")) : Promise.resolve(99);
	}, (e) => (e as Error).message);
	const manager = Op.interpret(op, { strategy: "once", retry: { attempts: 5 } });
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states.at(-1)).toStrictEqual({ kind: "OpOk", value: 99 });
});

// ---------------------------------------------------------------------------
// Per-invocation results — run() returns Deferred<Outcome>
// ---------------------------------------------------------------------------

test("Op.interpret restartable run() returns the invocation's outcome", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	const result = await manager.run(42);
	expect(result).toStrictEqual({ kind: "OpOk", value: 42 });
});

test("Op.interpret restartable second run() resolves first Deferred with ReplacedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "restartable" });
	const first = manager.run(1);
	const second = manager.run(2);
	const [r1, r2] = await Promise.all([first, second]);
	expect(r1).toStrictEqual({ kind: "OpNil", reason: "replaced" });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("Op.interpret restartable abort() resolves in-flight Deferred with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "restartable" });
	const p = manager.run(1);
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("Op.interpret exclusive run() returns the invocation's outcome", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive" });
	const result = await manager.run(10);
	expect(result).toStrictEqual({ kind: "OpOk", value: 10 });
});

test("Op.interpret exclusive second run() while in-flight immediately resolves to DroppedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "exclusive" });
	const first = manager.run(1);
	const second = manager.run(2); // dropped
	await expect(second).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await expect(first).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
});

test("Op.interpret exclusive abort() resolves in-flight Deferred with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "exclusive" });
	const p = manager.run(1);
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("Op.interpret queue each run() resolves to its own outcome in order", async () => {
	const manager = Op.interpret(delayedOp(10), { strategy: "queue" });
	const [r1, r2, r3] = await Promise.all([manager.run(1), manager.run(2), manager.run(3)]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
	expect(r3).toStrictEqual({ kind: "OpOk", value: 3 });
});

test("Op.interpret queue abort() resolves all queued Deferreds with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "queue" });
	const p1 = manager.run(1);
	const p2 = manager.run(2);
	// Yield so the first run actually starts before we abort
	await Promise.resolve();
	manager.abort();
	const [r1, r2] = await Promise.all([p1, p2]);
	expect(r1).toStrictEqual({ kind: "OpNil", reason: "aborted" });
	expect(r2).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("Op.interpret buffered run() resolves to its own Ok outcome", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "buffered" });
	const result = await manager.run(5);
	expect(result).toStrictEqual({ kind: "OpOk", value: 5 });
});

test("Op.interpret buffered third run() evicts waiting slot — evicted Deferred resolves to EvictedNil", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "buffered" });
	const p1 = manager.run(1); // in-flight
	const p2 = manager.run(2); // waiting slot
	const p3 = manager.run(3); // evicts p2
	const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpNil", reason: "evicted" });
	expect(r3).toStrictEqual({ kind: "OpOk", value: 3 });
});

test("Op.interpret buffered abort() resolves in-flight and waiting Deferreds with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "buffered" });
	const p1 = manager.run(1);
	const p2 = manager.run(2);
	manager.abort();
	const [r1, r2] = await Promise.all([p1, p2]);
	expect(r1).toStrictEqual({ kind: "OpNil", reason: "aborted" });
	expect(r2).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("Op.interpret debounced run() resolves to Ok after timer fires", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(10) });
	const result = await manager.run(7);
	expect(result).toStrictEqual({ kind: "OpOk", value: 7 });
});

test("Op.interpret debounced second run() before timer evicts first — first Deferred resolves to EvictedNil", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(30) });
	const p1 = manager.run(1);
	await new Promise((r) => setTimeout(r, 10)); // still within debounce window
	const p2 = manager.run(2); // resets timer, evicts p1
	const [r1, r2] = await Promise.all([p1, p2]);
	expect(r1).toStrictEqual({ kind: "OpNil", reason: "evicted" });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("Op.interpret debounced abort() before timer resolves pending Deferred with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(50) });
	const p = manager.run(1);
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("Op.interpret debounced abort() after timer fires resolves in-flight Deferred with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "debounced", duration: Duration.milliseconds(10) });
	const p = manager.run(1);
	await new Promise((r) => setTimeout(r, 20)); // wait past the debounce; operation is now in-flight
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("Op.interpret once run() resolves to the Ok outcome", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	const result = await manager.run(3);
	expect(result).toStrictEqual({ kind: "OpOk", value: 3 });
});

test("Op.interpret once subsequent run() calls immediately resolve to DroppedNil", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "once" });
	const p1 = manager.run(1);
	const p2 = manager.run(2); // dropped
	const p3 = manager.run(3); // dropped
	const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpNil", reason: "dropped" });
	expect(r3).toStrictEqual({ kind: "OpNil", reason: "dropped" });
});

test("Op.interpret once abort() resolves in-flight Deferred with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "once" });
	const p = manager.run(1);
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("Op.interpret once abort() on idle manager does nothing", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort(); // state is Idle — no emit, no resolve to call
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("Op.interpret once subscribe after run started fires immediately with current state", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "once" });
	manager.run(1);
	const received: Op.State<string, number>[] = [];
	manager.subscribe((s) => received.push(s));
	expect(received[0]).toStrictEqual({ kind: "Pending" }); // immediate callback: state is non-Idle
	manager.abort();
});

// ---------------------------------------------------------------------------
// Op.all and Op.race
// ---------------------------------------------------------------------------

test("Op.all resolves when all invocations settle", async () => {
	const manager = Op.interpret(delayedOp(10), { strategy: "queue" });
	const results = await Op.all([manager.run(1), manager.run(2), manager.run(3)]);
	expect(results).toStrictEqual([{ kind: "OpOk", value: 1 }, { kind: "OpOk", value: 2 }, { kind: "OpOk", value: 3 }]);
});

test("Op.all preserves outcome types including Nil", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "restartable" });
	const p1 = manager.run(1);
	const p2 = manager.run(2); // replaces p1
	const results = await Op.all([p1, p2]);
	expect(results[0]).toStrictEqual({ kind: "OpNil", reason: "replaced" });
	expect(results[1]).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("Op.race resolves to the first invocation that settles", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "restartable" });
	const p1 = manager.run(1); // replaced immediately, settles first with ReplacedNil
	const p2 = manager.run(2);
	const winner = await Op.race([p1, p2]);
	expect(winner).toStrictEqual({ kind: "OpNil", reason: "replaced" });
});

// ---------------------------------------------------------------------------
// Op.interpret — throttled (leading-only)
// ---------------------------------------------------------------------------

test("Op.interpret throttled fires immediately on the first run()", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(50) });
	const states = await runAndCollect(manager, 42);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 42 }]);
});

test("Op.interpret throttled run() during cooldown returns DroppedNil immediately", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(50) });
	const p1 = manager.run(1);
	const p2 = manager.run(2); // cooldown active — dropped
	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
});

test("Op.interpret throttled run() after cooldown fires as a new leading edge", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(20) });
	await manager.run(1);
	await new Promise((r) => setTimeout(r, 30)); // wait past cooldown
	const result = await manager.run(2);
	expect(result).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("Op.interpret throttled abort() cancels in-flight and clears cooldown", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "throttled", duration: Duration.milliseconds(100) });
	const p = manager.run(1);
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
	expect(manager.state).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("Op.interpret throttled subscribe after run started fires immediately with current state", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "throttled", duration: Duration.milliseconds(0) });
	manager.run(1);
	const received: Op.State<string, number>[] = [];
	manager.subscribe((s) => received.push(s));
	// state is Pending — subscriber fires immediately
	expect(received[0]).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

// ---------------------------------------------------------------------------
// Op.interpret — throttled (trailing: true)
// ---------------------------------------------------------------------------

test("Op.interpret throttled trailing fires trailing call after cooldown", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (input: number) => {
		calls++;
		return Promise.resolve(input);
	}, String);
	const manager = Op.interpret(op, { strategy: "throttled", duration: Duration.milliseconds(20), trailing: true });
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			if (Op.isOk(s) && s.value === 2) { resolve(); }
		});
	});
	manager.run(1); // fires immediately (leading)
	await new Promise((r) => setTimeout(r, 5));
	manager.run(2); // buffered for trailing
	await done;
	expect(calls).toBe(2); // leading + trailing both fired
});

test("Op.interpret throttled trailing: buffered call evicts previous pending", async () => {
	const manager = Op.interpret(delayedOp(), {
		strategy: "throttled",
		duration: Duration.milliseconds(30),
		trailing: true,
	});
	const p1 = manager.run(1); // fires as leading
	await new Promise((r) => setTimeout(r, 5));
	const p2 = manager.run(2); // buffered for trailing
	const p3 = manager.run(3); // evicts p2 from trailing slot
	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "evicted" });
	await p1; // wait for leading to finish
	await expect(p3).resolves.toStrictEqual({ kind: "OpOk", value: 3 }); // trailing fires with input 3
});

test("Op.interpret throttled trailing abort() clears in-flight and buffered", async () => {
	const manager = Op.interpret(delayedOp(50), {
		strategy: "throttled",
		duration: Duration.milliseconds(200),
		trailing: true,
	});
	const p1 = manager.run(1);
	await new Promise((r) => setTimeout(r, 5));
	const p2 = manager.run(2); // buffered
	manager.abort();
	await expect(p1).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

// ---------------------------------------------------------------------------
// Op.interpret — concurrent
// ---------------------------------------------------------------------------

test("Op.interpret concurrent n=2 runs two operations in parallel", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "concurrent", n: 2, overflow: "drop" });
	const [r1, r2] = await Promise.all([manager.run(1), manager.run(2)]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("Op.interpret concurrent overflow drop: third run() while n=2 slots full returns DroppedNil", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "concurrent", n: 2, overflow: "drop" });
	const p1 = manager.run(1);
	const p2 = manager.run(2);
	const p3 = manager.run(3); // dropped — both slots full
	await expect(p3).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await Promise.all([p1, p2]);
});

test("Op.interpret concurrent overflow queue: third run() waits for a slot", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "concurrent", n: 2, overflow: "queue" });
	const [r1, r2, r3] = await Promise.all([manager.run(1), manager.run(2), manager.run(3)]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
	expect(r3).toStrictEqual({ kind: "OpOk", value: 3 });
});

test("Op.interpret concurrent abort() resolves all in-flight and queued Deferreds with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(100), { strategy: "concurrent", n: 2, overflow: "queue" });
	const p1 = manager.run(1);
	const p2 = manager.run(2);
	const p3 = manager.run(3); // queued
	manager.abort();
	const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
	expect(r1).toStrictEqual({ kind: "OpNil", reason: "aborted" });
	expect(r2).toStrictEqual({ kind: "OpNil", reason: "aborted" });
	expect(r3).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("Op.interpret concurrent overflow queue emits Queued state for waiting run()", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "concurrent", n: 1, overflow: "queue" });
	const states: Op.ConcurrentQueueState<string, number>[] = [];
	manager.subscribe((s) => states.push(s));
	await Promise.all([manager.run(1), manager.run(2)]);
	expect(states).toContainEqual({ kind: "Queued", position: 0 });
});

// ---------------------------------------------------------------------------
// Op.interpret — keyed (exclusive perKey)
// ---------------------------------------------------------------------------

test("Op.interpret keyed exclusive: different keys run in parallel", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	const [r1, r2] = await Promise.all([manager.run(1), manager.run(2)]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("Op.interpret keyed exclusive: same key while in-flight returns DroppedNil", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	const p1 = manager.run(1);
	const p2 = manager.run(1); // same key — dropped
	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
});

test("Op.interpret keyed exclusive: state map reflects per-key state", () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	manager.run(1);
	manager.run(2);
	expect(manager.state.get(1)).toStrictEqual({ kind: "Pending" });
	expect(manager.state.get(2)).toStrictEqual({ kind: "Pending" });
});

test("Op.interpret keyed exclusive: abort(key) cancels only that key", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	const p1 = manager.run(1);
	const p2 = manager.run(2);
	manager.abort(1);
	await expect(p1).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
	await expect(p2).resolves.toStrictEqual({ kind: "OpOk", value: 2 });
});

test("Op.interpret keyed exclusive: abort() cancels all keys", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	const p1 = manager.run(1);
	const p2 = manager.run(2);
	manager.abort();
	const [r1, r2] = await Promise.all([p1, p2]);
	expect(r1).toStrictEqual({ kind: "OpNil", reason: "aborted" });
	expect(r2).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("Op.interpret keyed exclusive: abort(key) for a key not currently active is a no-op", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	manager.abort(99); // key 99 has no active slot — no-op
	const result = await manager.run(1);
	expect(result).toStrictEqual({ kind: "OpOk", value: 1 });
});

test("Op.interpret keyed exclusive: abort() with no active keys is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	manager.abort(); // no active keys — no emit, no resolves
	expect(manager.state.size).toBe(0);
});

test("Op.interpret keyed exclusive: subscribe after run started fires immediately with snapshot", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	manager.run(1);
	const received: ReadonlyMap<number, Op.KeyedExclusivePerKey<string, number>>[] = [];
	manager.subscribe((map) => received.push(map));
	// stateMap.size > 0 — subscriber fires immediately with current snapshot
	expect(received[0]?.get(1)).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

test("Op.interpret keyed exclusive: state map keeps terminal state after completion", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	await manager.run(42);
	expect(manager.state.get(42)).toStrictEqual({ kind: "OpOk", value: 42 });
});

test("Op.interpret keyed exclusive: subscriber fires with snapshot on each transition", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	const snapshots: ReadonlyMap<number, Op.KeyedExclusivePerKey<string, number>>[] = [];
	manager.subscribe((map) => snapshots.push(map));
	await manager.run(1);
	// transitions: Pending → Ok
	expect(snapshots.length).toBeGreaterThanOrEqual(2);
	expect(snapshots.at(-1)?.get(1)).toStrictEqual({ kind: "OpOk", value: 1 });
});

// ---------------------------------------------------------------------------
// Op.interpret — keyed (restartable perKey)
// ---------------------------------------------------------------------------

test("Op.interpret keyed restartable: same key while in-flight cancels previous", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "keyed", key: (n) => n, perKey: "restartable" });
	const p1 = manager.run(1);
	const p2 = manager.run(1); // cancels p1
	await expect(p1).resolves.toStrictEqual({ kind: "OpNil", reason: "replaced" });
	await expect(p2).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
});

test("Op.interpret keyed restartable: different keys still run in parallel", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "keyed", key: (n) => n, perKey: "restartable" });
	const [r1, r2] = await Promise.all([manager.run(1), manager.run(2)]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("Op.interpret keyed type: run() return type for exclusive is narrowed correctly", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n: number) => n, perKey: "exclusive" });
	expectTypeOf(manager.run).returns.toEqualTypeOf<
		import("../Deferred.ts").Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.DroppedNil>
	>();
});

test("Op.interpret keyed type: run() return type for restartable is narrowed correctly", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n: number) => n, perKey: "restartable" });
	expectTypeOf(manager.run).returns.toEqualTypeOf<
		import("../Deferred.ts").Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.ReplacedNil>
	>();
});

// ---------------------------------------------------------------------------
// Op.interpret — debounced leading edge
// ---------------------------------------------------------------------------

test("Op.interpret debounced with leading: true fires immediately on first call", async () => {
	const manager = Op.interpret(delayedOp(), {
		strategy: "debounced",
		duration: Duration.milliseconds(30),
		leading: true,
	});
	const p = manager.run(7);
	expect(manager.state).toStrictEqual({ kind: "Pending" }); // fires immediately, no timer wait
	await expect(p).resolves.toStrictEqual({ kind: "OpOk", value: 7 });
});

test("Op.interpret debounced with leading: true fires trailing call after quiet period", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (input: number) => {
		calls++;
		return Promise.resolve(input);
	}, String);
	const manager = Op.interpret(op, { strategy: "debounced", duration: Duration.milliseconds(30), leading: true });

	const p1 = manager.run(1); // leading fires with input 1
	await new Promise((r) => setTimeout(r, 10)); // within debounce window
	const p2 = manager.run(2); // in window — replaces pending trailing
	// quiet for 30ms → trailing fires with input 2

	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 }); // leading resolved immediately
	await expect(p2).resolves.toStrictEqual({ kind: "OpOk", value: 2 }); // trailing resolved after quiet
	expect(calls).toBe(2);
});

test("Op.interpret debounced with leading: true intermediate calls get EvictedNil", async () => {
	const manager = Op.interpret(delayedOp(), {
		strategy: "debounced",
		duration: Duration.milliseconds(30),
		leading: true,
	});

	const p1 = manager.run(1); // leading
	await new Promise((r) => setTimeout(r, 5));
	const p2 = manager.run(2); // in window
	const p3 = manager.run(3); // in window — evicts p2

	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "evicted" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
	await expect(p3).resolves.toStrictEqual({ kind: "OpOk", value: 3 }); // trailing
});

// ---------------------------------------------------------------------------
// Op.interpret — debounced maxWait
// ---------------------------------------------------------------------------

test("Op.interpret debounced with maxWait fires after maxWait even without quiet period", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (input: number) => {
		calls++;
		return Promise.resolve(input);
	}, String);
	const manager = Op.interpret(op, {
		strategy: "debounced",
		duration: Duration.milliseconds(500),
		maxWait: Duration.milliseconds(50),
	});

	manager.run(1);
	await new Promise((r) => setTimeout(r, 20)); // 20ms in
	manager.run(2);
	await new Promise((r) => setTimeout(r, 20)); // 40ms in
	const last = manager.run(3); // maxWait fires ~10ms from now

	await expect(last).resolves.toStrictEqual({ kind: "OpOk", value: 3 });
	expect(calls).toBe(1); // forced by maxWait
});

// ---------------------------------------------------------------------------
// Op.interpret — restartable minInterval
// ---------------------------------------------------------------------------

test("Op.interpret restartable with minInterval delays restart until interval elapses", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable", minInterval: Duration.milliseconds(80) });

	await manager.run(1); // first run; sets lastStartTime

	const before = Date.now();
	await manager.run(2); // second run; should wait ~80ms
	const elapsed = Date.now() - before;

	expect(elapsed).toBeGreaterThanOrEqual(60);
	await expect(manager.run(3)).resolves.toStrictEqual({ kind: "OpOk", value: 3 });
});

test("Op.interpret restartable with minInterval: rapid re-run cancels previous and respects interval", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable", minInterval: Duration.milliseconds(60) });

	await manager.run(1); // establishes lastStartTime

	const p2 = manager.run(2); // queued with wait
	const p3 = manager.run(3); // cancels p2, queued with wait

	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "replaced" });
	await expect(p3).resolves.toStrictEqual({ kind: "OpOk", value: 3 });
});

// ---------------------------------------------------------------------------
// Op.interpret — exclusive cooldown
// ---------------------------------------------------------------------------

test("Op.interpret exclusive with cooldown drops calls during post-completion cooldown", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive", cooldown: Duration.milliseconds(60) });

	const p1 = manager.run(1);
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 }); // completes immediately

	// during cooldown — dropped
	const p2 = manager.run(2);
	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });

	// after cooldown — succeeds
	await new Promise((r) => setTimeout(r, 70));
	const p3 = manager.run(3);
	await expect(p3).resolves.toStrictEqual({ kind: "OpOk", value: 3 });
});

test("Op.interpret exclusive with cooldown: abort clears cooldown so next run succeeds", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive", cooldown: Duration.milliseconds(200) });

	await manager.run(1);
	manager.abort(); // clears cooldown

	const p2 = manager.run(2);
	await expect(p2).resolves.toStrictEqual({ kind: "OpOk", value: 2 });
});

// ---------------------------------------------------------------------------
// Op.interpret — buffered size
// ---------------------------------------------------------------------------

test("Op.interpret buffered with size: 2 holds two waiting calls", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "buffered", size: 2 });

	const p1 = manager.run(1); // starts immediately
	const p2 = manager.run(2); // buffered at position 0
	const p3 = manager.run(3); // buffered at position 1
	const p4 = manager.run(4); // buffer full — evicts oldest (p2)

	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "evicted" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
	await expect(p3).resolves.toStrictEqual({ kind: "OpOk", value: 3 });
	await expect(p4).resolves.toStrictEqual({ kind: "OpOk", value: 4 });
});

test("Op.interpret buffered with size: 2 processes buffer in FIFO order", async () => {
	const order: number[] = [];
	const op = Op.create((_signal) => (input: number) => {
		order.push(input);
		return Promise.resolve(input);
	}, String);
	const manager = Op.interpret(op, { strategy: "buffered", size: 2 });

	const p1 = manager.run(1); // starts immediately
	const p2 = manager.run(2); // buffer[0]
	const p3 = manager.run(3); // buffer[1]

	await Promise.all([p1, p2, p3]);
	expect(order).toStrictEqual([1, 2, 3]); // FIFO
});

// ---------------------------------------------------------------------------
// Op.interpret — queue maxSize and overflow
// ---------------------------------------------------------------------------

test("Op.interpret queue with maxSize drops new calls when queue is full", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "queue", maxSize: 1 });

	const p1 = manager.run(1); // starts immediately
	const p2 = manager.run(2); // queued (queue full at 1)
	const p3 = manager.run(3); // queue full — dropped

	await expect(p3).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
	await expect(p2).resolves.toStrictEqual({ kind: "OpOk", value: 2 });
});

test("Op.interpret queue with overflow: replace-last evicts queue tail on overflow", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "queue", maxSize: 1, overflow: "replace-last" });

	const p1 = manager.run(1); // starts immediately
	const p2 = manager.run(2); // queued
	const p3 = manager.run(3); // queue full — p2 evicted, p3 queued

	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "evicted" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
	await expect(p3).resolves.toStrictEqual({ kind: "OpOk", value: 3 });
});

// ---------------------------------------------------------------------------
// Op.interpret — queue dedupe
// ---------------------------------------------------------------------------

test("Op.interpret queue with dedupe drops duplicate queued items", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "queue", dedupe: (a, b) => a === b });

	const p1 = manager.run(1); // starts immediately (in-flight)
	const p2 = manager.run(2); // queued
	const p3 = manager.run(2); // dedupes p2 → DroppedNil; p3 queued with input 2

	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" }); // deduped
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
	await expect(p3).resolves.toStrictEqual({ kind: "OpOk", value: 2 }); // ran with input 2
});

// ---------------------------------------------------------------------------
// Op.interpret — queue concurrency
// ---------------------------------------------------------------------------

test("Op.interpret queue with concurrency: 2 runs two items in-flight simultaneously", async () => {
	const startTimes: number[] = [];
	const op = Op.create((signal) => (input: number) =>
		new Promise<number>((resolve, reject) => {
			startTimes.push(Date.now());
			const id = setTimeout(() => resolve(input), 30);
			signal.addEventListener("abort", () => {
				clearTimeout(id);
				reject(new Error("abort"));
			}, { once: true });
		}), String);
	const manager = Op.interpret(op, { strategy: "queue", concurrency: 2 });

	const [r1, r2, r3] = await Promise.all([manager.run(1), manager.run(2), manager.run(3)]);

	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
	expect(r3).toStrictEqual({ kind: "OpOk", value: 3 });
	// first two started nearly simultaneously
	expect(startTimes[1]! - startTimes[0]!).toBeLessThan(10);
});

// ---------------------------------------------------------------------------
// Op.interpret — queue overflow + dedupe combined
// ---------------------------------------------------------------------------

test("Op.interpret queue with overflow: replace-last and dedupe produces DroppedNil and EvictedNil", async () => {
	const manager = Op.interpret(delayedOp(30), {
		strategy: "queue",
		maxSize: 2,
		overflow: "replace-last",
		dedupe: (a, b) => a === b,
	});

	const p1 = manager.run(1); // in-flight
	const p2 = manager.run(10); // queue=[10]
	const p3 = manager.run(10); // dedupes p2 → DroppedNil; queue=[10] (p3 takes p2's slot)
	const p4 = manager.run(20); // queue=[10, 20]
	const p5 = manager.run(30); // queue full, overflow → p4 (tail) evicted; queue=[10, 30]

	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" }); // deduped
	await expect(p4).resolves.toStrictEqual({ kind: "OpNil", reason: "evicted" }); // overflow eviction
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
	await expect(p3).resolves.toStrictEqual({ kind: "OpOk", value: 10 });
	await expect(p5).resolves.toStrictEqual({ kind: "OpOk", value: 30 });
});

// ---------------------------------------------------------------------------
// Op.interpret — retry with queue, buffered, debounced, throttled, concurrent
// ---------------------------------------------------------------------------

test("Op.interpret queue with retry emits Retrying states between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, (e) => (e as Error).message);
	const manager = Op.interpret(op, { strategy: "queue", retry: { attempts: 3 } });
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[0]).toStrictEqual({ kind: "Pending" });
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
	expect(states[2]).toStrictEqual({ kind: "Retrying", attempt: 2, lastError: "fail" });
	expect(states[3]).toStrictEqual({ kind: "OpErr", error: "fail" });
});

test("Op.interpret buffered with retry emits Retrying states between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, (e) => (e as Error).message);
	const manager = Op.interpret(op, { strategy: "buffered", retry: { attempts: 3 } });
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[0]).toStrictEqual({ kind: "Pending" });
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
	expect(states[2]).toStrictEqual({ kind: "Retrying", attempt: 2, lastError: "fail" });
	expect(states[3]).toStrictEqual({ kind: "OpErr", error: "fail" });
});

test("Op.interpret debounced leading with retry emits Retrying states between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, (e) => (e as Error).message);
	const manager = Op.interpret(op, {
		strategy: "debounced",
		duration: Duration.milliseconds(0),
		leading: true,
		retry: { attempts: 3 },
	});
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[0]).toStrictEqual({ kind: "Pending" });
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
	expect(states[2]).toStrictEqual({ kind: "Retrying", attempt: 2, lastError: "fail" });
	expect(states[3]).toStrictEqual({ kind: "OpErr", error: "fail" });
});

test("Op.interpret debounced trailing with retry emits Retrying states between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, (e) => (e as Error).message);
	const manager = Op.interpret(op, {
		strategy: "debounced",
		duration: Duration.milliseconds(10),
		retry: { attempts: 3 },
	});
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[0]).toStrictEqual({ kind: "Pending" });
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
	expect(states[2]).toStrictEqual({ kind: "Retrying", attempt: 2, lastError: "fail" });
	expect(states[3]).toStrictEqual({ kind: "OpErr", error: "fail" });
});

test("Op.interpret throttled with retry emits Retrying states between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, (e) => (e as Error).message);
	const manager = Op.interpret(op, {
		strategy: "throttled",
		duration: Duration.milliseconds(0),
		retry: { attempts: 3 },
	});
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[0]).toStrictEqual({ kind: "Pending" });
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
	expect(states[2]).toStrictEqual({ kind: "Retrying", attempt: 2, lastError: "fail" });
	expect(states[3]).toStrictEqual({ kind: "OpErr", error: "fail" });
});

test("Op.interpret concurrent with retry emits Retrying states between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, (e) => (e as Error).message);
	const manager = Op.interpret(op, { strategy: "concurrent", n: 1, overflow: "drop", retry: { attempts: 3 } });
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[0]).toStrictEqual({ kind: "Pending" });
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
	expect(states[2]).toStrictEqual({ kind: "Retrying", attempt: 2, lastError: "fail" });
	expect(states[3]).toStrictEqual({ kind: "OpErr", error: "fail" });
});

// ---------------------------------------------------------------------------
// Op.interpret — manager.state getter for exclusive and concurrent
// ---------------------------------------------------------------------------

test("op.interpret exclusive manager.state returns current state", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "exclusive" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	const p = manager.run(1);
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	await p;
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 1 });
});

test("op.interpret concurrent manager.state returns current state", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "concurrent", n: 1, overflow: "drop" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	const p = manager.run(1);
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	await p;
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 1 });
});

test("Op.interpret concurrent abort() on idle manager does nothing", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "concurrent", n: 2, overflow: "drop" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort(); // no in-flight ops — no emit
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("Op.interpret concurrent subscribe after run started fires immediately with current state", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "concurrent", n: 1, overflow: "drop" });
	manager.run(1);
	const received: Op.State<string, number>[] = [];
	manager.subscribe((s) => received.push(s));
	// state is Pending — subscriber fires immediately
	expect(received[0]).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

// ---------------------------------------------------------------------------
// Op.interpret — default parameter values (Op.ts branch coverage)
// ---------------------------------------------------------------------------

test("Op.interpret debounced without ms or leading uses ms=0 and leading=false defaults", async () => {
	// Exercises options.ms ?? 0 and options.leading ?? false in the interpret switch
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const manager = Op.interpret(delayedOp(), { strategy: "debounced" } as any);
	await expect(manager.run(42)).resolves.toStrictEqual({ kind: "OpOk", value: 42 });
});

test("Op.interpret throttled without ms or trailing uses ms=0 and trailing=false defaults", async () => {
	// Exercises options.ms ?? 0 and options.trailing ?? false in the interpret switch
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const manager = Op.interpret(delayedOp(), { strategy: "throttled" } as any);
	await expect(manager.run(42)).resolves.toStrictEqual({ kind: "OpOk", value: 42 });
});

test("Op.interpret concurrent without n or overflow uses n=1 and overflow=drop defaults", async () => {
	// Exercises options.n ?? 1 and options.overflow ?? "drop" in the interpret switch
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const manager = Op.interpret(delayedOp(20), { strategy: "concurrent" } as any);
	const p1 = manager.run(1); // fills the single slot (n=1 default)
	const p2 = manager.run(2); // dropped — overflow=drop default
	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
});

test("Op.interpret keyed without key or perKey uses identity key and exclusive defaults", async () => {
	// Exercises options.key ?? identity and options.perKey ?? "exclusive" in the interpret switch
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const manager = Op.interpret(delayedOp(20), { strategy: "keyed" } as any);
	const p1 = manager.run(1);
	const p2 = manager.run(1); // identity key → same key → exclusive drops
	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
});

// ---------------------------------------------------------------------------
// runWithRetry — numeric backoff (lines 56, 70-73)
// ---------------------------------------------------------------------------

test("Op.interpret restartable with numeric backoff emits Retrying with nextRetryIn", async () => {
	// Covers the `backoff` as a plain number branch (line 56) and the ms>0 nextRetryIn path (lines 70-73)
	let calls = 0;
	const op = Op.create((_signal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, (e) => (e as Error).message);
	const manager = Op.interpret(op, {
		strategy: "restartable",
		retry: { attempts: 3, backoff: Duration.milliseconds(50) },
	});
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail", nextRetryIn: 50 });
	expect(states[2]).toStrictEqual({ kind: "Retrying", attempt: 2, lastError: "fail", nextRetryIn: 50 });
	expect(states.at(-1)).toStrictEqual({ kind: "OpErr", error: "fail" });
});

test("Op.interpret exclusive with numeric backoff emits Retrying with nextRetryIn", async () => {
	let calls = 0;
	const op = Op.create((_signal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, (e) => (e as Error).message);
	const manager = Op.interpret(op, {
		strategy: "exclusive",
		retry: { attempts: 3, backoff: Duration.milliseconds(50) },
	});
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail", nextRetryIn: 50 });
});

// ---------------------------------------------------------------------------
// abort() on idle manager — false branch of `if (currentState.kind !== "Idle")`
// ---------------------------------------------------------------------------

test("Op.interpret restartable abort() on idle manager is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort();
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("Op.interpret exclusive abort() on idle manager is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort();
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("Op.interpret queue abort() on idle manager is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "queue" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort();
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("Op.interpret buffered abort() on idle manager is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "buffered" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort();
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("Op.interpret debounced abort() on idle manager is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(50) });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort();
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("Op.interpret throttled abort() on idle manager is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(50) });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort();
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

// ---------------------------------------------------------------------------
// manager.state getter and subscribe initial-callback for queue, buffered,
// debounced, throttled (ensures get state() and the non-Idle subscribe path)
// ---------------------------------------------------------------------------

test("op.interpret queue manager.state returns current state", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "queue" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	const p = manager.run(1);
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	await p;
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 1 });
});

test("Op.interpret queue subscribe after run started fires immediately with current state", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "queue" });
	manager.run(1);
	const received: Op.State<string, number>[] = [];
	manager.subscribe((s) => received.push(s));
	expect(received[0]).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

test("op.interpret buffered manager.state returns current state", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "buffered" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	const p = manager.run(1);
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	await p;
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 1 });
});

test("Op.interpret buffered subscribe after run started fires immediately with current state", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "buffered" });
	manager.run(1);
	const received: Op.State<string, number>[] = [];
	manager.subscribe((s) => received.push(s));
	expect(received[0]).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

test("op.interpret debounced manager.state returns current state after timer fires", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "debounced", duration: Duration.milliseconds(10) });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	const p = manager.run(1);
	await new Promise((r) => setTimeout(r, 15)); // wait for debounce to fire
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	await p;
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 1 });
});

test("Op.interpret debounced subscribe after op starts fires immediately with current state", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "debounced", duration: Duration.milliseconds(10) });
	manager.run(1);
	await new Promise((r) => setTimeout(r, 15)); // wait for debounce timer to fire
	const received: Op.State<string, number>[] = [];
	manager.subscribe((s) => received.push(s));
	expect(received[0]).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

test("op.interpret throttled manager.state returns current state", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "throttled", duration: Duration.milliseconds(0) });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	const p = manager.run(1);
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	await p;
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 1 });
});

// ---------------------------------------------------------------------------
// Debounced with leading=true: abort() while leading execution is in-flight
// ---------------------------------------------------------------------------

test("Op.interpret debounced leading abort() while in-flight resolves with AbortedNil", async () => {
	// Covers line 560: `if (leadingController !== controller) return` true branch in fireLeading.then()
	const manager = Op.interpret(delayedOp(100), {
		strategy: "debounced",
		duration: Duration.milliseconds(0),
		leading: true,
	});
	const p = manager.run(1); // fires immediately (leading)
	// leading is in-flight; now abort while it runs
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

// ---------------------------------------------------------------------------
// manager.reset
// ---------------------------------------------------------------------------

test("manager.reset returns state to Idle after Ok", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	await manager.run(1);
	expect(manager.state.kind).toBe("OpOk");
	manager.reset();
	expect(manager.state.kind).toBe("Idle");
});

test("manager.reset notifies subscribers with Idle", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	await manager.run(1);
	const states: string[] = [];
	manager.subscribe((s) => states.push(s.kind));
	manager.reset();
	expect(states).toContain("Idle");
});

test("manager.reset does nothing when already Idle", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	expect(manager.state.kind).toBe("Idle");
	manager.reset();
	expect(manager.state.kind).toBe("Idle");
});

// ---------------------------------------------------------------------------
// manager.poll
// ---------------------------------------------------------------------------

test("manager.poll runs immediately on first call", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	const stop = manager.poll(1, { interval: Duration.milliseconds(10_000) });
	// Wait for the immediate run to complete
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.isOk(s)) {
				unsub();
				resolve();
			}
		});
	});
	stop();
	expect(manager.state.kind).toBe("OpOk");
});

test("manager.poll stop handle cancels future runs", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	let runCount = 0;
	manager.subscribe((s) => {
		if (Op.isOk(s)) { runCount++; }
	});
	const stop = manager.poll(1, { interval: Duration.milliseconds(50) });
	// Wait for first run
	await new Promise((r) => setTimeout(r, 20));
	stop();
	const countAfterStop = runCount;
	// Wait long enough for what would have been 2+ more intervals
	await new Promise((r) => setTimeout(r, 150));
	expect(runCount).toBe(countAfterStop);
});

test("manager.reset works for exclusive strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive" });
	await manager.run(1);
	manager.reset();
	expect(Op.isIdle(manager.state)).toBe(true);
});

test("manager.reset works for queue strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "queue" });
	await manager.run(1);
	manager.reset();
	expect(Op.isIdle(manager.state)).toBe(true);
});

test("manager.reset works for buffered strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "buffered" });
	await manager.run(1);
	manager.reset();
	expect(Op.isIdle(manager.state)).toBe(true);
});

test("manager.reset works for debounced strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(10) });
	await manager.run(1);
	manager.reset();
	expect(Op.isIdle(manager.state)).toBe(true);
});

test("manager.reset works for throttled strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(10) });
	await manager.run(1);
	manager.reset();
	expect(Op.isIdle(manager.state)).toBe(true);
});

test("manager.reset works for concurrent strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "concurrent", n: 2 });
	await manager.run(1);
	manager.reset();
	expect(Op.isIdle(manager.state)).toBe(true);
});

test("manager.reset works for once strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	await manager.run(1);
	manager.reset();
	expect(Op.isIdle(manager.state)).toBe(true);
});

test("manager.poll works for exclusive strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive" });
	const stop = manager.poll(1, { interval: Duration.milliseconds(10_000) });
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.isOk(s)) {
				unsub();
				resolve();
			}
		});
	});
	stop();
	expect(Op.isOk(manager.state)).toBe(true);
});

test("manager.poll works for once strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	const stop = manager.poll(1, { interval: Duration.milliseconds(10_000) });
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.isOk(s)) {
				unsub();
				resolve();
			}
		});
	});
	stop();
	expect(Op.isOk(manager.state)).toBe(true);
});

test("manager.poll works for queue strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "queue" });
	const stop = manager.poll(1, { interval: Duration.milliseconds(10_000) });
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.isOk(s)) {
				unsub?.();
				resolve();
			}
		});
	});
	stop();
	expect(Op.isOk(manager.state)).toBe(true);
});

test("manager.poll works for buffered strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "buffered" });
	const stop = manager.poll(1, { interval: Duration.milliseconds(10_000) });
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.isOk(s)) {
				unsub?.();
				resolve();
			}
		});
	});
	stop();
	expect(Op.isOk(manager.state)).toBe(true);
});

test("manager.poll works for debounced strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(0) });
	const stop = manager.poll(1, { interval: Duration.milliseconds(10_000) });
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.isOk(s)) {
				unsub?.();
				resolve();
			}
		});
	});
	stop();
	expect(Op.isOk(manager.state)).toBe(true);
});

test("manager.poll works for concurrent strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "concurrent", n: 2 });
	const stop = manager.poll(1, { interval: Duration.milliseconds(10_000) });
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.isOk(s)) {
				unsub?.();
				resolve();
			}
		});
	});
	stop();
	expect(Op.isOk(manager.state)).toBe(true);
});

test("manager.poll works for throttled strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(10_000) });
	const stop = manager.poll(1, { interval: Duration.milliseconds(10_000) });
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.isOk(s)) {
				unsub();
				resolve();
			}
		});
	});
	stop();
	expect(Op.isOk(manager.state)).toBe(true);
});

test("keyed manager.reset clears all per-key state", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n: number) => n });
	await manager.run(1);
	await manager.run(2);
	expect(manager.state.size).toBe(2);
	manager.reset();
	expect(manager.state.size).toBe(0);
});

test("keyed manager.poll runs immediately and can be stopped", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n: number) => n });
	const stop = manager.poll(1, { interval: Duration.milliseconds(10_000) });
	await new Promise<void>((resolve) => {
		// oxlint-disable-next-line prefer-const -- TDZ: subscribe fires immediately, const would crash
		let unsub: () => void;
		unsub = manager.subscribe((m) => {
			if (m.size > 0) {
				unsub?.();
				resolve();
			}
		});
	});
	stop();
	expect(manager.state.size).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// wire
// ---------------------------------------------------------------------------

test("Op.wire calls f when source reaches OpOk", async () => {
	const source = Op.interpret(delayedOp(), { strategy: "restartable" });
	const received: number[] = [];
	const stop = Op.wire(source, (n) => received.push(n));
	await source.run(42);
	stop();
	expect(received).toStrictEqual([42]);
});

test("Op.wire does not call f for OpErr state", async () => {
	const source = Op.interpret(failingOp("boom"), { strategy: "restartable" });
	const received: unknown[] = [];
	const stop = Op.wire(source, (n) => received.push(n));
	await source.run(0);
	stop();
	expect(received).toStrictEqual([]);
});

test("Op.wire stop handle removes the subscription", async () => {
	const source = Op.interpret(delayedOp(), { strategy: "restartable" });
	const received: number[] = [];
	const stop = Op.wire(source, (n) => received.push(n));
	stop();
	await source.run(1);
	expect(received).toStrictEqual([]);
});

// ---------------------------------------------------------------------------
// Duration Support
// ---------------------------------------------------------------------------

test("duration support: debounced strategy with Duration", async () => {
	const manager = Op.interpret(delayedOp(), {
		strategy: "debounced",
		duration: Duration.milliseconds(10),
		maxWait: Duration.milliseconds(20),
	});
	const run = manager.run(42);
	const outcome = await run;
	expect(outcome).toStrictEqual(Op.ok(42));
});

test("duration support: throttled strategy with Duration", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(10) });
	const outcome = await manager.run(42);
	expect(outcome).toStrictEqual(Op.ok(42));
});

test("duration support: exclusive strategy with Duration cooldown", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive", cooldown: Duration.milliseconds(10) });
	const outcome = await manager.run(42);
	expect(outcome).toStrictEqual(Op.ok(42));
});

test("duration support: restartable strategy with Duration minInterval", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable", minInterval: Duration.milliseconds(10) });
	const outcome = await manager.run(42);
	expect(outcome).toStrictEqual(Op.ok(42));
});

test("duration support: retry policy with Duration backoff", async () => {
	let attempt = 0;
	const op = Op.create((_signal) => (_: number) => {
		attempt++;
		if (attempt < 2) { return Promise.reject(new Error("fail")); }
		return Promise.resolve(42);
	}, (e) => String(e));
	const manager = Op.interpret(op, {
		strategy: "restartable",
		retry: { attempts: 2, backoff: Duration.milliseconds(5) },
	});
	const outcome = await manager.run(1);
	expect(outcome).toStrictEqual(Op.ok(42));
});

test("duration support: retry policy with Duration backoff function", async () => {
	let attempt = 0;
	const op = Op.create((_signal) => (_: number) => {
		attempt++;
		if (attempt < 2) { return Promise.reject(new Error("fail")); }
		return Promise.resolve(42);
	}, (e) => String(e));
	const manager = Op.interpret(op, {
		strategy: "restartable",
		retry: { attempts: 2, backoff: (n) => Duration.milliseconds(n * 2) },
	});
	const outcome = await manager.run(1);
	expect(outcome).toStrictEqual(Op.ok(42));
});

test("duration support: timeout policy with Duration", async () => {
	const op = Op.create((signal) => (_: number) =>
		new Promise<number>((_resolve, reject) => {
			signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
		}), (e) => String(e));
	const manager = Op.interpret(op, {
		strategy: "restartable",
		timeout: { duration: Duration.milliseconds(5), onTimeout: () => "timeout" },
	});
	const outcome = await manager.run(1);
	expect(outcome).toStrictEqual(Op.err("timeout"));
});

test("duration support: manager.poll with Duration interval", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	const stop = manager.poll(1, { interval: Duration.milliseconds(10_000) });
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.isOk(s)) {
				unsub();
				resolve();
			}
		});
	});
	stop();
	expect(Op.isOk(manager.state)).toBe(true);
});
