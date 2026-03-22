import { Uniq } from "../Uniq.ts";
import { pipe } from "#composition/pipe.ts";

const data1k = Array.from({ length: 1_000 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);

const set1k = Uniq.fromArray(data1k);
const set10k = Uniq.fromArray(data10k);

// =============================================================================
// fromArray
// =============================================================================

Deno.bench("Uniq.fromArray 10k", { group: "uniq-fromArray-10k", baseline: true }, () => {
	Uniq.fromArray(data10k);
});

Deno.bench("native new Set 10k", { group: "uniq-fromArray-10k" }, () => {
	new globalThis.Set(data10k);
});

// =============================================================================
// has
// =============================================================================

Deno.bench("Uniq.has 1k (present)", { group: "uniq-has-1k-hit", baseline: true }, () => {
	pipe(set1k, Uniq.has(500));
});

Deno.bench("native set.has 1k (present)", { group: "uniq-has-1k-hit" }, () => {
	set1k.has(500);
});

Deno.bench("Uniq.has 1k (absent)", { group: "uniq-has-1k-miss", baseline: true }, () => {
	pipe(set1k, Uniq.has(9999));
});

Deno.bench("native set.has 1k (absent)", { group: "uniq-has-1k-miss" }, () => {
	set1k.has(9999);
});

// =============================================================================
// map
// =============================================================================

Deno.bench("Uniq.map 1k", { group: "uniq-map-1k", baseline: true }, () => {
	pipe(set1k, Uniq.map((n) => n * 2));
});

Deno.bench("native map loop 1k", { group: "uniq-map-1k" }, () => {
	const result = new globalThis.Set<number>();
	for (const item of set1k) result.add(item * 2);
});

// =============================================================================
// filter
// =============================================================================

Deno.bench("Uniq.filter 1k", { group: "uniq-filter-1k", baseline: true }, () => {
	pipe(set1k, Uniq.filter((n) => n % 2 === 0));
});

Deno.bench("native filter loop 1k", { group: "uniq-filter-1k" }, () => {
	const result = new globalThis.Set<number>();
	for (const item of set1k) if (item % 2 === 0) result.add(item);
});

// =============================================================================
// union
// =============================================================================

const setA = Uniq.fromArray(Array.from({ length: 500 }, (_, i) => i));
const setB = Uniq.fromArray(Array.from({ length: 500 }, (_, i) => i + 250));

Deno.bench("Uniq.union 500+500", { group: "uniq-union-500", baseline: true }, () => {
	pipe(setA, Uniq.union(setB));
});

Deno.bench("native union loop 500+500", { group: "uniq-union-500" }, () => {
	const result = new globalThis.Set(setA);
	for (const item of setB) result.add(item);
});

Deno.bench("native set.union() 500+500", { group: "uniq-union-500" }, () => {
	(setA as Set<number>).union(setB as Set<number>);
});

// =============================================================================
// union — approaches
// =============================================================================

Deno.bench("[impl] native set.union() 500+500", { group: "uniq-union-approaches-500", baseline: true }, () => {
	(setA as Set<number>).union(setB as Set<number>);
});

Deno.bench("for-of add loop 500+500", { group: "uniq-union-approaches-500" }, () => {
	const result = new globalThis.Set(setA);
	for (const item of setB) result.add(item);
});

Deno.bench("spread union 500+500", { group: "uniq-union-approaches-500" }, () => {
	new globalThis.Set([...setA, ...setB]);
});

// =============================================================================
// intersection
// =============================================================================

Deno.bench("Uniq.intersection 1k", { group: "uniq-intersection-1k", baseline: true }, () => {
	pipe(set1k, Uniq.intersection(setA));
});

Deno.bench("native intersection loop 1k", { group: "uniq-intersection-1k" }, () => {
	const result = new globalThis.Set<number>();
	for (const item of set1k) if (setA.has(item)) result.add(item);
});

Deno.bench("native set.intersection() 1k", { group: "uniq-intersection-1k" }, () => {
	(set1k as Set<number>).intersection(setA as Set<number>);
});

// =============================================================================
// difference
// =============================================================================

Deno.bench("Uniq.difference 1k", { group: "uniq-difference-1k", baseline: true }, () => {
	pipe(set1k, Uniq.difference(setA));
});

Deno.bench("native difference loop 1k", { group: "uniq-difference-1k" }, () => {
	const result = new globalThis.Set<number>();
	for (const item of set1k) if (!setA.has(item)) result.add(item);
});

Deno.bench("native set.difference() 1k", { group: "uniq-difference-1k" }, () => {
	(set1k as Set<number>).difference(setA as Set<number>);
});

// =============================================================================
// reduce
// =============================================================================

Deno.bench("Uniq.reduce 1k (sum)", { group: "uniq-reduce-1k", baseline: true }, () => {
	Uniq.reduce(0, (acc, n: number) => acc + n)(set1k);
});

Deno.bench("native reduce loop 1k", { group: "uniq-reduce-1k" }, () => {
	let acc = 0;
	for (const item of set1k) acc += item;
});

// =============================================================================
// insert (into 1k set)
// =============================================================================

Deno.bench("Uniq.insert 1k (new item)", { group: "uniq-insert-1k-new", baseline: true }, () => {
	pipe(set1k, Uniq.insert(9999));
});

Deno.bench("native insert clone 1k", { group: "uniq-insert-1k-new" }, () => {
	const result = new globalThis.Set(set1k);
	result.add(9999);
});

Deno.bench("Uniq.insert 10k (existing — no copy)", { group: "uniq-insert-10k-existing", baseline: true }, () => {
	pipe(set10k, Uniq.insert(500));
});

Deno.bench("native insert existing 10k", { group: "uniq-insert-10k-existing" }, () => {
	const result = new globalThis.Set(set10k);
	result.add(500);
});
