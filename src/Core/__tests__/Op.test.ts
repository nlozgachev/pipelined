import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../../Types/Duration.ts";
import { Deferred } from "../Deferred.ts";
import { Maybe } from "../Maybe.ts";
import { Op } from "../Op.ts";
import { Result } from "../Result.ts";

// --- Helpers ---

/** Op that resolves with the input value after an optional delay. */
const delayedOp = (delayMs = 0): Op<[input: number], string, number> =>
	Op.create((signal: AbortSignal) => (input: number) =>
		new Promise<number>((resolve, reject) => {
			const id = setTimeout(() => resolve(input), delayMs);
			signal.addEventListener("abort", () => {
				clearTimeout(id);
				reject(new Error("abort"));
			}, { once: true });
		}), { onError: (e) => String(e) });

/** Op that always rejects with `error` after an optional delay. */
const failingOp = (error: string, delayMs = 0): Op<[input: number], string, number> =>
	Op.create((signal: AbortSignal) => (_input: number) =>
		new Promise<never>((_resolve, reject) => {
			const id = setTimeout(() => reject(new Error(error)), delayMs);
			signal.addEventListener("abort", () => {
				clearTimeout(id);
				reject(new Error("abort"));
			}, { once: true });
		}), { onError: (e) => (e as Error).message });

/**
 * Subscribes to a manager, calls run(input), and collects states until a terminal one arrives.
 * Subscribes before run() so the manager is Idle when subscribing (no immediate notification).
 */
const runAndCollect = <Args extends readonly any[], E, A, S extends Op.State<E, A>>(
	manager: Op.Manager<Args, E, A, S>,
	...args: Args
): Promise<S[]> => {
	const states: S[] = [];
	return new Promise((resolve) => {
		const unsub = manager.subscribe((s) => {
			states.push(s);
			if (Op.Outcome.is.ok(s) || Op.Outcome.is.err(s) || Op.Outcome.is.nil(s)) {
				unsub();
				resolve(states);
			}
		});
		manager.run(...args);
	});
};

// --- Op.create ---

test("create: does not expose _factory as an enumerable or public property", () => {
	const op = Op.create((_signal) => () => Promise.resolve(1), { onError: String });
	// @ts-expect-error — _factory is an internal implementation detail and must not be accessible on Op
	const hiddenFactory = op._factory;
	expect(hiddenFactory).toBeUndefined();
	expectTypeOf(op).toEqualTypeOf<Op<[], string, number>>();
	expect("_factory" in op).toBe(false);
	expect(Object.keys(op)).toHaveLength(0);
	expect(Reflect.ownKeys(op).some((k) => typeof k === "symbol")).toBe(true);
});

test("create: infers Op<[]> when factory takes no input", () => {
	const op = Op.create((_signal) => () => Promise.resolve(42), { onError: String });
	expectTypeOf(op).toEqualTypeOf<Op<[], string, number>>();
});

test("create: manager.run accepts no arguments when factory takes no input", async () => {
	const op = Op.create((_signal) => () => Promise.resolve(99), { onError: String });
	const manager = Op.interpret(op, { strategy: "once" });
	// run() with no args must type-check and resolve Ok
	const result = await manager.run();
	expect(result).toStrictEqual(Op.Outcome.make.ok(99));
});

test("create: infers multi-arg action parameters", async () => {
	const op = Op.create((_signal) => (name: string, age: number) => Promise.resolve(`${name}:${age}`), {
		onError: String,
	});
	const manager = Op.interpret(op, { strategy: "once" });
	const result = await manager.run("Alice", 30);
	expect(result).toStrictEqual(Op.Outcome.make.ok("Alice:30"));
});

// --- Op.lift ---

test("lift: creates an op from a plain async function", async () => {
	const op = Op.lift((_signal) => (n: number) => Promise.resolve(n * 2));
	const manager = Op.interpret(op, { strategy: "restartable" });
	const outcome = await manager.run(5);
	expect(Op.Outcome.is.ok(outcome)).toBe(true);
	expect((outcome as Op.Ok<number>).value).toBe(10);
});

test("lift: captures rejection as Err with unknown error type", async () => {
	const op = Op.lift((_signal) => (_: number) => Promise.reject(new Error("boom")));
	const manager = Op.interpret(op, { strategy: "restartable" });
	const outcome = await manager.run(0);
	expect(Op.Outcome.is.err(outcome)).toBe(true);
	expect((outcome as Op.Err<Error>).error.message).toBe("boom");
});

test("lift: passes signal to async function", async () => {
	let capturedSignal: AbortSignal | undefined;
	const op = Op.lift((signal: AbortSignal) => (_: number) => {
		capturedSignal = signal;
		return Promise.resolve(0);
	});
	const manager = Op.interpret(op, { strategy: "restartable" });
	await manager.run(0);
	expect(capturedSignal).toBeInstanceOf(AbortSignal);
});

// --- Outcome constructors ---

test("make.ok: creates an Ok outcome", () => {
	expect(Op.Outcome.make.ok(42)).toStrictEqual({ kind: "OpOk", value: 42 });
});

test("make.err: creates an Err outcome", () => {
	expect(Op.Outcome.make.err("oops")).toStrictEqual({ kind: "OpErr", error: "oops" });
});

test("make.nil: creates a Nil outcome with the given reason", () => {
	expect(Op.Outcome.make.nil("aborted")).toStrictEqual({ kind: "OpNil", reason: "aborted" });
	expect(Op.Outcome.make.nil("dropped")).toStrictEqual({ kind: "OpNil", reason: "dropped" });
	expect(Op.Outcome.make.nil("replaced")).toStrictEqual({ kind: "OpNil", reason: "replaced" });
	expect(Op.Outcome.make.nil("evicted")).toStrictEqual({ kind: "OpNil", reason: "evicted" });
});

// --- Type guards ---

test("Outcome.is.ok: returns true only for Ok", () => {
	const ok = Op.Outcome.make.ok(1) as Op.Outcome<string, number>;
	const e = Op.Outcome.make.err("e") as Op.Outcome<string, number>;
	const n = Op.Outcome.make.nil("aborted") as Op.Outcome<string, number>;
	expect(Op.Outcome.is.ok(ok)).toBe(true);
	expect(Op.Outcome.is.ok(e)).toBe(false);
	expect(Op.Outcome.is.ok(n)).toBe(false);
});

test("Outcome.is.err: returns true only for Err", () => {
	const ok = Op.Outcome.make.ok(1) as Op.Outcome<string, number>;
	const e = Op.Outcome.make.err("e") as Op.Outcome<string, number>;
	const n = Op.Outcome.make.nil("aborted") as Op.Outcome<string, number>;
	expect(Op.Outcome.is.err(e)).toBe(true);
	expect(Op.Outcome.is.err(ok)).toBe(false);
	expect(Op.Outcome.is.err(n)).toBe(false);
});

test("Outcome.is.nil: returns true only for Nil", () => {
	const ok = Op.Outcome.make.ok(1) as Op.Outcome<string, number>;
	const e = Op.Outcome.make.err("e") as Op.Outcome<string, number>;
	const n = Op.Outcome.make.nil("aborted") as Op.Outcome<string, number>;
	expect(Op.Outcome.is.nil(n)).toBe(true);
	expect(Op.Outcome.is.nil(ok)).toBe(false);
	expect(Op.Outcome.is.nil(e)).toBe(false);
});

test("is: contains only lifecycle guards", () => {
	expect("ok" in Op.is).toBe(false);
	expect("err" in Op.is).toBe(false);
	expect("nil" in Op.is).toBe(false);
	expect("idle" in Op.is).toBe(true);
	expect("pending" in Op.is).toBe(true);
	expect("queued" in Op.is).toBe(true);
	expect("retrying" in Op.is).toBe(true);
});

test("is.idle: returns true only for Idle state", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	expect(Op.is.idle(manager.state)).toBe(true);
	const run = manager.run(1);
	expect(Op.is.idle(manager.state)).toBe(false);
	await run;
});

test("is.pending: returns true only for Pending state", () => {
	expect(Op.is.pending({ kind: "Pending" })).toBe(true);
	expect(Op.is.pending({ kind: "Idle" })).toBe(false);
	expect(Op.is.pending(Op.Outcome.make.ok(1))).toBe(false);
});

test("is.queued: returns true only for Queued state", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "queue" });
	manager.run(1);
	manager.run(2);
	expect(Op.is.queued(manager.state)).toBe(true);
	expect(Op.Outcome.is.ok(manager.state)).toBe(false);
	expect(Op.is.idle(manager.state)).toBe(false);
	manager.abort();
	await new Promise((r) => setTimeout(r, 50));
});

test("is.retrying: returns true only for Retrying state", async () => {
	let attempt = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		attempt++;
		if (attempt < 2) { return Promise.reject(new Error("fail")); }
		return Promise.resolve(42);
	}, { onError: (e) => String(e) });
	const manager = Op.interpret(op, {
		strategy: "restartable",
		retry: { attempts: 2, backoff: () => Duration.milliseconds(0) },
	});
	let sawRetrying = false;
	manager.subscribe((s) => {
		if (Op.is.retrying(s)) { sawRetrying = true; }
	});
	await manager.run(1);
	expect(sawRetrying).toBe(true);
});

// --- match ---

const matchCases = { ok: (v: number) => `ok:${v}`, err: (e: string) => `err:${e}`, nil: () => "nil" };

test("match: handles Ok", () => {
	expect(Op.Outcome.match(matchCases)(Op.Outcome.make.ok(5))).toBe("ok:5");
});

test("match: handles Err", () => {
	expect(Op.Outcome.match(matchCases)(Op.Outcome.make.err("boom"))).toBe("err:boom");
});

test("match: handles Nil", () => {
	expect(Op.Outcome.match(matchCases)(Op.Outcome.make.nil("aborted"))).toBe("nil");
});

// --- fold ---

test("fold: handles all three cases", () => {
	const fold = Op.Outcome.fold((e: string) => `err:${e}`, () => "nil", (v: number) => `ok:${v}`);
	expect(fold(Op.Outcome.make.ok(3))).toBe("ok:3");
	expect(fold(Op.Outcome.make.err("x"))).toBe("err:x");
	expect(fold(Op.Outcome.make.nil("aborted"))).toBe("nil");
});

// --- getOrElse ---

test("getOrElse: returns value for Ok", () => {
	expect(Op.Outcome.getOrElse(() => 0)(Op.Outcome.make.ok(42))).toBe(42);
});

test("getOrElse: returns default for Err", () => {
	expect(Op.Outcome.getOrElse(() => 0)(Op.Outcome.make.err("e") as Op.Outcome<string, number>)).toBe(0);
});

test("getOrElse: returns default for Nil", () => {
	expect(Op.Outcome.getOrElse(() => 0)(Op.Outcome.make.nil("aborted") as Op.Outcome<string, number>)).toBe(0);
});

// --- map ---

test("map: transforms Ok value", () => {
	expect(Op.Outcome.map((n: number) => n * 2)(Op.Outcome.make.ok(5))).toStrictEqual(Op.Outcome.make.ok(10));
});

test("map: passes Err through unchanged", () => {
	const outcome = Op.Outcome.make.err("e") as Op.Outcome<string, number>;
	expect(Op.Outcome.map((n: number) => n * 2)(outcome)).toStrictEqual(Op.Outcome.make.err("e"));
});

test("map: passes Nil through unchanged reference", () => {
	const outcome = Op.Outcome.make.nil("aborted") as Op.Outcome<string, number>;
	expect(Op.Outcome.map((n: number) => n * 2)(outcome)).toBe(outcome);
});

// --- mapError ---

test("mapError: transforms Err", () => {
	const outcome = Op.Outcome.make.err("oops") as Op.Outcome<string, number>;
	expect(Op.Outcome.mapError((e: string) => e.toUpperCase())(outcome)).toStrictEqual(Op.Outcome.make.err("OOPS"));
});

test("mapError: passes Ok through unchanged", () => {
	const outcome = Op.Outcome.make.ok(1) as Op.Outcome<string, number>;
	expect(Op.Outcome.mapError((e: string) => e.toUpperCase())(outcome)).toStrictEqual(Op.Outcome.make.ok(1));
});

test("mapError: passes Nil through unchanged reference", () => {
	const outcome = Op.Outcome.make.nil("aborted") as Op.Outcome<string, number>;
	expect(Op.Outcome.mapError((e: string) => e.toUpperCase())(outcome)).toBe(outcome);
});

// --- chain ---

test("chain: runs f on Ok and returns new Outcome", () => {
	const outcome = Op.Outcome.make.ok(5) as Op.Outcome<string, number>;
	expect(Op.Outcome.chain((n: number) => (n > 0 ? Op.Outcome.make.ok(n * 2) : Op.Outcome.make.err("negative")))(outcome))
		.toStrictEqual(Op.Outcome.make.ok(10));
});

test("chain: does not call f on Err", () => {
	let called = false;
	const outcome = Op.Outcome.make.err("e") as Op.Outcome<string, number>;
	const result = Op.Outcome.chain((n: number) => {
		called = true;
		return Op.Outcome.make.ok(n);
	})(outcome);
	expect(called).toBe(false);
	expect(result).toStrictEqual(Op.Outcome.make.err("e"));
});

test("chain: does not call f on Nil", () => {
	let called = false;
	const outcome = Op.Outcome.make.nil("aborted") as Op.Outcome<string, number>;
	const result = Op.Outcome.chain((n: number) => {
		called = true;
		return Op.Outcome.make.ok(n);
	})(outcome);
	expect(called).toBe(false);
	expect(result).toBe(outcome);
});

// --- tap ---

test("tap: runs side effect on Ok and returns unchanged outcome", () => {
	let seen: number | undefined;
	const outcome = Op.Outcome.make.ok(7) as Op.Outcome<string, number>;
	const result = Op.Outcome.tap((n: number) => {
		seen = n;
	})(outcome);
	expect(seen).toBe(7);
	expect(result).toStrictEqual(Op.Outcome.make.ok(7));
});

test("tap: does not run on Err", () => {
	let called = false;
	const outcome = Op.Outcome.make.err("e") as Op.Outcome<string, number>;
	Op.Outcome.tap((_: number) => {
		called = true;
	})(outcome);
	expect(called).toBe(false);
});

test("tap: does not run on Nil", () => {
	let called = false;
	const outcome = Op.Outcome.make.nil("aborted") as Op.Outcome<string, number>;
	Op.Outcome.tap((_: number) => {
		called = true;
	})(outcome);
	expect(called).toBe(false);
});

// --- tapError ---

test("tapError: runs side effect on Err and returns unchanged outcome", () => {
	let seen: string | undefined;
	const outcome = Op.Outcome.make.err("e") as Op.Outcome<string, number>;
	const result = Op.Outcome.tapError((e: string) => {
		seen = e;
	})(outcome);
	expect(seen).toBe("e");
	expect(result).toStrictEqual(Op.Outcome.make.err("e"));
});

test("tapError: does not run on Ok", () => {
	let called = false;
	const outcome = Op.Outcome.make.ok(1) as Op.Outcome<string, number>;
	Op.Outcome.tapError((_: string) => {
		called = true;
	})(outcome);
	expect(called).toBe(false);
});

test("tapError: does not run on Nil", () => {
	let called = false;
	const outcome = Op.Outcome.make.nil("aborted") as Op.Outcome<string, number>;
	Op.Outcome.tapError((_: string) => {
		called = true;
	})(outcome);
	expect(called).toBe(false);
});

// --- recover ---

test("recover: provides fallback on Err", () => {
	const outcome = Op.Outcome.make.err("oops") as Op.Outcome<string, number>;
	expect(Op.Outcome.recover((e: string) => Op.Outcome.make.ok(`recovered:${e}`))(outcome)).toStrictEqual(
		Op.Outcome.make.ok("recovered:oops"),
	);
});

test("recover: does not call f on Ok", () => {
	let called = false;
	const outcome = Op.Outcome.make.ok(5) as Op.Outcome<string, number>;
	const result = Op.Outcome.recover((_: string) => {
		called = true;
		return Op.Outcome.make.ok(0);
	})(outcome);
	expect(called).toBe(false);
	expect(result).toStrictEqual(Op.Outcome.make.ok(5));
});

test("recover: does not call f on Nil", () => {
	let called = false;
	const outcome = Op.Outcome.make.nil("aborted") as Op.Outcome<string, number>;
	const result = Op.Outcome.recover((_: string) => {
		called = true;
		return Op.Outcome.make.ok(0);
	})(outcome);
	expect(called).toBe(false);
	expect(result).toBe(outcome);
});

// --- toResult ---

test("to.Result: converts Ok to Result.make.ok", () => {
	expect(Op.Outcome.to.Result(() => "no-result")(Op.Outcome.make.ok(1))).toStrictEqual(Result.make.ok(1));
});

test("to.Result: converts Err to Result.make.err", () => {
	const outcome = Op.Outcome.make.err("boom") as Op.Outcome<string, number>;
	expect(Op.Outcome.to.Result(() => "no-result")(outcome)).toStrictEqual(Result.make.err("boom"));
});

test("to.Result: converts Nil via onNil", () => {
	const outcome = Op.Outcome.make.nil("aborted") as Op.Outcome<string, number>;
	expect(Op.Outcome.to.Result(() => "no-result")(outcome)).toStrictEqual(Result.make.err("no-result"));
});

// --- toMaybe ---

test("to.Maybe: converts Ok to Some", () => {
	expect(Op.Outcome.to.Maybe(Op.Outcome.make.ok(7))).toStrictEqual(Maybe.make.some(7));
});

test("to.Maybe: converts Err to None", () => {
	expect(Op.Outcome.to.Maybe(Op.Outcome.make.err("e") as Op.Outcome<string, number>)).toStrictEqual(Maybe.make.none());
});

test("to.Maybe: converts Nil to None", () => {
	expect(Op.Outcome.to.Maybe(Op.Outcome.make.nil("aborted") as Op.Outcome<string, number>)).toStrictEqual(
		Maybe.make.none(),
	);
});

// --- Op.interpret — restartable ---

test("interpret: restartable emits Pending then Ok on success", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	const states = await runAndCollect(manager, 42);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 42 }]);
});

test("interpret: restartable emits Pending then Err on failure", async () => {
	const manager = Op.interpret(failingOp("boom"), { strategy: "restartable" });
	const states = await runAndCollect(manager, 1);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpErr", error: "boom" }]);
});

test("interpret: restartable new run cancels previous and emits only latest result", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "restartable" });
	const outcomes: Op.Outcome<string, number>[] = [];
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s) || Op.Outcome.is.err(s) || Op.Outcome.is.nil(s)) {
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

test("interpret: restartable abort emits Nil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "restartable" });
	const states: Op.RestartableState<string, number>[] = [];
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			states.push(s);
			if (Op.Outcome.is.nil(s)) { resolve(); }
		});
	});
	manager.run(1);
	manager.abort();
	await done;
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpNil", reason: "aborted" }]);
});

test("interpret: restartable state is readable synchronously", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "restartable" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.run(1);
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

test("interpret: restartable subscribe fires immediately with current non-Idle state", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "restartable" });
	manager.run(1); // state is Pending (emit is synchronous)
	const seen: Op.RestartableState<string, number>[] = [];
	manager.subscribe((s) => seen.push(s)); // fires immediately with Pending
	expect(seen).toStrictEqual([{ kind: "Pending" }]);
	manager.abort();
});

// --- Op.interpret — restartable with retry ---

test("interpret: restartable with retry emits Retrying between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, { onError: (e) => (e as Error).message });
	const manager = Op.interpret(op, { strategy: "restartable", retry: { attempts: 3 } });
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[0]).toStrictEqual({ kind: "Pending" });
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
	expect(states[2]).toStrictEqual({ kind: "Retrying", attempt: 2, lastError: "fail" });
	expect(states[3]).toStrictEqual({ kind: "OpErr", error: "fail" });
});

test("interpret: restartable with retry stops retrying on Ok", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		calls++;
		return calls < 2 ? Promise.reject(new Error("not yet")) : Promise.resolve(99);
	}, { onError: (e) => (e as Error).message });
	const manager = Op.interpret(op, { strategy: "restartable", retry: { attempts: 5 } });
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(2);
	expect(states.at(-1)).toStrictEqual({ kind: "OpOk", value: 99 });
});

test("interpret: restartable with retry respects when guard", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("non-retryable"));
	}, { onError: (e) => (e as Error).message });
	const manager = Op.interpret(op, {
		strategy: "restartable",
		retry: { attempts: 5, when: (e) => e !== "non-retryable" },
	});
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(1);
	expect(states.at(-1)).toStrictEqual({ kind: "OpErr", error: "non-retryable" });
});

// --- Op.interpret — restartable with timeout ---

test("interpret: restartable with timeout emits Err when deadline fires", async () => {
	const manager = Op.interpret(delayedOp(100), {
		strategy: "restartable",
		timeout: { duration: Duration.milliseconds(10), onTimeout: () => "timed out" },
	});
	const states = await runAndCollect(manager, 1);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpErr", error: "timed out" }]);
});

test("interpret: restartable with timeout resolves Ok when op finishes in time", async () => {
	const manager = Op.interpret(delayedOp(0), {
		strategy: "restartable",
		timeout: { duration: Duration.milliseconds(500), onTimeout: () => "timed out" },
	});
	const states = await runAndCollect(manager, 42);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 42 }]);
});

// --- Op.interpret — restartable with retry + timeout ---

test("interpret: restartable retry and timeout wraps entire retry sequence with deadline", async () => {
	let calls = 0;
	const op = Op.create((signal: AbortSignal) => (_: number) =>
		new Promise<never>((res, reject) => {
			calls++;
			const id = setTimeout(() => reject(new Error("fail")), 20);
			signal.addEventListener("abort", () => {
				clearTimeout(id);
				reject(new Error("abort"));
			}, { once: true });
		}), { onError: (e) => (e as Error).message });
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

// --- Op.interpret — exclusive ---

test("interpret: exclusive emits Pending then Ok on success", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive" });
	const states = await runAndCollect(manager, 10);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 10 }]);
});

test("interpret: exclusive drops second run while in-flight without emitting state", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "exclusive" });
	const states: Op.ExclusiveState<string, number>[] = [];
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			states.push(s);
			if (Op.Outcome.is.ok(s)) { resolve(); }
		});
	});
	manager.run(1); // starts
	manager.run(2); // dropped — no state change
	await done;
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 1 }]);
});

test("interpret: exclusive abort emits Nil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "exclusive" });
	const states: Op.ExclusiveState<string, number>[] = [];
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			states.push(s);
			if (Op.Outcome.is.nil(s)) { resolve(); }
		});
	});
	manager.run(1);
	manager.abort();
	await done;
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpNil", reason: "aborted" }]);
});

// --- Op.interpret — queue ---

test("interpret: queue runs calls in submission order", async () => {
	const results: number[] = [];
	const manager = Op.interpret(delayedOp(10), { strategy: "queue" });
	const done = new Promise<void>((resolve) => {
		let okCount = 0;
		manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
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

test("interpret: queue emits Queued state for waiting call", async () => {
	const states: Op.QueueState<string, number>[] = [];
	const manager = Op.interpret(delayedOp(30), { strategy: "queue" });
	const done = new Promise<void>((resolve) => {
		let okCount = 0;
		manager.subscribe((s) => {
			states.push(s);
			if (Op.Outcome.is.ok(s)) {
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

test("interpret: queue abort drains queue and emits Nil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "queue" });
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			if (Op.Outcome.is.nil(s)) { resolve(); }
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

// --- Op.interpret — buffered ---

test("interpret: buffered in-flight completes before waiting slot runs", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "buffered" });
	const okValues: number[] = [];
	const done = new Promise<void>((resolve) => {
		let okCount = 0;
		manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
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

test("interpret: buffered newer call replaces waiting slot", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "buffered" });
	const okValues: number[] = [];
	const done = new Promise<void>((resolve) => {
		let okCount = 0;
		manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
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

test("interpret: buffered abort emits Nil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "buffered" });
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			if (Op.Outcome.is.nil(s)) { resolve(); }
		});
	});
	manager.run(1);
	manager.run(2);
	manager.abort();
	await done;
	expect(manager.state).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

// --- Op.interpret — debounced ---

test("interpret: debounced waits for idle period before running", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(20) });
	expect(manager.state).toStrictEqual({ kind: "Idle" }); // state does not change immediately
	const states = await runAndCollect(manager, 42);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 42 }]);
});

test("interpret: debounced resets timer on new call and runs only latest input", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (input: number) => {
		calls++;
		return Promise.resolve(input);
	}, { onError: String });
	const manager = Op.interpret(op, { strategy: "debounced", duration: Duration.milliseconds(20) });
	const states: Op.DebouncedState<string, number>[] = [];
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			states.push(s);
			if (Op.Outcome.is.ok(s) || Op.Outcome.is.err(s) || Op.Outcome.is.nil(s)) { resolve(); }
		});
	});
	manager.run(1); // timer starts
	await new Promise((r) => setTimeout(r, 10)); // wait 10ms (timer has 10ms left)
	manager.run(2); // resets timer
	await done;
	expect(calls).toBe(1); // only one factory invocation
	expect(states.at(-1)).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("interpret: debounced abort cancels pending timer and state stays Idle", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(50) });
	manager.run(1); // timer starts; state stays Idle
	manager.abort(); // clears timer; state is Idle so no Nil emitted
	await new Promise((r) => setTimeout(r, 100)); // wait past the timer deadline
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

// --- Op.interpret — once ---

test("interpret: once emits Pending then Ok on success", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	const states = await runAndCollect(manager, 7);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 7 }]);
});

test("interpret: once emits Pending then Err on failure", async () => {
	const manager = Op.interpret(failingOp("boom"), { strategy: "once" });
	const states = await runAndCollect(manager, 1);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpErr", error: "boom" }]);
});

test("interpret: once ignores subsequent calls and runs only first", async () => {
	let calls = 0;
	const op = Op.create((signal: AbortSignal) => (input: number) =>
		new Promise<number>((resolve, reject) => {
			calls++;
			const id = setTimeout(() => resolve(input), 20);
			signal.addEventListener("abort", () => {
				clearTimeout(id);
				reject(new Error("abort"));
			}, { once: true });
		}), { onError: String });
	const manager = Op.interpret(op, { strategy: "once" });
	const states: Op.State<string, number>[] = [];
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			states.push(s);
			if (Op.Outcome.is.ok(s) || Op.Outcome.is.err(s) || Op.Outcome.is.nil(s)) { resolve(); }
		});
	});
	manager.run(1); // fires
	manager.run(2); // ignored — operation already started
	manager.run(3); // ignored
	await done;
	expect(calls).toBe(1);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 1 }]);
});

test("interpret: once state is permanent after completion", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	const states = await runAndCollect(manager, 5);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 5 }]);
	// Operation has completed — further calls must not change state
	manager.run(99);
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 5 });
});

test("interpret: once abort emits Nil and subsequent calls are no-ops", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "once" });
	const states: Op.State<string, number>[] = [];
	manager.subscribe((s) => states.push(s));
	manager.run(1);
	manager.abort();
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpNil", reason: "aborted" }]);
	manager.run(2); // no-op — state is Nil (not Idle)
	expect(manager.state).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("interpret: once with retry retries on Err then settles", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		calls++;
		return calls < 3 ? Promise.reject(new Error("not yet")) : Promise.resolve(99);
	}, { onError: (e) => (e as Error).message });
	const manager = Op.interpret(op, { strategy: "once", retry: { attempts: 5 } });
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states.at(-1)).toStrictEqual({ kind: "OpOk", value: 99 });
});

// --- Per-invocation results — run() returns Deferred<Outcome> ---

test("interpret: restartable run returns the invocation outcome", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	const result = await manager.run(42);
	expect(result).toStrictEqual({ kind: "OpOk", value: 42 });
});

test("interpret: restartable second run resolves first Deferred with ReplacedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "restartable" });
	const first = manager.run(1);
	const second = manager.run(2);
	const [r1, r2] = await Promise.all([first, second]);
	expect(r1).toStrictEqual({ kind: "OpNil", reason: "replaced" });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("interpret: restartable abort resolves in-flight Deferred with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "restartable" });
	const p = manager.run(1);
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("interpret: exclusive run returns the invocation outcome", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive" });
	const result = await manager.run(10);
	expect(result).toStrictEqual({ kind: "OpOk", value: 10 });
});

test("interpret: exclusive second run in-flight resolves to DroppedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "exclusive" });
	const first = manager.run(1);
	const second = manager.run(2); // dropped
	await expect(second).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await expect(first).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
});

test("interpret: exclusive abort resolves in-flight Deferred with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "exclusive" });
	const p = manager.run(1);
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("interpret: queue resolves each run to its own outcome in order", async () => {
	const manager = Op.interpret(delayedOp(10), { strategy: "queue" });
	const [r1, r2, r3] = await Promise.all([manager.run(1), manager.run(2), manager.run(3)]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
	expect(r3).toStrictEqual({ kind: "OpOk", value: 3 });
});

test("interpret: queue abort resolves all queued Deferreds with AbortedNil", async () => {
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

test("interpret: buffered run resolves to its own Ok outcome", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "buffered" });
	const result = await manager.run(5);
	expect(result).toStrictEqual({ kind: "OpOk", value: 5 });
});

test("interpret: buffered third run evicts waiting slot to EvictedNil", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "buffered" });
	const p1 = manager.run(1); // in-flight
	const p2 = manager.run(2); // waiting slot
	const p3 = manager.run(3); // evicts p2
	const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpNil", reason: "evicted" });
	expect(r3).toStrictEqual({ kind: "OpOk", value: 3 });
});

test("interpret: buffered abort resolves in-flight and waiting Deferreds with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "buffered" });
	const p1 = manager.run(1);
	const p2 = manager.run(2);
	manager.abort();
	const [r1, r2] = await Promise.all([p1, p2]);
	expect(r1).toStrictEqual({ kind: "OpNil", reason: "aborted" });
	expect(r2).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("interpret: debounced run resolves to Ok after timer fires", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(10) });
	const result = await manager.run(7);
	expect(result).toStrictEqual({ kind: "OpOk", value: 7 });
});

test("interpret: debounced second run before timer evicts first Deferred to EvictedNil", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(30) });
	const p1 = manager.run(1);
	await new Promise((r) => setTimeout(r, 10)); // still within debounce window
	const p2 = manager.run(2); // resets timer, evicts p1
	const [r1, r2] = await Promise.all([p1, p2]);
	expect(r1).toStrictEqual({ kind: "OpNil", reason: "evicted" });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("interpret: debounced abort before timer resolves pending Deferred with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(50) });
	const p = manager.run(1);
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("interpret: debounced abort after timer fires resolves in-flight Deferred with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "debounced", duration: Duration.milliseconds(10) });
	const p = manager.run(1);
	await new Promise((r) => setTimeout(r, 20)); // wait past the debounce; operation is now in-flight
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("interpret: once run resolves to Ok outcome", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	const result = await manager.run(3);
	expect(result).toStrictEqual({ kind: "OpOk", value: 3 });
});

test("interpret: once subsequent run calls resolve to DroppedNil", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "once" });
	const p1 = manager.run(1);
	const p2 = manager.run(2); // dropped
	const p3 = manager.run(3); // dropped
	const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpNil", reason: "dropped" });
	expect(r3).toStrictEqual({ kind: "OpNil", reason: "dropped" });
});

test("interpret: once abort resolves in-flight Deferred with AbortedNil", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "once" });
	const p = manager.run(1);
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("interpret: once abort on idle manager does nothing", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort(); // state is Idle — no emit, no resolve to call
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("interpret: once subscribe after run started fires immediately with current state", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "once" });
	manager.run(1);
	const received: Op.State<string, number>[] = [];
	manager.subscribe((s) => received.push(s));
	expect(received[0]).toStrictEqual({ kind: "Pending" }); // immediate callback: state is non-Idle
	manager.abort();
});

// --- Op.all and Op.race ---

test("all: resolves when all invocations settle", async () => {
	const manager = Op.interpret(delayedOp(10), { strategy: "queue" });
	const results = await Deferred.all([manager.run(1), manager.run(2), manager.run(3)]);
	expect(results).toStrictEqual([{ kind: "OpOk", value: 1 }, { kind: "OpOk", value: 2 }, { kind: "OpOk", value: 3 }]);
});

test("all: preserves outcome types including Nil", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "restartable" });
	const p1 = manager.run(1);
	const p2 = manager.run(2); // replaces p1
	const results = await Deferred.all([p1, p2]);
	expect(results[0]).toStrictEqual({ kind: "OpNil", reason: "replaced" });
	expect(results[1]).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("race: resolves to first invocation that settles", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "restartable" });
	const p1 = manager.run(1); // replaced immediately, settles first with ReplacedNil
	const p2 = manager.run(2);
	const winner = await Deferred.race([p1, p2]);
	expect(winner).toStrictEqual({ kind: "OpNil", reason: "replaced" });
});

// --- Op.interpret — throttled (leading-only) ---

test("interpret: throttled fires immediately on first run", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(50) });
	const states = await runAndCollect(manager, 42);
	expect(states).toStrictEqual([{ kind: "Pending" }, { kind: "OpOk", value: 42 }]);
});

test("interpret: throttled run during cooldown returns DroppedNil immediately", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(50) });
	const p1 = manager.run(1);
	const p2 = manager.run(2); // cooldown active — dropped
	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
});

test("interpret: throttled run after cooldown fires as new leading edge", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(20) });
	await manager.run(1);
	await new Promise((r) => setTimeout(r, 30)); // wait past cooldown
	const result = await manager.run(2);
	expect(result).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("interpret: throttled abort cancels in-flight and clears cooldown", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "throttled", duration: Duration.milliseconds(100) });
	const p = manager.run(1);
	manager.abort();
	await expect(p).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
	expect(manager.state).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("interpret: throttled subscribe after run started fires immediately with current state", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "throttled", duration: Duration.milliseconds(0) });
	manager.run(1);
	const received: Op.State<string, number>[] = [];
	manager.subscribe((s) => received.push(s));
	// state is Pending — subscriber fires immediately
	expect(received[0]).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

// --- Op.interpret — throttled (trailing: true) ---

test("interpret: throttled trailing fires trailing call after cooldown", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (input: number) => {
		calls++;
		return Promise.resolve(input);
	}, { onError: String });
	const manager = Op.interpret(op, { strategy: "throttled", duration: Duration.milliseconds(20), trailing: true });
	const done = new Promise<void>((resolve) => {
		manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s) && s.value === 2) { resolve(); }
		});
	});
	manager.run(1); // fires immediately (leading)
	await new Promise((r) => setTimeout(r, 5));
	manager.run(2); // buffered for trailing
	await done;
	expect(calls).toBe(2); // leading + trailing both fired
});

test("interpret: throttled trailing buffered call evicts previous pending", async () => {
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

test("interpret: throttled trailing abort clears in-flight and buffered", async () => {
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

// --- Op.interpret — concurrent ---

test("interpret: concurrent runs operations in parallel up to limit", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "concurrent", n: 2, overflow: "drop" });
	const [r1, r2] = await Promise.all([manager.run(1), manager.run(2)]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("interpret: concurrent overflow drop returns DroppedNil when slots are full", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "concurrent", n: 2, overflow: "drop" });
	const p1 = manager.run(1);
	const p2 = manager.run(2);
	const p3 = manager.run(3); // dropped — both slots full
	await expect(p3).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await Promise.all([p1, p2]);
});

test("interpret: concurrent overflow queue waits for available slot", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "concurrent", n: 2, overflow: "queue" });
	const [r1, r2, r3] = await Promise.all([manager.run(1), manager.run(2), manager.run(3)]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
	expect(r3).toStrictEqual({ kind: "OpOk", value: 3 });
});

test("interpret: concurrent abort resolves all in-flight and queued Deferreds with AbortedNil", async () => {
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

test("interpret: concurrent overflow queue emits Queued state for waiting run", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "concurrent", n: 1, overflow: "queue" });
	const states: Op.ConcurrentQueueState<string, number>[] = [];
	manager.subscribe((s) => states.push(s));
	await Promise.all([manager.run(1), manager.run(2)]);
	expect(states).toContainEqual({ kind: "Queued", position: 0 });
});

// --- Op.interpret — keyed (exclusive perKey) ---

test("interpret: keyed exclusive runs different keys in parallel", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	const [r1, r2] = await Promise.all([manager.run(1), manager.run(2)]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("interpret: keyed exclusive returns DroppedNil for same key while in-flight", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	const p1 = manager.run(1);
	const p2 = manager.run(1); // same key — dropped
	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
});

test("interpret: keyed exclusive state map reflects per-key state", () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	manager.run(1);
	manager.run(2);
	expect(manager.state.get(1)).toStrictEqual({ kind: "Pending" });
	expect(manager.state.get(2)).toStrictEqual({ kind: "Pending" });
});

test("interpret: keyed exclusive abort key cancels only that key", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	const p1 = manager.run(1);
	const p2 = manager.run(2);
	manager.abort(1);
	await expect(p1).resolves.toStrictEqual({ kind: "OpNil", reason: "aborted" });
	await expect(p2).resolves.toStrictEqual({ kind: "OpOk", value: 2 });
});

test("interpret: keyed exclusive abort cancels all keys", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	const p1 = manager.run(1);
	const p2 = manager.run(2);
	manager.abort();
	const [r1, r2] = await Promise.all([p1, p2]);
	expect(r1).toStrictEqual({ kind: "OpNil", reason: "aborted" });
	expect(r2).toStrictEqual({ kind: "OpNil", reason: "aborted" });
});

test("interpret: keyed exclusive abort on inactive key is a no-op", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	manager.abort(99); // key 99 has no active slot — no-op
	const result = await manager.run(1);
	expect(result).toStrictEqual({ kind: "OpOk", value: 1 });
});

test("interpret: keyed exclusive abort with no active keys is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	manager.abort(); // no active keys — no emit, no resolves
	expect(manager.state.size).toBe(0);
});

test("interpret: keyed exclusive subscribe after run started fires immediately with snapshot", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	manager.run(1);
	const received: ReadonlyMap<number, Op.KeyedExclusivePerKey<string, number>>[] = [];
	manager.subscribe((map) => received.push(map));
	// stateMap.size > 0 — subscriber fires immediately with current snapshot
	expect(received[0]?.get(1)).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

test("interpret: keyed exclusive state map keeps terminal state after completion", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	await manager.run(42);
	expect(manager.state.get(42)).toStrictEqual({ kind: "OpOk", value: 42 });
});

test("interpret: keyed exclusive subscriber fires with snapshot on each transition", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n) => n, perKey: "exclusive" });
	const snapshots: ReadonlyMap<number, Op.KeyedExclusivePerKey<string, number>>[] = [];
	manager.subscribe((map) => snapshots.push(map));
	await manager.run(1);
	// transitions: Pending → Ok
	expect(snapshots.length).toBeGreaterThanOrEqual(2);
	expect(snapshots.at(-1)?.get(1)).toStrictEqual({ kind: "OpOk", value: 1 });
});

// --- Op.interpret — keyed (restartable perKey) ---

test("interpret: keyed restartable cancels previous run for same key while in-flight", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "keyed", key: (n) => n, perKey: "restartable" });
	const p1 = manager.run(1);
	const p2 = manager.run(1); // cancels p1
	await expect(p1).resolves.toStrictEqual({ kind: "OpNil", reason: "replaced" });
	await expect(p2).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
});

test("interpret: keyed restartable runs different keys in parallel", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "keyed", key: (n) => n, perKey: "restartable" });
	const [r1, r2] = await Promise.all([manager.run(1), manager.run(2)]);
	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
});

test("type: narrows keyed exclusive run return type correctly", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n: number) => n, perKey: "exclusive" });
	expectTypeOf(manager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.DroppedNil>
	>();
});

test("type: narrows keyed restartable run return type correctly", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n: number) => n, perKey: "restartable" });
	expectTypeOf(manager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.ReplacedNil>
	>();
});

// --- Op.interpret — debounced leading edge ---

test("interpret: debounced with leading fires immediately on first call", async () => {
	const manager = Op.interpret(delayedOp(), {
		strategy: "debounced",
		duration: Duration.milliseconds(30),
		leading: true,
	});
	const p = manager.run(7);
	expect(manager.state).toStrictEqual({ kind: "Pending" }); // fires immediately, no timer wait
	await expect(p).resolves.toStrictEqual({ kind: "OpOk", value: 7 });
});

test("interpret: debounced with leading fires trailing call after quiet period", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (input: number) => {
		calls++;
		return Promise.resolve(input);
	}, { onError: String });
	const manager = Op.interpret(op, { strategy: "debounced", duration: Duration.milliseconds(30), leading: true });

	const p1 = manager.run(1); // leading fires with input 1
	await new Promise((r) => setTimeout(r, 10)); // within debounce window
	const p2 = manager.run(2); // in window — replaces pending trailing
	// quiet for 30ms → trailing fires with input 2

	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 }); // leading resolved immediately
	await expect(p2).resolves.toStrictEqual({ kind: "OpOk", value: 2 }); // trailing resolved after quiet
	expect(calls).toBe(2);
});

test("interpret: debounced with leading resolves intermediate calls with EvictedNil", async () => {
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

// --- Op.interpret — debounced maxWait ---

test("interpret: debounced with maxWait fires after maxWait without quiet period", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (input: number) => {
		calls++;
		return Promise.resolve(input);
	}, { onError: String });
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

// --- Op.interpret — restartable minInterval ---

test("interpret: restartable with minInterval delays restart until interval elapses", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable", minInterval: Duration.milliseconds(80) });

	await manager.run(1); // first run; sets lastStartTime

	const before = Date.now();
	await manager.run(2); // second run; should wait ~80ms
	const elapsed = Date.now() - before;

	expect(elapsed).toBeGreaterThanOrEqual(60);
	await expect(manager.run(3)).resolves.toStrictEqual({ kind: "OpOk", value: 3 });
});

test("interpret: restartable with minInterval cancels previous and respects interval", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable", minInterval: Duration.milliseconds(60) });

	await manager.run(1); // establishes lastStartTime

	const p2 = manager.run(2); // queued with wait
	const p3 = manager.run(3); // cancels p2, queued with wait

	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "replaced" });
	await expect(p3).resolves.toStrictEqual({ kind: "OpOk", value: 3 });
});

// --- Op.interpret — exclusive cooldown ---

test("interpret: exclusive with cooldown drops calls during cooldown", async () => {
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

test("interpret: exclusive with cooldown abort clears cooldown", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive", cooldown: Duration.milliseconds(200) });

	await manager.run(1);
	manager.abort(); // clears cooldown

	const p2 = manager.run(2);
	await expect(p2).resolves.toStrictEqual({ kind: "OpOk", value: 2 });
});

// --- Op.interpret — buffered size ---

test("interpret: buffered with capacity holds waiting calls and evicts oldest when full", async () => {
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

test("interpret: buffered processes buffer in FIFO order", async () => {
	const order: number[] = [];
	const op = Op.create((_signal: AbortSignal) => (input: number) => {
		order.push(input);
		return Promise.resolve(input);
	}, { onError: String });
	const manager = Op.interpret(op, { strategy: "buffered", size: 2 });

	const p1 = manager.run(1); // starts immediately
	const p2 = manager.run(2); // buffer[0]
	const p3 = manager.run(3); // buffer[1]

	await Promise.all([p1, p2, p3]);
	expect(order).toStrictEqual([1, 2, 3]); // FIFO
});

// --- Op.interpret — queue maxSize and overflow ---

test("interpret: queue with maxSize drops new calls when queue is full", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "queue", maxSize: 1 });

	const p1 = manager.run(1); // starts immediately
	const p2 = manager.run(2); // queued (queue full at 1)
	const p3 = manager.run(3); // queue full — dropped

	await expect(p3).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
	await expect(p2).resolves.toStrictEqual({ kind: "OpOk", value: 2 });
});

test("interpret: queue with replace-last overflow evicts queue tail", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "queue", maxSize: 1, overflow: "replace-last" });

	const p1 = manager.run(1); // starts immediately
	const p2 = manager.run(2); // queued
	const p3 = manager.run(3); // queue full — p2 evicted, p3 queued

	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "evicted" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
	await expect(p3).resolves.toStrictEqual({ kind: "OpOk", value: 3 });
});

// --- Op.interpret — queue dedupe ---

test("interpret: queue with dedupe drops duplicate queued items", async () => {
	const manager = Op.interpret(delayedOp(30), { strategy: "queue", dedupe: (a, b) => a[0] === b[0] });

	const p1 = manager.run(1); // starts immediately (in-flight)
	const p2 = manager.run(2); // queued
	const p3 = manager.run(2); // dedupes p2 → DroppedNil; p3 queued with input 2

	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" }); // deduped
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
	await expect(p3).resolves.toStrictEqual({ kind: "OpOk", value: 2 }); // ran with input 2
});

// --- Op.interpret — queue concurrency ---

test("interpret: queue with concurrency runs multiple items in-flight simultaneously", async () => {
	const startTimes: number[] = [];
	const op = Op.create((signal: AbortSignal) => (input: number) =>
		new Promise<number>((resolve, reject) => {
			startTimes.push(Date.now());
			const id = setTimeout(() => resolve(input), 30);
			signal.addEventListener("abort", () => {
				clearTimeout(id);
				reject(new Error("abort"));
			}, { once: true });
		}), { onError: String });
	const manager = Op.interpret(op, { strategy: "queue", concurrency: 2 });

	const [r1, r2, r3] = await Promise.all([manager.run(1), manager.run(2), manager.run(3)]);

	expect(r1).toStrictEqual({ kind: "OpOk", value: 1 });
	expect(r2).toStrictEqual({ kind: "OpOk", value: 2 });
	expect(r3).toStrictEqual({ kind: "OpOk", value: 3 });
	// first two started nearly simultaneously
	expect(startTimes[1]! - startTimes[0]!).toBeLessThan(10);
});

// --- Op.interpret — queue overflow + dedupe combined ---

test("interpret: queue with replace-last and dedupe produces DroppedNil and EvictedNil", async () => {
	const manager = Op.interpret(delayedOp(30), {
		strategy: "queue",
		maxSize: 2,
		overflow: "replace-last",
		dedupe: (a, b) => a[0] === b[0],
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

// --- Op.interpret — retry with queue, buffered, debounced, throttled, concurrent ---

test("interpret: queue with retry emits Retrying states between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, { onError: (e) => (e as Error).message });
	const manager = Op.interpret(op, { strategy: "queue", retry: { attempts: 3 } });
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[0]).toStrictEqual({ kind: "Pending" });
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
	expect(states[2]).toStrictEqual({ kind: "Retrying", attempt: 2, lastError: "fail" });
	expect(states[3]).toStrictEqual({ kind: "OpErr", error: "fail" });
});

test("interpret: buffered with retry emits Retrying states between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, { onError: (e) => (e as Error).message });
	const manager = Op.interpret(op, { strategy: "buffered", retry: { attempts: 3 } });
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[0]).toStrictEqual({ kind: "Pending" });
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
	expect(states[2]).toStrictEqual({ kind: "Retrying", attempt: 2, lastError: "fail" });
	expect(states[3]).toStrictEqual({ kind: "OpErr", error: "fail" });
});

test("interpret: debounced leading with retry emits Retrying states between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, { onError: (e) => (e as Error).message });
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

test("interpret: debounced trailing with retry emits Retrying states between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, { onError: (e) => (e as Error).message });
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

test("interpret: throttled with retry emits Retrying states between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, { onError: (e) => (e as Error).message });
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

test("interpret: concurrent with retry emits Retrying states between attempts", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, { onError: (e) => (e as Error).message });
	const manager = Op.interpret(op, { strategy: "concurrent", n: 1, overflow: "drop", retry: { attempts: 3 } });
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[0]).toStrictEqual({ kind: "Pending" });
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
	expect(states[2]).toStrictEqual({ kind: "Retrying", attempt: 2, lastError: "fail" });
	expect(states[3]).toStrictEqual({ kind: "OpErr", error: "fail" });
});

// --- Op.interpret — manager.state getter for exclusive and concurrent ---

test("interpret: exclusive manager.state returns current state", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "exclusive" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	const p = manager.run(1);
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	await p;
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 1 });
});

test("interpret: concurrent manager.state returns current state", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "concurrent", n: 1, overflow: "drop" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	const p = manager.run(1);
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	await p;
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 1 });
});

test("interpret: concurrent abort on idle manager does nothing", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "concurrent", n: 2, overflow: "drop" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort(); // no in-flight ops — no emit
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("interpret: concurrent subscribe after run started fires immediately with current state", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "concurrent", n: 1, overflow: "drop" });
	manager.run(1);
	const received: Op.State<string, number>[] = [];
	manager.subscribe((s) => received.push(s));
	// state is Pending — subscriber fires immediately
	expect(received[0]).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

// --- Op.interpret — default parameter values (Op.ts branch coverage) ---

test("interpret: debounced without duration or leading uses zero duration and false leading defaults", async () => {
	// Exercises options.ms ?? 0 and options.leading ?? false in the interpret switch
	const manager = Op.interpret(delayedOp(), { strategy: "debounced" } as any);
	await expect(manager.run(42)).resolves.toStrictEqual({ kind: "OpOk", value: 42 });
});

test("interpret: throttled without duration or trailing uses zero duration and false trailing defaults", async () => {
	// Exercises options.ms ?? 0 and options.trailing ?? false in the interpret switch
	const manager = Op.interpret(delayedOp(), { strategy: "throttled" } as any);
	await expect(manager.run(42)).resolves.toStrictEqual({ kind: "OpOk", value: 42 });
});

test("interpret: concurrent without n or overflow uses default values", async () => {
	// Exercises options.n ?? 1 and options.overflow ?? "drop" in the interpret switch
	const manager = Op.interpret(delayedOp(20), { strategy: "concurrent" } as any);
	const p1 = manager.run(1); // fills the single slot (n=1 default)
	const p2 = manager.run(2); // dropped — overflow=drop default
	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
});

test("interpret: keyed without key or perKey uses identity key and exclusive defaults", async () => {
	// Exercises options.key ?? identity and options.perKey ?? "exclusive" in the interpret switch
	const manager = Op.interpret(delayedOp(20), { strategy: "keyed" } as any);
	const p1 = manager.run(1);
	const p2 = manager.run(1); // identity key → same key → exclusive drops
	await expect(p2).resolves.toStrictEqual({ kind: "OpNil", reason: "dropped" });
	await expect(p1).resolves.toStrictEqual({ kind: "OpOk", value: 1 });
});

// --- runWithRetry — numeric backoff (lines 56, 70-73) ---

test("interpret: restartable with numeric backoff emits Retrying with nextRetryIn", async () => {
	// Covers the `backoff` as a plain number branch (line 56) and the ms>0 nextRetryIn path (lines 70-73)
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, { onError: (e) => (e as Error).message });
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

test("interpret: exclusive with numeric backoff emits Retrying with nextRetryIn", async () => {
	let calls = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		calls++;
		return Promise.reject(new Error("fail"));
	}, { onError: (e) => (e as Error).message });
	const manager = Op.interpret(op, {
		strategy: "exclusive",
		retry: { attempts: 3, backoff: Duration.milliseconds(50) },
	});
	const states = await runAndCollect(manager, 1);
	expect(calls).toBe(3);
	expect(states[1]).toStrictEqual({ kind: "Retrying", attempt: 1, lastError: "fail", nextRetryIn: 50 });
});

// --- abort() on idle manager — false branch of `if (currentState.kind !== "Idle")` ---

test("interpret: restartable abort on idle manager is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort();
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("interpret: exclusive abort on idle manager is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort();
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("interpret: queue abort on idle manager is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "queue" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort();
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("interpret: buffered abort on idle manager is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "buffered" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort();
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("interpret: debounced abort on idle manager is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(50) });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort();
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

test("interpret: throttled abort on idle manager is a no-op", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(50) });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	manager.abort();
	expect(manager.state).toStrictEqual({ kind: "Idle" });
});

// ---------------------------------------------------------------------------
// manager.state getter and subscribe initial-callback for queue, buffered,
// debounced, throttled (ensures get state() and the non-Idle subscribe path)
// ---------------------------------------------------------------------------

test("interpret: queue manager.state returns current state", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "queue" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	const p = manager.run(1);
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	await p;
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 1 });
});

test("interpret: queue subscribe after run started fires immediately with current state", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "queue" });
	manager.run(1);
	const received: Op.State<string, number>[] = [];
	manager.subscribe((s) => received.push(s));
	expect(received[0]).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

test("interpret: buffered manager.state returns current state", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "buffered" });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	const p = manager.run(1);
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	await p;
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 1 });
});

test("interpret: buffered subscribe after run started fires immediately with current state", () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "buffered" });
	manager.run(1);
	const received: Op.State<string, number>[] = [];
	manager.subscribe((s) => received.push(s));
	expect(received[0]).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

test("interpret: debounced manager.state returns current state after timer fires", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "debounced", duration: Duration.milliseconds(10) });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	const p = manager.run(1);
	await new Promise((r) => setTimeout(r, 15)); // wait for debounce to fire
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	await p;
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 1 });
});

test("interpret: debounced subscribe after op starts fires immediately with current state", async () => {
	const manager = Op.interpret(delayedOp(50), { strategy: "debounced", duration: Duration.milliseconds(10) });
	manager.run(1);
	await new Promise((r) => setTimeout(r, 15)); // wait for debounce timer to fire
	const received: Op.State<string, number>[] = [];
	manager.subscribe((s) => received.push(s));
	expect(received[0]).toStrictEqual({ kind: "Pending" });
	manager.abort();
});

test("interpret: throttled manager.state returns current state", async () => {
	const manager = Op.interpret(delayedOp(20), { strategy: "throttled", duration: Duration.milliseconds(0) });
	expect(manager.state).toStrictEqual({ kind: "Idle" });
	const p = manager.run(1);
	expect(manager.state).toStrictEqual({ kind: "Pending" });
	await p;
	expect(manager.state).toStrictEqual({ kind: "OpOk", value: 1 });
});

// --- Debounced with leading=true: abort() while leading execution is in-flight ---

test("interpret: debounced leading abort while in-flight resolves with AbortedNil", async () => {
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

// --- manager.reset ---

test("reset: returns state to Idle after Ok", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	await manager.run(1);
	expect(manager.state.kind).toBe("OpOk");
	manager.reset();
	expect(manager.state.kind).toBe("Idle");
});

test("reset: notifies subscribers with Idle", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	await manager.run(1);
	const states: string[] = [];
	manager.subscribe((s) => states.push(s.kind));
	manager.reset();
	expect(states).toContain("Idle");
});

test("reset: does nothing when already Idle", () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	expect(manager.state.kind).toBe("Idle");
	manager.reset();
	expect(manager.state.kind).toBe("Idle");
});

// --- manager.poll ---

test("poll: runs immediately on first call", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	const stop = manager.poll({ interval: Duration.milliseconds(10_000) })(1);
	// Wait for the immediate run to complete
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
				unsub();
				resolve();
			}
		});
	});
	stop();
	expect(manager.state.kind).toBe("OpOk");
});

test("poll: stop handle cancels future runs", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable" });
	let runCount = 0;
	manager.subscribe((s) => {
		if (Op.Outcome.is.ok(s)) { runCount++; }
	});
	const stop = manager.poll({ interval: Duration.milliseconds(50) })(1);
	// Wait for first run
	await new Promise((r) => setTimeout(r, 20));
	stop();
	const countAfterStop = runCount;
	// Wait long enough for what would have been 2+ more intervals
	await new Promise((r) => setTimeout(r, 150));
	expect(runCount).toBe(countAfterStop);
});

test("poll: supports reusable poller handle and zero-arg ops", async () => {
	const zeroOp = Op.create((_signal: AbortSignal) => () => Promise.resolve(99), { onError: String });
	const zeroManager = Op.interpret(zeroOp, { strategy: "once" });
	const poller = zeroManager.poll({ interval: Duration.milliseconds(10_000) });
	const stop = poller();
	await new Promise<void>((resolve) => {
		const unsub = zeroManager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
				unsub();
				resolve();
			}
		});
	});
	stop();
	expect(zeroManager.state).toStrictEqual({ kind: "OpOk", value: 99 });
});

test("reset: resets exclusive strategy to Idle", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive" });
	await manager.run(1);
	manager.reset();
	expect(Op.is.idle(manager.state)).toBe(true);
});

test("reset: resets queue strategy to Idle", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "queue" });
	await manager.run(1);
	manager.reset();
	expect(Op.is.idle(manager.state)).toBe(true);
});

test("reset: resets buffered strategy to Idle", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "buffered" });
	await manager.run(1);
	manager.reset();
	expect(Op.is.idle(manager.state)).toBe(true);
});

test("reset: resets debounced strategy to Idle", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(10) });
	await manager.run(1);
	manager.reset();
	expect(Op.is.idle(manager.state)).toBe(true);
});

test("reset: resets throttled strategy to Idle", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(10) });
	await manager.run(1);
	manager.reset();
	expect(Op.is.idle(manager.state)).toBe(true);
});

test("reset: resets concurrent strategy to Idle", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "concurrent", n: 2 });
	await manager.run(1);
	manager.reset();
	expect(Op.is.idle(manager.state)).toBe(true);
});

test("reset: resets once strategy to Idle", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	await manager.run(1);
	manager.reset();
	expect(Op.is.idle(manager.state)).toBe(true);
});

test("poll: works for exclusive strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive" });
	const stop = manager.poll({ interval: Duration.milliseconds(10_000) })(1);
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
				unsub();
				resolve();
			}
		});
	});
	stop();
	expect(Op.Outcome.is.ok(manager.state)).toBe(true);
});

test("poll: works for once strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	const stop = manager.poll({ interval: Duration.milliseconds(10_000) })(1);
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
				unsub();
				resolve();
			}
		});
	});
	stop();
	expect(Op.Outcome.is.ok(manager.state)).toBe(true);
});

test("poll: works for queue strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "queue" });
	const stop = manager.poll({ interval: Duration.milliseconds(10_000) })(1);
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
				unsub?.();
				resolve();
			}
		});
	});
	stop();
	expect(Op.Outcome.is.ok(manager.state)).toBe(true);
});

test("poll: works for buffered strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "buffered" });
	const stop = manager.poll({ interval: Duration.milliseconds(10_000) })(1);
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
				unsub?.();
				resolve();
			}
		});
	});
	stop();
	expect(Op.Outcome.is.ok(manager.state)).toBe(true);
});

test("poll: works for debounced strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "debounced", duration: Duration.milliseconds(0) });
	const stop = manager.poll({ interval: Duration.milliseconds(10_000) })(1);
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
				unsub?.();
				resolve();
			}
		});
	});
	stop();
	expect(Op.Outcome.is.ok(manager.state)).toBe(true);
});

test("poll: works for concurrent strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "concurrent", n: 2 });
	const stop = manager.poll({ interval: Duration.milliseconds(10_000) })(1);
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
				unsub?.();
				resolve();
			}
		});
	});
	stop();
	expect(Op.Outcome.is.ok(manager.state)).toBe(true);
});

test("poll: works for throttled strategy", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(10_000) });
	const stop = manager.poll({ interval: Duration.milliseconds(10_000) })(1);
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
				unsub();
				resolve();
			}
		});
	});
	stop();
	expect(Op.Outcome.is.ok(manager.state)).toBe(true);
});

test("reset: clears all keyed per-key state", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n: number) => n });
	await manager.run(1);
	await manager.run(2);
	expect(manager.state.size).toBe(2);
	manager.reset();
	expect(manager.state.size).toBe(0);
});

test("poll: runs immediately on keyed manager and can be stopped", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "keyed", key: (n: number) => n });
	const stop = manager.poll({ interval: Duration.milliseconds(10_000) })(1);
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

// --- wire ---

test("wire: calls f when source reaches OpOk", async () => {
	const source = Op.interpret(delayedOp(), { strategy: "restartable" });
	const received: number[] = [];
	const stop = Op.wire(source, (n) => received.push(n));
	await source.run(42);
	stop();
	expect(received).toStrictEqual([42]);
});

test("wire: does not call f for OpErr state", async () => {
	const source = Op.interpret(failingOp("boom"), { strategy: "restartable" });
	const received: unknown[] = [];
	const stop = Op.wire(source, (n) => received.push(n));
	await source.run(0);
	stop();
	expect(received).toStrictEqual([]);
});

test("wire: stop handle removes subscription", async () => {
	const source = Op.interpret(delayedOp(), { strategy: "restartable" });
	const received: number[] = [];
	const stop = Op.wire(source, (n) => received.push(n));
	stop();
	await source.run(1);
	expect(received).toStrictEqual([]);
});

// --- Duration Support ---

test("interpret: debounced strategy with Duration", async () => {
	const manager = Op.interpret(delayedOp(), {
		strategy: "debounced",
		duration: Duration.milliseconds(10),
		maxWait: Duration.milliseconds(20),
	});
	const run = manager.run(42);
	const outcome = await run;
	expect(outcome).toStrictEqual(Op.Outcome.make.ok(42));
});

test("interpret: throttled strategy with Duration", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "throttled", duration: Duration.milliseconds(10) });
	const outcome = await manager.run(42);
	expect(outcome).toStrictEqual(Op.Outcome.make.ok(42));
});

test("interpret: exclusive strategy with Duration cooldown", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "exclusive", cooldown: Duration.milliseconds(10) });
	const outcome = await manager.run(42);
	expect(outcome).toStrictEqual(Op.Outcome.make.ok(42));
});

test("interpret: restartable strategy with Duration minInterval", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "restartable", minInterval: Duration.milliseconds(10) });
	const outcome = await manager.run(42);
	expect(outcome).toStrictEqual(Op.Outcome.make.ok(42));
});

test("interpret: retry policy with Duration backoff", async () => {
	let attempt = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		attempt++;
		if (attempt < 2) { return Promise.reject(new Error("fail")); }
		return Promise.resolve(42);
	}, { onError: (e) => String(e) });
	const manager = Op.interpret(op, {
		strategy: "restartable",
		retry: { attempts: 2, backoff: Duration.milliseconds(5) },
	});
	const outcome = await manager.run(1);
	expect(outcome).toStrictEqual(Op.Outcome.make.ok(42));
});

test("interpret: retry policy with Duration backoff function", async () => {
	let attempt = 0;
	const op = Op.create((_signal: AbortSignal) => (_: number) => {
		attempt++;
		if (attempt < 2) { return Promise.reject(new Error("fail")); }
		return Promise.resolve(42);
	}, { onError: (e) => String(e) });
	const manager = Op.interpret(op, {
		strategy: "restartable",
		retry: { attempts: 2, backoff: (n) => Duration.milliseconds(n * 2) },
	});
	const outcome = await manager.run(1);
	expect(outcome).toStrictEqual(Op.Outcome.make.ok(42));
});

test("interpret: timeout policy with Duration", async () => {
	const op = Op.create((signal: AbortSignal) => (_: number) =>
		new Promise<number>((_resolve, reject) => {
			signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
		}), { onError: (e) => String(e) });
	const manager = Op.interpret(op, {
		strategy: "restartable",
		timeout: { duration: Duration.milliseconds(5), onTimeout: () => "timeout" },
	});
	const outcome = await manager.run(1);
	expect(outcome).toStrictEqual(Op.Outcome.make.err("timeout"));
});

test("poll: works with Duration interval", async () => {
	const manager = Op.interpret(delayedOp(), { strategy: "once" });
	const stop = manager.poll({ interval: Duration.milliseconds(10_000) })(1);
	await new Promise<void>((resolve) => {
		const unsub = manager.subscribe((s) => {
			if (Op.Outcome.is.ok(s)) {
				unsub();
				resolve();
			}
		});
	});
	stop();
	expect(Op.Outcome.is.ok(manager.state)).toBe(true);
});

// --- pipe composition ---

test("pipe: composes outcome with map chain and recover", () => {
	const outcome = Op.Outcome.make.ok(5) as Op.Outcome<string, number>;
	const result = pipe(
		outcome,
		Op.Outcome.map((n) => n * 2),
		Op.Outcome.chain((n) => (n > 5 ? Op.Outcome.make.ok(n + 1) : Op.Outcome.make.err("too small"))),
		Op.Outcome.recover(() => Op.Outcome.make.ok(0)),
	);
	expect(result).toStrictEqual(Op.Outcome.make.ok(11));
});

test("pipe: composes outcome with mapError and to.Result", () => {
	const outcome = Op.Outcome.make.err("fail") as Op.Outcome<string, number>;
	const res = pipe(outcome, Op.Outcome.mapError((e) => `error: ${e}`), Op.Outcome.to.Result(() => "nil"));
	expect(res).toStrictEqual(Result.make.err("error: fail"));
});
