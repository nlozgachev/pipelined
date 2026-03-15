import { WithFirst, WithKind, WithSecond } from "./InternalTypes.ts";

/**
 * These<A, B> is an inclusive-OR type: it holds a first value (A), a second
 * value (B), or both simultaneously. Neither side carries a success/failure
 * connotation — it is a neutral pair where any combination is valid.
 *
 * - First(a)     — only a first value
 * - Second(b)    — only a second value
 * - Both(a, b)   — first and second values simultaneously
 *
 * A common use: lenient parsers or processors that carry a diagnostic note
 * alongside a result, without losing either piece of information.
 *
 * @example
 * ```ts
 * const parse = (s: string): These<number, string> => {
 *   const trimmed = s.trim();
 *   const n = parseFloat(trimmed);
 *   if (isNaN(n)) return These.second("Not a number");
 *   if (s !== trimmed) return These.both(n, "Leading/trailing whitespace trimmed");
 *   return These.first(n);
 * };
 * ```
 */
export type These<A, B> = TheseFirst<A> | TheseSecond<B> | TheseBoth<A, B>;

export type TheseFirst<T> = WithKind<"First"> & WithFirst<T>;
export type TheseSecond<T> = WithKind<"Second"> & WithSecond<T>;
export type TheseBoth<First, Second> = WithKind<"Both"> & WithFirst<First> & WithSecond<Second>;

export namespace These {
  /**
   * Creates a These holding only a first value.
   *
   * @example
   * ```ts
   * These.first(42); // { kind: "First", first: 42 }
   * ```
   */
  export const first = <A>(value: A): TheseFirst<A> => ({ kind: "First", first: value });

  /**
   * Creates a These holding only a second value.
   *
   * @example
   * ```ts
   * These.second("warning"); // { kind: "Second", second: "warning" }
   * ```
   */
  export const second = <B>(value: B): TheseSecond<B> => ({ kind: "Second", second: value });

  /**
   * Creates a These holding both a first and a second value simultaneously.
   *
   * @example
   * ```ts
   * These.both(42, "Deprecated API used"); // { kind: "Both", first: 42, second: "Deprecated API used" }
   * ```
   */
  export const both = <A, B>(first: A, second: B): TheseBoth<A, B> => ({
    kind: "Both",
    first,
    second,
  });

  /**
   * Type guard — checks if a These holds only a first value.
   */
  export const isFirst = <A, B>(data: These<A, B>): data is TheseFirst<A> => data.kind === "First";

  /**
   * Type guard — checks if a These holds only a second value.
   */
  export const isSecond = <A, B>(data: These<A, B>): data is TheseSecond<B> =>
    data.kind === "Second";

  /**
   * Type guard — checks if a These holds both values simultaneously.
   */
  export const isBoth = <A, B>(data: These<A, B>): data is TheseBoth<A, B> => data.kind === "Both";

  /**
   * Returns true if the These contains a first value (First or Both).
   */
  export const hasFirst = <A, B>(
    data: These<A, B>,
  ): data is TheseFirst<A> | TheseBoth<A, B> => data.kind === "First" || data.kind === "Both";

  /**
   * Returns true if the These contains a second value (Second or Both).
   */
  export const hasSecond = <A, B>(
    data: These<A, B>,
  ): data is TheseSecond<B> | TheseBoth<A, B> => data.kind === "Second" || data.kind === "Both";

  /**
   * Transforms the first value, leaving the second unchanged.
   *
   * @example
   * ```ts
   * pipe(These.first(5), These.mapFirst(n => n * 2));           // First(10)
   * pipe(These.both(5, "warn"), These.mapFirst(n => n * 2));    // Both(10, "warn")
   * pipe(These.second("warn"), These.mapFirst(n => n * 2));     // Second("warn")
   * ```
   */
  export const mapFirst = <A, C>(f: (a: A) => C) => <B>(data: These<A, B>): These<C, B> => {
    if (isSecond(data)) return data;
    if (isFirst(data)) return first(f(data.first));
    return both(f(data.first), data.second);
  };

  /**
   * Transforms the second value, leaving the first unchanged.
   *
   * @example
   * ```ts
   * pipe(These.second("warn"), These.mapSecond(e => e.toUpperCase()));     // Second("WARN")
   * pipe(These.both(5, "warn"), These.mapSecond(e => e.toUpperCase()));    // Both(5, "WARN")
   * ```
   */
  export const mapSecond = <B, D>(f: (b: B) => D) => <A>(data: These<A, B>): These<A, D> => {
    if (isFirst(data)) return data;
    if (isSecond(data)) return second(f(data.second));
    return both(data.first, f(data.second));
  };

  /**
   * Transforms both the first and second values independently.
   *
   * @example
   * ```ts
   * pipe(
   *   These.both(5, "warn"),
   *   These.mapBoth(n => n * 2, e => e.toUpperCase())
   * ); // Both(10, "WARN")
   * ```
   */
  export const mapBoth = <A, C, B, D>(onFirst: (a: A) => C, onSecond: (b: B) => D) =>
  (
    data: These<A, B>,
  ): These<C, D> => {
    if (isSecond(data)) return second(onSecond(data.second));
    if (isFirst(data)) return first(onFirst(data.first));
    return both(onFirst(data.first), onSecond(data.second));
  };

  /**
   * Chains These computations by passing the first value to f.
   * Second propagates unchanged; First and Both apply f to the first value.
   *
   * @example
   * ```ts
   * const double = (n: number): These<number, string> => These.first(n * 2);
   *
   * pipe(These.first(5), These.chainFirst(double));            // First(10)
   * pipe(These.both(5, "warn"), These.chainFirst(double));     // First(10)
   * pipe(These.second("warn"), These.chainFirst(double));      // Second("warn")
   * ```
   */
  export const chainFirst =
    <A, B, C>(f: (a: A) => These<C, B>) => (data: These<A, B>): These<C, B> => {
      if (isSecond(data)) return data;
      return f(data.first);
    };

  /**
   * Chains These computations by passing the second value to f.
   * First propagates unchanged; Second and Both apply f to the second value.
   *
   * @example
   * ```ts
   * const shout = (s: string): These<number, string> => These.second(s.toUpperCase());
   *
   * pipe(These.second("warn"), These.chainSecond(shout));      // Second("WARN")
   * pipe(These.both(5, "warn"), These.chainSecond(shout));     // Second("WARN")
   * pipe(These.first(5), These.chainSecond(shout));            // First(5)
   * ```
   */
  export const chainSecond =
    <A, B, D>(f: (b: B) => These<A, D>) => (data: These<A, B>): These<A, D> => {
      if (isFirst(data)) return data;
      return f(data.second);
    };

  /**
   * Extracts a value from a These by providing handlers for all three cases.
   *
   * @example
   * ```ts
   * pipe(
   *   these,
   *   These.fold(
   *     a => `First: ${a}`,
   *     b => `Second: ${b}`,
   *     (a, b) => `Both: ${a} / ${b}`
   *   )
   * );
   * ```
   */
  export const fold = <A, B, C>(
    onFirst: (a: A) => C,
    onSecond: (b: B) => C,
    onBoth: (a: A, b: B) => C,
  ) =>
  (data: These<A, B>): C => {
    if (isSecond(data)) return onSecond(data.second);
    if (isFirst(data)) return onFirst(data.first);
    return onBoth(data.first, data.second);
  };

  /**
   * Pattern matches on a These, returning the result of the matching case.
   *
   * @example
   * ```ts
   * pipe(
   *   these,
   *   These.match({
   *     first: a => `First: ${a}`,
   *     second: b => `Second: ${b}`,
   *     both: (a, b) => `Both: ${a} / ${b}`
   *   })
   * );
   * ```
   */
  export const match = <A, B, C>(cases: {
    first: (a: A) => C;
    second: (b: B) => C;
    both: (a: A, b: B) => C;
  }) =>
  (data: These<A, B>): C => {
    if (isSecond(data)) return cases.second(data.second);
    if (isFirst(data)) return cases.first(data.first);
    return cases.both(data.first, data.second);
  };

  /**
   * Returns the first value, or a default if the These has no first value.
   * The default can be a different type, widening the result to `A | C`.
   *
   * @example
   * ```ts
   * pipe(These.first(5), These.getFirstOrElse(0));            // 5
   * pipe(These.both(5, "warn"), These.getFirstOrElse(0));     // 5
   * pipe(These.second("warn"), These.getFirstOrElse(0));      // 0
   * pipe(These.second("warn"), These.getFirstOrElse(null));   // null — typed as number | null
   * ```
   */
  export const getFirstOrElse = <A, C>(defaultValue: C) => <B>(data: These<A, B>): A | C =>
    hasFirst(data) ? data.first : defaultValue;

  /**
   * Returns the second value, or a default if the These has no second value.
   * The default can be a different type, widening the result to `B | D`.
   *
   * @example
   * ```ts
   * pipe(These.second("warn"), These.getSecondOrElse("none")); // "warn"
   * pipe(These.both(5, "warn"), These.getSecondOrElse("none")); // "warn"
   * pipe(These.first(5), These.getSecondOrElse("none"));       // "none"
   * pipe(These.first(5), These.getSecondOrElse(null));         // null — typed as string | null
   * ```
   */
  export const getSecondOrElse = <B, D>(defaultValue: D) => <A>(data: These<A, B>): B | D =>
    hasSecond(data) ? data.second : defaultValue;

  /**
   * Executes a side effect on the first value without changing the These.
   * Useful for logging or debugging.
   *
   * @example
   * ```ts
   * pipe(These.first(5), These.tap(console.log)); // logs 5, returns First(5)
   * ```
   */
  export const tap = <A>(f: (a: A) => void) => <B>(data: These<A, B>): These<A, B> => {
    if (hasFirst(data)) f(data.first);
    return data;
  };

  /**
   * Swaps the roles of first and second values.
   * - First(a)    → Second(a)
   * - Second(b)   → First(b)
   * - Both(a, b)  → Both(b, a)
   *
   * @example
   * ```ts
   * These.swap(These.first(5));            // Second(5)
   * These.swap(These.second("warn"));      // First("warn")
   * These.swap(These.both(5, "warn"));     // Both("warn", 5)
   * ```
   */
  export const swap = <A, B>(data: These<A, B>): These<B, A> => {
    if (isSecond(data)) return first(data.second);
    if (isFirst(data)) return second(data.first);
    return both(data.second, data.first);
  };
}
