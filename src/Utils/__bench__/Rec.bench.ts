import { pipe } from "#composition/pipe.ts";
import { Option } from "#core/Option.ts";
import { bench, describe } from "vitest";
import { Rec } from "../Rec.ts";

const makeRec = (n: number): Record<string, number> =>
	Object.fromEntries(Array.from({ length: n }, (_, i) => [`key${i}`, i]));

const rec100 = makeRec(100);
const rec10k = makeRec(10_000);
const makeOptRec = (n: number): Record<string, Option<number>> =>
	Object.fromEntries(
		Array.from({ length: n }, (_, i) => [
			`key${i}`,
			i % 3 === 0 ? Option.none() : Option.some(i),
		]),
	);
const optRec100 = makeOptRec(100);
const optRec10k = makeOptRec(10_000);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);

// =============================================================================
// map
// =============================================================================

describe("rec-map-100", () => {
	bench("Rec.map 100", () => {
		pipe(rec100, Rec.map((n) => n * 2));
	});
	bench("native Object.fromEntries map 100", () => {
		Object.fromEntries(Object.entries(rec100).map(([k, v]) => [k, v * 2]));
	});
});

describe("rec-map-10k", () => {
	bench("Rec.map 10k", () => {
		pipe(rec10k, Rec.map((n) => n * 2));
	});
	bench("native Object.fromEntries map 10k", () => {
		Object.fromEntries(Object.entries(rec10k).map(([k, v]) => [k, v * 2]));
	});
});

describe("rec-filter-10k", () => {
	bench("Rec.filter 10k", () => {
		pipe(rec10k, Rec.filter((n) => n % 2 === 0));
	});
	bench("native filter loop 10k", () => {
		const result: Record<string, number> = {};
		for (const [k, v] of Object.entries(rec10k)) {
			if (v % 2 === 0) result[k] = v;
		}
	});
});

describe("rec-filter-approaches-10k", () => {
	bench("Map filter 10k (with conversion)", () => {
		const m = new Map(Object.entries(rec10k));
		const result: Record<string, number> = {};
		m.forEach((v, k) => {
			if (v % 2 === 0) result[k] = v;
		});
	});
	bench("Object.entries filter 10k (bitwise)", () => {
		const result: Record<string, number> = {};
		for (const [k, v] of Object.entries(rec10k)) {
			if ((v & 1) === 0) result[k] = v;
		}
	});
	bench("[impl] Object.entries for-of filter 10k", () => {
		const result: Record<string, number> = {};
		for (const [k, v] of Object.entries(rec10k)) {
			if (v % 2 === 0) result[k] = v;
		}
	});
	bench("keys+values index filter 10k", () => {
		const result: Record<string, number> = {};
		const keys = Object.keys(rec10k);
		const vals = Object.values(rec10k);
		for (let i = 0; i < keys.length; i++) {
			if (vals[i] % 2 === 0) result[keys[i]] = vals[i];
		}
	});
});

describe("rec-compact-100", () => {
	bench("Rec.compact 100", () => {
		Rec.compact(optRec100);
	});
	bench("native compact loop 100", () => {
		const result: Record<string, number> = {};
		for (const [k, v] of Object.entries(optRec100)) {
			if (v.kind === "Some") result[k] = v.value;
		}
	});
});

describe("rec-compact-10k", () => {
	bench("Rec.compact 10k", () => {
		Rec.compact(optRec10k);
	});
	bench("native compact loop 10k", () => {
		const result: Record<string, number> = {};
		for (const [k, v] of Object.entries(optRec10k)) {
			if (v.kind === "Some") result[k] = v.value;
		}
	});
});

describe("rec-mapKeys-10k", () => {
	bench("Rec.mapKeys 10k", () => {
		pipe(rec10k, Rec.mapKeys((k) => `prefix_${k}`));
	});
	bench("native mapKeys loop 10k", () => {
		const result: Record<string, number> = {};
		for (const [k, v] of Object.entries(rec10k)) {
			result[`prefix_${k}`] = v;
		}
	});
});

describe("rec-lookup-100-hit", () => {
	bench("Rec.lookup 100 (hit)", () => {
		pipe(rec100, Rec.lookup("key50"));
	});
	bench("native lookup 100 (hit)", () => {
		const v = rec100["key50"];
		const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
		void result;
	});
});

describe("rec-groupBy-10k", () => {
	bench("Rec.groupBy 10k", () => {
		pipe(data10k, Rec.groupBy((n) => String(n % 10)));
	});
	bench("native Object.groupBy 10k", () => {
		Object.groupBy(data10k, (n) => String(n % 10));
	});
});

describe("rec-groupBy-approaches-10k", () => {
	bench("[impl] manual loop groupBy 10k", () => {
		const result: Record<string, number[]> = {};
		for (const n of data10k) {
			const key = String(n % 10);
			if (key in result) result[key].push(n);
			else result[key] = [n];
		}
	});
	bench("native Object.groupBy 10k", () => {
		Object.groupBy(data10k, (n) => String(n % 10));
	});
});
