import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../../Types/Duration.ts";
import { CircuitBreaker } from "../CircuitBreaker.ts";
import { Result } from "../Result.ts";
import { Task } from "../Task.ts";

test("make: infers CircuitBreaker instance and respects generic error parameter", () => {
	type CustomError = { readonly code: number; readonly reason: string; };

	const breaker = CircuitBreaker.make<CustomError>({
		failureThreshold: 5,
		resetTimeout: Duration.seconds(30),
		successThreshold: 2,
		failureWindow: Duration.minutes(1),
		shouldTrip: (err) => err.code >= 500,
	});

	expectTypeOf(breaker).toEqualTypeOf<CircuitBreaker<CustomError>>();

	// Default without type parameter defaults to unknown
	const defaultBreaker = CircuitBreaker.make({ failureThreshold: 3, resetTimeout: Duration.seconds(10) });

	expectTypeOf(defaultBreaker).toEqualTypeOf<CircuitBreaker<unknown>>();

	// @ts-expect-error — failureThreshold is required
	CircuitBreaker.make({ resetTimeout: Duration.seconds(5) });

	// @ts-expect-error — resetTimeout is required
	CircuitBreaker.make({ failureThreshold: 3 });
});

test("state: returns discriminated union and supports narrowing", () => {
	type CustomError = { readonly tag: "Network"; readonly message: string; };
	const breaker = CircuitBreaker.make<CustomError>({ failureThreshold: 3, resetTimeout: Duration.seconds(10) });

	const state = breaker.state();
	expectTypeOf(state).toEqualTypeOf<CircuitBreaker.State<CustomError>>();

	if (CircuitBreaker.is.closed(state)) {
		expectTypeOf(state).toEqualTypeOf<CircuitBreaker.ClosedState>();
		expectTypeOf(state.failures).toEqualTypeOf<number>();
	} else if (CircuitBreaker.is.open(state)) {
		expectTypeOf(state).toEqualTypeOf<CircuitBreaker.OpenState<CustomError>>();
		expectTypeOf(state.lastError).toEqualTypeOf<CustomError>();
		expectTypeOf(state.retryAfterMs).toEqualTypeOf<number>();
		expectTypeOf(state.openedAt).toEqualTypeOf<number>();
	} else if (CircuitBreaker.is.halfOpen(state)) {
		expectTypeOf(state).toEqualTypeOf<CircuitBreaker.HalfOpenState>();
		expectTypeOf(state.probeInFlight).toEqualTypeOf<boolean>();
		expectTypeOf(state.consecutiveSuccesses).toEqualTypeOf<number>();
	}

	// Direct discriminated union check via kind
	if (state.kind === "Open") {
		expectTypeOf(state.lastError).toEqualTypeOf<CustomError>();
	}
});

test("protect: preserves narrowed task error type while appending CircuitOpenError", () => {
	type SpecificHttpError = { readonly code: 503; readonly url: string; };
	type GeneralHttpError = { readonly code: number; };

	const breaker = CircuitBreaker.make<GeneralHttpError>({ failureThreshold: 3, resetTimeout: Duration.seconds(10) });

	const task: Task.Result<SpecificHttpError, { readonly data: string; }> = () =>
		constTruthyBool()
			? Task.Result.make.ok({ data: "payload" })()
			: Task.Result.make.err({ code: 503 as const, url: "https://api.example.com" })();

	const protectedTask = breaker.protect(task);

	expectTypeOf(protectedTask).toEqualTypeOf<
		Task.Result<SpecificHttpError | CircuitBreaker.OpenError<GeneralHttpError>, { readonly data: string; }>
	>();
});

test("protect: rejects tasks whose errors do not satisfy breaker error constraint", () => {
	type DbError = { readonly sqlState: string; };
	type HttpError = { readonly statusCode: number; };

	const breaker = CircuitBreaker.make<HttpError>({ failureThreshold: 3, resetTimeout: Duration.seconds(10) });

	const dbTask: Task.Result<DbError, number> = () => Task.Result.make.err({ sqlState: "42000" })();

	// @ts-expect-error — DbError is not assignable to HttpError
	breaker.protect(dbTask);

	expectTypeOf(breaker.protect).toBeFunction();
});

test("subscribe: provides typed state in callback and returns unsubscribe thunk", () => {
	type CustomError = { readonly id: string; };
	const breaker = CircuitBreaker.make<CustomError>({ failureThreshold: 3, resetTimeout: Duration.seconds(10) });

	const unsub = breaker.subscribe((state) => {
		expectTypeOf(state).toEqualTypeOf<CircuitBreaker.State<CustomError>>();
	});

	expectTypeOf(unsub).toEqualTypeOf<() => void>();
});

test("is: type guards correctly narrow types", () => {
	const errCandidate: unknown = Result.make.err("e");

	if (CircuitBreaker.is.openError<string>(errCandidate)) {
		expectTypeOf(errCandidate).toEqualTypeOf<CircuitBreaker.OpenError<string>>();
		expectTypeOf(errCandidate.lastError).toEqualTypeOf<string>();
		expectTypeOf(errCandidate.retryAfterMs).toEqualTypeOf<number>();
	}
});

test("protect: default breaker without type argument accepts arbitrary tasks and infers OpenError<unknown>", () => {
	const defaultBreaker = CircuitBreaker.make({ failureThreshold: 3, resetTimeout: Duration.seconds(10) });

	const task: Task.Result<{ readonly tag: "Fail"; }, string> = () =>
		constTruthyBool() ? Task.Result.make.ok("hello")() : Task.Result.make.err({ tag: "Fail" as const })();

	const protectedTask = defaultBreaker.protect(task);

	expectTypeOf(protectedTask).toEqualTypeOf<
		Task.Result<{ readonly tag: "Fail"; } | CircuitBreaker.OpenError<unknown>, string>
	>();
});

test("pipe: preserves type inference with pipe(task, breaker.protect)", () => {
	type ApiError = { readonly message: string; };
	const breaker = CircuitBreaker.make<ApiError>({ failureThreshold: 3, resetTimeout: Duration.seconds(10) });

	const task: Task.Result<ApiError, number> = () =>
		constTruthyBool() ? Task.Result.make.ok(42)() : Task.Result.make.err({ message: "failed" })();

	const piped = pipe(task, breaker.protect);

	expectTypeOf(piped).toEqualTypeOf<Task.Result<ApiError | CircuitBreaker.OpenError<ApiError>, number>>();
});
