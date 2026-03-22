import { pipe } from "#composition/pipe.ts";
import { bench, describe } from "vitest";
import { Arr } from "../Arr.ts";
import { Num } from "../Num.ts";

const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);
const numStrings100 = Array.from({ length: 100 }, (_, i) => String(i));
const mixedStrings100 = Array.from({ length: 100 }, (_, i) => (i % 10 === 0 ? "abc" : String(i)));
const numStrings10k = Array.from({ length: 10_000 }, (_, i) => String(i));
const mixedStrings10k = Array.from({ length: 10_000 }, (_, i) => (i % 10 === 0 ? "abc" : String(i)));

// =============================================================================
// range
// =============================================================================

describe("range-100", () => {
	bench("Num.range 100", () => {
		Num.range(0, 99);
	});
	bench("native range loop 100", () => {
		const result = new Array<number>(100);
		for (let i = 0; i < 100; i++) {
			result[i] = i;
		}
	});
});

describe("range-10k", () => {
	bench("Num.range 10k", () => {
		Num.range(0, 9_999);
	});
	bench("native range loop 10k", () => {
		const result = new Array<number>(10_000);
		for (let i = 0; i < 10_000; i++) {
			result[i] = i;
		}
	});
});

describe("range-10k-step2", () => {
	bench("Num.range 10k step 2", () => {
		Num.range(0, 9_998, 2);
	});
	bench("native range loop 10k step 2", () => {
		const result: number[] = [];
		for (let i = 0; i < 10_000; i += 2) {
			result.push(i);
		}
	});
});

describe("range-step2-approaches", () => {
	bench("range push step 2 10k", () => {
		const result: number[] = [];
		for (let i = 0; i < 10_000; i += 2) {
			result.push(i);
		}
	});
	bench("[impl] range pre-alloc step 2 10k", () => {
		const count = Math.ceil(10_000 / 2);
		const result = new Array<number>(count);
		for (let i = 0; i < count; i++) {
			result[i] = i * 2;
		}
	});
});

describe("multiply-100", () => {
	bench("Arr.map + Num.multiply 100", () => {
		pipe(data100, Arr.map(Num.multiply(2)));
	});
	bench("Arr.map + inline lambda 100", () => {
		pipe(data100, Arr.map((n) => n * 2));
	});
});

describe("multiply-10k", () => {
	bench("Arr.map + Num.multiply 10k", () => {
		pipe(data10k, Arr.map(Num.multiply(2)));
	});
	bench("Arr.map + inline lambda 10k", () => {
		pipe(data10k, Arr.map((n) => n * 2));
	});
});

describe("clamp-100", () => {
	bench("Arr.map + Num.clamp 100", () => {
		pipe(data100, Arr.map(Num.clamp(0, 50)));
	});
	bench("Arr.map + inline clamp 100", () => {
		pipe(data100, Arr.map((n) => Math.min(Math.max(n, 0), 50)));
	});
});

describe("clamp-10k", () => {
	bench("Arr.map + Num.clamp 10k", () => {
		pipe(data10k, Arr.map(Num.clamp(0, 5_000)));
	});
	bench("Arr.map + inline clamp 10k", () => {
		pipe(data10k, Arr.map((n) => Math.min(Math.max(n, 0), 5_000)));
	});
});

describe("parse-100-valid", () => {
	bench("Num.parse 100 (all valid)", () => {
		numStrings100.map(Num.parse);
	});
	bench("native parse 100 (all valid)", () => {
		numStrings100.map((s) => {
			if (s.trim() === "") return { kind: "None" as const };
			const n = Number(s);
			return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
		});
	});
});

describe("parse-100-mixed", () => {
	bench("Num.parse 100 (mixed)", () => {
		mixedStrings100.map(Num.parse);
	});
	bench("native parse 100 (mixed)", () => {
		mixedStrings100.map((s) => {
			if (s.trim() === "") return { kind: "None" as const };
			const n = Number(s);
			return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
		});
	});
});

describe("parse-10k-valid", () => {
	bench("Num.parse 10k (all valid)", () => {
		numStrings10k.map(Num.parse);
	});
	bench("native parse 10k (all valid)", () => {
		numStrings10k.map((s) => {
			if (s.trim() === "") return { kind: "None" as const };
			const n = Number(s);
			return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
		});
	});
});

describe("parse-10k-mixed", () => {
	bench("Num.parse 10k (mixed)", () => {
		mixedStrings10k.map(Num.parse);
	});
	bench("native parse 10k (mixed)", () => {
		mixedStrings10k.map((s) => {
			if (s.trim() === "") return { kind: "None" as const };
			const n = Number(s);
			return isNaN(n) ? { kind: "None" as const } : { kind: "Some" as const, value: n };
		});
	});
});
