import { pipe } from "#composition";
import { Deferred, Maybe, Result, Task, Validation } from "#core";
import { expect, test } from "vitest";

// ---------------------------------------------------------------------------
// valid
// ---------------------------------------------------------------------------

test("Task.Validation.passed creates a Task that resolves to Valid", async () => {
	await expect(Task.Validation.passed<string, number>(42)()).resolves.toStrictEqual({ kind: "Passed", value: 42 });
});

// ---------------------------------------------------------------------------
// invalid
// ---------------------------------------------------------------------------

test("Task.Validation.failed creates a Task that resolves to Invalid with one error", async () => {
	await expect(Task.Validation.failed<string, number>("bad")()).resolves.toStrictEqual({
		kind: "Failed",
		errors: ["bad"],
	});
});

// ---------------------------------------------------------------------------
// invalidAll
// ---------------------------------------------------------------------------

test("Task.Validation.failedAll creates a Task that resolves to Invalid with multiple errors", async () => {
	await expect(Task.Validation.failedAll<string, number>(["err1", "err2"])()).resolves.toStrictEqual({
		kind: "Failed",
		errors: ["err1", "err2"],
	});
});

// ---------------------------------------------------------------------------
// fromValidation
// ---------------------------------------------------------------------------

test("Task.Validation.fromValidation lifts a Valid into a Task", async () => {
	await expect(Task.Validation.fromValidation(Validation.passed<string, number>(5))()).resolves.toStrictEqual({
		kind: "Passed",
		value: 5,
	});
});

test("Task.Validation.fromValidation lifts an Invalid into a Task", async () => {
	await expect(Task.Validation.fromValidation(Validation.failed("e"))()).resolves.toStrictEqual({
		kind: "Failed",
		errors: ["e"],
	});
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("Task.Validation.tryCatch returns Valid when Promise resolves", async () => {
	await expect(Task.Validation.tryCatch(() => Promise.resolve(42), (e) => String(e))()).resolves.toStrictEqual({
		kind: "Passed",
		value: 42,
	});
});

test("Task.Validation.tryCatch returns Invalid when Promise rejects", async () => {
	await expect(Task.Validation.tryCatch(() => Promise.reject(new Error("boom")), (e) => (e as Error).message)()).resolves
		.toStrictEqual({ kind: "Failed", errors: ["boom"] });
});

test("Task.Validation.tryCatch catches async throws", async () => {
	await expect(
		Task.Validation.tryCatch(
			// eslint-disable-next-line require-await
			async () => {
				throw new Error("bang");
			},
			(e) => (e as Error).message,
		)(),
	).resolves.toStrictEqual({ kind: "Failed", errors: ["bang"] });
});

test("Task.Validation.tryCatch receives the AbortSignal from the call site", async () => {
	let receivedSignal: AbortSignal | undefined;
	const task = Task.Validation.tryCatch((signal) => {
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

test("Task.Validation.map transforms Valid value", async () => {
	await expect(pipe(Task.Validation.passed<string, number>(5), Task.Validation.map((n: number) => n * 2))()).resolves
		.toStrictEqual({ kind: "Passed", value: 10 });
});

test("Task.Validation.map passes through Invalid unchanged", async () => {
	await expect(pipe(Task.Validation.failed<string, number>("err"), Task.Validation.map((n: number) => n * 2))()).resolves
		.toStrictEqual({ kind: "Failed", errors: ["err"] });
});

test("Task.Validation.map can change the value type", async () => {
	await expect(pipe(Task.Validation.passed<string, number>(3), Task.Validation.map((n: number) => `n:${n}`))()).resolves
		.toStrictEqual({ kind: "Passed", value: "n:3" });
});

// ---------------------------------------------------------------------------
// ap (error accumulation)
// ---------------------------------------------------------------------------

test("Task.Validation.ap applies Valid function to Valid value", async () => {
	const result = await pipe(
		Task.Validation.passed<string, (n: number) => number>((n) => n * 3),
		Task.Validation.ap(Task.Validation.passed<string, number>(4)),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: 12 });
});

test("Task.Validation.ap accumulates errors from both Invalid sides", async () => {
	const add = (a: number) => (b: number) => a + b;
	const result = await pipe(
		Task.Validation.passed<string, (a: number) => (b: number) => number>(add),
		Task.Validation.ap(Task.Validation.failed<string, number>("bad a")),
		Task.Validation.ap(Task.Validation.failed<string, number>("bad b")),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad a", "bad b"] });
});

test("Task.Validation.ap returns Invalid when function side is Invalid", async () => {
	const result = await pipe(
		Task.Validation.failed<string, (n: number) => number>("bad fn"),
		Task.Validation.ap(Task.Validation.passed<string, number>(4)),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad fn"] });
});

test("Task.Validation.ap collects errors from both sides simultaneously", async () => {
	const result = await pipe(
		Task.Validation.failed<string, (n: number) => number>("bad fn"),
		Task.Validation.ap(Task.Validation.failed<string, number>("bad arg")),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad fn", "bad arg"] });
});

test("Task.Validation.ap propagates the AbortSignal down to both sides", async () => {
	let signalLeft: AbortSignal | undefined;
	let signalRight: AbortSignal | undefined;

	const left: Task.Validation<string, (n: number) => number> = (signal) => {
		signalLeft = signal;
		return Deferred.fromPromise(Promise.resolve(Validation.passed((n: number) => n * 3)));
	};
	const right: Task.Validation<string, number> = (signal) => {
		signalRight = signal;
		return Deferred.fromPromise(Promise.resolve(Validation.passed(4)));
	};

	const controller = new AbortController();
	const result = await pipe(left, Task.Validation.ap(right))(controller.signal);

	expect(result).toStrictEqual({ kind: "Passed", value: 12 });
	expect(signalLeft).toBe(controller.signal);
	expect(signalRight).toBe(controller.signal);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Task.Validation.fold calls onValid for Valid", async () => {
	await expect(
		pipe(Task.Validation.passed(5), Task.Validation.fold((errs) => `invalid:${errs}`, (n: number) => `valid:${n}`))(),
	).resolves.toBe("valid:5");
});

test("Task.Validation.fold calls onInvalid for Invalid", async () => {
	await expect(
		pipe(
			Task.Validation.failed<string, number>("e"),
			Task.Validation.fold((errs) => `invalid:${errs.join(",")}`, (n: number) => `valid:${n}`),
		)(),
	).resolves.toBe("invalid:e");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("Task.Validation.match calls valid handler for Valid", async () => {
	await expect(
		pipe(
			Task.Validation.passed<string, number>(5),
			Task.Validation.match({ passed: (n: number) => `got:${n}`, failed: (errs) => `errs:${errs.join(",")}` }),
		)(),
	).resolves.toBe("got:5");
});

test("Task.Validation.match calls invalid handler for Invalid", async () => {
	await expect(
		pipe(
			Task.Validation.failed<string, number>("oops"),
			Task.Validation.match({ passed: (n: number) => `got:${n}`, failed: (errs) => `errs:${errs.join(",")}` }),
		)(),
	).resolves.toBe("errs:oops");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Task.Validation.getOrElse returns value for Valid", async () => {
	await expect(pipe(Task.Validation.passed<string, number>(5), Task.Validation.getOrElse(() => 0))()).resolves.toBe(5);
});

test("Task.Validation.getOrElse returns default for Invalid", async () => {
	await expect(pipe(Task.Validation.failed<string, number>("e"), Task.Validation.getOrElse(() => 0))()).resolves.toBe(0);
});

test("taskValidation.getOrElse widens return type to A | B when default is a different type", async () => {
	const result = await pipe(Task.Validation.failed("e"), Task.Validation.getOrElse(() => null))();
	expect(result).toBeNull();
});

test("Task.Validation.getOrElse returns Valid value typed as A | B when Valid", async () => {
	const result = await pipe(Task.Validation.passed(5), Task.Validation.getOrElse(() => null))();
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("Task.Validation.tap executes side effect on Valid and returns original", async () => {
	let seen = 0;
	const result = await pipe(
		Task.Validation.passed<string, number>(5),
		Task.Validation.tap((n: number) => {
			seen = n;
		}),
	)();
	expect(seen).toBe(5);
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

test("Task.Validation.tap does not execute side effect on Invalid", async () => {
	let called = false;
	await pipe(
		Task.Validation.failed<string, number>("err"),
		Task.Validation.tap(() => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("Task.Validation.recover returns original Valid without calling fallback", async () => {
	let called = false;
	const result = await pipe(
		Task.Validation.passed<string, number>(5),
		Task.Validation.recover((_errors) => {
			called = true;
			return Task.Validation.passed<string, number>(99);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

test("Task.Validation.recover provides fallback for Invalid", async () => {
	const result = await pipe(
		Task.Validation.failed<string, number>("err"),
		Task.Validation.recover((_errors) => Task.Validation.passed<string, number>(99)),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: 99 });
});

test("Task.Validation.recover exposes the error list to the fallback", async () => {
	let received: string[] = [];
	await pipe(
		Task.Validation.failedAll<string, number>(["first", "second"]),
		Task.Validation.recover((errors) => {
			received = [...errors];
			return Task.Validation.passed<string, number>(0);
		}),
	)();
	expect(received).toStrictEqual(["first", "second"]);
});

test("taskValidation.recover widens to Task.Validation<E, A | B> when fallback returns a different type", async () => {
	const result = await pipe(
		Task.Validation.failed("err"),
		Task.Validation.recover((_errors) => Task.Validation.passed("recovered")),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: "recovered" });
});

test("Task.Validation.recover preserves Valid typed as Task.Validation<E, A | B>", async () => {
	const result = await pipe(
		Task.Validation.passed(5),
		Task.Validation.recover((_errors) => Task.Validation.passed("recovered")),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("taskValidation composes well in a pipe chain", async () => {
	const validateName = (name: string): Task.Validation<string, string> =>
		name.length > 0 ? Task.Validation.passed(name) : Task.Validation.failed("Name required");
	const validateAge = (age: number): Task.Validation<string, number> =>
		age >= 0 ? Task.Validation.passed(age) : Task.Validation.failed("Age must be >= 0");
	const build = (name: string) => (age: number) => ({ name, age });
	const result = await pipe(
		Task.Validation.passed<string, typeof build>(build),
		Task.Validation.ap(validateName("Alice")),
		Task.Validation.ap(validateAge(30)),
		Task.Validation.map((user) => user.name),
		Task.Validation.getOrElse(() => "unknown"),
	)();
	expect(result).toBe("Alice");
});

test("taskValidation ap accumulates all errors across multiple validations", async () => {
	const validate = (name: string) => (age: number) => ({ name, age });
	const result = await pipe(
		Task.Validation.passed<string, typeof validate>(validate),
		Task.Validation.ap(Task.Validation.failed<string, string>("Name required")),
		Task.Validation.ap(Task.Validation.failed<string, number>("Age required")),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required", "Age required"] });
});

// ---------------------------------------------------------------------------
// product
// ---------------------------------------------------------------------------

test("Task.Validation.product returns tuple when both are Valid", async () => {
	const result = await Task.Validation.product(
		Task.Validation.passed<string, string>("alice"),
		Task.Validation.passed<string, number>(30),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: ["alice", 30] });
});

test("Task.Validation.product accumulates errors when first is Invalid", async () => {
	const result = await Task.Validation.product(
		Task.Validation.failed<string, string>("Name required"),
		Task.Validation.passed<string, number>(30),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required"] });
});

test("Task.Validation.product accumulates errors from both sides", async () => {
	const result = await Task.Validation.product(
		Task.Validation.failed<string, string>("Name required"),
		Task.Validation.failed<string, number>("Age required"),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required", "Age required"] });
});

// ---------------------------------------------------------------------------
// productAll
// ---------------------------------------------------------------------------

test("Task.Validation.productAll returns all values when all are Valid", async () => {
	const result = await Task.Validation.productAll([
		Task.Validation.passed<string, number>(1),
		Task.Validation.passed<string, number>(2),
		Task.Validation.passed<string, number>(3),
	])();
	expect(result).toStrictEqual({ kind: "Passed", value: [1, 2, 3] });
});

test("Task.Validation.productAll accumulates all errors", async () => {
	const result = await Task.Validation.productAll([
		Task.Validation.failed<string, number>("err1"),
		Task.Validation.passed<string, number>(2),
		Task.Validation.failed<string, number>("err2"),
	])();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["err1", "err2"] });
});

test("Task.Validation.productAll with single element returns singleton array", async () => {
	const result = await Task.Validation.productAll([Task.Validation.passed<string, number>(42)])();
	expect(result).toStrictEqual({ kind: "Passed", value: [42] });
});

test("Task.Validation.product propagates the AbortSignal down to both validation tasks", async () => {
	let signalFirst: AbortSignal | undefined;
	let signalSecond: AbortSignal | undefined;

	const first: Task.Validation<string, string> = (signal) => {
		signalFirst = signal;
		return Deferred.fromPromise(Promise.resolve(Validation.passed("alice")));
	};
	const second: Task.Validation<string, number> = (signal) => {
		signalSecond = signal;
		return Deferred.fromPromise(Promise.resolve(Validation.passed(30)));
	};

	const controller = new AbortController();
	await Task.Validation.product(first, second)(controller.signal);

	expect(signalFirst).toBe(controller.signal);
	expect(signalSecond).toBe(controller.signal);
});

test("Task.Validation.productAll propagates the AbortSignal down to all validations", async () => {
	let signal1: AbortSignal | undefined;
	let signal2: AbortSignal | undefined;

	const t1: Task.Validation<string, number> = (signal) => {
		signal1 = signal;
		return Deferred.fromPromise(Promise.resolve(Validation.passed(1)));
	};
	const t2: Task.Validation<string, number> = (signal) => {
		signal2 = signal;
		return Deferred.fromPromise(Promise.resolve(Validation.passed(2)));
	};

	const controller = new AbortController();
	await Task.Validation.productAll([t1, t2])(controller.signal);

	expect(signal1).toBe(controller.signal);
	expect(signal2).toBe(controller.signal);
});

// --- fromNullable ---

test("Task.Validation.fromNullable returns Valid for non-null value", async () => {
	const result = await Task.Validation.fromNullable(() => "is null")(42)();
	expect(result).toStrictEqual(Validation.passed(42));
});

test("Task.Validation.fromNullable returns Invalid for null", async () => {
	const result = await Task.Validation.fromNullable(() => "is null")(null)();
	expect(result).toStrictEqual(Validation.failed("is null"));
});

test("Task.Validation.fromNullable returns Invalid for undefined", async () => {
	const result = await Task.Validation.fromNullable(() => "is null")(undefined)();
	expect(result).toStrictEqual(Validation.failed("is null"));
});

// --- fromMaybe ---

test("Task.Validation.fromMaybe returns Valid for Some", async () => {
	const result = await Task.Validation.fromMaybe(() => "is none")(Maybe.some(42))();
	expect(result).toStrictEqual(Validation.passed(42));
});

test("Task.Validation.fromMaybe returns Invalid for None", async () => {
	const result = await Task.Validation.fromMaybe(() => "is none")(Maybe.none())();
	expect(result).toStrictEqual(Validation.failed("is none"));
});

// --- fromResult ---

test("Task.Validation.fromResult returns Valid for Ok", async () => {
	const result = await Task.Validation.fromResult(Result.ok(42))();
	expect(result).toStrictEqual(Validation.passed(42));
});

test("Task.Validation.fromResult returns Invalid for Err", async () => {
	const result = await Task.Validation.fromResult(Result.err("bad"))();
	expect(result).toStrictEqual(Validation.failed("bad"));
});

// --- mapError ---

test("Task.Validation.mapError transforms accumulated errors", async () => {
	const result = await pipe(
		Task.Validation.failed<string, number>("error"),
		Task.Validation.mapError((s) => s.toUpperCase()),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["ERROR"] });
});

test("Task.Validation.mapError passes through Passed unchanged", async () => {
	const result = await pipe(
		Task.Validation.passed<string, number>(42),
		Task.Validation.mapError((s) => s.toUpperCase()),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

// --- tapError ---

test("Task.Validation.tapError executes side effect on Failed", async () => {
	let seen: string[] = [];
	const result = await pipe(
		Task.Validation.failed<string, number>("error"),
		Task.Validation.tapError((errs) => {
			seen = [...errs];
		}),
	)();
	expect(seen).toStrictEqual(["error"]);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["error"] });
});

test("Task.Validation.tapError does not execute side effect on Passed", async () => {
	let called = false;
	const result = await pipe(
		Task.Validation.passed<string, number>(42),
		Task.Validation.tapError(() => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

// --- struct ---

test("Task.Validation.struct combines record of Passed in parallel", async () => {
	const result = await Task.Validation.struct({
		name: Task.Validation.passed<string, string>("Alice"),
		age: Task.Validation.passed<string, number>(30),
	})();
	expect(result).toStrictEqual(Validation.passed({ name: "Alice", age: 30 }));
});

test("Task.Validation.struct accumulates errors from all failed branches", async () => {
	const result = await Task.Validation.struct({
		name: Task.Validation.failed<string, string>("Name required"),
		age: Task.Validation.failed<string, number>("Age must be positive"),
	})();
	expect(result).toStrictEqual(Validation.failedAll(["Name required", "Age must be positive"]));
});
