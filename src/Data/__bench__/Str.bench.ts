import { pipe } from "#composition";
import { Str } from "#data";
import { test } from "vitest";

// Local bindings to eliminate Vite module runner export getter overhead
const strSplit = Str.split;
const strTrim = Str.trim;
const strLines = Str.lines;
const strWords = Str.words;
const strParseInt = Str.parse.int;
const strParseFloat = Str.parse.float;
const strSize = Str.size;
const strGraphemeSize = Str.graphemeSize;
const pipeFn = pipe;

const csv100 = Array.from({ length: 100 }, (_, i) => `value${i}`).join(",");
const csv10k = Array.from({ length: 10_000 }, (_, i) => `value${i}`).join(",");
const multiline100 = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
const multiline10k = Array.from({ length: 10_000 }, (_, i) => `line ${i}`).join("\n");
const paragraph100 = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
const paragraph10k = Array.from({ length: 10_000 }, (_, i) => `word${i}`).join(" ");
const paddedStr = `   ${paragraph100}   `;
const intStrings100 = Array.from({ length: 100 }, (_, i) => String(i));
const mixedIntStrings100 = Array.from({ length: 100 }, (_, i) => (i % 10 === 0 ? "abc" : String(i)));
const floatStrings100 = Array.from({ length: 100 }, (_, i) => String(i * 0.5));
const intStrings10k = Array.from({ length: 10_000 }, (_, i) => String(i));
const mixedIntStrings10k = Array.from({ length: 10_000 }, (_, i) => (i % 10 === 0 ? "abc" : String(i)));
const floatStrings10k = Array.from({ length: 10_000 }, (_, i) => String(i * 0.5));

const asciiShort = "hello";
const asciiMedium =
	"The quick brown fox jumps over the lazy dog. Packing my box with five dozen liquor jugs every day.";
const compoundEmoji = "👨‍👩‍👧‍👦";
const emojiSentence = "Hello 🌍! Here is 👨‍👩‍👧‍👦 and 👋🏽 and 🇺🇸. The quick brown fox jumps over the lazy dog! 🚀🎉";
const nonLatinSentence = "नमस्ते - Hello world!";
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// =============================================================================
// split
// =============================================================================

test("split-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.split csv 100", () => {
			pipeFn(csv100, strSplit(","));
		}),
		bench("2. native .split csv 100", () => {
			csv100.split(",");
		}),
	);
});

test("split-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.split csv 10k", () => {
			pipeFn(csv10k, strSplit(","));
		}),
		bench("2. native .split csv 10k", () => {
			csv10k.split(",");
		}),
	);
});

// =============================================================================
// trim
// =============================================================================

test("trim", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.trim long string", () => {
			pipeFn(paddedStr, strTrim);
		}),
		bench("2. native .trim long string", () => {
			paddedStr.trim();
		}),
	);
});

// =============================================================================
// lines
// =============================================================================

test("lines-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.lines 100", () => {
			strLines(multiline100);
		}),
		bench("2. native split lines 100", () => {
			multiline100.split(/\r?\n|\r/);
		}),
	);
});

test("lines-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.lines 10k", () => {
			strLines(multiline10k);
		}),
		bench("2. native split lines 10k", () => {
			multiline10k.split(/\r?\n|\r/);
		}),
	);
});

// =============================================================================
// words
// =============================================================================

test("words-100", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.words 100", () => {
			strWords(paragraph100);
		}),
		bench("2. native words 100", () => {
			paragraph100.trim().split(/\s+/).filter(Boolean);
		}),
	);
});

test("words-10k", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.words 10k", () => {
			strWords(paragraph10k);
		}),
		bench("2. native words 10k", () => {
			paragraph10k.trim().split(/\s+/).filter(Boolean);
		}),
	);
});

// =============================================================================
// parse.int
// =============================================================================

test("parse-int-100-valid", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.parse.int 100 (all valid)", () => {
			intStrings100.map(strParseInt);
		}),
		bench("2. native parseInt 100 (all valid)", () => {
			intStrings100.map((s) => {
				const n = parseInt(s, 10);
				return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
			});
		}),
	);
});

test("parse-int-100-mixed", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.parse.int 100 (mixed)", () => {
			mixedIntStrings100.map(strParseInt);
		}),
		bench("2. native parseInt 100 (mixed)", () => {
			mixedIntStrings100.map((s) => {
				const n = parseInt(s, 10);
				return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
			});
		}),
	);
});

test("parse-int-10k-valid", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.parse.int 10k (all valid)", () => {
			intStrings10k.map(strParseInt);
		}),
		bench("2. native parseInt 10k (all valid)", () => {
			intStrings10k.map((s) => {
				const n = parseInt(s, 10);
				return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
			});
		}),
	);
});

test("parse-int-10k-mixed", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.parse.int 10k (mixed)", () => {
			mixedIntStrings10k.map(strParseInt);
		}),
		bench("2. native parseInt 10k (mixed)", () => {
			mixedIntStrings10k.map((s) => {
				const n = parseInt(s, 10);
				return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
			});
		}),
	);
});

// =============================================================================
// parse.float
// =============================================================================

test("parse-float-100-valid", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.parse.float 100 (all valid)", () => {
			floatStrings100.map(strParseFloat);
		}),
		bench("2. native parseFloat 100 (all valid)", () => {
			floatStrings100.map((s) => {
				const n = parseFloat(s);
				return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
			});
		}),
	);
});

test("parse-float-10k-valid", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.parse.float 10k (all valid)", () => {
			floatStrings10k.map(strParseFloat);
		}),
		bench("2. native parseFloat 10k (all valid)", () => {
			floatStrings10k.map((s) => {
				const n = parseFloat(s);
				return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
			});
		}),
	);
});

// =============================================================================
// size & graphemeSize
// =============================================================================

test("size-ascii-short", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.size", () => {
			strSize(asciiShort);
		}),
		bench("2. native .length", () => {
			void asciiShort.length;
		}),
	);
});

test("graphemeSize-ascii-short", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.graphemeSize (ASCII fast-path)", () => {
			strGraphemeSize(asciiShort);
		}),
		bench("2. raw Intl.Segmenter", () => {
			let count = 0;
			for (const _ of segmenter.segment(asciiShort)) { count++; }
		}),
	);
});

test("graphemeSize-ascii-medium", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.graphemeSize (ASCII fast-path)", () => {
			strGraphemeSize(asciiMedium);
		}),
		bench("2. raw Intl.Segmenter", () => {
			let count = 0;
			for (const _ of segmenter.segment(asciiMedium)) { count++; }
		}),
	);
});

test("graphemeSize-compound-emoji", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.graphemeSize", () => {
			strGraphemeSize(compoundEmoji);
		}),
		bench("2. raw Intl.Segmenter", () => {
			let count = 0;
			for (const _ of segmenter.segment(compoundEmoji)) { count++; }
		}),
	);
});

test("graphemeSize-mixed-emoji", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.graphemeSize", () => {
			strGraphemeSize(emojiSentence);
		}),
		bench("2. raw Intl.Segmenter", () => {
			let count = 0;
			for (const _ of segmenter.segment(emojiSentence)) { count++; }
		}),
	);
});

test("graphemeSize-non-latin", async ({ bench }) => {
	await bench.compare(
		bench("1. (current) Str.graphemeSize", () => {
			strGraphemeSize(nonLatinSentence);
		}),
		bench("2. raw Intl.Segmenter", () => {
			let count = 0;
			for (const _ of segmenter.segment(nonLatinSentence)) { count++; }
		}),
	);
});
