/**
 * Direct unit tests for internal Op utility functions.
 * These test the building blocks in isolation — runWithRetry, execute, cancellableWait,
 * and the strategy factories — rather than routing every assertion through Op.interpret.
 */
import { expect, test } from "vitest";
import { Deferred } from "../../Core/Deferred.ts";
import { Op } from "../../Core/Op.ts";
import { Result } from "../../Core/Result.ts";
import {
	cancellableWait,
	execute,
	makeBuffered,
	makeConcurrent,
	makeDebounced,
	makeExclusive,
	makeKeyed,
	makeOnce,
	makeQueue,
	makeRestartable,
	makeThrottled,
	runWithRetry,
} from "../Op.util.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Op that resolves with the input value after an optional delay. */
const successOp = (delayMs = 0): Op<number, string, number> =>
	Op.create(
		(signal) => (input: number) =>
			new Promise<number>((resolve, reject) => {
				const id = setTimeout(() => resolve(input), delayMs);
				signal.addEventListener("abort", () => {
					clearTimeout(id);
					reject(new Error("abort"));
				}, { once: true });
			}),
		(e) => (e as Error).message,
	);

/** Op that always rejects with `msg` after an optional delay. */
const failOp = (msg = "fail", delayMs = 0): Op<number, string, number> =>
	Op.create(
		(signal) => (_input: number) =>
			new Promise<never>((_resolve, reject) => {
				const id = setTimeout(() => reject(new Error(msg)), delayMs);
				signal.addEventListener("abort", () => {
					clearTimeout(id);
					reject(new Error("abort"));
				}, { once: true });
			}),
		(e) => (e as Error).message,
	);

// ---------------------------------------------------------------------------
// cancellableWait
// ---------------------------------------------------------------------------

test("cancellableWait resolves immediately when ms <= 0", async () => {
	let done = false;
	const c = new AbortController();
	cancellableWait(0, c.signal).then(() => {
		done = true;
	});
	await Promise.resolve(); // one microtask tick
	expect(done).toBe(true);
});

test("cancellableWait resolves after the specified delay", async () => {
	const start = Date.now();
	const c = new AbortController();
	await cancellableWait(20, c.signal);
	expect(Date.now() - start).toBeGreaterThanOrEqual(15);
});

test("cancellableWait resolves early when the signal is aborted", async () => {
	const start = Date.now();
	const c = new AbortController();
	setTimeout(() => c.abort(), 10);
	await cancellableWait(500, c.signal);
	expect(Date.now() - start).toBeLessThan(100);
});

test("cancellableWait resolves immediately when signal is already aborted", async () => {
	const c = new AbortController();
	c.abort();
	let done = false;
	// ms <= 0 path: should resolve in next microtask
	cancellableWait(0, c.signal).then(() => {
		done = true;
	});
	await Promise.resolve();
	expect(done).toBe(true);
});

// ---------------------------------------------------------------------------
// runWithRetry
// ---------------------------------------------------------------------------

test("runWithRetry returns Ok on first success", async () => {
	const retrying: Op.Retrying<string>[] = [];
	const result = await runWithRetry(
		successOp(),
		1,
		new AbortController().signal,
		{ attempts: 3 },
		(r) => retrying.push(r),
	);
	expect(result).toEqual(Result.ok(1));
	expect(retrying).toHaveLength(0);
});

test("runWithRetry retries on Err and returns Err when attempts exhausted", async () => {
	let calls = 0;
	const op = Op.create(
		(_signal) => (_: number) => {
			calls++;
			return Promise.reject(new Error("boom"));
		},
		(e) => (e as Error).message,
	);
	const retrying: Op.Retrying<string>[] = [];
	const result = await runWithRetry(
		op,
		1,
		new AbortController().signal,
		{ attempts: 3 },
		(r) => retrying.push(r),
	);
	expect(result).toEqual(Result.err("boom"));
	expect(calls).toBe(3);
	expect(retrying).toHaveLength(2); // attempt 1 and 2 produce a Retrying; 3rd attempt returns Err
	expect(retrying[0]).toEqual({ kind: "Retrying", attempt: 1, lastError: "boom" });
	expect(retrying[1]).toEqual({ kind: "Retrying", attempt: 2, lastError: "boom" });
});

test("runWithRetry stops early on Ok without exhausting all attempts", async () => {
	let calls = 0;
	const op = Op.create(
		(_signal) => (_: number) => {
			calls++;
			return calls < 2 ? Promise.reject(new Error("not yet")) : Promise.resolve(99);
		},
		(e) => (e as Error).message,
	);
	const result = await runWithRetry(
		op,
		1,
		new AbortController().signal,
		{ attempts: 5 },
		() => {},
	);
	expect(result).toEqual(Result.ok(99));
	expect(calls).toBe(2);
});

test("runWithRetry respects the `when` guard and stops early on non-retryable error", async () => {
	let calls = 0;
	const op = Op.create(
		(_signal) => (_: number) => {
			calls++;
			return Promise.reject(new Error("not-retryable"));
		},
		(e) => (e as Error).message,
	);
	const result = await runWithRetry(
		op,
		1,
		new AbortController().signal,
		{ attempts: 5, when: (e) => e !== "not-retryable" },
		() => {},
	);
	expect(result).toEqual(Result.err("not-retryable"));
	expect(calls).toBe(1);
});

test("runWithRetry includes nextRetryIn when backoff is a number > 0", async () => {
	const op = Op.create(
		(_signal) => (_: number) => Promise.reject(new Error("fail")),
		(e) => (e as Error).message,
	);
	const retrying: Op.Retrying<string>[] = [];
	await runWithRetry(
		op,
		1,
		new AbortController().signal,
		{ attempts: 2, backoff: 50 },
		(r) => retrying.push(r),
	);
	expect(retrying[0]).toEqual({ kind: "Retrying", attempt: 1, lastError: "fail", nextRetryIn: 50 });
});

test("runWithRetry includes nextRetryIn when backoff is a function", async () => {
	const op = Op.create(
		(_signal) => (_: number) => Promise.reject(new Error("fail")),
		(e) => (e as Error).message,
	);
	const retrying: Op.Retrying<string>[] = [];
	await runWithRetry(
		op,
		1,
		new AbortController().signal,
		{ attempts: 2, backoff: (n) => n * 30 },
		(r) => retrying.push(r),
	);
	expect(retrying[0]).toEqual({ kind: "Retrying", attempt: 1, lastError: "fail", nextRetryIn: 30 });
});

test("runWithRetry returns null when signal is aborted during backoff wait", async () => {
	const op = Op.create(
		(_signal) => (_: number) => Promise.reject(new Error("fail")),
		(e) => (e as Error).message,
	);
	const controller = new AbortController();
	setTimeout(() => controller.abort(), 20); // abort during the 200ms backoff
	const result = await runWithRetry(
		op,
		1,
		controller.signal,
		{ attempts: 5, backoff: 200 },
		() => {},
	);
	expect(result).toBeNull();
});

// ---------------------------------------------------------------------------
// execute
// ---------------------------------------------------------------------------

test("execute resolves to Ok when the factory succeeds", async () => {
	const controller = new AbortController();
	const outcome = await Deferred.toPromise(
		execute(successOp(), 42, controller, undefined, undefined, undefined),
	);
	expect(outcome).toEqual({ kind: "Ok", value: 42 });
});

test("execute resolves to Err when the factory fails without retry", async () => {
	const controller = new AbortController();
	const outcome = await Deferred.toPromise(
		execute(failOp("oops"), 1, controller, undefined, undefined, undefined),
	);
	expect(outcome).toEqual({ kind: "Err", error: "oops" });
});

test("execute resolves to AbortedNil when the controller is aborted before the op finishes", async () => {
	const controller = new AbortController();
	const d = execute(successOp(100), 1, controller, undefined, undefined, undefined);
	controller.abort();
	const outcome = await Deferred.toPromise(d);
	expect(outcome).toEqual({ kind: "Nil", reason: "aborted" });
});

test("execute calls onRetrying when retryOptions is provided", async () => {
	const controller = new AbortController();
	const retrying: Op.Retrying<string>[] = [];
	await Deferred.toPromise(
		execute(failOp(), 1, controller, { attempts: 3 }, undefined, (r) => retrying.push(r)),
	);
	expect(retrying).toHaveLength(2);
});

test("execute resolves to Err(onTimeout()) when the timeout fires", async () => {
	const controller = new AbortController();
	const outcome = await Deferred.toPromise(
		execute(
			successOp(200),
			1,
			controller,
			undefined,
			{ ms: 20, onTimeout: () => "timed out" },
			undefined,
		),
	);
	expect(outcome).toEqual({ kind: "Err", error: "timed out" });
});

test("execute resolves to Ok when the op finishes before the timeout", async () => {
	const controller = new AbortController();
	const outcome = await Deferred.toPromise(
		execute(
			successOp(0),
			7,
			controller,
			undefined,
			{ ms: 500, onTimeout: () => "timed out" },
			undefined,
		),
	);
	expect(outcome).toEqual({ kind: "Ok", value: 7 });
});

// ---------------------------------------------------------------------------
// makeRestartable
// ---------------------------------------------------------------------------

test("makeRestartable: second run() replaces in-flight first run()", async () => {
	const manager = makeRestartable(successOp(50), undefined, undefined, undefined);
	const p1 = manager.run(1);
	const p2 = manager.run(2);
	expect(await p1).toEqual({ kind: "Nil", reason: "replaced" });
	expect(await p2).toEqual({ kind: "Ok", value: 2 });
});

test("makeRestartable: abort() resolves in-flight Deferred with AbortedNil", async () => {
	const manager = makeRestartable(successOp(100), undefined, undefined, undefined);
	const p = manager.run(1);
	manager.abort();
	expect(await p).toEqual({ kind: "Nil", reason: "aborted" });
});

// ---------------------------------------------------------------------------
// makeExclusive
// ---------------------------------------------------------------------------

test("makeExclusive: second run() while in-flight returns DroppedNil immediately", async () => {
	const manager = makeExclusive(successOp(50), undefined, undefined, undefined);
	const p1 = manager.run(1);
	const p2 = manager.run(2); // dropped
	expect(await p2).toEqual({ kind: "Nil", reason: "dropped" });
	expect(await p1).toEqual({ kind: "Ok", value: 1 });
});

// ---------------------------------------------------------------------------
// makeQueue
// ---------------------------------------------------------------------------

test("makeQueue: queued run() waits for the in-flight one to finish", async () => {
	const manager = makeQueue(successOp(20), undefined, undefined, undefined, undefined, undefined, undefined);
	const [r1, r2] = await Promise.all([manager.run(1), manager.run(2)]);
	expect(r1).toEqual({ kind: "Ok", value: 1 });
	expect(r2).toEqual({ kind: "Ok", value: 2 });
});

// ---------------------------------------------------------------------------
// makeBuffered
// ---------------------------------------------------------------------------

test("makeBuffered: third run() evicts the waiting run()", async () => {
	const manager = makeBuffered(successOp(30), undefined, undefined, undefined);
	const p1 = manager.run(1);
	const p2 = manager.run(2); // waiting
	const p3 = manager.run(3); // evicts p2
	expect(await p2).toEqual({ kind: "Nil", reason: "evicted" });
	expect(await p1).toEqual({ kind: "Ok", value: 1 });
	expect(await p3).toEqual({ kind: "Ok", value: 3 });
});

// ---------------------------------------------------------------------------
// makeDebounced
// ---------------------------------------------------------------------------

test("makeDebounced (trailing): run() resolves after the debounce timer", async () => {
	const manager = makeDebounced(successOp(), 10, false, undefined, undefined, undefined);
	const result = await manager.run(5);
	expect(result).toEqual({ kind: "Ok", value: 5 });
});

test("makeDebounced (leading): run() fires immediately", async () => {
	const manager = makeDebounced(successOp(), 30, true, undefined, undefined, undefined);
	const p = manager.run(7);
	expect(manager.state).toEqual({ kind: "Pending" });
	expect(await p).toEqual({ kind: "Ok", value: 7 });
});

// ---------------------------------------------------------------------------
// makeThrottled
// ---------------------------------------------------------------------------

test("makeThrottled: run() fires immediately and drops run() calls within the cooldown", async () => {
	const manager = makeThrottled(successOp(), 50, false, undefined, undefined);
	const p1 = manager.run(1);
	const p2 = manager.run(2); // dropped — in cooldown
	expect(await p2).toEqual({ kind: "Nil", reason: "dropped" });
	expect(await p1).toEqual({ kind: "Ok", value: 1 });
});

// ---------------------------------------------------------------------------
// makeConcurrent
// ---------------------------------------------------------------------------

test("makeConcurrent: two runs at once when n=2", async () => {
	const manager = makeConcurrent(successOp(20), 2, "drop", undefined, undefined);
	const [r1, r2] = await Promise.all([manager.run(1), manager.run(2)]);
	expect(r1).toEqual({ kind: "Ok", value: 1 });
	expect(r2).toEqual({ kind: "Ok", value: 2 });
});

test("makeConcurrent: overflow=drop returns DroppedNil when all slots full", async () => {
	const manager = makeConcurrent(successOp(30), 1, "drop", undefined, undefined);
	const p1 = manager.run(1);
	const p2 = manager.run(2); // dropped
	expect(await p2).toEqual({ kind: "Nil", reason: "dropped" });
	await p1;
});

// ---------------------------------------------------------------------------
// makeKeyed
// ---------------------------------------------------------------------------

test("makeKeyed exclusive: same key while in-flight returns DroppedNil", async () => {
	const manager = makeKeyed(successOp(50), (n: number) => n, "exclusive", undefined);
	const p1 = manager.run(1);
	const p2 = manager.run(1); // same key → dropped
	expect(await p2).toEqual({ kind: "Nil", reason: "dropped" });
	expect(await p1).toEqual({ kind: "Ok", value: 1 });
});

test("makeKeyed restartable: same key while in-flight cancels previous", async () => {
	const manager = makeKeyed(successOp(50), (n: number) => n, "restartable", undefined);
	const p1 = manager.run(1);
	const p2 = manager.run(1); // same key → replaces
	expect(await p1).toEqual({ kind: "Nil", reason: "replaced" });
	expect(await p2).toEqual({ kind: "Ok", value: 1 });
});

// ---------------------------------------------------------------------------
// makeOnce
// ---------------------------------------------------------------------------

test("makeOnce: first run() resolves; all subsequent run() calls return DroppedNil", async () => {
	const manager = makeOnce(successOp(), undefined, undefined);
	const p1 = manager.run(1);
	const p2 = manager.run(2);
	expect(await p1).toEqual({ kind: "Ok", value: 1 });
	expect(await p2).toEqual({ kind: "Nil", reason: "dropped" });
});

// ---------------------------------------------------------------------------
// Staleness-guard false branches
//
// Both makeThrottled and makeDebounced can start a second execution while the
// first is still running — the new call overwrites `currentController` WITHOUT
// aborting the old controller's signal. When the old execution retries, the
// guard `currentController === controller` is false, so the stale Retrying
// state is suppressed. These tests exercise that exact false branch.
// ---------------------------------------------------------------------------

test("makeThrottled: onRetrying guard suppresses stale Retrying state from first execution when trailing call takes over", async () => {
	// op always fails after 20ms
	// throttle: ms=10ms, trailing=true
	// retry: attempts=2, backoff=0
	//
	// Timeline:
	//   t=0:   run(1) → fireOp(1, r1), currentController=c1, startCooldown(10ms)
	//   t=2ms: run(2) buffered as trailing
	//   t=10ms: cooldown fires → fireOp(2, r2), currentController=c2 (c1 NOT aborted)
	//   t=20ms: op1 fails (attempt 1) → onRetrying1 fires, currentController=c2 ≠ c1 → guard FALSE → no emit
	//   t=20ms: op1 attempt 2 starts immediately (backoff=0)
	//   t=30ms: op2 starts + 20ms = t=30ms: op2 fails → onRetrying2 fires, currentController=c2 → guard TRUE → emit
	//
	// Net result: only one Retrying emitted (from op2), not two (op1's is suppressed).

	let factoryCalls = 0;
	const op = Op.create(
		(signal) => (_: number) =>
			new Promise<never>((_r, reject) => {
				factoryCalls++;
				const id = setTimeout(() => reject(new Error("fail")), 20);
				signal.addEventListener("abort", () => {
					clearTimeout(id);
					reject(new Error("abort"));
				}, { once: true });
			}),
		(e) => (e as Error).message,
	);

	const states: Op.State<string, number>[] = [];
	const manager = makeThrottled(op, 10, true, { attempts: 2, backoff: 0 }, undefined);
	manager.subscribe((s) => states.push(s));

	manager.run(1);
	await new Promise((r) => setTimeout(r, 2)); // within cooldown
	manager.run(2); // buffered as trailing

	// Wait long enough for both executions to complete (2 attempts × 20ms + margin)
	await new Promise((r) => setTimeout(r, 120));

	// op1 (2 attempts) + op2 (2 attempts) = 4 factory calls total
	expect(factoryCalls).toBe(4);

	const retryingStates = states.filter((s) => s.kind === "Retrying");
	// op1's Retrying was suppressed; only op2's first-attempt Retrying was emitted
	expect(retryingStates).toHaveLength(1);
	expect(retryingStates[0]).toEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
});

test("makeDebounced (trailing): onRetrying guard suppresses stale Retrying state when timer fires again mid-execution", async () => {
	// Pure trailing debounce (leading=false), op always fails after 25ms
	// debounce ms=10ms, retry: attempts=2, backoff=0
	//
	// Timeline:
	//   t=0:   run(1) → scheduleTrailing(10ms)
	//   t=10ms: fireTrailing(1, r1) → currentController=c1
	//   t=12ms: run(2) → inDebounceWindow (c1 active) → buffers, scheduleTrailing(10ms)
	//   t=22ms: timer fires → fireTrailing(2, r2) → currentController=c2 (c1 NOT aborted)
	//   t=35ms: op1 fails (attempt 1) → onRetrying1 fires, currentController=c2 ≠ c1 → guard FALSE → no emit
	//   t=35ms: op1 attempt 2 starts; meanwhile op2 is already running (started at t=22ms)
	//   t=47ms: op2 fails → onRetrying2 fires, currentController=c2 → guard TRUE → emit
	//
	// Net result: only one Retrying emitted (from op2 attempt 1), not two.

	let factoryCalls = 0;
	const op = Op.create(
		(signal) => (_: number) =>
			new Promise<never>((_r, reject) => {
				factoryCalls++;
				const id = setTimeout(() => reject(new Error("fail")), 25);
				signal.addEventListener("abort", () => {
					clearTimeout(id);
					reject(new Error("abort"));
				}, { once: true });
			}),
		(e) => (e as Error).message,
	);

	const states: Op.State<string, number>[] = [];
	const manager = makeDebounced(op, 10, false, undefined, { attempts: 2, backoff: 0 }, undefined);
	manager.subscribe((s) => states.push(s));

	manager.run(1);
	await new Promise((r) => setTimeout(r, 12)); // within debounce window of first trailing
	manager.run(2); // triggers a second trailing timer

	// Wait for both executions to complete
	await new Promise((r) => setTimeout(r, 150));

	// op1 (2 attempts) + op2 (2 attempts) = 4 factory calls total
	expect(factoryCalls).toBe(4);

	const retryingStates = states.filter((s) => s.kind === "Retrying");
	// op1's Retrying was suppressed; only op2's first-attempt Retrying was emitted
	expect(retryingStates).toHaveLength(1);
	expect(retryingStates[0]).toEqual({ kind: "Retrying", attempt: 1, lastError: "fail" });
});
