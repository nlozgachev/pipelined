import { pipe } from "#composition";
import { Maybe, Result } from "#core";
import { bench, describe } from "vitest";

type MaybeVal = { kind: "Some"; value: number; } | { kind: "None"; };

// =============================================================================
// Scenario 1: Happy-path Maybe chain (5 steps)
// =============================================================================

describe("pipeline-maybe-happy", () => {
	bench("1. (current) pipe + Maybe ops", () => {
		void pipe(
			Maybe.some(42),
			Maybe.map((x) => x * 2),
			Maybe.filter((x) => x > 0),
			Maybe.chain((x) => Maybe.some(x + 1)),
			Maybe.getOrElse(() => 0),
		);
	});

	bench("2. manual inline", () => {
		const s1 = { kind: "Some" as const, value: 42 };
		const s2 = s1.kind === "Some" ? { kind: "Some" as const, value: s1.value * 2 } : s1;
		const s3 = s2.kind === "Some" ? (s2.value > 0 ? s2 : { kind: "None" as const }) : s2;
		const s4 = s3.kind === "Some" ? { kind: "Some" as const, value: s3.value + 1 } : s3;
		const _result = s4.kind === "Some" ? s4.value : 0;
	});
});

// =============================================================================
// Scenario 2: Short-circuiting Maybe chain (none at step 2)
// =============================================================================

describe("pipeline-maybe-short-circuit", () => {
	bench("1. (current) pipe + Maybe ops", () => {
		void pipe(
			Maybe.none() as Maybe<number>,
			Maybe.map((x) => x * 2),
			Maybe.filter((x) => x > 0),
			Maybe.chain((x) => Maybe.some(x + 1)),
			Maybe.getOrElse(() => 0),
		);
	});

	bench("2. manual inline", () => {
		// Cast to MaybeVal at each step so TypeScript does not narrow the "Some"
		// branch away — the shape mirrors what the pipe version checks at runtime.
		const s1 = { kind: "None" } as MaybeVal;
		const s2 = (s1.kind === "Some" ? { kind: "Some", value: s1.value * 2 } : s1) as MaybeVal;
		const s3 = (s2.kind === "Some" ? (s2.value > 0 ? s2 : { kind: "None" as const }) : s2) as MaybeVal;
		const s4 = (s3.kind === "Some" ? { kind: "Some", value: s3.value + 1 } : s3) as MaybeVal;
		const _result = s4.kind === "Some" ? s4.value : 0;
	});
});

// =============================================================================
// Scenario 3: Result chain (ok path, 4 steps)
// =============================================================================

describe("pipeline-result-ok", () => {
	bench("1. (current) pipe + Result ops", () => {
		void pipe(
			Result.ok(42),
			Result.map((x) => x * 2),
			Result.chain((x) => Result.ok(x + 1)),
			Result.fold(() => -1, (x) => x),
		);
	});

	bench("2. manual inline", () => {
		const r1 = { kind: "Ok" as const, value: 42 };
		const r2 = r1.kind === "Ok" ? { kind: "Ok" as const, value: r1.value * 2 } : r1;
		const r3 = r2.kind === "Ok" ? { kind: "Ok" as const, value: r2.value + 1 } : r2;
		const _result = r3.kind === "Ok" ? r3.value : -1;
	});
});
