import { describe, expectTypeOf, it } from "vitest";
import { Deferred } from "../../Core/Deferred.ts";
import { pipe } from "../pipe.ts";
import { pipeAsync } from "../pipeAsync.ts";

describe("pipe and pipeAsync type-level tests", () => {
	it("inspects synchronous pipe overloads from 1 to 10 functions", () => {
		const inc = (n: number) => n + 1;
		const toStr = (n: number) => n.toString();
		const len = (s: string) => s.length;

		expectTypeOf(pipe(5)).toEqualTypeOf<number>();
		expectTypeOf(pipe(5, inc)).toEqualTypeOf<number>();
		expectTypeOf(pipe(5, inc, toStr)).toEqualTypeOf<string>();
		expectTypeOf(pipe(5, inc, toStr, len)).toEqualTypeOf<number>();
		expectTypeOf(pipe(5, inc, toStr, len, inc)).toEqualTypeOf<number>();
		expectTypeOf(pipe(5, inc, toStr, len, inc, toStr)).toEqualTypeOf<string>();
		expectTypeOf(pipe(5, inc, toStr, len, inc, toStr, len)).toEqualTypeOf<number>();
		expectTypeOf(pipe(5, inc, toStr, len, inc, toStr, len, inc)).toEqualTypeOf<number>();
		expectTypeOf(pipe(5, inc, toStr, len, inc, toStr, len, inc, toStr)).toEqualTypeOf<string>();
		expectTypeOf(pipe(5, inc, toStr, len, inc, toStr, len, inc, toStr, len)).toEqualTypeOf<number>();
		expectTypeOf(pipe(5, inc, toStr, len, inc, toStr, len, inc, toStr, len, inc)).toEqualTypeOf<number>();
	});

	it("inspects asynchronous pipeAsync overloads with Promise, Deferred, and sync values", () => {
		const asyncInc = (n: number) => Promise.resolve(n + 1);
		const deferredStr = (n: number) => Deferred.from.Promise(Promise.resolve(n.toString()));
		const syncLen = (s: string) => s.length;

		expectTypeOf(pipeAsync(5)).toEqualTypeOf<Promise<number>>();
		expectTypeOf(pipeAsync(Promise.resolve(5))).toEqualTypeOf<Promise<number>>();
		expectTypeOf(pipeAsync(5, asyncInc)).toEqualTypeOf<Promise<number>>();
		expectTypeOf(pipeAsync(5, asyncInc, deferredStr)).toEqualTypeOf<Promise<string>>();
		expectTypeOf(pipeAsync(5, asyncInc, deferredStr, syncLen)).toEqualTypeOf<Promise<number>>();
		expectTypeOf(pipeAsync(5, asyncInc, deferredStr, syncLen, asyncInc)).toEqualTypeOf<Promise<number>>();
		expectTypeOf(pipeAsync(5, asyncInc, deferredStr, syncLen, asyncInc, deferredStr)).toEqualTypeOf<Promise<string>>();
		expectTypeOf(pipeAsync(5, asyncInc, deferredStr, syncLen, asyncInc, deferredStr, syncLen)).toEqualTypeOf<
			Promise<number>
		>();
		expectTypeOf(pipeAsync(5, asyncInc, deferredStr, syncLen, asyncInc, deferredStr, syncLen, asyncInc)).toEqualTypeOf<
			Promise<number>
		>();
		expectTypeOf(pipeAsync(5, asyncInc, deferredStr, syncLen, asyncInc, deferredStr, syncLen, asyncInc, deferredStr))
			.toEqualTypeOf<Promise<string>>();
		expectTypeOf(
			pipeAsync(5, asyncInc, deferredStr, syncLen, asyncInc, deferredStr, syncLen, asyncInc, deferredStr, syncLen),
		).toEqualTypeOf<Promise<number>>();
		expectTypeOf(
			pipeAsync(
				5,
				asyncInc,
				deferredStr,
				syncLen,
				asyncInc,
				deferredStr,
				syncLen,
				asyncInc,
				deferredStr,
				syncLen,
				asyncInc,
			),
		).toEqualTypeOf<Promise<number>>();
	});

	it("rejects invalid input and mismatched function types in pipeline", () => {
		// @ts-expect-error number cannot be passed to a function expecting string
		expectTypeOf(pipe(5, (s: string) => s.length)).toBeNumber();

		// @ts-expect-error mismatched intermediate pipeline step
		expectTypeOf(pipe(5, (n: number) => n.toString(), (n: number) => n + 1)).toBeNumber();
	});
});
