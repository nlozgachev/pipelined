import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { TaskValidation } from "../TaskValidation.ts";
import { Validation } from "../Validation.ts";

// ---------------------------------------------------------------------------
// valid
// ---------------------------------------------------------------------------

test("TaskValidation.valid creates a Task that resolves to Valid", async () => {
	expect(await TaskValidation.valid<string, number>(42)()).toEqual({ kind: "Valid", value: 42 });
});

// ---------------------------------------------------------------------------
// invalid
// ---------------------------------------------------------------------------

test("TaskValidation.invalid creates a Task that resolves to Invalid with one error", async () => {
	expect(await TaskValidation.invalid<string, number>("bad")()).toEqual(
		{ kind: "Invalid", errors: ["bad"] },
	);
});

// ---------------------------------------------------------------------------
// invalidAll
// ---------------------------------------------------------------------------

test("TaskValidation.invalidAll creates a Task that resolves to Invalid with multiple errors", async () => {
	expect(await TaskValidation.invalidAll<string, number>(["err1", "err2"])()).toEqual(
		{ kind: "Invalid", errors: ["err1", "err2"] },
	);
});

// ---------------------------------------------------------------------------
// fromValidation
// ---------------------------------------------------------------------------

test("TaskValidation.fromValidation lifts a Valid into a Task", async () => {
	expect(await TaskValidation.fromValidation(Validation.valid<string, number>(5))()).toEqual({
		kind: "Valid",
		value: 5,
	});
});

test("TaskValidation.fromValidation lifts an Invalid into a Task", async () => {
	expect(await TaskValidation.fromValidation(Validation.invalid("e"))()).toEqual({ kind: "Invalid", errors: ["e"] });
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("TaskValidation.tryCatch returns Valid when Promise resolves", async () => {
	expect(await TaskValidation.tryCatch(() => Promise.resolve(42), (e) => String(e))()).toEqual({
		kind: "Valid",
		value: 42,
	});
});

test("TaskValidation.tryCatch returns Invalid when Promise rejects", async () => {
	expect(
		await TaskValidation.tryCatch(
			() => Promise.reject(new Error("boom")),
			(e) => (e as Error).message,
		)(),
	).toEqual({ kind: "Invalid", errors: ["boom"] });
});

test("TaskValidation.tryCatch catches async throws", async () => {
	expect(
		await TaskValidation.tryCatch(
			// eslint-disable-next-line require-await
			async () => {
				throw new Error("bang");
			},
			(e) => (e as Error).message,
		)(),
	).toEqual({ kind: "Invalid", errors: ["bang"] });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("TaskValidation.map transforms Valid value", async () => {
	expect(await pipe(TaskValidation.valid<string, number>(5), TaskValidation.map((n: number) => n * 2))()).toEqual({
		kind: "Valid",
		value: 10,
	});
});

test("TaskValidation.map passes through Invalid unchanged", async () => {
	expect(
		await pipe(
			TaskValidation.invalid<string, number>("err"),
			TaskValidation.map((n: number) => n * 2),
		)(),
	).toEqual({ kind: "Invalid", errors: ["err"] });
});

test("TaskValidation.map can change the value type", async () => {
	expect(
		await pipe(
			TaskValidation.valid<string, number>(3),
			TaskValidation.map((n: number) => `n:${n}`),
		)(),
	).toEqual({ kind: "Valid", value: "n:3" });
});

// ---------------------------------------------------------------------------
// ap (error accumulation)
// ---------------------------------------------------------------------------

test("TaskValidation.ap applies Valid function to Valid value", async () => {
	const result = await pipe(
		TaskValidation.valid<string, (n: number) => number>((n) => n * 3),
		TaskValidation.ap(TaskValidation.valid<string, number>(4)),
	)();
	expect(result).toEqual({ kind: "Valid", value: 12 });
});

test("TaskValidation.ap accumulates errors from both Invalid sides", async () => {
	const add = (a: number) => (b: number) => a + b;
	const result = await pipe(
		TaskValidation.valid<string, (a: number) => (b: number) => number>(add),
		TaskValidation.ap(TaskValidation.invalid<string, number>("bad a")),
		TaskValidation.ap(TaskValidation.invalid<string, number>("bad b")),
	)();
	expect(result).toEqual({ kind: "Invalid", errors: ["bad a", "bad b"] });
});

test("TaskValidation.ap returns Invalid when function side is Invalid", async () => {
	const result = await pipe(
		TaskValidation.invalid<string, (n: number) => number>("bad fn"),
		TaskValidation.ap(TaskValidation.valid<string, number>(4)),
	)();
	expect(result).toEqual({ kind: "Invalid", errors: ["bad fn"] });
});

test("TaskValidation.ap collects errors from both sides simultaneously", async () => {
	const result = await pipe(
		TaskValidation.invalid<string, (n: number) => number>("bad fn"),
		TaskValidation.ap(TaskValidation.invalid<string, number>("bad arg")),
	)();
	expect(result).toEqual({ kind: "Invalid", errors: ["bad fn", "bad arg"] });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("TaskValidation.fold calls onValid for Valid", async () => {
	expect(
		await pipe(
			TaskValidation.valid(5),
			TaskValidation.fold((errs) => `invalid:${errs}`, (n: number) => `valid:${n}`),
		)(),
	).toBe("valid:5");
});

test("TaskValidation.fold calls onInvalid for Invalid", async () => {
	expect(
		await pipe(
			TaskValidation.invalid<string, number>("e"),
			TaskValidation.fold((errs) => `invalid:${errs.join(",")}`, (n: number) => `valid:${n}`),
		)(),
	).toBe("invalid:e");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("TaskValidation.match calls valid handler for Valid", async () => {
	expect(
		await pipe(
			TaskValidation.valid<string, number>(5),
			TaskValidation.match({
				valid: (n: number) => `got:${n}`,
				invalid: (errs) => `errs:${errs.join(",")}`,
			}),
		)(),
	).toBe("got:5");
});

test("TaskValidation.match calls invalid handler for Invalid", async () => {
	expect(
		await pipe(
			TaskValidation.invalid<string, number>("oops"),
			TaskValidation.match({
				valid: (n: number) => `got:${n}`,
				invalid: (errs) => `errs:${errs.join(",")}`,
			}),
		)(),
	).toBe("errs:oops");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("TaskValidation.getOrElse returns value for Valid", async () => {
	expect(await pipe(TaskValidation.valid<string, number>(5), TaskValidation.getOrElse(() => 0))()).toBe(5);
});

test("TaskValidation.getOrElse returns default for Invalid", async () => {
	expect(await pipe(TaskValidation.invalid<string, number>("e"), TaskValidation.getOrElse(() => 0))()).toBe(0);
});

test(
	"TaskValidation.getOrElse widens return type to A | B when default is a different type",
	async () => {
		const result = await pipe(
			TaskValidation.invalid("e"),
			TaskValidation.getOrElse(() => null),
		)();
		expect(result).toBeNull();
	},
);

test("TaskValidation.getOrElse returns Valid value typed as A | B when Valid", async () => {
	const result = await pipe(
		TaskValidation.valid(5),
		TaskValidation.getOrElse(() => null),
	)();
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("TaskValidation.tap executes side effect on Valid and returns original", async () => {
	let seen = 0;
	const result = await pipe(
		TaskValidation.valid<string, number>(5),
		TaskValidation.tap((n: number) => {
			seen = n;
		}),
	)();
	expect(seen).toBe(5);
	expect(result).toEqual({ kind: "Valid", value: 5 });
});

test("TaskValidation.tap does not execute side effect on Invalid", async () => {
	let called = false;
	await pipe(
		TaskValidation.invalid<string, number>("err"),
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
		TaskValidation.valid<string, number>(5),
		TaskValidation.recover((_errors) => {
			called = true;
			return TaskValidation.valid<string, number>(99);
		}),
	)();
	expect(called).toBe(false);
	expect(result).toEqual({ kind: "Valid", value: 5 });
});

test("TaskValidation.recover provides fallback for Invalid", async () => {
	const result = await pipe(
		TaskValidation.invalid<string, number>("err"),
		TaskValidation.recover((_errors) => TaskValidation.valid<string, number>(99)),
	)();
	expect(result).toEqual({ kind: "Valid", value: 99 });
});

test("TaskValidation.recover exposes the error list to the fallback", async () => {
	let received: string[] = [];
	await pipe(
		TaskValidation.invalidAll<string, number>(["first", "second"]),
		TaskValidation.recover((errors) => {
			received = [...errors];
			return TaskValidation.valid<string, number>(0);
		}),
	)();
	expect(received).toEqual(["first", "second"]);
});

test(
	"TaskValidation.recover widens to TaskValidation<E, A | B> when fallback returns a different type",
	async () => {
		const result = await pipe(
			TaskValidation.invalid("err"),
			TaskValidation.recover((_errors) => TaskValidation.valid("recovered")),
		)();
		expect(result).toEqual({ kind: "Valid", value: "recovered" });
	},
);

test("TaskValidation.recover preserves Valid typed as TaskValidation<E, A | B>", async () => {
	const result = await pipe(
		TaskValidation.valid(5),
		TaskValidation.recover((_errors) => TaskValidation.valid("recovered")),
	)();
	expect(result).toEqual({ kind: "Valid", value: 5 });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("TaskValidation composes well in a pipe chain", async () => {
	const validateName = (name: string): TaskValidation<string, string> =>
		name.length > 0 ? TaskValidation.valid(name) : TaskValidation.invalid("Name required");
	const validateAge = (age: number): TaskValidation<string, number> =>
		age >= 0 ? TaskValidation.valid(age) : TaskValidation.invalid("Age must be >= 0");
	const build = (name: string) => (age: number) => ({ name, age });
	const result = await pipe(
		TaskValidation.valid<string, typeof build>(build),
		TaskValidation.ap(validateName("Alice")),
		TaskValidation.ap(validateAge(30)),
		TaskValidation.map((user) => user.name),
		TaskValidation.getOrElse(() => "unknown"),
	)();
	expect(result).toBe("Alice");
});

test("TaskValidation ap accumulates all errors across multiple validations", async () => {
	const validate = (name: string) => (age: number) => ({ name, age });
	const result = await pipe(
		TaskValidation.valid<string, typeof validate>(validate),
		TaskValidation.ap(TaskValidation.invalid<string, string>("Name required")),
		TaskValidation.ap(TaskValidation.invalid<string, number>("Age required")),
	)();
	expect(result).toEqual({ kind: "Invalid", errors: ["Name required", "Age required"] });
});

// ---------------------------------------------------------------------------
// product
// ---------------------------------------------------------------------------

test("TaskValidation.product returns tuple when both are Valid", async () => {
	const result = await TaskValidation.product(
		TaskValidation.valid<string, string>("alice"),
		TaskValidation.valid<string, number>(30),
	)();
	expect(result).toEqual({ kind: "Valid", value: ["alice", 30] });
});

test("TaskValidation.product accumulates errors when first is Invalid", async () => {
	const result = await TaskValidation.product(
		TaskValidation.invalid<string, string>("Name required"),
		TaskValidation.valid<string, number>(30),
	)();
	expect(result).toEqual({ kind: "Invalid", errors: ["Name required"] });
});

test("TaskValidation.product accumulates errors from both sides", async () => {
	const result = await TaskValidation.product(
		TaskValidation.invalid<string, string>("Name required"),
		TaskValidation.invalid<string, number>("Age required"),
	)();
	expect(result).toEqual({ kind: "Invalid", errors: ["Name required", "Age required"] });
});

// ---------------------------------------------------------------------------
// productAll
// ---------------------------------------------------------------------------

test("TaskValidation.productAll returns all values when all are Valid", async () => {
	const result = await TaskValidation.productAll([
		TaskValidation.valid<string, number>(1),
		TaskValidation.valid<string, number>(2),
		TaskValidation.valid<string, number>(3),
	])();
	expect(result).toEqual({ kind: "Valid", value: [1, 2, 3] });
});

test("TaskValidation.productAll accumulates all errors", async () => {
	const result = await TaskValidation.productAll([
		TaskValidation.invalid<string, number>("err1"),
		TaskValidation.valid<string, number>(2),
		TaskValidation.invalid<string, number>("err2"),
	])();
	expect(result).toEqual({ kind: "Invalid", errors: ["err1", "err2"] });
});

test("TaskValidation.productAll with single element returns singleton array", async () => {
	const result = await TaskValidation.productAll([
		TaskValidation.valid<string, number>(42),
	])();
	expect(result).toEqual({ kind: "Valid", value: [42] });
});
