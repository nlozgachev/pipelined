import { RemoteData } from "#core";
import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbSuccess = fc.integer().map(RemoteData.success);
const arbFailure = fc.string().map(RemoteData.failure);
const arbNotAsked = fc.constant(RemoteData.notAsked());
const arbLoading = fc.constant(RemoteData.loading());
const arbRemoteData = fc.oneof(arbSuccess, arbFailure, arbNotAsked, arbLoading);
const arbNonSuccess = fc.oneof(arbFailure, arbNotAsked, arbLoading);

// ---------------------------------------------------------------------------
// map — functor laws
// ---------------------------------------------------------------------------

test("remoteData.map — identity law", () => {
	fc.assert(fc.property(arbRemoteData, (rd) => {
		expect(RemoteData.map((x: number) => x)(rd)).toStrictEqual(rd);
	}));
});

test("remoteData.map — composition law", () => {
	fc.assert(fc.property(arbRemoteData, fc.integer(), fc.integer(), (rd, a, b) => {
		const f = (x: number) => x + a;
		const g = (x: number) => x * b;
		expect(RemoteData.map(f)(RemoteData.map(g)(rd))).toStrictEqual(RemoteData.map((x: number) => f(g(x)))(rd));
	}));
});

test("remoteData.map — identity on non-Success variants", () => {
	fc.assert(fc.property(arbNonSuccess, (rd) => {
		expect(RemoteData.map((x: number) => x)(rd)).toBe(rd);
	}));
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("remoteData.chain — short-circuits on non-Success", () => {
	fc.assert(fc.property(arbNonSuccess, (rd) => {
		expect(RemoteData.chain((_: number) => RemoteData.success(0))(rd)).toBe(rd);
	}));
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("remoteData.getOrElse — returns value on Success", () => {
	fc.assert(fc.property(arbSuccess, (rd) => {
		expect(RemoteData.isSuccess(rd) && RemoteData.getOrElse(() => -1)(rd) === rd.value).toBe(true);
	}));
});

test("remoteData.getOrElse — returns fallback on non-Success", () => {
	fc.assert(fc.property(arbNonSuccess, fc.integer(), (rd, fallback) => {
		expect(RemoteData.getOrElse(() => fallback)(rd)).toBe(fallback);
	}));
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("remoteData.fold — handles all four variants without throwing", () => {
	fc.assert(fc.property(arbRemoteData, (rd) => {
		const result = RemoteData.fold(
			(e: string) => `failure:${e}`,
			() => "notAsked",
			() => "loading",
			(v: number) => `success:${v}`,
		)(rd);
		expectTypeOf(result).toBeString();
	}));
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("remoteData.tap — always returns the identical reference", () => {
	fc.assert(fc.property(arbRemoteData, (rd) => {
		expect(RemoteData.tap(() => {})(rd)).toBe(rd);
	}));
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("remoteData.recover — identity on Success", () => {
	fc.assert(fc.property(arbSuccess, (rd) => {
		expect(RemoteData.recover(() => RemoteData.success(-999))(rd)).toBe(rd);
	}));
});
