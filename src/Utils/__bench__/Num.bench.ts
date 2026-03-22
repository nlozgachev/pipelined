import { Num } from "../Num.ts";
import { Arr } from "../Arr.ts";
import { pipe } from "#composition/pipe.ts";

const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);

// =============================================================================
// range
// =============================================================================

Deno.bench("Num.range 100", { group: "range-100", baseline: true }, () => {
	Num.range(0, 99);
});

Deno.bench("native range loop 100", { group: "range-100" }, () => {
	const result = new Array<number>(100);
	for (let i = 0; i < 100; i++) {
		result[i] = i;
	}
});

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

Deno.bench("range push step 2 10k", { group: "range-step2-approaches" }, () => {
	const result: number[] = [];
	for (let i = 0; i < 10_000; i += 2) {
		result.push(i);
	}
});

Deno.bench("[impl] range pre-alloc step 2 10k", { group: "range-step2-approaches", baseline: true }, () => {
	const count = Math.ceil(10_000 / 2);
	const result = new Array<number>(count);
	for (let i = 0; i < count; i++) {
		result[i] = i * 2;
	}
});

// =============================================================================
// multiply (curried vs inline lambda)
// =============================================================================

Deno.bench("Arr.map + Num.multiply 100", { group: "multiply-100", baseline: true }, () => {
	pipe(data100, Arr.map(Num.multiply(2)));
});

Deno.bench("Arr.map + inline lambda 100", { group: "multiply-100" }, () => {
	pipe(data100, Arr.map((n) => n * 2));
});

Deno.bench("Arr.map + Num.multiply 10k", { group: "multiply-10k", baseline: true }, () => {
	pipe(data10k, Arr.map(Num.multiply(2)));
});

Deno.bench("Arr.map + inline lambda 10k", { group: "multiply-10k" }, () => {
	pipe(data10k, Arr.map((n) => n * 2));
});

// =============================================================================
// clamp (curried vs inline)
// =============================================================================

Deno.bench("Arr.map + Num.clamp 100", { group: "clamp-100", baseline: true }, () => {
	pipe(data100, Arr.map(Num.clamp(0, 50)));
});

Deno.bench("Arr.map + inline clamp 100", { group: "clamp-100" }, () => {
	pipe(data100, Arr.map((n) => Math.min(Math.max(n, 0), 50)));
});

Deno.bench("Arr.map + Num.clamp 10k", { group: "clamp-10k", baseline: true }, () => {
	pipe(data10k, Arr.map(Num.clamp(0, 5_000)));
});

Deno.bench("Arr.map + inline clamp 10k", { group: "clamp-10k" }, () => {
	pipe(data10k, Arr.map((n) => Math.min(Math.max(n, 0), 5_000)));
});

// =============================================================================
// parse
// =============================================================================

const numStrings100 = Array.from({ length: 100 }, (_, i) => String(i));
const mixedStrings100 = Array.from({ length: 100 }, (_, i) => (i % 10 === 0 ? "abc" : String(i)));
const numStrings10k = Array.from({ length: 10_000 }, (_, i) => String(i));
const mixedStrings10k = Array.from({ length: 10_000 }, (_, i) => (i % 10 === 0 ? "abc" : String(i)));

Deno.bench("Num.parse 100 (all valid)", { group: "parse-100-valid", baseline: true }, () => {
	numStrings100.map(Num.parse);
});

Deno.bench("native parse 100 (all valid)", { group: "parse-100-valid" }, () => {
	numStrings100.map((s) => {
		if (s.trim() === "") return { kind: "None" as const };
		const n = Number(s);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});

Deno.bench("Num.parse 100 (mixed)", { group: "parse-100-mixed", baseline: true }, () => {
	mixedStrings100.map(Num.parse);
});

Deno.bench("native parse 100 (mixed)", { group: "parse-100-mixed" }, () => {
	mixedStrings100.map((s) => {
		if (s.trim() === "") return { kind: "None" as const };
		const n = Number(s);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});

Deno.bench("Num.parse 10k (all valid)", { group: "parse-10k-valid", baseline: true }, () => {
	numStrings10k.map(Num.parse);
});

Deno.bench("native parse 10k (all valid)", { group: "parse-10k-valid" }, () => {
	numStrings10k.map((s) => {
		if (s.trim() === "") return { kind: "None" as const };
		const n = Number(s);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});

Deno.bench("Num.parse 10k (mixed)", { group: "parse-10k-mixed", baseline: true }, () => {
	mixedStrings10k.map(Num.parse);
});

Deno.bench("native parse 10k (mixed)", { group: "parse-10k-mixed" }, () => {
	mixedStrings10k.map((s) => {
		if (s.trim() === "") return { kind: "None" as const };
		const n = Number(s);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});
