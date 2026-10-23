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
