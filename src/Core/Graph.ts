import type { WithKind } from "../internal/InternalTypes";
import type { Duration } from "../Types/Duration.ts";
import type { RetryPolicy } from "../Types/RetryPolicy.ts";
import { Deferred } from "./Deferred.ts";
import { Result } from "./Result.ts";
import { Task } from "./Task.ts";

// =============================================================================
// Phantom Brand Symbols
// =============================================================================
declare const _nodeBrand: unique symbol;
declare const _graphBrand: unique symbol;

const _internalNode = Symbol("Graph.internalNode");
const _internalGraph = Symbol("Graph.internalGraph");

// =============================================================================
// Public Types
// =============================================================================

/**
 * Represents a compiled, validated Directed Acyclic Graph plan rooted at a target sink node.
 *
 * Pre-computes topological execution tiers and guarantees acyclicity.
 */
export type Graph<E = unknown, Out = unknown> = WithKind<"Graph"> & {
	readonly [_graphBrand]: { readonly _error: () => E; readonly _output: () => Out; };
};

export namespace Graph {
	/**
	 * Represents a distinct, typed node in a Directed Acyclic Graph (DAG).
	 *
	 * Each node encapsulates a unique identifier, an asynchronous computation,
	 * typed dependencies on upstream nodes, and optional resilience policies (timeout, retry).
	 */
	export type Node<Id extends string = string, E = unknown, Out = unknown> = WithKind<"GraphNode"> & {
		readonly id: Id;
		readonly [_nodeBrand]: { readonly _error: () => E; readonly _output: () => Out; };
	};

	/**
	 * Matches any valid `Node` instance regardless of generic parameters.
	 */
	export type AnyNode = Node<string, any, any>;

	/**
	 * Extracts the successful output value type of a `Node`.
	 */
	export type OutputOf<N> = N extends Node<any, any, infer Out> ? Out : never;

	/**
	 * Extracts the error type of a `Node`.
	 */
	export type ErrorOf<N> = N extends Node<any, infer E, any> ? E : never;

	/**
	 * Maps an object dictionary of dependency nodes to their resolved output value types.
	 */
	export type DepsOutputs<Deps extends Record<string, AnyNode>> = { readonly [K in keyof Deps]: OutputOf<Deps[K]>; };

	/**
	 * Computes the union of error types across all dependency nodes in a dictionary.
	 */
	export type DepsErrors<Deps extends Record<string, AnyNode>> = Deps[keyof Deps] extends Node<any, infer E, any> ? E
		: never;

	/**
	 * Configuration options for constructing a DAG node.
	 */
	export type NodeConfig<Id extends string, Deps extends Record<string, AnyNode> | undefined, E, Out, ETimeout = never> =
		{
			/**
			 * Unique string identifier for the node within the graph.
			 */
			readonly id: Id;

			/**
			 * Upstream dependency nodes required to execute this step.
			 */
			readonly deps?: Deps;

			/**
			 * Maximum duration permitted for execution before short-circuiting with `onTimeout`.
			 */
			readonly timeout?: { readonly duration: Duration; readonly onTimeout: () => ETimeout; };

			/**
			 * Retry policy governing transient failure retries before failing the node.
			 */
			readonly retry?: RetryPolicy<E>;

			/**
			 * Execution task evaluating to a fallible `Task.Result`.
			 */
			readonly run: [Deps] extends [Record<string, AnyNode>] ? (dependencies: DepsOutputs<Deps>) => Task.Result<E, Out>
				: () => Task.Result<E, Out>;
		};

	/**
	 * Telemetry metadata emitted when any node in the graph initiates a retry attempt.
	 */
	export type RunRetryMetadata = RetryPolicy.Metadata<unknown> & { readonly nodeId: string; };

	/**
	 * Options configuring DAG execution pacing and telemetry.
	 */
	export type RunOptions = {
		/**
		 * Maximum number of asynchronous tasks permitted to execute concurrently.
		 * Defaults to `Infinity` (unbounded concurrency across all satisfied branches).
		 */
		readonly concurrency?: number;

		/**
		 * Global hook fired whenever any node in the graph initiates a retry attempt.
		 *
		 * @example
		 * ```ts
		 * const outcome = await Graph.run(graph, {
		 *   onRetry: ({ nodeId, attempt, error, delay }) => {
		 *     console.warn(`[${nodeId}] attempt ${attempt} failed: ${error}`);
		 *   },
		 * })();
		 * ```
		 */
		readonly onRetry?: (metadata: RunRetryMetadata) => void;
	};
}

// =============================================================================
// Internal Representations
// =============================================================================

type InternalNodeState = {
	readonly id: string;
	readonly deps: Readonly<Record<string, Graph.AnyNode>> | undefined;
	readonly run: (deps: Record<string, unknown>) => Task.Result<unknown, unknown>;
	readonly timeout?: { readonly duration: Duration; readonly onTimeout: () => unknown; };
	readonly retry?: RetryPolicy<any>;
};

type InternalNode<Id extends string, E, Out> = Graph.Node<Id, E, Out> & {
	readonly [_internalNode]: InternalNodeState;
};

type InternalGraphState = {
	readonly target: Graph.AnyNode;
	readonly nodes: readonly Graph.AnyNode[];
	readonly rootNodes: readonly Graph.AnyNode[];
	readonly dependentsMap: Map<Graph.AnyNode, Graph.AnyNode[]>;
	readonly dependencyCountMap: Map<Graph.AnyNode, number>;
	readonly depKeysMap: Map<Graph.AnyNode, readonly [string, Graph.AnyNode][]>;
};

type InternalGraph<E, Out> = Graph<E, Out> & { readonly [_internalGraph]: InternalGraphState; };

const toInternalNode = <Id extends string, E, Out>(node: Graph.Node<Id, E, Out>): InternalNode<Id, E, Out> =>
	node as unknown as InternalNode<Id, E, Out>;

const toInternalGraph = <E, Out>(graph: Graph<E, Out>): InternalGraph<E, Out> =>
	graph as unknown as InternalGraph<E, Out>;

// =============================================================================
// Public Constructors & Combinators
// =============================================================================

/**
 * Creates an individual node descriptor for inclusion in a DAG.
 *
 * Dependencies are declared as an object dictionary of upstream nodes.
 * The `run` callback contextually receives the strongly typed outputs of those dependencies.
 *
 * @see {@link Graph.make} to compile declared nodes into a validated execution graph.
 * @see {@link Graph.run} for executing compiled graphs.
 *
 * @example
 * ```ts
 * const user = Graph.node({
 *   id: "user",
 *   run: () => fetchUser("u_1"),
 * });
 *
 * const permissions = Graph.node({
 *   id: "permissions",
 *   deps: { user },
 *   run: ({ user }) => fetchPermissions(user.roleId),
 * });
 * ```
 */
const makeNode = <
	Id extends string,
	const Deps extends Record<string, Graph.AnyNode> | undefined,
	E,
	Out,
	ETimeout = never,
>(
	config: Graph.NodeConfig<Id, Deps, E, Out, ETimeout>,
): Graph.Node<
	Id,
	E | ETimeout | ([Deps] extends [Record<string, Graph.AnyNode>] ? Graph.DepsErrors<Deps> : never),
	Out
> => {
	if (!config || typeof config.id !== "string" || config.id.length === 0) {
		throw new TypeError("[Graph.node] A non-empty string 'id' is required.");
	}

	if (typeof config.run !== "function") {
		throw new TypeError(`[Graph.node] Node '${config.id}' requires a 'run' function.`);
	}

	if (config.deps !== undefined) {
		if (typeof config.deps !== "object" || config.deps === null || Array.isArray(config.deps)) {
			throw new TypeError(`[Graph.node] Node '${config.id}' deps must be an object map of GraphNode instances.`);
		}
		for (const [depKey, depNode] of Object.entries(config.deps)) {
			if (depNode === null || depNode === undefined || (depNode as { readonly kind?: unknown; }).kind !== "GraphNode") {
				throw new TypeError(
					`[Graph.node] Dependency '${depKey}' in node '${config.id}' is invalid. Expected a GraphNode instance, but received ${
						String(depNode)
					}.`,
				);
			}
		}
	}

	const nodeObj = {
		kind: "GraphNode" as const,
		id: config.id,
		[_internalNode]: {
			id: config.id,
			deps: config.deps ? Object.freeze({ ...config.deps }) : undefined,
			run: config.run as any,
			timeout: config.timeout,
			retry: config.retry,
		},
	};

	return nodeObj as unknown as Graph.Node<
		Id,
		E | ETimeout | ([Deps] extends [Record<string, Graph.AnyNode>] ? Graph.DepsErrors<Deps> : never),
		Out
	>;
};

/**
 * Compiles a target sink node into an immutable, validated `Graph` plan.
 *
 * Validates acyclicity using Kahn's algorithm at compilation time and pre-computes
 * reverse-dependency adjacency lists for optimal runtime scheduling throughput.
 *
 * @see {@link Graph.node} for defining upstream DAG nodes.
 * @see {@link Graph.run} for executing compiled graphs.
 *
 * @example
 * ```ts
 * const dashboardGraph = Graph.make(summaryNode);
 * ```
 */
const makeGraph = <Id extends string, E, Out>(target: Graph.Node<Id, E, Out>): Graph<E, Out> => {
	if (!target || (target as { readonly kind?: unknown; }).kind !== "GraphNode") {
		throw new TypeError("[Graph.make] Expected a valid GraphNode instance as target.");
	}

	const anyTarget = target as Graph.AnyNode;
	const reachableSet = new Set<Graph.AnyNode>();
	const seenIds = new Map<string, Graph.AnyNode>();
	const stack: Graph.AnyNode[] = [anyTarget];

	const dependentsMap = new Map<Graph.AnyNode, Graph.AnyNode[]>();
	const dependencyCountMap = new Map<Graph.AnyNode, number>();
	const inDegrees = new Map<Graph.AnyNode, number>();
	const depKeysMap = new Map<Graph.AnyNode, readonly [string, Graph.AnyNode][]>();
	const readyQueue: Graph.AnyNode[] = [];

	// 1. Single-pass discovery: DFS reachability traversal, ID uniqueness check,
	// dependency count initialization, dependents adjacency building, and root node identification:
	while (stack.length > 0) {
		const current = stack.pop()!;
		if (!reachableSet.has(current)) {
			const existing = seenIds.get(current.id);
			if (existing !== undefined && existing !== current) {
				throw new Error(
					`[Graph.make] Duplicate node id '${current.id}' detected. Every node in a Graph must have a unique id.`,
				);
			}
			seenIds.set(current.id, current);
			reachableSet.add(current);

			if (!dependentsMap.has(current)) {
				dependentsMap.set(current, []);
			}

			const internal = toInternalNode(current)[_internalNode];
			if (internal.deps) {
				const entries = Object.entries(internal.deps) as readonly [string, Graph.AnyNode][];
				depKeysMap.set(current, entries);
				const count = entries.length;
				dependencyCountMap.set(current, count);
				inDegrees.set(current, count);

				if (count === 0) {
					readyQueue.push(current);
				} else {
					for (let i = 0; i < count; i++) {
						const [, depNode] = entries[i];
						let depList = dependentsMap.get(depNode);
						if (depList === undefined) {
							depList = [];
							dependentsMap.set(depNode, depList);
						}
						depList.push(current);
						stack.push(depNode);
					}
				}
			} else {
				depKeysMap.set(current, []);
				dependencyCountMap.set(current, 0);
				inDegrees.set(current, 0);
				readyQueue.push(current);
			}
		}
	}

	const rootNodes = Object.freeze(readyQueue.slice());

	// 2. Kahn's Algorithm for cycle validation & topological sorting:
	let head = 0;
	while (head < readyQueue.length) {
		const current = readyQueue[head++];
		const dependents = dependentsMap.get(current)!;
		for (let i = 0; i < dependents.length; i++) {
			const dep = dependents[i];
			const rem = inDegrees.get(dep)! - 1;
			inDegrees.set(dep, rem);
			if (rem === 0) {
				readyQueue.push(dep);
			}
		}
	}

	if (readyQueue.length !== reachableSet.size) {
		throw new Error(
			`[Graph.make] Cycle detected in Graph targeting node '${target.id}'. Dependencies must form a Directed Acyclic Graph.`,
		);
	}

	const graphObj = {
		kind: "Graph" as const,
		[_internalGraph]: {
			target: anyTarget,
			nodes: Object.freeze(readyQueue),
			rootNodes,
			dependentsMap,
			dependencyCountMap,
			depKeysMap,
		},
	};

	return graphObj as unknown as Graph<E, Out>;
};

/**
 * Executes a compiled Graph within a managed execution context, returning an infallible lazy `Task.Result`.
 *
 * Maximizes concurrency across independent branches while guaranteeing that diamond dependencies
 * execute exactly once. If any node fails or throws, all remaining in-flight sibling tasks are
 * immediately aborted via an internal `AbortController`.
 *
 * @see {@link Graph.make} to compile a target node into a validated graph.
 * @see {@link Graph.node} for defining upstream DAG nodes.
 *
 * @example
 * ```ts
 * const outcome = await Graph.run(dashboardGraph, { concurrency: 4 })();
 * ```
 */
const runGraph = <E, Out>(graph: Graph<E, Out>, options?: Graph.RunOptions): Task.Result<E, Out> => (callerSignal) =>
	Deferred.from.Promise(
		new Promise<Result<E, Out>>((resolve) => {
			if (!graph || (graph as { readonly kind?: unknown; }).kind !== "Graph") {
				resolve(Result.make.err(new TypeError("[Graph.run] Expected a valid Graph instance.") as E));
				return;
			}

			const internal = toInternalGraph(graph)[_internalGraph];
			const { target, rootNodes, dependentsMap, dependencyCountMap, depKeysMap } = internal;

			const internalController = new AbortController();
			const activeSignal = internalController.signal;

			const results = new Map<Graph.AnyNode, unknown>();
			const remainingDeps = new Map<Graph.AnyNode, number>(dependencyCountMap);
			const queue: Graph.AnyNode[] = rootNodes.slice();
			let queueHead = 0;
			let inFlight = 0;
			let isSettled = false;

			// oxlint-disable-next-line prefer-const
			let onCallerAbort: () => void;

			const settle = (result: Result<E, Out>): void => {
				if (isSettled) {
					return;
				}
				isSettled = true;
				if (callerSignal) {
					callerSignal.removeEventListener("abort", onCallerAbort);
				}
				internalController.abort();
				resolve(result);
			};

			if (callerSignal) {
				const signal = callerSignal;
				onCallerAbort = () => {
					settle(Result.make.err(signal.reason as E));
				};

				if (signal.aborted) {
					onCallerAbort();
					return;
				}
				signal.addEventListener("abort", onCallerAbort, { once: true });
			}

			const concurrency =
				options?.concurrency !== undefined && Number.isInteger(options.concurrency) && options.concurrency > 0
					? options.concurrency
					: Infinity;

			// oxlint-disable-next-line prefer-const
			let drain: () => void;

			const executeNode = async (node: Graph.AnyNode): Promise<void> => {
				const nodeInternal = toInternalNode(node)[_internalNode];

				// Assemble resolved inputs:
				const depEntries = depKeysMap.get(node);
				let inputs: Record<string, unknown> | undefined;
				if (depEntries && depEntries.length > 0) {
					inputs = {};
					for (let i = 0; i < depEntries.length; i++) {
						const [key, depNode] = depEntries[i];
						inputs[key] = results.get(depNode);
					}
				}

				try {
					let task = nodeInternal.run(inputs ?? {});

					const retryPolicy = nodeInternal.retry;
					if (retryPolicy) {
						const graphOnRetry = options?.onRetry;
						const nodeOnRetry = retryPolicy.onRetry;

						const policy: RetryPolicy<unknown> = graphOnRetry !== undefined
							? {
								...retryPolicy,
								onRetry: (event) => {
									if (nodeOnRetry) {
										try {
											nodeOnRetry(event);
										} catch {
											// Isolated: node-level telemetry error does not disrupt retry
										}
									}
									try {
										graphOnRetry({ ...event, nodeId: node.id });
									} catch {
										// Isolated: graph-level telemetry error does not disrupt retry
									}
								},
							}
							: retryPolicy;

						task = Task.Result.retry(policy)(task);
					}
					if (nodeInternal.timeout) {
						task = Task.Result.timeout(nodeInternal.timeout as any)(task);
					}

					const nodeOutcome = await Deferred.to.Promise(task(activeSignal));

					inFlight--;

					if (Result.is.ok(nodeOutcome)) {
						results.set(node, nodeOutcome.value);

						if (node === target) {
							settle(Result.make.ok(nodeOutcome.value as Out));
							return;
						}

						const dependents = dependentsMap.get(node)!;
						for (let i = 0; i < dependents.length; i++) {
							const dep = dependents[i];
							const rem = remainingDeps.get(dep)! - 1;
							remainingDeps.set(dep, rem);
							if (rem === 0) {
								queue.push(dep);
							}
						}

						drain();
					} else {
						settle(Result.make.err(nodeOutcome.error as E));
					}
				} catch (thrown) {
					inFlight--;
					settle(Result.make.err(thrown as E));
				}
			};

			drain = (): void => {
				if (isSettled) {
					return;
				}

				while (queueHead < queue.length && inFlight < concurrency) {
					const node = queue[queueHead++];
					inFlight++;
					void executeNode(node);
				}
			};

			drain();
		}),
	);

// =============================================================================
// Public Module Export
// =============================================================================

/**
 * Directed Acyclic Graph (DAG) task orchestration module.
 *
 * Provides declarative step definition with dependency tracking, compile-time acyclicity verification,
 * automatic diamond-dependency deduplication, bounded concurrency, and immediate sibling cancellation.
 */
export const Graph = { node: makeNode, make: makeGraph, run: runGraph };
