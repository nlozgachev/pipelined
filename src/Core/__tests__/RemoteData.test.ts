import { pipe } from "#composition";
import { Maybe, RemoteData, Result } from "#core";
import { expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

test("remoteData.notAsked creates NotAsked", () => {
	expect(RemoteData.notAsked()).toStrictEqual({ kind: "NotAsked" });
});

test("remoteData.loading creates Loading", () => {
	expect(RemoteData.loading()).toStrictEqual({ kind: "Loading" });
});

test("remoteData.failure creates Failure", () => {
	expect(RemoteData.failure("err")).toStrictEqual({ kind: "Failure", error: "err" });
});

test("remoteData.success creates Success", () => {
	expect(RemoteData.success(42)).toStrictEqual({ kind: "Success", value: 42 });
});

test("remoteData.success is alias for success", () => {
	expect(RemoteData.success(42)).toStrictEqual(RemoteData.success(42));
});

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

test("remoteData.isNotAsked", () => {
	expect(RemoteData.isNotAsked(RemoteData.notAsked())).toBe(true);
	expect(RemoteData.isNotAsked(RemoteData.loading())).toBe(false);
	expect(RemoteData.isNotAsked(RemoteData.failure("e"))).toBe(false);
	expect(RemoteData.isNotAsked(RemoteData.success(1))).toBe(false);
});

test("remoteData.isLoading", () => {
	expect(RemoteData.isLoading(RemoteData.loading())).toBe(true);
	expect(RemoteData.isLoading(RemoteData.notAsked())).toBe(false);
});

test("remoteData.isFailure", () => {
	expect(RemoteData.isFailure(RemoteData.failure("e"))).toBe(true);
	expect(RemoteData.isFailure(RemoteData.success(1))).toBe(false);
});

test("remoteData.isSuccess", () => {
	expect(RemoteData.isSuccess(RemoteData.success(1))).toBe(true);
	expect(RemoteData.isSuccess(RemoteData.failure("e"))).toBe(false);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("remoteData.map transforms Success value", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(data, RemoteData.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Success", value: 10 });
});

test("remoteData.map passes through NotAsked", () => {
	const data: RemoteData<string, number> = RemoteData.notAsked();
	const result = pipe(data, RemoteData.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "NotAsked" });
});

test("remoteData.map passes through Loading", () => {
	const data: RemoteData<string, number> = RemoteData.loading();
	const result = pipe(data, RemoteData.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Loading" });
});

test("remoteData.map passes through Failure", () => {
	const data: RemoteData<string, number> = RemoteData.failure("err");
	const result = pipe(data, RemoteData.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Failure", error: "err" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("remoteData.mapError transforms Failure error", () => {
	const data: RemoteData<string, number> = RemoteData.failure("oops");
	const result = pipe(data, RemoteData.mapError((e: string) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Failure", error: "OOPS" });
});

test("remoteData.mapError passes through Success", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(data, RemoteData.mapError((e: string) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Success", value: 5 });
});

test("remoteData.mapError passes through NotAsked and Loading", () => {
	const f = RemoteData.mapError((e: string) => e.toUpperCase());
	expect(f(RemoteData.notAsked())).toStrictEqual({ kind: "NotAsked" });
	expect(f(RemoteData.loading())).toStrictEqual({ kind: "Loading" });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("remoteData.chain applies function on Success", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(
		data,
		RemoteData.chain((n: number) => n > 0 ? RemoteData.success(n * 2) : RemoteData.failure<string>("neg")),
	);
	expect(result).toStrictEqual({ kind: "Success", value: 10 });
});

test("remoteData.chain propagates Failure", () => {
	const data: RemoteData<string, number> = RemoteData.failure("err");
	const result = pipe(data, RemoteData.chain((n: number) => RemoteData.success(n * 2)));
	expect(result).toStrictEqual({ kind: "Failure", error: "err" });
});

test("remoteData.chain propagates Loading", () => {
	const data: RemoteData<string, number> = RemoteData.loading();
	const result = pipe(data, RemoteData.chain((n: number) => RemoteData.success(n * 2)));
	expect(result).toStrictEqual({ kind: "Loading" });
});

test("remoteData.chain propagates NotAsked", () => {
	const data: RemoteData<string, number> = RemoteData.notAsked();
	const result = pipe(data, RemoteData.chain((n: number) => RemoteData.success(n * 2)));
	expect(result).toStrictEqual({ kind: "NotAsked" });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("remoteData.ap applies function to value when both Success", () => {
	const add = (a: number) => (b: number) => a + b;
	const fn: RemoteData<string, typeof add> = RemoteData.success(add);
	const result = pipe(fn, RemoteData.ap(RemoteData.success(5)), RemoteData.ap(RemoteData.success(3)));
	expect(result).toStrictEqual({ kind: "Success", value: 8 });
});

test("remoteData.ap returns Failure when function is Failure", () => {
	const fn: RemoteData<string, (n: number) => number> = RemoteData.failure("err");
	const result = pipe(fn, RemoteData.ap(RemoteData.success(5)));
	expect(result).toStrictEqual({ kind: "Failure", error: "err" });
});

test("remoteData.ap returns Failure when value is Failure", () => {
	const double = (n: number) => n * 2;
	const fn: RemoteData<string, typeof double> = RemoteData.success(double);
	const result = pipe(fn, RemoteData.ap(RemoteData.failure<string>("err")));
	expect(result).toStrictEqual({ kind: "Failure", error: "err" });
});

test("remoteData.ap returns Loading when either is Loading", () => {
	const double = (n: number) => n * 2;
	const fn: RemoteData<string, typeof double> = RemoteData.success(double);
	const result = pipe(fn, RemoteData.ap(RemoteData.loading()));
	expect(result).toStrictEqual({ kind: "Loading" });
});

test("remoteData.ap returns Failure of function when both are Failure", () => {
	const fn: RemoteData<string, (n: number) => number> = RemoteData.failure("fn error");
	const result = pipe(fn, RemoteData.ap(RemoteData.failure<string>("arg error")));
	expect(result).toStrictEqual({ kind: "Failure", error: "fn error" });
});

test("remoteData.ap returns NotAsked when function is NotAsked and arg is Success", () => {
	const fn: RemoteData<string, (n: number) => number> = RemoteData.notAsked();
	const result = pipe(fn, RemoteData.ap(RemoteData.success(5)));
	expect(result).toStrictEqual({ kind: "NotAsked" });
});

test("remoteData.ap returns Loading when function is Loading and arg is Success", () => {
	const fn: RemoteData<string, (n: number) => number> = RemoteData.loading();
	const result = pipe(fn, RemoteData.ap(RemoteData.success(5)));
	expect(result).toStrictEqual({ kind: "Loading" });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("remoteData.fold handles all four cases", () => {
	const handler = RemoteData.fold<string, number, string>(
		(e) => `error: ${e}`,
		() => "not asked",
		() => "loading",
		(v) => `value: ${v}`,
	);

	expect(handler(RemoteData.notAsked())).toBe("not asked");
	expect(handler(RemoteData.loading())).toBe("loading");
	expect(handler(RemoteData.failure("bad"))).toBe("error: bad");
	expect(handler(RemoteData.success(42))).toBe("value: 42");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("remoteData.match handles all four cases", () => {
	const handler = RemoteData.match<string, number, string>({
		notAsked: () => "na",
		loading: () => "ld",
		failure: (e) => `f:${e}`,
		success: (v) => `s:${v}`,
	});

	expect(handler(RemoteData.notAsked())).toBe("na");
	expect(handler(RemoteData.loading())).toBe("ld");
	expect(handler(RemoteData.failure("x"))).toBe("f:x");
	expect(handler(RemoteData.success(1))).toBe("s:1");
});

test("remoteData.match works in pipe", () => {
	const data: RemoteData<string, number> = RemoteData.success(42);
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

test("remoteData.getOrElse returns value for Success", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(data, RemoteData.getOrElse(() => 0));
	expect(result).toBe(5);
});

test("remoteData.getOrElse returns default for non-Success", () => {
	const notAsked: RemoteData<string, number> = RemoteData.notAsked();
	const loading: RemoteData<string, number> = RemoteData.loading();
	const failure: RemoteData<string, number> = RemoteData.failure("e");
	expect(pipe(notAsked, RemoteData.getOrElse(() => 0))).toBe(0);
	expect(pipe(loading, RemoteData.getOrElse(() => 0))).toBe(0);
	expect(pipe(failure, RemoteData.getOrElse(() => 0))).toBe(0);
});

test("remoteData.getOrElse widens return type to A | B when default is a different type", () => {
	const result = pipe(RemoteData.loading(), RemoteData.getOrElse(() => null));
	expect(result).toBeNull();
});

test("remoteData.getOrElse returns Success value typed as A | B when Success", () => {
	const result = pipe(RemoteData.success(5), RemoteData.getOrElse(() => null));
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("remoteData.tap executes side effect on Success", () => {
	let captured = 0;
	const data: RemoteData<string, number> = RemoteData.success(42);
	pipe(
		data,
		RemoteData.tap((n: number) => {
			captured = n;
		}),
	);
	expect(captured).toBe(42);
});

test("remoteData.tap does not execute on Failure", () => {
	let called = false;
	const data: RemoteData<string, number> = RemoteData.failure("err");
	pipe(
		data,
		RemoteData.tap((_: number) => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("remoteData.tap does not execute on NotAsked or Loading", () => {
	let called = false;
	const f = RemoteData.tap((_: number) => {
		called = true;
	});
	f(RemoteData.notAsked());
	f(RemoteData.loading());
	expect(called).toBe(false);
});

test("remoteData.tap returns original value", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(data, RemoteData.tap(() => {}));
	expect(result).toStrictEqual({ kind: "Success", value: 5 });
});

// ---------------------------------------------------------------------------
// tapError
// ---------------------------------------------------------------------------

test("remoteData.tapError calls f on Failure", () => {
	let called = false;
	pipe(
		RemoteData.failure("oops"),
		RemoteData.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(true);
});

test("remoteData.tapError does not call f on Success", () => {
	let called = false;
	pipe(
		RemoteData.success(42),
		RemoteData.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("remoteData.tapError does not call f on Loading", () => {
	let called = false;
	pipe(
		RemoteData.loading(),
		RemoteData.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("remoteData.tapError returns the RemoteData unchanged", () => {
	const data = RemoteData.failure("oops");
	const result = pipe(data, RemoteData.tapError(() => {}));
	expect(result).toStrictEqual(data);
});

test("remoteData.tapError receives the error value", () => {
	let received: string | undefined;
	pipe(
		RemoteData.failure("oops"),
		RemoteData.tapError((e) => {
			received = e;
		}),
	);
	expect(received).toBe("oops");
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("remoteData.recover provides fallback for Failure", () => {
	const data: RemoteData<string, number> = RemoteData.failure("err");
	const result = pipe(data, RemoteData.recover((_e: string) => RemoteData.success(99)));
	expect(result).toStrictEqual({ kind: "Success", value: 99 });
});

test("remoteData.recover passes through Success", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(data, RemoteData.recover((_e: string) => RemoteData.success(99)));
	expect(result).toStrictEqual({ kind: "Success", value: 5 });
});

test("remoteData.recover passes through Loading", () => {
	const data: RemoteData<string, number> = RemoteData.loading();
	const result = pipe(data, RemoteData.recover((_e: string) => RemoteData.success(99)));
	expect(result).toStrictEqual({ kind: "Loading" });
});

test("remoteData.recover passes through NotAsked", () => {
	const data: RemoteData<string, number> = RemoteData.notAsked();
	const result = pipe(data, RemoteData.recover((_e: string) => RemoteData.success(99)));
	expect(result).toStrictEqual({ kind: "NotAsked" });
});

test("remoteData.recover widens to RemoteData<E, A | B> when fallback returns a different type", () => {
	const result = pipe(RemoteData.failure("err"), RemoteData.recover((_e) => RemoteData.success("recovered")));
	expect(result).toStrictEqual({ kind: "Success", value: "recovered" });
});

test("remoteData.recover preserves Success typed as RemoteData<E, A | B>", () => {
	const result = pipe(RemoteData.success(5), RemoteData.recover((_e) => RemoteData.success("recovered")));
	expect(result).toStrictEqual({ kind: "Success", value: 5 });
});

// ---------------------------------------------------------------------------
// toMaybe
// ---------------------------------------------------------------------------

test("remoteData.toMaybe returns Some for Success", () => {
	expect(RemoteData.toMaybe(RemoteData.success(42))).toStrictEqual({ kind: "Some", value: 42 });
});

test("remoteData.toMaybe returns None for non-Success", () => {
	expect(RemoteData.toMaybe(RemoteData.notAsked())).toStrictEqual({ kind: "None" });
	expect(RemoteData.toMaybe(RemoteData.loading())).toStrictEqual({ kind: "None" });
	expect(RemoteData.toMaybe(RemoteData.failure("e"))).toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("remoteData.toResult returns Ok for Success", () => {
	const data: RemoteData<string, number> = RemoteData.success(42);
	const result = pipe(data, RemoteData.toResult(() => "not ready"));
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("remoteData.toResult returns Err with original error for Failure", () => {
	const data: RemoteData<string, number> = RemoteData.failure("bad");
	const result = pipe(data, RemoteData.toResult(() => "not ready"));
	expect(result).toStrictEqual({ kind: "Err", error: "bad" });
});

test("remoteData.toResult returns Err with fallback for NotAsked/Loading", () => {
	const handler = RemoteData.toResult<string>(() => "not ready");
	expect(handler(RemoteData.notAsked())).toStrictEqual({ kind: "Err", error: "not ready" });
	expect(handler(RemoteData.loading())).toStrictEqual({ kind: "Err", error: "not ready" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("remoteData composes well in a pipe chain", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(
		data,
		RemoteData.map((n: number) => n * 2),
		RemoteData.chain((n: number) => n > 5 ? RemoteData.success(n) : RemoteData.failure<string>("too small")),
		RemoteData.getOrElse(() => 0),
	);
	expect(result).toBe(10);
});

// ---------------------------------------------------------------------------
// fromResult
// ---------------------------------------------------------------------------

test("remoteData.fromResult converts Ok to Success", () => {
	expect(RemoteData.fromResult(Result.ok(42))).toStrictEqual(RemoteData.success(42));
});

test("remoteData.fromResult converts Err to Failure", () => {
	expect(RemoteData.fromResult(Result.err("oops"))).toStrictEqual(RemoteData.failure("oops"));
});

test("remoteData.fromResult preserves complex value types", () => {
	expect(RemoteData.fromResult(Result.ok({ id: 1, name: "Alice" }))).toStrictEqual(
		RemoteData.success({ id: 1, name: "Alice" }),
	);
});

test("remoteData.fromResult preserves complex error types", () => {
	expect(RemoteData.fromResult(Result.err({ code: 404 }))).toStrictEqual(RemoteData.failure({ code: 404 }));
});

// ---------------------------------------------------------------------------
// fromMaybe
// ---------------------------------------------------------------------------

test("remoteData.fromMaybe converts Some to Success", () => {
	expect(RemoteData.fromMaybe(() => "missing")(Maybe.some(42))).toStrictEqual(RemoteData.success(42));
});

test("remoteData.fromMaybe converts None to Failure using onNone", () => {
	expect(RemoteData.fromMaybe(() => "missing")(Maybe.none())).toStrictEqual(RemoteData.failure("missing"));
});

test("remoteData.fromMaybe preserves complex value types", () => {
	expect(RemoteData.fromMaybe(() => "not found")(Maybe.some({ id: 1, name: "Alice" }))).toStrictEqual(
		RemoteData.success({ id: 1, name: "Alice" }),
	);
});

test("remoteData.fromMaybe composes in pipe", () => {
	expect(pipe(Maybe.some(5), RemoteData.fromMaybe(() => "no value"))).toStrictEqual(RemoteData.success(5));
});

test("remoteData.fromMaybe curried handler can be assigned and reused", () => {
	const toRemote = RemoteData.fromMaybe(() => "missing");
	expect(toRemote(Maybe.some(1))).toStrictEqual(RemoteData.success(1));
	expect(toRemote(Maybe.none())).toStrictEqual(RemoteData.failure("missing"));
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("remoteData.filter keeps Success when predicate passes", () => {
	expect(RemoteData.filter((n: number) => n > 0, () => "not positive")(RemoteData.success(5))).toStrictEqual({
		kind: "Success",
		value: 5,
	});
});

test("remoteData.filter converts Success to Failure when predicate fails", () => {
	expect(RemoteData.filter((n: number) => n > 0, (n) => `${n} is not positive`)(RemoteData.success(-3))).toStrictEqual({
		kind: "Failure",
		error: "-3 is not positive",
	});
});

test("remoteData.filter passes NotAsked through unchanged", () => {
	expect(RemoteData.filter((_: number) => true, () => "error")(RemoteData.notAsked())).toStrictEqual({
		kind: "NotAsked",
	});
});

test("remoteData.filter passes Loading through unchanged", () => {
	expect(RemoteData.filter((_: number) => true, () => "error")(RemoteData.loading())).toStrictEqual({ kind: "Loading" });
});

test("remoteData.filter passes Failure through unchanged", () => {
	expect(RemoteData.filter((_: number) => true, () => "new error")(RemoteData.failure("original"))).toStrictEqual({
		kind: "Failure",
		error: "original",
	});
});
