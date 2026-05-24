import { pipe } from "#composition";
import { Str } from "#utils";
import { bench, describe } from "vitest";

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

// =============================================================================
// split
// =============================================================================

describe("split-100", () => {
	bench("1. (current) Str.split csv 100", () => {
		pipe(csv100, Str.split(","));
	});
	bench("2. native .split csv 100", () => {
		csv100.split(",");
	});
});

describe("split-10k", () => {
	bench("1. (current) Str.split csv 10k", () => {
		pipe(csv10k, Str.split(","));
	});
	bench("2. native .split csv 10k", () => {
		csv10k.split(",");
	});
});

describe("trim", () => {
	bench("1. (current) Str.trim long string", () => {
		pipe(paddedStr, Str.trim);
	});
	bench("2. native .trim long string", () => {
		paddedStr.trim();
	});
});

describe("lines-100", () => {
	bench("1. (current) Str.lines 100", () => {
		Str.lines(multiline100);
	});
	bench("2. native split lines 100", () => {
		multiline100.split(/\r?\n|\r/);
	});
});

describe("lines-10k", () => {
	bench("1. (current) Str.lines 10k", () => {
		Str.lines(multiline10k);
	});
	bench("2. native split lines 10k", () => {
		multiline10k.split(/\r?\n|\r/);
	});
});

describe("words-100", () => {
	bench("1. (current) Str.words 100", () => {
		Str.words(paragraph100);
	});
	bench("2. native words 100", () => {
		paragraph100.trim().split(/\s+/).filter(Boolean);
	});
});

describe("words-10k", () => {
	bench("1. (current) Str.words 10k", () => {
		Str.words(paragraph10k);
	});
	bench("2. native words 10k", () => {
		paragraph10k.trim().split(/\s+/).filter(Boolean);
	});
});

describe("parse-int-100-valid", () => {
	bench("1. (current) Str.parse.int 100 (all valid", () => {
		intStrings100.map(Str.parse.int);
	});
	bench("2. native parseInt 100 (all valid", () => {
		intStrings100.map((s) => {
			const n = parseInt(s, 10);
			return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
		});
	});
});

describe("parse-int-100-mixed", () => {
	bench("1. (current) Str.parse.int 100 (mixed", () => {
		mixedIntStrings100.map(Str.parse.int);
	});
	bench("2. native parseInt 100 (mixed", () => {
		mixedIntStrings100.map((s) => {
			const n = parseInt(s, 10);
			return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
		});
	});
});

describe("parse-int-10k-valid", () => {
	bench("1. (current) Str.parse.int 10k (all valid", () => {
		intStrings10k.map(Str.parse.int);
	});
	bench("2. native parseInt 10k (all valid", () => {
		intStrings10k.map((s) => {
			const n = parseInt(s, 10);
			return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
		});
	});
});

describe("parse-int-10k-mixed", () => {
	bench("1. (current) Str.parse.int 10k (mixed", () => {
		mixedIntStrings10k.map(Str.parse.int);
	});
	bench("2. native parseInt 10k (mixed", () => {
		mixedIntStrings10k.map((s) => {
			const n = parseInt(s, 10);
			return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
		});
	});
});

describe("parse-float-100-valid", () => {
	bench("1. (current) Str.parse.float 100 (all valid", () => {
		floatStrings100.map(Str.parse.float);
	});
	bench("2. native parseFloat 100 (all valid", () => {
		floatStrings100.map((s) => {
			const n = parseFloat(s);
			return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
		});
	});
});

describe("parse-float-10k-valid", () => {
	bench("1. (current) Str.parse.float 10k (all valid", () => {
		floatStrings10k.map(Str.parse.float);
	});
	bench("2. native parseFloat 10k (all valid", () => {
		floatStrings10k.map((s) => {
			const n = parseFloat(s);
			return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
		});
	});
});
