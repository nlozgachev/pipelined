import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { RemoteData } from "../RemoteData.ts";
import { Result } from "../Result.ts";

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

test("make.notAsked: creates NotAsked", () => {
	expect(RemoteData.make.notAsked()).toStrictEqual({ kind: "NotAsked" });
});

test("make.loading: creates Loading", () => {
	expect(RemoteData.make.loading()).toStrictEqual({ kind: "Loading" });
});

test("make.failure: creates Failure", () => {
	expect(RemoteData.make.failure("err")).toStrictEqual({ kind: "Failure", error: "err" });
});

test("make.success: creates Success", () => {
	expect(RemoteData.make.success(42)).toStrictEqual({ kind: "Success", value: 42 });
});

test("make.success: is alias for success", () => {
	expect(RemoteData.make.success(42)).toStrictEqual(RemoteData.make.success(42));
});

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

test("is.notAsked: returns true for NotAsked and false for others", () => {
	expect(RemoteData.is.notAsked(RemoteData.make.notAsked())).toBe(true);
	expect(RemoteData.is.notAsked(RemoteData.make.loading())).toBe(false);
	expect(RemoteData.is.notAsked(RemoteData.make.failure("e"))).toBe(false);
	expect(RemoteData.is.notAsked(RemoteData.make.success(1))).toBe(false);
});

test("is.loading: returns true for Loading and false for others", () => {
	expect(RemoteData.is.loading(RemoteData.make.loading())).toBe(true);
	expect(RemoteData.is.loading(RemoteData.make.notAsked())).toBe(false);
});

test("is.failure: returns true for Failure and false for others", () => {
	expect(RemoteData.is.failure(RemoteData.make.failure("e"))).toBe(true);
	expect(RemoteData.is.failure(RemoteData.make.success(1))).toBe(false);
});

test("is.success: returns true for Success and false for others", () => {
	expect(RemoteData.is.success(RemoteData.make.success(1))).toBe(true);
	expect(RemoteData.is.success(RemoteData.make.failure("e"))).toBe(false);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: transforms Success value", () => {
	const data: RemoteData<string, number> = RemoteData.make.success(5);
	const result = pipe(data, RemoteData.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Success", value: 10 });
});

test("map: passes through NotAsked", () => {
	const data: RemoteData<string, number> = RemoteData.make.notAsked();
	const result = pipe(data, RemoteData.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "NotAsked" });
});

test("map: passes through Loading", () => {
	const data: RemoteData<string, number> = RemoteData.make.loading();
	const result = pipe(data, RemoteData.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Loading" });
});

test("map: passes through Failure", () => {
	const data: RemoteData<string, number> = RemoteData.make.failure("err");
	const result = pipe(data, RemoteData.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Failure", error: "err" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("mapError: transforms Failure error", () => {
	const data: RemoteData<string, number> = RemoteData.make.failure("oops");
	const result = pipe(data, RemoteData.mapError((e: string) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Failure", error: "OOPS" });
});

test("mapError: passes through Success", () => {
	const data: RemoteData<string, number> = RemoteData.make.success(5);
	const result = pipe(data, RemoteData.mapError((e: string) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Success", value: 5 });
});

test("mapError: passes through NotAsked and Loading", () => {
	const f = RemoteData.mapError((e: string) => e.toUpperCase());
	expect(f(RemoteData.make.notAsked())).toStrictEqual({ kind: "NotAsked" });
	expect(f(RemoteData.make.loading())).toStrictEqual({ kind: "Loading" });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("chain: applies function on Success", () => {
	const data: RemoteData<string, number> = RemoteData.make.success(5);
	const result = pipe(
		data,
		RemoteData.chain((n: number) => n > 0 ? RemoteData.make.success(n * 2) : RemoteData.make.failure<string>("neg")),
	);
	expect(result).toStrictEqual({ kind: "Success", value: 10 });
});

test("chain: propagates Failure", () => {
	const data: RemoteData<string, number> = RemoteData.make.failure("err");
	const result = pipe(data, RemoteData.chain((n: number) => RemoteData.make.success(n * 2)));
	expect(result).toStrictEqual({ kind: "Failure", error: "err" });
});

test("chain: propagates Loading", () => {
	const data: RemoteData<string, number> = RemoteData.make.loading();
	const result = pipe(data, RemoteData.chain((n: number) => RemoteData.make.success(n * 2)));
	expect(result).toStrictEqual({ kind: "Loading" });
});

test("chain: propagates NotAsked", () => {
	const data: RemoteData<string, number> = RemoteData.make.notAsked();
	const result = pipe(data, RemoteData.chain((n: number) => RemoteData.make.success(n * 2)));
	expect(result).toStrictEqual({ kind: "NotAsked" });
});

test("chain: supports error union widening", () => {
	const step1: RemoteData<"ERR_A", number> = RemoteData.make.success(42);
	const step2 = (_n: number): RemoteData<"ERR_B", string> => RemoteData.make.failure("ERR_B");

	const res: RemoteData<"ERR_A" | "ERR_B", string> = pipe(step1, RemoteData.chain(step2));
	expect(res).toStrictEqual({ kind: "Failure", error: "ERR_B" });
});

test("chain: infers exact error union without collapsing to unknown", () => {
	const step1 = RemoteData.make.failure("ERR_A" as const);
	const step2 = (_: unknown) => RemoteData.make.failure("ERR_B" as const);

	const res = pipe(step1, RemoteData.chain(step2));

	expectTypeOf(res).toEqualTypeOf<RemoteData<"ERR_A" | "ERR_B", unknown>>();
	expect(res).toStrictEqual({ kind: "Failure", error: "ERR_A" });
});

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

test("apply: applies function to value when both Success", () => {
	const add = (a: number) => (b: number) => a + b;
	const fn: RemoteData<string, typeof add> = RemoteData.make.success(add);
	const result = pipe(fn, RemoteData.apply(RemoteData.make.success(5)), RemoteData.apply(RemoteData.make.success(3)));
	expect(result).toStrictEqual({ kind: "Success", value: 8 });
});

test("apply: returns Failure when function is Failure", () => {
	const fn: RemoteData<string, (n: number) => number> = RemoteData.make.failure("err");
	const result = pipe(fn, RemoteData.apply(RemoteData.make.success(5)));
	expect(result).toStrictEqual({ kind: "Failure", error: "err" });
});

test("apply: returns Failure when value is Failure", () => {
	const double = (n: number) => n * 2;
	const fn: RemoteData<string, typeof double> = RemoteData.make.success(double);
	const result = pipe(fn, RemoteData.apply(RemoteData.make.failure<string>("err")));
	expect(result).toStrictEqual({ kind: "Failure", error: "err" });
});

test("apply: returns Loading when either is Loading", () => {
	const double = (n: number) => n * 2;
	const fn: RemoteData<string, typeof double> = RemoteData.make.success(double);
	const result = pipe(fn, RemoteData.apply(RemoteData.make.loading()));
	expect(result).toStrictEqual({ kind: "Loading" });
});

test("apply: returns Failure of function when both are Failure", () => {
	const fn: RemoteData<string, (n: number) => number> = RemoteData.make.failure("fn error");
	const result = pipe(fn, RemoteData.apply(RemoteData.make.failure<string>("arg error")));
	expect(result).toStrictEqual({ kind: "Failure", error: "fn error" });
});

test("apply: returns NotAsked when function is NotAsked and arg is Success", () => {
	const fn: RemoteData<string, (n: number) => number> = RemoteData.make.notAsked();
	const result = pipe(fn, RemoteData.apply(RemoteData.make.success(5)));
	expect(result).toStrictEqual({ kind: "NotAsked" });
});

test("apply: returns Loading when function is Loading and arg is Success", () => {
	const fn: RemoteData<string, (n: number) => number> = RemoteData.make.loading();
	const result = pipe(fn, RemoteData.apply(RemoteData.make.success(5)));
	expect(result).toStrictEqual({ kind: "Loading" });
});

test("apply: widens error types from function and argument", () => {
	const fn = RemoteData.make.success((n: number) => String(n)) as RemoteData<"ERR_FN", (n: number) => string>;
	const arg = RemoteData.make.failure("ERR_ARG") as RemoteData<"ERR_ARG", number>;
	const result = pipe(fn, RemoteData.apply(arg));
	expectTypeOf(result).toEqualTypeOf<RemoteData<"ERR_FN" | "ERR_ARG", string>>();
	expect(result).toStrictEqual({ kind: "Failure", error: "ERR_ARG" });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("fold: handles all four cases", () => {
	const handler = RemoteData.fold<string, number, string>(
		(e) => `error: ${e}`,
		() => "not asked",
		() => "loading",
		(v) => `value: ${v}`,
	);

	expect(handler(RemoteData.make.notAsked())).toBe("not asked");
	expect(handler(RemoteData.make.loading())).toBe("loading");
	expect(handler(RemoteData.make.failure("bad"))).toBe("error: bad");
	expect(handler(RemoteData.make.success(42))).toBe("value: 42");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("match: handles all four cases", () => {
	const handler = RemoteData.match<string, number, string>({
		notAsked: () => "na",
		loading: () => "ld",
		failure: (e) => `f:${e}`,
		success: (v) => `s:${v}`,
	});

	expect(handler(RemoteData.make.notAsked())).toBe("na");
	expect(handler(RemoteData.make.loading())).toBe("ld");
	expect(handler(RemoteData.make.failure("x"))).toBe("f:x");
	expect(handler(RemoteData.make.success(1))).toBe("s:1");
});

test("match: works in pipe", () => {
	const data: RemoteData<string, number> = RemoteData.make.success(42);
	const result = pipe(
		data,
		RemoteData.match({
			notAsked: () => "na",
			loading: () => "ld",
			failure: (e: string) => `f:${e}`,
			success: (v: number) => `s:${v}`,
		}),
	);
	expect(result).toBe("s:42");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("getOrElse: returns value for Success", () => {
	const data: RemoteData<string, number> = RemoteData.make.success(5);
	const result = pipe(data, RemoteData.getOrElse(() => 0));
	expect(result).toBe(5);
});

test("getOrElse: returns default for non-Success", () => {
	const notAsked: RemoteData<string, number> = RemoteData.make.notAsked();
	const loading: RemoteData<string, number> = RemoteData.make.loading();
	const failure: RemoteData<string, number> = RemoteData.make.failure("e");
	expect(pipe(notAsked, RemoteData.getOrElse(() => 0))).toBe(0);
	expect(pipe(loading, RemoteData.getOrElse(() => 0))).toBe(0);
	expect(pipe(failure, RemoteData.getOrElse(() => 0))).toBe(0);
});

test("getOrElse: widens return type to union when default is different type", () => {
	const result = pipe(RemoteData.make.loading(), RemoteData.getOrElse(() => null));
	expect(result).toBeNull();
});

test("getOrElse: returns Success value typed as union when Success", () => {
	const result = pipe(RemoteData.make.success(5), RemoteData.getOrElse(() => null));
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("tap: executes side effect on Success", () => {
	let captured = 0;
	const data: RemoteData<string, number> = RemoteData.make.success(42);
	pipe(
		data,
		RemoteData.tap((n: number) => {
			captured = n;
		}),
	);
	expect(captured).toBe(42);
});

test("tap: does not execute on Failure", () => {
	let called = false;
	const data: RemoteData<string, number> = RemoteData.make.failure("err");
	pipe(
		data,
		RemoteData.tap((_: number) => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("tap: does not execute on NotAsked or Loading", () => {
	let called = false;
	const f = RemoteData.tap((_: number) => {
		called = true;
	});
	f(RemoteData.make.notAsked());
	f(RemoteData.make.loading());
	expect(called).toBe(false);
});

test("tap: returns original value", () => {
	const data: RemoteData<string, number> = RemoteData.make.success(5);
	const result = pipe(data, RemoteData.tap(() => {}));
	expect(result).toStrictEqual({ kind: "Success", value: 5 });
});

// ---------------------------------------------------------------------------
// tapError
// ---------------------------------------------------------------------------

test("tapError: calls f on Failure", () => {
	let called = false;
	pipe(
		RemoteData.make.failure("oops"),
		RemoteData.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(true);
});

test("tapError: does not call f on Success", () => {
	let called = false;
	pipe(
		RemoteData.make.success(42),
		RemoteData.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("tapError: does not call f on Loading", () => {
	let called = false;
	pipe(
		RemoteData.make.loading(),
		RemoteData.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("tapError: returns the RemoteData unchanged", () => {
	const data = RemoteData.make.failure("oops");
	const result = pipe(data, RemoteData.tapError(() => {}));
	expect(result).toStrictEqual(data);
});

test("tapError: receives the error value", () => {
	let received: string | undefined;
	pipe(
		RemoteData.make.failure("oops"),
		RemoteData.tapError((e) => {
			received = e;
		}),
	);
	expect(received).toBe("oops");
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("recover: provides fallback for Failure", () => {
	const data: RemoteData<string, number> = RemoteData.make.failure("err");
	const result = pipe(data, RemoteData.recover((_e: string) => RemoteData.make.success(99)));
	expect(result).toStrictEqual({ kind: "Success", value: 99 });
});

test("recover: passes through Success", () => {
	const data: RemoteData<string, number> = RemoteData.make.success(5);
	const result = pipe(data, RemoteData.recover((_e: string) => RemoteData.make.success(99)));
	expect(result).toStrictEqual({ kind: "Success", value: 5 });
});

test("recover: passes through Loading", () => {
	const data: RemoteData<string, number> = RemoteData.make.loading();
	const result = pipe(data, RemoteData.recover((_e: string) => RemoteData.make.success(99)));
	expect(result).toStrictEqual({ kind: "Loading" });
});

test("recover: passes through NotAsked", () => {
	const data: RemoteData<string, number> = RemoteData.make.notAsked();
	const result = pipe(data, RemoteData.recover((_e: string) => RemoteData.make.success(99)));
	expect(result).toStrictEqual({ kind: "NotAsked" });
});

test("recover: widens to RemoteData<E, A | B> when fallback returns different type", () => {
	const result = pipe(RemoteData.make.failure("err"), RemoteData.recover((_e) => RemoteData.make.success("recovered")));
	expect(result).toStrictEqual({ kind: "Success", value: "recovered" });
});

test("recover: preserves Success typed as union", () => {
	const result = pipe(RemoteData.make.success(5), RemoteData.recover((_e) => RemoteData.make.success("recovered")));
	expect(result).toStrictEqual({ kind: "Success", value: 5 });
});

// ---------------------------------------------------------------------------
// toMaybe
// ---------------------------------------------------------------------------

test("to.Maybe: returns Some for Success", () => {
	expect(RemoteData.to.Maybe(RemoteData.make.success(42))).toStrictEqual({ kind: "Some", value: 42 });
});

test("to.Maybe: returns None for non-Success", () => {
	expect(RemoteData.to.Maybe(RemoteData.make.notAsked())).toStrictEqual({ kind: "None" });
	expect(RemoteData.to.Maybe(RemoteData.make.loading())).toStrictEqual({ kind: "None" });
	expect(RemoteData.to.Maybe(RemoteData.make.failure("e"))).toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("to.Result: returns Ok for Success", () => {
	const data: RemoteData<string, number> = RemoteData.make.success(42);
	const result = pipe(data, RemoteData.to.Result(() => "not ready"));
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("to.Result: returns Err with original error for Failure", () => {
	const data: RemoteData<string, number> = RemoteData.make.failure("bad");
	const result = pipe(data, RemoteData.to.Result(() => "not ready"));
	expect(result).toStrictEqual({ kind: "Err", error: "bad" });
});

test("to.Result: returns Err with fallback for NotAsked and Loading", () => {
	const handler = RemoteData.to.Result<string>(() => "not ready");
	expect(handler(RemoteData.make.notAsked())).toStrictEqual({ kind: "Err", error: "not ready" });
	expect(handler(RemoteData.make.loading())).toStrictEqual({ kind: "Err", error: "not ready" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes well in a pipe chain", () => {
	const data: RemoteData<string, number> = RemoteData.make.success(5);
	const result = pipe(
		data,
		RemoteData.map((n: number) => n * 2),
		RemoteData.chain((n: number) => n > 5 ? RemoteData.make.success(n) : RemoteData.make.failure<string>("too small")),
		RemoteData.getOrElse(() => 0),
	);
	expect(result).toBe(10);
});

// ---------------------------------------------------------------------------
// fromResult
// ---------------------------------------------------------------------------

test("from.Result: converts Ok to Success", () => {
	expect(RemoteData.from.Result(Result.make.ok(42))).toStrictEqual(RemoteData.make.success(42));
});

test("from.Result: converts Err to Failure", () => {
	expect(RemoteData.from.Result(Result.make.err("oops"))).toStrictEqual(RemoteData.make.failure("oops"));
});

test("from.Result: preserves complex value types", () => {
	expect(RemoteData.from.Result(Result.make.ok({ id: 1, name: "Alice" }))).toStrictEqual(
		RemoteData.make.success({ id: 1, name: "Alice" }),
	);
});

test("from.Result: preserves complex error types", () => {
	expect(RemoteData.from.Result(Result.make.err({ code: 404 }))).toStrictEqual(RemoteData.make.failure({ code: 404 }));
});

// ---------------------------------------------------------------------------
// fromMaybe
// ---------------------------------------------------------------------------

test("from.Maybe: converts Some to Success", () => {
	expect(RemoteData.from.Maybe(() => "missing")(Maybe.make.some(42))).toStrictEqual(RemoteData.make.success(42));
});

test("from.Maybe: converts None to Failure using onNone", () => {
	expect(RemoteData.from.Maybe(() => "missing")(Maybe.make.none())).toStrictEqual(RemoteData.make.failure("missing"));
});

test("from.Maybe: preserves complex value types", () => {
	expect(RemoteData.from.Maybe(() => "not found")(Maybe.make.some({ id: 1, name: "Alice" }))).toStrictEqual(
		RemoteData.make.success({ id: 1, name: "Alice" }),
	);
});

test("from.Maybe: composes in pipe", () => {
	expect(pipe(Maybe.make.some(5), RemoteData.from.Maybe(() => "no value"))).toStrictEqual(RemoteData.make.success(5));
});

test("from.Maybe: curried handler can be assigned and reused", () => {
	const toRemote = RemoteData.from.Maybe(() => "missing");
	expect(toRemote(Maybe.make.some(1))).toStrictEqual(RemoteData.make.success(1));
	expect(toRemote(Maybe.make.none())).toStrictEqual(RemoteData.make.failure("missing"));
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("filter: keeps Success when predicate passes", () => {
	expect(RemoteData.filter((n: number) => n > 0, () => "not positive")(RemoteData.make.success(5))).toStrictEqual({
		kind: "Success",
		value: 5,
	});
});

test("filter: converts Success to Failure when predicate fails", () => {
	expect(RemoteData.filter((n: number) => n > 0, (n) => `${n} is not positive`)(RemoteData.make.success(-3)))
		.toStrictEqual({ kind: "Failure", error: "-3 is not positive" });
});

test("filter: passes NotAsked through unchanged", () => {
	expect(RemoteData.filter((_: number) => true, () => "error")(RemoteData.make.notAsked())).toStrictEqual({
		kind: "NotAsked",
	});
});

test("filter: passes Loading through unchanged", () => {
	expect(RemoteData.filter((_: number) => true, () => "error")(RemoteData.make.loading())).toStrictEqual({
		kind: "Loading",
	});
});

test("filter: passes Failure through unchanged", () => {
	expect(RemoteData.filter((_: number) => true, () => "new error")(RemoteData.make.failure("original"))).toStrictEqual({
		kind: "Failure",
		error: "original",
	});
});
