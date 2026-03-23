import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Resource } from "../Resource.ts";
import { Task } from "../Task.ts";
import { TaskResult } from "../TaskResult.ts";

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("Resource.make creates a resource with the given acquire and release", async () => {
	const resource = Resource.make(
		TaskResult.ok<string, number>(42),
		(_n) => Task.resolve(undefined as void),
	);
	const result = await resource.acquire();
	expect(result).toEqual({ kind: "Ok", value: 42 });
});

// ---------------------------------------------------------------------------
// fromTask
// ---------------------------------------------------------------------------

test("Resource.fromTask wraps an infallible Task as a successful acquire", async () => {
	const resource = Resource.fromTask<string, number>(
		Task.resolve(7),
		(_n) => Task.resolve(undefined as void),
	);
	const result = await resource.acquire();
	expect(result).toEqual({ kind: "Ok", value: 7 });
});

// ---------------------------------------------------------------------------
// use — happy path
// ---------------------------------------------------------------------------

test("Resource.use passes the acquired value to the function", async () => {
	const resource = Resource.make(
		TaskResult.ok<string, number>(10),
		(_n) => Task.resolve(undefined as void),
	);
	const result = await pipe(
		resource,
		Resource.use((n) => TaskResult.ok<string, string>(`value: ${n}`)),
	)();
	expect(result).toEqual({ kind: "Ok", value: "value: 10" });
});

test("Resource.use calls release after the function succeeds", async () => {
	let released = false;
	const resource = Resource.make(
		TaskResult.ok<string, number>(1),
		(_n) =>
			Task.from(() => {
				released = true;
				return Promise.resolve(undefined as void);
			}),
	);
	await pipe(resource, Resource.use((_n) => TaskResult.ok<string, void>(undefined)))();
	expect(released).toBe(true);
});

test("Resource.use calls release with the acquired value", async () => {
	let releasedWith: number | null = null;
	const resource = Resource.make(
		TaskResult.ok<string, number>(99),
		(n) =>
			Task.from(() => {
				releasedWith = n;
				return Promise.resolve(undefined as void);
			}),
	);
	await pipe(resource, Resource.use((_n) => TaskResult.ok<string, void>(undefined)))();
	expect(releasedWith).toBe(99);
});

// ---------------------------------------------------------------------------
// use — error paths
// ---------------------------------------------------------------------------

test("Resource.use calls release even when the function returns Err", async () => {
	let released = false;
	const resource = Resource.make(
		TaskResult.ok<string, number>(5),
		(_n) =>
			Task.from(() => {
				released = true;
				return Promise.resolve(undefined as void);
			}),
	);
	const result = await pipe(
		resource,
		Resource.use((_n) => TaskResult.err<string, void>("something went wrong")),
	)();
	expect(released).toBe(true);
	expect(result).toEqual({ kind: "Error", error: "something went wrong" });
});

test("Resource.use does not call release when acquire fails", async () => {
	let released = false;
	const resource = Resource.make(
		TaskResult.err<string, number>("cannot connect"),
		(_n) =>
			Task.from(() => {
				released = true;
				return Promise.resolve(undefined as void);
			}),
	);
	const result = await pipe(
		resource,
		Resource.use((_n) => TaskResult.ok<string, void>(undefined)),
	)();
	expect(released).toBe(false);
	expect(result).toEqual({ kind: "Error", error: "cannot connect" });
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
	const resource = Resource.make(
		TaskResult.err<string, number>("auth failed"),
		(_n) => Task.resolve(undefined as void),
	);
	const result = await pipe(
		resource,
		Resource.use((_n) => TaskResult.ok<string, void>(undefined)),
	)();
	expect(result).toEqual({ kind: "Error", error: "auth failed" });
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
	expect(result).toEqual({ kind: "Ok", value: "1+x" });
});

test("Resource.combine releases second resource before first", async () => {
	const order: string[] = [];
	const rA = Resource.make(
		TaskResult.ok<string, string>("A"),
		(_s) =>
			Task.from(() => {
				order.push("release-A");
				return Promise.resolve(undefined as void);
			}),
	);
	const rB = Resource.make(
		TaskResult.ok<string, string>("B"),
		(_s) =>
			Task.from(() => {
				order.push("release-B");
				return Promise.resolve(undefined as void);
			}),
	);
	await pipe(
		Resource.combine(rA, rB),
		Resource.use((_pair) => TaskResult.ok<string, void>(undefined)),
	)();
	expect(order).toEqual(["release-B", "release-A"]);
});

test("Resource.combine releases first resource when second acquire fails", async () => {
	let releasedA = false;
	const rA = Resource.make(
		TaskResult.ok<string, string>("A"),
		(_s) =>
			Task.from(() => {
				releasedA = true;
				return Promise.resolve(undefined as void);
			}),
	);
	const rB = Resource.make(
		TaskResult.err<string, string>("B failed"),
		(_s) => Task.resolve(undefined as void),
	);
	const result = await pipe(
		Resource.combine(rA, rB),
		Resource.use((_pair) => TaskResult.ok<string, void>(undefined)),
	)();
	expect(releasedA).toBe(true);
	expect(result).toEqual({ kind: "Error", error: "B failed" });
});

test("Resource.combine does not call the function when first acquire fails", async () => {
	let called = false;
	const rA = Resource.make(
		TaskResult.err<string, string>("A failed"),
		(_s) => Task.resolve(undefined as void),
	);
	const rB = Resource.make(
		TaskResult.ok<string, string>("B"),
		(_s) => Task.resolve(undefined as void),
	);
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

test("Resource composes with TaskResult operations inside use", async () => {
	const resource = Resource.make(
		TaskResult.ok<string, number>(5),
		(_n) => Task.resolve(undefined as void),
	);
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
	expect(result).toEqual({ kind: "Ok", value: 10 });
});

test("Resource.use works with fromTask resource", async () => {
	let released = false;
	const resource = Resource.fromTask<string, string>(
		Task.resolve("handle"),
		(_s) =>
			Task.from(() => {
				released = true;
				return Promise.resolve(undefined as void);
			}),
	);
	const result = await pipe(
		resource,
		Resource.use((handle) => TaskResult.ok<string, string>(`used: ${handle}`)),
	)();
	expect(result).toEqual({ kind: "Ok", value: "used: handle" });
	expect(released).toBe(true);
});
