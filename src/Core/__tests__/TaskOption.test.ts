import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Option } from "../Option.ts";
import { Task } from "../Task.ts";
import { TaskOption } from "../TaskOption.ts";

// ---------------------------------------------------------------------------
// of
// ---------------------------------------------------------------------------

test("TaskOption.some creates a Task that resolves to Some", async () => {
	expect(await TaskOption.some(42)()).toEqual({ kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// none
// ---------------------------------------------------------------------------

test("TaskOption.none creates a Task that resolves to None", async () => {
	expect(await TaskOption.none()()).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromOption
// ---------------------------------------------------------------------------

test("TaskOption.fromOption lifts Some into a Task", async () => {
	expect(await TaskOption.fromOption(Option.some(10))()).toEqual({
		kind: "Some",
		value: 10,
	});
});

test("TaskOption.fromOption lifts None into a Task", async () => {
	expect(await TaskOption.fromOption(Option.none())()).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromTask
// ---------------------------------------------------------------------------

test("TaskOption.fromTask wraps a Task result in Some", async () => {
	const task = Task.resolve(5);
	expect(await TaskOption.fromTask(task)()).toEqual({ kind: "Some", value: 5 });
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test(
	"TaskOption.tryCatch returns Some when Promise resolves",
	async () => {
		expect(await TaskOption.tryCatch(() => Promise.resolve(99))()).toEqual({
			kind: "Some",
			value: 99,
		});
	},
);

test("TaskOption.tryCatch returns None when Promise rejects", async () => {
	expect(await TaskOption.tryCatch(() => Promise.reject(new Error("boom")))()).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("TaskOption.map transforms Some value", async () => {
	expect(
		await pipe(
			TaskOption.some(5),
			TaskOption.map((n: number) => n * 2),
		)(),
	).toEqual({ kind: "Some", value: 10 });
});

test("TaskOption.map passes through None unchanged", async () => {
	expect(
		await pipe(
			TaskOption.none<number>(),
			TaskOption.map((n: number) => n * 2),
		)(),
	).toEqual({ kind: "None" });
});

test("TaskOption.map can change the value type", async () => {
	expect(
		await pipe(
			TaskOption.some(7),
			TaskOption.map((n: number) => `val:${n}`),
		)(),
	).toEqual({ kind: "Some", value: "val:7" });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("TaskOption.chain applies function when Some", async () => {
	const result = await pipe(
		TaskOption.some(5),
		TaskOption.chain((n: number) => TaskOption.some(n * 2)),
	)();
	expect(result).toEqual({ kind: "Some", value: 10 });
});

test(
	"TaskOption.chain propagates None without calling function",
	async () => {
		let called = false;
		await pipe(
			TaskOption.none<number>(),
			TaskOption.chain((_n: number) => {
				called = true;
				return TaskOption.some(_n);
			}),
		)();
		expect(called).toBe(false);
	},
);

test(
	"TaskOption.chain returns None when function returns None",
	async () => {
		expect(
			await pipe(
				TaskOption.some(5),
				TaskOption.chain((_n: number) => TaskOption.none()),
			)(),
		).toEqual({ kind: "None" });
	},
);

test("TaskOption.chain composes multiple async steps", async () => {
	const result = await pipe(
		TaskOption.some(1),
		TaskOption.chain((n: number) => TaskOption.some(n + 1)),
		TaskOption.chain((n: number) => TaskOption.some(n * 10)),
	)();
	expect(result).toEqual({ kind: "Some", value: 20 });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("TaskOption.ap applies Some function to Some value", async () => {
	const result = await pipe(
		TaskOption.some((n: number) => n * 3),
		TaskOption.ap(TaskOption.some(4)),
	)();
	expect(result).toEqual({ kind: "Some", value: 12 });
});

test("TaskOption.ap returns None when function is None", async () => {
	expect(
		await pipe(
			TaskOption.none<(n: number) => number>(),
			TaskOption.ap(TaskOption.some(4)),
		)(),
	).toEqual({ kind: "None" });
});

test("TaskOption.ap returns None when argument is None", async () => {
	expect(
		await pipe(
			TaskOption.some((n: number) => n * 3),
			TaskOption.ap(TaskOption.none<number>()),
		)(),
	).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("TaskOption.fold calls onSome for Some", async () => {
	expect(
		await pipe(
			TaskOption.some(5),
			TaskOption.fold(
				() => "none",
				(n: number) => `some:${n}`,
			),
		)(),
	).toBe("some:5");
});

test("TaskOption.fold calls onNone for None", async () => {
	expect(
		await pipe(
			TaskOption.none(),
			TaskOption.fold(
				() => "none",
				(n: number) => `some:${n}`,
			),
		)(),
	).toBe("none");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("TaskOption.match calls some handler for Some", async () => {
	expect(
		await pipe(
			TaskOption.some(5),
			TaskOption.match({
				some: (n: number) => `got:${n}`,
				none: () => "empty",
			}),
		)(),
	).toBe("got:5");
});

test("TaskOption.match calls none handler for None", async () => {
	expect(
		await pipe(
			TaskOption.none(),
			TaskOption.match({
				some: (n: number) => `got:${n}`,
				none: () => "empty",
			}),
		)(),
	).toBe("empty");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("TaskOption.getOrElse returns value for Some", async () => {
	expect(await pipe(TaskOption.some(5), TaskOption.getOrElse(() => 0))()).toBe(5);
});

test("TaskOption.getOrElse returns default for None", async () => {
	expect(await pipe(TaskOption.none<number>(), TaskOption.getOrElse(() => 0))()).toBe(0);
});

test("TaskOption.getOrElse widens return type to A | B when default is a different type", async () => {
	const result = await pipe(TaskOption.none(), TaskOption.getOrElse(() => null))();
	expect(result).toBeNull();
});

test("TaskOption.getOrElse returns Some value typed as A | B when Some", async () => {
	const result = await pipe(TaskOption.some(5), TaskOption.getOrElse(() => null))();
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test(
	"TaskOption.tap executes side effect on Some and returns original",
	async () => {
		let seen = 0;
		const result = await pipe(
			TaskOption.some(5),
			TaskOption.tap((n: number) => {
				seen = n;
			}),
		)();
		expect(seen).toBe(5);
		expect(result).toEqual({ kind: "Some", value: 5 });
	},
);

test("TaskOption.tap does not execute side effect on None", async () => {
	let called = false;
	await pipe(
		TaskOption.none(),
		TaskOption.tap(() => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("TaskOption.filter keeps Some when predicate passes", async () => {
	expect(
		await pipe(
			TaskOption.some(5),
			TaskOption.filter((n: number) => n > 3),
		)(),
	).toEqual({ kind: "Some", value: 5 });
});

test("TaskOption.filter returns None when predicate fails", async () => {
	expect(
		await pipe(
			TaskOption.some(2),
			TaskOption.filter((n: number) => n > 3),
		)(),
	).toEqual({ kind: "None" });
});

test("TaskOption.filter passes through None unchanged", async () => {
	expect(
		await pipe(
			TaskOption.none<number>(),
			TaskOption.filter((_n) => true),
		)(),
	).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// toTaskResult
// ---------------------------------------------------------------------------

test("TaskOption.toTaskResult returns Ok for Some", async () => {
	expect(
		await pipe(
			TaskOption.some(42),
			TaskOption.toTaskResult(() => "missing"),
		)(),
	).toEqual({ kind: "Ok", value: 42 });
});

test(
	"TaskOption.toTaskResult returns Err for None using onNone",
	async () => {
		expect(
			await pipe(
				TaskOption.none<number>(),
				TaskOption.toTaskResult(() => "missing"),
			)(),
		).toEqual({ kind: "Error", error: "missing" });
	},
);

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("TaskOption composes well in a pipe chain", async () => {
	const result = await pipe(
		TaskOption.some(5),
		TaskOption.map((n: number) => n * 2),
		TaskOption.filter((n: number) => n > 5),
		TaskOption.chain((n: number) => TaskOption.some(n + 1)),
		TaskOption.getOrElse(() => 0),
	)();
	expect(result).toBe(11);
});

test("TaskOption pipe short-circuits on None", async () => {
	const result = await pipe(
		TaskOption.some(2),
		TaskOption.filter((n: number) => n > 5),
		TaskOption.map((n: number) => n * 10),
		TaskOption.getOrElse(() => 0),
	)();
	expect(result).toBe(0);
});
