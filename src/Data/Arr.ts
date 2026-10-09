// =============================================================================
// Imports
// =============================================================================
import { Equality, Ordering } from "#core";
import { isNonEmptyArr, type NonEmptyArr } from "#internal";
import { Maybe as CoreMaybe } from "../Core/Maybe.ts";
import { Result as CoreResult } from "../Core/Result.ts";
import { Task as CoreTask } from "../Core/Task.ts";
import { Validation as CoreValidation } from "../Core/Validation.ts";

// =============================================================================
// Private Helpers & Traverse/Sequence Implementations
// =============================================================================
namespace ArrMaybe {
	/**
	 * Maps each element to a Maybe and collects the results.
	 * Returns None if any mapping returns None.
	 *
	 * @see {@link sequence} for collecting an existing array of Maybe values.
	 *
	 * @example
	 * ```ts
	 * const parseNum = (s: string): Maybe<number> => {
	 *   const n = Number(s);
	 *   return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	 * };
	 *
	 * pipe(["1", "2", "3"], Arr.traverse.Maybe(parseNum)); // Some([1, 2, 3])
	 * pipe(["1", "x", "3"], Arr.traverse.Maybe(parseNum)); // None
	 * ```
	 */
	export const traverse =
		<A, B>(transform: (item: A) => CoreMaybe<B>) => (items: readonly A[]): CoreMaybe<readonly B[]> => {
			const n = items.length;
			const result = new Array<B>(n);
			for (let i = 0; i < n; i++) {
				const mapped = transform(items[i]);
				if (mapped.kind === "None") { return CoreMaybe.make.none(); }
				result[i] = mapped.value;
			}
			return CoreMaybe.make.some(result);
		};

	/**
	 * Collects an array of Maybe instances into a Maybe of array.
	 * Returns None if any element is None.
	 *
	 * @see {@link traverse} for mapping elements to Maybe instances and collecting them.
	 *
	 * @example
	 * ```ts
	 * Arr.sequence.Maybe([Maybe.make.some(1), Maybe.make.some(2)]); // Some([1, 2])
	 * Arr.sequence.Maybe([Maybe.make.some(1), Maybe.make.none()]); // None
	 * ```
	 */
	export const sequence = <A>(items: readonly CoreMaybe<A>[]): CoreMaybe<readonly A[]> =>
		traverse<CoreMaybe<A>, A>((item) => item)(items);
}

namespace ArrResult {
	/**
	 * Maps each element to a Result and collects the results.
	 * Returns the first Err if any mapping fails.
	 *
	 * @see {@link sequence} for collecting an existing array of Result values.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   [1, 2, 3],
	 *   Arr.traverse.Result((n: number) => n > 0 ? Result.make.ok(n) : Result.make.err("negative"))
	 * ); // Ok([1, 2, 3])
	 * ```
	 */
	export const traverse =
		<E, A, B>(transform: (item: A) => CoreResult<E, B>) => (items: readonly A[]): CoreResult<E, readonly B[]> => {
			const n = items.length;
			const result = new Array<B>(n);
			for (let i = 0; i < n; i++) {
				const mapped = transform(items[i]);
				if (mapped.kind === "Err") { return mapped; }
				result[i] = mapped.value;
			}
			return CoreResult.make.ok(result);
		};

	/**
	 * Collects an array of Results into a Result of array.
	 * Returns the first Err if any element is Err.
	 *
	 * @see {@link traverse} for mapping elements to Result instances and collecting them.
	 *
	 * @example
	 * ```ts
	 * Arr.sequence.Result([Result.make.ok(1), Result.make.ok(2)]); // Ok([1, 2])
	 * Arr.sequence.Result([Result.make.ok(1), Result.make.err("bad")]); // Err("bad")
	 * ```
	 */
	export const sequence = <E, A>(items: readonly CoreResult<E, A>[]): CoreResult<E, readonly A[]> =>
		traverse<E, CoreResult<E, A>, A>((item) => item)(items);
}

namespace ArrValidation {
	/**
	 * Maps each element to a Validation and collects the results into Passed of array,
	 * or accumulates all errors from all Failed items into Failed.
	 *
	 * @see {@link sequence} for collecting an existing array of Validation values.
	 *
	 * @example
	 * ```ts
	 * const checkPositive = (n: number) =>
	 *   n > 0 ? Validation.make.passed(n) : Validation.make.failed(`Non-positive: ${n}`);
	 *
	 * pipe([1, 2, 3], Arr.traverse.Validation(checkPositive)); // Passed([1, 2, 3])
	 * pipe([1, -2, -3], Arr.traverse.Validation(checkPositive)); // Failed(["Non-positive: -2", "Non-positive: -3"])
	 * ```
	 */
	export const traverse =
		<E, A, B>(transform: (item: A) => CoreValidation<E, B>) => (items: readonly A[]): CoreValidation<E, readonly B[]> => {
			const n = items.length;
			const result = new Array<B>(n);
			const errors: E[] = [];
			for (let i = 0; i < n; i++) {
				const mapped = transform(items[i]);
				if (CoreValidation.is.failed(mapped)) {
					errors.push(...mapped.errors);
				} else if (errors.length === 0) {
					result[i] = mapped.value;
				}
			}
			return isNonEmptyArr(errors) ? CoreValidation.make.failedAll(errors) : CoreValidation.make.passed(result);
		};

	/**
	 * Collects an array of Validation instances into a Validation of array.
	 * Accumulates all errors from all Failed items into Failed.
	 *
	 * @see {@link traverse} for mapping elements to Validation instances and collecting them.
	 *
	 * @example
	 * ```ts
	 * Arr.sequence.Validation([Validation.make.passed(1), Validation.make.passed(2)]); // Passed([1, 2])
	 * Arr.sequence.Validation([Validation.make.failed("err1"), Validation.make.failed("err2")]); // Failed(["err1", "err2"])
	 * ```
	 */
	export const sequence = <E, A>(items: readonly CoreValidation<E, A>[]): CoreValidation<E, readonly A[]> =>
		traverse<E, CoreValidation<E, A>, A>((item) => item)(items);
}

namespace ArrTask {
	/**
	 * Maps each element to a Task and collects their results into an array.
	 * An optional `concurrency` option limits how many Tasks run concurrently.
	 *
	 * @see {@link sequence} for collecting an existing array of Task instances.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   [1, 2, 3],
	 *   Arr.traverse.Task((n: number) => Task.make(n * 2))
	 * )(); // Promise<[2, 4, 6]>
	 * ```
	 */
	export const traverse =
		<A, B>(transform: (item: A) => CoreTask<B>, options?: { concurrency?: number; }) =>
		(items: readonly A[]): CoreTask<readonly B[]> => CoreTask.all(items.map(transform), options);

	/**
	 * Collects an array of Tasks into a Task of array. Runs in parallel.
	 *
	 * @see {@link traverse} for mapping elements to Task instances and collecting them.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   [Task.make(1), Task.make(2)],
	 *   Arr.sequence.Task
	 * )(); // Deferred<[1, 2]>
	 * ```
	 */
	export const sequence = <A>(items: readonly CoreTask<A>[]): CoreTask<readonly A[]> =>
		traverse<CoreTask<A>, A>((item) => item)(items);
}

/**
 * Functional array utilities that compose well with pipe.
 * All functions are data-last and curried where applicable.
 * Safe access functions return Maybe instead of throwing or returning undefined.
 *
 * @example
 * ```ts
 * pipe(
 *   [1, 2, 3, 4, 5],
 *   Arr.filter(n => n > 2),
 *   Arr.map(n => n * 10),
 *   Arr.head
 * ); // Some(30)
 * ```
 */
// --- Arr Module ---

/**
 * A type alias representing an array that is guaranteed to contain at least one element.
 * Under the hood, this is a read-only tuple structure: `readonly [A, ...A[]]`.
 *
 * @example
 * ```ts
 * const list: Arr.NonEmpty<number> = [1, 2, 3];
 * ```
 */

// --- Safe access ---

/**
 * Returns the first element of an array, or None if the array is empty.
 *
 * @see {@link last} for accessing the final element.
 * @see {@link tail} for all elements except the first.
 *
 * @example
 * ```ts
 * Arr.head([1, 2, 3]); // Some(1)
 * Arr.head([]); // None
 * ```
 */
const head = <A>(items: readonly A[]): CoreMaybe<A> =>
	items.length > 0 ? CoreMaybe.make.some(items[0]) : CoreMaybe.make.none();

/**
 * Returns the last element of an array, or None if the array is empty.
 *
 * @see {@link head} for accessing the first element.
 * @see {@link init} for all elements except the last.
 *
 * @example
 * ```ts
 * Arr.last([1, 2, 3]); // Some(3)
 * Arr.last([]); // None
 * ```
 */
const last = <A>(items: readonly A[]): CoreMaybe<A> =>
	items.length > 0 ? CoreMaybe.make.some(items[items.length - 1]) : CoreMaybe.make.none();

/**
 * Returns all elements except the first, or None if the array is empty.
 *
 * @see {@link head} for accessing the first element.
 *
 * @example
 * ```ts
 * Arr.tail([1, 2, 3]); // Some([2, 3])
 * Arr.tail([]); // None
 * ```
 */
const tail = <A>(items: readonly A[]): CoreMaybe<readonly A[]> =>
	items.length > 0 ? CoreMaybe.make.some(items.slice(1)) : CoreMaybe.make.none();

/**
 * Returns all elements except the last, or None if the array is empty.
 *
 * @see {@link last} for accessing the final element.
 *
 * @example
 * ```ts
 * Arr.init([1, 2, 3]); // Some([1, 2])
 * Arr.init([]); // None
 * ```
 */
const init = <A>(items: readonly A[]): CoreMaybe<readonly A[]> =>
	items.length > 0 ? CoreMaybe.make.some(items.slice(0, -1)) : CoreMaybe.make.none();

// --- Search ---

/**
 * Returns the first element matching the predicate, or None.
 *
 * @see {@link findLast} for finding the last matching element.
 * @see {@link findIndex} for obtaining the index of the first matching element.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.findFirst(n => n > 2)); // Some(3)
 * ```
 */
const findFirst = <A>(predicate: (item: A) => boolean) => (items: readonly A[]): CoreMaybe<A> => {
	const idx = items.findIndex(predicate);
	return idx !== -1 ? CoreMaybe.make.some(items[idx]) : CoreMaybe.make.none();
};

/**
 * Returns the last element matching the predicate, or None.
 *
 * @see {@link findFirst} for finding the first matching element.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.findLast(n => n > 2)); // Some(4)
 * ```
 */
const findLast = <A>(predicate: (item: A) => boolean) => (items: readonly A[]): CoreMaybe<A> => {
	for (let i = items.length - 1; i >= 0; i--) {
		if (predicate(items[i])) { return CoreMaybe.make.some(items[i]); }
	}
	return CoreMaybe.make.none();
};

/**
 * Returns the index of the first element matching the predicate, or None.
 *
 * @see {@link findFirst} for finding the matching element value.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.findIndex(n => n > 2)); // Some(2)
 * ```
 */
const findIndex = <A>(predicate: (item: A) => boolean) => (items: readonly A[]): CoreMaybe<number> => {
	const idx = items.findIndex(predicate);
	return idx !== -1 ? CoreMaybe.make.some(idx) : CoreMaybe.make.none();
};

// --- Transform ---

/**
 * Transforms each element of an array.
 *
 * @see {@link flatMap} for mapping and flattening arrays.
 * @see {@link mapWithIndex} for mapping with element indices.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.map(n => n * 2)); // [2, 4, 6]
 * ```
 */
const map = <A, B>(transform: (item: A) => B) => (items: readonly A[]): readonly B[] => {
	const n = items.length;
	const result = new Array<B>(n);
	for (let i = 0; i < n; i++) { result[i] = transform(items[i]); }
	return result;
};

/**
 * Transforms each element using both its value and its zero-based index.
 *
 * @see {@link map} for mapping without indices.
 *
 * @example
 * ```ts
 * pipe(
 *   ["a", "b", "c"],
 *   Arr.mapWithIndex((i, s) => ({ position: i + 1, value: s }))
 * ); // [{ position: 1, value: "a" }, { position: 2, value: "b" }, { position: 3, value: "c" }]
 * ```
 */
const mapWithIndex = <A, B>(transform: (index: number, item: A) => B) => (items: readonly A[]): readonly B[] => {
	const n = items.length;
	const result = new Array<B>(n);
	for (let i = 0; i < n; i++) { result[i] = transform(i, items[i]); }
	return result;
};

/**
 * Filters elements that satisfy the predicate.
 *
 * @see {@link filterMap} for filtering and mapping simultaneously.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.filter(n => n % 2 === 0)); // [2, 4]
 * ```
 */
const filter = <A>(predicate: (item: A) => boolean) => (items: readonly A[]): readonly A[] => {
	const n = items.length;
	const result: A[] = [];
	for (let i = 0; i < n; i++) {
		if (predicate(items[i])) { result.push(items[i]); }
	}
	return result;
};

/**
 * Maps each element to a Maybe and collects only the Some values.
 * Combines map and filter in a single pass.
 *
 * @see {@link filter} for filtering with a boolean predicate.
 *
 * @example
 * ```ts
 * const parseNum = (s: string): Maybe<number> => {
 *   const n = Number(s);
 *   return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
 * };
 *
 * pipe(["1", "abc", "3"], Arr.filterMap(parseNum)); // [1, 3]
 * ```
 */
const filterMap = <A, B>(transform: (item: A) => CoreMaybe<B>) => (items: readonly A[]): readonly B[] => {
	const result: B[] = [];
	for (let i = 0; i < items.length; i++) {
		const mapped = transform(items[i]);
		if (mapped.kind === "Some") { result.push(mapped.value); }
	}
	return result;
};

/**
 * Splits an array into two groups based on a predicate.
 * First group contains elements that satisfy the predicate,
 * second group contains the rest.
 *
 * @see {@link partitionMap} for partitioning with a Result function.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.partition(n => n % 2 === 0)); // [[2, 4], [1, 3]]
 * ```
 */
const partition =
	<A>(predicate: (item: A) => boolean) => (items: readonly A[]): readonly [readonly A[], readonly A[]] => {
		const pass: A[] = [];
		const fail: A[] = [];
		for (const item of items) {
			(predicate(item) ? pass : fail).push(item);
		}
		return [pass, fail];
	};

/**
 * Narrows a list of Maybe values down to a list of their underlying values,
 * discarding all None instances.
 *
 * @see {@link separate} for dividing Results into error and success arrays.
 *
 * @example
 * ```ts
 * Arr.compact([Maybe.make.some(1), Maybe.make.none(), Maybe.make.some(3)]); // [1, 3]
 * ```
 */
const compact = <A>(items: readonly CoreMaybe<A>[]): readonly A[] => {
	const result: A[] = [];
	for (const item of items) {
		if (item.kind === "Some") {
			result.push(item.value);
		}
	}
	return result;
};

/**
 * Separates an array of Result values into two separate lists of errors and successes.
 * Returns a tuple containing `[errors, successes]`.
 *
 * @see {@link compact} for extracting Some values from Maybe instances.
 *
 * @example
 * ```ts
 * Arr.separate([Result.make.ok(1), Result.make.err("bad"), Result.make.ok(3)]); // [["bad"], [1, 3]]
 * ```
 */
const separate = <E, A>(items: readonly CoreResult<E, A>[]): readonly [readonly E[], readonly A[]] => {
	const errors: E[] = [];
	const successes: A[] = [];
	for (const item of items) {
		if (item.kind === "Ok") {
			successes.push(item.value);
		} else {
			errors.push(item.error);
		}
	}
	return [errors, successes];
};

/**
 * Maps each element to a Result, and separates the results into a tuple of failures and successes.
 *
 * @see {@link partition} for partitioning with a boolean predicate.
 * @see {@link partitionMaybe} for partitioning with a Maybe function.
 *
 * @example
 * ```ts
 * pipe(
 *   [1, 2, 3, 4],
 *   Arr.partitionMap(n => n % 2 === 0 ? Result.make.ok(n) : Result.make.err(`odd: ${n}`))
 * ); // [["odd: 1", "odd: 3"], [2, 4]]
 * ```
 */
const partitionMap =
	<A, E, B>(transform: (item: A) => CoreResult<E, B>) => (
		items: readonly A[],
	): readonly [readonly E[], readonly B[]] => {
		const errors: E[] = [];
		const successes: B[] = [];
		for (const item of items) {
			const mapped = transform(item);
			if (mapped.kind === "Ok") {
				successes.push(mapped.value);
			} else {
				errors.push(mapped.error);
			}
		}
		return [errors, successes];
	};

/**
 * Groups elements by a key function.
 *
 * @see {@link indexBy} for indexing elements into a Map.
 *
 * @example
 * ```ts
 * pipe(
 *   ["apple", "avocado", "banana"],
 *   Arr.groupBy(s => s[0])
 * ); // { a: ["apple", "avocado"], b: ["banana"] }
 * ```
 */
const groupBy = <A>(keySelector: (item: A) => string) => (items: readonly A[]): Record<string, NonEmptyArr<A>> => {
	const result: Record<string, A[]> = {};
	for (const item of items) {
		const key = keySelector(item);
		if (!result[key]) { result[key] = []; }
		result[key].push(item);
	}
	return result as unknown as Record<string, NonEmptyArr<A>>;
};

/**
 * Removes duplicate elements using strict equality.
 *
 * @see {@link uniqBy} for deduplicating by a key projection.
 * @see {@link uniqWith} for deduplicating with custom equality.
 *
 * @example
 * ```ts
 * Arr.uniq([1, 2, 2, 3, 1]); // [1, 2, 3]
 * ```
 */
const uniq = <A>(items: readonly A[]): readonly A[] => (items.length <= 1 ? items : [...new Set(items)]);

/**
 * Removes duplicate elements by comparing the result of a key function.
 *
 * @see {@link uniq} for reference-equality deduplication.
 * @see {@link uniqWith} for deduplicating with custom equality.
 *
 * @example
 * ```ts
 * pipe(
 *   [{id: 1, name: "a"}, {id: 1, name: "b"}, {id: 2, name: "c"}],
 *   Arr.uniqBy(x => x.id)
 * ); // [{id: 1, name: "a"}, {id: 2, name: "c"}]
 * ```
 */
const uniqBy = <A, B>(keySelector: (item: A) => B) => (items: readonly A[]): readonly A[] => {
	const seen = new Set<B>();
	const result: A[] = [];
	for (const item of items) {
		const key = keySelector(item);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(item);
		}
	}
	return result;
};

/**
 * Removes duplicate elements using a custom equality check.
 * Preserves the order of first occurrences. Complements `uniq` (reference equality)
 * and `uniqBy` (key extraction).
 *
 * @see {@link uniq} for reference-equality deduplication.
 * @see {@link uniqBy} for key-based deduplication.
 *
 * @example
 * ```ts
 * type Point = { x: number; y: number };
 * const eqPoint: Equality<Point> = (a, b) => a.x === b.x && a.y === b.y;
 *
 * pipe(
 *   [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 1 }],
 *   Arr.uniqWith(eqPoint),
 * ); // [{ x: 1, y: 1 }, { x: 2, y: 2 }]
 * ```
 */
const uniqWith = <A>(areEqual: Equality<A>) => (items: readonly A[]): readonly A[] => {
	const result: A[] = [];
	for (const item of items) {
		if (!result.some((existing) => areEqual(existing, item))) {
			result.push(item);
		}
	}
	return result;
};

/**
 * Sorts an array using a comparison function. Returns a new array.
 * To sort with a typed `Ordering<A>`, prefer `Arr.sortWith`.
 *
 * @see {@link sortWith} for sorting using typed Ordering instances.
 *
 * @example
 * ```ts
 * pipe([3, 1, 2], Arr.sortBy((a, b) => a - b)); // [1, 2, 3]
 * ```
 */
const sortBy = <A>(compare: (first: A, second: A) => number) => (items: readonly A[]): readonly A[] => {
	const arr = items as A[];
	if (typeof arr.toSorted === "function") { return arr.toSorted(compare); }
	return [...items].sort(compare);
};

/**
 * Sorts an array using an `Ordering<A>`. Returns a new array without mutating the original.
 * Use this over `sortBy` when you have a typed `Ordering<A>` from the `Ordering` module.
 *
 * @see {@link sortBy} for sorting using a comparator function.
 *
 * @example
 * ```ts
 * pipe([3, 1, 2], Arr.sortWith(Ordering.number)); // [1, 2, 3]
 *
 * type Product = { price: number };
 * const products: Product[] = [{ price: 20 }, { price: 10 }];
 * const byPrice = pipe(Ordering.number, Ordering.by((p: Product) => p.price));
 * pipe(products, Arr.sortWith(byPrice));
 * ```
 */
const sortWith = <A>(ordering: Ordering<A>) => (items: readonly A[]): readonly A[] => {
	const arr = items as A[];
	if (typeof arr.toSorted === "function") { return arr.toSorted(ordering); }
	return [...items].sort(ordering);
};

// --- Combine ---

/**
 * Pairs up elements from two arrays. Stops at the shorter array.
 *
 * @see {@link zipWith} for pairing elements with a custom combining function.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.zip(["a", "b"])); // [[1, "a"], [2, "b"]]
 * ```
 */
const zip = <B>(other: readonly B[]) => <A>(items: readonly A[]): readonly (readonly [A, B])[] => {
	const len = Math.min(items.length, other.length);
	const result = new Array<[A, B]>(len);
	for (let i = 0; i < len; i++) {
		result[i] = [items[i], other[i]];
	}
	return result;
};

/**
 * Combines elements from two arrays using a function. Stops at the shorter array.
 *
 * @see {@link zip} for pairing elements into 2-tuples.
 *
 * @example
 * ```ts
 * pipe([1, 2], Arr.zipWith((a: number, b: string) => `${a}${b}`)(["a", "b"])); // ["1a", "2b"]
 * ```
 */
const zipWith =
	<A, B, C>(combine: (first: A, second: B) => C) => (other: readonly B[]) => (items: readonly A[]): readonly C[] => {
		const len = Math.min(items.length, other.length);
		const result = new Array<C>(len);
		for (let i = 0; i < len; i++) {
			result[i] = combine(items[i], other[i]);
		}
		return result;
	};

/**
 * Inserts a separator between every element.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.intersperse(0)); // [1, 0, 2, 0, 3]
 * ```
 */
const intersperse = <A>(separator: A) => (items: readonly A[]): readonly A[] => {
	if (items.length <= 1) { return items; }
	const result: A[] = [items[0]];
	for (let i = 1; i < items.length; i++) {
		result.push(separator, items[i]);
	}
	return result;
};

/**
 * Concatenates a standard array with another array.
 *
 * @example
 * ```ts
 * pipe([1, 2], Arr.concat([3, 4])); // [1, 2, 3, 4]
 * ```
 */
const concat = <A>(other: readonly A[]) => (items: readonly A[]): readonly A[] => [...items, ...other];

/**
 * Splits an array into chunks of the given size.
 *
 * @see {@link chunkBy} for grouping consecutive elements sharing a key.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4, 5], Arr.chunksOf(2)); // [[1, 2], [3, 4], [5]]
 * ```
 */
const chunksOf = (size: number) => <A>(items: readonly A[]): readonly (readonly A[])[] => {
	if (size <= 0) { return []; }
	const result: A[][] = [];
	for (let i = 0; i < items.length; i += size) {
		result.push(items.slice(i, i + size));
	}
	return result;
};

/**
 * Flattens a nested array by one level.
 *
 * @see {@link flatMap} for mapping elements to arrays before flattening.
 *
 * @example
 * ```ts
 * Arr.flatten([[1, 2], [3], [4, 5]]); // [1, 2, 3, 4, 5]
 * ```
 */
const flatten = <A>(items: readonly (readonly A[])[]): readonly A[] => {
	let totalLen = 0;
	const outerLen = items.length;
	for (let i = 0; i < outerLen; i++) {
		totalLen += items[i].length;
	}
	const result = new Array<A>(totalLen);
	let idx = 0;
	for (let i = 0; i < outerLen; i++) {
		const chunk = items[i];
		const innerLen = chunk.length;
		for (let j = 0; j < innerLen; j++) {
			result[idx++] = chunk[j];
		}
	}
	return result;
};

/**
 * Maps each element to an array and flattens the result.
 *
 * @see {@link map} for mapping without flattening.
 * @see {@link flatten} for flattening without mapping.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.flatMap(n => [n, n * 10])); // [1, 10, 2, 20, 3, 30]
 * ```
 */
const flatMap = <A, B>(transform: (item: A) => readonly B[]) => (items: readonly A[]): readonly B[] => {
	const n = items.length;
	const result: B[] = [];
	for (let i = 0; i < n; i++) {
		const chunk = transform(items[i]);
		const m = chunk.length;
		for (let j = 0; j < m; j++) { result.push(chunk[j]); }
	}
	return result;
};

/**
 * Reduces an array from the left.
 *
 * @see {@link scan} for preserving intermediate accumulation states.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.reduce(0, (acc, n) => acc + n)); // 6
 * ```
 */
const reduce = <A, B>(initial: B, reducer: (accumulator: B, item: A) => B) => (items: readonly A[]): B =>
	items.reduce(reducer, initial);

/**
 * Prepends a value to the beginning of an array, returning a NonEmptyArr.
 *
 * @see {@link append} for adding an element to the end.
 *
 * @example
 * ```ts
 * pipe([1, 2], Arr.prepend(0)); // [0, 1, 2]
 * ```
 */
const prepend = <A>(item: A) => (items: readonly A[]): NonEmptyArr<A> => [item, ...items];

/**
 * Appends a value to the end of an array, returning a NonEmptyArr.
 *
 * @see {@link prepend} for adding an element to the beginning.
 *
 * @example
 * ```ts
 * pipe([1, 2], Arr.append(3)); // [1, 2, 3]
 * ```
 */
const append = <A>(item: A) => (items: readonly A[]): NonEmptyArr<A> => [...items, item] as unknown as NonEmptyArr<A>;

/**
 * Returns the length of an array.
 *
 * @example
 * ```ts
 * Arr.size([1, 2, 3]); // 3
 * ```
 */
const size = <A>(items: readonly A[]): number => items.length;

/**
 * Returns true if any element satisfies the predicate.
 *
 * @see {@link every} for checking whether all elements satisfy a predicate.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.some(n => n > 2)); // true
 * ```
 */
const some = <A>(predicate: (item: A) => boolean) => (items: readonly A[]): boolean => {
	const n = items.length;
	for (let i = 0; i < n; i++) { if (predicate(items[i])) { return true; } }
	return false;
};

/**
 * Returns true if all elements satisfy the predicate.
 *
 * @see {@link some} for checking whether any element satisfies a predicate.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.every(n => n > 0)); // true
 * ```
 */
const every = <A>(predicate: (item: A) => boolean) => (items: readonly A[]): boolean => {
	const n = items.length;
	for (let i = 0; i < n; i++) { if (!predicate(items[i])) { return false; } }
	return true;
};

/**
 * Reverses an array. Returns a new array.
 *
 * @example
 * ```ts
 * Arr.reverse([1, 2, 3]); // [3, 2, 1]
 * ```
 */
const reverse = <A>(items: readonly A[]): readonly A[] => [...items].toReversed();

/**
 * Returns a new array with `item` inserted before the element at `index`.
 * Negative indices are clamped to 0; indices beyond the array length append to the end.
 *
 * @see {@link removeAt} for removing an element at an index.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.insertAt(1, 99)); // [1, 99, 2, 3]
 * pipe([1, 2, 3], Arr.insertAt(0, 99)); // [99, 1, 2, 3]
 * pipe([1, 2, 3], Arr.insertAt(3, 99)); // [1, 2, 3, 99]
 * ```
 */
const insertAt = <A>(index: number, item: A) => (items: readonly A[]): readonly A[] => {
	const i = Math.max(0, Math.min(index, items.length));
	const arr = items as A[];
	if (typeof arr.toSpliced === "function") { return arr.toSpliced(i, 0, item); }
	const result = [...items];
	result.splice(i, 0, item);
	return result;
};

/**
 * Returns a new array with the element at `index` removed.
 * Returns the original array unchanged if `index` is out of bounds.
 *
 * @see {@link insertAt} for inserting an element at an index.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.removeAt(1)); // [1, 3]
 * pipe([1, 2, 3], Arr.removeAt(0)); // [2, 3]
 * pipe([1, 2, 3], Arr.removeAt(5)); // [1, 2, 3]
 * ```
 */
const removeAt = (index: number) => <A>(items: readonly A[]): readonly A[] => {
	if (index < 0 || index >= items.length) { return items; }
	const arr = items as A[];
	if (typeof arr.toSpliced === "function") { return arr.toSpliced(index, 1); }
	const result = [...items];
	result.splice(index, 1);
	return result;
};

/**
 * Takes the first n elements from an array.
 *
 * @see {@link drop} for discarding the first n elements.
 * @see {@link takeWhile} for taking elements based on a predicate.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.take(2)); // [1, 2]
 * ```
 */
const take = (count: number) => <A>(items: readonly A[]): readonly A[] => count <= 0 ? [] : items.slice(0, count);

/**
 * Drops the first n elements from an array.
 *
 * @see {@link take} for keeping the first n elements.
 * @see {@link dropWhile} for discarding elements based on a predicate.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.drop(2)); // [3, 4]
 * ```
 */
const drop = (count: number) => <A>(items: readonly A[]): readonly A[] => items.slice(count);

/**
 * Takes elements from the start while the predicate holds.
 *
 * @see {@link dropWhile} for discarding elements while a predicate holds.
 * @see {@link take} for taking a fixed count of elements.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 1], Arr.takeWhile(n => n < 3)); // [1, 2]
 * ```
 */
const takeWhile = <A>(predicate: (item: A) => boolean) => (items: readonly A[]): readonly A[] => {
	const result: A[] = [];
	for (const item of items) {
		if (!predicate(item)) { break; }
		result.push(item);
	}
	return result;
};

/**
 * Drops elements from the start while the predicate holds.
 *
 * @see {@link takeWhile} for keeping elements while a predicate holds.
 * @see {@link drop} for discarding a fixed count of elements.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 1], Arr.dropWhile(n => n < 3)); // [3, 1]
 * ```
 */
const dropWhile = <A>(predicate: (item: A) => boolean) => (items: readonly A[]): readonly A[] => {
	let i = 0;
	while (i < items.length && predicate(items[i])) { i++; }
	return items.slice(i);
};

/**
 * Like `reduce`, but returns every intermediate accumulator as an array.
 * The initial value is not included — the output has the same length as the input.
 *
 * @see {@link reduce} for computing only the final accumulator value.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.scan(0, (acc, n) => acc + n)); // [1, 3, 6]
 * ```
 */
const scan = <A, B>(initial: B, reducer: (accumulator: B, item: A) => B) => (items: readonly A[]): readonly B[] => {
	const n = items.length;
	const result = new Array<B>(n);
	let acc = initial;
	for (let i = 0; i < n; i++) {
		acc = reducer(acc, items[i]);
		result[i] = acc;
	}
	return result;
};

/**
 * Splits an array at an index into a `[before, after]` tuple.
 * Negative indices clamp to 0; indices beyond the array length clamp to the end.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.splitAt(2)); // [[1, 2], [3, 4]]
 * pipe([1, 2, 3], Arr.splitAt(0));    // [[], [1, 2, 3]]
 * pipe([1, 2, 3], Arr.splitAt(10));   // [[1, 2, 3], []]
 * ```
 */
const splitAt = (index: number) => <A>(items: readonly A[]): readonly [readonly A[], readonly A[]] => {
	const i = Math.max(0, index);
	return [items.slice(0, i), items.slice(i)];
};

/**
 * Partitions an array by applying a function returning `Maybe<B>`.
 * Elements returning `None` are gathered into `failures` (original `A` values);
 * elements returning `Some(b)` are gathered into `successes` (`B` values).
 *
 * @see {@link partitionMap} for partitioning with a Result mapper.
 * @see {@link partition} for partitioning with a boolean predicate.
 *
 * @example
 * ```ts
 * const parseNumber = (s: string) => isNaN(Number(s)) ? Maybe.make.none() : Maybe.make.some(Number(s));
 * pipe(["1", "abc", "3"], Arr.partitionMaybe(parseNumber)); // [["abc"], [1, 3]]
 * ```
 */
const partitionMaybe =
	<A, B>(transform: (item: A) => CoreMaybe<B>) =>
	(items: readonly A[]): readonly [failures: readonly A[], successes: readonly B[]] => {
		const failures: A[] = [];
		const successes: B[] = [];
		for (let i = 0; i < items.length; i++) {
			const res = transform(items[i]);
			if (res.kind === "Some") {
				successes.push(res.value);
			} else {
				failures.push(items[i]);
			}
		}
		return [failures, successes];
	};

/**
 * Safely looks up an element by index. Supports negative indices counting back from the end.
 * Returns `None` if the index is out of bounds.
 *
 * @example
 * ```ts
 * pipe([10, 20, 30], Arr.at(1));  // Some(20)
 * pipe([10, 20, 30], Arr.at(-1)); // Some(30)
 * pipe([10, 20, 30], Arr.at(5));  // None
 * ```
 */
const at = (index: number) => <A>(items: readonly A[]): CoreMaybe<A> => {
	const targetIndex = index < 0 ? items.length + index : index;
	if (targetIndex < 0 || targetIndex >= items.length) {
		return CoreMaybe.make.none();
	}
	return CoreMaybe.make.some(items[targetIndex]);
};

/**
 * Finds the first element in an array for which `transform` returns `Some(b)`.
 *
 * @see {@link findFirst} for finding elements with a boolean predicate.
 *
 * @example
 * ```ts
 * pipe(
 *   ["1", "a", "2"],
 *   Arr.findMap((s) => isNaN(Number(s)) ? Maybe.make.none() : Maybe.make.some(Number(s)))
 * ); // Some(1)
 * ```
 */
const findMap = <A, B>(transform: (item: A) => CoreMaybe<B>) => (items: readonly A[]): CoreMaybe<B> => {
	for (let i = 0; i < items.length; i++) {
		const res = transform(items[i]);
		if (res.kind === "Some") {
			return res;
		}
	}
	return CoreMaybe.make.none();
};

/**
 * Indexes elements of an array into a `ReadonlyMap<K, A>` using a key extraction function.
 *
 * @see {@link groupBy} for grouping multiple items per key into arrays.
 *
 * @example
 * ```ts
 * pipe(
 *   [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }],
 *   Arr.indexBy((u) => u.id)
 * ); // ReadonlyMap { 1 => { id: 1, name: "Alice" }, 2 => { id: 2, name: "Bob" } }
 * ```
 */
const indexBy = <A, K>(keySelector: (item: A) => K) => (items: readonly A[]): ReadonlyMap<K, A> => {
	const resultMap = new globalThis.Map<K, A>();
	for (let i = 0; i < items.length; i++) {
		resultMap.set(keySelector(items[i]), items[i]);
	}
	return resultMap;
};

/**
 * Counts occurrences of each element in an array, returning a `ReadonlyMap<A, number>`.
 *
 * @example
 * ```ts
 * Arr.frequencies(["a", "b", "a", "c", "b", "a"]);
 * // ReadonlyMap { "a" => 3, "b" => 2, "c" => 1 }
 * ```
 */
const frequencies = <A>(items: readonly A[]): ReadonlyMap<A, number> => {
	const resultMap = new globalThis.Map<A, number>();
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		resultMap.set(item, (resultMap.get(item) ?? 0) + 1);
	}
	return resultMap;
};

/**
 * Groups consecutive elements that share the same key returned by `keySelector`.
 *
 * @see {@link chunksOf} for fixed-size chunking.
 *
 * @example
 * ```ts
 * pipe(
 *   [1, 1, 2, 3, 3, 1],
 *   Arr.chunkBy((n) => n)
 * ); // [[1, 1], [2], [3, 3], [1]]
 * ```
 */
const chunkBy = <A, K>(keySelector: (item: A) => K) => (items: readonly A[]): readonly (readonly A[])[] => {
	if (items.length === 0) {
		return [];
	}
	const result: A[][] = [];
	let currentChunk: A[] = [items[0]];
	let currentKey = keySelector(items[0]);

	for (let i = 1; i < items.length; i++) {
		const item = items[i];
		const key = keySelector(item);
		if (Object.is(key, currentKey)) {
			currentChunk.push(item);
		} else {
			result.push(currentChunk);
			currentChunk = [item];
			currentKey = key;
		}
	}
	result.push(currentChunk);
	return result;
};

/**
 * Removes consecutive duplicate elements.
 * An optional `Equality<A>` can be provided (defaults to `Object.is`).
 *
 * @see {@link uniq} for deduplicating across the entire array.
 *
 * @example
 * ```ts
 * Arr.dedupeAdjacent()([1, 1, 2, 2, 1, 3]); // [1, 2, 1, 3]
 * ```
 */
const dedupeAdjacent =
	<A>(areEqual: Equality<A> = (first, second) => Object.is(first, second)) => (items: readonly A[]): readonly A[] => {
		if (items.length === 0) {
			return [];
		}
		const result: A[] = [items[0]];
		for (let i = 1; i < items.length; i++) {
			if (!areEqual(items[i], result[result.length - 1])) {
				result.push(items[i]);
			}
		}
		return result;
	};

/**
 * Produces a sliding window of `size` elements over an array, advancing by `step` (default `1`).
 * Returns an empty array if `size <= 0` or `size > items.length`.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.windowed(2)); // [[1, 2], [2, 3], [3, 4]]
 * pipe([1, 2, 3, 4], Arr.windowed(2, { step: 2 })); // [[1, 2], [3, 4]]
 * ```
 */
const windowed =
	(windowSize: number, options?: { step?: number; }) => <A>(items: readonly A[]): readonly (readonly A[])[] => {
		const step = options?.step ?? 1;
		if (windowSize <= 0 || step <= 0 || items.length < windowSize) {
			return [];
		}
		const result: A[][] = [];
		for (let i = 0; i <= items.length - windowSize; i += step) {
			result.push(items.slice(i, i + windowSize));
		}
		return result;
	};

/**
 * Generates an array from an initial seed state until `step` returns `None`.
 *
 * @example
 * ```ts
 * Arr.unfold(1, (n) => n > 3 ? Maybe.make.none() : Maybe.make.some([n, n + 1]));
 * // [1, 2, 3]
 * ```
 */
const unfold = <A, S>(initial: S, step: (state: S) => CoreMaybe<readonly [A, S]>): readonly A[] => {
	const result: A[] = [];
	let currentState = initial;
	while (true) {
		const next = step(currentState);
		if (next.kind === "None") {
			break;
		}
		const [item, nextState] = next.value;
		result.push(item);
		currentState = nextState;
	}
	return result;
};
const ArrIs = {
	/**
	 * Returns `true` when the array is empty.
	 *
	 * @see {@link nonEmpty} for checking if an array contains elements.
	 */
	empty: <A>(items: readonly A[]): boolean => items.length === 0,

	/**
	 * Returns `true` when the array contains at least one element.
	 *
	 * @see {@link empty} for checking if an array is empty.
	 */
	nonEmpty: <A>(items: readonly A[]): items is NonEmptyArr<A> => isNonEmptyArr(items),
};

const ArrNonEmpty = {
	singleton: <A>(item: A): NonEmptyArr<A> => [item],
	from: {
		array: <A>(items: readonly A[]): CoreMaybe<NonEmptyArr<A>> =>
			isNonEmptyArr(items) ? CoreMaybe.make.some(items) : CoreMaybe.make.none(),
	},
	head: <A>(items: NonEmptyArr<A>): A => items[0],
	last: <A>(items: NonEmptyArr<A>): A => items[items.length - 1],
	tail: <A>(items: NonEmptyArr<A>): readonly A[] => items.slice(1),
	reduce: <A>(reducer: (accumulator: A, item: A) => A) => (items: NonEmptyArr<A>): A => items.reduce(reducer),
	map: <A, B>(transform: (item: A) => B) => (items: NonEmptyArr<A>): NonEmptyArr<B> =>
		map(transform)(items) as unknown as NonEmptyArr<B>,
	mapWithIndex: <A, B>(transform: (index: number, item: A) => B) => (items: NonEmptyArr<A>): NonEmptyArr<B> =>
		mapWithIndex(transform)(items) as unknown as NonEmptyArr<B>,
	intersperse: <A>(separator: A) => (items: NonEmptyArr<A>): NonEmptyArr<A> =>
		intersperse(separator)(items) as unknown as NonEmptyArr<A>,
	concat: <A>(other: readonly A[]) => (items: NonEmptyArr<A>): NonEmptyArr<A> =>
		concat(other)(items) as unknown as NonEmptyArr<A>,
	reverse: <A>(items: NonEmptyArr<A>): NonEmptyArr<A> => reverse(items) as unknown as NonEmptyArr<A>,
};

// =============================================================================
// Public Export
// =============================================================================
export const Arr = {
	head,
	last,
	tail,
	init,
	findFirst,
	findLast,
	findIndex,
	map,
	mapWithIndex,
	filter,
	filterMap,
	partition,
	compact,
	separate,
	partitionMap,
	groupBy,
	uniq,
	uniqBy,
	uniqWith,
	sortBy,
	sortWith,
	zip,
	zipWith,
	intersperse,
	concat,
	chunksOf,
	flatten,
	flatMap,
	reduce,
	prepend,
	append,
	size,
	some,
	every,
	reverse,
	insertAt,
	removeAt,
	take,
	drop,
	takeWhile,
	dropWhile,
	scan,
	splitAt,
	partitionMaybe,
	at,
	findMap,
	indexBy,
	frequencies,
	chunkBy,
	dedupeAdjacent,
	windowed,
	unfold,
	is: ArrIs,
	traverse: {
		Maybe: ArrMaybe.traverse,
		Result: ArrResult.traverse,
		Task: ArrTask.traverse,
		Validation: ArrValidation.traverse,
	},
	sequence: {
		Maybe: ArrMaybe.sequence,
		Result: ArrResult.sequence,
		Task: ArrTask.sequence,
		Validation: ArrValidation.sequence,
	},
	NonEmpty: ArrNonEmpty,
};

export namespace Arr {
	export type NonEmpty<A> = NonEmptyArr<A>;
}
