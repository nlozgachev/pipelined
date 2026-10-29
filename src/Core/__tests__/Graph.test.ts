import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../../Types/Duration.ts";
import { RetryPolicy } from "../../Types/RetryPolicy.ts";
import { Graph } from "../Graph.ts";
import { Result } from "../Result.ts";
import { Task } from "../Task.ts";

// -----------------------------------------------------------------------------
// Graph.node validation
// -----------------------------------------------------------------------------

test("node: throws TypeError if id is empty or not a string", () => {
	expect(() => Graph.node({ id: "", run: () => Task.Result.make.ok(1) })).toThrow(TypeError);
	// @ts-expect-error — invalid id type
	expect(() => Graph.node({ id: null, run: () => Task.Result.make.ok(1) })).toThrow(TypeError);
});

test("node: throws TypeError if run is not a function", () => {
	// @ts-expect-error — invalid run callback
	expect(() => Graph.node({ id: "a", run: null })).toThrow(TypeError);
});

test("node: throws TypeError if deps is not an object or contains invalid nodes", () => {
	// @ts-expect-error — deps cannot be array
	expect(() => Graph.node({ id: "a", deps: [], run: () => Task.Result.make.ok(1) })).toThrow(TypeError);
	// @ts-expect-error — invalid dep node
	expect(() => Graph.node({ id: "a", deps: { b: null }, run: () => Task.Result.make.ok(1) })).toThrow(TypeError);
	// @ts-expect-error — invalid dep node structure
	expect(() => Graph.node({ id: "a", deps: { b: { kind: "NotNode" } }, run: () => Task.Result.make.ok(1) })).toThrow(
		TypeError,
	);
});

// -----------------------------------------------------------------------------
// Graph.make validation
// -----------------------------------------------------------------------------

test("make: throws TypeError if target is invalid", () => {
	// @ts-expect-error — null target
	expect(() => Graph.make(null)).toThrow(TypeError);
	// @ts-expect-error — invalid target kind
	expect(() => Graph.make({ kind: "NotNode" })).toThrow(TypeError);
});

test("make: throws Error on duplicate node ids", () => {
	const dep1 = Graph.node({ id: "sharedId", run: () => Task.Result.make.ok("a") });
	const dep2 = Graph.node({ id: "sharedId", run: () => Task.Result.make.ok("b") });
	const target = Graph.node({ id: "target", deps: { dep1, dep2 }, run: () => Task.Result.make.ok(1) });

	expect(() => Graph.make(target)).toThrow(/Duplicate node id 'sharedId'/);
});

test("make: throws Error on cyclic dependency graph", () => {
	const nodeA = Graph.node({ id: "A", run: () => Task.Result.make.ok(1) });

	// Manually inject a cycle for verification
	const [internalSymbol] = Object.getOwnPropertySymbols(nodeA);
	const internalA = Reflect.get(nodeA, internalSymbol) as { deps?: Record<string, unknown>; };
	const nodeB = Graph.node({ id: "B", deps: { a: nodeA }, run: () => Task.Result.make.ok(2) });
	internalA.deps = { b: nodeB };

	expect(() => Graph.make(nodeB)).toThrow(/Cycle detected in Graph/);
});

// -----------------------------------------------------------------------------
// Graph.run — Execution and Diamond Dependencies
// -----------------------------------------------------------------------------

test("run: executes single root node successfully", async () => {
	const node = Graph.node({ id: "root", run: () => Task.Result.make.ok(42) });

	const graph = Graph.make(node);
	const result = await Graph.run(graph)();

	expect(result).toStrictEqual(Result.make.ok(42));
});

test("run: executes sequential dependency chain in order", async () => {
	const executionLog: string[] = [];

	const step1 = Graph.node({
		id: "step1",
		run: () => {
			executionLog.push("step1");
			return Task.Result.make.ok(10);
		},
	});

	const step2 = Graph.node({
		id: "step2",
		deps: { prev: step1 },
		run: ({ prev }) => {
			executionLog.push("step2");
			return Task.Result.make.ok(prev * 2);
		},
	});

	const step3 = Graph.node({
		id: "step3",
		deps: { prev: step2 },
		run: ({ prev }) => {
			executionLog.push("step3");
			return Task.Result.make.ok(prev + 5);
		},
	});

	const graph = Graph.make(step3);
	const outcome = await Graph.run(graph)();

	expect(outcome).toStrictEqual(Result.make.ok(25));
	expect(executionLog).toStrictEqual(["step1", "step2", "step3"]);
});

test("run: executes diamond dependency shared ancestor exactly once", async () => {
	let rootExecutions = 0;

	const rootNode = Graph.node({
		id: "root",
		run: () => {
			rootExecutions++;
			return Task.Result.make.ok({ userId: "u123" });
		},
	});

	const branchANode = Graph.node({
		id: "branchA",
		deps: { root: rootNode },
		run: ({ root }) => Task.Result.make.ok(`Role of ${root.userId}`),
	});

	const branchBNode = Graph.node({
		id: "branchB",
		deps: { root: rootNode },
		run: ({ root }) => Task.Result.make.ok(`Balance of ${root.userId}`),
	});

	const sinkNode = Graph.node({
		id: "sink",
		deps: { branchA: branchANode, branchB: branchBNode },
		run: ({ branchA, branchB }) => Task.Result.make.ok(`${branchA} and ${branchB}`),
	});

	const graph = Graph.make(sinkNode);
	const outcome = await Graph.run(graph)();

	expect(rootExecutions).toBe(1);
	expect(outcome).toStrictEqual(Result.make.ok("Role of u123 and Balance of u123"));
});

// -----------------------------------------------------------------------------
// Sibling Cancellation & Fault Isolation
// -----------------------------------------------------------------------------

test("run: short-circuits on node failure and aborts in-flight sibling tasks", async () => {
	let siblingAborted = false;

	const rootNode = Graph.node({ id: "root", run: () => Task.Result.make.ok("start") });

	const failingBranchNode = Graph.node({
		id: "failing",
		deps: { root: rootNode },
		run: () => Task.delay(Duration.milliseconds(10))(Task.Result.make.err("network_failure")),
	});

	const slowSiblingNode = Graph.node({
		id: "slowSibling",
		deps: { root: rootNode },
		run: () => (signal) => {
			signal?.addEventListener("abort", () => {
				siblingAborted = true;
			});
			return Task.delay(Duration.milliseconds(100))(Task.Result.make.ok("never_reached"))(signal);
		},
	});

	const sinkNode = Graph.node({
		id: "sink",
		deps: { failingBranch: failingBranchNode, slowSibling: slowSiblingNode },
		run: ({ failingBranch, slowSibling }) => Task.Result.make.ok(`${failingBranch} ${slowSibling}`),
	});

	const graph = Graph.make(sinkNode);
	const outcome = await Graph.run(graph)();

	expect(outcome).toStrictEqual(Result.make.err("network_failure"));
	expect(siblingAborted).toBe(true);
});

test("run: catches thrown exception in node run and settles as Result.err", async () => {
	const crashingNode = Graph.node({
		id: "crashing",
		run: () => {
			throw new Error("unexpected crash");
		},
	});

	const graph = Graph.make(crashingNode);
	const outcome = await Graph.run(graph)();

	expect(Result.is.err(outcome)).toBe(true);
	expect(outcome).toStrictEqual(Result.make.err(expect.objectContaining({ message: "unexpected crash" })));
});

// -----------------------------------------------------------------------------
// Caller AbortSignal & Concurrency Bounding
// -----------------------------------------------------------------------------

test("run: cancels execution when caller AbortSignal triggers and settles with reason", async () => {
	const controller = new AbortController();
	let nodeAborted = false;

	const slowNode = Graph.node({
		id: "slow",
		run: () => (signal) => {
			signal?.addEventListener("abort", () => {
				nodeAborted = true;
			});
			return Task.delay(Duration.milliseconds(200))(Task.Result.make.ok("done"))(signal);
		},
	});

	const graph = Graph.make(slowNode);
	const taskPromise = Graph.run(graph)(controller.signal);

	setTimeout(() => {
		controller.abort("caller cancelled");
	}, 20);

	const outcome = await taskPromise;
	expect(outcome).toStrictEqual(Result.make.err("caller cancelled"));
	expect(nodeAborted).toBe(true);
});

test("run: limits concurrent in-flight nodes when concurrency option is provided", async () => {
	let activeCount = 0;
	let maxConcurrent = 0;

	const makeConcurrentStep = (id: string) =>
		Graph.node({
			id,
			run: () =>
				Task.Result.tryCatch(async () => {
					activeCount++;
					maxConcurrent = Math.max(maxConcurrent, activeCount);
					await new Promise((resolve) => setTimeout(resolve, 25));
					activeCount--;
					return id;
				}, { onError: String }),
		});

	const step1 = makeConcurrentStep("s1");
	const step2 = makeConcurrentStep("s2");
	const step3 = makeConcurrentStep("s3");
	const step4 = makeConcurrentStep("s4");

	const sink = Graph.node({ id: "sink", deps: { step1, step2, step3, step4 }, run: Task.Result.make.ok });

	const graph = Graph.make(sink);
	const outcome = await Graph.run(graph, { concurrency: 2 })();

	expect(Result.is.ok(outcome)).toBe(true);
	expect(maxConcurrent).toBeLessThanOrEqual(2);
});

// -----------------------------------------------------------------------------
// Timeout and Retry Integration
// -----------------------------------------------------------------------------

test("node: applies retry policy on transient failure", async () => {
	let attempts = 0;

	const retryingNode = Graph.node({
		id: "retrying",
		retry: RetryPolicy.constant({ attempts: 3, delay: Duration.milliseconds(5) }),
		run: () =>
			Task.Result.tryCatch(async () => {
				attempts++;
				if (attempts < 3) {
					throw new Error("transient_error");
				}
				await Promise.resolve();
				return "recovered";
			}, { onError: (e) => (e instanceof Error ? e.message : String(e)) }),
	});

	const graph = Graph.make(retryingNode);
	const outcome = await Graph.run(graph)();

	expect(attempts).toBe(3);
	expect(outcome).toStrictEqual(Result.make.ok("recovered"));
});

test("node: applies timeout policy when execution exceeds duration", async () => {
	const slowNode = Graph.node({
		id: "slow",
		timeout: { duration: Duration.milliseconds(15), onTimeout: () => "timed_out" as const },
		run: () => Task.delay(Duration.milliseconds(80))(Task.Result.make.ok("finished")),
	});

	const graph = Graph.make(slowNode);
	const outcome = await Graph.run(graph)();

	expect(outcome).toStrictEqual(Result.make.err("timed_out"));
});

// -----------------------------------------------------------------------------
// Pipeline Composition & Boundary Tests
// -----------------------------------------------------------------------------

test("run: returns Err if graph instance is invalid", async () => {
	// @ts-expect-error — invalid graph instance
	const result = await Graph.run(null)();
	expect(Result.is.err(result)).toBe(true);
});

test("run: immediately aborts if caller signal is already aborted", async () => {
	const controller = new AbortController();
	controller.abort("pre-aborted");

	let executed = false;
	const node = Graph.node({
		id: "step",
		run: () => (signal) => {
			if (signal?.aborted) {
				return Task.Result.make.err("already_aborted")(signal);
			}
			executed = true;
			return Task.Result.make.ok("success")(signal);
		},
	});

	const graph = Graph.make(node);
	const outcome = await Graph.run(graph)(controller.signal);

	expect(Result.is.err(outcome)).toBe(true);
	expect(outcome).toStrictEqual(Result.make.err("pre-aborted"));
	expect(executed).toBe(false);
});

test("run: removes abort listener from caller signal upon graph completion", async () => {
	const controller = new AbortController();
	let removed = false;
	const originalRemove = controller.signal.removeEventListener;
	controller.signal.removeEventListener = (...args: Parameters<AbortSignal["removeEventListener"]>) => {
		if (args[0] === "abort") {
			removed = true;
		}
		return originalRemove.apply(controller.signal, args);
	};

	const node = Graph.node({ id: "n", run: () => Task.Result.make.ok("success") });
	const graph = Graph.make(node);

	const outcome = await Graph.run(graph)(controller.signal);
	expect(outcome).toStrictEqual(Result.make.ok("success"));
	expect(removed).toBe(true);
});

test("run: removes abort listener from caller signal upon graph failure", async () => {
	const controller = new AbortController();
	let removed = false;
	const originalRemove = controller.signal.removeEventListener;
	controller.signal.removeEventListener = (...args: Parameters<AbortSignal["removeEventListener"]>) => {
		if (args[0] === "abort") {
			removed = true;
		}
		return originalRemove.apply(controller.signal, args);
	};

	const node = Graph.node({ id: "failing", run: () => Task.Result.make.err("err") });
	const graph = Graph.make(node);

	const outcome = await Graph.run(graph)(controller.signal);
	expect(outcome).toStrictEqual(Result.make.err("err"));
	expect(removed).toBe(true);
});

test("run: handles non-integer and negative concurrency options gracefully", async () => {
	const node1 = Graph.node({ id: "n1", run: () => Task.Result.make.ok(1) });
	const node2 = Graph.node({ id: "n2", run: () => Task.Result.make.ok(2) });
	const sink = Graph.node({
		id: "sink",
		deps: { node1, node2 },
		run: (deps) => Task.Result.make.ok(deps.node1 + deps.node2),
	});

	const graph = Graph.make(sink);

	const r1 = await Graph.run(graph, { concurrency: 1.5 })();
	expect(r1).toStrictEqual(Result.make.ok(3));

	const r2 = await Graph.run(graph, { concurrency: NaN })();
	expect(r2).toStrictEqual(Result.make.ok(3));

	const r3 = await Graph.run(graph, { concurrency: -1 })();
	expect(r3).toStrictEqual(Result.make.ok(3));

	const r4 = await Graph.run(graph, { concurrency: 0 })();
	expect(r4).toStrictEqual(Result.make.ok(3));
});

test("run: preserves side-effect isolation so downstream nodes never execute on upstream failure", async () => {
	let downstreamExecuted = false;

	const failingNode = Graph.node({ id: "failing", run: () => Task.Result.make.err("failure") });
	const downstreamNode = Graph.node({
		id: "downstream",
		deps: { prev: failingNode },
		run: () => {
			downstreamExecuted = true;
			return Task.Result.make.ok("never_executed");
		},
	});

	const graph = Graph.make(downstreamNode);
	const outcome = await Graph.run(graph)();

	expect(outcome).toStrictEqual(Result.make.err("failure"));
	expect(downstreamExecuted).toBe(false);
});

test("run: handles concurrent settlement and ignores redundant drains", async () => {
	const step1 = Graph.node({ id: "s1", run: () => Task.delay(Duration.milliseconds(10))(Task.Result.make.err("err1")) });
	const step2 = Graph.node({ id: "s2", run: () => Task.delay(Duration.milliseconds(10))(Task.Result.make.err("err2")) });
	const step3 = Graph.node({ id: "s3", run: () => Task.delay(Duration.milliseconds(25))(Task.Result.make.ok("ok3")) });
	const sink = Graph.node({ id: "sink", deps: { step1, step2, step3 }, run: Task.Result.make.ok });

	const graph = Graph.make(sink);
	const outcome = await Graph.run(graph)();
	expect(Result.is.err(outcome)).toBe(true);
});

test("composition: composes with Task.Result operators in pipelines", async () => {
	const stepANode = Graph.node({ id: "a", run: () => Task.Result.make.ok(10) });
	const stepB = Graph.node({ id: "b", deps: { stepA: stepANode }, run: ({ stepA }) => Task.Result.make.ok(stepA * 3) });

	const graph = Graph.make(stepB);

	const outcome = await pipe(Graph.run(graph, { concurrency: 1 }), Task.Result.map((val) => `Result: ${val}`))();

	expect(outcome).toStrictEqual(Result.make.ok("Result: 30"));
});
