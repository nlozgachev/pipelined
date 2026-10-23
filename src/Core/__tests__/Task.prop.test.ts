import fc from "fast-check";
import { expect, test } from "vitest";
import { Task } from "../Task.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbValue = fc.integer();
const arbError = fc.string({ minLength: 1 });

// ---------------------------------------------------------------------------
// Task: Functor & Monad Laws
// ---------------------------------------------------------------------------

test("map: satisfies functor identity law", async () => {
	await fc.assert(fc.asyncProperty(arbValue, async (val) => {
		const task = Task.make(val);
		const mapped = Task.map((x: number) => x)(task);
		await expect(mapped()).resolves.toBe(val);
	}));
});

test("map: satisfies functor composition law", async () => {
	await fc.assert(fc.asyncProperty(arbValue, fc.integer(), fc.integer(), async (val, a, b) => {
		const f = (x: number) => x + a;
		const g = (x: number) => x * b;
		const task = Task.make(val);

		const lhs = await Task.map(f)(Task.map(g)(task))();
		const rhs = await Task.map((x: number) => f(g(x)))(task)();

		expect(lhs).toBe(rhs);
	}));
});

test("chain: satisfies monad left identity", async () => {
	await fc.assert(fc.asyncProperty(arbValue, fc.integer(), async (val, k) => {
		const f = (x: number) => Task.make(x + k);
		const lhs = await Task.chain(f)(Task.make(val))();
		const rhs = await f(val)();

		expect(lhs).toBe(rhs);
	}));
});

test("chain: satisfies monad right identity", async () => {
	await fc.assert(fc.asyncProperty(arbValue, async (val) => {
		const task = Task.make(val);
		const chained = Task.chain(Task.make)(task);

		await expect(chained()).resolves.toBe(val);
	}));
});

test("chain: satisfies monad associativity", async () => {
	await fc.assert(fc.asyncProperty(arbValue, fc.integer(), fc.integer(), async (val, a, b) => {
		const f = (x: number) => Task.make(x + a);
		const g = (x: number) => Task.make(x * b);
		const task = Task.make(val);

		const lhs = await Task.chain(g)(Task.chain(f)(task))();
		const rhs = await Task.chain((x: number) => Task.chain(g)(f(x)))(task)();

		expect(lhs).toBe(rhs);
	}));
});

// ---------------------------------------------------------------------------
// Task.Result: Functor & Monad Laws
// ---------------------------------------------------------------------------

test("Result.map: satisfies functor identity law", async () => {
	await fc.assert(fc.asyncProperty(fc.boolean(), arbValue, arbError, async (isOk, val, err) => {
		const task: Task.Result<string, number> = isOk ? Task.Result.make.ok(val) : Task.Result.make.err(err);
		const mapped = Task.Result.map((x: number) => x)(task);

		await expect(mapped()).resolves.toStrictEqual(await task());
	}));
});

test("Result.map: satisfies functor composition law", async () => {
	await fc.assert(
		fc.asyncProperty(fc.boolean(), arbValue, arbError, fc.integer(), fc.integer(), async (isOk, val, err, a, b) => {
			const f = (x: number) => x + a;
			const g = (x: number) => x * b;
			const task: Task.Result<string, number> = isOk ? Task.Result.make.ok(val) : Task.Result.make.err(err);

			const lhs = await Task.Result.map(f)(Task.Result.map(g)(task))();
			const rhs = await Task.Result.map((x: number) => f(g(x)))(task)();

			expect(lhs).toStrictEqual(rhs);
		}),
	);
});

test("Result.chain: satisfies monad left identity", async () => {
	await fc.assert(fc.asyncProperty(arbValue, fc.integer(), async (val, k) => {
		const f = (x: number) => (x > 0 ? Task.Result.make.ok(x + k) : Task.Result.make.err("negative"));
		const lhs = await Task.Result.chain(f)(Task.Result.make.ok(val))();
		const rhs = await f(val)();

		expect(lhs).toStrictEqual(rhs);
	}));
});

test("Result.chain: satisfies monad right identity", async () => {
	await fc.assert(fc.asyncProperty(fc.boolean(), arbValue, arbError, async (isOk, val, err) => {
		const task: Task.Result<string, number> = isOk ? Task.Result.make.ok(val) : Task.Result.make.err(err);
		const chained = Task.Result.chain((v: number) => Task.Result.make.ok(v))(task);

		await expect(chained()).resolves.toStrictEqual(await task());
	}));
});

test("Result.bimap: satisfies identity law", async () => {
	await fc.assert(fc.asyncProperty(fc.boolean(), arbValue, arbError, async (isOk, val, err) => {
		const task: Task.Result<string, number> = isOk ? Task.Result.make.ok(val) : Task.Result.make.err(err);
		const mapped = Task.Result.bimap((e: string) => e, (v: number) => v)(task);

		await expect(mapped()).resolves.toStrictEqual(await task());
	}));
});

// ---------------------------------------------------------------------------
// Task.Maybe: Functor & Monad Laws
// ---------------------------------------------------------------------------

test("Maybe.map: satisfies functor identity law", async () => {
	await fc.assert(fc.asyncProperty(fc.boolean(), arbValue, async (isSome, val) => {
		const task = isSome ? Task.Maybe.make.some(val) : Task.Maybe.make.none<number>();
		const mapped = Task.Maybe.map((x: number) => x)(task);

		await expect(mapped()).resolves.toStrictEqual(await task());
	}));
});

test("Maybe.chain: satisfies monad left identity", async () => {
	await fc.assert(fc.asyncProperty(arbValue, fc.integer(), async (val, k) => {
		const f = (x: number) => (x % 2 === 0 ? Task.Maybe.make.some(x + k) : Task.Maybe.make.none<number>());
		const lhs = await Task.Maybe.chain(f)(Task.Maybe.make.some(val))();
		const rhs = await f(val)();

		expect(lhs).toStrictEqual(rhs);
	}));
});

test("Maybe.chain: satisfies monad right identity", async () => {
	await fc.assert(fc.asyncProperty(fc.boolean(), arbValue, async (isSome, val) => {
		const task = isSome ? Task.Maybe.make.some(val) : Task.Maybe.make.none<number>();
		const chained = Task.Maybe.chain((v: number) => Task.Maybe.make.some(v))(task);

		await expect(chained()).resolves.toStrictEqual(await task());
	}));
});

// ---------------------------------------------------------------------------
// Task.Validation: Functor & Applicative Accumulation
// ---------------------------------------------------------------------------

test("Validation.map: satisfies functor identity law", async () => {
	await fc.assert(fc.asyncProperty(fc.boolean(), arbValue, arbError, async (isPassed, val, err) => {
		const task: Task.Validation<string, number> = isPassed
			? Task.Validation.make.passed(val)
			: Task.Validation.make.failed(err);
		const mapped = Task.Validation.map((x: number) => x)(task);

		await expect(mapped()).resolves.toStrictEqual(await task());
	}));
});

test("Validation.apply: accumulates errors from both sides", async () => {
	await fc.assert(fc.asyncProperty(arbError, arbError, async (err1, err2) => {
		const fnTask = Task.Validation.make.failed(err1);
		const argTask = Task.Validation.make.failed(err2);
		const combined = Task.Validation.apply(argTask)(fnTask);

		const result = await combined();
		expect(result).toStrictEqual({ kind: "Failed", errors: [err1, err2] });
	}));
});
