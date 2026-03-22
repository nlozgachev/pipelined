import { Rec } from "../Rec.ts";
import { Option } from "#core/Option.ts";
import { pipe } from "#composition/pipe.ts";

const makeRec = (n: number): Record<string, number> =>
	Object.fromEntries(Array.from({ length: n }, (_, i) => [`key${i}`, i]));

const rec100 = makeRec(100);
const rec10k = makeRec(10_000);

// =============================================================================
// map
// =============================================================================

Deno.bench("Rec.map 100", { group: "rec-map-100", baseline: true }, () => {
	pipe(rec100, Rec.map((n) => n * 2));
});

Deno.bench("native Object.fromEntries map 100", { group: "rec-map-100" }, () => {
	Object.fromEntries(Object.entries(rec100).map(([k, v]) => [k, v * 2]));
});

Deno.bench("Rec.map 10k", { group: "rec-map-10k", baseline: true }, () => {
	pipe(rec10k, Rec.map((n) => n * 2));
});

Deno.bench("native Object.fromEntries map 10k", { group: "rec-map-10k" }, () => {
	Object.fromEntries(Object.entries(rec10k).map(([k, v]) => [k, v * 2]));
});

// =============================================================================
// filter
// =============================================================================

Deno.bench("Rec.filter 10k", { group: "rec-filter-10k", baseline: true }, () => {
	pipe(rec10k, Rec.filter((n) => n % 2 === 0));
});

Deno.bench("native filter loop 10k", { group: "rec-filter-10k" }, () => {
	const result: Record<string, number> = {};
	for (const [k, v] of Object.entries(rec10k)) {
		if (v % 2 === 0) result[k] = v;
	}
});

// =============================================================================
// filter — Map-based and bitwise variants
// =============================================================================

// Convert record → Map on each call (realistic cost of Map approach)
Deno.bench("Map filter 10k (with conversion)", { group: "rec-filter-approaches-10k" }, () => {
	const m = new Map(Object.entries(rec10k));
	const result: Record<string, number> = {};
	m.forEach((v, k) => {
		if (v % 2 === 0) result[k] = v;
	});
});

// Pre-built Map — measures pure Map iteration with no conversion cost (best-case upper bound)
const map10k = new Map(Object.entries(rec10k));
Deno.bench("Map filter 10k (pre-built)", { group: "rec-filter-approaches-10k" }, () => {
	const result: Record<string, number> = {};
	map10k.forEach((v, k) => {
		if (v % 2 === 0) result[k] = v;
	});
});

// Bitwise even check — (n & 1) === 0 instead of n % 2 === 0
Deno.bench("Object.entries filter 10k (bitwise)", { group: "rec-filter-approaches-10k" }, () => {
	const result: Record<string, number> = {};
	for (const [k, v] of Object.entries(rec10k)) {
		if ((v & 1) === 0) result[k] = v;
	}
});

// Object.entries for-of loop — current Rec.filter implementation
Deno.bench("[impl] Object.entries for-of filter 10k", { group: "rec-filter-approaches-10k", baseline: true }, () => {
	const result: Record<string, number> = {};
	for (const [k, v] of Object.entries(rec10k)) {
		if (v % 2 === 0) result[k] = v;
	}
});

// Object.keys + Object.values + index — kept as reference for comparison
Deno.bench("keys+values index filter 10k", { group: "rec-filter-approaches-10k" }, () => {
	const result: Record<string, number> = {};
	const keys = Object.keys(rec10k);
	const vals = Object.values(rec10k);
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
const optRec10k = makeOptRec(10_000);

Deno.bench("Rec.compact 100", { group: "rec-compact-100", baseline: true }, () => {
	Rec.compact(optRec100);
});

Deno.bench("native compact loop 100", { group: "rec-compact-100" }, () => {
	const result: Record<string, number> = {};
	for (const [k, v] of Object.entries(optRec100)) {
		if (v.kind === "Some") result[k] = v.value;
	}
});

Deno.bench("Rec.compact 10k", { group: "rec-compact-10k", baseline: true }, () => {
	Rec.compact(optRec10k);
});

Deno.bench("native compact loop 10k", { group: "rec-compact-10k" }, () => {
	const result: Record<string, number> = {};
	for (const [k, v] of Object.entries(optRec10k)) {
		if (v.kind === "Some") result[k] = v.value;
	}
});

// =============================================================================
// mapKeys
// =============================================================================

Deno.bench("Rec.mapKeys 10k", { group: "rec-mapKeys-10k", baseline: true }, () => {
	pipe(rec10k, Rec.mapKeys((k) => `prefix_${k}`));
});

Deno.bench("native mapKeys loop 10k", { group: "rec-mapKeys-10k" }, () => {
	const result: Record<string, number> = {};
	for (const [k, v] of Object.entries(rec10k)) {
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

const data10k = Array.from({ length: 10_000 }, (_, i) => i);

Deno.bench("Rec.groupBy 10k", { group: "rec-groupBy-10k", baseline: true }, () => {
	pipe(data10k, Rec.groupBy((n) => String(n % 10)));
});

Deno.bench("native Object.groupBy 10k", { group: "rec-groupBy-10k" }, () => {
	Object.groupBy(data10k, (n) => String(n % 10));
});

// =============================================================================
// groupBy — approaches
// =============================================================================

Deno.bench("[impl] manual loop groupBy 10k", { group: "rec-groupBy-approaches-10k", baseline: true }, () => {
	const result: Record<string, number[]> = {};
	for (const n of data10k) {
		const key = String(n % 10);
		if (key in result) result[key].push(n);
		else result[key] = [n];
	}
});

Deno.bench("native Object.groupBy 10k", { group: "rec-groupBy-approaches-10k" }, () => {
	Object.groupBy(data10k, (n) => String(n % 10));
});
