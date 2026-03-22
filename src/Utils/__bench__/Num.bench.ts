import { Num } from "../Num.ts";
import { Arr } from "../Arr.ts";
import { pipe } from "#composition/pipe.ts";

const data10k = Array.from({ length: 10_000 }, (_, i) => i);

// =============================================================================
// range
// =============================================================================

Deno.bench("Num.range 10k", { group: "range-10k", baseline: true }, () => {
	Num.range(0, 9_999);
});

Deno.bench("native range loop 10k", { group: "range-10k" }, () => {
	const result = new Array<number>(10_000);
	for (let i = 0; i < 10_000; i++) {
		result[i] = i;
	}
});

Deno.bench("Num.range 10k step 2", { group: "range-10k-step2", baseline: true }, () => {
	Num.range(0, 9_998, 2);
});

Deno.bench("native range loop 10k step 2", { group: "range-10k-step2" }, () => {
	const result: number[] = [];
	for (let i = 0; i < 10_000; i += 2) {
		result.push(i);
	}
});

Deno.bench("range push step 2 10k", { group: "range-step2-approaches", baseline: true }, () => {
	const result: number[] = [];
	for (let i = 0; i < 10_000; i += 2) {
		result.push(i);
	}
});

Deno.bench("range pre-alloc step 2 10k", { group: "range-step2-approaches" }, () => {
	const count = Math.ceil(10_000 / 2);
	const result = new Array<number>(count);
	for (let i = 0; i < count; i++) {
		result[i] = i * 2;
	}
});

// =============================================================================
// multiply (curried vs inline lambda)
// =============================================================================

Deno.bench("Arr.map + Num.multiply 10k", { group: "multiply-10k", baseline: true }, () => {
	pipe(data10k, Arr.map(Num.multiply(2)));
});

Deno.bench("Arr.map + inline lambda 10k", { group: "multiply-10k" }, () => {
	pipe(data10k, Arr.map((n) => n * 2));
});

// =============================================================================
// clamp (curried vs inline)
// =============================================================================

Deno.bench("Arr.map + Num.clamp 10k", { group: "clamp-10k", baseline: true }, () => {
	pipe(data10k, Arr.map(Num.clamp(0, 5_000)));
});

Deno.bench("Arr.map + inline clamp 10k", { group: "clamp-10k" }, () => {
	pipe(data10k, Arr.map((n) => Math.min(Math.max(n, 0), 5_000)));
});

// =============================================================================
// parse
// =============================================================================

const numStrings = Array.from({ length: 10_000 }, (_, i) => String(i));
const mixedStrings = Array.from({ length: 10_000 }, (_, i) => (i % 10 === 0 ? "abc" : String(i)));

Deno.bench("Num.parse 10k (all valid)", { group: "parse-10k-valid", baseline: true }, () => {
	numStrings.map(Num.parse);
});

Deno.bench("native parse 10k (all valid)", { group: "parse-10k-valid" }, () => {
	numStrings.map((s) => {
		if (s.trim() === "") return { kind: "None" as const };
		const n = Number(s);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});

Deno.bench("Num.parse 10k (mixed)", { group: "parse-10k-mixed", baseline: true }, () => {
	mixedStrings.map(Num.parse);
});

Deno.bench("native parse 10k (mixed)", { group: "parse-10k-mixed" }, () => {
	mixedStrings.map((s) => {
		if (s.trim() === "") return { kind: "None" as const };
		const n = Number(s);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});
