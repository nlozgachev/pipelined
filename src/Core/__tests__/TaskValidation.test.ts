import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Deferred } from "../Deferred.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { TaskValidation } from "../TaskValidation.ts";
import { Validation } from "../Validation.ts";

// ---------------------------------------------------------------------------
// valid
// ---------------------------------------------------------------------------

test("TaskValidation.passed creates a Task that resolves to Valid", async () => {
	await expect(TaskValidation.passed<string, number>(42)()).resolves.toStrictEqual({ kind: "Passed", value: 42 });
});

// ---------------------------------------------------------------------------
// invalid
// ---------------------------------------------------------------------------

test("TaskValidation.failed creates a Task that resolves to Invalid with one error", async () => {
	await expect(TaskValidation.failed<string, number>("bad")()).resolves.toStrictEqual({
		kind: "Failed",
		errors: ["bad"],
	});
});

// ---------------------------------------------------------------------------
// invalidAll
// ---------------------------------------------------------------------------

test("TaskValidation.failedAll creates a Task that resolves to Invalid with multiple errors", async () => {
	await expect(TaskValidation.failedAll<string, number>(["err1", "err2"])()).resolves.toStrictEqual({
		kind: "Failed",
		errors: ["err1", "err2"],
	});
});

// ---------------------------------------------------------------------------
// fromValidation
// ---------------------------------------------------------------------------

test("TaskValidation.fromValidation lifts a Valid into a Task", async () => {
	await expect(TaskValidation.fromValidation(Validation.passed<string, number>(5))()).resolves.toStrictEqual({
		kind: "Passed",
		value: 5,
	});
});

test("TaskValidation.fromValidation lifts an Invalid into a Task", async () => {
	await expect(TaskValidation.fromValidation(Validation.failed("e"))()).resolves.toStrictEqual({
		kind: "Failed",
		errors: ["e"],
	});
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("TaskValidation.tryCatch returns Valid when Promise resolves", async () => {
	await expect(TaskValidation.tryCatch(() => Promise.resolve(42), (e) => String(e))()).resolves.toStrictEqual({
		kind: "Passed",
		value: 42,
	});
});

test("TaskValidation.tryCatch returns Invalid when Promise rejects", async () => {
	await expect(TaskValidation.tryCatch(() => Promise.reject(new Error("boom")), (e) => (e as Error).message)()).resolves
		.toStrictEqual({ kind: "Failed", errors: ["boom"] });
});

test("TaskValidation.tryCatch catches async throws", async () => {
	await expect(
		TaskValidation.tryCatch(
			// eslint-disable-next-line require-await
			async () => {
				throw new Error("bang");
			},
			(e) => (e as Error).message,
		)(),
	).resolves.toStrictEqual({ kind: "Failed", errors: ["bang"] });
});

test("TaskValidation.tryCatch receives the AbortSignal from the call site", async () => {
	let receivedSignal: AbortSignal | undefined;
	const task = TaskValidation.tryCatch((signal) => {
		receivedSignal = signal;
		return Promise.resolve(42);
	}, (e) => String(e));
	const controller = new AbortController();
	await task(controller.signal);
	expect(receivedSignal).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("TaskValidation.map transforms Valid value", async () => {
	await expect(pipe(TaskValidation.passed<string, number>(5), TaskValidation.map((n: number) => n * 2))()).resolves
		.toStrictEqual({ kind: "Passed", value: 10 });
});

test("TaskValidation.map passes through Invalid unchanged", async () => {
	await expect(pipe(TaskValidation.failed<string, number>("err"), TaskValidation.map((n: number) => n * 2))()).resolves
		.toStrictEqual({ kind: "Failed", errors: ["err"] });
});

test("TaskValidation.map can change the value type", async () => {
	await expect(pipe(TaskValidation.passed<string, number>(3), TaskValidation.map((n: number) => `n:${n}`))()).resolves
		.toStrictEqual({ kind: "Passed", value: "n:3" });
});

// ---------------------------------------------------------------------------
// ap (error accumulation)
// ---------------------------------------------------------------------------

test("TaskValidation.ap applies Valid function to Valid value", async () => {
	const result = await pipe(
		TaskValidation.passed<string, (n: number) => number>((n) => n * 3),
		TaskValidation.ap(TaskValidation.passed<string, number>(4)),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: 12 });
});

test("TaskValidation.ap accumulates errors from both Invalid sides", async () => {
	const add = (a: number) => (b: number) => a + b;
	const result = await pipe(
		TaskValidation.passed<string, (a: number) => (b: number) => number>(add),
		TaskValidation.ap(TaskValidation.failed<string, number>("bad a")),
		TaskValidation.ap(TaskValidation.failed<string, number>("bad b")),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad a", "bad b"] });
});

test("TaskValidation.ap returns Invalid when function side is Invalid", async () => {
	const result = await pipe(
		TaskValidation.failed<string, (n: number) => number>("bad fn"),
		TaskValidation.ap(TaskValidation.passed<string, number>(4)),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad fn"] });
});

test("TaskValidation.ap collects errors from both sides simultaneously", async () => {
	const result = await pipe(
		TaskValidation.failed<string, (n: number) => number>("bad fn"),
		TaskValidation.ap(TaskValidation.failed<string, number>("bad arg")),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad fn", "bad arg"] });
});

test("TaskValidation.ap propagates the AbortSignal down to both sides", async () => {
	let signalLeft: AbortSignal | undefined;
	let signalRight: AbortSignal | undefined;

	const left: TaskValidation<string, (n: number) => number> = (signal) => {
		signalLeft = signal;
		return Deferred.fromPromise(Promise.resolve(Validation.passed((n: number) => n * 3)));
	};
	const right: TaskValidation<string, number> = (signal) => {
		signalRight = signal;
		return Deferred.fromPromise(Promise.resolve(Validation.passed(4)));
	};

	const controller = new AbortController();
	const result = await pipe(left, TaskValidation.ap(right))(controller.signal);

	expect(result).toStrictEqual({ kind: "Passed", value: 12 });
	expect(signalLeft).toBe(controller.signal);
	expect(signalRight).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("TaskValidation.fold calls onValid for Valid", async () => {
	await expect(
		pipe(TaskValidation.passed(5), TaskValidation.fold((errs) => `invalid:${errs}`, (n: number) => `valid:${n}`))(),
	).resolves.toBe("valid:5");
});

test("TaskValidation.fold calls onInvalid for Invalid", async () => {
	await expect(
		pipe(
			TaskValidation.failed<string, number>("e"),
			TaskValidation.fold((errs) => `invalid:${errs.join(",")}`, (n: number) => `valid:${n}`),
		)(),
	).resolves.toBe("invalid:e");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("TaskValidation.match calls valid handler for Valid", async () => {
	await expect(
		pipe(
			TaskValidation.passed<string, number>(5),
			TaskValidation.match({ passed: (n: number) => `got:${n}`, failed: (errs) => `errs:${errs.join(",")}` }),
		)(),
	).resolves.toBe("got:5");
});

test("TaskValidation.match calls invalid handler for Invalid", async () => {
	await expect(
		pipe(
			TaskValidation.failed<string, number>("oops"),
			TaskValidation.match({ passed: (n: number) => `got:${n}`, failed: (errs) => `errs:${errs.join(",")}` }),
		)(),
	).resolves.toBe("errs:oops");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("TaskValidation.getOrElse returns value for Valid", async () => {
	await expect(pipe(TaskValidation.passed<string, number>(5), TaskValidation.getOrElse(() => 0))()).resolves.toBe(5);
});

test("TaskValidation.getOrElse returns default for Invalid", async () => {
	await expect(pipe(TaskValidation.failed<string, number>("e"), TaskValidation.getOrElse(() => 0))()).resolves.toBe(0);
});

test("taskValidation.getOrElse widens return type to A | B when default is a different type", async () => {
	const result = await pipe(TaskValidation.failed("e"), TaskValidation.getOrElse(() => null))();
	expect(result).toBeNull();
});

test("TaskValidation.getOrElse returns Valid value typed as A | B when Valid", async () => {
	const result = await pipe(TaskValidation.passed(5), TaskValidation.getOrElse(() => null))();
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("TaskValidation.tap executes side effect on Valid and returns original", async () => {
	let seen = 0;
	const result = await pipe(
		TaskValidation.passed<string, number>(5),
		TaskValidation.tap((n: number) => {
			seen = n;
		}),
	)();
	expect(seen).toBe(5);
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

test("TaskValidation.tap does not execute side effect on Invalid", async () => {
	let called = false;
	await pipe(
		TaskValidation.failed<string, number>("err"),
		TaskValidation.tap(() => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("TaskValidation.recover returns original Valid without calling fallback", async () => {
	let called = false;
	const result = await pipe(
		TaskValidation.passed<string, number>(5),
		TaskValidation.recover((_errors) => {
			called = true;
			return TaskValidation.passed<string, number>(99);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

test("TaskValidation.recover provides fallback for Invalid", async () => {
	const result = await pipe(
		TaskValidation.failed<string, number>("err"),
		TaskValidation.recover((_errors) => TaskValidation.passed<string, number>(99)),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: 99 });
});

test("TaskValidation.recover exposes the error list to the fallback", async () => {
	let received: string[] = [];
	await pipe(
		TaskValidation.failedAll<string, number>(["first", "second"]),
		TaskValidation.recover((errors) => {
			received = [...errors];
			return TaskValidation.passed<string, number>(0);
		}),
	)();
	expect(received).toStrictEqual(["first", "second"]);
});

test("taskValidation.recover widens to TaskValidation<E, A | B> when fallback returns a different type", async () => {
	const result = await pipe(
		TaskValidation.failed("err"),
		TaskValidation.recover((_errors) => TaskValidation.passed("recovered")),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: "recovered" });
});

test("TaskValidation.recover preserves Valid typed as TaskValidation<E, A | B>", async () => {
	const result = await pipe(
		TaskValidation.passed(5),
		TaskValidation.recover((_errors) => TaskValidation.passed("recovered")),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("taskValidation composes well in a pipe chain", async () => {
	const validateName = (name: string): TaskValidation<string, string> =>
		name.length > 0 ? TaskValidation.passed(name) : TaskValidation.failed("Name required");
	const validateAge = (age: number): TaskValidation<string, number> =>
		age >= 0 ? TaskValidation.passed(age) : TaskValidation.failed("Age must be >= 0");
	const build = (name: string) => (age: number) => ({ name, age });
	const result = await pipe(
		TaskValidation.passed<string, typeof build>(build),
		TaskValidation.ap(validateName("Alice")),
		TaskValidation.ap(validateAge(30)),
		TaskValidation.map((user) => user.name),
		TaskValidation.getOrElse(() => "unknown"),
	)();
	expect(result).toBe("Alice");
});

test("taskValidation ap accumulates all errors across multiple validations", async () => {
	const validate = (name: string) => (age: number) => ({ name, age });
	const result = await pipe(
		TaskValidation.passed<string, typeof validate>(validate),
		TaskValidation.ap(TaskValidation.failed<string, string>("Name required")),
		TaskValidation.ap(TaskValidation.failed<string, number>("Age required")),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required", "Age required"] });
});

// ---------------------------------------------------------------------------
// product
// ---------------------------------------------------------------------------

test("TaskValidation.product returns tuple when both are Valid", async () => {
	const result = await TaskValidation.product(
		TaskValidation.passed<string, string>("alice"),
		TaskValidation.passed<string, number>(30),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: ["alice", 30] });
});

test("TaskValidation.product accumulates errors when first is Invalid", async () => {
	const result = await TaskValidation.product(
		TaskValidation.failed<string, string>("Name required"),
		TaskValidation.passed<string, number>(30),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required"] });
});

test("TaskValidation.product accumulates errors from both sides", async () => {
	const result = await TaskValidation.product(
		TaskValidation.failed<string, string>("Name required"),
		TaskValidation.failed<string, number>("Age required"),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required", "Age required"] });
});

// ---------------------------------------------------------------------------
// productAll
// ---------------------------------------------------------------------------

test("TaskValidation.productAll returns all values when all are Valid", async () => {
	const result = await TaskValidation.productAll([
		TaskValidation.passed<string, number>(1),
		TaskValidation.passed<string, number>(2),
		TaskValidation.passed<string, number>(3),
	])();
	expect(result).toStrictEqual({ kind: "Passed", value: [1, 2, 3] });
});

test("TaskValidation.productAll accumulates all errors", async () => {
	const result = await TaskValidation.productAll([
		TaskValidation.failed<string, number>("err1"),
		TaskValidation.passed<string, number>(2),
		TaskValidation.failed<string, number>("err2"),
	])();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["err1", "err2"] });
});

test("TaskValidation.productAll with single element returns singleton array", async () => {
	const result = await TaskValidation.productAll([TaskValidation.passed<string, number>(42)])();
	expect(result).toStrictEqual({ kind: "Passed", value: [42] });
});

test("TaskValidation.product propagates the AbortSignal down to both validation tasks", async () => {
	let signalFirst: AbortSignal | undefined;
	let signalSecond: AbortSignal | undefined;

	const first: TaskValidation<string, string> = (signal) => {
		signalFirst = signal;
		return Deferred.fromPromise(Promise.resolve(Validation.passed("alice")));
	};
	const second: TaskValidation<string, number> = (signal) => {
		signalSecond = signal;
		return Deferred.fromPromise(Promise.resolve(Validation.passed(30)));
	};

	const controller = new AbortController();
	await TaskValidation.product(first, second)(controller.signal);

	expect(signalFirst).toBe(controller.signal);
	expect(signalSecond).toBe(controller.signal);
});

test("TaskValidation.productAll propagates the AbortSignal down to all validations", async () => {
	let signal1: AbortSignal | undefined;
	let signal2: AbortSignal | undefined;

	const t1: TaskValidation<string, number> = (signal) => {
		signal1 = signal;
		return Deferred.fromPromise(Promise.resolve(Validation.passed(1)));
	};
	const t2: TaskValidation<string, number> = (signal) => {
		signal2 = signal;
		return Deferred.fromPromise(Promise.resolve(Validation.passed(2)));
	};

	const controller = new AbortController();
	await TaskValidation.productAll([t1, t2])(controller.signal);

	expect(signal1).toBe(controller.signal);
	expect(signal2).toBe(controller.signal);
});

// --- fromNullable ---

test("TaskValidation.fromNullable returns Valid for non-null value", async () => {
	const result = await TaskValidation.fromNullable(() => "is null")(42)();
	expect(result).toStrictEqual(Validation.passed(42));
});

test("TaskValidation.fromNullable returns Invalid for null", async () => {
	const result = await TaskValidation.fromNullable(() => "is null")(null)();
	expect(result).toStrictEqual(Validation.failed("is null"));
});

test("TaskValidation.fromNullable returns Invalid for undefined", async () => {
	const result = await TaskValidation.fromNullable(() => "is null")(undefined)();
	expect(result).toStrictEqual(Validation.failed("is null"));
});

// --- fromMaybe ---

test("TaskValidation.fromMaybe returns Valid for Some", async () => {
	const result = await TaskValidation.fromMaybe(() => "is none")(Maybe.some(42))();
	expect(result).toStrictEqual(Validation.passed(42));
});

test("TaskValidation.fromMaybe returns Invalid for None", async () => {
	const result = await TaskValidation.fromMaybe(() => "is none")(Maybe.none())();
	expect(result).toStrictEqual(Validation.failed("is none"));
});

// --- fromResult ---

test("TaskValidation.fromResult returns Valid for Ok", async () => {
	const result = await TaskValidation.fromResult(Result.ok(42))();
	expect(result).toStrictEqual(Validation.passed(42));
});

test("TaskValidation.fromResult returns Invalid for Err", async () => {
	const result = await TaskValidation.fromResult(Result.err("bad"))();
	expect(result).toStrictEqual(Validation.failed("bad"));
});
