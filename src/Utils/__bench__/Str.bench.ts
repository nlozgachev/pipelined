import { Str } from "../Str.ts";
import { pipe } from "#composition/pipe.ts";

const csv100 = Array.from({ length: 100 }, (_, i) => `value${i}`).join(",");
const csv10k = Array.from({ length: 10_000 }, (_, i) => `value${i}`).join(",");
const multiline100 = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
const multiline10k = Array.from({ length: 10_000 }, (_, i) => `line ${i}`).join("\n");
const paragraph100 = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
const paragraph10k = Array.from({ length: 10_000 }, (_, i) => `word${i}`).join(" ");
const paddedStr = "   " + paragraph100 + "   ";
const intStrings100 = Array.from({ length: 100 }, (_, i) => String(i));
const mixedIntStrings100 = Array.from({ length: 100 }, (_, i) => (i % 10 === 0 ? "abc" : String(i)));
const floatStrings100 = Array.from({ length: 100 }, (_, i) => String(i * 0.5));
const intStrings10k = Array.from({ length: 10_000 }, (_, i) => String(i));
const mixedIntStrings10k = Array.from({ length: 10_000 }, (_, i) => (i % 10 === 0 ? "abc" : String(i)));
const floatStrings10k = Array.from({ length: 10_000 }, (_, i) => String(i * 0.5));

// =============================================================================
// split
// =============================================================================

Deno.bench("Str.split csv 100", { group: "split-100", baseline: true }, () => {
	pipe(csv100, Str.split(","));
});

Deno.bench("native .split csv 100", { group: "split-100" }, () => {
	csv100.split(",");
});

Deno.bench("Str.split csv 10k", { group: "split-10k", baseline: true }, () => {
	pipe(csv10k, Str.split(","));
});

Deno.bench("native .split csv 10k", { group: "split-10k" }, () => {
	csv10k.split(",");
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

Deno.bench("Str.lines 100", { group: "lines-100", baseline: true }, () => {
	Str.lines(multiline100);
});

Deno.bench("native split lines 100", { group: "lines-100" }, () => {
	multiline100.split(/\r?\n|\r/);
});

Deno.bench("Str.lines 10k", { group: "lines-10k", baseline: true }, () => {
	Str.lines(multiline10k);
});

Deno.bench("native split lines 10k", { group: "lines-10k" }, () => {
	multiline10k.split(/\r?\n|\r/);
});

// =============================================================================
// words
// =============================================================================

Deno.bench("Str.words 100", { group: "words-100", baseline: true }, () => {
	Str.words(paragraph100);
});

Deno.bench("native words 100", { group: "words-100" }, () => {
	paragraph100.trim().split(/\s+/).filter(Boolean);
});

Deno.bench("Str.words 10k", { group: "words-10k", baseline: true }, () => {
	Str.words(paragraph10k);
});

Deno.bench("native words 10k", { group: "words-10k" }, () => {
	paragraph10k.trim().split(/\s+/).filter(Boolean);
});

// =============================================================================
// parse.int
// =============================================================================

Deno.bench("Str.parse.int 100 (all valid)", { group: "parse-int-100-valid", baseline: true }, () => {
	intStrings100.map(Str.parse.int);
});

Deno.bench("native parseInt 100 (all valid)", { group: "parse-int-100-valid" }, () => {
	intStrings100.map((s) => {
		const n = parseInt(s, 10);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});

Deno.bench("Str.parse.int 100 (mixed)", { group: "parse-int-100-mixed", baseline: true }, () => {
	mixedIntStrings100.map(Str.parse.int);
});

Deno.bench("native parseInt 100 (mixed)", { group: "parse-int-100-mixed" }, () => {
	mixedIntStrings100.map((s) => {
		const n = parseInt(s, 10);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});

Deno.bench("Str.parse.int 10k (all valid)", { group: "parse-int-10k-valid", baseline: true }, () => {
	intStrings10k.map(Str.parse.int);
});

Deno.bench("native parseInt 10k (all valid)", { group: "parse-int-10k-valid" }, () => {
	intStrings10k.map((s) => {
		const n = parseInt(s, 10);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});

Deno.bench("Str.parse.int 10k (mixed)", { group: "parse-int-10k-mixed", baseline: true }, () => {
	mixedIntStrings10k.map(Str.parse.int);
});

Deno.bench("native parseInt 10k (mixed)", { group: "parse-int-10k-mixed" }, () => {
	mixedIntStrings10k.map((s) => {
		const n = parseInt(s, 10);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});

// =============================================================================
// parse.float
// =============================================================================

Deno.bench("Str.parse.float 100 (all valid)", { group: "parse-float-100-valid", baseline: true }, () => {
	floatStrings100.map(Str.parse.float);
});

Deno.bench("native parseFloat 100 (all valid)", { group: "parse-float-100-valid" }, () => {
	floatStrings100.map((s) => {
		const n = parseFloat(s);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});

Deno.bench("Str.parse.float 10k (all valid)", { group: "parse-float-10k-valid", baseline: true }, () => {
	floatStrings10k.map(Str.parse.float);
});

Deno.bench("native parseFloat 10k (all valid)", { group: "parse-float-10k-valid" }, () => {
	floatStrings10k.map((s) => {
		const n = parseFloat(s);
		return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
	});
});
