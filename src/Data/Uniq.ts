// =============================================================================
// Imports
// =============================================================================
import { Maybe } from "#core";
import { type NonEmpty as InternalNonEmpty, type NonEmptyArr } from "#internal";
import type { Brand } from "#types";

// =============================================================================
// Types
// =============================================================================
/**
 * A branded type representing a unique collection with at least one element.
 */
export type NonEmptySet<A> = Brand<InternalNonEmpty<"Uniq">, ReadonlySet<A>>;

// =============================================================================
// Private Helpers & Combinator Implementations
// =============================================================================

const isEmpty = <A>(s: ReadonlySet<A>): boolean => s.size === 0;
const isNonEmpty = <A>(s: ReadonlySet<A>): s is NonEmptySet<A> => s.size > 0;

const empty = <A>(): ReadonlySet<A> => new globalThis.Set<A>();

const singleton = <A>(item: A): ReadonlySet<A> => new globalThis.Set([item]);

const fromArray = <A>(arr: readonly A[]): ReadonlySet<A> => new globalThis.Set(arr);

const has = <A>(item: A) => (s: ReadonlySet<A>): boolean => s.has(item);

const size = <A>(s: ReadonlySet<A>): number => s.size;

const add = <A>(item: A) => (s: ReadonlySet<A>): ReadonlySet<A> => {
	if (s.has(item)) {
		return s;
	}
	const result = new globalThis.Set(s);
	result.add(item);
	return result;
};

const remove = <A>(item: A) => (s: ReadonlySet<A>): ReadonlySet<A> => {
	if (!s.has(item)) {
		return s;
	}
	const result = new globalThis.Set(s);
	result.delete(item);
	return result;
};

const toggle = <A>(item: A) => (s: ReadonlySet<A>): ReadonlySet<A> => {
	const result = new globalThis.Set(s);
	if (result.has(item)) {
		result.delete(item);
	} else {
		result.add(item);
	}
	return result;
};

const map = <A, B>(f: (a: A) => B) => (s: ReadonlySet<A>): ReadonlySet<B> => {
	const result = new globalThis.Set<B>();
	for (const item of s) {
		result.add(f(item));
	}
	return result;
};

const filter = <A>(predicate: (a: A) => boolean) => (s: ReadonlySet<A>): ReadonlySet<A> => {
	const result = new globalThis.Set<A>();
	for (const item of s) {
		if (predicate(item)) {
			result.add(item);
		}
	}
	return result;
};

const filterMap = <A, B>(f: (a: A) => Maybe<B>) => (s: ReadonlySet<A>): ReadonlySet<B> => {
	const result = new globalThis.Set<B>();
	for (const item of s) {
		const mb = f(item);
		if (mb.kind === "Some") {
			result.add(mb.value);
		}
	}
	return result;
};

const union = <A>(other: ReadonlySet<A>) => (s: ReadonlySet<A>): ReadonlySet<A> => {
	const set = s as Set<A>;
	if (typeof set.union === "function") {
		return set.union(other as Set<A>);
	}
	const result = new globalThis.Set(s);
	for (const item of other) {
		result.add(item);
	}
	return result;
};

const intersection = <A>(other: ReadonlySet<A>) => (s: ReadonlySet<A>): ReadonlySet<A> => {
	const set = s as Set<A>;
	if (typeof set.intersection === "function") {
		return set.intersection(other as Set<A>);
	}
	const result = new globalThis.Set<A>();
	for (const item of s) {
		if (other.has(item)) {
			result.add(item);
		}
	}
	return result;
};

const difference = <A>(other: ReadonlySet<A>) => (s: ReadonlySet<A>): ReadonlySet<A> => {
	const set = s as Set<A>;
	if (typeof set.difference === "function") {
		return set.difference(other as Set<A>);
	}
	const result = new globalThis.Set<A>();
	for (const item of s) {
		if (!other.has(item)) {
			result.add(item);
		}
	}
	return result;
};

const isSubsetOf = <A>(other: ReadonlySet<A>) => (s: ReadonlySet<A>): boolean => {
	const set = s as Set<A>;
	if (typeof set.isSubsetOf === "function") {
		return set.isSubsetOf(other as Set<A>);
	}
	for (const item of s) {
		if (!other.has(item)) {
			return false;
		}
	}
	return true;
};

const reduce = <A, B>(init: B, f: (acc: B, a: A) => B) => (s: ReadonlySet<A>): B => {
	let acc = init;
	for (const item of s) {
		acc = f(acc, item);
	}
	return acc;
};

const toArray = <A>(s: ReadonlySet<A>): readonly A[] => [...s];

// --- NonEmpty helpers ---
const UniqNonEmptyConst = {
	singleton: <A>(item: A): NonEmptySet<A> => new globalThis.Set([item]) as unknown as NonEmptySet<A>,
	from: {
		Set: <A>(s: ReadonlySet<A>): Maybe<NonEmptySet<A>> =>
			s.size > 0 ? Maybe.make.some(s as NonEmptySet<A>) : Maybe.make.none(),
	},
	reduce: <A>(f: (acc: A, a: A) => A) => (s: NonEmptySet<A>): A => (toArray(s) as readonly A[]).reduce(f),
	map: <A, B>(f: (a: A) => B) => (s: NonEmptySet<A>): NonEmptySet<B> => map(f)(s) as unknown as NonEmptySet<B>,
	to: { Array: <A>(s: NonEmptySet<A>): NonEmptyArr<A> => toArray(s) as unknown as NonEmptyArr<A> },
};

// =============================================================================
// Public Export
// =============================================================================
export const Uniq = {
	is: { empty: isEmpty, nonEmpty: isNonEmpty },
	empty,
	singleton,
	from: { Array: fromArray },
	has,
	size,
	add,
	insert: add,
	remove,
	toggle,
	map,
	filter,
	filterMap,
	union,
	intersection,
	difference,
	isSubsetOf,
	reduce,
	to: { Array: toArray },
	NonEmpty: UniqNonEmptyConst,
};

export namespace Uniq {
	/**
	 * A branded type representing a unique collection with at least one element.
	 */
	export type NonEmpty<A> = NonEmptySet<A>;
}
