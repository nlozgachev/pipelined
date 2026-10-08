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

const isEmpty = <A>(set: ReadonlySet<A>): boolean => set.size === 0;
const isNonEmpty = <A>(set: ReadonlySet<A>): set is NonEmptySet<A> => set.size > 0;

const empty = <A>(): ReadonlySet<A> => new globalThis.Set<A>();

const singleton = <A>(item: A): ReadonlySet<A> => new globalThis.Set([item]);

const fromArray = <A>(items: readonly A[]): ReadonlySet<A> => new globalThis.Set(items);

/**
 * Returns `true` when the set contains the given element.
 *
 * @see {@link add} for inserting an element into a set.
 * @see {@link remove} for deleting an element from a set.
 */
const has = <A>(item: A) => (set: ReadonlySet<A>): boolean => set.has(item);

const size = <A>(set: ReadonlySet<A>): number => set.size;

/**
 * Returns a new set with the element added.
 *
 * @see {@link remove} for deleting an element from a set.
 * @see {@link toggle} for toggling presence of an element.
 */
const add = <A>(item: A) => (set: ReadonlySet<A>): ReadonlySet<A> => {
	if (set.has(item)) {
		return set;
	}
	const result = new globalThis.Set(set);
	result.add(item);
	return result;
};

/**
 * Returns a new set with the element removed.
 *
 * @see {@link add} for adding an element to a set.
 */
const remove = <A>(item: A) => (set: ReadonlySet<A>): ReadonlySet<A> => {
	if (!set.has(item)) {
		return set;
	}
	const result = new globalThis.Set(set);
	result.delete(item);
	return result;
};

/**
 * Toggles presence of an element in a set.
 *
 * @see {@link add} for unconditionally adding an element.
 * @see {@link remove} for unconditionally removing an element.
 */
const toggle = <A>(item: A) => (set: ReadonlySet<A>): ReadonlySet<A> => {
	const result = new globalThis.Set(set);
	if (result.has(item)) {
		result.delete(item);
	} else {
		result.add(item);
	}
	return result;
};

/**
 * Transforms each element of a set into a new set.
 *
 * @see {@link filterMap} for mapping and filtering in a single step.
 */
const map = <A, B>(transform: (item: A) => B) => (set: ReadonlySet<A>): ReadonlySet<B> => {
	const result = new globalThis.Set<B>();
	for (const item of set) {
		result.add(transform(item));
	}
	return result;
};

/**
 * Filters elements of a set by a predicate.
 *
 * @see {@link filterMap} for filtering and mapping simultaneously.
 */
const filter = <A>(predicate: (item: A) => boolean) => (set: ReadonlySet<A>): ReadonlySet<A> => {
	const result = new globalThis.Set<A>();
	for (const item of set) {
		if (predicate(item)) {
			result.add(item);
		}
	}
	return result;
};

/**
 * Transforms elements with a function returning `Maybe`, keeping only `Some` values.
 *
 * @see {@link filter} for filtering with a boolean predicate.
 * @see {@link map} for transforming without filtering.
 */
const filterMap = <A, B>(transform: (item: A) => Maybe<B>) => (set: ReadonlySet<A>): ReadonlySet<B> => {
	const result = new globalThis.Set<B>();
	for (const item of set) {
		const mb = transform(item);
		if (mb.kind === "Some") {
			result.add(mb.value);
		}
	}
	return result;
};

/**
 * Computes the union of two sets.
 *
 * @see {@link intersection} for keeping only elements present in both sets.
 * @see {@link difference} for subtracting elements.
 */
const union = <A>(other: ReadonlySet<A>) => (set: ReadonlySet<A>): ReadonlySet<A> => {
	const s = set as Set<A>;
	if (typeof s.union === "function") {
		return s.union(other as Set<A>);
	}
	const result = new globalThis.Set(set);
	for (const item of other) {
		result.add(item);
	}
	return result;
};

/**
 * Computes the intersection of two sets.
 *
 * @see {@link union} for combining elements from both sets.
 * @see {@link difference} for subtracting elements.
 */
const intersection = <A>(other: ReadonlySet<A>) => (set: ReadonlySet<A>): ReadonlySet<A> => {
	const s = set as Set<A>;
	if (typeof s.intersection === "function") {
		return s.intersection(other as Set<A>);
	}
	const result = new globalThis.Set<A>();
	for (const item of set) {
		if (other.has(item)) {
			result.add(item);
		}
	}
	return result;
};

/**
 * Computes the set difference (`set \ other`).
 *
 * @see {@link union} for combining all elements.
 * @see {@link intersection} for keeping only common elements.
 */
const difference = <A>(other: ReadonlySet<A>) => (set: ReadonlySet<A>): ReadonlySet<A> => {
	const s = set as Set<A>;
	if (typeof s.difference === "function") {
		return s.difference(other as Set<A>);
	}
	const result = new globalThis.Set<A>();
	for (const item of set) {
		if (!other.has(item)) {
			result.add(item);
		}
	}
	return result;
};

const isSubsetOf = <A>(other: ReadonlySet<A>) => (set: ReadonlySet<A>): boolean => {
	const s = set as Set<A>;
	if (typeof s.isSubsetOf === "function") {
		return s.isSubsetOf(other as Set<A>);
	}
	for (const item of set) {
		if (!other.has(item)) {
			return false;
		}
	}
	return true;
};

const reduce = <A, B>(initial: B, reducer: (accumulator: B, item: A) => B) => (set: ReadonlySet<A>): B => {
	let acc = initial;
	for (const item of set) {
		acc = reducer(acc, item);
	}
	return acc;
};

const toArray = <A>(set: ReadonlySet<A>): readonly A[] => [...set];

// --- NonEmpty helpers ---
const UniqNonEmptyConst = {
	singleton: <A>(item: A): NonEmptySet<A> => new globalThis.Set([item]) as unknown as NonEmptySet<A>,
	from: {
		set: <A>(set: ReadonlySet<A>): Maybe<NonEmptySet<A>> =>
			set.size > 0 ? Maybe.make.some(set as NonEmptySet<A>) : Maybe.make.none(),
	},
	reduce: <A>(reducer: (accumulator: A, item: A) => A) => (set: NonEmptySet<A>): A =>
		(toArray(set) as readonly A[]).reduce(reducer),
	map: <A, B>(transform: (item: A) => B) => (set: NonEmptySet<A>): NonEmptySet<B> =>
		map(transform)(set) as unknown as NonEmptySet<B>,
	to: { array: <A>(set: NonEmptySet<A>): NonEmptyArr<A> => toArray(set) as unknown as NonEmptyArr<A> },
};

// =============================================================================
// Public Export
// =============================================================================
export const Uniq = {
	is: { empty: isEmpty, nonEmpty: isNonEmpty, subsetOf: isSubsetOf },
	empty,
	singleton,
	from: { array: fromArray },
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
	reduce,
	to: { array: toArray },
	NonEmpty: UniqNonEmptyConst,
};

export namespace Uniq {
	/**
	 * A branded type representing a unique collection with at least one element.
	 */
	export type NonEmpty<A> = NonEmptySet<A>;
}
