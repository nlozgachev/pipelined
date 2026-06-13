import { Deferred, Equality, Ordering } from "#core";
import { isNonEmptyArr, type NonEmptyArr } from "#internal";
import { Maybe as CoreMaybe } from "../Core/Maybe.ts";
import { Result as CoreResult } from "../Core/Result.ts";
import { Task as CoreTask } from "../Core/Task.ts";

namespace ArrMaybe {
	/**
	 * Maps each element to a Maybe and collects the results.
	 * Returns None if any mapping returns None.
	 *
	 * @example
	 * ```ts
	 * const parseNum = (s: string): Maybe<number> => {
	 *   const n = Number(s);
	 *   return isNaN(n) ? Maybe.none() : Maybe.some(n);
	 * };
	 *
	 * pipe(["1", "2", "3"], Arr.Maybe.traverse(parseNum)); // Some([1, 2, 3])
	 * pipe(["1", "x", "3"], Arr.Maybe.traverse(parseNum)); // None
	 * ```
	 */
	export const traverse = <A, B>(f: (a: A) => CoreMaybe<B>) => (data: readonly A[]): CoreMaybe<readonly B[]> => {
		const n = data.length;
		const result = new Array<B>(n);
		for (let i = 0; i < n; i++) {
			const mapped = f(data[i]);
			if (mapped.kind === "None") { return CoreMaybe.none(); }
			result[i] = mapped.value;
		}
		return CoreMaybe.some(result);
	};

	/**
	 * Collects an array of Maybe instances into a Maybe of array.
	 * Returns None if any element is None.
	 *
	 * @example
	 * ```ts
	 * Arr.Maybe.sequence([Maybe.some(1), Maybe.some(2)]); // Some([1, 2])
	 * Arr.Maybe.sequence([Maybe.some(1), Maybe.none()]); // None
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
	 *   Arr.Result.traverse(n => n > 0 ? Result.ok(n) : Result.err("negative"))
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
			return CoreResult.ok(result);
		};

	/**
	 * Collects an array of Results into a Result of array.
	 * Returns the first Err if any element is Err.
	 */
	export const sequence = <E, A>(data: readonly CoreResult<E, A>[]): CoreResult<E, readonly A[]> =>
		traverse<E, CoreResult<E, A>, A>((a) => a)(data);
}

namespace ArrTaskResult {
	/**
	 * Maps each element to a TaskResult and runs them sequentially.
	 * Returns the first Err encountered, or Ok of all results if all succeed.
	 *
	 * @example
	 * ```ts
	 * const validate = (n: number): Task.Result<string, number> =>
	 *   n > 0 ? Task.Result.ok(n) : Task.Result.err("non-positive");
	 *
	 * pipe(
	 *   [1, 2, 3],
	 *   Arr.Task.Result.traverse(validate)
	 * )(); // Deferred<Ok([1, 2, 3])>
	 *
	 * pipe(
	 *   [1, -1, 3],
	 *   Arr.Task.Result.traverse(validate)
	 * )(); // Deferred<Err("non-positive")>
	 * ```
	 */
	export const traverse =
		<E, A, B>(f: (a: A) => CoreTask<CoreResult<E, B>>) => (data: readonly A[]): CoreTask<CoreResult<E, readonly B[]>> =>
			CoreTask.from(async () => {
				const result: B[] = [];
				for (const a of data) {
					// eslint-disable-next-line no-await-in-loop
					const r = await Deferred.toPromise(f(a)());
					if (CoreResult.isErr(r)) { return r; }
					result.push(r.value);
				}
				return CoreResult.ok(result);
			});

	/**
	 * Collects an array of TaskResults into a TaskResult of array.
	 * Returns the first Err if any element is Err, runs sequentially.
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
	 *   Arr.Task.traverse(n => Task.resolve(n * 2))
	 * )(); // Promise<[2, 4, 6]>
	 * ```
	 */
	export const traverse = <A, B>(f: (a: A) => CoreTask<B>) => (data: readonly A[]): CoreTask<readonly B[]> =>
		CoreTask.from(() => Promise.all(data.map((a) => Deferred.toPromise(f(a)()))));

	/**
	 * Collects an array of Tasks into a Task of array. Runs in parallel.
	 */
	export const sequence = <A>(data: readonly CoreTask<A>[]): CoreTask<readonly A[]> =>
		traverse<CoreTask<A>, A>((a) => a)(data);

	export const Result = ArrTaskResult;
}

namespace ArrNonEmpty {
	/**
	 * Creates a single-element list.
	 *
	 * @example
	 * ```ts
	 * Arr.NonEmpty.singleton(42); // [42]
	 * ```
	 */
	export const singleton = <A>(value: A): NonEmptyArr<A> => [value];

	/**
	 * Returns Some if the array is non-empty, None otherwise.
	 *
	 * @example
	 * ```ts
	 * Arr.NonEmpty.fromArray([1, 2]); // Some([1, 2])
	 * Arr.NonEmpty.fromArray([]); // None
	 * ```
	 */
	export const fromArray = <A>(data: readonly A[]): CoreMaybe<NonEmptyArr<A>> =>
		isNonEmptyArr(data) ? CoreMaybe.some(data) : CoreMaybe.none();

	/**
	 * Returns the first element of a NonEmptyArr.
	 *
	 * @example
	 * ```ts
	 * Arr.NonEmpty.head([1, 2, 3]); // 1
	 * ```
	 */
	export const head = <A>(data: NonEmptyArr<A>): A => data[0];

	/**
	 * Returns the last element of a NonEmptyArr.
	 *
	 * @example
	 * ```ts
	 * Arr.NonEmpty.last([1, 2, 3]); // 3
	 * ```
	 */
	export const last = <A>(data: NonEmptyArr<A>): A => data[data.length - 1];

	/**
	 * Returns all elements except the first.
	 *
	 * @example
	 * ```ts
	 * Arr.NonEmpty.tail([1, 2, 3]); // [2, 3]
	 * ```
	 */
	export const tail = <A>(data: NonEmptyArr<A>): readonly A[] => data.slice(1);

	/**
	 * Reduces a NonEmptyArr from the left without an initial value.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2, 3, 4] as NonEmptyArr<number>, Arr.NonEmpty.reduce((a, b) => a + b)); // 10
	 * ```
	 */
	export const reduce = <A>(f: (acc: A, a: A) => A) => (data: NonEmptyArr<A>): A => data.reduce(f);
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
export namespace Arr {
	/**
	 * A type alias representing an array that is guaranteed to contain at least one element.
	 * Under the hood, this is a read-only tuple structure: `readonly [A, ...A[]]`.
	 *
	 * @example
	 * ```ts
	 * const list: Arr.NonEmpty<number> = [1, 2, 3];
	 * ```
	 */
	export type NonEmpty<A> = NonEmptyArr<A>;

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
	export const head = <A>(data: readonly A[]): CoreMaybe<A> =>
		data.length > 0 ? CoreMaybe.some(data[0]) : CoreMaybe.none();

	/**
	 * Returns the last element of an array, or None if the array is empty.
	 *
	 * @example
	 * ```ts
	 * Arr.last([1, 2, 3]); // Some(3)
	 * Arr.last([]); // None
	 * ```
	 */
	export const last = <A>(data: readonly A[]): CoreMaybe<A> =>
		data.length > 0 ? CoreMaybe.some(data[data.length - 1]) : CoreMaybe.none();

	/**
	 * Returns all elements except the first, or None if the array is empty.
	 *
	 * @example
	 * ```ts
	 * Arr.tail([1, 2, 3]); // Some([2, 3])
	 * Arr.tail([]); // None
	 * ```
	 */
	export const tail = <A>(data: readonly A[]): CoreMaybe<readonly A[]> =>
		data.length > 0 ? CoreMaybe.some(data.slice(1)) : CoreMaybe.none();

	/**
	 * Returns all elements except the last, or None if the array is empty.
	 *
	 * @example
	 * ```ts
	 * Arr.init([1, 2, 3]); // Some([1, 2])
	 * Arr.init([]); // None
	 * ```
	 */
	export const init = <A>(data: readonly A[]): CoreMaybe<readonly A[]> =>
		data.length > 0 ? CoreMaybe.some(data.slice(0, -1)) : CoreMaybe.none();

	// --- Search ---

	/**
	 * Returns the first element matching the predicate, or None.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2, 3, 4], Arr.findFirst(n => n > 2)); // Some(3)
	 * ```
	 */
	export const findFirst = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): CoreMaybe<A> => {
		const idx = data.findIndex(predicate);
		return idx !== -1 ? CoreMaybe.some(data[idx]) : CoreMaybe.none();
	};

	/**
	 * Returns the last element matching the predicate, or None.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2, 3, 4], Arr.findLast(n => n > 2)); // Some(4)
	 * ```
	 */
	export const findLast = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): CoreMaybe<A> => {
		for (let i = data.length - 1; i >= 0; i--) {
			if (predicate(data[i])) { return CoreMaybe.some(data[i]); }
		}
		return CoreMaybe.none();
	};

	/**
	 * Returns the index of the first element matching the predicate, or None.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2, 3, 4], Arr.findIndex(n => n > 2)); // Some(2)
	 * ```
	 */
	export const findIndex = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): CoreMaybe<number> => {
		const idx = data.findIndex(predicate);
		return idx !== -1 ? CoreMaybe.some(idx) : CoreMaybe.none();
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
	export const map: <A, B>(f: (a: A) => B) => { (data: NonEmpty<A>): NonEmpty<B>; (data: readonly A[]): readonly B[]; } =
		<A, B>(f: (a: A) => B) => (data: readonly A[]): any => {
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
	export const mapWithIndex: <A, B>(
		f: (i: number, a: A) => B,
	) => { (data: NonEmpty<A>): NonEmpty<B>; (data: readonly A[]): readonly B[]; } =
		<A, B>(f: (i: number, a: A) => B) => (data: readonly A[]): any => {
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
	export const filter = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): readonly A[] => {
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
	 *   return isNaN(n) ? Maybe.none() : Maybe.some(n);
	 * };
	 *
	 * pipe(["1", "abc", "3"], Arr.filterMap(parseNum)); // [1, 3]
	 * ```
	 */
	export const filterMap = <A, B>(f: (a: A) => CoreMaybe<B>) => (data: readonly A[]): readonly B[] => {
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
	export const partition =
		<A>(predicate: (a: A) => boolean) => (data: readonly A[]): readonly [readonly A[], readonly A[]] => {
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
	 * Arr.compact([Maybe.some(1), Maybe.none(), Maybe.some(3)]); // [1, 3]
	 * ```
	 */
	export const compact = <A>(data: readonly CoreMaybe<A>[]): readonly A[] => {
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
	 * Arr.separate([Result.ok(1), Result.err("bad"), Result.ok(3)]); // [["bad"], [1, 3]]
	 * ```
	 */
	export const separate = <E, A>(data: readonly CoreResult<E, A>[]): readonly [readonly E[], readonly A[]] => {
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
	 *   Arr.partitionMap(n => n % 2 === 0 ? Result.ok(n) : Result.err(`odd: ${n}`))
	 * ); // [["odd: 1", "odd: 3"], [2, 4]]
	 * ```
	 */
	export const partitionMap =
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
	export const groupBy = <A>(f: (a: A) => string) => (data: readonly A[]): Record<string, NonEmptyArr<A>> => {
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
	export const uniq = <A>(data: readonly A[]): readonly A[] => [...new Set(data)];

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
	export const uniqBy = <A, B>(f: (a: A) => B) => (data: readonly A[]): readonly A[] => {
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
	export const uniqWith = <A>(eq: Equality<A>) => (data: readonly A[]): readonly A[] => {
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
	export const sortBy = <A>(compare: (a: A, b: A) => number) => (data: readonly A[]): readonly A[] => {
		const arr = data as A[];
		if (typeof arr.toSorted === "function") { return arr.toSorted(compare); }
		return [...data].toSorted(compare);
	};

	/**
	 * Sorts an array using an `Ordering<A>`. Returns a new array without mutating the original.
	 * Use this over `sortBy` when you have a typed `Ordering<A>` from the `Ordering` module.
	 *
	 * @example
	 * ```ts
	 * pipe([3, 1, 2], Arr.sortWith(Ordering.number)); // [1, 2, 3]
	 *
	 * const byPrice = pipe(Ordering.number, Ordering.by((p: Product) => p.price));
	 * pipe(products, Arr.sortWith(byPrice));
	 * ```
	 */
	export const sortWith = <A>(ord: Ordering<A>) => (data: readonly A[]): readonly A[] => {
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
	export const zip = <B>(other: readonly B[]) => <A>(data: readonly A[]): readonly (readonly [A, B])[] => {
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
	 * pipe([1, 2], Arr.zipWith((a, b) => a + b, ["a", "b"])); // ["1a", "2b"]
	 * ```
	 */
	export const zipWith =
		<A, B, C>(f: (a: A, b: B) => C) => (other: readonly B[]) => (data: readonly A[]): readonly C[] => {
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
	export const intersperse: <A>(sep: A) => { (data: NonEmpty<A>): NonEmpty<A>; (data: readonly A[]): readonly A[]; } =
		<A>(sep: A) => (data: readonly A[]): any => {
			if (data.length <= 1) { return data; }
			const result: A[] = [data[0]];
			for (let i = 1; i < data.length; i++) {
				result.push(sep, data[i]);
			}
			return result;
		};

	/**
	 * Concatenates a standard array or NonEmptyArr with another array.
	 * If the first array is a NonEmptyArr, the result is guaranteed to be a NonEmptyArr.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2], Arr.concat([3, 4])); // [1, 2, 3, 4]
	 * ```
	 */
	export const concat: <A>(
		other: readonly A[],
	) => { (data: NonEmpty<A>): NonEmpty<A>; (data: readonly A[]): readonly A[]; } =
		<A>(other: readonly A[]) => (data: readonly A[]): any => [...data, ...other];

	/**
	 * Splits an array into chunks of the given size.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2, 3, 4, 5], Arr.chunksOf(2)); // [[1, 2], [3, 4], [5]]
	 * ```
	 */
	export const chunksOf = (n: number) => <A>(data: readonly A[]): readonly (readonly A[])[] => {
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
	export const flatten = <A>(data: readonly (readonly A[])[]): readonly A[] => {
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
	export const flatMap = <A, B>(f: (a: A) => readonly B[]) => (data: readonly A[]): readonly B[] => {
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
	export const reduce = <A, B>(initial: B, f: (acc: B, a: A) => B) => (data: readonly A[]): B => data.reduce(f, initial);

	// --- Traverse / Sequence ---

	export const Maybe = ArrMaybe;
	export const Result = ArrResult;
	export const Task = ArrTask;

	/**
	 * Returns true if the array is non-empty (type guard).
	 */
	export const isNonEmpty = <A>(data: readonly A[]): data is NonEmpty<A> => isNonEmptyArr(data);

	/**
	 * Prepends a value to the beginning of an array, returning a NonEmptyArr.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2], Arr.prepend(0)); // [0, 1, 2]
	 * ```
	 */
	export const prepend = <A>(value: A) => (data: readonly A[]): NonEmpty<A> => [value, ...data];

	/**
	 * Appends a value to the end of an array, returning a NonEmptyArr.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2], Arr.append(3)); // [1, 2, 3]
	 * ```
	 */
	export const append = <A>(value: A) => (data: readonly A[]): NonEmpty<A> => [...data, value] as unknown as NonEmpty<A>;

	/**
	 * Returns the length of an array.
	 */
	export const size = <A>(data: readonly A[]): number => data.length;

	/**
	 * Returns true if any element satisfies the predicate.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2, 3], Arr.some(n => n > 2)); // true
	 * ```
	 */
	export const some = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): boolean => {
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
	export const every = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): boolean => {
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
	export const reverse: { <A>(data: NonEmpty<A>): NonEmpty<A>; <A>(data: readonly A[]): readonly A[]; } = <A>(
		data: readonly A[],
	): any => [...data].toReversed();

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
	export const insertAt = <A>(index: number, item: A) => (data: readonly A[]): readonly A[] => {
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
	export const removeAt = (index: number) => <A>(data: readonly A[]): readonly A[] => {
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
	export const take = (n: number) => <A>(data: readonly A[]): readonly A[] => n <= 0 ? [] : data.slice(0, n);

	/**
	 * Drops the first n elements from an array.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2, 3, 4], Arr.drop(2)); // [3, 4]
	 * ```
	 */
	export const drop = (n: number) => <A>(data: readonly A[]): readonly A[] => data.slice(n);

	/**
	 * Takes elements from the start while the predicate holds.
	 *
	 * @example
	 * ```ts
	 * pipe([1, 2, 3, 1], Arr.takeWhile(n => n < 3)); // [1, 2]
	 * ```
	 */
	export const takeWhile = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): readonly A[] => {
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
	export const dropWhile = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): readonly A[] => {
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
	export const scan = <A, B>(initial: B, f: (acc: B, a: A) => B) => (data: readonly A[]): readonly B[] => {
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
	export const splitAt = (index: number) => <A>(data: readonly A[]): readonly [readonly A[], readonly A[]] => {
		const i = Math.max(0, index);
		return [data.slice(0, i), data.slice(i)];
	};

	export const NonEmpty = ArrNonEmpty;
}
