import { pipe, tap } from "#composition";
import { Deferred } from "#core";
import { expect, test, vi } from "vitest";

test("tap - side effect executes", () => {
	let sideEffect = 0;
	const fn = tap((n: number) => {
		sideEffect = n;
	});
	fn(42);
	expect(sideEffect).toBe(42);
});

test("tap - returns original value unchanged", () => {
	const fn = tap((_n: number) => {
		// side effect
	});
	expect(fn(42)).toBe(42);
});

test("tap - returns the exact same reference for objects", () => {
	const obj = { name: "Alice" };
	const fn = tap((_o: typeof obj) => {
		// side effect
	});
	expect(fn(obj)).toBe(obj);
});

test("tap - works with string values", () => {
	let captured = "";
	const fn = tap((s: string) => {
		captured = s;
	});
	expect(fn("hello")).toBe("hello");
	expect(captured).toBe("hello");
});

test("tap - works in pipe", () => {
	const log: number[] = [];

	const result = pipe(
		5,
		(n: number) => n * 2,
		tap((n: number) => log.push(n)),
		(n: number) => n + 1,
		tap((n: number) => log.push(n)),
	);

	expect(result).toBe(11);
	expect(log).toStrictEqual([10, 11]);
});

test("tap - side effect does not influence the return value", () => {
	const fn = tap((_n: number) => 999); // return value is ignored
	expect(fn(42)).toBe(42);
});

test("tap - multiple taps in sequence", () => {
	const effects: string[] = [];

	const result = pipe(
		"hello",
		tap((s: string) => effects.push(`first: ${s}`)),
		(s: string) => s.toUpperCase(),
		tap((s: string) => effects.push(`second: ${s}`)),
		(s: string) => `${s}!`,
		tap((s: string) => effects.push(`third: ${s}`)),
	);

	expect(result).toBe("HELLO!");
	expect(effects).toStrictEqual(["first: hello", "second: HELLO", "third: HELLO!"]);
});

test("tap - works with arrays", () => {
	let length = 0;
	const arr = [1, 2, 3];

	const result = pipe(
		arr,
		tap((a: number[]) => {
			({ length } = a);
		}),
	);

	expect(result).toBe(arr);
	expect(length).toBe(3);
});

// --- tap.log ---

test("tap.log - logs formatted string to custom logger", () => {
	let logged = "";
	const logger = (msg: string) => {
		logged = msg;
	};

	const res = pipe(42, tap.log({ logger }));

	expect(res).toBe(42);
	expect(logged).toBe("42");
});

test("tap.log - applies label prefix when provided", () => {
	let logged = "";
	const logger = (msg: string) => {
		logged = msg;
	};

	const res = pipe("hello", tap.log({ label: "Greeting", logger }));

	expect(res).toBe("hello");
	expect(logged).toBe("[Greeting]: hello");
});

test("tap.log - uses custom formatter when provided", () => {
	let logged = "";
	const logger = (msg: string) => {
		logged = msg;
	};

	const res = pipe({ value: 10 }, tap.log({ logger, formatter: (obj) => `value is ${obj.value}` }));

	expect(res).toStrictEqual({ value: 10 });
	expect(logged).toBe("value is 10");
});

// --- tap.inspect ---

test("tap.inspect - prints deep object structure using node inspect", () => {
	const spy = vi.spyOn(console, "log").mockImplementation(() => {});
	const obj = { nested: { deep: { value: 100 } } };

	const res = pipe(obj, tap.inspect());

	expect(res).toBe(obj);
	expect(spy).toHaveBeenCalledWith(expect.any(String));
	const [firstCall] = spy.mock.calls;
	const printed = firstCall?.[0];
	expect(printed).toContain("nested");
	expect(printed).toContain("deep");
	expect(printed).toContain("100");
	spy.mockRestore();
});

test("tap.inspect - prepends label prefix when provided", () => {
	const spy = vi.spyOn(console, "log").mockImplementation(() => {});
	const obj = { a: 1 };

	pipe(obj, tap.inspect({ label: "Debug" }));

	expect(spy).toHaveBeenCalledWith(expect.any(String));
	const [firstCall] = spy.mock.calls;
	expect(firstCall?.[0]).toContain("[Debug]:");
	spy.mockRestore();
});

// --- tap.async ---

test("tap.async - executes side effect asynchronously and returns value immediately", async () => {
	let resolved = false;
	const asyncSideEffect = async (_n: number) => {
		await new Promise((resolve) => setTimeout(resolve, 10));
		resolved = true;
	};

	const res = pipe(42, tap.async(asyncSideEffect));

	// Should return value immediately before the 10ms promise completes
	expect(res).toBe(42);
	expect(resolved).toBe(false);

	// Wait for the side effect to complete
	await new Promise((resolve) => setTimeout(resolve, 15));
	expect(resolved).toBe(true);
});

test("tap.async - catches promise rejection and routes it to onError", async () => {
	let caughtError: unknown = null;
	const failingAsyncEffect = async () => {
		await Promise.resolve();
		throw new Error("async failure");
	};

	const res = pipe(
		42,
		tap.async(failingAsyncEffect, {
			onError: (err) => {
				caughtError = err;
			},
		}),
	);

	expect(res).toBe(42);
	expect(caughtError).toBeNull();

	// Yield event loop to let promise rejection run catch handler
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(caughtError).toBeInstanceOf(Error);
	expect((caughtError as Error).message).toBe("async failure");
});

// --- tap.time ---

test("tap.time - times synchronous function and triggers onFinish callback", () => {
	let finishedDuration: any = null;
	const syncFn = (n: number) => n * 2;

	const res = pipe(
		10,
		tap.time(syncFn, {
			onFinish: (dur) => {
				finishedDuration = dur;
			},
		}),
	);

	expect(res).toBe(10);
	expect(finishedDuration).not.toBeNull();
});

test("tap.time - times asynchronous function resolving and triggers onFinish asynchronously", async () => {
	let finishedDuration: any = null;
	const asyncFn = async (_n: number) => {
		await new Promise((resolve) => setTimeout(resolve, 10));
	};

	const res = pipe(
		10,
		tap.time(asyncFn, {
			onFinish: (dur) => {
				finishedDuration = dur;
			},
		}),
	);

	expect(res).toBe(10);
	expect(finishedDuration).toBeNull(); // Still running

	// Wait for the async function to resolve
	await new Promise((resolve) => setTimeout(resolve, 15));
	expect(finishedDuration).not.toBeNull();
});

test("tap.time - still triggers onFinish callback and propagates if function throws", () => {
	let finishedDuration: any = null;
	const throwingFn = () => {
		throw new Error("sync crash");
	};

	expect(() => {
		pipe(
			42,
			tap.time(throwingFn, {
				onFinish: (dur) => {
					finishedDuration = dur;
				},
			}),
		);
	}).toThrow("sync crash");

	expect(finishedDuration).not.toBeNull();
});

test("tap.time - logs to console when label config is provided", () => {
	const spy = vi.spyOn(console, "log").mockImplementation(() => {});
	const syncFn = (n: number) => n * 2;

	pipe(10, tap.time(syncFn, { label: "timer-label" }));

	expect(spy).toHaveBeenCalledWith(expect.any(String));
	const [firstCall] = spy.mock.calls;
	expect(firstCall?.[0]).toContain("[timer-label]:");
	spy.mockRestore();
});

test("tap.log - handles circular objects gracefully", () => {
	let logged = "";
	const logger = (msg: string) => {
		logged = msg;
	};
	const circular: any = {};
	circular.self = circular;

	const res = pipe(circular, tap.log({ logger }));

	expect(res).toBe(circular);
	expect(logged).toBe("[object Object]");
});

test("tap.inspect - fallback formatting handles circular objects gracefully", async () => {
	vi.resetModules();
	// oxlint-disable-next-line vitest/prefer-import-in-mock
	vi.doMock("node:util", () => ({ inspect: undefined }));
	const { tap: dynamicTap } = await import("../tap");
	const spy = vi.spyOn(console, "log").mockImplementation(() => {});
	const circular: any = {};
	circular.self = circular;

	// Satisfy code coverage for the dynamically imported module instance
	dynamicTap(() => {})(10);
	dynamicTap.log({ label: "test" })(10);
	dynamicTap.async(async () => {})(10);
	dynamicTap.time(() => {}, { label: "test" })(10);

	dynamicTap.inspect()(circular);

	expect(spy).toHaveBeenCalledWith("[object Object]");
	spy.mockRestore();
	vi.doUnmock("node:util");
	vi.resetModules();
});

test("tap.time - times asynchronous function rejecting, triggers onFinish, and handles rejection", async () => {
	let finishedDuration: any = null;
	let capturedPromise: Promise<any> | null = null;
	const asyncRejectFn = (_n: number) => {
		capturedPromise = (async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			throw new Error("async reject");
		})();
		return capturedPromise;
	};

	const res = pipe(
		10,
		tap.time(asyncRejectFn, {
			onFinish: (dur) => {
				finishedDuration = dur;
			},
		}),
	);

	expect(res).toBe(10);
	expect(finishedDuration).toBeNull();

	await expect(capturedPromise).rejects.toThrow("async reject");
	expect(finishedDuration).not.toBeNull();
});

test("tap.async - works with Deferred", async () => {
	let resolved = false;
	const deferredFn = (_n: number) => {
		const p = new Promise<void>((resolve) => setTimeout(resolve, 10));
		return Deferred.fromPromise(p.then(() => {
			resolved = true;
		}));
	};

	const res = pipe(42, tap.async(deferredFn));

	expect(res).toBe(42);
	expect(resolved).toBe(false);

	// Wait for the deferred side effect to complete
	await new Promise((resolve) => setTimeout(resolve, 15));
	expect(resolved).toBe(true);
});

test("tap.time - times Deferred function and triggers onFinish asynchronously", async () => {
	let finishedDuration: any = null;
	const deferredFn = (_n: number) => {
		const p = new Promise<void>((resolve) => setTimeout(resolve, 10));
		return Deferred.fromPromise(p);
	};

	const res = pipe(
		10,
		tap.time(deferredFn, {
			onFinish: (dur) => {
				finishedDuration = dur;
			},
		}),
	);

	expect(res).toBe(10);
	expect(finishedDuration).toBeNull(); // Still running

	// Wait for the deferred to resolve
	await new Promise((resolve) => setTimeout(resolve, 15));
	expect(finishedDuration).not.toBeNull();
});
