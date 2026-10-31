import fc from "fast-check";
import { expect, test } from "vitest";
import { Batcher } from "../Batcher.ts";
import { Deferred } from "../Deferred.ts";
import { Result } from "../Result.ts";

test("property: fetch receives strictly unique keys under concurrent load", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.array(fc.string({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 25 }),
			async (keys) => {
				const uniqueSet = new Set(keys);
				let dispatchedKeys: readonly string[] = [];

				const batcher = Batcher.make({
					fetch: (batchKeys: readonly string[]) => () => {
						dispatchedKeys = batchKeys;
						const map = new Map(batchKeys.map((k) => [k, `val_${k}`]));
						return Deferred.from.Promise(Promise.resolve(Result.make.ok(map)));
					},
				});

				const results = await Promise.all(keys.map((k) => batcher.load(k)));

				expect(dispatchedKeys).toHaveLength(uniqueSet.size);
				expect(new Set(dispatchedKeys).size).toBe(uniqueSet.size);
				expect(results).toHaveLength(keys.length);
			},
		),
	);
});

test("property: chunks are strictly bounded by maxBatchSize", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 30 }),
			fc.integer({ min: 1, max: 5 }),
			async (rawKeys, maxBatchSize) => {
				const keys = Array.from(new Set(rawKeys));
				const chunks: (readonly number[])[] = [];

				const batcher = Batcher.make({
					fetch: (batchKeys: readonly number[]) => () => {
						chunks.push(batchKeys);
						const map = new Map(batchKeys.map((k) => [k, k * 2]));
						return Deferred.from.Promise(Promise.resolve(Result.make.ok(map)));
					},
					maxBatchSize,
				});

				await Promise.all(keys.map((k) => batcher.load(k)));

				for (let i = 0; i < chunks.length; i++) {
					expect(chunks[i].length).toBeLessThanOrEqual(maxBatchSize);
					expect(chunks[i].length).toBeGreaterThan(0);
				}
			},
		),
	);
});

test("property: outcomes correspond strictly to dictionary presence vs absence", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.dictionary(fc.string({ minLength: 1, maxLength: 4 }), fc.integer()),
			fc.array(fc.string({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 15 }),
			async (availableMap, lookupKeys) => {
				const available = new Map(Object.entries(availableMap));

				const batcher = Batcher.make({
					fetch: (keys: readonly string[]) => () => {
						const map = new Map<string, number>();
						for (let i = 0; i < keys.length; i++) {
							if (available.has(keys[i])) {
								map.set(keys[i], available.get(keys[i])!);
							}
						}
						return Deferred.from.Promise(Promise.resolve(Result.make.ok(map)));
					},
				});

				const outcomes = await Promise.all(lookupKeys.map((k) => batcher.load(k)));

				for (let i = 0; i < lookupKeys.length; i++) {
					const k = lookupKeys[i];
					const outcome = outcomes[i];
					const expected = available.has(k) ? Batcher.Outcome.make.ok(available.get(k)!) : Batcher.Outcome.make.missing(k);
					expect(outcome).toStrictEqual(expected);
				}
			},
		),
	);
});

test("property: loadMany preserves exact input order and discrete per-key outcomes", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.array(fc.string({ minLength: 1, maxLength: 4 }), { minLength: 0, maxLength: 20 }),
			fc.array(fc.string({ minLength: 1, maxLength: 4 }), { minLength: 0, maxLength: 10 }),
			async (keys, availableKeys) => {
				const available = new Set(availableKeys);
				const batcher = Batcher.make({
					fetch: (batchKeys: readonly string[]) => () => {
						const map = new Map<string, string>();
						for (let i = 0; i < batchKeys.length; i++) {
							const k = batchKeys[i];
							if (available.has(k)) {
								map.set(k, `val_${k}`);
							}
						}
						return Deferred.from.Promise(Promise.resolve(Result.make.ok(map)));
					},
				});

				const outcomes = await batcher.loadMany(keys);

				expect(outcomes).toHaveLength(keys.length);
				for (let i = 0; i < keys.length; i++) {
					const k = keys[i];
					const outcome = outcomes[i];
					const expected = available.has(k) ? Batcher.Outcome.make.ok(`val_${k}`) : Batcher.Outcome.make.missing(k);
					expect(outcome).toStrictEqual(expected);
				}
			},
		),
	);
});

test("property: non-integer or non-positive maxBatchSize safely defaults to Infinity without chunking", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 2, maxLength: 10 }),
			fc.oneof(fc.double({ noInteger: true }), fc.constant(NaN), fc.integer({ max: 0 })),
			async (rawKeys, invalidMaxBatchSize) => {
				const keys = Array.from(new Set(rawKeys));
				const chunks: (readonly number[])[] = [];

				const batcher = Batcher.make({
					fetch: (batchKeys: readonly number[]) => () => {
						chunks.push(batchKeys);
						const map = new Map(batchKeys.map((k) => [k, k]));
						return Deferred.from.Promise(Promise.resolve(Result.make.ok(map)));
					},
					maxBatchSize: invalidMaxBatchSize,
				});

				await Promise.all(keys.map((k) => batcher.load(k)));

				expect(chunks).toHaveLength(1);
				expect(chunks[0]).toHaveLength(keys.length);
			},
		),
	);
});

test("property: Outcome.map satisfies functor identity and composition laws", async () => {
	const outcomeGen = fc.oneof(
		fc.string().map((s) => Batcher.Outcome.make.ok<string, string, string>(s)),
		fc.string().map((k) => Batcher.Outcome.make.missing<string, string, string>(k)),
		fc.string().map((e) => Batcher.Outcome.make.err<string, string, string>(e)),
	);

	const f = (s: string): number => s.length;
	const g = (n: number): string => `len:${n}`;

	await fc.assert(fc.property(outcomeGen, (outcome) => {
		// Identity law: map(id) === id
		const identityMapped = Batcher.Outcome.map((x: string) => x)(outcome);
		expect(identityMapped).toStrictEqual(outcome);

		// Composition law: map(g . f) === map(g) . map(f)
		const composedDirect = Batcher.Outcome.map((x: string) => g(f(x)))(outcome);
		const composedChained = Batcher.Outcome.map(g)(Batcher.Outcome.map(f)(outcome));
		expect(composedChained).toStrictEqual(composedDirect);
	}));
});
