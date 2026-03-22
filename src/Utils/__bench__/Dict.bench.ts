import { Dict } from "../Dict.ts";
import { Option } from "#core/Option.ts";
import { pipe } from "#composition/pipe.ts";

const makeDict = (n: number): ReadonlyMap<string, number> =>
	Dict.fromEntries(Array.from({ length: n }, (_, i) => [`key${i}`, i]));

const dict100 = makeDict(100);
const dict10k = makeDict(10_000);

// =============================================================================
// lookup (hit)
// =============================================================================

Deno.bench("Dict.lookup 100 (hit)", { group: "dict-lookup-100-hit", baseline: true }, () => {
	pipe(dict100, Dict.lookup("key50"));
});

Deno.bench("native map.get 100 (hit)", { group: "dict-lookup-100-hit" }, () => {
	const v = dict100.get("key50");
	const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
	result;
});

Deno.bench("Dict.lookup 10k (hit)", { group: "dict-lookup-10k-hit", baseline: true }, () => {
	pipe(dict10k, Dict.lookup("key5000"));
});

Deno.bench("native map.get 10k (hit)", { group: "dict-lookup-10k-hit" }, () => {
	const v = dict10k.get("key5000");
	const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
	result;
});

// =============================================================================
// lookup (miss)
// =============================================================================

Deno.bench("Dict.lookup 100 (miss)", { group: "dict-lookup-100-miss", baseline: true }, () => {
	pipe(dict100, Dict.lookup("missing"));
});

Deno.bench("native map.get 100 (miss)", { group: "dict-lookup-100-miss" }, () => {
	const v = dict100.get("missing");
	const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
	result;
});

Deno.bench("Dict.lookup 10k (miss)", { group: "dict-lookup-10k-miss", baseline: true }, () => {
	pipe(dict10k, Dict.lookup("missing"));
});

Deno.bench("native map.get 10k (miss)", { group: "dict-lookup-10k-miss" }, () => {
	const v = dict10k.get("missing");
	const result = v !== undefined ? { kind: "Some" as const, value: v } : { kind: "None" as const };
	result;
});

// =============================================================================
// map
// =============================================================================

Deno.bench("Dict.map 100", { group: "dict-map-100", baseline: true }, () => {
	pipe(dict100, Dict.map((n) => n * 2));
});

Deno.bench("native map spread 100", { group: "dict-map-100" }, () => {
	new globalThis.Map([...dict100].map(([k, v]) => [k, v * 2] as const));
});

Deno.bench("Dict.map 10k", { group: "dict-map-10k", baseline: true }, () => {
	pipe(dict10k, Dict.map((n) => n * 2));
});

Deno.bench("native map spread 10k", { group: "dict-map-10k" }, () => {
	new globalThis.Map([...dict10k].map(([k, v]) => [k, v * 2] as const));
});

// =============================================================================
// map — approaches
// =============================================================================

Deno.bench("[impl] Dict.map for-of loop 10k", { group: "dict-map-approaches-10k", baseline: true }, () => {
	const result = new globalThis.Map<string, number>();
	for (const [k, v] of dict10k) {
		result.set(k, v * 2);
	}
});

Deno.bench("spread + array map 10k", { group: "dict-map-approaches-10k" }, () => {
	new globalThis.Map([...dict10k].map(([k, v]) => [k, v * 2] as const));
});

Deno.bench("forEach 10k", { group: "dict-map-approaches-10k" }, () => {
	const result = new globalThis.Map<string, number>();
	dict10k.forEach((v, k) => result.set(k, v * 2));
});

// =============================================================================
// filter
// =============================================================================

Deno.bench("Dict.filter 100", { group: "dict-filter-100", baseline: true }, () => {
	pipe(dict100, Dict.filter((n) => n % 2 === 0));
});

Deno.bench("native filter loop 100", { group: "dict-filter-100" }, () => {
	const result = new globalThis.Map<string, number>();
	for (const [k, v] of dict100) {
		if (v % 2 === 0) result.set(k, v);
	}
});

Deno.bench("Dict.filter 10k", { group: "dict-filter-10k", baseline: true }, () => {
	pipe(dict10k, Dict.filter((n) => n % 2 === 0));
});

Deno.bench("native filter loop 10k", { group: "dict-filter-10k" }, () => {
	const result = new globalThis.Map<string, number>();
	for (const [k, v] of dict10k) {
		if (v % 2 === 0) result.set(k, v);
	}
});

// =============================================================================
// union
// =============================================================================

const dictA100 = makeDict(50);
const dictB100 = Dict.fromEntries(Array.from({ length: 50 }, (_, i) => [`key${i + 25}`, i + 1000]));
const dictA10k = makeDict(5_000);
const dictB10k = Dict.fromEntries(Array.from({ length: 5_000 }, (_, i) => [`key${i + 2_500}`, i + 10_000]));

Deno.bench("Dict.union 100", { group: "dict-union-100", baseline: true }, () => {
	pipe(dictA100, Dict.union(dictB100));
});

Deno.bench("native spread union 100", { group: "dict-union-100" }, () => {
	new globalThis.Map([...dictA100, ...dictB100]);
});

Deno.bench("Dict.union 10k", { group: "dict-union-10k", baseline: true }, () => {
	pipe(dictA10k, Dict.union(dictB10k));
});

Deno.bench("native spread union 10k", { group: "dict-union-10k" }, () => {
	new globalThis.Map([...dictA10k, ...dictB10k]);
});

// =============================================================================
// intersection
// =============================================================================

Deno.bench("Dict.intersection 100", { group: "dict-intersection-100", baseline: true }, () => {
	pipe(dict100, Dict.intersection(dictA100));
});

Deno.bench("native intersection loop 100", { group: "dict-intersection-100" }, () => {
	const result = new globalThis.Map<string, number>();
	for (const [k, v] of dict100) {
		if (dictA100.has(k)) result.set(k, v);
	}
});

Deno.bench("Dict.intersection 10k", { group: "dict-intersection-10k", baseline: true }, () => {
	pipe(dict10k, Dict.intersection(dictA10k));
});

Deno.bench("native intersection loop 10k", { group: "dict-intersection-10k" }, () => {
	const result = new globalThis.Map<string, number>();
	for (const [k, v] of dict10k) {
		if (dictA10k.has(k)) result.set(k, v);
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

const optDict10k = Dict.fromEntries<string, Option<number>>(
	Array.from({ length: 10_000 }, (_, i) => [
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

Deno.bench("Dict.compact 10k", { group: "dict-compact-10k", baseline: true }, () => {
	Dict.compact(optDict10k);
});

Deno.bench("native compact loop 10k", { group: "dict-compact-10k" }, () => {
	const result = new globalThis.Map<string, number>();
	for (const [k, v] of optDict10k) {
		if (v.kind === "Some") result.set(k, v.value);
	}
});

// =============================================================================
// reduce
// =============================================================================

Deno.bench("Dict.reduce 100 (sum)", { group: "dict-reduce-100", baseline: true }, () => {
	Dict.reduce(0, (acc, v: number) => acc + v)(dict100);
});

Deno.bench("Dict.reduceWithKey 100 (sum)", { group: "dict-reduce-100" }, () => {
	Dict.reduceWithKey(0, (acc, v: number) => acc + v)(dict100);
});

Deno.bench("native values() loop 100", { group: "dict-reduce-100" }, () => {
	let acc = 0;
	for (const v of dict100.values()) acc += v;
});

Deno.bench("native entries() loop 100", { group: "dict-reduce-100" }, () => {
	let acc = 0;
	for (const [, v] of dict100) acc += v;
});

Deno.bench("Dict.reduce 10k (sum)", { group: "dict-reduce-10k", baseline: true }, () => {
	Dict.reduce(0, (acc, v: number) => acc + v)(dict10k);
});

Deno.bench("Dict.reduceWithKey 10k (sum)", { group: "dict-reduce-10k" }, () => {
	Dict.reduceWithKey(0, (acc, v: number) => acc + v)(dict10k);
});

Deno.bench("native values() loop 10k", { group: "dict-reduce-10k" }, () => {
	let acc = 0;
	for (const v of dict10k.values()) acc += v;
});

Deno.bench("native entries() loop 10k", { group: "dict-reduce-10k" }, () => {
	let acc = 0;
	for (const [, v] of dict10k) acc += v;
});

// =============================================================================
// insert
// =============================================================================

Deno.bench("Dict.insert 100", { group: "dict-insert-100", baseline: true }, () => {
	pipe(dict100, Dict.insert("newKey", 999));
});

Deno.bench("native insert clone 100", { group: "dict-insert-100" }, () => {
	const result = new globalThis.Map(dict100);
	result.set("newKey", 999);
});

Deno.bench("Dict.insert 10k", { group: "dict-insert-10k", baseline: true }, () => {
	pipe(dict10k, Dict.insert("newKey", 999));
});

Deno.bench("native insert clone 10k", { group: "dict-insert-10k" }, () => {
	const result = new globalThis.Map(dict10k);
	result.set("newKey", 999);
});

// =============================================================================
// groupBy
// =============================================================================

const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);

Deno.bench("Dict.groupBy 100", { group: "dict-groupBy-100", baseline: true }, () => {
	pipe(data100, Dict.groupBy((n) => n % 10));
});

Deno.bench("native Map.groupBy 100", { group: "dict-groupBy-100" }, () => {
	globalThis.Map.groupBy(data100, (n) => n % 10);
});

Deno.bench("Dict.groupBy 10k", { group: "dict-groupBy-10k", baseline: true }, () => {
	pipe(data10k, Dict.groupBy((n) => n % 10));
});

Deno.bench("native Map.groupBy 10k", { group: "dict-groupBy-10k" }, () => {
	globalThis.Map.groupBy(data10k, (n) => n % 10);
});

// =============================================================================
// groupBy — approaches
// =============================================================================

Deno.bench("[impl] manual loop groupBy 10k", { group: "dict-groupBy-approaches-10k", baseline: true }, () => {
	const result = new globalThis.Map<number, number[]>();
	for (const n of data10k) {
		const key = n % 10;
		const arr = result.get(key);
		if (arr !== undefined) arr.push(n);
		else result.set(key, [n]);
	}
});

Deno.bench("native Map.groupBy 10k", { group: "dict-groupBy-approaches-10k" }, () => {
	globalThis.Map.groupBy(data10k, (n) => n % 10);
});
