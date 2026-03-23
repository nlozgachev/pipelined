import { bench, describe } from "vitest";
import { flow } from "../flow.ts";
import { add1, bytesPerCall, direct10, direct3, direct5, double, halve, n, negate, square } from "./fixtures.ts";

// Pre-build once — flow is designed to be created once and called many times.
const flow3 = flow(add1, double, negate);
const flow5 = flow(add1, double, negate, square, halve);
const flow10 = flow(add1, double, negate, square, halve, add1, double, negate, square, halve);

describe("flow-3-steps", () => {
	bench("flow 3 steps", () => { flow3(n); });
	bench("direct 3 steps", direct3);
});

describe("flow-5-steps", () => {
	bench("flow 5 steps", () => { flow5(n); });
	bench("direct 5 steps", direct5);
});

describe("flow-10-steps", () => {
	bench("flow 10 steps", () => { flow10(n); });
	bench("direct 10 steps", direct10);
});

// =============================================================================
// Memory: heap bytes allocated per invocation
// flow captures fns once at creation; calling the returned function allocates nothing.
//
// For accurate results pass --expose-gc to Node:
//   node --expose-gc node_modules/.bin/vitest bench flow
// =============================================================================

{
	const f3 = bytesPerCall(() => flow3(n));
	const f5 = bytesPerCall(() => flow5(n));
	const f10 = bytesPerCall(() => flow10(n));
	const d3 = bytesPerCall(direct3);
	const d10 = bytesPerCall(direct10);
	console.log("\n  flow memory footprint per invocation (bytes/call, 500k iterations each):");
	console.log(`    flow 3:    ~${f3.toFixed(1)}   direct 3:   ~${d3.toFixed(1)}`);
	console.log(`    flow 5:    ~${f5.toFixed(1)}`);
	console.log(`    flow 10:   ~${f10.toFixed(1)}  direct 10:  ~${d10.toFixed(1)}`);
}
