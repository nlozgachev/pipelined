/**
 * Applies an input to an array of functions and collects the results into a tuple.
 *
 * @example
 * ```ts
 * const nameParts = juxt([
 *   (name: string) => name.split(" ")[0],
 *   (name: string) => name.split(" ").slice(1).join(" "),
 * ]);
 *
 * nameParts("Alice Smith"); // ["Alice", "Smith"]
 * ```
 */
export function juxt<A, B, C>(fns: [(a: A) => B, (a: A) => C]): (a: A) => [B, C];
export function juxt<A, B, C, D>(
  fns: [(a: A) => B, (a: A) => C, (a: A) => D],
): (a: A) => [B, C, D];
export function juxt<A, B, C, D, E>(
  fns: [(a: A) => B, (a: A) => C, (a: A) => D, (a: A) => E],
): (a: A) => [B, C, D, E];
export function juxt<A, B>(fns: ReadonlyArray<(a: A) => B>): (a: A) => B[];
export function juxt<A>(fns: ReadonlyArray<(a: A) => unknown>): (a: A) => unknown[] {
  return (a: A) => fns.map((f) => f(a));
}
