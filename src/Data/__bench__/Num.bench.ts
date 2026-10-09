import { pipe } from "#composition";
import { Arr, Num } from "#data";
import { test } from "vitest";

const pipeFn = pipe;
const arrMap = Arr.map;
const numRange = Num.range;
const numMultiply = Num.multiply;
const numClamp = Num.clamp;
const numParse = Num.parse;

const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);
const numStrings100 = Array.from({ length: 100 }, (_, i) => String(i));
const mixedStrings100 = Array.from({ length: 100 }, (_, i) => (i % 10 === 0 ? "abc" : String(i)));
const numStrings10k = Array.from({ length: 10_000 }, (_, i) => String(i));
const mixedStrings10k = Array.from({ length: 10_000 }, (_, i) => (i % 10 === 0 ? "abc" : String(i)));

// =============================================================================
// range
// =============================================================================

test("range-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Num.range 100", () => {
			numRange(0, 99);
		}),
		bench("2. native range loop 100", () => {
			const result = new Array<number>(100);
			for (let i = 0; i < 100; i++) {
				result[i] = i;
			}
		}),
	);
});

test("range-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Num.range 10k", () => {
			numRange(0, 9999);
		}),
		bench("2. native range loop 10k", () => {
			const result = new Array<number>(10_000);
			for (let i = 0; i < 10_000; i++) {
				result[i] = i;
			}
		}),
	);
});

test("range-10k-step2", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Num.range 10k step 2", () => {
			numRange(0, 9998, 2);
		}),
		bench("2. native range loop 10k step 2", () => {
			const result: number[] = [];
			for (let i = 0; i < 10_000; i += 2) {
				result.push(i);
			}
		}),
	);
});

test("range-step2-approaches", async ({ bench }) => {
	await bench.compare(
		bench("1. range push step 2 10k", () => {
			const result: number[] = [];
			for (let i = 0; i < 10_000; i += 2) {
				result.push(i);
			}
		}),
		bench("2. (current) range pre-alloc step 2 10k", () => {
			const count = Math.ceil(10_000 / 2);
			const result = new Array<number>(count);
			for (let i = 0; i < count; i++) {
				result[i] = i * 2;
			}
		}),
	);
});

test("multiply-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.map + Num.multiply 100", () => {
			pipeFn(data100, arrMap(numMultiply(2)));
		}),
		bench("2. (current) Arr.map + inline lambda 100", () => {
			pipeFn(data100, arrMap((n) => n * 2));
		}),
	);
});

test("multiply-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.map + Num.multiply 10k", () => {
			pipeFn(data10k, arrMap(numMultiply(2)));
		}),
		bench("2. (current) Arr.map + inline lambda 10k", () => {
			pipeFn(data10k, arrMap((n) => n * 2));
		}),
	);
});

test("clamp-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.map + Num.clamp 100", () => {
			pipeFn(data100, arrMap(numClamp(0, 50)));
		}),
		bench("2. (current) Arr.map + inline clamp 100", () => {
			pipeFn(data100, arrMap((n) => Math.min(Math.max(n, 0), 50)));
		}),
	);
});

test("clamp-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Arr.map + Num.clamp 10k", () => {
			pipeFn(data10k, arrMap(numClamp(0, 5000)));
		}),
		bench("2. (current) Arr.map + inline clamp 10k", () => {
			pipeFn(data10k, arrMap((n) => Math.min(Math.max(n, 0), 5000)));
		}),
	);
});

test("parse-100-valid", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Num.parse 100 (all valid)", () => {
			numStrings100.map(numParse);
		}),
		bench("2. native parse 100 (all valid)", () => {
			numStrings100.map((s) => {
				if (s.trim() === "") { return { kind: "None" as const }; }
				const n = Number(s);
				return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
			});
		}),
	);
});

test("parse-100-mixed", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Num.parse 100 (mixed)", () => {
			mixedStrings100.map(numParse);
		}),
		bench("2. native parse 100 (mixed)", () => {
			mixedStrings100.map((s) => {
				if (s.trim() === "") { return { kind: "None" as const }; }
				const n = Number(s);
				return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
			});
		}),
	);
});

test("parse-10k-valid", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Num.parse 10k (all valid)", () => {
			numStrings10k.map(numParse);
		}),
		bench("2. native parse 10k (all valid)", () => {
			numStrings10k.map((s) => {
				if (s.trim() === "") { return { kind: "None" as const }; }
				const n = Number(s);
				return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
			});
		}),
	);
});

test("parse-10k-mixed", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Num.parse 10k (mixed)", () => {
			mixedStrings10k.map(numParse);
		}),
		bench("2. native parse 10k (mixed)", () => {
			mixedStrings10k.map((s) => {
				if (s.trim() === "") { return { kind: "None" as const }; }
				const n = Number(s);
				return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
			});
		}),
	);
});
