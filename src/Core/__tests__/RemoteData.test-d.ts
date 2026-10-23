import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import type { Maybe } from "../Maybe.ts";
import { RemoteData } from "../RemoteData.ts";
import type { Result } from "../Result.ts";

test("make: infers precise variant types for all lifecycle states", () => {
	const notAsked = RemoteData.make.notAsked();
	expectTypeOf(notAsked).toEqualTypeOf<RemoteData.NotAsked>();

	const loading = RemoteData.make.loading();
	expectTypeOf(loading).toEqualTypeOf<RemoteData.Loading>();

	const failure = RemoteData.make.failure("network error");
	expectTypeOf(failure).toEqualTypeOf<RemoteData.Failure<string>>();
	expectTypeOf(failure.error).toEqualTypeOf<string>();

	const success = RemoteData.make.success(42);
	expectTypeOf(success).toEqualTypeOf<RemoteData.Success<number>>();
	expectTypeOf(success.value).toEqualTypeOf<number>();
});

test("is guards: narrows RemoteData to individual variant subtypes", () => {
	const naturalUnion: RemoteData<string, number> = constTruthyBool()
		? RemoteData.make.success(42)
		: constTruthyBool()
		? RemoteData.make.failure("err")
		: constTruthyBool()
		? RemoteData.make.loading()
		: RemoteData.make.notAsked();

	if (RemoteData.is.success(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<RemoteData.Success<number>>();
		expectTypeOf(naturalUnion.value).toEqualTypeOf<number>();
	} else if (RemoteData.is.failure(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<RemoteData.Failure<string>>();
		expectTypeOf(naturalUnion.error).toEqualTypeOf<string>();
	} else if (RemoteData.is.loading(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<RemoteData.Loading>();
	} else {
		expectTypeOf(naturalUnion).toEqualTypeOf<RemoteData.NotAsked>();
	}
});

test("map & mapError: propagates channels and transforms target channel", () => {
	const naturalUnion: RemoteData<string, number> = constTruthyBool()
		? RemoteData.make.success(42)
		: RemoteData.make.failure("err");

	const mapped = pipe(naturalUnion, RemoteData.map((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<RemoteData<string, string>>();

	const mappedErr = pipe(naturalUnion, RemoteData.mapError((s) => s.length));
	expectTypeOf(mappedErr).toEqualTypeOf<RemoteData<number, number>>();
});

test("chain: unifies error channels across computations", () => {
	const naturalUnion: RemoteData<string, number> = constTruthyBool()
		? RemoteData.make.success(42)
		: RemoteData.make.failure("err");

	const chained = pipe(
		naturalUnion,
		RemoteData.chain((n) => (n > 0 ? RemoteData.make.success(n.toString()) : RemoteData.make.failure(false))),
	);
	expectTypeOf(chained).toEqualTypeOf<RemoteData<string | boolean, string>>();
});

test("apply: applies wrapped function and combines error channels", () => {
	const rdFn: RemoteData<string, (n: number) => string> = constTruthyBool()
		? RemoteData.make.success((n: number) => n.toString())
		: RemoteData.make.failure("fn_err");

	const rdVal: RemoteData<number, number> = constTruthyBool()
		? RemoteData.make.success(42)
		: RemoteData.make.failure(404);

	const applied = pipe(rdFn, RemoteData.apply(rdVal));
	expectTypeOf(applied).toEqualTypeOf<RemoteData<string | number, string>>();
});

test("match: produces unified return type across all four branches", () => {
	const naturalUnion: RemoteData<string, number> = constTruthyBool()
		? RemoteData.make.success(42)
		: RemoteData.make.failure("err");

	const matched = pipe(
		naturalUnion,
		RemoteData.match({
			notAsked: () => "not_asked",
			loading: () => "loading",
			failure: (err) => `err: ${err}`,
			success: (val) => `val: ${val}`,
		}),
	);
	expectTypeOf(matched).toEqualTypeOf<string>();
});

test("getOrElse: widens return type with fallback default thunk", () => {
	const naturalUnion: RemoteData<string, number> = constTruthyBool()
		? RemoteData.make.success(42)
		: RemoteData.make.failure("err");

	const valSame = pipe(naturalUnion, RemoteData.getOrElse(() => 0));
	expectTypeOf(valSame).toEqualTypeOf<number>();

	const valWider = pipe(naturalUnion, RemoteData.getOrElse((): null => null));
	expectTypeOf(valWider).toEqualTypeOf<number | null>();
});

test("tap & tapError: preserves full RemoteData type and channels", () => {
	const naturalUnion: RemoteData<string, number> = constTruthyBool()
		? RemoteData.make.success(42)
		: RemoteData.make.failure("err");

	const tapped = pipe(naturalUnion, RemoteData.tap((_n) => {}));
	expectTypeOf(tapped).toEqualTypeOf<RemoteData<string, number>>();

	const tappedErr = pipe(naturalUnion, RemoteData.tapError((_e) => {}));
	expectTypeOf(tappedErr).toEqualTypeOf<RemoteData<string, number>>();
});

test("recover: infallible recovery does not collapse error channel to unknown", () => {
	const naturalUnion: RemoteData<string, number> = constTruthyBool()
		? RemoteData.make.success(42)
		: RemoteData.make.failure("err");

	const recoveredInfallible = pipe(naturalUnion, RemoteData.recover((_err) => RemoteData.make.success("fallback")));
	expectTypeOf(recoveredInfallible).toEqualTypeOf<RemoteData<never, number | string>>();

	const recoveredFallible = pipe(naturalUnion, RemoteData.recover((_err) => RemoteData.make.failure("custom_error")));
	expectTypeOf(recoveredFallible).toEqualTypeOf<RemoteData<string, number>>();
});

test("filter: refines success value and unifies error channels", () => {
	const naturalUnion: RemoteData<string, unknown> = constTruthyBool()
		? RemoteData.make.success("hello")
		: RemoteData.make.failure("fetch_err");

	const isString = (val: unknown): val is string => typeof val === "string";

	const refined = pipe(naturalUnion, RemoteData.filter(isString, () => 400));
	expectTypeOf(refined).toEqualTypeOf<RemoteData<string | number, string>>();

	const filteredBool = pipe(naturalUnion, RemoteData.filter((val) => Boolean(val), () => false));
	expectTypeOf(filteredBool).toEqualTypeOf<RemoteData<string | boolean, unknown>>();
});

test("converters: to.Maybe, to.Result, from.Result, from.Maybe", () => {
	const naturalUnion: RemoteData<string, number> = constTruthyBool()
		? RemoteData.make.success(42)
		: RemoteData.make.failure("err");

	const asMaybe = pipe(naturalUnion, RemoteData.to.Maybe);
	expectTypeOf(asMaybe).toEqualTypeOf<Maybe<number>>();

	const asResult = pipe(naturalUnion, RemoteData.to.Result(() => 503));
	expectTypeOf(asResult).toEqualTypeOf<Result<string | number, number>>();
});

test("negative: disallows missing match cases, invalid transforms, and cross-variant assignments", () => {
	const naturalUnion: RemoteData<string, number> = constTruthyBool()
		? RemoteData.make.success(42)
		: RemoteData.make.failure("err");

	// @ts-expect-error Missing 'notAsked' case
	expectTypeOf(RemoteData.match({ loading: () => 0, failure: (_e: string) => 0, success: (_n: number) => 0 }))
		.toBeFunction();

	// @ts-expect-error Missing 'loading' case
	expectTypeOf(RemoteData.match({ notAsked: () => 0, failure: (_e: string) => 0, success: (_n: number) => 0 }))
		.toBeFunction();

	// @ts-expect-error Missing 'failure' case
	expectTypeOf(RemoteData.match({ notAsked: () => 0, loading: () => 0, success: (_n: number) => 0 })).toBeFunction();

	// @ts-expect-error Missing 'success' case
	expectTypeOf(RemoteData.match({ notAsked: () => 0, loading: () => 0, failure: (_e: string) => 0 })).toBeFunction();

	// @ts-expect-error Map transform must be a function
	expectTypeOf(RemoteData.map(123)(naturalUnion)).toBeObject();

	// @ts-expect-error Chain transform must return RemoteData
	expectTypeOf(RemoteData.chain((n: number) => n * 2)(naturalUnion)).toBeObject();

	// @ts-expect-error NotAsked cannot be assigned to Success
	const _notAskedAsSuccess: RemoteData.Success<number> = RemoteData.make.notAsked();

	// @ts-expect-error Failure does not have .value property
	expectTypeOf(RemoteData.make.failure("err").value).toBeUndefined();

	// @ts-expect-error Success does not have .error property
	expectTypeOf(RemoteData.make.success(42).error).toBeUndefined();
});
