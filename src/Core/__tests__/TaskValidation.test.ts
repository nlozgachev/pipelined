import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Deferred } from "../Deferred.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Task } from "../Task.ts";
import { Validation } from "../Validation.ts";

test("make.passed: resolves to Passed", async () => {
	const tv = Task.Validation.make.passed<number>(42);
	const res = await tv();
	expect(res).toStrictEqual({ kind: "Passed", value: 42 });
});

// --- make ---

test("make.passed: creates a Task that resolves to Valid", async () => {
	await expect(Task.Validation.make.passed(42)()).resolves.toStrictEqual({ kind: "Passed", value: 42 });
});

test("make.failed: creates a Task that resolves to Invalid with one error", async () => {
	await expect(Task.Validation.make.failed("bad")()).resolves.toStrictEqual({ kind: "Failed", errors: ["bad"] });
});

test("make.failedAll: creates a Task that resolves to Invalid with multiple errors", async () => {
	await expect(Task.Validation.make.failedAll(["err1", "err2"])()).resolves.toStrictEqual({
		kind: "Failed",
		errors: ["err1", "err2"],
	});
});

// --- fromValidation ---

test("from.Validation: lifts Valid into a Task", async () => {
	await expect(Task.Validation.from.Validation(Validation.make.passed(5))()).resolves.toStrictEqual({
		kind: "Passed",
		value: 5,
	});
});

test("from.Validation: lifts Invalid into a Task", async () => {
	await expect(Task.Validation.from.Validation(Validation.make.failed("e"))()).resolves.toStrictEqual({
		kind: "Failed",
		errors: ["e"],
	});
});

// --- tryCatch ---

test("tryCatch: returns Valid when Promise resolves", async () => {
	await expect(Task.Validation.tryCatch(() => Promise.resolve(42), { onError: (e) => String(e) })()).resolves
		.toStrictEqual({ kind: "Passed", value: 42 });
});

test("tryCatch: returns Invalid when Promise rejects", async () => {
	await expect(
		Task.Validation.tryCatch(() => Promise.reject(new Error("boom")), {
			onError: (e) => (e instanceof Error ? e.message : String(e)),
		})(),
	).resolves.toStrictEqual({ kind: "Failed", errors: ["boom"] });
});

test("tryCatch: catches async throws", async () => {
	await expect(
		Task.Validation.tryCatch(
			// oxlint-disable-next-line require-await
			async () => {
				throw new Error("bang");
			},
			{ onError: (e) => (e instanceof Error ? e.message : String(e)) },
		)(),
	).resolves.toStrictEqual({ kind: "Failed", errors: ["bang"] });
});

test("tryCatch: receives AbortSignal from call site", async () => {
	let receivedSignal: AbortSignal | undefined;
	const task = Task.Validation.tryCatch((signal) => {
		receivedSignal = signal;
		return Promise.resolve(42);
	}, { onError: (e) => String(e) });
	const controller = new AbortController();
	await task(controller.signal);
	expect(receivedSignal).toBe(controller.signal);
});

// --- map ---

test("map: transforms Valid value", async () => {
	await expect(pipe(Task.Validation.make.passed(5), Task.Validation.map((n: number) => n * 2))()).resolves.toStrictEqual(
		{ kind: "Passed", value: 10 },
	);
});

test("map: passes through Invalid unchanged without calling transform", async () => {
	let called = false;
	const res = await pipe(
		Task.Validation.make.failed("err"),
		Task.Validation.map((n: number) => {
			called = true;
			return n * 2;
		}),
	)();
	expect(called).toBe(false);
	expect(res).toStrictEqual({ kind: "Failed", errors: ["err"] });
});

test("map: can change value type", async () => {
	await expect(pipe(Task.Validation.make.passed(3), Task.Validation.map((n: number) => `n:${n}`))()).resolves
		.toStrictEqual({ kind: "Passed", value: "n:3" });
});

// --- apply (error accumulation) ---

test("apply: applies Valid function to Valid value", async () => {
	const result = await pipe(
		Task.Validation.make.passed((n: number) => n * 3),
		Task.Validation.apply(Task.Validation.make.passed(4)),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: 12 });
});

test("apply: accumulates errors from both Invalid sides", async () => {
	const add = (a: number) => (b: number) => a + b;
	const result = await pipe(
		Task.Validation.make.passed(add),
		Task.Validation.apply(Task.Validation.make.failed("bad a")),
		Task.Validation.apply(Task.Validation.make.failed("bad b")),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad a", "bad b"] });
});

test("apply: returns Invalid when function side is Invalid", async () => {
	const result = await pipe(
		Task.Validation.make.failed("bad fn"),
		Task.Validation.apply(Task.Validation.make.passed(4)),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad fn"] });
});

test("apply: collects errors from both sides simultaneously", async () => {
	const result = await pipe(
		Task.Validation.make.failed("bad fn"),
		Task.Validation.apply(Task.Validation.make.failed("bad arg")),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad fn", "bad arg"] });
});

test("apply: propagates AbortSignal down to both sides", async () => {
	let signalLeft: AbortSignal | undefined;
	let signalRight: AbortSignal | undefined;

	const left: Task.Validation<string, (n: number) => number> = (signal) => {
		signalLeft = signal;
		return Deferred.from.Promise(Promise.resolve(Validation.make.passed((n: number) => n * 3)));
	};
	const right: Task.Validation<string, number> = (signal) => {
		signalRight = signal;
		return Deferred.from.Promise(Promise.resolve(Validation.make.passed(4)));
	};

	const controller = new AbortController();
	const result = await pipe(left, Task.Validation.apply(right))(controller.signal);

	expect(result).toStrictEqual({ kind: "Passed", value: 12 });
	expect(signalLeft).toBe(controller.signal);
	expect(signalRight).toBe(controller.signal);
});

// --- match ---

test("match: calls valid handler for Valid", async () => {
	await expect(
		pipe(
			Task.Validation.make.passed(5),
			Task.Validation.match({ passed: (n: number) => `got:${n}`, failed: (errs) => `errs:${errs.join(",")}` }),
		)(),
	).resolves.toBe("got:5");
});

test("match: calls invalid handler for Invalid", async () => {
	await expect(
		pipe(
			Task.Validation.make.failed("oops"),
			Task.Validation.match({ passed: (n: number) => `got:${n}`, failed: (errs) => `errs:${errs.join(",")}` }),
		)(),
	).resolves.toBe("errs:oops");
});

// --- getOrElse ---

test("getOrElse: returns value for Valid", async () => {
	await expect(pipe(Task.Validation.make.passed(5), Task.Validation.getOrElse(() => 0))()).resolves.toBe(5);
});

test("getOrElse: returns default for Invalid", async () => {
	await expect(pipe(Task.Validation.make.failed("e"), Task.Validation.getOrElse(() => 0))()).resolves.toBe(0);
});

test("getOrElse: widens return type to union when default is different type", async () => {
	const result = await pipe(Task.Validation.make.failed("e"), Task.Validation.getOrElse(() => null))();
	expect(result).toBeNull();
});

test("getOrElse: returns Valid value typed as union when Valid", async () => {
	const result = await pipe(Task.Validation.make.passed(5), Task.Validation.getOrElse(() => null))();
	expect(result).toBe(5);
});

// --- tap ---

test("tap: executes side effect on Valid and returns original", async () => {
	let seen = 0;
	const result = await pipe(
		Task.Validation.make.passed(5),
		Task.Validation.tap((n: number) => {
			seen = n;
		}),
	)();
	expect(seen).toBe(5);
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

test("tap: does not execute side effect on Invalid", async () => {
	let called = false;
	await pipe(
		Task.Validation.make.failed("err"),
		Task.Validation.tap(() => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
});

// --- recover ---

test("recover: returns original Valid without calling fallback", async () => {
	let called = false;
	const result = await pipe(
		Task.Validation.make.passed(5),
		Task.Validation.recover((_errors) => {
			called = true;
			return Task.Validation.make.passed(99);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

test("recover: provides fallback for Invalid", async () => {
	const result = await pipe(
		Task.Validation.make.failed("err"),
		Task.Validation.recover((_errors) => Task.Validation.make.passed(99)),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: 99 });
});

test("recover: exposes error list to fallback", async () => {
	let received: string[] = [];
	await pipe(
		Task.Validation.make.failedAll(["first", "second"]),
		Task.Validation.recover((errors) => {
			received = [...errors];
			return Task.Validation.make.passed(0);
		}),
	)();
	expect(received).toStrictEqual(["first", "second"]);
});

test("recover: widens return type when fallback returns different type", async () => {
	const result = await pipe(
		Task.Validation.make.failed("err"),
		Task.Validation.recover((_errors) => Task.Validation.make.passed("recovered")),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: "recovered" });
});

test("recover: preserves Valid typed as union", async () => {
	const result = await pipe(
		Task.Validation.make.passed(5),
		Task.Validation.recover((_errors) => Task.Validation.make.passed("recovered")),
	)();
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

// --- pipe composition ---

test("pipe: composes well in a pipeline", async () => {
	const validateName = (name: string): Task.Validation<string, string> =>
		name.length > 0 ? Task.Validation.make.passed(name) : Task.Validation.make.failed("Name required");
	const validateAge = (age: number): Task.Validation<string, number> =>
		age >= 0 ? Task.Validation.make.passed(age) : Task.Validation.make.failed("Age must be >= 0");
	const build = (name: string) => (age: number) => ({ name, age });
	const result = await pipe(
		Task.Validation.make.passed(build),
		Task.Validation.apply(validateName("Alice")),
		Task.Validation.apply(validateAge(30)),
		Task.Validation.map((user) => user.name),
		Task.Validation.getOrElse(() => "unknown"),
	)();
	expect(result).toBe("Alice");
});

test("apply: accumulates all errors across multiple validations", async () => {
	const validate = (name: string) => (age: number) => ({ name, age });
	const result = await pipe(
		Task.Validation.make.passed(validate),
		Task.Validation.apply(Task.Validation.make.failed("Name required")),
		Task.Validation.apply(Task.Validation.make.failed("Age required")),
	)();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required", "Age required"] });
});

// --- from.nullable ---

test("from.nullable: returns Valid for non-null value", async () => {
	const result = await Task.Validation.from.nullable(() => "is null")(42)();
	expect(result).toStrictEqual(Validation.make.passed(42));
});

test("from.nullable: returns Invalid for null", async () => {
	const result = await Task.Validation.from.nullable(() => "is null")(null)();
	expect(result).toStrictEqual(Validation.make.failed("is null"));
});

test("from.nullable: returns Invalid for undefined", async () => {
	const result = await Task.Validation.from.nullable(() => "is null")(undefined)();
	expect(result).toStrictEqual(Validation.make.failed("is null"));
});

// --- fromMaybe ---

test("from.Maybe: returns Valid for Some", async () => {
	const result = await Task.Validation.from.Maybe(() => "is none")(Maybe.make.some(42))();
	expect(result).toStrictEqual(Validation.make.passed(42));
});

test("from.Maybe: returns Invalid for None", async () => {
	const result = await Task.Validation.from.Maybe(() => "is none")(Maybe.make.none())();
	expect(result).toStrictEqual(Validation.make.failed("is none"));
});

// --- fromResult ---

test("from.Result: returns Valid for Ok", async () => {
	const result = await Task.Validation.from.Result(Result.make.ok(42))();
	expect(result).toStrictEqual(Validation.make.passed(42));
});

test("from.Result: returns Invalid for Err", async () => {
	const result = await Task.Validation.from.Result(Result.make.err("bad"))();
	expect(result).toStrictEqual(Validation.make.failed("bad"));
});

// --- mapError ---

test("mapError: transforms accumulated errors", async () => {
	const result = await pipe(Task.Validation.make.failed("error"), Task.Validation.mapError((s) => s.toUpperCase()))();
	expect(result).toStrictEqual({ kind: "Failed", errors: ["ERROR"] });
});

test("mapError: passes through Passed unchanged without calling transform", async () => {
	let called = false;
	const result = await pipe(
		Task.Validation.make.passed(42),
		Task.Validation.mapError((s: string) => {
			called = true;
			return s.toUpperCase();
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

// --- tapError ---

test("tapError: executes side effect on Failed", async () => {
	let seen: string[] = [];
	const result = await pipe(
		Task.Validation.make.failed("error"),
		Task.Validation.tapError((errs) => {
			seen = [...errs];
		}),
	)();
	expect(seen).toStrictEqual(["error"]);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["error"] });
});

test("tapError: does not execute side effect on Passed", async () => {
	let called = false;
	const result = await pipe(
		Task.Validation.make.passed(42),
		Task.Validation.tapError(() => {
			called = true;
		}),
	)();
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

// --- struct ---

test("struct: combines record of Passed in parallel", async () => {
	const result = await Task.Validation.struct({
		name: Task.Validation.make.passed("Alice"),
		age: Task.Validation.make.passed(30),
	})();
	expect(result).toStrictEqual(Validation.make.passed({ name: "Alice", age: 30 }));
});

test("struct: accumulates errors from all failed branches", async () => {
	const result = await Task.Validation.struct({
		name: Task.Validation.make.failed("Name required"),
		age: Task.Validation.make.failed("Age must be positive"),
	})();
	expect(result).toStrictEqual(Validation.make.failedAll(["Name required", "Age must be positive"]));
});

test("struct: infers heterogeneous error union and assigns to interface types", async () => {
	interface ValErr {
		field: string;
	}
	interface ValUser {
		name: string;
		age: number;
	}

	const interfaceTask: Task.Validation<ValErr, ValUser> = Task.Validation.struct({
		name: Task.Validation.make.passed("Bob"),
		age: Task.Validation.make.passed(25),
	});
	const res = await interfaceTask();
	expect(res).toStrictEqual(Validation.make.passed({ name: "Bob", age: 25 }));
});

test("make: creates passed, failed, and failedAll tasks", async () => {
	const passedTask = Task.Validation.make.passed(42);
	const failedTask = Task.Validation.make.failed("err1");
	const failedAllTask = Task.Validation.make.failedAll(["err1", "err2"]);

	await expect(passedTask()).resolves.toStrictEqual(Validation.make.passed(42));
	await expect(failedTask()).resolves.toStrictEqual(Validation.make.failed("err1"));
	await expect(failedAllTask()).resolves.toStrictEqual(Validation.make.failedAll(["err1", "err2"]));
});

test("memoize: executes task only once across multiple calls", async () => {
	let calls = 0;
	const task = Task.Validation.tryCatch(() => {
		calls++;
		return Promise.resolve(99);
	}, { onError: String });
	const memoized = Task.Validation.memoize(task);

	const r1 = await memoized();
	const r2 = await memoized();

	expect(r1).toStrictEqual(Validation.make.passed(99));
	expect(r2).toStrictEqual(Validation.make.passed(99));
	expect(calls).toBe(1);
});

// --- to namespace ---

test("to.Result: converts Passed to Ok and Failed to Err", async () => {
	const combine = (errs: readonly string[]) => errs.join(", ");
	const passedRes = await Task.Validation.to.Result(combine)(Task.Validation.make.passed(42))();
	const failedRes = await Task.Validation.to.Result(combine)(Task.Validation.make.failedAll(["err1", "err2"]))();

	expect(passedRes).toStrictEqual({ kind: "Ok", value: 42 });
	expect(failedRes).toStrictEqual({ kind: "Err", error: "err1, err2" });
});

test("to.Maybe: converts Passed to Some and Failed to None", async () => {
	const passedRes = await Task.Validation.to.Maybe(Task.Validation.make.passed(42))();
	const failedRes = await Task.Validation.to.Maybe(Task.Validation.make.failed("err"))();

	expect(passedRes).toStrictEqual({ kind: "Some", value: 42 });
	expect(failedRes).toStrictEqual({ kind: "None" });
});

// --- recoverUnless ---

test("recoverUnless: recovers from Failed when not blocked", async () => {
	const task = pipe(
		Task.Validation.make.failed("transient"),
		Task.Validation.recoverUnless((errs) => errs.includes("fatal"), () => Task.Validation.make.passed(99)),
	);
	const res = await task();
	expect(res).toStrictEqual(Validation.make.passed(99));
});

test("recoverUnless: preserves Failed when blocked", async () => {
	const task = pipe(
		Task.Validation.make.failed("fatal"),
		Task.Validation.recoverUnless((errs) => errs.includes("fatal"), () => Task.Validation.make.passed(99)),
	);
	const res = await task();
	expect(res).toStrictEqual(Validation.make.failed("fatal"));
});

test("recoverUnless: preserves Passed when called on a Passed task", async () => {
	const task = pipe(
		Task.Validation.make.passed(42),
		Task.Validation.recoverUnless((errs: readonly string[]) => errs.includes("fatal"), () =>
			Task.Validation.make.passed(99)),
	);
	const res = await task();
	expect(res).toStrictEqual(Validation.make.passed(42));
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

test("run: executes Task.Validation in a pipeline", async () => {
	const controller = new AbortController();
	const res = await pipe(Task.Validation.make.passed(42), Task.Validation.run(controller.signal));
	expect(res).toStrictEqual(Validation.make.passed(42));
});

test("struct: safely handles __proto__ property without prototype pollution", async () => {
	const protoFields: Record<string, Task.Validation<string, unknown>> = {};
	Object.defineProperty(protoFields, "__proto__", {
		value: Task.Validation.make.passed({ polluted: true }),
		enumerable: true,
		configurable: true,
		writable: true,
	});
	protoFields.a = Task.Validation.make.passed(1);

	const res = await Task.Validation.struct(protoFields)();
	expect(Validation.is.passed(res)).toBe(true);
	const value = Validation.getOrElse((): Record<string, unknown> => ({}))(res);
	expect(Object.hasOwn(value, "__proto__")).toBe(true);
	expect("polluted" in {}).toBe(false);
});
