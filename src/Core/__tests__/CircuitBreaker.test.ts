import { assert, expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../../Types/Duration.ts";
import { CircuitBreaker } from "../CircuitBreaker.ts";
import { Deferred } from "../Deferred.ts";
import { Result } from "../Result.ts";
import { Task } from "../Task.ts";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const makeOkTask = <A>(value: A, delayMs = 0): Task.Result<never, A> => (signal?: AbortSignal) =>
	Deferred.from.Promise(
		new Promise<Result<never, A>>((resolve) => {
			if (delayMs === 0) {
				resolve(Result.make.ok(value));
				return;
			}
			const timer = setTimeout(() => resolve(Result.make.ok(value)), delayMs);
			signal?.addEventListener("abort", () => {
				clearTimeout(timer);
				resolve(Result.make.ok(value));
			}, { once: true });
		}),
	);

const makeErrTask = <E>(error: E, delayMs = 0): Task.Result<E, never> => (signal?: AbortSignal) =>
	Deferred.from.Promise(
		new Promise<Result<E, never>>((resolve) => {
			if (delayMs === 0) {
				resolve(Result.make.err(error));
				return;
			}
			const timer = setTimeout(() => resolve(Result.make.err(error)), delayMs);
			signal?.addEventListener("abort", () => {
				clearTimeout(timer);
				resolve(Result.make.err(error));
			}, { once: true });
		}),
	);

// -----------------------------------------------------------------------------
// Initial state & make options
// -----------------------------------------------------------------------------

test("make: initial state is Closed with 0 failures", () => {
	const breaker = CircuitBreaker.make({ failureThreshold: 3, resetTimeout: Duration.milliseconds(50) });

	const state = breaker.state();
	expect(state).toStrictEqual({ kind: "Closed", failures: 0 });
	expect(CircuitBreaker.is.closed(state)).toBe(true);
	expect(CircuitBreaker.is.open(state)).toBe(false);
	expect(CircuitBreaker.is.halfOpen(state)).toBe(false);
});

test("make: normalizes invalid or fractional thresholds to at least 1", () => {
	const breaker = CircuitBreaker.make({
		failureThreshold: -5,
		resetTimeout: Duration.milliseconds(-10),
		successThreshold: 0.5,
	});

	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });
});

// -----------------------------------------------------------------------------
// Closed state behavior
// -----------------------------------------------------------------------------

test("protect: passes through successful result in Closed state and keeps failures at 0", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 2, resetTimeout: Duration.milliseconds(50) });

	const result = await breaker.protect(makeOkTask(42))();
	expect(result).toStrictEqual(Result.make.ok(42));
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });
});

test("protect: increments failures on tripping errors until failureThreshold is reached", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 2, resetTimeout: Duration.milliseconds(50) });

	const res1 = await breaker.protect(makeErrTask("err_1"))();
	expect(res1).toStrictEqual(Result.make.err("err_1"));
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 1 });

	const res2 = await breaker.protect(makeErrTask("err_2"))();
	expect(res2).toStrictEqual(Result.make.err("err_2"));

	const state = breaker.state();
	expect(CircuitBreaker.is.open(state)).toBe(true);
	assert(state.kind === "Open");
	expect(state.lastError).toBe("err_2");
	expect(state.retryAfterMs).toBeGreaterThan(0);
});

test("protect: consecutive failures reset to 0 upon a successful execution", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 2, resetTimeout: Duration.milliseconds(50) });

	await breaker.protect(makeErrTask("err_1"))();
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 1 });

	// Intervening success resets failure count
	await breaker.protect(makeOkTask("ok"))();
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });

	// Next failure only brings count to 1, does not trip
	await breaker.protect(makeErrTask("err_2"))();
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 1 });
});

// -----------------------------------------------------------------------------
// shouldTrip filtering
// -----------------------------------------------------------------------------

test("protect: ignores errors where shouldTrip returns false", async () => {
	type AppError = { kind: "NotFound"; } | { kind: "ServerCrash"; };

	const breaker = CircuitBreaker.make<AppError>({
		failureThreshold: 2,
		resetTimeout: Duration.milliseconds(50),
		shouldTrip: (err) => err.kind === "ServerCrash",
	});

	// NotFound does not trip
	await breaker.protect(makeErrTask<AppError>({ kind: "NotFound" }))();
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });

	// ServerCrash trips
	await breaker.protect(makeErrTask<AppError>({ kind: "ServerCrash" }))();
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 1 });

	await breaker.protect(makeErrTask<AppError>({ kind: "ServerCrash" }))();
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);
});

test("protect: treats throwing shouldTrip predicate as tripping error", async () => {
	const breaker = CircuitBreaker.make<string>({
		failureThreshold: 1,
		resetTimeout: Duration.milliseconds(50),
		shouldTrip: () => {
			throw new Error("predicate_failure");
		},
	});

	await breaker.protect(makeErrTask("boom"))();
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);
});

// -----------------------------------------------------------------------------
// Open state & Fast-failing
// -----------------------------------------------------------------------------

test("protect: fast-fails immediately in 0ms with CircuitOpenError when Open", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(100) });

	await breaker.protect(makeErrTask("upstream_failure"))();
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);

	let called = false;
	const sideEffectTask: Task.Result<string, number> = () => {
		called = true;
		return Deferred.from.Promise(Promise.resolve(Result.make.ok(99)));
	};

	const res = await breaker.protect(sideEffectTask)();
	expect(called).toBe(false); // Isolated: underlying task is never invoked
	assert(res.kind === "Err");
	assert(CircuitBreaker.is.openError(res.error));
	expect(res.error.kind).toBe("CircuitOpenError");
	expect(res.error.lastError).toBe("upstream_failure");
	expect(res.error.retryAfterMs).toBeGreaterThan(0);
});

// -----------------------------------------------------------------------------
// HalfOpen state & probe trial
// -----------------------------------------------------------------------------

test("state: evaluates to HalfOpen when resetTimeout elapses without incoming requests", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(20) });

	await breaker.protect(makeErrTask("err"))();
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);

	await sleep(35);

	const state = breaker.state();
	expect(CircuitBreaker.is.halfOpen(state)).toBe(true);
	assert(state.kind === "HalfOpen");
	expect(state.probeInFlight).toBe(false);
	expect(state.consecutiveSuccesses).toBe(0);
});

test("protect: fast-fails concurrent calls while trial probe is in flight during HalfOpen", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(20) });

	await breaker.protect(makeErrTask("err"))();
	await sleep(30);

	// Probe task takes 40ms to settle
	const probeTask = makeOkTask("probe_ok", 40);

	let concurrentCalled = false;
	const concurrentTask: Task.Result<string, string> = () => {
		concurrentCalled = true;
		return Deferred.from.Promise(Promise.resolve(Result.make.ok("concurrent_ok")));
	};

	const probePromise = breaker.protect(probeTask)();

	// Give microtask tick for probe to set probeInFlight = true
	await sleep(5);

	// Concurrent call arriving while probe is in flight
	const concurrentResult = await breaker.protect(concurrentTask)();

	expect(concurrentCalled).toBe(false);
	assert(concurrentResult.kind === "Err");
	assert(CircuitBreaker.is.openError(concurrentResult.error));
	expect(concurrentResult.error.lastError).toBe("err");
	expect(concurrentResult.error.retryAfterMs).toBe(0);

	const probeResult = await probePromise;
	expect(probeResult).toStrictEqual(Result.make.ok("probe_ok"));
	expect(CircuitBreaker.is.closed(breaker.state())).toBe(true);
});

test("protect: resets to Closed after successThreshold consecutive successful probes", async () => {
	const breaker = CircuitBreaker.make<string>({
		failureThreshold: 1,
		resetTimeout: Duration.milliseconds(20),
		successThreshold: 2,
	});

	await breaker.protect(makeErrTask("err"))();
	await sleep(30);

	// First probe succeeds
	const res1 = await breaker.protect(makeOkTask(1))();
	expect(res1).toStrictEqual(Result.make.ok(1));

	// Still HalfOpen because successThreshold is 2
	const intermediateState = breaker.state();
	expect(CircuitBreaker.is.halfOpen(intermediateState)).toBe(true);
	assert(intermediateState.kind === "HalfOpen");
	expect(intermediateState.probeInFlight).toBe(false);
	expect(intermediateState.consecutiveSuccesses).toBe(1);

	// Second probe succeeds -> circuit recovers to Closed
	const res2 = await breaker.protect(makeOkTask(2))();
	expect(res2).toStrictEqual(Result.make.ok(2));
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });
});

test("protect: immediately re-trips to Open if probe in HalfOpen fails with tripping error", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(20) });

	await breaker.protect(makeErrTask("original_err"))();
	await sleep(30);

	const probeRes = await breaker.protect(makeErrTask("new_probe_err"))();
	expect(probeRes).toStrictEqual(Result.make.err("new_probe_err"));

	const state = breaker.state();
	expect(CircuitBreaker.is.open(state)).toBe(true);
	assert(state.kind === "Open");
	expect(state.lastError).toBe("new_probe_err");
});

test("protect: advances consecutiveSuccesses if probe in HalfOpen returns non-tripping error", async () => {
	type ErrorKind = "500_server" | "404_not_found";

	const breaker = CircuitBreaker.make<ErrorKind>({
		failureThreshold: 1,
		resetTimeout: Duration.milliseconds(20),
		shouldTrip: (e) => e === "500_server",
	});

	await breaker.protect(makeErrTask<ErrorKind>("500_server"))();
	await sleep(30);

	// Probe returns 404_not_found (service responded, not broken)
	const probeRes = await breaker.protect(makeErrTask<ErrorKind>("404_not_found"))();
	expect(probeRes).toStrictEqual(Result.make.err("404_not_found"));

	// Circuit recovered to Closed because downstream answered
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });
});

// -----------------------------------------------------------------------------
// AbortSignal handling
// -----------------------------------------------------------------------------

test("protect: caller pre-aborted signal resolves through task without incrementing failures", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(50) });

	const controller = new AbortController();
	controller.abort();

	const abortedTask: Task.Result<string, number> = (signal) =>
		Deferred.from.Promise(Promise.resolve(signal?.aborted ? Result.make.err("aborted") : Result.make.ok(1)));

	const res = await breaker.protect(abortedTask)(controller.signal);
	expect(res).toStrictEqual(Result.make.err("aborted"));
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });
});

test("protect: caller abortion during HalfOpen probe releases probeInFlight lock", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(20) });

	await breaker.protect(makeErrTask("err"))();
	await sleep(30);

	const controller = new AbortController();
	const probeTask = makeOkTask("probe_value", 50);

	const probePromise = breaker.protect(probeTask)(controller.signal);

	// Abort caller while probe is running
	await sleep(10);
	controller.abort();

	await probePromise;

	// Breaker should not be stuck with probeInFlight: true
	const state = breaker.state();
	expect(CircuitBreaker.is.halfOpen(state)).toBe(true);
	assert(state.kind === "HalfOpen");
	expect(state.probeInFlight).toBe(false);
});

// -----------------------------------------------------------------------------
// Sliding failure window
// -----------------------------------------------------------------------------

test("protect: supports sliding failureWindow and prunes expired failures", async () => {
	const breaker = CircuitBreaker.make<string>({
		failureThreshold: 2,
		resetTimeout: Duration.milliseconds(50),
		failureWindow: Duration.milliseconds(30),
	});

	// Failure 1
	await breaker.protect(makeErrTask("err_1"))();
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 1 });

	// Wait for failure 1 to expire past the 30ms window
	await sleep(40);
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });

	// Failure 2 arrives after expiration -> count is 1, circuit does not trip
	await breaker.protect(makeErrTask("err_2"))();
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 1 });
});

test("protect: in failureWindow mode, intervening successes do not wipe windowed failures", async () => {
	const breaker = CircuitBreaker.make<string>({
		failureThreshold: 2,
		resetTimeout: Duration.milliseconds(50),
		failureWindow: Duration.milliseconds(100),
	});

	// Failure 1
	await breaker.protect(makeErrTask("err_1"))();
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 1 });

	// Intervening success
	await breaker.protect(makeOkTask("ok"))();
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 1 });

	// Failure 2 within 100ms window -> trips circuit to Open!
	await breaker.protect(makeErrTask("err_2"))();
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);
});

// -----------------------------------------------------------------------------
// reset & subscribe
// -----------------------------------------------------------------------------

test("reset: does not notify subscribers if circuit was already clean Closed", () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 2, resetTimeout: Duration.milliseconds(50) });

	let called = false;
	breaker.subscribe(() => {
		called = true;
	});

	breaker.reset();
	expect(called).toBe(false);
});

test("protect: handles call-site pre-aborted signal directly", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 2, resetTimeout: Duration.milliseconds(50) });

	const controller = new AbortController();
	controller.abort();

	const task = makeOkTask("immediate_abort");
	const res = await breaker.protect(task)(controller.signal);
	expect(res).toStrictEqual(Result.make.ok("immediate_abort"));
});

test("reset: forces circuit from Open to Closed and clears failures", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(100) });

	await breaker.protect(makeErrTask("err"))();
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);

	breaker.reset();
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });
});

test("reset: invalidates in-flight probe and prevents late probe failure from reopening circuit", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(20) });

	// Trip circuit
	await breaker.protect(makeErrTask("err_1"))();
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);
	await sleep(30);

	// Launch probe that will take 40ms and fail
	const probePromise = breaker.protect(makeErrTask("late_probe_err", 40))();

	// Wait 10ms for probe to start
	await sleep(10);

	// Operator manually resets breaker to Closed
	breaker.reset();
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });

	// Wait for the probe to settle
	const res = await probePromise;
	expect(res).toStrictEqual(Result.make.err("late_probe_err"));

	// Circuit must still be Closed; late probe failure must not reopen the circuit
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });
});

test("reset: catches and isolates subscriber callback errors without throwing", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(50) });

	breaker.subscribe(() => {
		throw new Error("reset_subscriber_crash");
	});

	await breaker.protect(makeErrTask("err"))();

	expect(() => breaker.reset()).not.toThrow();
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });
});

test("subscribe: notifies listeners of state transitions and allows unsubscribing", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(20) });

	const transitions: CircuitBreaker.State<string>[] = [];
	const unsub = breaker.subscribe((s) => transitions.push(s));

	// Closed -> Open
	await breaker.protect(makeErrTask("err"))();
	expect(transitions).toHaveLength(1);
	expect(transitions[0]?.kind).toBe("Open");

	// Wait for cooldown
	await sleep(30);

	// Open -> HalfOpen (probe starts) -> Closed (probe succeeds)
	await breaker.protect(makeOkTask("ok"))();

	expect(transitions).toHaveLength(3);
	expect(transitions[1]?.kind).toBe("HalfOpen");
	expect(transitions[2]?.kind).toBe("Closed");

	// Unsubscribe stops future notifications
	unsub();
	await breaker.protect(makeErrTask("err_2"))();
	expect(transitions).toHaveLength(3);
});

test("subscribe: catches and isolates subscriber callback errors without disrupting execution", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(50) });

	breaker.subscribe(() => {
		throw new Error("subscriber_crash");
	});

	// Should not throw or crash
	const res = await breaker.protect(makeErrTask("err"))();
	expect(res).toStrictEqual(Result.make.err("err"));
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);
});

test("protect: in Closed state, caller aborting during in-flight task resolves without incrementing failures", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(50) });

	const controller = new AbortController();
	const task = makeOkTask("value", 30);
	const promise = breaker.protect(task)(controller.signal);

	await sleep(10);
	controller.abort();

	const res = await promise;
	expect(res).toStrictEqual(Result.make.ok("value"));
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });
});

test("protect: in HalfOpen state, throwing shouldTrip predicate trips back to Open", async () => {
	let shouldThrow = false;
	const breaker = CircuitBreaker.make<string>({
		failureThreshold: 1,
		resetTimeout: Duration.milliseconds(20),
		shouldTrip: () => {
			if (shouldThrow) { throw new Error("predicate_crash"); }
			return true;
		},
	});

	await breaker.protect(makeErrTask("err_1"))();
	await sleep(30);

	shouldThrow = true;
	const res = await breaker.protect(makeErrTask("err_probe"))();
	expect(res).toStrictEqual(Result.make.err("err_probe"));
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);
});

test("protect: in HalfOpen state with successThreshold 2, non-tripping error advances consecutiveSuccesses", async () => {
	type ErrorKind = "trip" | "ignore";
	const breaker = CircuitBreaker.make<ErrorKind>({
		failureThreshold: 1,
		resetTimeout: Duration.milliseconds(20),
		successThreshold: 2,
		shouldTrip: (e) => e === "trip",
	});

	await breaker.protect(makeErrTask<ErrorKind>("trip"))();
	await sleep(30);

	// Probe 1 returns non-tripping error
	const probe1 = await breaker.protect(makeErrTask<ErrorKind>("ignore"))();
	expect(probe1).toStrictEqual(Result.make.err("ignore"));

	// Intermediate HalfOpen state: consecutiveSuccesses: 1
	const state = breaker.state();
	expect(CircuitBreaker.is.halfOpen(state)).toBe(true);
	assert(state.kind === "HalfOpen");
	expect(state.consecutiveSuccesses).toBe(1);

	// Probe 2 succeeds -> closes circuit
	const probe2 = await breaker.protect(makeOkTask("ok"))();
	expect(probe2).toStrictEqual(Result.make.ok("ok"));
	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });
});

// -----------------------------------------------------------------------------
// Synchronously throwing and rejecting tasks
// -----------------------------------------------------------------------------

test("protect: handles synchronously throwing task in Closed state by resolving to Err", async () => {
	const breaker = CircuitBreaker.make<Error>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(50) });

	const throwingTask: Task.Result<Error, number> = () => {
		throw new Error("sync_throw");
	};

	const res = await breaker.protect(throwingTask)();
	expect(res).toStrictEqual(Result.make.err(new Error("sync_throw")));
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);
});

test("protect: handles synchronously throwing task in HalfOpen state by resolving to Err", async () => {
	const breaker = CircuitBreaker.make<Error>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(20) });

	await breaker.protect(makeErrTask(new Error("err_1")))();
	await sleep(30);

	const throwingTask: Task.Result<Error, number> = () => {
		throw new Error("sync_throw_half_open");
	};

	const res = await breaker.protect(throwingTask)();
	expect(res).toStrictEqual(Result.make.err(new Error("sync_throw_half_open")));
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);
});

// -----------------------------------------------------------------------------
// Pipe composition & Realistic Recovery
// -----------------------------------------------------------------------------

test("pipe: composes cleanly inside pipe", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 2, resetTimeout: Duration.milliseconds(50) });

	const protectedTask = pipe(makeOkTask(100), breaker.protect);

	const res = await protectedTask();
	expect(res).toStrictEqual(Result.make.ok(100));
});

test("pipe: composes in realistic multi-step pipeline with fallback error recovery", async () => {
	const breaker = CircuitBreaker.make<{ code: number; message: string; }>({
		failureThreshold: 1,
		resetTimeout: Duration.milliseconds(50),
	});

	type User = { id: string; name: string; };
	const cachedUser: User = { id: "u_fallback", name: "Cached User" };

	const fetchUser = (fail: boolean): Task.Result<{ code: number; message: string; }, User> => () =>
		Deferred.from.Promise(
			Promise.resolve(
				fail
					? Result.make.err({ code: 503, message: "Service Unavailable" })
					: Result.make.ok({ id: "u_1", name: "Alice" }),
			),
		);

	// First call fails downstream -> trips breaker
	const res1 = await pipe(fetchUser(true), breaker.protect)();
	assert(res1.kind === "Err");

	// Second call fast-fails immediately via CircuitOpenError; pipeline recovers to cached fallback
	const pipeline = pipe(
		fetchUser(false),
		breaker.protect,
		Task.Result.match({
			ok: (user) => `Hello, ${user.name}`,
			err: (err) => (CircuitBreaker.is.openError(err) ? `Fallback: ${cachedUser.name}` : `Error: ${err.message}`),
		}),
	);

	const message = await pipeline();
	expect(message).toBe("Fallback: Cached User");
});

// -----------------------------------------------------------------------------
// Adversarial boundary and signal handling
// -----------------------------------------------------------------------------

test("protect: in Open state, pre-aborted signal fast-fails with CircuitOpenError without invoking downstream task", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(50) });

	await breaker.protect(makeErrTask("upstream_failure"))();
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);

	const controller = new AbortController();
	controller.abort();

	let called = false;
	const downstreamTask: Task.Result<string, number> = () => {
		called = true;
		return Deferred.from.Promise(Promise.resolve(Result.make.ok(42)));
	};

	const res = await breaker.protect(downstreamTask)(controller.signal);
	expect(called).toBe(false);
	assert(res.kind === "Err");
	assert(CircuitBreaker.is.openError(res.error));
	expect(res.error.kind).toBe("CircuitOpenError");
	expect(res.error.lastError).toBe("upstream_failure");
});

test("protect: in HalfOpen state with probe in flight, pre-aborted signal fast-fails without invoking task", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(20) });

	await breaker.protect(makeErrTask("trip_err"))();
	await sleep(30);

	// Start probe that runs for 40ms
	const probePromise = breaker.protect(makeOkTask("probe_val", 40))();
	await sleep(5);

	const controller = new AbortController();
	controller.abort();

	let concurrentCalled = false;
	const concurrentTask: Task.Result<string, string> = () => {
		concurrentCalled = true;
		return Deferred.from.Promise(Promise.resolve(Result.make.ok("concurrent")));
	};

	const concurrentRes = await breaker.protect(concurrentTask)(controller.signal);
	expect(concurrentCalled).toBe(false);
	assert(concurrentRes.kind === "Err");
	assert(CircuitBreaker.is.openError(concurrentRes.error));
	expect(concurrentRes.error.retryAfterMs).toBe(0);

	await probePromise;
});

test("protect: in HalfOpen state without probe in flight, pre-aborted signal does not consume probe slot", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(20) });

	await breaker.protect(makeErrTask("err"))();
	await sleep(30);

	const controller = new AbortController();
	controller.abort();

	const abortedTask: Task.Result<string, number> = (signal) =>
		Deferred.from.Promise(Promise.resolve(signal?.aborted ? Result.make.err("aborted") : Result.make.ok(1)));

	await breaker.protect(abortedTask)(controller.signal);

	// State must still permit next real probe
	const state = breaker.state();
	expect(CircuitBreaker.is.halfOpen(state)).toBe(true);
	assert(state.kind === "HalfOpen");
	expect(state.probeInFlight).toBe(false);
});

test("make: normalizes NaN and non-finite configuration values safely and trips correctly", async () => {
	const breaker = CircuitBreaker.make<string>({
		failureThreshold: Number.NaN,
		resetTimeout: Duration.milliseconds(50),
		successThreshold: Number.NaN,
		failureWindow: Duration.milliseconds(Number.NaN),
	});

	expect(breaker.state()).toStrictEqual({ kind: "Closed", failures: 0 });

	// Should trip after 1 failure because failureThreshold normalized to 1
	await breaker.protect(makeErrTask("err"))();
	expect(CircuitBreaker.is.open(breaker.state())).toBe(true);
});

test("make: normalizes NaN resetTimeout to 0ms (evaluates immediately to HalfOpen)", async () => {
	const breaker = CircuitBreaker.make<string>({ failureThreshold: 1, resetTimeout: Duration.milliseconds(Number.NaN) });

	await breaker.protect(makeErrTask("err"))();
	// Since resetTimeout is 0ms, cooldown has elapsed immediately
	expect(CircuitBreaker.is.halfOpen(breaker.state())).toBe(true);
});
