import { describe, expectTypeOf, it } from "vitest";
import { Deferred } from "../../Core/Deferred.ts";
import type { Awaitable } from "../../internal/InternalTypes";
import { flow } from "../flow.ts";
import { flowAsync } from "../flowAsync.ts";

describe("flow and flowAsync type-level tests", () => {
	it("inspects synchronous flow overloads from 1 to 10 functions", () => {
		const inc = (n: number) => n + 1;
		const toStr = (n: number) => n.toString();
		const len = (s: string) => s.length;

		expectTypeOf(flow(inc)).toEqualTypeOf<(n: number) => number>();
		expectTypeOf(flow(inc, toStr)).toEqualTypeOf<(n: number) => string>();
		expectTypeOf(flow(inc, toStr, len)).toEqualTypeOf<(n: number) => number>();
		expectTypeOf(flow(inc, toStr, len, inc)).toEqualTypeOf<(n: number) => number>();
		expectTypeOf(flow(inc, toStr, len, inc, toStr)).toEqualTypeOf<(n: number) => string>();
		expectTypeOf(flow(inc, toStr, len, inc, toStr, len)).toEqualTypeOf<(n: number) => number>();
		expectTypeOf(flow(inc, toStr, len, inc, toStr, len, inc)).toEqualTypeOf<(n: number) => number>();
		expectTypeOf(flow(inc, toStr, len, inc, toStr, len, inc, toStr)).toEqualTypeOf<(n: number) => string>();
		expectTypeOf(flow(inc, toStr, len, inc, toStr, len, inc, toStr, len)).toEqualTypeOf<(n: number) => number>();
		expectTypeOf(flow(inc, toStr, len, inc, toStr, len, inc, toStr, len, inc)).toEqualTypeOf<(n: number) => number>();

		// Multi-argument first function
		const multi = flow((a: number, b: string) => a + b.length, inc);
		expectTypeOf(multi).toEqualTypeOf<(a: number, b: string) => number>();
	});

	it("inspects asynchronous flowAsync overloads with Promise, Deferred, and sync values", () => {
		const asyncInc = (n: number) => Promise.resolve(n + 1);
		const deferredStr = (n: number) => Deferred.from.Promise(Promise.resolve(n.toString()));
		const syncLen = (s: string) => s.length;

		expectTypeOf(flowAsync(asyncInc)).toEqualTypeOf<(a: Awaitable<number>) => Promise<number>>();
		expectTypeOf(flowAsync(asyncInc, deferredStr)).toEqualTypeOf<(a: Awaitable<number>) => Promise<string>>();
		expectTypeOf(flowAsync(asyncInc, deferredStr, syncLen)).toEqualTypeOf<(a: Awaitable<number>) => Promise<number>>();
		expectTypeOf(flowAsync(asyncInc, deferredStr, syncLen, asyncInc)).toEqualTypeOf<
			(a: Awaitable<number>) => Promise<number>
		>();
		expectTypeOf(flowAsync(asyncInc, deferredStr, syncLen, asyncInc, deferredStr)).toEqualTypeOf<
			(a: Awaitable<number>) => Promise<string>
		>();
		expectTypeOf(flowAsync(asyncInc, deferredStr, syncLen, asyncInc, deferredStr, syncLen)).toEqualTypeOf<
			(a: Awaitable<number>) => Promise<number>
		>();
		expectTypeOf(flowAsync(asyncInc, deferredStr, syncLen, asyncInc, deferredStr, syncLen, asyncInc)).toEqualTypeOf<
			(a: Awaitable<number>) => Promise<number>
		>();
		expectTypeOf(flowAsync(asyncInc, deferredStr, syncLen, asyncInc, deferredStr, syncLen, asyncInc, deferredStr))
			.toEqualTypeOf<(a: Awaitable<number>) => Promise<string>>();
		expectTypeOf(
			flowAsync(asyncInc, deferredStr, syncLen, asyncInc, deferredStr, syncLen, asyncInc, deferredStr, syncLen),
		).toEqualTypeOf<(a: Awaitable<number>) => Promise<number>>();
		expectTypeOf(
			flowAsync(asyncInc, deferredStr, syncLen, asyncInc, deferredStr, syncLen, asyncInc, deferredStr, syncLen, asyncInc),
		).toEqualTypeOf<(a: Awaitable<number>) => Promise<number>>();
	});

	it("rejects invalid input and mismatched function types in pipeline", () => {
		// @ts-expect-error mismatched intermediate pipeline step
		expectTypeOf(flow((n: number) => n.toString(), (n: number) => n + 1)).toBeFunction();
	});
});
