// =============================================================================
// Imports
// =============================================================================
import { Deferred, Equality, Ordering } from "#core";
import { isNonEmptyArr, type NonEmptyArr } from "#internal";
import { Maybe as CoreMaybe } from "../Core/Maybe.ts";
import { Result as CoreResult } from "../Core/Result.ts";
import { Task as CoreTask } from "../Core/Task.ts";

// =============================================================================
// Private Helpers & Traverse/Sequence Implementations
// =============================================================================
namespace ArrMaybe {
	/**
	 * Maps each element to a Maybe and collects the results.
	 * Returns None if any mapping returns None.
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
	export const traverse = <A, B>(f: (a: A) => CoreMaybe<B>) => (data: readonly A[]): CoreMaybe<readonly B[]> => {
		const n = data.length;
		const result = new Array<B>(n);
		for (let i = 0; i < n; i++) {
			const mapped = f(data[i]);
			if (mapped.kind === "None") { return CoreMaybe.make.none(); }
			result[i] = mapped.value;
		}
		return CoreMaybe.make.some(result);
	};

	/**
	 * Collects an array of Maybe instances into a Maybe of array.
	 * Returns None if any element is None.
	 *
	 * @example
	 * ```ts
	 * Arr.sequence.Maybe([Maybe.make.some(1), Maybe.make.some(2)]); // Some([1, 2])
	 * Arr.sequence.Maybe([Maybe.make.some(1), Maybe.make.none()]); // None
	 * ```
	 */
	export const sequence = <A>(data: readonly CoreMaybe<A>[]): CoreMaybe<readonly A[]> =>
		traverse<CoreMaybe<A>, A>((a) => a)(data);
}

namespace ArrResult {
	/**
	 * Maps each element to a Result and collects the results.
	 * Returns the first Err if any mapping fails.
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
		<E, A, B>(f: (a: A) => CoreResult<E, B>) => (data: readonly A[]): CoreResult<E, readonly B[]> => {
			const n = data.length;
			const result = new Array<B>(n);
			for (let i = 0; i < n; i++) {
				const mapped = f(data[i]);
				if (mapped.kind === "Err") { return mapped; }
				result[i] = mapped.value;
			}
			return CoreResult.make.ok(result);
		};

	/**
	 * Collects an array of Results into a Result of array.
	 * Returns the first Err if any element is Err.
	 *
	 * @example
	 * ```ts
	 * Arr.sequence.Result([Result.make.ok(1), Result.make.ok(2)]); // Ok([1, 2])
	 * Arr.sequence.Result([Result.make.ok(1), Result.make.err("bad")]); // Err("bad")
	 * ```
	 */
	export const sequence = <E, A>(data: readonly CoreResult<E, A>[]): CoreResult<E, readonly A[]> =>
		traverse<E, CoreResult<E, A>, A>((a) => a)(data);
}

namespace ArrTaskResult {
	/**
	 * Maps each element to a Task.Result and runs them sequentially.
	 * Returns the first Err encountered, or Ok of all results if all succeed.
	 *
	 * @example
	 * ```ts
	 * const validate = (n: number): Task.Result<string, number> =>
	 *   n > 0 ? Task.Result.ok(n) : Task.Result.err("non-positive");
	 *
	 * pipe(
	 *   [1, 2, 3],
	 *   Arr.traverse.Task.Result(validate)
	 * )(); // Deferred<Ok([1, 2, 3])>
	 *
	 * pipe(
	 *   [1, -1, 3],
	 *   Arr.traverse.Task.Result(validate)
	 * )(); // Deferred<Err("non-positive")>
	 * ```
	 */
	export const traverse =
		<E, A, B>(f: (a: A) => CoreTask<CoreResult<E, B>>) =>
		(data: readonly A[]): CoreTask<CoreResult<E, readonly B[]>> =>
		() =>
			Deferred.from.Promise((async () => {
				const result: B[] = [];
				for (const a of data) {
					const r = await Deferred.to.Promise(f(a)());
					if (CoreResult.is.err(r)) { return r; }
					result.push(r.value);
				}
				return CoreResult.make.ok(result);
			})());

	/**
	 * Collects an array of Task.Results into a Task.Result of array.
	 * Returns the first Err if any element is Err, runs sequentially.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   [Task.Result.ok(1), Task.Result.ok(2)],
	 *   Arr.sequence.Task.Result
	 * )(); // Deferred<Ok([1, 2])>
	 * ```
	 */
	export const sequence = <E, A>(data: readonly CoreTask<CoreResult<E, A>>[]): CoreTask<CoreResult<E, readonly A[]>> =>
		traverse<E, CoreTask<CoreResult<E, A>>, A>((a) => a)(data);
}

namespace ArrTask {
	/**
	 * Maps each element to a Task and runs all in parallel.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   [1, 2, 3],
	 *   Arr.traverse.Task((n: number) => Task.resolve(n * 2))
	 * )(); // Promise<[2, 4, 6]>
	 * ```
	 */
	export const traverse = <A, B>(f: (a: A) => CoreTask<B>) => (data: readonly A[]): CoreTask<readonly B[]> => () =>
		Deferred.from.Promise(Promise.all(data.map((a) => Deferred.to.Promise(f(a)()))));

	/**
	 * Collects an array of Tasks into a Task of array. Runs in parallel.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   [Task.resolve(1), Task.resolve(2)],
	 *   Arr.sequence.Task
	 * )(); // Deferred<[1, 2]>
	 * ```
	 */
	export const sequence = <A>(data: readonly CoreTask<A>[]): CoreTask<readonly A[]> =>
		traverse<CoreTask<A>, A>((a) => a)(data);

	export const Result = ArrTaskResult;
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
 * @example
 * ```ts
 * Arr.head([1, 2, 3]); // Some(1)
 * Arr.head([]); // None
 * ```
 */
const head = <A>(data: readonly A[]): CoreMaybe<A> =>
	data.length > 0 ? CoreMaybe.make.some(data[0]) : CoreMaybe.make.none();

/**
 * Returns the last element of an array, or None if the array is empty.
 *
 * @example
 * ```ts
 * Arr.last([1, 2, 3]); // Some(3)
 * Arr.last([]); // None
 * ```
 */
const last = <A>(data: readonly A[]): CoreMaybe<A> =>
	data.length > 0 ? CoreMaybe.make.some(data[data.length - 1]) : CoreMaybe.make.none();

/**
 * Returns all elements except the first, or None if the array is empty.
 *
 * @example
 * ```ts
 * Arr.tail([1, 2, 3]); // Some([2, 3])
 * Arr.tail([]); // None
 * ```
 */
const tail = <A>(data: readonly A[]): CoreMaybe<readonly A[]> =>
	data.length > 0 ? CoreMaybe.make.some(data.slice(1)) : CoreMaybe.make.none();

/**
 * Returns all elements except the last, or None if the array is empty.
 *
 * @example
 * ```ts
 * Arr.init([1, 2, 3]); // Some([1, 2])
 * Arr.init([]); // None
 * ```
 */
const init = <A>(data: readonly A[]): CoreMaybe<readonly A[]> =>
	data.length > 0 ? CoreMaybe.make.some(data.slice(0, -1)) : CoreMaybe.make.none();

// --- Search ---

/**
 * Returns the first element matching the predicate, or None.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.findFirst(n => n > 2)); // Some(3)
 * ```
 */
const findFirst = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): CoreMaybe<A> => {
	const idx = data.findIndex(predicate);
	return idx !== -1 ? CoreMaybe.make.some(data[idx]) : CoreMaybe.make.none();
};

/**
 * Returns the last element matching the predicate, or None.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.findLast(n => n > 2)); // Some(4)
 * ```
 */
const findLast = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): CoreMaybe<A> => {
	for (let i = data.length - 1; i >= 0; i--) {
		if (predicate(data[i])) { return CoreMaybe.make.some(data[i]); }
	}
	return CoreMaybe.make.none();
};

/**
 * Returns the index of the first element matching the predicate, or None.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.findIndex(n => n > 2)); // Some(2)
 * ```
 */
const findIndex = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): CoreMaybe<number> => {
	const idx = data.findIndex(predicate);
	return idx !== -1 ? CoreMaybe.make.some(idx) : CoreMaybe.make.none();
};

// --- Transform ---

/**
 * Transforms each element of an array.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.map(n => n * 2)); // [2, 4, 6]
 * ```
 */
const map = <A, B>(f: (a: A) => B) => (data: readonly A[]): readonly B[] => {
	const n = data.length;
	const result = new Array<B>(n);
	for (let i = 0; i < n; i++) { result[i] = f(data[i]); }
	return result;
};

/**
 * Transforms each element using both its value and its zero-based index.
 *
 * @example
 * ```ts
 * pipe(
 *   ["a", "b", "c"],
 *   Arr.mapWithIndex((i, s) => ({ position: i + 1, value: s }))
 * ); // [{ position: 1, value: "a" }, { position: 2, value: "b" }, { position: 3, value: "c" }]
 * ```
 */
const mapWithIndex = <A, B>(f: (i: number, a: A) => B) => (data: readonly A[]): readonly B[] => {
	const n = data.length;
	const result = new Array<B>(n);
	for (let i = 0; i < n; i++) { result[i] = f(i, data[i]); }
	return result;
};

/**
 * Filters elements that satisfy the predicate.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.filter(n => n % 2 === 0)); // [2, 4]
 * ```
 */
const filter = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): readonly A[] => {
	const n = data.length;
	const result: A[] = [];
	for (let i = 0; i < n; i++) {
		if (predicate(data[i])) { result.push(data[i]); }
	}
	return result;
};

/**
 * Maps each element to a Maybe and collects only the Some values.
 * Combines map and filter in a single pass.
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
const filterMap = <A, B>(f: (a: A) => CoreMaybe<B>) => (data: readonly A[]): readonly B[] => {
	const result: B[] = [];
	for (let i = 0; i < data.length; i++) {
		const mapped = f(data[i]);
		if (mapped.kind === "Some") { result.push(mapped.value); }
	}
	return result;
};

/**
 * Splits an array into two groups based on a predicate.
 * First group contains elements that satisfy the predicate,
 * second group contains the rest.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.partition(n => n % 2 === 0)); // [[2, 4], [1, 3]]
 * ```
 */
const partition = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): readonly [readonly A[], readonly A[]] => {
	const pass: A[] = [];
	const fail: A[] = [];
	for (const a of data) {
		(predicate(a) ? pass : fail).push(a);
	}
	return [pass, fail];
};

/**
 * Narrows a list of Maybe values down to a list of their underlying values,
 * discarding all None instances.
 *
 * @example
 * ```ts
 * Arr.compact([Maybe.make.some(1), Maybe.make.none(), Maybe.make.some(3)]); // [1, 3]
 * ```
 */
const compact = <A>(data: readonly CoreMaybe<A>[]): readonly A[] => {
	const result: A[] = [];
	for (const item of data) {
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
 * @example
 * ```ts
 * Arr.separate([Result.make.ok(1), Result.make.err("bad"), Result.make.ok(3)]); // [["bad"], [1, 3]]
 * ```
 */
const separate = <E, A>(data: readonly CoreResult<E, A>[]): readonly [readonly E[], readonly A[]] => {
	const errors: E[] = [];
	const successes: A[] = [];
	for (const item of data) {
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
 * @example
 * ```ts
 * pipe(
 *   [1, 2, 3, 4],
 *   Arr.partitionMap(n => n % 2 === 0 ? Result.make.ok(n) : Result.make.err(`odd: ${n}`))
 * ); // [["odd: 1", "odd: 3"], [2, 4]]
 * ```
 */
const partitionMap =
	<A, E, B>(f: (a: A) => CoreResult<E, B>) => (data: readonly A[]): readonly [readonly E[], readonly B[]] => {
		const errors: E[] = [];
		const successes: B[] = [];
		for (const item of data) {
			const mapped = f(item);
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
 * @example
 * ```ts
 * pipe(
 *   ["apple", "avocado", "banana"],
 *   Arr.groupBy(s => s[0])
 * ); // { a: ["apple", "avocado"], b: ["banana"] }
 * ```
 */
const groupBy = <A>(f: (a: A) => string) => (data: readonly A[]): Record<string, NonEmptyArr<A>> => {
	const result: Record<string, A[]> = {};
	for (const a of data) {
		const key = f(a);
		if (!result[key]) { result[key] = []; }
		result[key].push(a);
	}
	return result as unknown as Record<string, NonEmptyArr<A>>;
};

/**
 * Removes duplicate elements using strict equality.
 *
 * @example
 * ```ts
 * Arr.uniq([1, 2, 2, 3, 1]); // [1, 2, 3]
 * ```
 */
const uniq = <A>(data: readonly A[]): readonly A[] => (data.length <= 1 ? data : [...new Set(data)]);

/**
 * Removes duplicate elements by comparing the result of a key function.
 *
 * @example
 * ```ts
 * pipe(
 *   [{id: 1, name: "a"}, {id: 1, name: "b"}, {id: 2, name: "c"}],
 *   Arr.uniqBy(x => x.id)
 * ); // [{id: 1, name: "a"}, {id: 2, name: "c"}]
 * ```
 */
const uniqBy = <A, B>(f: (a: A) => B) => (data: readonly A[]): readonly A[] => {
	const seen = new Set<B>();
	const result: A[] = [];
	for (const a of data) {
		const key = f(a);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(a);
		}
	}
	return result;
};

/**
 * Removes duplicate elements using a custom equality check.
 * Preserves the order of first occurrences. Complements `uniq` (reference equality)
 * and `uniqBy` (key extraction).
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
const uniqWith = <A>(eq: Equality<A>) => (data: readonly A[]): readonly A[] => {
	const result: A[] = [];
	for (const a of data) {
		if (!result.some((x) => eq(x, a))) {
			result.push(a);
		}
	}
	return result;
};

/**
 * Sorts an array using a comparison function. Returns a new array.
 * To sort with a typed `Ordering<A>`, prefer `Arr.sortWith`.
 *
 * @example
 * ```ts
 * pipe([3, 1, 2], Arr.sortBy((a, b) => a - b)); // [1, 2, 3]
 * ```
 */
const sortBy = <A>(compare: (a: A, b: A) => number) => (data: readonly A[]): readonly A[] => {
	const arr = data as A[];
	if (typeof arr.toSorted === "function") { return arr.toSorted(compare); }
	return [...data].sort(compare);
};

/**
 * Sorts an array using an `Ordering<A>`. Returns a new array without mutating the original.
 * Use this over `sortBy` when you have a typed `Ordering<A>` from the `Ordering` module.
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
const sortWith = <A>(ord: Ordering<A>) => (data: readonly A[]): readonly A[] => {
	const arr = data as A[];
	if (typeof arr.toSorted === "function") { return arr.toSorted(ord); }
	return [...data].sort(ord);
};

// --- Combine ---

/**
 * Pairs up elements from two arrays. Stops at the shorter array.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.zip(["a", "b"])); // [[1, "a"], [2, "b"]]
 * ```
 */
const zip = <B>(other: readonly B[]) => <A>(data: readonly A[]): readonly (readonly [A, B])[] => {
	const len = Math.min(data.length, other.length);
	const result = new Array<[A, B]>(len);
	for (let i = 0; i < len; i++) {
		result[i] = [data[i], other[i]];
	}
	return result;
};

/**
 * Combines elements from two arrays using a function. Stops at the shorter array.
 *
 * @example
 * ```ts
 * pipe([1, 2], Arr.zipWith((a: number, b: string) => `${a}${b}`)(["a", "b"])); // ["1a", "2b"]
 * ```
 */
const zipWith = <A, B, C>(f: (a: A, b: B) => C) => (other: readonly B[]) => (data: readonly A[]): readonly C[] => {
	const len = Math.min(data.length, other.length);
	const result = new Array<C>(len);
	for (let i = 0; i < len; i++) {
		result[i] = f(data[i], other[i]);
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
const intersperse = <A>(sep: A) => (data: readonly A[]): readonly A[] => {
	if (data.length <= 1) { return data; }
	const result: A[] = [data[0]];
	for (let i = 1; i < data.length; i++) {
		result.push(sep, data[i]);
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
const concat = <A>(other: readonly A[]) => (data: readonly A[]): readonly A[] => [...data, ...other];

/**
 * Splits an array into chunks of the given size.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4, 5], Arr.chunksOf(2)); // [[1, 2], [3, 4], [5]]
 * ```
 */
const chunksOf = (n: number) => <A>(data: readonly A[]): readonly (readonly A[])[] => {
	if (n <= 0) { return []; }
	const result: A[][] = [];
	for (let i = 0; i < data.length; i += n) {
		result.push(data.slice(i, i + n));
	}
	return result;
};

/**
 * Flattens a nested array by one level.
 *
 * @example
 * ```ts
 * Arr.flatten([[1, 2], [3], [4, 5]]); // [1, 2, 3, 4, 5]
 * ```
 */
const flatten = <A>(data: readonly (readonly A[])[]): readonly A[] => {
	let totalLen = 0;
	const outerLen = data.length;
	for (let i = 0; i < outerLen; i++) {
		totalLen += data[i].length;
	}
	const result = new Array<A>(totalLen);
	let idx = 0;
	for (let i = 0; i < outerLen; i++) {
		const chunk = data[i];
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
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.flatMap(n => [n, n * 10])); // [1, 10, 2, 20, 3, 30]
 * ```
 */
const flatMap = <A, B>(f: (a: A) => readonly B[]) => (data: readonly A[]): readonly B[] => {
	const n = data.length;
	const result: B[] = [];
	for (let i = 0; i < n; i++) {
		const chunk = f(data[i]);
		const m = chunk.length;
		for (let j = 0; j < m; j++) { result.push(chunk[j]); }
	}
	return result;
};

/**
 * Reduces an array from the left.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.reduce(0, (acc, n) => acc + n)); // 6
 * ```
 */
const reduce = <A, B>(initial: B, f: (acc: B, a: A) => B) => (data: readonly A[]): B => data.reduce(f, initial);

// --- Traverse / Sequence ---

interface TaskTraverse {
	<A, B>(f: (a: A) => CoreTask<B>): (data: readonly A[]) => CoreTask<readonly B[]>;
	Result: typeof ArrTaskResult.traverse;
}

const _traverseTask: TaskTraverse = Object.assign(<A, B>(f: (a: A) => CoreTask<B>) => ArrTask.traverse(f), {
	Result: ArrTaskResult.traverse,
});

interface TaskSequence {
	<A>(data: readonly CoreTask<A>[]): CoreTask<readonly A[]>;
	Result: typeof ArrTaskResult.sequence;
}

const _sequenceTask: TaskSequence = Object.assign(<A>(data: readonly CoreTask<A>[]) => ArrTask.sequence(data), {
	Result: ArrTaskResult.sequence,
});

/**
 * Prepends a value to the beginning of an array, returning a NonEmptyArr.
 *
 * @example
 * ```ts
 * pipe([1, 2], Arr.prepend(0)); // [0, 1, 2]
 * ```
 */
const prepend = <A>(value: A) => (data: readonly A[]): NonEmptyArr<A> => [value, ...data];

/**
 * Appends a value to the end of an array, returning a NonEmptyArr.
 *
 * @example
 * ```ts
 * pipe([1, 2], Arr.append(3)); // [1, 2, 3]
 * ```
 */
const append = <A>(value: A) => (data: readonly A[]): NonEmptyArr<A> => [...data, value] as unknown as NonEmptyArr<A>;

/**
 * Returns the length of an array.
 *
 * @example
 * ```ts
 * Arr.size([1, 2, 3]); // 3
 * ```
 */
const size = <A>(data: readonly A[]): number => data.length;

/**
 * Returns true if any element satisfies the predicate.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.some(n => n > 2)); // true
 * ```
 */
const some = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): boolean => {
	const n = data.length;
	for (let i = 0; i < n; i++) { if (predicate(data[i])) { return true; } }
	return false;
};

/**
 * Returns true if all elements satisfy the predicate.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.every(n => n > 0)); // true
 * ```
 */
const every = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): boolean => {
	const n = data.length;
	for (let i = 0; i < n; i++) { if (!predicate(data[i])) { return false; } }
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
const reverse = <A>(data: readonly A[]): readonly A[] => [...data].toReversed();

/**
 * Returns a new array with `item` inserted before the element at `index`.
 * Negative indices are clamped to 0; indices beyond the array length append to the end.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.insertAt(1, 99)); // [1, 99, 2, 3]
 * pipe([1, 2, 3], Arr.insertAt(0, 99)); // [99, 1, 2, 3]
 * pipe([1, 2, 3], Arr.insertAt(3, 99)); // [1, 2, 3, 99]
 * ```
 */
const insertAt = <A>(index: number, item: A) => (data: readonly A[]): readonly A[] => {
	const i = Math.max(0, Math.min(index, data.length));
	const arr = data as A[];
	if (typeof arr.toSpliced === "function") { return arr.toSpliced(i, 0, item); }
	const result = [...data];
	result.splice(i, 0, item);
	return result;
};

/**
 * Returns a new array with the element at `index` removed.
 * Returns the original array unchanged if `index` is out of bounds.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.removeAt(1)); // [1, 3]
 * pipe([1, 2, 3], Arr.removeAt(0)); // [2, 3]
 * pipe([1, 2, 3], Arr.removeAt(5)); // [1, 2, 3]
 * ```
 */
const removeAt = (index: number) => <A>(data: readonly A[]): readonly A[] => {
	if (index < 0 || index >= data.length) { return data; }
	const arr = data as A[];
	if (typeof arr.toSpliced === "function") { return arr.toSpliced(index, 1); }
	const result = [...data];
	result.splice(index, 1);
	return result;
};

/**
 * Takes the first n elements from an array.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.take(2)); // [1, 2]
 * ```
 */
const take = (n: number) => <A>(data: readonly A[]): readonly A[] => n <= 0 ? [] : data.slice(0, n);

/**
 * Drops the first n elements from an array.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.drop(2)); // [3, 4]
 * ```
 */
const drop = (n: number) => <A>(data: readonly A[]): readonly A[] => data.slice(n);

/**
 * Takes elements from the start while the predicate holds.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 1], Arr.takeWhile(n => n < 3)); // [1, 2]
 * ```
 */
const takeWhile = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): readonly A[] => {
	const result: A[] = [];
	for (const a of data) {
		if (!predicate(a)) { break; }
		result.push(a);
	}
	return result;
};

/**
 * Drops elements from the start while the predicate holds.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 1], Arr.dropWhile(n => n < 3)); // [3, 1]
 * ```
 */
const dropWhile = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): readonly A[] => {
	let i = 0;
	while (i < data.length && predicate(data[i])) { i++; }
	return data.slice(i);
};

/**
 * Like `reduce`, but returns every intermediate accumulator as an array.
 * The initial value is not included — the output has the same length as the input.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3], Arr.scan(0, (acc, n) => acc + n)); // [1, 3, 6]
 * ```
 */
const scan = <A, B>(initial: B, f: (acc: B, a: A) => B) => (data: readonly A[]): readonly B[] => {
	const n = data.length;
	const result = new Array<B>(n);
	let acc = initial;
	for (let i = 0; i < n; i++) {
		acc = f(acc, data[i]);
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
const splitAt = (index: number) => <A>(data: readonly A[]): readonly [readonly A[], readonly A[]] => {
	const i = Math.max(0, index);
	return [data.slice(0, i), data.slice(i)];
};

/**
 * Partitions an array by applying a function returning `Maybe<B>`.
 * Elements returning `None` are gathered into `failures` (original `A` values);
 * elements returning `Some(b)` are gathered into `successes` (`B` values).
 *
 * @example
 * ```ts
 * const parseNumber = (s: string) => isNaN(Number(s)) ? Maybe.make.none() : Maybe.make.some(Number(s));
 * pipe(["1", "abc", "3"], Arr.partitionMaybe(parseNumber)); // [["abc"], [1, 3]]
 * ```
 */
const partitionMaybe =
	<A, B>(f: (a: A) => CoreMaybe<B>) =>
	(data: readonly A[]): readonly [failures: readonly A[], successes: readonly B[]] => {
		const failures: A[] = [];
		const successes: B[] = [];
		for (let i = 0; i < data.length; i++) {
			const res = f(data[i]);
			if (res.kind === "Some") {
				successes.push(res.value);
			} else {
				failures.push(data[i]);
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
const at = (index: number) => <A>(data: readonly A[]): CoreMaybe<A> => {
	const targetIndex = index < 0 ? data.length + index : index;
	if (targetIndex < 0 || targetIndex >= data.length) {
		return CoreMaybe.make.none();
	}
	return CoreMaybe.make.some(data[targetIndex]);
};

/**
 * Finds the first element in an array for which `f` returns `Some(b)`.
 *
 * @example
 * ```ts
 * pipe(
 *   ["1", "a", "2"],
 *   Arr.findMap((s) => isNaN(Number(s)) ? Maybe.make.none() : Maybe.make.some(Number(s)))
 * ); // Some(1)
 * ```
 */
const findMap = <A, B>(f: (a: A) => CoreMaybe<B>) => (data: readonly A[]): CoreMaybe<B> => {
	for (let i = 0; i < data.length; i++) {
		const res = f(data[i]);
		if (res.kind === "Some") {
			return res;
		}
	}
	return CoreMaybe.make.none();
};

/**
 * Indexes elements of an array into a `ReadonlyMap<K, A>` using a key extraction function.
 *
 * @example
 * ```ts
 * pipe(
 *   [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }],
 *   Arr.indexBy((u) => u.id)
 * ); // ReadonlyMap { 1 => { id: 1, name: "Alice" }, 2 => { id: 2, name: "Bob" } }
 * ```
 */
const indexBy = <A, K>(keyFn: (a: A) => K) => (data: readonly A[]): ReadonlyMap<K, A> => {
	const resultMap = new globalThis.Map<K, A>();
	for (let i = 0; i < data.length; i++) {
		resultMap.set(keyFn(data[i]), data[i]);
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
const frequencies = <A>(data: readonly A[]): ReadonlyMap<A, number> => {
	const resultMap = new globalThis.Map<A, number>();
	for (let i = 0; i < data.length; i++) {
		const item = data[i];
		resultMap.set(item, (resultMap.get(item) ?? 0) + 1);
	}
	return resultMap;
};

/**
 * Groups consecutive elements that share the same key returned by `keyFn`.
 *
 * @example
 * ```ts
 * pipe(
 *   [1, 1, 2, 3, 3, 1],
 *   Arr.chunkBy((n) => n)
 * ); // [[1, 1], [2], [3, 3], [1]]
 * ```
 */
const chunkBy = <A, K>(keyFn: (a: A) => K) => (data: readonly A[]): readonly (readonly A[])[] => {
	if (data.length === 0) {
		return [];
	}
	const result: A[][] = [];
	let currentChunk: A[] = [data[0]];
	let currentKey = keyFn(data[0]);

	for (let i = 1; i < data.length; i++) {
		const item = data[i];
		const key = keyFn(item);
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
 * @example
 * ```ts
 * Arr.dedupeAdjacent()([1, 1, 2, 2, 1, 3]); // [1, 2, 1, 3]
 * ```
 */
const dedupeAdjacent = <A>(eq: Equality<A> = (a, b) => Object.is(a, b)) => (data: readonly A[]): readonly A[] => {
	if (data.length === 0) {
		return [];
	}
	const result: A[] = [data[0]];
	for (let i = 1; i < data.length; i++) {
		if (!eq(data[i], result[result.length - 1])) {
			result.push(data[i]);
		}
	}
	return result;
};

/**
 * Produces a sliding window of `size` elements over an array, advancing by `step` (default `1`).
 * Returns an empty array if `size <= 0` or `size > data.length`.
 *
 * @example
 * ```ts
 * pipe([1, 2, 3, 4], Arr.windowed(2)); // [[1, 2], [2, 3], [3, 4]]
 * pipe([1, 2, 3, 4], Arr.windowed(2, { step: 2 })); // [[1, 2], [3, 4]]
 * ```
 */
const windowed =
	(windowSize: number, options?: { step?: number; }) => <A>(data: readonly A[]): readonly (readonly A[])[] => {
		const step = options?.step ?? 1;
		if (windowSize <= 0 || step <= 0 || data.length < windowSize) {
			return [];
		}
		const result: A[][] = [];
		for (let i = 0; i <= data.length - windowSize; i += step) {
			result.push(data.slice(i, i + windowSize));
		}
		return result;
	};

/**
 * Generates an array from an initial seed state until `f` returns `None`.
 *
 * @example
 * ```ts
 * Arr.unfold(1, (n) => n > 3 ? Maybe.make.none() : Maybe.make.some([n, n + 1]));
 * // [1, 2, 3]
 * ```
 */
const unfold = <A, S>(initial: S, f: (state: S) => CoreMaybe<readonly [A, S]>): readonly A[] => {
	const result: A[] = [];
	let currentState = initial;
	while (true) {
		const next = f(currentState);
		if (next.kind === "None") {
			break;
		}
		const [item, nextState] = next.value;
		result.push(item);
		currentState = nextState;
	}
	return result;
};
const ArrFrom = {
	Array: <A>(data: readonly A[]): CoreMaybe<NonEmptyArr<A>> =>
		data.length > 0 ? CoreMaybe.make.some(data as NonEmptyArr<A>) : CoreMaybe.make.none(),
};

const ArrIs = {
	empty: <A>(data: readonly A[]): data is readonly [] => data.length === 0,
	nonEmpty: <A>(data: readonly A[]): data is NonEmptyArr<A> => isNonEmptyArr(data),
};

const ArrNonEmpty = {
	singleton: <A>(value: A): NonEmptyArr<A> => [value],
	from: {
		Array: <A>(data: readonly A[]): CoreMaybe<NonEmptyArr<A>> =>
			isNonEmptyArr(data) ? CoreMaybe.make.some(data) : CoreMaybe.make.none(),
	},
	head: <A>(data: NonEmptyArr<A>): A => data[0],
	last: <A>(data: NonEmptyArr<A>): A => data[data.length - 1],
	tail: <A>(data: NonEmptyArr<A>): readonly A[] => data.slice(1),
	reduce: <A>(f: (acc: A, a: A) => A) => (data: NonEmptyArr<A>): A => data.reduce(f),
	map: <A, B>(f: (a: A) => B) => (data: NonEmptyArr<A>): NonEmptyArr<B> => map(f)(data) as unknown as NonEmptyArr<B>,
	mapWithIndex: <A, B>(f: (i: number, a: A) => B) => (data: NonEmptyArr<A>): NonEmptyArr<B> =>
		mapWithIndex(f)(data) as unknown as NonEmptyArr<B>,
	intersperse: <A>(sep: A) => (data: NonEmptyArr<A>): NonEmptyArr<A> =>
		intersperse(sep)(data) as unknown as NonEmptyArr<A>,
	concat: <A>(other: readonly A[]) => (data: NonEmptyArr<A>): NonEmptyArr<A> =>
		concat(other)(data) as unknown as NonEmptyArr<A>,
	reverse: <A>(data: NonEmptyArr<A>): NonEmptyArr<A> => reverse(data) as unknown as NonEmptyArr<A>,
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
	from: ArrFrom,
	is: ArrIs,
	traverse: { Maybe: ArrMaybe.traverse, Result: ArrResult.traverse, Task: _traverseTask },
	sequence: { Maybe: ArrMaybe.sequence, Result: ArrResult.sequence, Task: _sequenceTask },
	NonEmpty: ArrNonEmpty,
};

export namespace Arr {
	export type NonEmpty<A> = NonEmptyArr<A>;
}
