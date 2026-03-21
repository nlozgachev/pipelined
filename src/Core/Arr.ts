import { Deferred } from "./Deferred.ts";
import { Option } from "./Option.ts";
import { Result } from "./Result.ts";
import { Task } from "./Task.ts";
import { isNonEmptyList, NonEmptyList } from "../Types/NonEmptyList.ts";

/**
 * Functional array utilities that compose well with pipe.
 * All functions are data-last and curried where applicable.
 * Safe access functions return Option instead of throwing or returning undefined.
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
  export const head = <A>(data: readonly A[]): Option<A> =>
    data.length > 0 ? Option.some(data[0]) : Option.none();

  /**
   * Returns the last element of an array, or None if the array is empty.
   *
   * @example
   * ```ts
   * Arr.last([1, 2, 3]); // Some(3)
   * Arr.last([]); // None
   * ```
   */
  export const last = <A>(data: readonly A[]): Option<A> =>
    data.length > 0 ? Option.some(data[data.length - 1]) : Option.none();

  /**
   * Returns all elements except the first, or None if the array is empty.
   *
   * @example
   * ```ts
   * Arr.tail([1, 2, 3]); // Some([2, 3])
   * Arr.tail([]); // None
   * ```
   */
  export const tail = <A>(data: readonly A[]): Option<readonly A[]> =>
    data.length > 0 ? Option.some(data.slice(1)) : Option.none();

  /**
   * Returns all elements except the last, or None if the array is empty.
   *
   * @example
   * ```ts
   * Arr.init([1, 2, 3]); // Some([1, 2])
   * Arr.init([]); // None
   * ```
   */
  export const init = <A>(data: readonly A[]): Option<readonly A[]> =>
    data.length > 0 ? Option.some(data.slice(0, -1)) : Option.none();

  // --- Search ---

  /**
   * Returns the first element matching the predicate, or None.
   *
   * @example
   * ```ts
   * pipe([1, 2, 3, 4], Arr.findFirst(n => n > 2)); // Some(3)
   * ```
   */
  export const findFirst = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): Option<A> => {
    const idx = data.findIndex(predicate);
    return idx >= 0 ? Option.some(data[idx]) : Option.none();
  };

  /**
   * Returns the last element matching the predicate, or None.
   *
   * @example
   * ```ts
   * pipe([1, 2, 3, 4], Arr.findLast(n => n > 2)); // Some(4)
   * ```
   */
  export const findLast = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): Option<A> => {
    for (let i = data.length - 1; i >= 0; i--) {
      if (predicate(data[i])) return Option.some(data[i]);
    }
    return Option.none();
  };

  /**
   * Returns the index of the first element matching the predicate, or None.
   *
   * @example
   * ```ts
   * pipe([1, 2, 3, 4], Arr.findIndex(n => n > 2)); // Some(2)
   * ```
   */
  export const findIndex =
    <A>(predicate: (a: A) => boolean) => (data: readonly A[]): Option<number> => {
      const idx = data.findIndex(predicate);
      return idx >= 0 ? Option.some(idx) : Option.none();
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
  export const map = <A, B>(f: (a: A) => B) => (data: readonly A[]): readonly B[] => data.map(f);

  /**
   * Filters elements that satisfy the predicate.
   *
   * @example
   * ```ts
   * pipe([1, 2, 3, 4], Arr.filter(n => n % 2 === 0)); // [2, 4]
   * ```
   */
  export const filter = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): readonly A[] =>
    data.filter(predicate);

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
    <A>(predicate: (a: A) => boolean) =>
    (data: readonly A[]): readonly [readonly A[], readonly A[]] => {
      const pass: A[] = [];
      const fail: A[] = [];
      for (const a of data) {
        (predicate(a) ? pass : fail).push(a);
      }
      return [pass, fail];
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
  export const groupBy =
    <A>(f: (a: A) => string) => (data: readonly A[]): Record<string, NonEmptyList<A>> => {
      const result: Record<string, A[]> = {};
      for (const a of data) {
        const key = f(a);
        if (!result[key]) result[key] = [];
        result[key].push(a);
      }
      return result as unknown as Record<string, NonEmptyList<A>>;
    };

  /**
   * Removes duplicate elements using strict equality.
   *
   * @example
   * ```ts
   * Arr.uniq([1, 2, 2, 3, 1]); // [1, 2, 3]
   * ```
   */
  export const uniq = <A>(data: readonly A[]): readonly A[] => [
    ...new Set(data),
  ];

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
   * Sorts an array using a comparison function. Returns a new array.
   *
   * @example
   * ```ts
   * pipe([3, 1, 2], Arr.sortBy((a, b) => a - b)); // [1, 2, 3]
   * ```
   */
  export const sortBy =
    <A>(compare: (a: A, b: A) => number) => (data: readonly A[]): readonly A[] =>
      [...data].sort(compare);

  // --- Combine ---

  /**
   * Pairs up elements from two arrays. Stops at the shorter array.
   *
   * @example
   * ```ts
   * pipe([1, 2, 3], Arr.zip(["a", "b"])); // [[1, "a"], [2, "b"]]
   * ```
   */
  export const zip =
    <B>(other: readonly B[]) => <A>(data: readonly A[]): readonly (readonly [A, B])[] => {
      const len = Math.min(data.length, other.length);
      const result: [A, B][] = [];
      for (let i = 0; i < len; i++) {
        result.push([data[i], other[i]]);
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
      const result: C[] = [];
      for (let i = 0; i < len; i++) {
        result.push(f(data[i], other[i]));
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
  export const intersperse = <A>(sep: A) => (data: readonly A[]): readonly A[] => {
    if (data.length <= 1) return data;
    const result: A[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(sep, data[i]);
    }
    return result;
  };

  /**
   * Splits an array into chunks of the given size.
   *
   * @example
   * ```ts
   * pipe([1, 2, 3, 4, 5], Arr.chunksOf(2)); // [[1, 2], [3, 4], [5]]
   * ```
   */
  export const chunksOf = (n: number) => <A>(data: readonly A[]): readonly (readonly A[])[] => {
    if (n <= 0) return [];
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
  export const flatten = <A>(data: readonly (readonly A[])[]): readonly A[] =>
    ([] as A[]).concat(...data);

  /**
   * Maps each element to an array and flattens the result.
   *
   * @example
   * ```ts
   * pipe([1, 2, 3], Arr.flatMap(n => [n, n * 10])); // [1, 10, 2, 20, 3, 30]
   * ```
   */
  export const flatMap = <A, B>(f: (a: A) => readonly B[]) => (data: readonly A[]): readonly B[] =>
    ([] as B[]).concat(...data.map(f));

  /**
   * Reduces an array from the left.
   *
   * @example
   * ```ts
   * pipe([1, 2, 3], Arr.reduce(0, (acc, n) => acc + n)); // 6
   * ```
   */
  export const reduce = <A, B>(initial: B, f: (acc: B, a: A) => B) => (data: readonly A[]): B =>
    data.reduce(f, initial);

  // --- Traverse / Sequence ---

  /**
   * Maps each element to an Option and collects the results.
   * Returns None if any mapping returns None.
   *
   * @example
   * ```ts
   * const parseNum = (s: string): Option<number> => {
   *   const n = Number(s);
   *   return isNaN(n) ? Option.none() : Option.some(n);
   * };
   *
   * pipe(["1", "2", "3"], Arr.traverse(parseNum)); // Some([1, 2, 3])
   * pipe(["1", "x", "3"], Arr.traverse(parseNum)); // None
   * ```
   */
  export const traverse =
    <A, B>(f: (a: A) => Option<B>) => (data: readonly A[]): Option<readonly B[]> => {
      const result: B[] = [];
      for (const a of data) {
        const mapped = f(a);
        if (Option.isNone(mapped)) return Option.none();
        result.push(mapped.value);
      }
      return Option.some(result);
    };

  /**
   * Maps each element to a Result and collects the results.
   * Returns the first Err if any mapping fails.
   *
   * @example
   * ```ts
   * pipe(
   *   [1, 2, 3],
   *   Arr.traverseResult(n => n > 0 ? Result.ok(n) : Result.err("negative"))
   * ); // Ok([1, 2, 3])
   * ```
   */
  export const traverseResult =
    <E, A, B>(f: (a: A) => Result<E, B>) => (data: readonly A[]): Result<E, readonly B[]> => {
      const result: B[] = [];
      for (const a of data) {
        const mapped = f(a);
        if (Result.isErr(mapped)) return mapped;
        result.push(mapped.value);
      }
      return Result.ok(result);
    };

  /**
   * Maps each element to a Task and runs all in parallel.
   *
   * @example
   * ```ts
   * pipe(
   *   [1, 2, 3],
   *   Arr.traverseTask(n => Task.resolve(n * 2))
   * )(); // Promise<[2, 4, 6]>
   * ```
   */
  export const traverseTask =
    <A, B>(f: (a: A) => Task<B>) => (data: readonly A[]): Task<readonly B[]> =>
      Task.from(() => Promise.all(data.map((a) => Deferred.toPromise(f(a)()))));

  /**
   * Collects an array of Options into an Option of array.
   * Returns None if any element is None.
   *
   * @example
   * ```ts
   * Arr.sequence([Option.some(1), Option.some(2)]); // Some([1, 2])
   * Arr.sequence([Option.some(1), Option.none()]); // None
   * ```
   */
  export const sequence = <A>(
    data: readonly Option<A>[],
  ): Option<readonly A[]> => traverse<Option<A>, A>((a) => a)(data);

  /**
   * Collects an array of Results into a Result of array.
   * Returns the first Err if any element is Err.
   */
  export const sequenceResult = <E, A>(
    data: readonly Result<E, A>[],
  ): Result<E, readonly A[]> => traverseResult<E, Result<E, A>, A>((a) => a)(data);

  /**
   * Collects an array of Tasks into a Task of array. Runs in parallel.
   */
  export const sequenceTask = <A>(
    data: readonly Task<A>[],
  ): Task<readonly A[]> => traverseTask<Task<A>, A>((a) => a)(data);

  /**
   * Maps each element to a TaskResult and runs them sequentially.
   * Returns the first Err encountered, or Ok of all results if all succeed.
   *
   * @example
   * ```ts
   * const validate = (n: number): TaskResult<string, number> =>
   *   n > 0 ? TaskResult.ok(n) : TaskResult.err("non-positive");
   *
   * pipe(
   *   [1, 2, 3],
   *   Arr.traverseTaskResult(validate)
   * )(); // Deferred<Ok([1, 2, 3])>
   *
   * pipe(
   *   [1, -1, 3],
   *   Arr.traverseTaskResult(validate)
   * )(); // Deferred<Err("non-positive")>
   * ```
   */
  export const traverseTaskResult =
    <E, A, B>(f: (a: A) => Task<Result<E, B>>) =>
    (data: readonly A[]): Task<Result<E, readonly B[]>> =>
      Task.from(async () => {
        const result: B[] = [];
        for (const a of data) {
          const r = await Deferred.toPromise(f(a)());
          if (Result.isErr(r)) return r;
          result.push(r.value);
        }
        return Result.ok(result);
      });

  /**
   * Collects an array of TaskResults into a TaskResult of array.
   * Returns the first Err if any element is Err, runs sequentially.
   */
  export const sequenceTaskResult = <E, A>(
    data: readonly Task<Result<E, A>>[],
  ): Task<Result<E, readonly A[]>> =>
    traverseTaskResult<E, Task<Result<E, A>>, A>((a) => a)(data);

  /**
   * Returns true if the array is non-empty (type guard).
   */
  export const isNonEmpty = <A>(data: readonly A[]): data is NonEmptyList<A> =>
    isNonEmptyList(data);

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
  export const some = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): boolean =>
    data.some(predicate);

  /**
   * Returns true if all elements satisfy the predicate.
   *
   * @example
   * ```ts
   * pipe([1, 2, 3], Arr.every(n => n > 0)); // true
   * ```
   */
  export const every = <A>(predicate: (a: A) => boolean) => (data: readonly A[]): boolean =>
    data.every(predicate);

  /**
   * Reverses an array. Returns a new array.
   *
   * @example
   * ```ts
   * Arr.reverse([1, 2, 3]); // [3, 2, 1]
   * ```
   */
  export const reverse = <A>(data: readonly A[]): readonly A[] => [...data].reverse();

  /**
   * Takes the first n elements from an array.
   *
   * @example
   * ```ts
   * pipe([1, 2, 3, 4], Arr.take(2)); // [1, 2]
   * ```
   */
  export const take = (n: number) => <A>(data: readonly A[]): readonly A[] =>
    n <= 0 ? [] : data.slice(0, n);

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
  export const takeWhile =
    <A>(predicate: (a: A) => boolean) => (data: readonly A[]): readonly A[] => {
      const result: A[] = [];
      for (const a of data) {
        if (!predicate(a)) break;
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
  export const dropWhile =
    <A>(predicate: (a: A) => boolean) => (data: readonly A[]): readonly A[] => {
      let i = 0;
      while (i < data.length && predicate(data[i])) i++;
      return data.slice(i);
    };
}
