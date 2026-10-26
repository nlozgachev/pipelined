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

	// @ts-expect-error — acquire must be a Task.Result, not a plain number
	Resource.make(42, () => Task.make(undefined));

	// @ts-expect-error — release must return a Task<void>, not undefined
	Resource.make(fallibleAcquire, () => undefined);
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

	// @ts-expect-error — consume callback must return Task.Result, not a primitive
	pipe(resFallible, Resource.use((n) => n * 2));
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

	// @ts-expect-error — combine requires Resource instances
	Resource.combine(resA, "not a resource");
});

test("map: transforms the value channel while preserving error channel", () => {
	const res = Resource.make(
		constTruthyBool() ? Task.Result.make.ok(42) : Task.Result.make.err("err_string"),
		(_n) => Task.make(undefined),
	);

	const mapped = pipe(res, Resource.map((n) => `num:${n}`));
	expectTypeOf(mapped).toEqualTypeOf<Resource<string, string>>();

	// @ts-expect-error — transform callback must accept the acquired value type
	pipe(res, Resource.map((s: boolean) => !s));
});

test("chain: sequences dependent resources and unifies error channels", () => {
	const resA = Resource.make(
		constTruthyBool() ? Task.Result.make.ok(42) : Task.Result.make.err("err_a"),
		(_n) => Task.make(undefined),
	);

	const chained = pipe(
		resA,
		Resource.chain((n) =>
			Resource.make(constTruthyBool() ? Task.Result.make.ok(`val:${n}`) : Task.Result.make.err(500), (_s) =>
				Task.make(undefined))
		),
	);
	expectTypeOf(chained).toEqualTypeOf<Resource<string | number, string>>();

	// @ts-expect-error — chain callback must return a Resource, not a plain value or Task
	pipe(resA, Resource.chain((n) => n * 2));
});

test("all: infers tuple elements and named records with unified error channels", () => {
	const rA = Resource.make(
		constTruthyBool() ? Task.Result.make.ok(1) : Task.Result.make.err("err_a"),
		(_n) => Task.make(undefined),
	);
	const rB = Resource.make(
		constTruthyBool() ? Task.Result.make.ok("two") : Task.Result.make.err(true),
		(_s) => Task.make(undefined),
	);
	const rC = Resource.make(
		constTruthyBool() ? Task.Result.make.ok({ ready: true }) : Task.Result.make.err(99),
		(_obj) => Task.make(undefined),
	);

	// 1. Tuple literal
	const tupleRes = Resource.all([rA, rB, rC]);
	expectTypeOf(tupleRes).toEqualTypeOf<
		Resource<string | boolean | number, readonly [number, string, { ready: boolean; }]>
	>();

	// 2. Empty tuple
	const emptyTupleRes = Resource.all([] as const);
	expectTypeOf(emptyTupleRes).toEqualTypeOf<Resource<never, readonly []>>();

	// 3. Named record
	const recordRes = Resource.all({ a: rA, b: rB, c: rC });
	expectTypeOf(recordRes).toEqualTypeOf<
		Resource<string | boolean | number, { readonly a: number; readonly b: string; readonly c: { ready: boolean; }; }>
	>();

	// 4. Empty record
	const emptyRecordRes = Resource.all({});
	expectTypeOf(emptyRecordRes).toEqualTypeOf<Resource<never, {}>>();

	// @ts-expect-error — all requires Resource items in tuple
	Resource.all([rA, "not a resource"]);

	// @ts-expect-error — all requires Resource values in record
	Resource.all({ a: rA, b: 123 });
});
