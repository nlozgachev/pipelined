import fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Resource } from "../Resource.ts";
import { Task } from "../Task.ts";

test("use: release always runs on successful work", async () => {
	await fc.assert(fc.asyncProperty(fc.integer(), fc.string(), async (val, workResult) => {
		let released = false;
		const res = Resource.make(Task.Result.make.ok(val), (_n) =>
			Task.tryCatch(() => {
				released = true;
				return Promise.resolve();
			}, { onError: () => {} }));

		const result = await pipe(res, Resource.use((_n) => Task.Result.make.ok(workResult)))();

		expect(released).toBe(true);
		expect(result).toStrictEqual({ kind: "Ok", value: workResult });
	}));
});

test("use: release always runs on work failure", async () => {
	await fc.assert(fc.asyncProperty(fc.integer(), fc.string(), async (val, workError) => {
		let released = false;
		const res = Resource.make(Task.Result.make.ok(val), (_n) =>
			Task.tryCatch(() => {
				released = true;
				return Promise.resolve();
			}, { onError: () => {} }));

		const result = await pipe(res, Resource.use((_n) => Task.Result.make.err(workError)))();

		expect(released).toBe(true);
		expect(result).toStrictEqual({ kind: "Err", error: workError });
	}));
});

test("use: release never runs when acquire fails", async () => {
	await fc.assert(fc.asyncProperty(fc.string(), async (acquireError) => {
		let released = false;
		let workCalled = false;
		const res = Resource.make(Task.Result.make.err(acquireError), (_n) =>
			Task.tryCatch(() => {
				released = true;
				return Promise.resolve();
			}, { onError: () => {} }));

		const result = await pipe(
			res,
			Resource.use((_n) => {
				workCalled = true;
				return Task.Result.make.ok(42);
			}),
		)();

		expect(released).toBe(false);
		expect(workCalled).toBe(false);
		expect(result).toStrictEqual({ kind: "Err", error: acquireError });
	}));
});

test("combine: releases in reverse acquisition order", async () => {
	await fc.assert(fc.asyncProperty(fc.integer(), fc.string(), async (valA, valB) => {
		const releaseOrder: string[] = [];

		const resA = Resource.make(Task.Result.make.ok(valA), (_n) =>
			Task.tryCatch(() => {
				releaseOrder.push("A");
				return Promise.resolve();
			}, { onError: () => {} }));
		const resB = Resource.make(Task.Result.make.ok(valB), (_s) =>
			Task.tryCatch(() => {
				releaseOrder.push("B");
				return Promise.resolve();
			}, { onError: () => {} }));

		const combined = Resource.combine(resA, resB);
		await pipe(combined, Resource.use(([_a, _b]) => Task.Result.make.ok(true)))();

		expect(releaseOrder).toStrictEqual(["B", "A"]);
	}));
});

test("map: satisfies functor identity law", async () => {
	await fc.assert(fc.asyncProperty(fc.integer(), async (val) => {
		const res = Resource.make(Task.Result.make.ok(val), () => Task.make(undefined));
		const mapped = pipe(res, Resource.map((x) => x));

		const resultOriginal = await pipe(res, Resource.use((n) => Task.Result.make.ok(n)))();
		const resultMapped = await pipe(mapped, Resource.use((n) => Task.Result.make.ok(n)))();

		expect(resultMapped).toStrictEqual(resultOriginal);
	}));
});

test("map: satisfies functor composition law", async () => {
	await fc.assert(fc.asyncProperty(fc.integer(), async (val) => {
		const f = (x: number) => x * 3;
		const g = (x: number) => `str:${x + 1}`;

		const res = Resource.make(Task.Result.make.ok(val), () => Task.make(undefined));

		const composedSeparately = pipe(res, Resource.map(f), Resource.map(g));

		const composedFused = pipe(res, Resource.map((x) => g(f(x))));

		const resultSeparate = await pipe(composedSeparately, Resource.use((s) => Task.Result.make.ok(s)))();
		const resultFused = await pipe(composedFused, Resource.use((s) => Task.Result.make.ok(s)))();

		expect(resultSeparate).toStrictEqual(resultFused);
	}));
});

test("chain: releases in strict reverse order across arbitrary pairs", async () => {
	await fc.assert(fc.asyncProperty(fc.integer(), fc.string(), async (valA, valB) => {
		const releaseOrder: string[] = [];

		const resA = Resource.make(Task.Result.make.ok(valA), (_n) =>
			Task.tryCatch(() => {
				releaseOrder.push("outer");
				return Promise.resolve();
			}, { onError: () => {} }));

		const resB = (prefix: number) =>
			Resource.make(Task.Result.make.ok(`${prefix}:${valB}`), (_s) =>
				Task.tryCatch(() => {
					releaseOrder.push("inner");
					return Promise.resolve();
				}, { onError: () => {} }));

		const chained = pipe(resA, Resource.chain(resB));

		await pipe(chained, Resource.use((_val) => Task.Result.make.ok(true)))();

		expect(releaseOrder).toStrictEqual(["inner", "outer"]);
	}));
});

test("all: releases arbitrary arrays of resources in strict reverse LIFO order", async () => {
	await fc.assert(fc.asyncProperty(fc.array(fc.integer(), { minLength: 1, maxLength: 8 }), async (values) => {
		const releaseOrder: number[] = [];

		const resources = values.map((val, idx) =>
			Resource.make(Task.Result.make.ok(val), () =>
				Task.tryCatch(() => {
					releaseOrder.push(idx);
					return Promise.resolve();
				}, { onError: () => {} }))
		);

		const allRes = Resource.all(resources);
		await pipe(allRes, Resource.use((_vals) => Task.Result.make.ok(true)))();

		const expectedOrder = values.map((_v, idx) => idx).reverse();
		expect(releaseOrder).toStrictEqual(expectedOrder);
	}));
});
