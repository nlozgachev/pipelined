import { pipe } from "#composition";
import { Resource, Task, TaskResult } from "#core";
import { expect, test } from "vitest";

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("Resource.make creates a resource with the given acquire and release", async () => {
	const resource = Resource.make(TaskResult.ok<string, number>(42), (_n) => Task.resolve(undefined as void));
	const result = await resource.acquire();
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

// ---------------------------------------------------------------------------
// fromTask
// ---------------------------------------------------------------------------

test("Resource.fromTask wraps an infallible Task as a successful acquire", async () => {
	const resource = Resource.fromTask<string, number>(Task.resolve(7), (_n) => Task.resolve(undefined as void));
	const result = await resource.acquire();
	expect(result).toStrictEqual({ kind: "Ok", value: 7 });
});

// ---------------------------------------------------------------------------
// use — happy path
// ---------------------------------------------------------------------------

test("Resource.use passes the acquired value to the function", async () => {
	const resource = Resource.make(TaskResult.ok<string, number>(10), (_n) => Task.resolve(undefined as void));
	const result = await pipe(resource, Resource.use((n) => TaskResult.ok<string, string>(`value: ${n}`)))();
	expect(result).toStrictEqual({ kind: "Ok", value: "value: 10" });
});

test("Resource.use calls release after the function succeeds", async () => {
	let released = false;
	const resource = Resource.make(TaskResult.ok<string, number>(1), (_n) =>
		Task.from(() => {
			released = true;
			return Promise.resolve(undefined as void);
		}));
	await pipe(resource, Resource.use((_n) => TaskResult.ok<string, void>(undefined)))();
	expect(released).toBe(true);
});

test("Resource.use calls release with the acquired value", async () => {
	let releasedWith: number | null = null;
	const resource = Resource.make(TaskResult.ok<string, number>(99), (n) =>
		Task.from(() => {
			releasedWith = n;
			return Promise.resolve(undefined as void);
		}));
	await pipe(resource, Resource.use((_n) => TaskResult.ok<string, void>(undefined)))();
	expect(releasedWith).toBe(99);
});

// ---------------------------------------------------------------------------
// use — error paths
// ---------------------------------------------------------------------------

test("Resource.use calls release even when the function returns Err", async () => {
	let released = false;
	const resource = Resource.make(TaskResult.ok<string, number>(5), (_n) =>
		Task.from(() => {
			released = true;
			return Promise.resolve(undefined as void);
		}));
	const result = await pipe(resource, Resource.use((_n) => TaskResult.err<string, void>("something went wrong")))();
	expect(released).toBe(true);
	expect(result).toStrictEqual({ kind: "Err", error: "something went wrong" });
});

test("Resource.use does not call release when acquire fails", async () => {
	let released = false;
	const resource = Resource.make(TaskResult.err<string, number>("cannot connect"), (_n) =>
		Task.from(() => {
			released = true;
			return Promise.resolve(undefined as void);
		}));
	const result = await pipe(resource, Resource.use((_n) => TaskResult.ok<string, void>(undefined)))();
	expect(released).toBe(false);
	expect(result).toStrictEqual({ kind: "Err", error: "cannot connect" });
});

test("Resource.use does not call the function when acquire fails", async () => {
	let called = false;
	const resource = Resource.make(
		TaskResult.err<string, number>("cannot connect"),
		(_n) => Task.resolve(undefined as void),
	);
	await pipe(
		resource,
		Resource.use((_n) => {
			called = true;
			return TaskResult.ok<string, void>(undefined);
		}),
	)();
	expect(called).toBe(false);
});

test("Resource.use propagates acquire error unchanged", async () => {
	const resource = Resource.make(TaskResult.err<string, number>("auth failed"), (_n) => Task.resolve(undefined as void));
	const result = await pipe(resource, Resource.use((_n) => TaskResult.ok<string, void>(undefined)))();
	expect(result).toStrictEqual({ kind: "Err", error: "auth failed" });
});

// ---------------------------------------------------------------------------
// combine
// ---------------------------------------------------------------------------

test("Resource.combine presents both acquired values as a tuple", async () => {
	const rA = Resource.make(TaskResult.ok<string, number>(1), (_n) => Task.resolve(undefined as void));
	const rB = Resource.make(TaskResult.ok<string, string>("x"), (_s) => Task.resolve(undefined as void));
	const result = await pipe(
		Resource.combine(rA, rB),
		Resource.use(([n, s]) => TaskResult.ok<string, string>(`${n}+${s}`)),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: "1+x" });
});

test("Resource.combine releases second resource before first", async () => {
	const order: string[] = [];
	const rA = Resource.make(TaskResult.ok<string, string>("A"), (_s) =>
		Task.from(() => {
			order.push("release-A");
			return Promise.resolve(undefined as void);
		}));
	const rB = Resource.make(TaskResult.ok<string, string>("B"), (_s) =>
		Task.from(() => {
			order.push("release-B");
			return Promise.resolve(undefined as void);
		}));
	await pipe(Resource.combine(rA, rB), Resource.use((_pair) => TaskResult.ok<string, void>(undefined)))();
	expect(order).toStrictEqual(["release-B", "release-A"]);
});

test("Resource.combine releases first resource when second acquire fails", async () => {
	let releasedA = false;
	const rA = Resource.make(TaskResult.ok<string, string>("A"), (_s) =>
		Task.from(() => {
			releasedA = true;
			return Promise.resolve(undefined as void);
		}));
	const rB = Resource.make(TaskResult.err<string, string>("B failed"), (_s) => Task.resolve(undefined as void));
	const result = await pipe(Resource.combine(rA, rB), Resource.use((_pair) => TaskResult.ok<string, void>(undefined)))();
	expect(releasedA).toBe(true);
	expect(result).toStrictEqual({ kind: "Err", error: "B failed" });
});

test("Resource.combine does not call the function when first acquire fails", async () => {
	let called = false;
	const rA = Resource.make(TaskResult.err<string, string>("A failed"), (_s) => Task.resolve(undefined as void));
	const rB = Resource.make(TaskResult.ok<string, string>("B"), (_s) => Task.resolve(undefined as void));
	await pipe(
		Resource.combine(rA, rB),
		Resource.use((_pair) => {
			called = true;
			return TaskResult.ok<string, void>(undefined);
		}),
	)();
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("resource composes with TaskResult operations inside use", async () => {
	const resource = Resource.make(TaskResult.ok<string, number>(5), (_n) => Task.resolve(undefined as void));
	const result = await pipe(
		resource,
		Resource.use((n) =>
			pipe(
				TaskResult.ok<string, number>(n),
				TaskResult.map((x) => x * 2),
				TaskResult.chain((x) => x > 5 ? TaskResult.ok(x) : TaskResult.err("too small")),
			)
		),
	)();
	expect(result).toStrictEqual({ kind: "Ok", value: 10 });
});

test("Resource.use works with fromTask resource", async () => {
	let released = false;
	const resource = Resource.fromTask<string, string>(Task.resolve("handle"), (_s) =>
		Task.from(() => {
			released = true;
			return Promise.resolve(undefined as void);
		}));
	const result = await pipe(resource, Resource.use((handle) => TaskResult.ok<string, string>(`used: ${handle}`)))();
	expect(result).toStrictEqual({ kind: "Ok", value: "used: handle" });
	expect(released).toBe(true);
});

// ---------------------------------------------------------------------------
// abort propagation
// ---------------------------------------------------------------------------

test("Resource.use propagates the AbortSignal down to acquire, f, and release", async () => {
	let acquireSignal: AbortSignal | undefined;
	let fSignal: AbortSignal | undefined;
	let releaseSignal: AbortSignal | undefined;

	const resource = Resource.make((signal) => {
		acquireSignal = signal;
		return TaskResult.ok<string, number>(42)(signal);
	}, (_n) => (signal) => {
		releaseSignal = signal;
		return Task.resolve(undefined as void)(signal);
	});

	const controller = new AbortController();
	const result = await pipe(
		resource,
		Resource.use((n) => (signal) => {
			fSignal = signal;
			return TaskResult.ok<string, string>(`val: ${n}`)(signal);
		}),
	)(controller.signal);

	expect(result).toStrictEqual({ kind: "Ok", value: "val: 42" });
	expect(acquireSignal).toBe(controller.signal);
	expect(fSignal).toBe(controller.signal);
	expect(releaseSignal).toBe(controller.signal);
});

test("Resource.combine propagates the AbortSignal down to both sub-acquisitions and sub-releases", async () => {
	let acquireASignal: AbortSignal | undefined;
	let acquireBSignal: AbortSignal | undefined;
	let releaseASignal: AbortSignal | undefined;
	let releaseBSignal: AbortSignal | undefined;

	const resourceA = Resource.make((signal) => {
		acquireASignal = signal;
		return TaskResult.ok<string, string>("A")(signal);
	}, (_s) => (signal) => {
		releaseASignal = signal;
		return Task.resolve(undefined as void)(signal);
	});

	const resourceB = Resource.make((signal) => {
		acquireBSignal = signal;
		return TaskResult.ok<string, string>("B")(signal);
	}, (_s) => (signal) => {
		releaseBSignal = signal;
		return Task.resolve(undefined as void)(signal);
	});

	const controller = new AbortController();
	const combined = Resource.combine(resourceA, resourceB);

	const result = await pipe(combined, Resource.use(([a, b]) => TaskResult.ok<string, string>(`${a}+${b}`)))(
		controller.signal,
	);

	expect(result).toStrictEqual({ kind: "Ok", value: "A+B" });
	expect(acquireASignal).toBe(controller.signal);
	expect(acquireBSignal).toBe(controller.signal);
	expect(releaseASignal).toBe(controller.signal);
	expect(releaseBSignal).toBe(controller.signal);
});
