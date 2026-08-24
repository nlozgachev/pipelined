import { pipe } from "#composition";
import { Op } from "#core";
import { bench, describe } from "vitest";

// =============================================================================
// Scenario 1: Sync Outcome Transformations
// =============================================================================

describe("op-sync-transformations", () => {
	bench("1. (current) Op.map + Op.chain + Op.fold", () => {
		const outcome = Op.make.ok(42);
		void pipe(
			outcome,
			Op.map((x: number) => x * 2),
			Op.chain((x: number) => Op.make.ok(x + 1)),
			Op.fold((err: unknown) => `err:${String(err)}`, () => "nil", (val: number) => `ok:${val}`),
		);
	});

	bench("2. manual inline outcome checks", () => {
		const outcome = Op.make.ok(42) as Op.Outcome<string, number>;
		const s1 = outcome.kind === "OpOk" ? Op.make.ok(outcome.value * 2) : outcome;
		const s2 = s1.kind === "OpOk" ? Op.make.ok(s1.value + 1) : s1;
		const _res = s2.kind === "OpOk" ? `ok:${s2.value}` : s2.kind === "OpErr" ? `err:${s2.error}` : "nil";
	});
});

// =============================================================================
// Scenario 2: Op.interpret Execution
// =============================================================================

describe("op-interpret-execution", () => {
	const op = Op.create(() => (n: number) => Promise.resolve(n * 2), (e) => String(e));
	const manager = Op.interpret(op, { strategy: "once" });

	bench("1. Op.interpret execution", async () => {
		await manager.run(50);
	});

	bench("2. Native Promise async resolution", async () => {
		await Promise.resolve(100);
	});
});
