import { pipe } from "#composition";
import { Op } from "#core";
import { test } from "vitest";

const pipeFn = pipe;
const outcomeMake = Op.Outcome.make;
const outcomeMap = Op.Outcome.map;
const outcomeChain = Op.Outcome.chain;
const outcomeFold = Op.Outcome.fold;
const opCreate = Op.create;
const opInterpret = Op.interpret;

// =============================================================================
// Scenario 1: Sync Outcome Transformations
// =============================================================================

test("op-sync-transformations", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Op.Outcome.map + Op.Outcome.chain + Op.Outcome.fold", () => {
			const outcome = outcomeMake.ok(42);
			void pipeFn(
				outcome,
				outcomeMap((x: number) => x * 2),
				outcomeChain((x: number) => outcomeMake.ok(x + 1)),
				outcomeFold((err: unknown) => `err:${String(err)}`, () => "nil", (val: number) =>
					`ok:${val}`),
			);
		}),
		bench("2. manual inline outcome checks", () => {
			const outcome = outcomeMake.ok(42) as Op.Outcome<string, number>;
			const s1 = outcome.kind === "OpOk" ? outcomeMake.ok(outcome.value * 2) : outcome;
			const s2 = s1.kind === "OpOk" ? outcomeMake.ok(s1.value + 1) : s1;
			const res = s2.kind === "OpOk" ? `ok:${s2.value}` : s2.kind === "OpErr" ? `err:${s2.error}` : "nil";
			void res;
		}),
	);
});

// =============================================================================
// Scenario 2: Op.interpret Execution
// =============================================================================

test("op-interpret-execution", async ({ bench }) => {
	const op = opCreate((_signal: AbortSignal) => (n: number) => Promise.resolve(n * 2), { onError: String });
	const manager = opInterpret(op, { strategy: "once" });

	await bench.compare(
		bench("1. Op.interpret execution", async () => {
			await manager.run(50);
		}),
		bench("2. Native Promise async resolution", async () => {
			await Promise.resolve(100);
		}),
	);
});
