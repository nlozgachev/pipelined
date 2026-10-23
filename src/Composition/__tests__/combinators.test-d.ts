import { describe, expectTypeOf, it } from "vitest";
import { converge } from "../converge.ts";
import { juxt } from "../juxt.ts";
import { memoize, memoizeWeak } from "../memoize.ts";
import { on } from "../on.ts";
import { pipe } from "../pipe.ts";
import { struct } from "../struct.ts";
import { tap, tapAsync, tapInspect, tapLog, tapTime } from "../tap.ts";
import { unless } from "../unless.ts";
import { when } from "../when.ts";

describe("composition combinators type-level tests", () => {
	it("inspects when and unless with homogeneous and heterogeneous returns", () => {
		const isEven = (n: number) => n % 2 === 0;

		const whenHomogeneous = pipe(5, when(isEven, (n) => n * 2));
		expectTypeOf(whenHomogeneous).toEqualTypeOf<number>();

		const whenWidened = pipe(5, when(isEven, (n) => n.toString()));
		expectTypeOf(whenWidened).toEqualTypeOf<number | string>();

		const unlessHomogeneous = pipe(5, unless(isEven, (n) => n * 2));
		expectTypeOf(unlessHomogeneous).toEqualTypeOf<number>();

		const unlessWidened = pipe(5, unless(isEven, (n) => n.toString()));
		expectTypeOf(unlessWidened).toEqualTypeOf<number | string>();
	});

	it("inspects struct in pipeline and standalone", () => {
		type User = { firstName: string; lastName: string; age: number; };
		const user: User = { firstName: "Alice", lastName: "Smith", age: 30 };

		const pipelineStruct = pipe(
			user,
			struct({ fullName: (u) => `${u.firstName} ${u.lastName}`, isAdult: (u) => u.age >= 18 }),
		);
		expectTypeOf(pipelineStruct).toEqualTypeOf<{ fullName: string; isAdult: boolean; }>();

		const standaloneStruct = struct<number, { double: number; str: string; }>({
			double: (n) => n * 2,
			str: (n) => `n: ${n}`,
		});
		expectTypeOf(standaloneStruct(5)).toEqualTypeOf<{ double: number; str: string; }>();
	});

	it("inspects converge, juxt, and on with readonly tuples", () => {
		const conv = converge(
			(s: string, n: number) => ({ s, n }),
			[(x: number) => x.toString(), (x: number) => x * 2] as const,
		);
		expectTypeOf(conv(5)).toEqualTypeOf<{ s: string; n: number; }>();

		const jx = juxt([(x: number) => x.toString(), (x: number) => x > 0] as const);
		expectTypeOf(jx(5)).toEqualTypeOf<[string, boolean]>();

		const byLength = on((a: number, b: number) => a - b, (s: string) => s.length);
		expectTypeOf(byLength("apple", "pie")).toEqualTypeOf<number>();
	});

	it("inspects memoize and memoizeWeak", () => {
		const memo = memoize((n: number) => n.toString(), { maxSize: 10 });
		expectTypeOf(memo).toEqualTypeOf<(a: number) => string>();

		type KeyObj = { id: string; };
		const weakMemo = memoizeWeak((obj: KeyObj) => obj.id.length);
		expectTypeOf(weakMemo).toEqualTypeOf<(a: KeyObj) => number>();
	});

	it("inspects tap combinators", () => {
		expectTypeOf(pipe(42, tap((_n) => {}))).toEqualTypeOf<number>();
		expectTypeOf(pipe(42, tapLog())).toEqualTypeOf<number>();
		expectTypeOf(pipe(42, tapLog({ label: "Count" }))).toEqualTypeOf<number>();
		expectTypeOf(pipe({ id: 1 }, tapInspect({ depth: 2 }))).toEqualTypeOf<{ id: number; }>();
		expectTypeOf(pipe(42, tapAsync(async (_n) => {}))).toEqualTypeOf<number>();
		expectTypeOf(pipe(42, tapTime((_n) => {}, { label: "timer" }))).toEqualTypeOf<number>();
	});

	it("rejects invalid input types", () => {
		// @ts-expect-error non-object passed to memoizeWeak
		expectTypeOf(memoizeWeak((n: number) => n * 2)).toBeFunction();

		// @ts-expect-error missing onFinish or label in tapTime config
		expectTypeOf(tapTime((n: number) => n * 2, {})).toBeFunction();
	});
});
