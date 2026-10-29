import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { Duration } from "../../Types/Duration.ts";
import { RetryPolicy } from "../../Types/RetryPolicy.ts";
import { Graph } from "../Graph.ts";
import { Task } from "../Task.ts";

test("node: infers standalone root node types", () => {
	const userNode = Graph.node({
		id: "user",
		run: () =>
			constTruthyBool() ? Task.Result.make.ok({ id: "u1", name: "Alice" }) : Task.Result.make.err("user_err" as const),
	});

	expectTypeOf(userNode).toEqualTypeOf<Graph.Node<"user", "user_err", { id: string; name: string; }>>();

	// @ts-expect-error — run must return Task.Result, not raw number
	Graph.node({ id: "bad", run: () => 42 });

	// @ts-expect-error — deps must be an object map of nodes
	Graph.node({ id: "bad", deps: "not_an_object", run: () => Task.Result.make.ok(1) });
});

test("node: infers contextual dependency outputs and accumulates error unions", () => {
	const user = Graph.node({
		id: "user",
		run: () =>
			constTruthyBool() ? Task.Result.make.ok({ id: "u1", roleId: "admin" }) : Task.Result.make.err("e_user" as const),
	});

	const config = Graph.node({
		id: "config",
		run: () => constTruthyBool() ? Task.Result.make.ok({ region: "us-east" }) : Task.Result.make.err("e_config" as const),
	});

	const permissions = Graph.node({
		id: "permissions",
		deps: { user },
		run: (deps) => {
			expectTypeOf(deps.user).toEqualTypeOf<{ id: string; roleId: string; }>();
			return constTruthyBool() ? Task.Result.make.ok(["read", "write"]) : Task.Result.make.err("e_perm" as const);
		},
	});

	expectTypeOf(permissions).toEqualTypeOf<Graph.Node<"permissions", "e_perm" | "e_user", string[]>>();

	const summary = Graph.node({
		id: "summary",
		deps: { user, config, permissions },
		timeout: { duration: Duration.seconds(5), onTimeout: () => "e_timeout" as const },
		run: (deps) => {
			expectTypeOf(deps.user).toEqualTypeOf<{ id: string; roleId: string; }>();
			expectTypeOf(deps.config).toEqualTypeOf<{ region: string; }>();
			expectTypeOf(deps.permissions).toEqualTypeOf<string[]>();
			return Task.Result.make.ok({ count: deps.permissions.length });
		},
	});

	expectTypeOf(summary).toEqualTypeOf<
		Graph.Node<"summary", "e_timeout" | "e_user" | "e_config" | "e_perm", { count: number; }>
	>();
});

test("make & run: compiles and preserves error and output channels", () => {
	const user = Graph.node({
		id: "user",
		run: () => constTruthyBool() ? Task.Result.make.ok({ id: "u1" }) : Task.Result.make.err("e_user" as const),
	});

	const perms = Graph.node({
		id: "perms",
		deps: { user },
		run: () => constTruthyBool() ? Task.Result.make.ok(["admin"]) : Task.Result.make.err("e_perm" as const),
	});

	const graph = Graph.make(perms);
	expectTypeOf(graph).toEqualTypeOf<Graph<"e_perm" | "e_user", string[]>>();

	const task = Graph.run(graph);
	expectTypeOf(task).toEqualTypeOf<Task.Result<"e_perm" | "e_user", string[]>>();

	const taskWithConcurrency = Graph.run(graph, { concurrency: 2 });
	expectTypeOf(taskWithConcurrency).toEqualTypeOf<Task.Result<"e_perm" | "e_user", string[]>>();

	const taskWithTelemetry = Graph.run(graph, {
		concurrency: 2,
		onRetry: (event) => {
			expectTypeOf(event.nodeId).toEqualTypeOf<string>();
			expectTypeOf(event.attempt).toEqualTypeOf<number>();
			expectTypeOf(event.error).toEqualTypeOf<unknown>();
			expectTypeOf(event.delay).toEqualTypeOf<Duration>();
		},
	});
	expectTypeOf(taskWithTelemetry).toEqualTypeOf<Task.Result<"e_perm" | "e_user", string[]>>();

	const retryingNode = Graph.node({
		id: "with-retry",
		retry: RetryPolicy.constant<"e_retry">({
			attempts: 3,
			delay: Duration.seconds(1),
			when: (err) => err === "e_retry",
			onRetry: (event) => {
				expectTypeOf(event.attempt).toEqualTypeOf<number>();
				expectTypeOf(event.error).toEqualTypeOf<"e_retry">();
				expectTypeOf(event.delay).toEqualTypeOf<Duration>();
			},
		}),
		run: () => constTruthyBool() ? Task.Result.make.ok("success") : Task.Result.make.err("e_retry" as const),
	});
	expectTypeOf(retryingNode).toEqualTypeOf<Graph.Node<"with-retry", "e_retry", string>>();

	// @ts-expect-error — target must be a Graph.Node
	Graph.make("not_a_node");

	// @ts-expect-error — run expects a Graph instance
	Graph.run("not_a_graph");

	// @ts-expect-error — retry must be a valid RetryPolicy
	Graph.node({ id: "bad_retry_1", retry: 123, run: () => Task.Result.make.ok(1) });

	// @ts-expect-error — retry must have attempts
	Graph.node({ id: "bad_retry_2", retry: { getDelay: () => Duration.seconds(1) }, run: () => Task.Result.make.ok(1) });
});
