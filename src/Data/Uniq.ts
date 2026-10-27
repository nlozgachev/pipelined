// =============================================================================
// Imports
// =============================================================================
import { type NonEmpty as InternalNonEmpty, type NonEmptyArr } from "#internal";
import { Maybe } from "../Core/Maybe.ts";
import type { Brand } from "../Types/Brand.ts";

// =============================================================================
// Types
// =============================================================================
/**
 * A branded type representing a unique collection with at least one element.
 */
type NonEmptySet<A> = Brand<InternalNonEmpty<"Uniq">, ReadonlySet<A>>;

// =============================================================================
// Private Helpers & Combinator Implementations
// =============================================================================

/**
 * Returns `true` when the set contains zero elements.
 *
 * @see {@link isNonEmpty} to check if a set has elements.
 *
 * @example
 * ```ts
 * Uniq.is.empty(Uniq.empty()); // true
 * Uniq.is.empty(Uniq.singleton(1)); // false
 * ```
 */
const isEmpty = <A>(set: ReadonlySet<A>): boolean => set.size === 0;

/**
 * Type guard — checks if a set contains at least one element.
 *
 * @see {@link isEmpty} to check if a set is empty.
 *
 * @example
 * ```ts
 * Uniq.is.nonEmpty(Uniq.singleton(1)); // true
 * Uniq.is.nonEmpty(Uniq.empty());      // false
 * ```
 */
const isNonEmpty = <A>(set: ReadonlySet<A>): set is NonEmptySet<A> => set.size > 0;

/**
 * Creates an empty unique set.
 *
 * @see {@link singleton} to create a set with one element.
 *
 * @example
 * ```ts
 * const set = Uniq.empty<number>(); // Set(0) {}
 * ```
 */
const empty = <A>(): ReadonlySet<A> => new globalThis.Set<A>();

/**
 * Creates a unique set with a single element.
 *
 * @see {@link empty} to create an empty set.
 *
 * @example
 * ```ts
 * Uniq.singleton(42); // Set(1) { 42 }
 * ```
 */
const singleton = <A>(item: A): ReadonlySet<A> => new globalThis.Set([item]);

/**
 * Creates a unique set from an array of elements.
 *
 * @example
 * ```ts
 * Uniq.from.array([1, 2, 2, 3]); // Set(3) { 1, 2, 3 }
 * ```
 */
const fromArray = <A>(items: readonly A[]): ReadonlySet<A> => new globalThis.Set(items);

/**
 * Returns `true` when the set contains the given element.
 *
 * @see {@link insert} for inserting an element into a set.
 * @see {@link remove} for deleting an element from a set.
 */
const has = <A>(item: A) => (set: ReadonlySet<A>): boolean => set.has(item);

/**
 * Returns the number of elements in the set.
 *
 * @example
 * ```ts
 * Uniq.size(Uniq.from.array([1, 2, 3])); // 3
 * ```
 */
const size = <A>(set: ReadonlySet<A>): number => set.size;

/**
 * Returns a new set with the element added.
 *
 * @see {@link remove} for deleting an element from a set.
 * @see {@link toggle} for toggling presence of an element.
 */
const insert = <A>(item: A) => (set: ReadonlySet<A>): ReadonlySet<A> => {
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
 * @see {@link insert} for adding an element to a set.
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
 * @see {@link insert} for unconditionally adding an element.
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

/**
 * Returns `true` if `set` is a subset of `other`.
 *
 * @example
 * ```ts
 * pipe(Uniq.from.array([1, 2]), Uniq.is.subsetOf(Uniq.from.array([1, 2, 3]))); // true
 * ```
 */
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

/**
 * Reduces elements of a set from an initial value.
 *
 * @example
 * ```ts
 * pipe(Uniq.from.array([1, 2, 3]), Uniq.reduce(0, (acc, n) => acc + n)); // 6
 * ```
 */
const reduce = <A, B>(initial: B, reducer: (accumulator: B, item: A) => B) => (set: ReadonlySet<A>): B => {
	let acc = initial;
	for (const item of set) {
		acc = reducer(acc, item);
	}
	return acc;
};

/**
 * Converts a unique set to a readonly array.
 *
 * @example
 * ```ts
 * Uniq.to.array(Uniq.from.array([1, 2, 3])); // [1, 2, 3]
 * ```
 */
const toArray = <A>(set: ReadonlySet<A>): readonly A[] => [...set];

// --- NonEmpty helpers ---
const UniqNonEmptyConst = {
	/**
	 * Creates a NonEmptySet containing a single element.
	 *
	 * @example
	 * ```ts
	 * Uniq.NonEmpty.singleton(42); // NonEmptySet(1) { 42 }
	 * ```
	 */
	singleton: <A>(item: A): NonEmptySet<A> => new globalThis.Set([item]) as unknown as NonEmptySet<A>,

	from: {
		/**
		 * Refines a standard Set to a NonEmptySet, returning `Some` if size > 0, `None` otherwise.
		 *
		 * @example
		 * ```ts
		 * Uniq.NonEmpty.from.set(new Set([1, 2])); // Some(NonEmptySet)
		 * Uniq.NonEmpty.from.set(new Set());        // None
		 * ```
		 */
		set: <A>(set: ReadonlySet<A>): Maybe<NonEmptySet<A>> =>
			set.size > 0 ? Maybe.make.some(set as NonEmptySet<A>) : Maybe.make.none(),
	},

	/**
	 * Reduces a non-empty set using the first element as the initial accumulator.
	 *
	 * @example
	 * ```ts
	 * pipe(Uniq.NonEmpty.singleton(5), Uniq.NonEmpty.reduce((a, b) => a + b)); // 5
	 * ```
	 */
	reduce: <A>(reducer: (accumulator: A, item: A) => A) => (set: NonEmptySet<A>): A => {
		let acc: A | undefined;
		let isFirst = true;
		for (const item of set) {
			if (isFirst) {
				acc = item;
				isFirst = false;
			} else {
				acc = reducer(acc as A, item);
			}
		}
		return acc as A;
	},

	/**
	 * Transforms each element of a non-empty set, preserving non-emptiness.
	 *
	 * @example
	 * ```ts
	 * pipe(Uniq.NonEmpty.singleton(5), Uniq.NonEmpty.map(n => n * 2)); // NonEmptySet { 10 }
	 * ```
	 */
	map: <A, B>(transform: (item: A) => B) => (set: NonEmptySet<A>): NonEmptySet<B> =>
		map(transform)(set) as unknown as NonEmptySet<B>,

	to: {
		/**
		 * Converts a NonEmptySet to a NonEmptyArr.
		 *
		 * @example
		 * ```ts
		 * Uniq.NonEmpty.to.array(Uniq.NonEmpty.singleton(42)); // [42]
		 * ```
		 */
		array: <A>(set: NonEmptySet<A>): NonEmptyArr<A> => toArray(set) as unknown as NonEmptyArr<A>,
	},
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
	insert,
	remove,
	toggle,
	map,
	filter,
	filterMap,
	union,
	intersection,
	difference,
	reduce,
	/**
	 * Converters from unique collections to other data structures.
	 */
	to: { array: toArray },
	/**
	 * Utilities for working with guaranteed non-empty sets (`NonEmptySet`).
	 */
	NonEmpty: UniqNonEmptyConst,
};

export namespace Uniq {
	/**
	 * A branded type representing a unique collection with at least one element.
	 */
	export type NonEmpty<A> = NonEmptySet<A>;
}
