import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Result } from "../../Core/Result.ts";
import { Task } from "../../Core/Task.ts";
import { Validation } from "../../Core/Validation.ts";
import { Arr } from "../Arr.ts";

test("safe access: head, last, tail, init, at return Maybe", () => {
	const items = [1, 2, 3];

	expectTypeOf(Arr.head(items)).toEqualTypeOf<Maybe<number>>();
	expectTypeOf(Arr.last(items)).toEqualTypeOf<Maybe<number>>();
	expectTypeOf(Arr.tail(items)).toEqualTypeOf<Maybe<readonly number[]>>();
	expectTypeOf(Arr.init(items)).toEqualTypeOf<Maybe<readonly number[]>>();
	expectTypeOf(pipe(items, Arr.at(0))).toEqualTypeOf<Maybe<number>>();
});

test("findFirst & findLast: narrows type with type guard", () => {
	type Shape = { kind: "circle"; radius: number; } | { kind: "square"; side: number; };
	const shapes: readonly Shape[] = [{ kind: "circle", radius: 5 }, { kind: "square", side: 10 }];

	const isCircle = (s: Shape): s is { kind: "circle"; radius: number; } => s.kind === "circle";

	const foundFirst = pipe(shapes, Arr.findFirst(isCircle));
	expectTypeOf(foundFirst).toEqualTypeOf<Maybe<{ kind: "circle"; radius: number; }>>();

	const foundLast = pipe(shapes, Arr.findLast(isCircle));
	expectTypeOf(foundLast).toEqualTypeOf<Maybe<{ kind: "circle"; radius: number; }>>();

	const foundBool = pipe(shapes, Arr.findFirst((s) => s.kind.length > 0));
	expectTypeOf(foundBool).toEqualTypeOf<Maybe<Shape>>();
});

test("filter: narrows array type with refinement guard", () => {
	type Mixed = number | string;
	const items: readonly Mixed[] = [1, "two", 3];

	const isNumber = (x: Mixed): x is number => typeof x === "number";

	const filtered = pipe(items, Arr.filter(isNumber));
	expectTypeOf(filtered).toEqualTypeOf<readonly number[]>();

	const filteredBool = pipe(items, Arr.filter((x) => Boolean(x)));
	expectTypeOf(filteredBool).toEqualTypeOf<readonly Mixed[]>();
});

test("partition: separates array by refinement into positive and excluded branches", () => {
	type Mixed = number | string;
	const items: readonly Mixed[] = [1, "two", 3];

	const isNumber = (x: Mixed): x is number => typeof x === "number";

	const [numbers, strings] = pipe(items, Arr.partition(isNumber));
	expectTypeOf(numbers).toEqualTypeOf<readonly number[]>();
	expectTypeOf(strings).toEqualTypeOf<readonly string[]>();
});

test("map & filterMap: transforms arrays", () => {
	const items = [1, 2, 3];

	const mapped = pipe(items, Arr.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<readonly string[]>();

	const filterMapped = pipe(items, Arr.filterMap((n) => (n > 1 ? Maybe.make.some(n.toString()) : Maybe.make.none())));
	expectTypeOf(filterMapped).toEqualTypeOf<readonly string[]>();
});

test("traverse & sequence: maps effects across array elements", () => {
	const items = [1, 2, 3];

	const travMaybe = pipe(items, Arr.traverse.Maybe((n) => Maybe.make.some(n.toString())));
	expectTypeOf(travMaybe).toEqualTypeOf<Maybe<readonly string[]>>();

	const travResult = pipe(
		items,
		Arr.traverse.Result((n) => constTruthyBool() ? Result.make.ok(n.toString()) : Result.make.err("err")),
	);
	expectTypeOf(travResult).toEqualTypeOf<Result<string, readonly string[]>>();

	const travValidation = pipe(
		items,
		Arr.traverse.Validation((n) =>
			constTruthyBool() ? Validation.make.passed(n.toString()) : Validation.make.failed("err")
		),
	);
	expectTypeOf(travValidation).toEqualTypeOf<Validation<string, readonly string[]>>();

	const travTask = pipe(items, Arr.traverse.Task((n) => Task.make(n.toString())));
	expectTypeOf(travTask).toEqualTypeOf<Task<readonly string[]>>();
});

test("NonEmpty: preserves guaranteed non-empty tuple constraints", () => {
	const ne: Arr.NonEmpty<number> = [1, 2, 3];

	expectTypeOf(Arr.NonEmpty.head(ne)).toEqualTypeOf<number>();
	expectTypeOf(Arr.NonEmpty.tail(ne)).toEqualTypeOf<readonly number[]>();

	const mapped = pipe(ne, Arr.NonEmpty.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<Arr.NonEmpty<string>>();

	const reduced = pipe(ne, Arr.NonEmpty.reduce((a, b) => a + b));
	expectTypeOf(reduced).toEqualTypeOf<number>();
});
