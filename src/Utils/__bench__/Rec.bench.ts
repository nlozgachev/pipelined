import { Rec } from "../Rec.ts";
import { Option } from "#core/Option.ts";
import { pipe } from "#composition/pipe.ts";

const makeRec = (n: number): Record<string, number> =>
	Object.fromEntries(Array.from({ length: n }, (_, i) => [`key${i}`, i]));

const rec10 = makeRec(10);
const rec100 = makeRec(100);
const rec1k = makeRec(1_000);

// =============================================================================
// map
// =============================================================================

Deno.bench("Rec.map 10", { group: "rec-map-10", baseline: true }, () => {
	pipe(rec10, Rec.map((n) => n * 2));
});

Deno.bench("native Object.fromEntries map 10", { group: "rec-map-10" }, () => {
	Object.fromEntries(Object.entries(rec10).map(([k, v]) => [k, v * 2]));
});

Deno.bench("Rec.map 1k", { group: "rec-map-1k", baseline: true }, () => {
	pipe(rec1k, Rec.map((n) => n * 2));
});

Deno.bench("native Object.fromEntries map 1k", { group: "rec-map-1k" }, () => {
	Object.fromEntries(Object.entries(rec1k).map(([k, v]) => [k, v * 2]));
});

// =============================================================================
// filter
// =============================================================================

Deno.bench("Rec.filter 1k", { group: "rec-filter-1k", baseline: true }, () => {
	pipe(rec1k, Rec.filter((n) => n % 2 === 0));
});

Deno.bench("native filter loop 1k", { group: "rec-filter-1k" }, () => {
	const result: Record<string, number> = {};
	for (const [k, v] of Object.entries(rec1k)) {
		if (v % 2 === 0) result[k] = v;
	}
});

// =============================================================================
// filter — Map-based and bitwise variants
// =============================================================================

// Convert record → Map on each call (realistic cost of Map approach)
Deno.bench("Map filter 1k (with conversion)", { group: "rec-filter-approaches-1k" }, () => {
	const m = new Map(Object.entries(rec1k));
	const result: Record<string, number> = {};
	m.forEach((v, k) => {
		if (v % 2 === 0) result[k] = v;
	});
});

// Pre-built Map — measures pure Map iteration with no conversion cost (best-case upper bound)
const map1k = new Map(Object.entries(rec1k));
Deno.bench("Map filter 1k (pre-built)", { group: "rec-filter-approaches-1k" }, () => {
	const result: Record<string, number> = {};
	map1k.forEach((v, k) => {
		if (v % 2 === 0) result[k] = v;
	});
});

// Object.entries loop — current Rec.filter implementation baseline
Deno.bench("Object.entries filter 1k", { group: "rec-filter-approaches-1k" }, () => {
	const result: Record<string, number> = {};
	for (const [k, v] of Object.entries(rec1k)) {
		if (v % 2 === 0) result[k] = v;
	}
});

// Bitwise even check — (n & 1) === 0 instead of n % 2 === 0
Deno.bench("Object.entries filter 1k (bitwise)", { group: "rec-filter-approaches-1k" }, () => {
	const result: Record<string, number> = {};
	for (const [k, v] of Object.entries(rec1k)) {
		if ((v & 1) === 0) result[k] = v;
	}
});

// Object.keys + Object.values + index — 2 flat arrays instead of 1001 pair arrays
Deno.bench("[impl] keys+values index filter 1k", { group: "rec-filter-approaches-1k", baseline: true }, () => {
	const result: Record<string, number> = {};
	const keys = Object.keys(rec1k);
	const vals = Object.values(rec1k);
	for (let i = 0; i < keys.length; i++) {
		if (vals[i] % 2 === 0) result[keys[i]] = vals[i];
	}
});

// =============================================================================
// compact
// =============================================================================

const makeOptRec = (n: number): Record<string, Option<number>> =>
	Object.fromEntries(
		Array.from({ length: n }, (_, i) => [
			`key${i}`,
			i % 3 === 0 ? Option.none() : Option.some(i),
		]),
	);

const optRec100 = makeOptRec(100);
const optRec1k = makeOptRec(1_000);

Deno.bench("Rec.compact 100", { group: "rec-compact-100", baseline: true }, () => {
	Rec.compact(optRec100);
});

Deno.bench("native compact loop 100", { group: "rec-compact-100" }, () => {
	const result: Record<string, number> = {};
	for (const [k, v] of Object.entries(optRec100)) {
		if (v.kind === "Some") result[k] = v.value;
	}
});

Deno.bench("Rec.compact 1k", { group: "rec-compact-1k", baseline: true }, () => {
	Rec.compact(optRec1k);
});

Deno.bench("native compact loop 1k", { group: "rec-compact-1k" }, () => {
	const result: Record<string, number> = {};
	for (const [k, v] of Object.entries(optRec1k)) {
		if (v.kind === "Some") result[k] = v.value;
	}
});

// =============================================================================
// mapKeys
// =============================================================================

Deno.bench("Rec.mapKeys 1k", { group: "rec-mapKeys-1k", baseline: true }, () => {
	pipe(rec1k, Rec.mapKeys((k) => `prefix_${k}`));
});

Deno.bench("native mapKeys loop 1k", { group: "rec-mapKeys-1k" }, () => {
	const result: Record<string, number> = {};
	for (const [k, v] of Object.entries(rec1k)) {
		result[`prefix_${k}`] = v;
	}
});

// =============================================================================
// lookup
// =============================================================================

Deno.bench("Rec.lookup 100 (hit)", { group: "rec-lookup-100-hit", baseline: true }, () => {
	pipe(rec100, Rec.lookup("key50"));
});

Deno.bench("native lookup 100 (hit)", { group: "rec-lookup-100-hit" }, () => {
	const v = rec100["key50"];
	const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
	result;
});

// =============================================================================
// groupBy
// =============================================================================

const data1k = Array.from({ length: 1_000 }, (_, i) => i);

Deno.bench("Rec.groupBy 1k", { group: "rec-groupBy-1k", baseline: true }, () => {
	pipe(data1k, Rec.groupBy((n) => String(n % 10)));
});

Deno.bench("native Object.groupBy 1k", { group: "rec-groupBy-1k" }, () => {
	Object.groupBy(data1k, (n) => String(n % 10));
});

// =============================================================================
// groupBy — approaches
// =============================================================================

Deno.bench("[impl] manual loop groupBy 1k", { group: "rec-groupBy-approaches-1k", baseline: true }, () => {
	const result: Record<string, number[]> = {};
	for (const n of data1k) {
		const key = String(n % 10);
		if (key in result) result[key].push(n);
		else result[key] = [n];
	}
});

Deno.bench("native Object.groupBy 1k", { group: "rec-groupBy-approaches-1k" }, () => {
	Object.groupBy(data1k, (n) => String(n % 10));
});
