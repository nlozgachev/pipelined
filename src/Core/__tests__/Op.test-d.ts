import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../../Types/Duration.ts";
import { RetryPolicy } from "../../Types/RetryPolicy.ts";
import type { Deferred } from "../Deferred.ts";
import type { Maybe } from "../Maybe.ts";
import { Op } from "../Op.ts";
import type { Result } from "../Result.ts";

interface User {
	id: string;
	name: string;
}

interface Payload {
	id: string;
	name: string;
}

const delayedOp = Op.make((_signal: AbortSignal) => (n: number) => Promise.resolve(n), { onError: String });

test("make: infers precise types across zero-argument, multi-argument, and explicit signatures", () => {
	const zeroArgOp = Op.make((_signal) => () => Promise.resolve(42), { onError: String });
	expectTypeOf(zeroArgOp).toEqualTypeOf<Op<[], string, number>>();

	const multiArgOp = Op.make((_signal) => (name: string, age: number) => Promise.resolve(`${name}:${age}`), {
		onError: String,
	});
	expectTypeOf(multiArgOp).toEqualTypeOf<Op<[name: string, age: number], string, string>>();

	const explicitOp = Op.make<[id: string], User, string>((_signal) => (id) => Promise.resolve({ id, name: "User" }), {
		onError: String,
	});
	expectTypeOf(explicitOp).toEqualTypeOf<Op<[id: string], string, User>>();

	const searchApi = (payload: Payload): Promise<{ success: boolean; id: string; }> =>
		Promise.resolve({ success: true, id: payload.id });

	const opFromFn = Op.make((_signal) => searchApi, { onError: String });
	expectTypeOf(opFromFn).toEqualTypeOf<Op<[payload: Payload], string, { success: boolean; id: string; }>>();

	const payloadOp = Op.make((_signal) => (payload: Payload) => Promise.resolve({ success: true, id: payload.id }), {
		onError: String,
	});
	expectTypeOf(payloadOp).toEqualTypeOf<Op<[payload: Payload], string, { success: boolean; id: string; }>>();

	const explicitPayloadOp = Op.make<Payload, User, string>(
		(_signal) => (payload) => Promise.resolve({ id: payload.id, name: payload.name }),
		{ onError: String },
	);
	expectTypeOf(explicitPayloadOp).toEqualTypeOf<Op<[Payload], string, User>>();

	function wrap<Args extends readonly unknown[], Out>(fn: (...args: Args) => Out) {
		return Op.make((_signal) => fn, { onError: String });
	}
	const wrappedOp = wrap((a: string, b: number) => `${a}:${b}`);
	expectTypeOf(wrappedOp).toEqualTypeOf<Op<[a: string, b: number], string, string>>();

	// @ts-expect-error — Op requires an onError handler
	Op.make((_signal) => () => Promise.resolve(42));
});

test("lift: infers unknown error type and preserves argument/return shapes", () => {
	const zeroArgLift = Op.lift((_signal) => () => Promise.resolve(42));
	expectTypeOf(zeroArgLift).toEqualTypeOf<Op<[], unknown, number>>();

	const singleArgLift = Op.lift((_signal) => (n: number) => Promise.resolve(n * 2));
	expectTypeOf(singleArgLift).toEqualTypeOf<Op<[n: number], unknown, number>>();

	const explicitLift = Op.lift<Payload, User>((_signal) => (payload) =>
		Promise.resolve({ id: payload.id, name: payload.name })
	);
	expectTypeOf(explicitLift).toEqualTypeOf<Op<[Payload], unknown, User>>();

	const apiFn = (payload: Payload): Promise<{ success: boolean; id: string; }> =>
		Promise.resolve({ success: true, id: payload.id });
	const liftFromFn = Op.lift((_signal) => apiFn);
	expectTypeOf(liftFromFn).toEqualTypeOf<Op<[payload: Payload], unknown, { success: boolean; id: string; }>>();
});

test("interpret: infers strategy-specific state unions and manager run return types", () => {
	const onceManager = Op.interpret(delayedOp, { strategy: "once" });
	expectTypeOf(onceManager).toEqualTypeOf<Op.Manager<[n: number], string, number, Op.OnceState<string, number>>>();
	expectTypeOf(onceManager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.DroppedNil>
	>();

	const restartableManager = Op.interpret(delayedOp, { strategy: "restartable" });
	expectTypeOf(restartableManager.state).toEqualTypeOf<Op.RestartableState<string, number>>();
	expectTypeOf(restartableManager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.ReplacedNil>
	>();

	const exclusiveManager = Op.interpret(delayedOp, { strategy: "exclusive" });
	expectTypeOf(exclusiveManager.state).toEqualTypeOf<Op.ExclusiveState<string, number>>();
	expectTypeOf(exclusiveManager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.DroppedNil>
	>();

	const queueManager = Op.interpret(delayedOp, { strategy: "queue" });
	expectTypeOf(queueManager.state).toEqualTypeOf<Op.QueueState<string, number>>();
	expectTypeOf(queueManager.run).returns.toEqualTypeOf<Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil>>();

	const queueDropManager = Op.interpret(delayedOp, { strategy: "queue", maxSize: 5 });
	expectTypeOf(queueDropManager.state).toEqualTypeOf<Op.QueueDropState<string, number>>();
	expectTypeOf(queueDropManager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.DroppedNil>
	>();

	const queueReplaceManager = Op.interpret(delayedOp, { strategy: "queue", overflow: "replace-last" });
	expectTypeOf(queueReplaceManager.state).toEqualTypeOf<Op.QueueReplaceState<string, number>>();
	expectTypeOf(queueReplaceManager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.EvictedNil>
	>();

	const queueDropAndReplace = Op.interpret(delayedOp, {
		strategy: "queue",
		overflow: "replace-last",
		dedupe: (a, b) => a[0] === b[0],
	});
	expectTypeOf(queueDropAndReplace.state).toEqualTypeOf<Op.QueueDropAndReplaceState<string, number>>();
	expectTypeOf(queueDropAndReplace.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.DroppedNil | Op.EvictedNil>
	>();

	const bufferedManager = Op.interpret(delayedOp, { strategy: "buffered", size: 3 });
	expectTypeOf(bufferedManager.state).toEqualTypeOf<Op.BufferedState<string, number>>();
	expectTypeOf(bufferedManager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.EvictedNil>
	>();

	const debouncedManager = Op.interpret(delayedOp, { strategy: "debounced", duration: Duration.milliseconds(100) });
	expectTypeOf(debouncedManager.state).toEqualTypeOf<Op.DebouncedState<string, number>>();
	expectTypeOf(debouncedManager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.EvictedNil>
	>();

	const throttledManager = Op.interpret(delayedOp, { strategy: "throttled", duration: Duration.milliseconds(100) });
	expectTypeOf(throttledManager.state).toEqualTypeOf<Op.ThrottledState<string, number>>();
	expectTypeOf(throttledManager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.DroppedNil>
	>();

	const throttledTrailingManager = Op.interpret(delayedOp, {
		strategy: "throttled",
		duration: Duration.milliseconds(100),
		trailing: true,
	});
	expectTypeOf(throttledTrailingManager.state).toEqualTypeOf<Op.ThrottledTrailingState<string, number>>();
	expectTypeOf(throttledTrailingManager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.EvictedNil>
	>();

	const concurrentDropManager = Op.interpret(delayedOp, { strategy: "concurrent", concurrency: 2 });
	expectTypeOf(concurrentDropManager.state).toEqualTypeOf<Op.ConcurrentDropState<string, number>>();
	expectTypeOf(concurrentDropManager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.DroppedNil>
	>();

	const concurrentQueueManager = Op.interpret(delayedOp, { strategy: "concurrent", concurrency: 2, overflow: "queue" });
	expectTypeOf(concurrentQueueManager.state).toEqualTypeOf<Op.ConcurrentQueueState<string, number>>();
	expectTypeOf(concurrentQueueManager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil>
	>();

	const keyedImplicit = Op.interpret(delayedOp, { strategy: "keyed", perKey: "exclusive" });
	expectTypeOf(keyedImplicit).toEqualTypeOf<
		Op.KeyedManager<[n: number], number, string, Op.KeyedExclusivePerKey<string, number>>
	>();
	expectTypeOf(keyedImplicit.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.DroppedNil>
	>();

	const keyedExclusive = Op.interpret(delayedOp, { strategy: "keyed", key: (n: number) => n, perKey: "exclusive" });
	expectTypeOf(keyedExclusive).toEqualTypeOf<
		Op.KeyedManager<[n: number], number, string, Op.KeyedExclusivePerKey<string, number>>
	>();
	expectTypeOf(keyedExclusive.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.DroppedNil>
	>();

	const keyedRestartable = Op.interpret(delayedOp, { strategy: "keyed", key: (n: number) => n, perKey: "restartable" });
	expectTypeOf(keyedRestartable).toEqualTypeOf<
		Op.KeyedManager<[n: number], number, string, Op.KeyedRestartablePerKey<string, number>>
	>();
	expectTypeOf(keyedRestartable.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<string> | Op.AbortedNil | Op.ReplacedNil>
	>();

	// @ts-expect-error — invalid strategy name
	Op.interpret(delayedOp, { strategy: "unknown" });

	// @ts-expect-error — wrong argument type to run
	onceManager.run("wrong_type");
});

test("interpret options: widens state union with Retrying and widens error with timeout", () => {
	const typedRetry: Op.RetryOptions<string> = {
		attempts: 2,
		when: (e) => e.length > 0,
		backoff: RetryPolicy.constant({ attempts: 2, delay: Duration.milliseconds(50) }),
	};
	expectTypeOf(typedRetry).toEqualTypeOf<Op.RetryOptions<string>>();

	const typedTimeout: Op.TimeoutOptions<Error> = {
		duration: Duration.milliseconds(500),
		onTimeout: () => new Error("timeout error"),
	};
	expectTypeOf(typedTimeout).toEqualTypeOf<Op.TimeoutOptions<Error>>();

	const retryManager = Op.interpret(delayedOp, { strategy: "restartable", retry: typedRetry });
	expectTypeOf(retryManager.state).toEqualTypeOf<Op.RestartableState<string, number> | Op.Retrying<string>>();

	const timeoutOp = Op.make((_signal: AbortSignal) => (_input: number) => Promise.resolve(42), {
		onError: (_err) => "op_error" as const,
	});
	const timeoutManager = Op.interpret(timeoutOp, {
		strategy: "restartable",
		timeout: { duration: Duration.milliseconds(10), onTimeout: () => "timeout_error" as const },
	});
	expectTypeOf(timeoutManager.state).toEqualTypeOf<Op.RestartableState<"op_error" | "timeout_error", number>>();
	expectTypeOf(timeoutManager.run).returns.toEqualTypeOf<
		Deferred<Op.Ok<number> | Op.Err<"op_error" | "timeout_error"> | Op.AbortedNil | Op.ReplacedNil>
	>();
});

test("is guards: narrows manager state and outcome variants", () => {
	const state: Op.State<string, number> = constTruthyBool()
		? { kind: "Idle" }
		: constTruthyBool()
		? { kind: "Pending" }
		: constTruthyBool()
		? { kind: "Queued", position: 1 }
		: constTruthyBool()
		? { kind: "Retrying", attempt: 1, lastError: "err" }
		: constTruthyBool()
		? Op.Outcome.make.ok(42)
		: constTruthyBool()
		? Op.Outcome.make.err("err")
		: Op.Outcome.make.nil("aborted");

	if (Op.is.idle(state)) {
		expectTypeOf(state).toEqualTypeOf<Op.Idle>();
	}
	if (Op.is.pending(state)) {
		expectTypeOf(state).toEqualTypeOf<Op.Pending>();
	}
	if (Op.is.queued(state)) {
		expectTypeOf(state).toEqualTypeOf<Op.Queued>();
	}
	if (Op.is.retrying(state)) {
		expectTypeOf(state).toEqualTypeOf<Op.Retrying<string>>();
	}
	if (Op.is.settled(state)) {
		expectTypeOf(state).toEqualTypeOf<Op.Outcome<string, number>>();
	}

	const outcome: Op.Outcome<string, number> = constTruthyBool()
		? Op.Outcome.make.ok(42)
		: constTruthyBool()
		? Op.Outcome.make.err("err")
		: Op.Outcome.make.nil("aborted");

	if (Op.Outcome.is.ok(outcome)) {
		expectTypeOf(outcome).toEqualTypeOf<Op.Ok<number>>();
		expectTypeOf(outcome.value).toEqualTypeOf<number>();
	}
	if (Op.Outcome.is.err(outcome)) {
		expectTypeOf(outcome).toEqualTypeOf<Op.Err<string>>();
		expectTypeOf(outcome.error).toEqualTypeOf<string>();
	}
	if (Op.Outcome.is.nil(outcome)) {
		expectTypeOf(outcome).toEqualTypeOf<Op.Nil>();
		expectTypeOf(outcome.reason).toEqualTypeOf<Op.NilReason>();
	}

	const states: Op.State<string, number>[] = [];
	const filteredRetrying = states.filter(Op.is.retrying);
	expectTypeOf(filteredRetrying).toEqualTypeOf<Op.Retrying<string>[]>();

	const filteredSettled = states.filter(Op.is.settled);
	expectTypeOf(filteredSettled).toEqualTypeOf<Op.Outcome<string, number>[]>();

	const outcomes: Op.Outcome<string, number>[] = [];
	const filteredOk = outcomes.filter(Op.Outcome.is.ok);
	expectTypeOf(filteredOk).toEqualTypeOf<Op.Ok<number>[]>();

	const filteredErr = outcomes.filter(Op.Outcome.is.err);
	expectTypeOf(filteredErr).toEqualTypeOf<Op.Err<string>[]>();

	const filteredNil = outcomes.filter(Op.Outcome.is.nil);
	expectTypeOf(filteredNil).toEqualTypeOf<Op.Nil[]>();
});

test("Outcome combinators: transforms channels and unifies errors", () => {
	const outcome: Op.Outcome<"ERR_A", number> = constTruthyBool() ? Op.Outcome.make.ok(42) : Op.Outcome.make.err("ERR_A");

	const mapped = pipe(outcome, Op.Outcome.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Op.Outcome<"ERR_A", string>>();

	const mappedErr = pipe(outcome, Op.Outcome.mapError((e) => e.length));
	expectTypeOf(mappedErr).toEqualTypeOf<Op.Outcome<number, number>>();

	const chained = pipe(
		outcome,
		Op.Outcome.chain((n) => n > 0 ? Op.Outcome.make.ok(n.toString()) : Op.Outcome.make.err("ERR_B" as const)),
	);
	expectTypeOf(chained).toEqualTypeOf<Op.Outcome<"ERR_A" | "ERR_B", string>>();

	const tapped = pipe(outcome, Op.Outcome.tap((_v) => {}));
	expectTypeOf(tapped).toEqualTypeOf<Op.Outcome<"ERR_A", number>>();

	const tappedErr = pipe(outcome, Op.Outcome.tapError((_e) => {}));
	expectTypeOf(tappedErr).toEqualTypeOf<Op.Outcome<"ERR_A", number>>();

	const recovered = pipe(
		outcome,
		Op.Outcome.recover((_e) =>
			constTruthyBool() ? Op.Outcome.make.ok("fallback") : Op.Outcome.make.err("ERR_RECOVER" as const)
		),
	);
	expectTypeOf(recovered).toEqualTypeOf<Op.Outcome<"ERR_RECOVER", number | string>>();

	const fallbackVal = pipe(outcome, Op.Outcome.getOrElse(() => 0));
	expectTypeOf(fallbackVal).toEqualTypeOf<number>();

	const matched = pipe(outcome, Op.Outcome.match({ ok: (v) => v > 0, err: (e) => e.length > 0, nil: (_r) => false }));
	expectTypeOf(matched).toEqualTypeOf<boolean>();

	const infallibleChained = pipe(outcome, Op.Outcome.chain((n) => Op.Outcome.make.ok(n.toString())));
	expectTypeOf(infallibleChained).toEqualTypeOf<Op.Outcome<"ERR_A", string>>();

	const infallibleRecovered = pipe(outcome, Op.Outcome.recover((_e) => Op.Outcome.make.ok("fallback")));
	expectTypeOf(infallibleRecovered).toEqualTypeOf<Op.Outcome<never, number | string>>();
});

test("converters: transforms between Op.Outcome and Result / Maybe", () => {
	const outcome: Op.Outcome<"ERR_A", number> = constTruthyBool() ? Op.Outcome.make.ok(42) : Op.Outcome.make.err("ERR_A");

	const toResult = pipe(outcome, Op.Outcome.to.Result((_reason) => "ERR_NIL" as const));
	expectTypeOf(toResult).toEqualTypeOf<Result<"ERR_A" | "ERR_NIL", number>>();

	const toMaybe = pipe(outcome, Op.Outcome.to.Maybe);
	expectTypeOf(toMaybe).toEqualTypeOf<Maybe<number>>();

	const naturalResult: Result<"ERR_R", number> = constTruthyBool()
		? ({ kind: "Ok", value: 42 } as const)
		: ({ kind: "Err", error: "ERR_R" } as const);
	const fromResult = Op.Outcome.from.Result(naturalResult);
	expectTypeOf(fromResult).toEqualTypeOf<Op.Outcome<"ERR_R", number>>();

	const naturalMaybe: Maybe<number> = constTruthyBool()
		? ({ kind: "Some", value: 42 } as const)
		: ({ kind: "None" } as const);
	const fromMaybe = Op.Outcome.from.Maybe(naturalMaybe);
	expectTypeOf(fromMaybe).toEqualTypeOf<Op.Outcome<never, number>>();

	const fromMaybeWithReason = Op.Outcome.from.Maybe(naturalMaybe, () => "aborted");
	expectTypeOf(fromMaybeWithReason).toEqualTypeOf<Op.Outcome<never, number>>();
});

test("wire: wires manager Ok outcome to a side effect callback", () => {
	const manager = Op.interpret(delayedOp, { strategy: "restartable" });
	const stop = Op.wire(manager, (value) => {
		expectTypeOf(value).toEqualTypeOf<number>();
	});
	expectTypeOf(stop).toEqualTypeOf<() => void>();

	// @ts-expect-error — sideEffect callback argument type mismatch
	Op.wire(manager, (_value: string) => {});

	// @ts-expect-error — source must be a valid Op.Manager
	Op.wire("not_a_manager", () => {});
});

test("manager arity: enforces zero-argument and multi-argument signatures at compile time", () => {
	const zeroArgOp = Op.lift((_signal) => () => Promise.resolve(42));
	const zeroArgManager = Op.interpret(zeroArgOp, { strategy: "once" });
	expectTypeOf(zeroArgManager.run).parameters.toEqualTypeOf<[]>();

	// @ts-expect-error — zero-arg manager rejects arguments
	zeroArgManager.run(123);

	const multiArgOp = Op.lift((_signal) => (name: string, count: number) => Promise.resolve(`${name}:${count}`));
	const multiArgManager = Op.interpret(multiArgOp, { strategy: "restartable" });
	expectTypeOf(multiArgManager.run).parameters.toEqualTypeOf<[name: string, count: number]>();

	// @ts-expect-error — multi-arg manager requires both arguments
	multiArgManager.run("test");

	// @ts-expect-error — multi-arg manager argument type mismatch
	multiArgManager.run("test", "not_a_number");
});

test("Nil reasons: maintains discrimination and mutual exclusivity", () => {
	expectTypeOf<Op.AbortedNil["reason"]>().toEqualTypeOf<"aborted">();
	expectTypeOf<Op.DroppedNil["reason"]>().toEqualTypeOf<"dropped">();
	expectTypeOf<Op.ReplacedNil["reason"]>().toEqualTypeOf<"replaced">();
	expectTypeOf<Op.EvictedNil["reason"]>().toEqualTypeOf<"evicted">();

	// @ts-expect-error — DroppedNil is not assignable to ReplacedNil
	const _invalidNil: Op.ReplacedNil = { kind: "OpNil", reason: "dropped" } as Op.DroppedNil;
});

test("negative: flags missing cases, illegal property access, and variant incompatibilities", () => {
	const outcome: Op.Outcome<string, number> = constTruthyBool()
		? Op.Outcome.make.ok(42)
		: constTruthyBool()
		? Op.Outcome.make.err("err")
		: Op.Outcome.make.nil("aborted");

	// @ts-expect-error Missing 'nil' handler in match cases
	expectTypeOf(Op.Outcome.match({ ok: (n: number) => n, err: (_e: string) => 0 })).toBeFunction();

	// @ts-expect-error Missing 'ok' handler in fold arguments
	expectTypeOf(Op.Outcome.fold((_e: string) => 0, (_r) => 0)).toBeFunction();

	// @ts-expect-error Map transform must be a function
	expectTypeOf(Op.Outcome.map(123)(outcome)).toBeObject();

	// @ts-expect-error Ok variant does not expose an 'error' property
	expectTypeOf(Op.Outcome.make.ok(42).error).toBeUndefined();

	// @ts-expect-error Err variant does not expose a 'value' property
	expectTypeOf(Op.Outcome.make.err("err").value).toBeUndefined();

	// @ts-expect-error Nil variant does not expose a 'value' property
	expectTypeOf(Op.Outcome.make.nil("aborted").value).toBeUndefined();

	// @ts-expect-error Ok cannot be assigned to Err
	const _okAsErr: Op.Err<string> = Op.Outcome.make.ok(42);

	// @ts-expect-error Err cannot be assigned to Ok
	const _errAsOk: Op.Ok<number> = Op.Outcome.make.err("err");

	// @ts-expect-error Nil cannot be assigned to Ok
	const _nilAsOk: Op.Ok<number> = Op.Outcome.make.nil("aborted");
});
