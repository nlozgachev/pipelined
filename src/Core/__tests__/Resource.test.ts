import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Resource } from "../Resource.ts";
import type { Result } from "../Result.ts";
import { Task } from "../Task.ts";

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("make: creates a resource with the given acquire and release", async () => {
	const resource = Resource.make(Task.Result.make.ok(42), (_n) => Task.make(undefined as void));
	const result = await resource.acquire();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

// ---------------------------------------------------------------------------
// fromTask
// ---------------------------------------------------------------------------

test("from.Task: wraps an infallible Task as a successful acquire", async () => {
	const resource = Resource.from.Task(Task.make(7), (_n) => Task.make(undefined as void));
	const result = await resource.acquire();
	expect(result).toStrictEqual({ kind: "Ok", value: 7 });
	expectTypeOf(resource).toEqualTypeOf<Resource<never, number>>();
});

// ---------------------------------------------------------------------------
// use — happy path
// ---------------------------------------------------------------------------

test("use: passes the acquired value to the function", async () => {
	const resource = Resource.make(Task.Result.make.ok(10), (_n) => Task.make(undefined as void));
	const result = await pipe(resource, Resource.use((n) => Task.Result.make.ok(`value: ${n}`)))();
	expect(result).toStrictEqual({ kind: "Ok", value: "value: 10" });
});

test("use: calls release after the function succeeds", async () => {
	let released = false;
	const resource = Resource.make(Task.Result.make.ok(1), (_n) =>
		Task.tryCatch(() => {
			released = true;
			return Promise.resolve(undefined as void);
		}, { onError: () => {} }));
	await pipe(resource, Resource.use((_n) => Task.Result.make.ok(undefined)))();
	expect(released).toBe(true);
});

test("use: calls release with the acquired value", async () => {
	let releasedWith: number | null = null;
	const resource = Resource.make(Task.Result.make.ok(99), (n) =>
		Task.tryCatch(() => {
			releasedWith = n;
			return Promise.resolve(undefined as void);
		}, { onError: () => {} }));
	await pipe(resource, Resource.use((_n) => Task.Result.make.ok(undefined)))();
	expect(releasedWith).toBe(99);
});

// ---------------------------------------------------------------------------
// use — error paths
// ---------------------------------------------------------------------------

test("use: calls release even when the function returns Err", async () => {
	let released = false;
	const resource = Resource.make(Task.Result.make.ok(5), (_n) =>
		Task.tryCatch(() => {
			released = true;
			return Promise.resolve(undefined as void);
		}, { onError: () => {} }));
	const result = await pipe(resource, Resource.use((_n) => Task.Result.make.err("something went wrong")))();
	expect(released).toBe(true);
	expect(result).toStrictEqual({ kind: "Err", error: "something went wrong" });
});

test("use: does not call release when acquire fails", async () => {
	let released = false;
	const resource = Resource.make(Task.Result.make.err("cannot connect"), (_n) =>
		Task.tryCatch(() => {
			released = true;
			return Promise.resolve(undefined as void);
		}, { onError: () => {} }));
	const result = await pipe(resource, Resource.use((_n) => Task.Result.make.ok(undefined)))();
	expect(released).toBe(false);
	expect(result).toStrictEqual({ kind: "Err", error: "cannot connect" });
});

test("use: does not call the function when acquire fails", async () => {
	let called = false;
	const resource = Resource.make(Task.Result.make.err("cannot connect"), (_n) => Task.make(undefined as void));
	await pipe(
		resource,
		Resource.use((_n) => {
			called = true;
			return Task.Result.make.ok(undefined);
		}),
	)();
	expect(called).toBe(false);
});

test("use: propagates acquire error unchanged", async () => {
	const resource = Resource.make(Task.Result.make.err("auth failed"), (_n) => Task.make(undefined as void));
	const result = await pipe(resource, Resource.use((_n) => Task.Result.make.ok(undefined)))();
	expect(result).toStrictEqual({ kind: "Err", error: "auth failed" });
});

test("use: infers union error type E1 | E2 without type annotations", async () => {
	const acquireTask: Task.Result<"acquire-err", number> = Task.Result.make.ok(42);
	const resource = Resource.make(acquireTask, (_n) => Task.make(undefined as void));
	const resultTask = pipe(
		resource,
		Resource.use((n): Task.Result<"use-err", string> => Task.Result.make.ok(`val: ${n}`)),
	);
	const result = await resultTask();
	expect(result).toStrictEqual({ kind: "Ok", value: "val: 42" });
	expectTypeOf(result).toEqualTypeOf<Result<"acquire-err" | "use-err", string>>();
});

// ---------------------------------------------------------------------------
// combine
// ---------------------------------------------------------------------------

test("combine: presents both acquired values as a tuple", async () => {
	const rA = Resource.make(Task.Result.make.ok(1), (_n) => Task.make(undefined as void));
	const rB = Resource.make(Task.Result.make.ok("x"), (_s) => Task.make(undefined as void));
	const result = await pipe(Resource.combine(rA, rB), Resource.use(([n, s]) => Task.Result.make.ok(`${n}+${s}`)))();
	expect(result).toStrictEqual({ kind: "Ok", value: "1+x" });
});

test("combine: releases second resource before first", async () => {
	const order: string[] = [];
	const rA = Resource.make(Task.Result.make.ok("A"), (_s) =>
		Task.tryCatch(() => {
			order.push("release-A");
			return Promise.resolve(undefined as void);
		}, { onError: () => {} }));
	const rB = Resource.make(Task.Result.make.ok("B"), (_s) =>
		Task.tryCatch(() => {
			order.push("release-B");
			return Promise.resolve(undefined as void);
		}, { onError: () => {} }));
	await pipe(Resource.combine(rA, rB), Resource.use((_pair) => Task.Result.make.ok(undefined)))();
	expect(order).toStrictEqual(["release-B", "release-A"]);
});

test("combine: releases first resource when second acquire fails", async () => {
	let releasedA = false;
	const rA = Resource.make(Task.Result.make.ok("A"), (_s) =>
		Task.tryCatch(() => {
			releasedA = true;
			return Promise.resolve(undefined as void);
		}, { onError: () => {} }));
	const rB = Resource.make(Task.Result.make.err("B failed"), (_s) => Task.make(undefined as void));
	const result = await pipe(Resource.combine(rA, rB), Resource.use((_pair) => Task.Result.make.ok(undefined)))();
	expect(releasedA).toBe(true);
	expect(result).toStrictEqual({ kind: "Err", error: "B failed" });
});

test("combine: does not call resourceB acquire when resourceA acquire fails", async () => {
	let calledB = false;
	const rA = Resource.make(Task.Result.make.err("A failed"), (_s) => Task.make(undefined as void));
	const rB = Resource.make(
		Task.Result.tryCatch(() => {
			calledB = true;
			return Promise.resolve("B");
		}, { onError: () => "B error" }),
		(_s) => Task.make(undefined as void),
	);

	const result = await pipe(Resource.combine(rA, rB), Resource.use((_pair) => Task.Result.make.ok(undefined)))();

	expect(calledB).toBe(false);
	expect(result).toStrictEqual({ kind: "Err", error: "A failed" });
});

test("combine: infers union error type E1 | E2 for disparate error types", async () => {
	const acquireA: Task.Result<"errA", number> = Task.Result.make.ok(1);
	const acquireB: Task.Result<"errB", string> = Task.Result.make.ok("x");
	const rA = Resource.make(acquireA, (_n) => Task.make(undefined as void));
	const rB = Resource.make(acquireB, (_s) => Task.make(undefined as void));
	const combined = Resource.combine(rA, rB);

	expectTypeOf(combined).toEqualTypeOf<Resource<"errA" | "errB", readonly [number, string]>>();
	const result = await combined.acquire();
	expect(result).toStrictEqual({ kind: "Ok", value: [1, "x"] });
});

test("combine: does not call the function when first acquire fails", async () => {
	let called = false;
	const rA = Resource.make(Task.Result.make.err("A failed"), (_s) => Task.make(undefined as void));
	const rB = Resource.make(Task.Result.make.ok("B"), (_s) => Task.make(undefined as void));
	await pipe(
		Resource.combine(rA, rB),
		Resource.use((_pair) => {
			called = true;
			return Task.Result.make.ok(undefined);
		}),
	)();
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes with Task.Result operations inside use", async () => {
	const resource = Resource.make(Task.Result.make.ok(5), (_n) => Task.make(undefined as void));
	const result = await pipe(
		resource,
		Resource.use((n) =>
			pipe(
				Task.Result.make.ok(n),
				Task.Result.map((x) => x * 2),
				Task.Result.chain((x) => x > 5 ? Task.Result.make.ok(x) : Task.Result.make.err("too small")),
			)
		),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 10 });
});

test("use: works with fromTask resource", async () => {
	let released = false;
	const resource = Resource.from.Task(Task.make("handle"), (_s) =>
		Task.tryCatch(() => {
			released = true;
			return Promise.resolve(undefined as void);
		}, { onError: () => {} }));
	const result = await pipe(resource, Resource.use((handle) => Task.Result.make.ok(`used: ${handle}`)))();
	expect(result).toStrictEqual({ kind: "Ok", value: "used: handle" });
	expect(released).toBe(true);
});

// ---------------------------------------------------------------------------
// abort propagation
// ---------------------------------------------------------------------------

test("use: propagates AbortSignal down to acquire f and release", async () => {
	let acquireSignal: AbortSignal | undefined;
	let fSignal: AbortSignal | undefined;
	let releaseSignal: AbortSignal | undefined;

	const resource = Resource.make((signal) => {
		acquireSignal = signal;
		return Task.Result.make.ok(42)(signal);
	}, (_n) => (signal) => {
		releaseSignal = signal;
		return Task.make(undefined as void)(signal);
	});

	const controller = new AbortController();
	const result = await pipe(
		resource,
		Resource.use((n) => (signal) => {
			fSignal = signal;
			return Task.Result.make.ok(`val: ${n}`)(signal);
		}),
	)(controller.signal);

	expect(result).toStrictEqual({ kind: "Ok", value: "val: 42" });
	expect(acquireSignal).toBe(controller.signal);
	expect(fSignal).toBe(controller.signal);
	expect(releaseSignal).toBe(controller.signal);
});

test("combine: propagates AbortSignal down to both acquisitions and releases", async () => {
	let acquireASignal: AbortSignal | undefined;
	let acquireBSignal: AbortSignal | undefined;
	let releaseASignal: AbortSignal | undefined;
	let releaseBSignal: AbortSignal | undefined;

	const resourceA = Resource.make((signal) => {
		acquireASignal = signal;
		return Task.Result.make.ok("A")(signal);
	}, (_s) => (signal) => {
		releaseASignal = signal;
		return Task.make(undefined as void)(signal);
	});

	const resourceB = Resource.make((signal) => {
		acquireBSignal = signal;
		return Task.Result.make.ok("B")(signal);
	}, (_s) => (signal) => {
		releaseBSignal = signal;
		return Task.make(undefined as void)(signal);
	});

	const controller = new AbortController();
	const combined = Resource.combine(resourceA, resourceB);

	const result = await pipe(combined, Resource.use(([a, b]) => Task.Result.make.ok(`${a}+${b}`)))(controller.signal);

	expect(result).toStrictEqual({ kind: "Ok", value: "A+B" });
	expect(acquireASignal).toBe(controller.signal);
	expect(acquireBSignal).toBe(controller.signal);
	expect(releaseASignal).toBe(controller.signal);
	expect(releaseBSignal).toBe(controller.signal);
});
