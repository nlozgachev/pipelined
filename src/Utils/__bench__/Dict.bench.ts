import { Dict } from "../Dict.ts";
import { Option } from "#core/Option.ts";
import { pipe } from "#composition/pipe.ts";

const makeDict = (n: number): ReadonlyMap<string, number> =>
	Dict.fromEntries(Array.from({ length: n }, (_, i) => [`key${i}`, i]));

const dict100 = makeDict(100);
const dict1k = makeDict(1_000);

// =============================================================================
// lookup (hit)
// =============================================================================

Deno.bench("Dict.lookup 1k (hit)", { group: "dict-lookup-1k-hit", baseline: true }, () => {
	pipe(dict1k, Dict.lookup("key500"));
});

Deno.bench("native map.get 1k (hit)", { group: "dict-lookup-1k-hit" }, () => {
	const v = dict1k.get("key500");
	const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
	result;
});

// =============================================================================
// lookup (miss)
// =============================================================================

Deno.bench("Dict.lookup 1k (miss)", { group: "dict-lookup-1k-miss", baseline: true }, () => {
	pipe(dict1k, Dict.lookup("missing"));
});

Deno.bench("native map.get 1k (miss)", { group: "dict-lookup-1k-miss" }, () => {
	const v = dict1k.get("missing");
	const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
	result;
});

// =============================================================================
// map
// =============================================================================

Deno.bench("Dict.map 1k", { group: "dict-map-1k", baseline: true }, () => {
	pipe(dict1k, Dict.map((n) => n * 2));
});

Deno.bench("native map spread 1k", { group: "dict-map-1k" }, () => {
	new globalThis.Map([...dict1k].map(([k, v]) => [k, v * 2] as const));
});

// =============================================================================
// map — approaches
// =============================================================================

Deno.bench("[impl] Dict.map for-of loop 1k", { group: "dict-map-approaches-1k", baseline: true }, () => {
	const result = new globalThis.Map<string, number>();
	for (const [k, v] of dict1k) {
		result.set(k, v * 2);
	}
});

Deno.bench("spread + array map 1k", { group: "dict-map-approaches-1k" }, () => {
	new globalThis.Map([...dict1k].map(([k, v]) => [k, v * 2] as const));
});

Deno.bench("forEach 1k", { group: "dict-map-approaches-1k" }, () => {
	const result = new globalThis.Map<string, number>();
	dict1k.forEach((v, k) => result.set(k, v * 2));
});

// =============================================================================
// filter
// =============================================================================

Deno.bench("Dict.filter 1k", { group: "dict-filter-1k", baseline: true }, () => {
	pipe(dict1k, Dict.filter((n) => n % 2 === 0));
});

Deno.bench("native filter loop 1k", { group: "dict-filter-1k" }, () => {
	const result = new globalThis.Map<string, number>();
	for (const [k, v] of dict1k) {
		if (v % 2 === 0) result.set(k, v);
	}
});

// =============================================================================
// union
// =============================================================================

const dictA = makeDict(500);
const dictB = Dict.fromEntries(Array.from({ length: 500 }, (_, i) => [`key${i + 250}`, i + 1000]));

Deno.bench("Dict.union 500+500", { group: "dict-union-500", baseline: true }, () => {
	pipe(dictA, Dict.union(dictB));
});

Deno.bench("native spread union 500+500", { group: "dict-union-500" }, () => {
	new globalThis.Map([...dictA, ...dictB]);
});

// =============================================================================
// intersection
// =============================================================================

Deno.bench("Dict.intersection 1k", { group: "dict-intersection-1k", baseline: true }, () => {
	pipe(dict1k, Dict.intersection(dictA));
});

Deno.bench("native intersection loop 1k", { group: "dict-intersection-1k" }, () => {
	const result = new globalThis.Map<string, number>();
	for (const [k, v] of dict1k) {
		if (dictA.has(k)) result.set(k, v);
	}
});

// =============================================================================
// compact
// =============================================================================

const optDict100 = Dict.fromEntries<string, Option<number>>(
	Array.from({ length: 100 }, (_, i) => [
		`key${i}`,
		i % 3 === 0 ? Option.none() : Option.some(i),
	]),
);

Deno.bench("Dict.compact 100", { group: "dict-compact-100", baseline: true }, () => {
	Dict.compact(optDict100);
});

Deno.bench("native compact loop 100", { group: "dict-compact-100" }, () => {
	const result = new globalThis.Map<string, number>();
	for (const [k, v] of optDict100) {
		if (v.kind === "Some") result.set(k, v.value);
	}
});

// =============================================================================
// reduce
// =============================================================================

Deno.bench("Dict.reduce 1k (sum)", { group: "dict-reduce-1k", baseline: true }, () => {
	Dict.reduce(0, (acc, v: number) => acc + v)(dict1k);
});

Deno.bench("Dict.reduceWithKey 1k (sum)", { group: "dict-reduce-1k" }, () => {
	Dict.reduceWithKey(0, (acc, v: number) => acc + v)(dict1k);
});

Deno.bench("native values() loop 1k", { group: "dict-reduce-1k" }, () => {
	let acc = 0;
	for (const v of dict1k.values()) acc += v;
});

Deno.bench("native entries() loop 1k", { group: "dict-reduce-1k" }, () => {
	let acc = 0;
	for (const [, v] of dict1k) acc += v;
});

// =============================================================================
// insert (single key into 100-entry map)
// =============================================================================

Deno.bench("Dict.insert 100", { group: "dict-insert-100", baseline: true }, () => {
	pipe(dict100, Dict.insert("newKey", 999));
});

Deno.bench("native insert clone 100", { group: "dict-insert-100" }, () => {
	const result = new globalThis.Map(dict100);
	result.set("newKey", 999);
});

// =============================================================================
// groupBy
// =============================================================================

const data1k = Array.from({ length: 1_000 }, (_, i) => i);

Deno.bench("Dict.groupBy 1k", { group: "dict-groupBy-1k", baseline: true }, () => {
	pipe(data1k, Dict.groupBy((n) => n % 10));
});

Deno.bench("native Map.groupBy 1k", { group: "dict-groupBy-1k" }, () => {
	globalThis.Map.groupBy(data1k, (n) => n % 10);
});

// =============================================================================
// groupBy — approaches
// =============================================================================

Deno.bench("[impl] manual loop groupBy 1k", { group: "dict-groupBy-approaches-1k", baseline: true }, () => {
	const result = new globalThis.Map<number, number[]>();
	for (const n of data1k) {
		const key = n % 10;
		const arr = result.get(key);
		if (arr !== undefined) arr.push(n);
		else result.set(key, [n]);
	}
});

Deno.bench("native Map.groupBy 1k", { group: "dict-groupBy-approaches-1k" }, () => {
	globalThis.Map.groupBy(data1k, (n) => n % 10);
});
