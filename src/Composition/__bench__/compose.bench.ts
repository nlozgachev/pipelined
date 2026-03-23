import { bench, describe } from "vitest";
import { compose } from "../compose.ts";
import { add1, bytesPerCall, direct10, direct3, direct5, double, halve, n, negate, square } from "./fixtures.ts";

// Pre-build once — compose is designed to be created once and called many times.
const compose3 = compose(negate, double, add1);
const compose5 = compose(halve, square, negate, double, add1);
const compose10 = compose(halve, square, negate, double, add1, halve, square, negate, double, add1);

describe("compose-3-steps", () => {
	bench("compose 3 steps", () => {
		compose3(n);
	});
	bench("direct 3 steps", direct3);
});

describe("compose-5-steps", () => {
	bench("compose 5 steps", () => {
		compose5(n);
	});
	bench("direct 5 steps", direct5);
});

describe("compose-10-steps", () => {
	bench("compose 10 steps", () => {
		compose10(n);
	});
	bench("direct 10 steps", direct10);
});

// =============================================================================
// Memory: heap bytes allocated per invocation
// Like flow, compose captures fns at creation time. Invocation allocates nothing.
//
// For accurate results pass --expose-gc to Node:
//   node --expose-gc node_modules/.bin/vitest bench compose
// =============================================================================

{
	const c3 = bytesPerCall(() => compose3(n));
	const c5 = bytesPerCall(() => compose5(n));
	const c10 = bytesPerCall(() => compose10(n));
	const d3 = bytesPerCall(direct3);
	const d10 = bytesPerCall(direct10);
	console.log("\n  compose memory footprint per invocation (bytes/call, 500k iterations each):");
	console.log(`    compose 3:    ~${c3.toFixed(1)}   direct 3:   ~${d3.toFixed(1)}`);
	console.log(`    compose 5:    ~${c5.toFixed(1)}`);
	console.log(`    compose 10:   ~${c10.toFixed(1)}  direct 10:  ~${d10.toFixed(1)}`);
}
