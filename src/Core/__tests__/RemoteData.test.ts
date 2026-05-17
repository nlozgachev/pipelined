import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { RemoteData } from "../RemoteData.ts";
import { Result } from "../Result.ts";

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

test("RemoteData.notAsked creates NotAsked", () => {
	expect(RemoteData.notAsked()).toEqual({ kind: "NotAsked" });
});

test("RemoteData.loading creates Loading", () => {
	expect(RemoteData.loading()).toEqual({ kind: "Loading" });
});

test("RemoteData.failure creates Failure", () => {
	expect(RemoteData.failure("err")).toEqual({ kind: "Failure", error: "err" });
});

test("RemoteData.success creates Success", () => {
	expect(RemoteData.success(42)).toEqual({ kind: "Success", value: 42 });
});

test("RemoteData.success is alias for success", () => {
	expect(RemoteData.success(42)).toEqual(RemoteData.success(42));
});

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

test("RemoteData.isNotAsked", () => {
	expect(RemoteData.isNotAsked(RemoteData.notAsked())).toBe(true);
	expect(RemoteData.isNotAsked(RemoteData.loading())).toBe(false);
	expect(RemoteData.isNotAsked(RemoteData.failure("e"))).toBe(false);
	expect(RemoteData.isNotAsked(RemoteData.success(1))).toBe(false);
});

test("RemoteData.isLoading", () => {
	expect(RemoteData.isLoading(RemoteData.loading())).toBe(true);
	expect(RemoteData.isLoading(RemoteData.notAsked())).toBe(false);
});

test("RemoteData.isFailure", () => {
	expect(RemoteData.isFailure(RemoteData.failure("e"))).toBe(true);
	expect(RemoteData.isFailure(RemoteData.success(1))).toBe(false);
});

test("RemoteData.isSuccess", () => {
	expect(RemoteData.isSuccess(RemoteData.success(1))).toBe(true);
	expect(RemoteData.isSuccess(RemoteData.failure("e"))).toBe(false);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("RemoteData.map transforms Success value", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(
		data,
		RemoteData.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "Success", value: 10 });
});

test("RemoteData.map passes through NotAsked", () => {
	const data: RemoteData<string, number> = RemoteData.notAsked();
	const result = pipe(
		data,
		RemoteData.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "NotAsked" });
});

test("RemoteData.map passes through Loading", () => {
	const data: RemoteData<string, number> = RemoteData.loading();
	const result = pipe(
		data,
		RemoteData.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "Loading" });
});

test("RemoteData.map passes through Failure", () => {
	const data: RemoteData<string, number> = RemoteData.failure("err");
	const result = pipe(
		data,
		RemoteData.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "Failure", error: "err" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("RemoteData.mapError transforms Failure error", () => {
	const data: RemoteData<string, number> = RemoteData.failure("oops");
	const result = pipe(
		data,
		RemoteData.mapError((e: string) => e.toUpperCase()),
	);
	expect(result).toEqual({ kind: "Failure", error: "OOPS" });
});

test("RemoteData.mapError passes through Success", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(
		data,
		RemoteData.mapError((e: string) => e.toUpperCase()),
	);
	expect(result).toEqual({ kind: "Success", value: 5 });
});

test("RemoteData.mapError passes through NotAsked and Loading", () => {
	const f = RemoteData.mapError((e: string) => e.toUpperCase());
	expect(f(RemoteData.notAsked())).toEqual({ kind: "NotAsked" });
	expect(f(RemoteData.loading())).toEqual({ kind: "Loading" });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("RemoteData.chain applies function on Success", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(
		data,
		RemoteData.chain((n: number) => n > 0 ? RemoteData.success(n * 2) : RemoteData.failure<string>("neg")),
	);
	expect(result).toEqual({ kind: "Success", value: 10 });
});

test("RemoteData.chain propagates Failure", () => {
	const data: RemoteData<string, number> = RemoteData.failure("err");
	const result = pipe(
		data,
		RemoteData.chain((n: number) => RemoteData.success(n * 2)),
	);
	expect(result).toEqual({ kind: "Failure", error: "err" });
});

test("RemoteData.chain propagates Loading", () => {
	const data: RemoteData<string, number> = RemoteData.loading();
	const result = pipe(
		data,
		RemoteData.chain((n: number) => RemoteData.success(n * 2)),
	);
	expect(result).toEqual({ kind: "Loading" });
});

test("RemoteData.chain propagates NotAsked", () => {
	const data: RemoteData<string, number> = RemoteData.notAsked();
	const result = pipe(
		data,
		RemoteData.chain((n: number) => RemoteData.success(n * 2)),
	);
	expect(result).toEqual({ kind: "NotAsked" });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("RemoteData.ap applies function to value when both Success", () => {
	const add = (a: number) => (b: number) => a + b;
	const fn: RemoteData<string, typeof add> = RemoteData.success(add);
	const result = pipe(
		fn,
		RemoteData.ap(RemoteData.success(5)),
		RemoteData.ap(RemoteData.success(3)),
	);
	expect(result).toEqual({ kind: "Success", value: 8 });
});

test("RemoteData.ap returns Failure when function is Failure", () => {
	const fn: RemoteData<string, (n: number) => number> = RemoteData.failure("err");
	const result = pipe(
		fn,
		RemoteData.ap(RemoteData.success(5)),
	);
	expect(result).toEqual({ kind: "Failure", error: "err" });
});

test("RemoteData.ap returns Failure when value is Failure", () => {
	const double = (n: number) => n * 2;
	const fn: RemoteData<string, typeof double> = RemoteData.success(double);
	const result = pipe(
		fn,
		RemoteData.ap(RemoteData.failure<string>("err")),
	);
	expect(result).toEqual({ kind: "Failure", error: "err" });
});

test("RemoteData.ap returns Loading when either is Loading", () => {
	const double = (n: number) => n * 2;
	const fn: RemoteData<string, typeof double> = RemoteData.success(double);
	const result = pipe(
		fn,
		RemoteData.ap(RemoteData.loading()),
	);
	expect(result).toEqual({ kind: "Loading" });
});

test("RemoteData.ap returns Failure of function when both are Failure", () => {
	const fn: RemoteData<string, (n: number) => number> = RemoteData.failure("fn error");
	const result = pipe(
		fn,
		RemoteData.ap(RemoteData.failure<string>("arg error")),
	);
	expect(result).toEqual({ kind: "Failure", error: "fn error" });
});

test("RemoteData.ap returns NotAsked when function is NotAsked and arg is Success", () => {
	const fn: RemoteData<string, (n: number) => number> = RemoteData.notAsked();
	const result = pipe(
		fn,
		RemoteData.ap(RemoteData.success(5)),
	);
	expect(result).toEqual({ kind: "NotAsked" });
});

test("RemoteData.ap returns Loading when function is Loading and arg is Success", () => {
	const fn: RemoteData<string, (n: number) => number> = RemoteData.loading();
	const result = pipe(
		fn,
		RemoteData.ap(RemoteData.success(5)),
	);
	expect(result).toEqual({ kind: "Loading" });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("RemoteData.fold handles all four cases", () => {
	const handler = RemoteData.fold<string, number, string>(
		() => "not asked",
		() => "loading",
		(e) => `error: ${e}`,
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

test("RemoteData.match handles all four cases", () => {
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

test("RemoteData.match works in pipe", () => {
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

test("RemoteData.getOrElse returns value for Success", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(data, RemoteData.getOrElse(() => 0));
	expect(result).toBe(5);
});

test("RemoteData.getOrElse returns default for non-Success", () => {
	const notAsked: RemoteData<string, number> = RemoteData.notAsked();
	const loading: RemoteData<string, number> = RemoteData.loading();
	const failure: RemoteData<string, number> = RemoteData.failure("e");
	expect(pipe(notAsked, RemoteData.getOrElse(() => 0))).toBe(0);
	expect(pipe(loading, RemoteData.getOrElse(() => 0))).toBe(0);
	expect(pipe(failure, RemoteData.getOrElse(() => 0))).toBe(0);
});

test("RemoteData.getOrElse widens return type to A | B when default is a different type", () => {
	const result = pipe(
		RemoteData.loading(),
		RemoteData.getOrElse(() => null),
	);
	expect(result).toBeNull();
});

test("RemoteData.getOrElse returns Success value typed as A | B when Success", () => {
	const result = pipe(
		RemoteData.success(5),
		RemoteData.getOrElse(() => null),
	);
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("RemoteData.tap executes side effect on Success", () => {
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

test("RemoteData.tap does not execute on Failure", () => {
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

test("RemoteData.tap does not execute on NotAsked or Loading", () => {
	let called = false;
	const f = RemoteData.tap((_: number) => {
		called = true;
	});
	f(RemoteData.notAsked());
	f(RemoteData.loading());
	expect(called).toBe(false);
});

test("RemoteData.tap returns original value", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(
		data,
		RemoteData.tap(() => {}),
	);
	expect(result).toEqual({ kind: "Success", value: 5 });
});

// ---------------------------------------------------------------------------
// tapError
// ---------------------------------------------------------------------------

test("RemoteData.tapError calls f on Failure", () => {
	let called = false;
	pipe(
		RemoteData.failure("oops"),
		RemoteData.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(true);
});

test("RemoteData.tapError does not call f on Success", () => {
	let called = false;
	pipe(
		RemoteData.success(42),
		RemoteData.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("RemoteData.tapError does not call f on Loading", () => {
	let called = false;
	pipe(
		RemoteData.loading(),
		RemoteData.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("RemoteData.tapError returns the RemoteData unchanged", () => {
	const data = RemoteData.failure("oops");
	const result = pipe(data, RemoteData.tapError(() => {}));
	expect(result).toEqual(data);
});

test("RemoteData.tapError receives the error value", () => {
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

test("RemoteData.recover provides fallback for Failure", () => {
	const data: RemoteData<string, number> = RemoteData.failure("err");
	const result = pipe(
		data,
		RemoteData.recover((_e: string) => RemoteData.success(99)),
	);
	expect(result).toEqual({ kind: "Success", value: 99 });
});

test("RemoteData.recover passes through Success", () => {
	const data: RemoteData<string, number> = RemoteData.success(5);
	const result = pipe(
		data,
		RemoteData.recover((_e: string) => RemoteData.success(99)),
	);
	expect(result).toEqual({ kind: "Success", value: 5 });
});

test("RemoteData.recover passes through Loading", () => {
	const data: RemoteData<string, number> = RemoteData.loading();
	const result = pipe(
		data,
		RemoteData.recover((_e: string) => RemoteData.success(99)),
	);
	expect(result).toEqual({ kind: "Loading" });
});

test("RemoteData.recover passes through NotAsked", () => {
	const data: RemoteData<string, number> = RemoteData.notAsked();
	const result = pipe(
		data,
		RemoteData.recover((_e: string) => RemoteData.success(99)),
	);
	expect(result).toEqual({ kind: "NotAsked" });
});

test(
	"RemoteData.recover widens to RemoteData<E, A | B> when fallback returns a different type",
	() => {
		const result = pipe(
			RemoteData.failure("err"),
			RemoteData.recover((_e) => RemoteData.success("recovered")),
		);
		expect(result).toEqual({ kind: "Success", value: "recovered" });
	},
);

test("RemoteData.recover preserves Success typed as RemoteData<E, A | B>", () => {
	const result = pipe(
		RemoteData.success(5),
		RemoteData.recover((_e) => RemoteData.success("recovered")),
	);
	expect(result).toEqual({ kind: "Success", value: 5 });
});

// ---------------------------------------------------------------------------
// toMaybe
// ---------------------------------------------------------------------------

test("RemoteData.toMaybe returns Some for Success", () => {
	expect(RemoteData.toMaybe(RemoteData.success(42))).toEqual({ kind: "Some", value: 42 });
});

test("RemoteData.toMaybe returns None for non-Success", () => {
	expect(RemoteData.toMaybe(RemoteData.notAsked())).toEqual({ kind: "None" });
	expect(RemoteData.toMaybe(RemoteData.loading())).toEqual({ kind: "None" });
	expect(RemoteData.toMaybe(RemoteData.failure("e"))).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("RemoteData.toResult returns Ok for Success", () => {
	const data: RemoteData<string, number> = RemoteData.success(42);
	const result = pipe(
		data,
		RemoteData.toResult(() => "not ready"),
	);
	expect(result).toEqual({ kind: "Ok", value: 42 });
});

test("RemoteData.toResult returns Err with original error for Failure", () => {
	const data: RemoteData<string, number> = RemoteData.failure("bad");
	const result = pipe(
		data,
		RemoteData.toResult(() => "not ready"),
	);
	expect(result).toEqual({ kind: "Error", error: "bad" });
});

test("RemoteData.toResult returns Err with fallback for NotAsked/Loading", () => {
	const handler = RemoteData.toResult<string>(() => "not ready");
	expect(handler(RemoteData.notAsked())).toEqual({ kind: "Error", error: "not ready" });
	expect(handler(RemoteData.loading())).toEqual({ kind: "Error", error: "not ready" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("RemoteData composes well in a pipe chain", () => {
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

test("RemoteData.fromResult converts Ok to Success", () => {
	expect(RemoteData.fromResult(Result.ok(42))).toEqual(RemoteData.success(42));
});

test("RemoteData.fromResult converts Err to Failure", () => {
	expect(RemoteData.fromResult(Result.err("oops"))).toEqual(RemoteData.failure("oops"));
});

test("RemoteData.fromResult preserves complex value types", () => {
	expect(RemoteData.fromResult(Result.ok({ id: 1, name: "Alice" }))).toEqual(
		RemoteData.success({ id: 1, name: "Alice" }),
	);
});

test("RemoteData.fromResult preserves complex error types", () => {
	expect(RemoteData.fromResult(Result.err({ code: 404 }))).toEqual(
		RemoteData.failure({ code: 404 }),
	);
});

// ---------------------------------------------------------------------------
// fromMaybe
// ---------------------------------------------------------------------------

test("RemoteData.fromMaybe converts Some to Success", () => {
	expect(RemoteData.fromMaybe(() => "missing")(Maybe.some(42))).toEqual(RemoteData.success(42));
});

test("RemoteData.fromMaybe converts None to Failure using onNone", () => {
	expect(RemoteData.fromMaybe(() => "missing")(Maybe.none())).toEqual(RemoteData.failure("missing"));
});

test("RemoteData.fromMaybe preserves complex value types", () => {
	expect(
		RemoteData.fromMaybe(() => "not found")(Maybe.some({ id: 1, name: "Alice" })),
	).toEqual(RemoteData.success({ id: 1, name: "Alice" }));
});

test("RemoteData.fromMaybe composes in pipe", () => {
	expect(
		pipe(Maybe.some(5), RemoteData.fromMaybe(() => "no value")),
	).toEqual(RemoteData.success(5));
});

test("RemoteData.fromMaybe curried handler can be assigned and reused", () => {
	const toRemote = RemoteData.fromMaybe(() => "missing");
	expect(toRemote(Maybe.some(1))).toEqual(RemoteData.success(1));
	expect(toRemote(Maybe.none())).toEqual(RemoteData.failure("missing"));
});
