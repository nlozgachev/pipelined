import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { RemoteData } from "../RemoteData.ts";

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
	const result = pipe(
		RemoteData.success<string, number>(5),
		RemoteData.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "Success", value: 10 });
});

test("RemoteData.map passes through NotAsked", () => {
	const result = pipe(
		RemoteData.notAsked<string, number>(),
		RemoteData.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "NotAsked" });
});

test("RemoteData.map passes through Loading", () => {
	const result = pipe(
		RemoteData.loading<string, number>(),
		RemoteData.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "Loading" });
});

test("RemoteData.map passes through Failure", () => {
	const result = pipe(
		RemoteData.failure<string, number>("err"),
		RemoteData.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "Failure", error: "err" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("RemoteData.mapError transforms Failure error", () => {
	const result = pipe(
		RemoteData.failure<string, number>("oops"),
		RemoteData.mapError((e: string) => e.toUpperCase()),
	);
	expect(result).toEqual({ kind: "Failure", error: "OOPS" });
});

test("RemoteData.mapError passes through Success", () => {
	const result = pipe(
		RemoteData.success<string, number>(5),
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
	const result = pipe(
		RemoteData.success<string, number>(5),
		RemoteData.chain((n: number) =>
			n > 0 ? RemoteData.success<string, number>(n * 2) : RemoteData.failure<string, number>("neg")
		),
	);
	expect(result).toEqual({ kind: "Success", value: 10 });
});

test("RemoteData.chain propagates Failure", () => {
	const result = pipe(
		RemoteData.failure<string, number>("err"),
		RemoteData.chain((n: number) => RemoteData.success<string, number>(n * 2)),
	);
	expect(result).toEqual({ kind: "Failure", error: "err" });
});

test("RemoteData.chain propagates Loading", () => {
	const result = pipe(
		RemoteData.loading<string, number>(),
		RemoteData.chain((n: number) => RemoteData.success<string, number>(n * 2)),
	);
	expect(result).toEqual({ kind: "Loading" });
});

test("RemoteData.chain propagates NotAsked", () => {
	const result = pipe(
		RemoteData.notAsked<string, number>(),
		RemoteData.chain((n: number) => RemoteData.success<string, number>(n * 2)),
	);
	expect(result).toEqual({ kind: "NotAsked" });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("RemoteData.ap applies function to value when both Success", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		RemoteData.success<string, typeof add>(add),
		RemoteData.ap(RemoteData.success<string, number>(5)),
		RemoteData.ap(RemoteData.success<string, number>(3)),
	);
	expect(result).toEqual({ kind: "Success", value: 8 });
});

test("RemoteData.ap returns Failure when function is Failure", () => {
	const result = pipe(
		RemoteData.failure<string, (n: number) => number>("err"),
		RemoteData.ap(RemoteData.success<string, number>(5)),
	);
	expect(result).toEqual({ kind: "Failure", error: "err" });
});

test("RemoteData.ap returns Failure when value is Failure", () => {
	const double = (n: number) => n * 2;
	const result = pipe(
		RemoteData.success<string, typeof double>(double),
		RemoteData.ap(RemoteData.failure<string, number>("err")),
	);
	expect(result).toEqual({ kind: "Failure", error: "err" });
});

test("RemoteData.ap returns Loading when either is Loading", () => {
	const double = (n: number) => n * 2;
	const result = pipe(
		RemoteData.success<string, typeof double>(double),
		RemoteData.ap(RemoteData.loading<string, number>()),
	);
	expect(result).toEqual({ kind: "Loading" });
});

test("RemoteData.ap returns Failure of function when both are Failure", () => {
	const result = pipe(
		RemoteData.failure<string, (n: number) => number>("fn error"),
		RemoteData.ap(RemoteData.failure<string, number>("arg error")),
	);
	expect(result).toEqual({ kind: "Failure", error: "fn error" });
});

test("RemoteData.ap returns NotAsked when function is NotAsked and arg is Success", () => {
	const result = pipe(
		RemoteData.notAsked<string, (n: number) => number>(),
		RemoteData.ap(RemoteData.success<string, number>(5)),
	);
	expect(result).toEqual({ kind: "NotAsked" });
});

test("RemoteData.ap returns Loading when function is Loading and arg is Success", () => {
	const result = pipe(
		RemoteData.loading<string, (n: number) => number>(),
		RemoteData.ap(RemoteData.success<string, number>(5)),
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
	const result = pipe(
		RemoteData.success<string, number>(42),
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
	const result = pipe(RemoteData.success<string, number>(5), RemoteData.getOrElse(() => 0));
	expect(result).toBe(5);
});

test("RemoteData.getOrElse returns default for non-Success", () => {
	expect(pipe(RemoteData.notAsked<string, number>(), RemoteData.getOrElse(() => 0))).toBe(0);
	expect(pipe(RemoteData.loading<string, number>(), RemoteData.getOrElse(() => 0))).toBe(0);
	expect(pipe(RemoteData.failure<string, number>("e"), RemoteData.getOrElse(() => 0))).toBe(0);
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
	pipe(
		RemoteData.success<string, number>(42),
		RemoteData.tap((n: number) => {
			captured = n;
		}),
	);
	expect(captured).toBe(42);
});

test("RemoteData.tap does not execute on Failure", () => {
	let called = false;
	pipe(
		RemoteData.failure<string, number>("err"),
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
	const result = pipe(
		RemoteData.success<string, number>(5),
		RemoteData.tap(() => {}),
	);
	expect(result).toEqual({ kind: "Success", value: 5 });
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("RemoteData.recover provides fallback for Failure", () => {
	const result = pipe(
		RemoteData.failure<string, number>("err"),
		RemoteData.recover((_e: string) => RemoteData.success<string, number>(99)),
	);
	expect(result).toEqual({ kind: "Success", value: 99 });
});

test("RemoteData.recover passes through Success", () => {
	const result = pipe(
		RemoteData.success<string, number>(5),
		RemoteData.recover((_e: string) => RemoteData.success<string, number>(99)),
	);
	expect(result).toEqual({ kind: "Success", value: 5 });
});

test("RemoteData.recover passes through Loading", () => {
	const result = pipe(
		RemoteData.loading<string, number>(),
		RemoteData.recover((_e: string) => RemoteData.success<string, number>(99)),
	);
	expect(result).toEqual({ kind: "Loading" });
});

test("RemoteData.recover passes through NotAsked", () => {
	const result = pipe(
		RemoteData.notAsked<string, number>(),
		RemoteData.recover((_e: string) => RemoteData.success<string, number>(99)),
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
	const result = pipe(
		RemoteData.success<string, number>(42),
		RemoteData.toResult(() => "not ready"),
	);
	expect(result).toEqual({ kind: "Ok", value: 42 });
});

test("RemoteData.toResult returns Err with original error for Failure", () => {
	const result = pipe(
		RemoteData.failure<string, number>("bad"),
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
	const result = pipe(
		RemoteData.success<string, number>(5),
		RemoteData.map((n: number) => n * 2),
		RemoteData.chain((n: number) =>
			n > 5 ? RemoteData.success<string, number>(n) : RemoteData.failure<string, number>("too small")
		),
		RemoteData.getOrElse(() => 0),
	);
	expect(result).toBe(10);
});
