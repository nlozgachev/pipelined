import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { RemoteData } from "../RemoteData.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

Deno.test("RemoteData.notAsked creates NotAsked", () => {
	assertEquals(RemoteData.notAsked(), { kind: "NotAsked" });
});

Deno.test("RemoteData.loading creates Loading", () => {
	assertEquals(RemoteData.loading(), { kind: "Loading" });
});

Deno.test("RemoteData.failure creates Failure", () => {
	assertEquals(RemoteData.failure("err"), { kind: "Failure", error: "err" });
});

Deno.test("RemoteData.success creates Success", () => {
	assertEquals(RemoteData.success(42), { kind: "Success", value: 42 });
});

Deno.test("RemoteData.success is alias for success", () => {
	assertEquals(RemoteData.success(42), RemoteData.success(42));
});

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

Deno.test("RemoteData.isNotAsked", () => {
	assertStrictEquals(RemoteData.isNotAsked(RemoteData.notAsked()), true);
	assertStrictEquals(RemoteData.isNotAsked(RemoteData.loading()), false);
	assertStrictEquals(RemoteData.isNotAsked(RemoteData.failure("e")), false);
	assertStrictEquals(RemoteData.isNotAsked(RemoteData.success(1)), false);
});

Deno.test("RemoteData.isLoading", () => {
	assertStrictEquals(RemoteData.isLoading(RemoteData.loading()), true);
	assertStrictEquals(RemoteData.isLoading(RemoteData.notAsked()), false);
});

Deno.test("RemoteData.isFailure", () => {
	assertStrictEquals(RemoteData.isFailure(RemoteData.failure("e")), true);
	assertStrictEquals(RemoteData.isFailure(RemoteData.success(1)), false);
});

Deno.test("RemoteData.isSuccess", () => {
	assertStrictEquals(RemoteData.isSuccess(RemoteData.success(1)), true);
	assertStrictEquals(RemoteData.isSuccess(RemoteData.failure("e")), false);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("RemoteData.map transforms Success value", () => {
	const result = pipe(
		RemoteData.success<string, number>(5),
		RemoteData.map((n: number) => n * 2),
	);
	assertEquals(result, { kind: "Success", value: 10 });
});

Deno.test("RemoteData.map passes through NotAsked", () => {
	const result = pipe(
		RemoteData.notAsked<string, number>(),
		RemoteData.map((n: number) => n * 2),
	);
	assertEquals(result, { kind: "NotAsked" });
});

Deno.test("RemoteData.map passes through Loading", () => {
	const result = pipe(
		RemoteData.loading<string, number>(),
		RemoteData.map((n: number) => n * 2),
	);
	assertEquals(result, { kind: "Loading" });
});

Deno.test("RemoteData.map passes through Failure", () => {
	const result = pipe(
		RemoteData.failure<string, number>("err"),
		RemoteData.map((n: number) => n * 2),
	);
	assertEquals(result, { kind: "Failure", error: "err" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

Deno.test("RemoteData.mapError transforms Failure error", () => {
	const result = pipe(
		RemoteData.failure<string, number>("oops"),
		RemoteData.mapError((e: string) => e.toUpperCase()),
	);
	assertEquals(result, { kind: "Failure", error: "OOPS" });
});

Deno.test("RemoteData.mapError passes through Success", () => {
	const result = pipe(
		RemoteData.success<string, number>(5),
		RemoteData.mapError((e: string) => e.toUpperCase()),
	);
	assertEquals(result, { kind: "Success", value: 5 });
});

Deno.test("RemoteData.mapError passes through NotAsked and Loading", () => {
	const f = RemoteData.mapError((e: string) => e.toUpperCase());
	assertEquals(f(RemoteData.notAsked()), { kind: "NotAsked" });
	assertEquals(f(RemoteData.loading()), { kind: "Loading" });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

Deno.test("RemoteData.chain applies function on Success", () => {
	const result = pipe(
		RemoteData.success<string, number>(5),
		RemoteData.chain((n: number) =>
			n > 0 ? RemoteData.success<string, number>(n * 2) : RemoteData.failure<string, number>("neg")
		),
	);
	assertEquals(result, { kind: "Success", value: 10 });
});

Deno.test("RemoteData.chain propagates Failure", () => {
	const result = pipe(
		RemoteData.failure<string, number>("err"),
		RemoteData.chain((n: number) => RemoteData.success<string, number>(n * 2)),
	);
	assertEquals(result, { kind: "Failure", error: "err" });
});

Deno.test("RemoteData.chain propagates Loading", () => {
	const result = pipe(
		RemoteData.loading<string, number>(),
		RemoteData.chain((n: number) => RemoteData.success<string, number>(n * 2)),
	);
	assertEquals(result, { kind: "Loading" });
});

Deno.test("RemoteData.chain propagates NotAsked", () => {
	const result = pipe(
		RemoteData.notAsked<string, number>(),
		RemoteData.chain((n: number) => RemoteData.success<string, number>(n * 2)),
	);
	assertEquals(result, { kind: "NotAsked" });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

Deno.test("RemoteData.ap applies function to value when both Success", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		RemoteData.success<string, typeof add>(add),
		RemoteData.ap(RemoteData.success<string, number>(5)),
		RemoteData.ap(RemoteData.success<string, number>(3)),
	);
	assertEquals(result, { kind: "Success", value: 8 });
});

Deno.test("RemoteData.ap returns Failure when function is Failure", () => {
	const result = pipe(
		RemoteData.failure<string, (n: number) => number>("err"),
		RemoteData.ap(RemoteData.success<string, number>(5)),
	);
	assertEquals(result, { kind: "Failure", error: "err" });
});

Deno.test("RemoteData.ap returns Failure when value is Failure", () => {
	const double = (n: number) => n * 2;
	const result = pipe(
		RemoteData.success<string, typeof double>(double),
		RemoteData.ap(RemoteData.failure<string, number>("err")),
	);
	assertEquals(result, { kind: "Failure", error: "err" });
});

Deno.test("RemoteData.ap returns Loading when either is Loading", () => {
	const double = (n: number) => n * 2;
	const result = pipe(
		RemoteData.success<string, typeof double>(double),
		RemoteData.ap(RemoteData.loading<string, number>()),
	);
	assertEquals(result, { kind: "Loading" });
});

Deno.test("RemoteData.ap returns Failure of function when both are Failure", () => {
	const result = pipe(
		RemoteData.failure<string, (n: number) => number>("fn error"),
		RemoteData.ap(RemoteData.failure<string, number>("arg error")),
	);
	assertEquals(result, { kind: "Failure", error: "fn error" });
});

Deno.test("RemoteData.ap returns NotAsked when function is NotAsked and arg is Success", () => {
	const result = pipe(
		RemoteData.notAsked<string, (n: number) => number>(),
		RemoteData.ap(RemoteData.success<string, number>(5)),
	);
	assertEquals(result, { kind: "NotAsked" });
});

Deno.test("RemoteData.ap returns Loading when function is Loading and arg is Success", () => {
	const result = pipe(
		RemoteData.loading<string, (n: number) => number>(),
		RemoteData.ap(RemoteData.success<string, number>(5)),
	);
	assertEquals(result, { kind: "Loading" });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

Deno.test("RemoteData.fold handles all four cases", () => {
	const handler = RemoteData.fold<string, number, string>(
		() => "not asked",
		() => "loading",
		(e) => `error: ${e}`,
		(v) => `value: ${v}`,
	);

	assertStrictEquals(handler(RemoteData.notAsked()), "not asked");
	assertStrictEquals(handler(RemoteData.loading()), "loading");
	assertStrictEquals(handler(RemoteData.failure("bad")), "error: bad");
	assertStrictEquals(handler(RemoteData.success(42)), "value: 42");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

Deno.test("RemoteData.match handles all four cases", () => {
	const handler = RemoteData.match<string, number, string>({
		notAsked: () => "na",
		loading: () => "ld",
		failure: (e) => `f:${e}`,
		success: (v) => `s:${v}`,
	});

	assertStrictEquals(handler(RemoteData.notAsked()), "na");
	assertStrictEquals(handler(RemoteData.loading()), "ld");
	assertStrictEquals(handler(RemoteData.failure("x")), "f:x");
	assertStrictEquals(handler(RemoteData.success(1)), "s:1");
});

Deno.test("RemoteData.match works in pipe", () => {
	const result = pipe(
		RemoteData.success<string, number>(42),
		RemoteData.match({
			notAsked: () => "na",
			loading: () => "ld",
			failure: (e: string) => `f:${e}`,
			success: (v: number) => `s:${v}`,
		}),
	);
	assertStrictEquals(result, "s:42");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

Deno.test("RemoteData.getOrElse returns value for Success", () => {
	const result = pipe(RemoteData.success<string, number>(5), RemoteData.getOrElse(() => 0));
	assertStrictEquals(result, 5);
});

Deno.test("RemoteData.getOrElse returns default for non-Success", () => {
	assertStrictEquals(pipe(RemoteData.notAsked<string, number>(), RemoteData.getOrElse(() => 0)), 0);
	assertStrictEquals(pipe(RemoteData.loading<string, number>(), RemoteData.getOrElse(() => 0)), 0);
	assertStrictEquals(
		pipe(RemoteData.failure<string, number>("e"), RemoteData.getOrElse(() => 0)),
		0,
	);
});

Deno.test("RemoteData.getOrElse widens return type to A | B when default is a different type", () => {
	const result = pipe(
		RemoteData.loading(),
		RemoteData.getOrElse(() => null),
	);
	assertStrictEquals(result, null);
});

Deno.test("RemoteData.getOrElse returns Success value typed as A | B when Success", () => {
	const result = pipe(
		RemoteData.success(5),
		RemoteData.getOrElse(() => null),
	);
	assertStrictEquals(result, 5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

Deno.test("RemoteData.tap executes side effect on Success", () => {
	let captured = 0;
	pipe(
		RemoteData.success<string, number>(42),
		RemoteData.tap((n: number) => {
			captured = n;
		}),
	);
	assertStrictEquals(captured, 42);
});

Deno.test("RemoteData.tap does not execute on Failure", () => {
	let called = false;
	pipe(
		RemoteData.failure<string, number>("err"),
		RemoteData.tap((_: number) => {
			called = true;
		}),
	);
	assertStrictEquals(called, false);
});

Deno.test("RemoteData.tap does not execute on NotAsked or Loading", () => {
	let called = false;
	const f = RemoteData.tap((_: number) => {
		called = true;
	});
	f(RemoteData.notAsked());
	f(RemoteData.loading());
	assertStrictEquals(called, false);
});

Deno.test("RemoteData.tap returns original value", () => {
	const result = pipe(
		RemoteData.success<string, number>(5),
		RemoteData.tap(() => {}),
	);
	assertEquals(result, { kind: "Success", value: 5 });
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

Deno.test("RemoteData.recover provides fallback for Failure", () => {
	const result = pipe(
		RemoteData.failure<string, number>("err"),
		RemoteData.recover((_e: string) => RemoteData.success<string, number>(99)),
	);
	assertEquals(result, { kind: "Success", value: 99 });
});

Deno.test("RemoteData.recover passes through Success", () => {
	const result = pipe(
		RemoteData.success<string, number>(5),
		RemoteData.recover((_e: string) => RemoteData.success<string, number>(99)),
	);
	assertEquals(result, { kind: "Success", value: 5 });
});

Deno.test("RemoteData.recover passes through Loading", () => {
	const result = pipe(
		RemoteData.loading<string, number>(),
		RemoteData.recover((_e: string) => RemoteData.success<string, number>(99)),
	);
	assertEquals(result, { kind: "Loading" });
});

Deno.test("RemoteData.recover passes through NotAsked", () => {
	const result = pipe(
		RemoteData.notAsked<string, number>(),
		RemoteData.recover((_e: string) => RemoteData.success<string, number>(99)),
	);
	assertEquals(result, { kind: "NotAsked" });
});

Deno.test(
	"RemoteData.recover widens to RemoteData<E, A | B> when fallback returns a different type",
	() => {
		const result = pipe(
			RemoteData.failure("err"),
			RemoteData.recover((_e) => RemoteData.success("recovered")),
		);
		assertEquals(result, { kind: "Success", value: "recovered" });
	},
);

Deno.test("RemoteData.recover preserves Success typed as RemoteData<E, A | B>", () => {
	const result = pipe(
		RemoteData.success(5),
		RemoteData.recover((_e) => RemoteData.success("recovered")),
	);
	assertEquals(result, { kind: "Success", value: 5 });
});

// ---------------------------------------------------------------------------
// toOption
// ---------------------------------------------------------------------------

Deno.test("RemoteData.toOption returns Some for Success", () => {
	assertEquals(RemoteData.toOption(RemoteData.success(42)), { kind: "Some", value: 42 });
});

Deno.test("RemoteData.toOption returns None for non-Success", () => {
	assertEquals(RemoteData.toOption(RemoteData.notAsked()), { kind: "None" });
	assertEquals(RemoteData.toOption(RemoteData.loading()), { kind: "None" });
	assertEquals(RemoteData.toOption(RemoteData.failure("e")), { kind: "None" });
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

Deno.test("RemoteData.toResult returns Ok for Success", () => {
	const result = pipe(
		RemoteData.success<string, number>(42),
		RemoteData.toResult(() => "not ready"),
	);
	assertEquals(result, { kind: "Ok", value: 42 });
});

Deno.test("RemoteData.toResult returns Err with original error for Failure", () => {
	const result = pipe(
		RemoteData.failure<string, number>("bad"),
		RemoteData.toResult(() => "not ready"),
	);
	assertEquals(result, { kind: "Error", error: "bad" });
});

Deno.test("RemoteData.toResult returns Err with fallback for NotAsked/Loading", () => {
	const handler = RemoteData.toResult<string>(() => "not ready");
	assertEquals(handler(RemoteData.notAsked()), { kind: "Error", error: "not ready" });
	assertEquals(handler(RemoteData.loading()), { kind: "Error", error: "not ready" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("RemoteData composes well in a pipe chain", () => {
	const result = pipe(
		RemoteData.success<string, number>(5),
		RemoteData.map((n: number) => n * 2),
		RemoteData.chain((n: number) =>
			n > 5 ? RemoteData.success<string, number>(n) : RemoteData.failure<string, number>("too small")
		),
		RemoteData.getOrElse(() => 0),
	);
	assertStrictEquals(result, 10);
});
