import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Task } from "../Task.ts";
import { TaskMaybe } from "../TaskMaybe.ts";

// ---------------------------------------------------------------------------
// of
// ---------------------------------------------------------------------------

test("TaskMaybe.some creates a Task that resolves to Some", async () => {
	expect(await TaskMaybe.some(42)()).toEqual({ kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// none
// ---------------------------------------------------------------------------

test("TaskMaybe.none creates a Task that resolves to None", async () => {
	expect(await TaskMaybe.none()()).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromMaybe
// ---------------------------------------------------------------------------

test("TaskMaybe.fromMaybe lifts Some into a Task", async () => {
	expect(await TaskMaybe.fromMaybe(Maybe.some(10))()).toEqual({
		kind: "Some",
		value: 10,
	});
});

test("TaskMaybe.fromMaybe lifts None into a Task", async () => {
	expect(await TaskMaybe.fromMaybe(Maybe.none())()).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromTask
// ---------------------------------------------------------------------------

test("TaskMaybe.fromTask wraps a Task result in Some", async () => {
	const task = Task.resolve(5);
	expect(await TaskMaybe.fromTask(task)()).toEqual({ kind: "Some", value: 5 });
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test(
	"TaskMaybe.tryCatch returns Some when Promise resolves",
	async () => {
		expect(await TaskMaybe.tryCatch(() => Promise.resolve(99))()).toEqual({
			kind: "Some",
			value: 99,
		});
	},
);

test("TaskMaybe.tryCatch returns None when Promise rejects", async () => {
	expect(await TaskMaybe.tryCatch(() => Promise.reject(new Error("boom")))()).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("TaskMaybe.map transforms Some value", async () => {
	expect(
		await pipe(
			TaskMaybe.some(5),
			TaskMaybe.map((n: number) => n * 2),
		)(),
	).toEqual({ kind: "Some", value: 10 });
});

test("TaskMaybe.map passes through None unchanged", async () => {
	expect(
		await pipe(
			TaskMaybe.none<number>(),
			TaskMaybe.map((n: number) => n * 2),
		)(),
	).toEqual({ kind: "None" });
});

test("TaskMaybe.map can change the value type", async () => {
	expect(
		await pipe(
			TaskMaybe.some(7),
			TaskMaybe.map((n: number) => `val:${n}`),
		)(),
	).toEqual({ kind: "Some", value: "val:7" });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("TaskMaybe.chain applies function when Some", async () => {
	const result = await pipe(
		TaskMaybe.some(5),
		TaskMaybe.chain((n: number) => TaskMaybe.some(n * 2)),
	)();
	expect(result).toEqual({ kind: "Some", value: 10 });
});

test(
	"TaskMaybe.chain propagates None without calling function",
	async () => {
		let called = false;
		await pipe(
			TaskMaybe.none<number>(),
			TaskMaybe.chain((_n: number) => {
				called = true;
				return TaskMaybe.some(_n);
			}),
		)();
		expect(called).toBe(false);
	},
);

test(
	"TaskMaybe.chain returns None when function returns None",
	async () => {
		expect(
			await pipe(
				TaskMaybe.some(5),
				TaskMaybe.chain((_n: number) => TaskMaybe.none()),
			)(),
		).toEqual({ kind: "None" });
	},
);

test("TaskMaybe.chain composes multiple async steps", async () => {
	const result = await pipe(
		TaskMaybe.some(1),
		TaskMaybe.chain((n: number) => TaskMaybe.some(n + 1)),
		TaskMaybe.chain((n: number) => TaskMaybe.some(n * 10)),
	)();
	expect(result).toEqual({ kind: "Some", value: 20 });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("TaskMaybe.ap applies Some function to Some value", async () => {
	const result = await pipe(
		TaskMaybe.some((n: number) => n * 3),
		TaskMaybe.ap(TaskMaybe.some(4)),
	)();
	expect(result).toEqual({ kind: "Some", value: 12 });
});

test("TaskMaybe.ap returns None when function is None", async () => {
	expect(
		await pipe(
			TaskMaybe.none<(n: number) => number>(),
			TaskMaybe.ap(TaskMaybe.some(4)),
		)(),
	).toEqual({ kind: "None" });
});

test("TaskMaybe.ap returns None when argument is None", async () => {
	expect(
		await pipe(
			TaskMaybe.some((n: number) => n * 3),
			TaskMaybe.ap(TaskMaybe.none<number>()),
		)(),
	).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("TaskMaybe.fold calls onSome for Some", async () => {
	expect(
		await pipe(
			TaskMaybe.some(5),
			TaskMaybe.fold(
				() => "none",
				(n: number) => `some:${n}`,
			),
		)(),
	).toBe("some:5");
});

test("TaskMaybe.fold calls onNone for None", async () => {
	expect(
		await pipe(
			TaskMaybe.none(),
			TaskMaybe.fold(
				() => "none",
				(n: number) => `some:${n}`,
			),
		)(),
	).toBe("none");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("TaskMaybe.match calls some handler for Some", async () => {
	expect(
		await pipe(
			TaskMaybe.some(5),
			TaskMaybe.match({
				some: (n: number) => `got:${n}`,
				none: () => "empty",
			}),
		)(),
	).toBe("got:5");
});

test("TaskMaybe.match calls none handler for None", async () => {
	expect(
		await pipe(
			TaskMaybe.none(),
			TaskMaybe.match({
				some: (n: number) => `got:${n}`,
				none: () => "empty",
			}),
		)(),
	).toBe("empty");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("TaskMaybe.getOrElse returns value for Some", async () => {
	expect(await pipe(TaskMaybe.some(5), TaskMaybe.getOrElse(() => 0))()).toBe(5);
});

test("TaskMaybe.getOrElse returns default for None", async () => {
	expect(await pipe(TaskMaybe.none<number>(), TaskMaybe.getOrElse(() => 0))()).toBe(0);
});

test("TaskMaybe.getOrElse widens return type to A | B when default is a different type", async () => {
	const result = await pipe(TaskMaybe.none(), TaskMaybe.getOrElse(() => null))();
	expect(result).toBeNull();
});

test("TaskMaybe.getOrElse returns Some value typed as A | B when Some", async () => {
	const result = await pipe(TaskMaybe.some(5), TaskMaybe.getOrElse(() => null))();
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test(
	"TaskMaybe.tap executes side effect on Some and returns original",
	async () => {
		let seen = 0;
		const result = await pipe(
			TaskMaybe.some(5),
			TaskMaybe.tap((n: number) => {
				seen = n;
			}),
		)();
		expect(seen).toBe(5);
		expect(result).toEqual({ kind: "Some", value: 5 });
	},
);

test("TaskMaybe.tap does not execute side effect on None", async () => {
	let called = false;
	await pipe(
		TaskMaybe.none(),
		TaskMaybe.tap(() => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("TaskMaybe.filter keeps Some when predicate passes", async () => {
	expect(
		await pipe(
			TaskMaybe.some(5),
			TaskMaybe.filter((n: number) => n > 3),
		)(),
	).toEqual({ kind: "Some", value: 5 });
});

test("TaskMaybe.filter returns None when predicate fails", async () => {
	expect(
		await pipe(
			TaskMaybe.some(2),
			TaskMaybe.filter((n: number) => n > 3),
		)(),
	).toEqual({ kind: "None" });
});

test("TaskMaybe.filter passes through None unchanged", async () => {
	expect(
		await pipe(
			TaskMaybe.none<number>(),
			TaskMaybe.filter((_n) => true),
		)(),
	).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// toTaskResult
// ---------------------------------------------------------------------------

test("TaskMaybe.toTaskResult returns Ok for Some", async () => {
	expect(
		await pipe(
			TaskMaybe.some(42),
			TaskMaybe.toTaskResult(() => "missing"),
		)(),
	).toEqual({ kind: "Ok", value: 42 });
});

test(
	"TaskMaybe.toTaskResult returns Err for None using onNone",
	async () => {
		expect(
			await pipe(
				TaskMaybe.none<number>(),
				TaskMaybe.toTaskResult(() => "missing"),
			)(),
		).toEqual({ kind: "Error", error: "missing" });
	},
);

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("TaskMaybe composes well in a pipe chain", async () => {
	const result = await pipe(
		TaskMaybe.some(5),
		TaskMaybe.map((n: number) => n * 2),
		TaskMaybe.filter((n: number) => n > 5),
		TaskMaybe.chain((n: number) => TaskMaybe.some(n + 1)),
		TaskMaybe.getOrElse(() => 0),
	)();
	expect(result).toBe(11);
});

test("TaskMaybe pipe short-circuits on None", async () => {
	const result = await pipe(
		TaskMaybe.some(2),
		TaskMaybe.filter((n: number) => n > 5),
		TaskMaybe.map((n: number) => n * 10),
		TaskMaybe.getOrElse(() => 0),
	)();
	expect(result).toBe(0);
});
