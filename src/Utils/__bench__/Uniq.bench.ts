import { Uniq } from "../Uniq.ts";
import { pipe } from "#composition/pipe.ts";

const data100 = Array.from({ length: 100 }, (_, i) => i);
const data10k = Array.from({ length: 10_000 }, (_, i) => i);

const set100 = Uniq.fromArray(data100);
const set10k = Uniq.fromArray(data10k);

// =============================================================================
// fromArray
// =============================================================================

Deno.bench("Uniq.fromArray 100", { group: "uniq-fromArray-100", baseline: true }, () => {
	Uniq.fromArray(data100);
});

Deno.bench("native new Set 100", { group: "uniq-fromArray-100" }, () => {
	new globalThis.Set(data100);
});

Deno.bench("Uniq.fromArray 10k", { group: "uniq-fromArray-10k", baseline: true }, () => {
	Uniq.fromArray(data10k);
});

Deno.bench("native new Set 10k", { group: "uniq-fromArray-10k" }, () => {
	new globalThis.Set(data10k);
});

// =============================================================================
// has
// =============================================================================

Deno.bench("Uniq.has 100 (present)", { group: "uniq-has-100-hit", baseline: true }, () => {
	pipe(set100, Uniq.has(50));
});

Deno.bench("native set.has 100 (present)", { group: "uniq-has-100-hit" }, () => {
	set100.has(50);
});

Deno.bench("Uniq.has 100 (absent)", { group: "uniq-has-100-miss", baseline: true }, () => {
	pipe(set100, Uniq.has(9999));
});

Deno.bench("native set.has 100 (absent)", { group: "uniq-has-100-miss" }, () => {
	set100.has(9999);
});

Deno.bench("Uniq.has 10k (present)", { group: "uniq-has-10k-hit", baseline: true }, () => {
	pipe(set10k, Uniq.has(5000));
});

Deno.bench("native set.has 10k (present)", { group: "uniq-has-10k-hit" }, () => {
	set10k.has(5000);
});

Deno.bench("Uniq.has 10k (absent)", { group: "uniq-has-10k-miss", baseline: true }, () => {
	pipe(set10k, Uniq.has(99999));
});

Deno.bench("native set.has 10k (absent)", { group: "uniq-has-10k-miss" }, () => {
	set10k.has(99999);
});

// =============================================================================
// map
// =============================================================================

Deno.bench("Uniq.map 100", { group: "uniq-map-100", baseline: true }, () => {
	pipe(set100, Uniq.map((n) => n * 2));
});

Deno.bench("native map loop 100", { group: "uniq-map-100" }, () => {
	const result = new globalThis.Set<number>();
	for (const item of set100) result.add(item * 2);
});

Deno.bench("Uniq.map 10k", { group: "uniq-map-10k", baseline: true }, () => {
	pipe(set10k, Uniq.map((n) => n * 2));
});

Deno.bench("native map loop 10k", { group: "uniq-map-10k" }, () => {
	const result = new globalThis.Set<number>();
	for (const item of set10k) result.add(item * 2);
});

// =============================================================================
// filter
// =============================================================================

Deno.bench("Uniq.filter 100", { group: "uniq-filter-100", baseline: true }, () => {
	pipe(set100, Uniq.filter((n) => n % 2 === 0));
});

Deno.bench("native filter loop 100", { group: "uniq-filter-100" }, () => {
	const result = new globalThis.Set<number>();
	for (const item of set100) if (item % 2 === 0) result.add(item);
});

Deno.bench("Uniq.filter 10k", { group: "uniq-filter-10k", baseline: true }, () => {
	pipe(set10k, Uniq.filter((n) => n % 2 === 0));
});

Deno.bench("native filter loop 10k", { group: "uniq-filter-10k" }, () => {
	const result = new globalThis.Set<number>();
	for (const item of set10k) if (item % 2 === 0) result.add(item);
});

// =============================================================================
// union
// =============================================================================

const setA100 = Uniq.fromArray(Array.from({ length: 50 }, (_, i) => i));
const setB100 = Uniq.fromArray(Array.from({ length: 50 }, (_, i) => i + 25));
const setA10k = Uniq.fromArray(Array.from({ length: 5_000 }, (_, i) => i));
const setB10k = Uniq.fromArray(Array.from({ length: 5_000 }, (_, i) => i + 2_500));

Deno.bench("Uniq.union 100", { group: "uniq-union-100", baseline: true }, () => {
	pipe(setA100, Uniq.union(setB100));
});

Deno.bench("native union loop 100", { group: "uniq-union-100" }, () => {
	const result = new globalThis.Set(setA100);
	for (const item of setB100) result.add(item);
});

Deno.bench("native set.union() 100", { group: "uniq-union-100" }, () => {
	(setA100 as Set<number>).union(setB100 as Set<number>);
});

Deno.bench("Uniq.union 10k", { group: "uniq-union-10k", baseline: true }, () => {
	pipe(setA10k, Uniq.union(setB10k));
});

Deno.bench("native union loop 10k", { group: "uniq-union-10k" }, () => {
	const result = new globalThis.Set(setA10k);
	for (const item of setB10k) result.add(item);
});

Deno.bench("native set.union() 10k", { group: "uniq-union-10k" }, () => {
	(setA10k as Set<number>).union(setB10k as Set<number>);
});

// =============================================================================
// union — approaches
// =============================================================================

Deno.bench("[impl] native set.union() 10k", { group: "uniq-union-approaches-10k", baseline: true }, () => {
	(setA10k as Set<number>).union(setB10k as Set<number>);
});

Deno.bench("for-of add loop 10k", { group: "uniq-union-approaches-10k" }, () => {
	const result = new globalThis.Set(setA10k);
	for (const item of setB10k) result.add(item);
});

Deno.bench("spread union 10k", { group: "uniq-union-approaches-10k" }, () => {
	new globalThis.Set([...setA10k, ...setB10k]);
});

// =============================================================================
// intersection
// =============================================================================

Deno.bench("Uniq.intersection 100", { group: "uniq-intersection-100", baseline: true }, () => {
	pipe(set100, Uniq.intersection(setA100));
});

Deno.bench("native intersection loop 100", { group: "uniq-intersection-100" }, () => {
	const result = new globalThis.Set<number>();
	for (const item of set100) if (setA100.has(item)) result.add(item);
});

Deno.bench("native set.intersection() 100", { group: "uniq-intersection-100" }, () => {
	(set100 as Set<number>).intersection(setA100 as Set<number>);
});

Deno.bench("Uniq.intersection 10k", { group: "uniq-intersection-10k", baseline: true }, () => {
	pipe(set10k, Uniq.intersection(setA10k));
});

Deno.bench("native intersection loop 10k", { group: "uniq-intersection-10k" }, () => {
	const result = new globalThis.Set<number>();
	for (const item of set10k) if (setA10k.has(item)) result.add(item);
});

Deno.bench("native set.intersection() 10k", { group: "uniq-intersection-10k" }, () => {
	(set10k as Set<number>).intersection(setA10k as Set<number>);
});

// =============================================================================
// difference
// =============================================================================

Deno.bench("Uniq.difference 100", { group: "uniq-difference-100", baseline: true }, () => {
	pipe(set100, Uniq.difference(setA100));
});

Deno.bench("native difference loop 100", { group: "uniq-difference-100" }, () => {
	const result = new globalThis.Set<number>();
	for (const item of set100) if (!setA100.has(item)) result.add(item);
});

Deno.bench("native set.difference() 100", { group: "uniq-difference-100" }, () => {
	(set100 as Set<number>).difference(setA100 as Set<number>);
});

Deno.bench("Uniq.difference 10k", { group: "uniq-difference-10k", baseline: true }, () => {
	pipe(set10k, Uniq.difference(setA10k));
});

Deno.bench("native difference loop 10k", { group: "uniq-difference-10k" }, () => {
	const result = new globalThis.Set<number>();
	for (const item of set10k) if (!setA10k.has(item)) result.add(item);
});

Deno.bench("native set.difference() 10k", { group: "uniq-difference-10k" }, () => {
	(set10k as Set<number>).difference(setA10k as Set<number>);
});

// =============================================================================
// reduce
// =============================================================================

Deno.bench("Uniq.reduce 100 (sum)", { group: "uniq-reduce-100", baseline: true }, () => {
	Uniq.reduce(0, (acc, n: number) => acc + n)(set100);
});

Deno.bench("native reduce loop 100", { group: "uniq-reduce-100" }, () => {
	let acc = 0;
	for (const item of set100) acc += item;
});

Deno.bench("Uniq.reduce 10k (sum)", { group: "uniq-reduce-10k", baseline: true }, () => {
	Uniq.reduce(0, (acc, n: number) => acc + n)(set10k);
});

Deno.bench("native reduce loop 10k", { group: "uniq-reduce-10k" }, () => {
	let acc = 0;
	for (const item of set10k) acc += item;
});

// =============================================================================
// insert
// =============================================================================

Deno.bench("Uniq.insert 100 (new item)", { group: "uniq-insert-100-new", baseline: true }, () => {
	pipe(set100, Uniq.insert(9999));
});

Deno.bench("native insert clone 100", { group: "uniq-insert-100-new" }, () => {
	const result = new globalThis.Set(set100);
	result.add(9999);
});

Deno.bench("Uniq.insert 10k (new item)", { group: "uniq-insert-10k-new", baseline: true }, () => {
	pipe(set10k, Uniq.insert(99999));
});

Deno.bench("native insert clone 10k", { group: "uniq-insert-10k-new" }, () => {
	const result = new globalThis.Set(set10k);
	result.add(99999);
});

Deno.bench("Uniq.insert 10k (existing — no copy)", { group: "uniq-insert-10k-existing", baseline: true }, () => {
	pipe(set10k, Uniq.insert(500));
});

Deno.bench("native insert existing 10k", { group: "uniq-insert-10k-existing" }, () => {
	const result = new globalThis.Set(set10k);
	result.add(500);
});
