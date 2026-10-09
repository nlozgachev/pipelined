import { pipe } from "#composition";
import { Maybe, Result } from "#core";
import { test } from "vitest";

const pipeFn = pipe;
const maybeSome = Maybe.make.some;
const maybeNone = Maybe.make.none;
const maybeMap = Maybe.map;
const maybeFilter = Maybe.filter;
const maybeChain = Maybe.chain;
const maybeGetOrElse = Maybe.getOrElse;

const resultOk = Result.make.ok;
const resultMap = Result.map;
const resultChain = Result.chain;
const resultFold = Result.fold;

type MaybeVal = { kind: "Some"; value: number; } | { kind: "None"; };

// =============================================================================
// Scenario 1: Happy-path Maybe chain (5 steps)
// =============================================================================

test("pipeline-maybe-happy", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) pipe + Maybe ops", () => {
			void pipeFn(
				maybeSome(42),
				maybeMap((x) => x * 2),
				maybeFilter((x) => x > 0),
				maybeChain((x) => maybeSome(x + 1)),
				maybeGetOrElse(() => 0),
			);
		}),
		bench("2. manual inline", () => {
			const s1 = { kind: "Some" as const, value: 42 };
			const s2 = s1.kind === "Some" ? { kind: "Some" as const, value: s1.value * 2 } : s1;
			const s3 = s2.kind === "Some" ? (s2.value > 0 ? s2 : { kind: "None" as const }) : s2;
			const s4 = s3.kind === "Some" ? { kind: "Some" as const, value: s3.value + 1 } : s3;
			const result = s4.kind === "Some" ? s4.value : 0;
			void result;
		}),
	);
});

// =============================================================================
// Scenario 2: Short-circuiting Maybe chain (none at step 2)
// =============================================================================

test("pipeline-maybe-short-circuit", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) pipe + Maybe ops", () => {
			void pipeFn(
				maybeNone() as Maybe<number>,
				maybeMap((x) => x * 2),
				maybeFilter((x) => x > 0),
				maybeChain((x) => maybeSome(x + 1)),
				maybeGetOrElse(() => 0),
			);
		}),
		bench("2. manual inline", () => {
			// Cast to MaybeVal at each step so TypeScript does not narrow the "Some"
			// branch away — the shape mirrors what the pipe version checks at runtime.
			const s1 = { kind: "None" } as MaybeVal;
			const s2 = (s1.kind === "Some" ? { kind: "Some", value: s1.value * 2 } : s1) as MaybeVal;
			const s3 = (s2.kind === "Some" ? (s2.value > 0 ? s2 : { kind: "None" as const }) : s2) as MaybeVal;
			const s4 = (s3.kind === "Some" ? { kind: "Some", value: s3.value + 1 } : s3) as MaybeVal;
			const result = s4.kind === "Some" ? s4.value : 0;
			void result;
		}),
	);
});

// =============================================================================
// Scenario 3: Result chain (ok path, 4 steps)
// =============================================================================

test("pipeline-result-ok", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) pipe + Result ops", () => {
			void pipeFn(
				resultOk(42),
				resultMap((x) => x * 2),
				resultChain((x) => resultOk(x + 1)),
				resultFold(() => -1, (x) => x),
			);
		}),
		bench("2. manual inline", () => {
			const r1 = { kind: "Ok" as const, value: 42 };
			const r2 = r1.kind === "Ok" ? { kind: "Ok" as const, value: r1.value * 2 } : r1;
			const r3 = r2.kind === "Ok" ? { kind: "Ok" as const, value: r2.value + 1 } : r2;
			const result = r3.kind === "Ok" ? r3.value : -1;
			void result;
		}),
	);
});
