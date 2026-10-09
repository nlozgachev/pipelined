import { flow } from "#composition";
import { test } from "vitest";
import { add1, bytesPerCall, direct10, direct3, direct5, double, halve, n, negate, square } from "./fixtures";

const valN = n;
const fnAdd1 = add1;
const fnDouble = double;
const fnNegate = negate;
const fnSquare = square;
const fnHalve = halve;
const fnDirect3 = direct3;
const fnDirect5 = direct5;
const fnDirect10 = direct10;

// Pre-build once — flow is designed to be created once and called many times.
const flow3 = flow(fnAdd1, fnDouble, fnNegate);
const flow5 = flow(fnAdd1, fnDouble, fnNegate, fnSquare, fnHalve);
const flow10 = flow(fnAdd1, fnDouble, fnNegate, fnSquare, fnHalve, fnAdd1, fnDouble, fnNegate, fnSquare, fnHalve);

test("flow-3-steps", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) flow 3 steps", () => {
			flow3(valN);
		}),
		bench("2. direct 3 steps", fnDirect3),
	);
});

test("flow-5-steps", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) flow 5 steps", () => {
			flow5(valN);
		}),
		bench("2. direct 5 steps", fnDirect5),
	);
});

test("flow-10-steps", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) flow 10 steps", () => {
			flow10(valN);
		}),
		bench("2. direct 10 steps", fnDirect10),
	);
});

// =============================================================================
// Memory: heap bytes allocated per invocation
// flow captures fns once at creation; calling the returned function allocates nothing.
//
// For accurate results pass --expose-gc to Node:
//   node --expose-gc node_modules/.bin/vitest bench flow
// =============================================================================

test("flow-memory", () => {
	const f3 = bytesPerCall(() => flow3(valN));
	const f5 = bytesPerCall(() => flow5(valN));
	const f10 = bytesPerCall(() => flow10(valN));
	const d3 = bytesPerCall(fnDirect3);
	const d10 = bytesPerCall(fnDirect10);
	console.log("\n  flow memory footprint per invocation (bytes/call, 500k iterations each):");
	console.log(`    flow 3:    ~${f3.toFixed(1)}   direct 3:   ~${d3.toFixed(1)}`);
	console.log(`    flow 5:    ~${f5.toFixed(1)}`);
	console.log(`    flow 10:   ~${f10.toFixed(1)}  direct 10:  ~${d10.toFixed(1)}`);
});
