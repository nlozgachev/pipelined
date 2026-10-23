import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Resource } from "../Resource.ts";
import { Task } from "../Task.ts";

test("make & from.Task: constructs resource objects with acquire and release", () => {
	const fallibleAcquire = constTruthyBool() ? Task.Result.make.ok(42) : Task.Result.make.err("acquire_err");
	const resFallible = Resource.make(fallibleAcquire, (_n) => Task.make(undefined));
	expectTypeOf(resFallible).toEqualTypeOf<Resource<string, number>>();

	const infallibleAcquire = Task.make(42);
	const resInfallible = Resource.from.Task(infallibleAcquire, (_n) => Task.make(undefined));
	expectTypeOf(resInfallible).toEqualTypeOf<Resource<never, number>>();
});

test("use: passes acquired value to consume and unifies error channels", () => {
	const resFallible = Resource.make(
		constTruthyBool() ? Task.Result.make.ok(42) : Task.Result.make.err("acquire_err"),
		(_n) => Task.make(undefined),
	);

	const program = pipe(
		resFallible,
		Resource.use((n) => constTruthyBool() ? Task.Result.make.ok(n.toString()) : Task.Result.make.err(500)),
	);
	expectTypeOf(program).toEqualTypeOf<Task.Result<string | number, string>>();
});

test("combine: sequences two resources and combines values and error channels", () => {
	const resA = Resource.make(
		constTruthyBool() ? Task.Result.make.ok(42) : Task.Result.make.err("err_a"),
		(_n) => Task.make(undefined),
	);
	const resB = Resource.make(
		constTruthyBool() ? Task.Result.make.ok("hello") : Task.Result.make.err(false),
		(_s) => Task.make(undefined),
	);

	const combined = Resource.combine(resA, resB);
	expectTypeOf(combined).toEqualTypeOf<Resource<string | boolean, readonly [number, string]>>();
});
