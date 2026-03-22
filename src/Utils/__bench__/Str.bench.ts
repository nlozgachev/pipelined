import { Str } from "../Str.ts";
import { pipe } from "#composition/pipe.ts";

const csv = Array.from({ length: 1_000 }, (_, i) => `value${i}`).join(",");
const multiline = Array.from({ length: 1_000 }, (_, i) => `line ${i}`).join("\n");
const paragraph = Array.from({ length: 1_000 }, (_, i) => `word${i}`).join(" ");
const paddedStr = "   " + paragraph + "   ";
const intStrings = Array.from({ length: 10_000 }, (_, i) => String(i));
const mixedIntStrings = Array.from({ length: 10_000 }, (_, i) => (i % 10 === 0 ? "abc" : String(i)));
const floatStrings = Array.from({ length: 10_000 }, (_, i) => String(i * 0.5));

// =============================================================================
// split
// =============================================================================

Deno.bench("Str.split csv 1k", { group: "split-1k", baseline: true }, () => {
	pipe(csv, Str.split(","));
});

Deno.bench("native .split csv 1k", { group: "split-1k" }, () => {
	csv.split(",");
});

// =============================================================================
// trim
// =============================================================================

Deno.bench("Str.trim long string", { group: "trim", baseline: true }, () => {
	pipe(paddedStr, Str.trim);
});

Deno.bench("native .trim long string", { group: "trim" }, () => {
	paddedStr.trim();
});

// =============================================================================
// lines
// =============================================================================

Deno.bench("Str.lines 1k", { group: "lines-1k", baseline: true }, () => {
	Str.lines(multiline);
});

Deno.bench("native split lines 1k", { group: "lines-1k" }, () => {
	multiline.split(/\r?\n|\r/);
});

// =============================================================================
// words
// =============================================================================

Deno.bench("Str.words 1k", { group: "words-1k", baseline: true }, () => {
	Str.words(paragraph);
});

Deno.bench("native words 1k", { group: "words-1k" }, () => {
	paragraph.trim().split(/\s+/).filter(Boolean);
});

// =============================================================================
// parse.int
// =============================================================================

Deno.bench("Str.parse.int 10k (all valid)", { group: "parse-int-10k-valid", baseline: true }, () => {
	intStrings.map(Str.parse.int);
});

Deno.bench("native parseInt 10k (all valid)", { group: "parse-int-10k-valid" }, () => {
	intStrings.map((s) => {
		const n = parseInt(s, 10);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});

Deno.bench("Str.parse.int 10k (mixed)", { group: "parse-int-10k-mixed", baseline: true }, () => {
	mixedIntStrings.map(Str.parse.int);
});

Deno.bench("native parseInt 10k (mixed)", { group: "parse-int-10k-mixed" }, () => {
	mixedIntStrings.map((s) => {
		const n = parseInt(s, 10);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});

// =============================================================================
// parse.float
// =============================================================================

Deno.bench("Str.parse.float 10k (all valid)", { group: "parse-float-10k-valid", baseline: true }, () => {
	floatStrings.map(Str.parse.float);
});

Deno.bench("native parseFloat 10k (all valid)", { group: "parse-float-10k-valid" }, () => {
	floatStrings.map((s) => {
		const n = parseFloat(s);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});
