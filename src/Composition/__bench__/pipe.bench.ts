import { pipe } from "#composition";
import { test } from "vitest";
import { add1, bytesPerCall, direct10, direct3, direct5, double, halve, n, negate, square } from "./fixtures";

const pipeFn = pipe;
const valN = n;
const fnAdd1 = add1;
const fnDouble = double;
const fnNegate = negate;
const fnSquare = square;
const fnHalve = halve;
const fnDirect3 = direct3;
const fnDirect5 = direct5;
const fnDirect10 = direct10;

test("pipe-3-steps", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) pipe 3 steps", () => {
			pipeFn(valN, fnAdd1, fnDouble, fnNegate);
		}),
		bench("2. direct 3 steps", fnDirect3),
	);
});

test("pipe-5-steps", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) pipe 5 steps", () => {
			pipeFn(valN, fnAdd1, fnDouble, fnNegate, fnSquare, fnHalve);
		}),
		bench("2. direct 5 steps", fnDirect5),
	);
});

test("pipe-10-steps", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) pipe 10 steps", () => {
			pipeFn(valN, fnAdd1, fnDouble, fnNegate, fnSquare, fnHalve, fnAdd1, fnDouble, fnNegate, fnSquare, fnHalve);
		}),
		bench("2. direct 10 steps", fnDirect10),
	);
});

// =============================================================================
// Memory: heap bytes allocated per call
//
// For accurate results pass --expose-gc to Node:
//   node --expose-gc node_modules/.bin/vitest bench pipe
// =============================================================================

test("pipe-memory", () => {
	const p3 = bytesPerCall(() => pipeFn(valN, fnAdd1, fnDouble, fnNegate));
	const p10 = bytesPerCall(() =>
		pipeFn(valN, fnAdd1, fnDouble, fnNegate, fnSquare, fnHalve, fnAdd1, fnDouble, fnNegate, fnSquare, fnHalve)
	);
	const d3 = bytesPerCall(fnDirect3);
	const d10 = bytesPerCall(fnDirect10);
	console.log("\n  pipe memory footprint (bytes/call, 500k iterations each):");
	console.log(`    pipe 3:    ~${p3.toFixed(1)}   direct 3:   ~${d3.toFixed(1)}`);
	console.log(`    pipe 10:   ~${p10.toFixed(1)}  direct 10:  ~${d10.toFixed(1)}`);
});
