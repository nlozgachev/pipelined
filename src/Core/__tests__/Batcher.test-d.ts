import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Duration } from "../../Types/Duration.ts";
import { Batcher } from "../Batcher.ts";
import { Deferred } from "../Deferred.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Task } from "../Task.ts";

test("make: infers Batcher instance types correctly", () => {
	type Key = string;
	type User = { readonly id: string; readonly name: string; };

	const batcher = Batcher.make({
		fetch: (_keys: readonly Key[]) => () => {
			const map: ReadonlyMap<Key, User> = new Map<Key, User>();
			return Task.Result.make.ok(map)();
		},
		maxBatchSize: 100,
		window: Duration.milliseconds(10),
	});

	expectTypeOf(batcher).toEqualTypeOf<Batcher<Key, never, User>>();

	const loadDeferred = batcher.load("u_1");
	expectTypeOf(loadDeferred).toEqualTypeOf<Deferred<Batcher.Outcome<never, User, Key>>>();

	const loadManyDeferred = batcher.loadMany(["u_1", "u_2"]);
	expectTypeOf(loadManyDeferred).toEqualTypeOf<Deferred<readonly Batcher.Outcome<never, User, Key>[]>>();

	const flushDeferred = batcher.flush();
	expectTypeOf(flushDeferred).toEqualTypeOf<Deferred<void>>();

	// @ts-expect-error — fetch is required
	Batcher.make({});

	// @ts-expect-error — fetch must return Task.Result of ReadonlyMap
	Batcher.make({ fetch: (keys: readonly string[]) => () => Task.make(keys)() });
});

test("Outcome: discriminated union narrowing and variant structures", () => {
	type CustomErr = { readonly status: 500; };
	type Outcome = Batcher.Outcome<CustomErr, number, string>;
	const customErr: CustomErr = { status: 500 };

	const outcome: Outcome = constTruthyBool()
		? Batcher.Outcome.make.ok(42)
		: constTruthyBool()
		? Batcher.Outcome.make.missing("k1")
		: Batcher.Outcome.make.err(customErr);

	if (Batcher.Outcome.is.ok(outcome)) {
		expectTypeOf(outcome).toEqualTypeOf<Batcher.Ok<number>>();
		expectTypeOf(outcome.value).toEqualTypeOf<number>();
	} else if (Batcher.Outcome.is.missing(outcome)) {
		expectTypeOf(outcome).toEqualTypeOf<Batcher.Missing<string>>();
		expectTypeOf(outcome.key).toEqualTypeOf<string>();
	} else if (Batcher.Outcome.is.err(outcome)) {
		expectTypeOf(outcome).toEqualTypeOf<Batcher.Err<CustomErr>>();
		expectTypeOf(outcome.error).toEqualTypeOf<CustomErr>();
	}
});

test("Outcome.match: infers return type across all branches", () => {
	const outcome = constTruthyBool()
		? Batcher.Outcome.make.ok(42)
		: constTruthyBool()
		? Batcher.Outcome.make.missing("k1")
		: Batcher.Outcome.make.err("e");

	const res = pipe(
		outcome,
		Batcher.Outcome.match({ ok: (n) => `num:${n}`, missing: (k) => `missing:${k}`, err: (e) => `err:${e}` }),
	);

	expectTypeOf(res).toEqualTypeOf<string>();

	// @ts-expect-error — missing branch handler is required
	Batcher.Outcome.match({ ok: (n: number) => n, err: () => 0 })(outcome);
});

test("Outcome.to: converters preserve types and widening", () => {
	type CustomErr = { readonly kind: "Db"; };
	type CustomMissing = { readonly kind: "NotFound"; readonly key: string; };
	const customErr: CustomErr = { kind: "Db" };
	const outcome: Batcher.Outcome<CustomErr, string, string> = constTruthyBool()
		? Batcher.Outcome.make.ok("hello")
		: constTruthyBool()
		? Batcher.Outcome.make.missing("k")
		: Batcher.Outcome.make.err(customErr);

	// to.Result
	const asResult = pipe(outcome, Batcher.Outcome.to.Result((key): CustomMissing => ({ kind: "NotFound", key })));
	expectTypeOf(asResult).toEqualTypeOf<Result<CustomErr | CustomMissing, string>>();

	// to.Maybe
	const asMaybe = pipe(outcome, Batcher.Outcome.to.Maybe);
	expectTypeOf(asMaybe).toEqualTypeOf<Maybe<string>>();

	// to.nullable
	const asNullable = pipe(outcome, Batcher.Outcome.to.nullable);
	expectTypeOf(asNullable).toEqualTypeOf<string | null>();
});

test("Outcome.map, mapError, and getOrElse: combinator type transformations", () => {
	type CustomErr = { readonly status: 500; };
	const customErr: CustomErr = { status: 500 };
	const outcome: Batcher.Outcome<CustomErr, number, string> = constTruthyBool()
		? Batcher.Outcome.make.ok(42)
		: constTruthyBool()
		? Batcher.Outcome.make.missing("k")
		: Batcher.Outcome.make.err(customErr);

	const mapped = pipe(outcome, Batcher.Outcome.map((n) => `num:${n}`));
	expectTypeOf(mapped).toEqualTypeOf<Batcher.Outcome<CustomErr, string, string>>();

	const mappedErr = pipe(outcome, Batcher.Outcome.mapError((e) => ({ code: e.status })));
	expectTypeOf(mappedErr).toEqualTypeOf<Batcher.Outcome<{ code: 500; }, number, string>>();

	const unwrapped = pipe(outcome, Batcher.Outcome.getOrElse(() => 0));
	expectTypeOf(unwrapped).toEqualTypeOf<number>();

	const widened = pipe(outcome, Batcher.Outcome.getOrElse(() => null));
	expectTypeOf(widened).toEqualTypeOf<number | null>();
});
