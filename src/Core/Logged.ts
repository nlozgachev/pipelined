import { WithLog, WithValue } from "./InternalTypes.ts";

/**
 * A value paired with an accumulated log.
 *
 * `Logged<W, A>` pairs a result `A` with a sequence of log entries `W`. When
 * you sequence two `Logged` computations with `chain`, the logs are
 * automatically concatenated — you never have to thread the log array through
 * your code manually.
 *
 * @example
 * ```ts
 * const program = pipe(
 *   Logged.make<string, number>(0),
 *   Logged.chain(n => pipe(
 *     Logged.tell("start"),
 *     Logged.map(() => n + 1),
 *   )),
 *   Logged.chain(n => pipe(
 *     Logged.tell("done"),
 *     Logged.map(() => n * 10),
 *   )),
 * );
 *
 * Logged.run(program); // [10, ["start", "done"]]
 * ```
 */
export type Logged<L, A> = WithValue<A> & WithLog<L>;

export namespace Logged {
  /**
   * Wraps a pure value into a `Logged` with an empty log.
   *
   * @example
   * ```ts
   * Logged.make<string, number>(42); // { value: 42, log: [] }
   * ```
   */
  export const make = <W, A>(value: A): Logged<W, A> => ({ value, log: [] });

  /**
   * Creates a `Logged` that records a single log entry and produces no
   * meaningful value. Use this to append to the log inside a `chain`.
   *
   * @example
   * ```ts
   * Logged.tell("operation completed"); // { value: undefined, log: ["operation completed"] }
   * ```
   */
  export const tell = <W>(entry: W): Logged<W, undefined> => ({ value: undefined, log: [entry] });

  /**
   * Transforms the value inside a `Logged` without affecting the log.
   *
   * @example
   * ```ts
   * pipe(
   *   Logged.of<string, number>(5),
   *   Logged.map(n => n * 2),
   * ); // { value: 10, log: [] }
   * ```
   */
  export const map = <W, A, B>(f: (a: A) => B) => (data: Logged<W, A>): Logged<W, B> => ({
    value: f(data.value),
    log: data.log,
  });

  /**
   * Sequences two `Logged` computations, concatenating their logs.
   * The value from the first is passed to `f`; the resulting log entries are
   * appended after the entries from the first.
   *
   * Data-last — the first computation is the data being piped.
   *
   * @example
   * ```ts
   * const result = pipe(
   *   Logged.of<string, number>(1),
   *   Logged.chain(n => pipe(Logged.tell("step"), Logged.map(() => n + 1))),
   *   Logged.chain(n => pipe(Logged.tell("done"), Logged.map(() => n * 10))),
   * );
   *
   * Logged.run(result); // [20, ["step", "done"]]
   * ```
   */
  export const chain =
    <W, A, B>(f: (a: A) => Logged<W, B>) => (data: Logged<W, A>): Logged<W, B> => {
      const next = f(data.value);
      return { value: next.value, log: [...data.log, ...next.log] };
    };

  /**
   * Applies a function wrapped in a `Logged` to a value wrapped in a `Logged`,
   * concatenating both logs.
   *
   * @example
   * ```ts
   * const fn: Logged<string, (n: number) => number> = {
   *   value: n => n * 2,
   *   log: ["fn-loaded"],
   * };
   * const arg: Logged<string, number> = { value: 5, log: ["arg-loaded"] };
   *
   * const result = pipe(fn, Logged.ap(arg));
   * Logged.run(result); // [10, ["fn-loaded", "arg-loaded"]]
   * ```
   */
  export const ap =
    <W, A>(arg: Logged<W, A>) => <B>(data: Logged<W, (a: A) => B>): Logged<W, B> => ({
      value: data.value(arg.value),
      log: [...data.log, ...arg.log],
    });

  /**
   * Runs a side effect on the value without changing the `Logged`.
   * Useful for debugging or inspecting intermediate values.
   *
   * @example
   * ```ts
   * pipe(
   *   Logged.of<string, number>(42),
   *   Logged.tap(n => console.log("value:", n)),
   * );
   * ```
   */
  export const tap = <W, A>(f: (a: A) => void) => (data: Logged<W, A>): Logged<W, A> => {
    f(data.value);
    return data;
  };

  /**
   * Extracts the value and log as a `readonly [A, ReadonlyArray<W>]` tuple.
   * Use this at the boundary where you need to consume both.
   *
   * @example
   * ```ts
   * const result = pipe(
   *   Logged.of<string, number>(1),
   *   Logged.chain(n => pipe(Logged.tell("incremented"), Logged.map(() => n + 1))),
   * );
   *
   * const [value, log] = Logged.run(result);
   * // value = 2, log = ["incremented"]
   * ```
   */
  export const run = <W, A>(
    data: Logged<W, A>,
  ): readonly [A, ReadonlyArray<W>] => [data.value, data.log];
}
