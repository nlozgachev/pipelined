import { expect, test } from "vitest";
import { Arr } from "../../Data/Arr.ts";
import { Dict } from "../../Data/Dict.ts";
import { Duration } from "../../Types/Duration.ts";
import { Batcher } from "../Batcher.ts";
import { Deferred } from "../Deferred.ts";
import { Result } from "../Result.ts";

test("make: resolves single key lookups successfully as BatcherOk", async () => {
	const batcher = Batcher.make({
		fetch: (keys: readonly string[]) => () =>
			Deferred.from.Promise(Promise.resolve(Result.make.ok(new Map(keys.map((k) => [k, `user_${k}`]))))),
	});

	const outcome = await batcher.load("1");
	expect(outcome).toStrictEqual(Batcher.Outcome.make.ok("user_1"));
	expect(Batcher.Outcome.is.ok(outcome)).toBe(true);
});

test("make: coalesces multiple concurrent calls in same microtask into a single batch query", async () => {
	let queryCount = 0;
	let requestedKeys: readonly string[] = [];

	const batcher = Batcher.make({
		fetch: (keys: readonly string[]) => () => {
			queryCount++;
			requestedKeys = keys;
			const map = new Map<string, number>();
			for (let i = 0; i < keys.length; i++) {
				map.set(keys[i], Number(keys[i]) * 10);
			}
			return Deferred.from.Promise(Promise.resolve(Result.make.ok(map)));
		},
	});

	const [res1, res2, res3] = await Promise.all([
		Deferred.to.Promise(batcher.load("1")),
		Deferred.to.Promise(batcher.load("2")),
		Deferred.to.Promise(batcher.load("3")),
	]);

	expect(queryCount).toBe(1);
	expect(requestedKeys).toStrictEqual(["1", "2", "3"]);
	expect(res1).toStrictEqual(Batcher.Outcome.make.ok(10));
	expect(res2).toStrictEqual(Batcher.Outcome.make.ok(20));
	expect(res3).toStrictEqual(Batcher.Outcome.make.ok(30));
});

test("make: deduplicates identical keys requested within the same turn", async () => {
	let fetchCallCount = 0;
	let receivedKeys: readonly string[] = [];

	const batcher = Batcher.make({
		fetch: (keys: readonly string[]) => () => {
			fetchCallCount++;
			receivedKeys = keys;
			const map = new Map<string, string>();
			for (let i = 0; i < keys.length; i++) {
				map.set(keys[i], `value_${keys[i]}`);
			}
			return Deferred.from.Promise(Promise.resolve(Result.make.ok(map)));
		},
	});

	const [r1, r2, r3, r4] = await Promise.all([
		Deferred.to.Promise(batcher.load("a")),
		Deferred.to.Promise(batcher.load("a")),
		Deferred.to.Promise(batcher.load("b")),
		Deferred.to.Promise(batcher.load("a")),
	]);

	expect(fetchCallCount).toBe(1);
	expect(receivedKeys).toStrictEqual(["a", "b"]);
	expect(r1).toStrictEqual(Batcher.Outcome.make.ok("value_a"));
	expect(r2).toStrictEqual(Batcher.Outcome.make.ok("value_a"));
	expect(r3).toStrictEqual(Batcher.Outcome.make.ok("value_b"));
	expect(r4).toStrictEqual(Batcher.Outcome.make.ok("value_a"));
});

test("make: missing key resolves to BatcherMissing without throwing or erroring", async () => {
	const batcher = Batcher.make({
		fetch: (_keys: readonly string[]) => () =>
			Deferred.from.Promise(Promise.resolve(Result.make.ok(new Map([["exists", 42]])))),
	});

	const [found, missing] = await Promise.all([
		Deferred.to.Promise(batcher.load("exists")),
		Deferred.to.Promise(batcher.load("absent")),
	]);

	expect(found).toStrictEqual(Batcher.Outcome.make.ok(42));
	expect(missing).toStrictEqual(Batcher.Outcome.make.missing("absent"));
	expect(Batcher.Outcome.is.missing(missing)).toBe(true);
});

test("make: batch-level fetch failure fails all waiting callers with BatcherErr", async () => {
	type NetworkError = { readonly kind: "NetworkError"; readonly code: number; };

	const batcher = Batcher.make({
		fetch: (_keys: readonly string[]) => () =>
			Deferred.from.Promise(Promise.resolve(Result.make.err<NetworkError>({ kind: "NetworkError", code: 503 }))),
	});

	const [r1, r2] = await Promise.all([Deferred.to.Promise(batcher.load("x")), Deferred.to.Promise(batcher.load("y"))]);

	expect(r1).toStrictEqual(Batcher.Outcome.make.err({ kind: "NetworkError", code: 503 }));
	expect(r2).toStrictEqual(Batcher.Outcome.make.err({ kind: "NetworkError", code: 503 }));
	expect(Batcher.Outcome.is.err(r1)).toBe(true);
});

test("make: supports structural composite keys via serializeKey", async () => {
	type CompositeKey = { readonly orgId: string; readonly memberId: string; };
	let dispatchedKeys: readonly CompositeKey[] = [];

	const batcher = Batcher.make({
		fetch: (keys: readonly CompositeKey[]) => () => {
			dispatchedKeys = keys;
			const map = new Map<CompositeKey, string>();
			for (let i = 0; i < keys.length; i++) {
				map.set(keys[i], `role_for_${keys[i].orgId}_${keys[i].memberId}`);
			}
			return Deferred.from.Promise(Promise.resolve(Result.make.ok(map)));
		},
		serializeKey: (k) => `${k.orgId}:${k.memberId}`,
	});

	const key1a: CompositeKey = { orgId: "org1", memberId: "m1" };
	const key1b: CompositeKey = { orgId: "org1", memberId: "m1" };
	const key2: CompositeKey = { orgId: "org2", memberId: "m2" };

	const [r1, r2, r3] = await Promise.all([
		Deferred.to.Promise(batcher.load(key1a)),
		Deferred.to.Promise(batcher.load(key1b)),
		Deferred.to.Promise(batcher.load(key2)),
	]);

	expect(dispatchedKeys).toHaveLength(2);
	expect(r1).toStrictEqual(Batcher.Outcome.make.ok("role_for_org1_m1"));
	expect(r2).toStrictEqual(Batcher.Outcome.make.ok("role_for_org1_m1"));
	expect(r3).toStrictEqual(Batcher.Outcome.make.ok("role_for_org2_m2"));
});

test("make: chunks large batches when maxBatchSize is exceeded", async () => {
	const batches: (readonly number[])[] = [];

	const batcher = Batcher.make({
		fetch: (keys: readonly number[]) => () => {
			batches.push(keys);
			const map = new Map<number, number>();
			for (let i = 0; i < keys.length; i++) {
				map.set(keys[i], keys[i] * 2);
			}
			return Deferred.from.Promise(Promise.resolve(Result.make.ok(map)));
		},
		maxBatchSize: 2,
	});

	const promises = [
		Deferred.to.Promise(batcher.load(1)),
		Deferred.to.Promise(batcher.load(2)),
		Deferred.to.Promise(batcher.load(3)),
		Deferred.to.Promise(batcher.load(4)),
		Deferred.to.Promise(batcher.load(5)),
	];

	const results = await Promise.all(promises);

	expect(batches).toStrictEqual([[1, 2], [3, 4], [5]]);
	expect(results).toStrictEqual([
		Batcher.Outcome.make.ok(2),
		Batcher.Outcome.make.ok(4),
		Batcher.Outcome.make.ok(6),
		Batcher.Outcome.make.ok(8),
		Batcher.Outcome.make.ok(10),
	]);
});

test("make: bounds concurrent chunk execution via concurrency option", async () => {
	let activeRunning = 0;
	let peakRunning = 0;

	const batcher = Batcher.make({
		fetch: (keys: readonly number[]) => () => {
			activeRunning++;
			if (activeRunning > peakRunning) {
				peakRunning = activeRunning;
			}
			return Deferred.from.Promise(
				new Promise<Result<never, ReadonlyMap<number, number>>>((resolve) => {
					setTimeout(() => {
						activeRunning--;
						const map = new Map(keys.map((k) => [k, k * 10]));
						resolve(Result.make.ok(map));
					}, 10);
				}),
			);
		},
		maxBatchSize: 2,
		concurrency: 2,
	});

	const promises = [
		Deferred.to.Promise(batcher.load(1)),
		Deferred.to.Promise(batcher.load(2)),
		Deferred.to.Promise(batcher.load(3)),
		Deferred.to.Promise(batcher.load(4)),
		Deferred.to.Promise(batcher.load(5)),
		Deferred.to.Promise(batcher.load(6)),
	];

	const results = await Promise.all(promises);

	expect(peakRunning).toBe(2);
	expect(results).toHaveLength(6);
});

test("make: window delays batch dispatch until Duration elapses", async () => {
	let dispatchedAt = 0;
	const startTime = Date.now();

	const batcher = Batcher.make({
		fetch: (keys: readonly string[]) => () => {
			dispatchedAt = Date.now();
			return Deferred.from.Promise(Promise.resolve(Result.make.ok(new Map(keys.map((k) => [k, k])))));
		},
		window: Duration.milliseconds(25),
	});

	const resultPromise = Deferred.to.Promise(batcher.load("delayed"));
	await resultPromise;

	expect(dispatchedAt - startTime).toBeGreaterThanOrEqual(20);
});

test("flush: forces queued batches to dispatch and settle immediately", async () => {
	let fetched = false;

	const batcher = Batcher.make({
		fetch: (keys: readonly string[]) => () => {
			fetched = true;
			return Deferred.from.Promise(Promise.resolve(Result.make.ok(new Map(keys.map((k) => [k, k.toUpperCase()])))));
		},
		window: Duration.seconds(10),
	});

	const loadPromise = Deferred.to.Promise(batcher.load("fast"));

	expect(fetched).toBe(false);

	await batcher.flush();
	expect(fetched).toBe(true);

	const res = await loadPromise;
	expect(res).toStrictEqual(Batcher.Outcome.make.ok("FAST"));
});

test("flush: is safe and idempotent when queue is empty", async () => {
	const batcher = Batcher.make({ fetch: () => () => Deferred.from.Promise(Promise.resolve(Result.make.ok(new Map()))) });

	await expect(Deferred.to.Promise(batcher.flush())).resolves.toBeUndefined();
});

test("loadMany: loads multiple keys and preserves discrete outcomes in input order", async () => {
	const batcher = Batcher.make({
		fetch: (_keys: readonly string[]) => () =>
			Deferred.from.Promise(Promise.resolve(Result.make.ok(new Map([["a", 10], ["c", 30]])))),
	});

	const res = await batcher.loadMany(["a", "b", "c"]);
	expect(res).toStrictEqual([
		Batcher.Outcome.make.ok(10),
		Batcher.Outcome.make.missing("b"),
		Batcher.Outcome.make.ok(30),
	]);
});

test("loadMany: returns empty array immediately if input keys array is empty", async () => {
	let fetchCalled = false;

	const batcher = Batcher.make({
		fetch: () => () => {
			fetchCalled = true;
			return Deferred.from.Promise(Promise.resolve(Result.make.ok(new Map())));
		},
	});

	const res = await batcher.loadMany([]);
	expect(fetchCalled).toBe(false);
	expect(res).toStrictEqual([]);
});

test("Outcome.match: correctly matches ok, missing, and err cases", () => {
	const okOutcome = Batcher.Outcome.make.ok("hello");
	const missingOutcome = Batcher.Outcome.make.missing("missing_id");
	const errOutcome = Batcher.Outcome.make.err(new Error("Boom"));

	const matcher = Batcher.Outcome.match({
		ok: (v) => `value:${v}`,
		missing: (k) => `missing:${k}`,
		err: (e: Error) => `err:${e.message}`,
	});

	expect(matcher(okOutcome)).toBe("value:hello");
	expect(matcher(missingOutcome)).toBe("missing:missing_id");
	expect(matcher(errOutcome)).toBe("err:Boom");
});

test("Outcome.map: transforms value on ok and leaves missing and err untouched", () => {
	const ok = Batcher.Outcome.make.ok(10);
	const missing = Batcher.Outcome.make.missing("k");
	const err = Batcher.Outcome.make.err("e");

	const double = Batcher.Outcome.map((n: number) => n * 2);

	expect(double(ok)).toStrictEqual(Batcher.Outcome.make.ok(20));
	expect(double(missing)).toStrictEqual(missing);
	expect(double(err)).toStrictEqual(err);

	let called = false;
	const isolatingMapper = Batcher.Outcome.map((n: number) => {
		called = true;
		return n * 2;
	});
	isolatingMapper(missing);
	expect(called).toBe(false);
	isolatingMapper(err);
	expect(called).toBe(false);
});

test("Outcome.mapError: transforms error on err and leaves ok and missing untouched", () => {
	const ok = Batcher.Outcome.make.ok(10);
	const missing = Batcher.Outcome.make.missing("k");
	const err = Batcher.Outcome.make.err("bad");

	const upperErr = Batcher.Outcome.mapError((s: string) => s.toUpperCase());

	expect(upperErr(ok)).toStrictEqual(ok);
	expect(upperErr(missing)).toStrictEqual(missing);
	expect(upperErr(err)).toStrictEqual(Batcher.Outcome.make.err("BAD"));

	let called = false;
	const isolatingMapper = Batcher.Outcome.mapError((s: string) => {
		called = true;
		return s.toUpperCase();
	});
	isolatingMapper(ok);
	expect(called).toBe(false);
	isolatingMapper(missing);
	expect(called).toBe(false);
});

test("Outcome.getOrElse: returns value or fallback with side-effect isolation on ok", () => {
	const ok = Batcher.Outcome.make.ok(10);
	const missing = Batcher.Outcome.make.missing("k");
	const err = Batcher.Outcome.make.err("bad");

	const fallback = Batcher.Outcome.getOrElse(() => 99);

	expect(fallback(ok)).toBe(10);
	expect(fallback(missing)).toBe(99);
	expect(fallback(err)).toBe(99);

	let called = false;
	const isolatingFallback = Batcher.Outcome.getOrElse(() => {
		called = true;
		return 99;
	});
	expect(isolatingFallback(ok)).toBe(10);
	expect(called).toBe(false);
});

test("Outcome.to.Result: projects missing into domain error and preserves ok and err with side-effect isolation", () => {
	const ok = Batcher.Outcome.make.ok("data");
	const missing = Batcher.Outcome.make.missing("key_1");
	const err = Batcher.Outcome.make.err("db_down");

	const toRes = Batcher.Outcome.to.Result((k) => `missing_${k}`);

	expect(toRes(ok)).toStrictEqual(Result.make.ok("data"));
	expect(toRes(missing)).toStrictEqual(Result.make.err("missing_key_1"));
	expect(toRes(err)).toStrictEqual(Result.make.err("db_down"));

	let called = false;
	const isolatingToRes = Batcher.Outcome.to.Result((k: string) => {
		called = true;
		return `missing_${k}`;
	});
	isolatingToRes(ok);
	expect(called).toBe(false);
	isolatingToRes(err);
	expect(called).toBe(false);
});

test("Outcome.to.Maybe: converts Ok to Some and both Missing and Err to None", () => {
	const ok = Batcher.Outcome.make.ok("data");
	const missing = Batcher.Outcome.make.missing("k");
	const err = Batcher.Outcome.make.err("e");

	expect(Batcher.Outcome.to.Maybe(ok)).toStrictEqual({ kind: "Some", value: "data" });
	expect(Batcher.Outcome.to.Maybe(missing)).toStrictEqual({ kind: "None" });
	expect(Batcher.Outcome.to.Maybe(err)).toStrictEqual({ kind: "None" });
});

test("Outcome.to.nullable: converts Ok to V and both Missing and Err to null", () => {
	const ok = Batcher.Outcome.make.ok("data");
	const missing = Batcher.Outcome.make.missing("k");
	const err = Batcher.Outcome.make.err("e");

	expect(Batcher.Outcome.to.nullable(ok)).toBe("data");
	expect(Batcher.Outcome.to.nullable(missing)).toBeNull();
	expect(Batcher.Outcome.to.nullable(err)).toBeNull();
});

test("AbortSignal: immediately settles with BatcherErr if caller signal is pre-aborted", async () => {
	const controller = new AbortController();
	controller.abort(new Error("PreAborted"));

	const batcher = Batcher.make({ fetch: () => () => Deferred.from.Promise(Promise.resolve(Result.make.ok(new Map()))) });

	const res = await batcher.load("k", controller.signal);
	expect(res).toStrictEqual(Batcher.Outcome.make.err(controller.signal.reason));
});

test("AbortSignal: isolates aborted caller while sibling callers in batch settle normally", async () => {
	const controller = new AbortController();

	const batcher = Batcher.make({
		fetch: (keys: readonly string[]) => () =>
			Deferred.from.Promise(
				new Promise<Result<never, ReadonlyMap<string, string>>>((resolve) => {
					setTimeout(() => {
						resolve(Result.make.ok(new Map(keys.map((k) => [k, `val_${k}`]))));
					}, 15);
				}),
			),
	});

	const caller1Promise = Deferred.to.Promise(batcher.load("k1", controller.signal));
	const caller2Promise = Deferred.to.Promise(batcher.load("k2"));

	controller.abort(new Error("Caller1Aborted"));

	const [res1, res2] = await Promise.all([caller1Promise, caller2Promise]);

	expect(Batcher.Outcome.is.err(res1)).toBe(true);
	expect(res2).toStrictEqual(Batcher.Outcome.make.ok("val_k2"));
});

test("AbortSignal: skips batch fetch if all callers abort before execution", async () => {
	let fetchCalled = false;
	const c1 = new AbortController();
	const c2 = new AbortController();

	const batcher = Batcher.make({
		fetch: () => () => {
			fetchCalled = true;
			return Deferred.from.Promise(Promise.resolve(Result.make.ok(new Map())));
		},
		window: Duration.milliseconds(20),
	});

	const p1 = Deferred.to.Promise(batcher.load("a", c1.signal));
	const p2 = Deferred.to.Promise(batcher.load("b", c2.signal));

	c1.abort();
	c2.abort();

	await Promise.all([p1, p2]);
	await new Promise((r) => setTimeout(r, 30));

	expect(fetchCalled).toBe(false);
});

test("AbortSignal: skips chunk execution if all callers in a queued chunk abort while waiting", async () => {
	let executedChunks = 0;
	const c = new AbortController();

	const batcher = Batcher.make({
		fetch: (keys: readonly number[]) => () => {
			executedChunks++;
			return Deferred.from.Promise(
				new Promise<Result<never, ReadonlyMap<number, number>>>((resolve) => {
					setTimeout(() => {
						const map = new Map(keys.map((k) => [k, k]));
						resolve(Result.make.ok(map));
					}, 20);
				}),
			);
		},
		maxBatchSize: 1,
		concurrency: 1,
	});

	const p1 = batcher.load(1);
	const p2 = batcher.load(2, c.signal);

	// Abort caller in chunk 2 while chunk 1 is in flight:
	c.abort(new Error("Chunk2Aborted"));

	const [res1, res2] = await Promise.all([p1, p2]);

	expect(res1).toStrictEqual(Batcher.Outcome.make.ok(1));
	expect(res2).toStrictEqual(Batcher.Outcome.make.err(c.signal.reason));
	expect(executedChunks).toBe(1);
});

test("real-world: relational entity workflow using Arr.indexBy", async () => {
	type User = { readonly id: string; readonly name: string; };
	const dbUsers: readonly User[] = [{ id: "u1", name: "Alice" }, { id: "u2", name: "Bob" }];

	const userBatcher = Batcher.make({
		fetch: (ids: readonly string[]) => () =>
			Deferred.from.Promise(Promise.resolve(Result.make.ok(
				Arr.indexBy((u: User) => u.id)(dbUsers.filter((u) =>
					ids.includes(u.id)
				)),
			))),
	});

	const [alice, missing] = await Promise.all([
		Deferred.to.Promise(userBatcher.load("u1")),
		Deferred.to.Promise(userBatcher.load("u3")),
	]);

	expect(alice).toStrictEqual(Batcher.Outcome.make.ok({ id: "u1", name: "Alice" }));
	expect(missing).toStrictEqual(Batcher.Outcome.make.missing("u3"));
});

test("real-world: one-to-many relation workflow using Dict.groupBy", async () => {
	type Comment = { readonly id: string; readonly postId: string; readonly text: string; };
	const dbComments: readonly Comment[] = [{ id: "c1", postId: "p1", text: "Great post!" }, {
		id: "c2",
		postId: "p1",
		text: "Thanks!",
	}, { id: "c3", postId: "p2", text: "Nice" }];

	const commentsBatcher = Batcher.make({
		fetch: (postIds: readonly string[]) => () =>
			Deferred.from.Promise(Promise.resolve(Result.make.ok(
				Dict.groupBy((c: Comment) => c.postId)(dbComments.filter((c) =>
					postIds.includes(c.postId)
				)),
			))),
	});

	const [p1Comments, p3Comments] = await Promise.all([
		Deferred.to.Promise(commentsBatcher.load("p1")),
		Deferred.to.Promise(commentsBatcher.load("p3")),
	]);

	expect(p1Comments).toStrictEqual(
		Batcher.Outcome.make.ok([{ id: "c1", postId: "p1", text: "Great post!" }, {
			id: "c2",
			postId: "p1",
			text: "Thanks!",
		}]),
	);
	expect(p3Comments).toStrictEqual(Batcher.Outcome.make.missing("p3"));
});

test("boundary: maxBatchSize and concurrency handle non-integers, NaN, and negative values safely", async () => {
	const batches: (readonly number[])[] = [];
	const batcher = Batcher.make({
		fetch: (keys: readonly number[]) => () => {
			batches.push(keys);
			const map = new Map(keys.map((k) => [k, k * 2]));
			return Deferred.from.Promise(Promise.resolve(Result.make.ok(map)));
		},
		maxBatchSize: 1.5,
		concurrency: NaN,
	});

	await Promise.all([batcher.load(1), batcher.load(2), batcher.load(3)]);

	expect(batches).toHaveLength(1);
	expect(batches[0]).toStrictEqual([1, 2, 3]);

	const batches2: (readonly number[])[] = [];
	const batcher2 = Batcher.make({
		fetch: (keys: readonly number[]) => () => {
			batches2.push(keys);
			const map = new Map(keys.map((k) => [k, k * 2]));
			return Deferred.from.Promise(Promise.resolve(Result.make.ok(map)));
		},
		maxBatchSize: -5,
		concurrency: 0,
	});

	await Promise.all([batcher2.load(10), batcher2.load(20)]);

	expect(batches2).toHaveLength(1);
	expect(batches2[0]).toStrictEqual([10, 20]);
});

test("boundary: handles falsy keys and falsy values without conflation", async () => {
	const batcher = Batcher.make({
		fetch: (_keys: readonly (string | number | boolean)[]) => () => {
			const map = new Map<(string | number | boolean), (string | number | boolean)>([["", "empty_str_val"], [0, false], [
				false,
				0,
			]]);
			return Deferred.from.Promise(Promise.resolve(Result.make.ok(map)));
		},
	});

	const [emptyStr, zeroVal, falseVal, absent] = await Promise.all([
		batcher.load(""),
		batcher.load(0),
		batcher.load(false),
		batcher.load("non_existent"),
	]);

	expect(emptyStr).toStrictEqual(Batcher.Outcome.make.ok("empty_str_val"));
	expect(zeroVal).toStrictEqual(Batcher.Outcome.make.ok(false));
	expect(falseVal).toStrictEqual(Batcher.Outcome.make.ok(0));
	expect(absent).toStrictEqual(Batcher.Outcome.make.missing("non_existent"));
});

test("AbortSignal: deduplicated key where one caller aborts in queue while sibling caller proceeds", async () => {
	const c = new AbortController();
	const batcher = Batcher.make({
		fetch: (keys: readonly string[]) => () =>
			Deferred.from.Promise(Promise.resolve(Result.make.ok(new Map(keys.map((k) => [k, `res_${k}`]))))),
	});

	const p1 = batcher.load("shared", c.signal);
	const p2 = batcher.load("shared");

	// Abort caller 1 before microtask flush while caller 2 remains
	c.abort(new Error("P1Cancelled"));

	const [res1, res2] = await Promise.all([p1, p2]);

	expect(Batcher.Outcome.is.err(res1)).toBe(true);
	expect(res2).toStrictEqual(Batcher.Outcome.make.ok("res_shared"));
});

test("AbortSignal: handles abort with undefined reason", async () => {
	const fakeSignal = {
		aborted: true,
		reason: undefined,
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
		onabort: null,
		throwIfAborted: () => {},
	};

	const batcher = Batcher.make({ fetch: () => () => Deferred.from.Promise(Promise.resolve(Result.make.ok(new Map()))) });

	const res = await batcher.load("k", fakeSignal);
	expect(res).toStrictEqual(Batcher.Outcome.make.err(new Error("Aborted")));
});
