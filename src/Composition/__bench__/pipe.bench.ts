import { bench, describe } from "vitest";
import { pipe } from "../pipe.ts";
import { add1, bytesPerCall, direct10, direct3, direct5, double, halve, n, negate, square } from "./fixtures.ts";

describe("pipe-3-steps", () => {
	bench("pipe 3 steps", () => {
		pipe(n, add1, double, negate);
	});
	bench("direct 3 steps", direct3);
});

describe("pipe-5-steps", () => {
	bench("pipe 5 steps", () => {
		pipe(n, add1, double, negate, square, halve);
	});
	bench("direct 5 steps", direct5);
});

describe("pipe-10-steps", () => {
	bench("pipe 10 steps", () => {
		pipe(n, add1, double, negate, square, halve, add1, double, negate, square, halve);
	});
	bench("direct 10 steps", direct10);
});

// =============================================================================
// Memory: heap bytes allocated per call
//
// For accurate results pass --expose-gc to Node:
//   node --expose-gc node_modules/.bin/vitest bench pipe
// =============================================================================

{
	const p3 = bytesPerCall(() => pipe(n, add1, double, negate));
	const p10 = bytesPerCall(
		() => pipe(n, add1, double, negate, square, halve, add1, double, negate, square, halve),
	);
	const d3 = bytesPerCall(direct3);
	const d10 = bytesPerCall(direct10);
	console.log("\n  pipe memory footprint (bytes/call, 500k iterations each):");
	console.log(`    pipe 3:    ~${p3.toFixed(1)}   direct 3:   ~${d3.toFixed(1)}`);
	console.log(`    pipe 10:   ~${p10.toFixed(1)}  direct 10:  ~${d10.toFixed(1)}`);
}
