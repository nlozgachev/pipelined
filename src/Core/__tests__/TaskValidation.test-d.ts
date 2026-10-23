import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Task } from "../Task.ts";
import { type Validation } from "../Validation.ts";

test("make: infers precise variant types for Passed and Failed task validations", async () => {
	const passedTask = Task.Validation.make.passed(42);
	expectTypeOf(passedTask).toEqualTypeOf<Task.Validation<never, number>>();

	const failedTask = Task.Validation.make.failed("fail");
	expectTypeOf(failedTask).toEqualTypeOf<Task.Validation<string, never>>();

	const res = await passedTask();
	expectTypeOf(res).toEqualTypeOf<Validation<never, number>>();
});

test("map / mapError: preserves natural union and propagates channel types", () => {
	const naturalUnion: Task.Validation<"ERR", number> = constTruthyBool()
		? Task.Validation.make.passed(42)
		: Task.Validation.make.failed("ERR");

	const mapped = pipe(naturalUnion, Task.Validation.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Task.Validation<"ERR", string>>();

	const errorMapped = pipe(naturalUnion, Task.Validation.mapError((e) => e.length));
	expectTypeOf(errorMapped).toEqualTypeOf<Task.Validation<number, number>>();
});

test("tap & tapError: preserve channel types through side effects", () => {
	const naturalUnion: Task.Validation<"ERR", number> = constTruthyBool()
		? Task.Validation.make.passed(42)
		: Task.Validation.make.failed("ERR");

	const tapped = pipe(naturalUnion, Task.Validation.tap((_n) => {}));
	expectTypeOf(tapped).toEqualTypeOf<Task.Validation<"ERR", number>>();

	const tappedErr = pipe(naturalUnion, Task.Validation.tapError((_errs) => {}));
	expectTypeOf(tappedErr).toEqualTypeOf<Task.Validation<"ERR", number>>();
});

test("struct: preserves heterogeneous error unions and object shapes", () => {
	const taskA: Task.Validation<"ERR_A", number> = constTruthyBool()
		? Task.Validation.make.passed(1)
		: Task.Validation.make.failed("ERR_A");
	const taskB: Task.Validation<"ERR_B", string> = constTruthyBool()
		? Task.Validation.make.passed("foo")
		: Task.Validation.make.failed("ERR_B");

	const structured = Task.Validation.struct({ a: taskA, b: taskB });
	expectTypeOf(structured).toEqualTypeOf<Task.Validation<"ERR_A" | "ERR_B", { a: number; b: string; }>>();
});

test("to.Result: converts to Task.Result while accumulating errors", () => {
	const input: Task.Validation<string, number> = constTruthyBool()
		? Task.Validation.make.passed(100)
		: Task.Validation.make.failed("err");

	const converted = pipe(input, Task.Validation.to.Result((errs) => errs.join("; ")));
	expectTypeOf(converted).toEqualTypeOf<Task.Result<string, number>>();
});

test("negative: flags invalid transforms and non-Task.Validation struct fields", () => {
	const task = Task.Validation.make.passed(42);

	// @ts-expect-error Map transform must be a function
	expectTypeOf(Task.Validation.map(123)(task)).toBeFunction();

	// @ts-expect-error Struct field values must be Task.Validation instances
	expectTypeOf(Task.Validation.struct({ a: 123 })).toBeFunction();
});
