/**
 * Executes a side effect function and returns the original value unchanged.
 * Useful for logging, debugging, or other side effects within a pipeline.
 *
 * @example
 * ```ts
 * // Debugging a pipeline
 * pipe(
 *   Option.some(5),
 *   tap(x => console.log("Before map:", x)),
 *   Option.map(n => n * 2),
 *   tap(x => console.log("After map:", x)),
 *   Option.getOrElse(0)
 * );
 * // logs: "Before map: { kind: 'Some', value: 5 }"
 * // logs: "After map: { kind: 'Some', value: 10 }"
 * // returns: 10
 *
 * // Collecting intermediate values
 * const values: number[] = [];
 * pipe(
 *   [1, 2, 3],
 *   arr => arr.map(n => n * 2),
 *   tap(arr => values.push(...arr))
 * );
 * ```
 *
 * @see {@link Option.tap} for Option-specific tap that only runs on Some
 */
export const tap = <A>(f: (a: A) => void) => (a: A): A => {
	f(a);
	return a;
};
