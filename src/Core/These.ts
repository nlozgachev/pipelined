import type { WithFirst, WithKind, WithSecond } from "#internal";

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
 *   if (isNaN(n)) return These.make.second("Not a number");
 *   if (s !== trimmed) return These.make.both(n, "Leading/trailing whitespace trimmed");
 *   return These.make.first(n);
 * };
 * ```
 */
export type These<A, B> = These.First<A> | These.Second<B> | These.Both<A, B>;

export namespace These {
	export type First<T> = WithKind<"First"> & WithFirst<T>;
	export type Second<T> = WithKind<"Second"> & WithSecond<T>;
	export type Both<A, B> = WithKind<"Both"> & WithFirst<A> & WithSecond<B>;
}

const makeFirst = <A>(value: A): These.First<A> => ({ kind: "First", first: value });
const makeSecond = <B>(value: B): These.Second<B> => ({ kind: "Second", second: value });
const makeBoth = <A, B>(first: A, second: B): These.Both<A, B> => ({ kind: "Both", first, second });

const isFirst = <A, B>(these: These<A, B>): these is These.First<A> => these.kind === "First";
const isSecond = <A, B>(these: These<A, B>): these is These.Second<B> => these.kind === "Second";
const isBoth = <A, B>(these: These<A, B>): these is These.Both<A, B> => these.kind === "Both";

const hasFirst = <A, B>(these: These<A, B>): these is These.First<A> | These.Both<A, B> =>
	these.kind === "First" || these.kind === "Both";

const hasSecond = <A, B>(these: These<A, B>): these is These.Second<B> | These.Both<A, B> =>
	these.kind === "Second" || these.kind === "Both";

export const These = {
	make: {
		/**
		 * Creates a These holding only a first value.
		 *
		 * @example
		 * ```ts
		 * These.make.first(42); // { kind: "First", first: 42 }
		 * ```
		 */
		first: makeFirst,

		/**
		 * Creates a These holding only a second value.
		 *
		 * @example
		 * ```ts
		 * These.make.second("warning"); // { kind: "Second", second: "warning" }
		 * ```
		 */
		second: makeSecond,

		/**
		 * Creates a These holding both a first and a second value simultaneously.
		 *
		 * @example
		 * ```ts
		 * These.make.both(42, "Deprecated API used"); // { kind: "Both", first: 42, second: "Deprecated API used" }
		 * ```
		 */
		both: makeBoth,
	},

	is: {
		/**
		 * Type guard — checks if a These holds only a first value.
		 *
		 * @example
		 * ```ts
		 * const val = These.make.first(42);
		 * if (These.is.first(val)) {
		 *   console.log(val.first); // 42
		 * }
		 * ```
		 */
		first: isFirst,

		/**
		 * Type guard — checks if a These holds only a second value.
		 *
		 * @example
		 * ```ts
		 * const val = These.make.second("warning");
		 * if (These.is.second(val)) {
		 *   console.log(val.second); // "warning"
		 * }
		 * ```
		 */
		second: isSecond,

		/**
		 * Type guard — checks if a These holds both values simultaneously.
		 *
		 * @example
		 * ```ts
		 * const val = These.make.both(42, "warning");
		 * if (These.is.both(val)) {
		 *   console.log(val.first, val.second); // 42 "warning"
		 * }
		 * ```
		 */
		both: isBoth,
	},

	/**
	 * Returns true if the These contains a first value (First or Both).
	 *
	 * @see {@link These.hasSecond} to check if These contains a second value.
	 *
	 * @example
	 * ```ts
	 * These.hasFirst(These.make.first(42));       // true
	 * These.hasFirst(These.make.both(42, "warn"));// true
	 * These.hasFirst(These.make.second("warn"));  // false
	 * ```
	 */
	hasFirst,

	/**
	 * Returns true if the These contains a second value (Second or Both).
	 *
	 * @see {@link These.hasFirst} to check if These contains a first value.
	 *
	 * @example
	 * ```ts
	 * These.hasSecond(These.make.second("warn"));  // true
	 * These.hasSecond(These.make.both(42, "warn"));// true
	 * These.hasSecond(These.make.first(42));       // false
	 * ```
	 */
	hasSecond,

	/**
	 * Transforms the first value, leaving the second unchanged.
	 *
	 * @see {@link These.mapSecond} to transform the second element.
	 * @see {@link These.mapBoth} to transform both elements.
	 *
	 * @example
	 * ```ts
	 * pipe(These.make.first(5), These.mapFirst(n => n * 2));           // First(10)
	 * pipe(These.make.both(5, "warn"), These.mapFirst(n => n * 2));    // Both(10, "warn")
	 * pipe(These.make.second("warn"), These.mapFirst(n => n * 2));     // Second("warn")
	 * ```
	 */
	mapFirst: <A, C>(transform: (first: A) => C) => <B>(these: These<A, B>): These<C, B> => {
		if (isSecond(these)) { return these; }
		if (isFirst(these)) { return makeFirst(transform(these.first)); }
		return makeBoth(transform(these.first), these.second);
	},

	/**
	 * Transforms the second value, leaving the first unchanged.
	 *
	 * @see {@link These.mapFirst} to transform the first element.
	 * @see {@link These.mapBoth} to transform both elements.
	 *
	 * @example
	 * ```ts
	 * pipe(These.make.second("warn"), These.mapSecond(e => e.toUpperCase()));     // Second("WARN")
	 * pipe(These.make.both(5, "warn"), These.mapSecond(e => e.toUpperCase()));    // Both(5, "WARN")
	 * ```
	 */
	mapSecond: <B, D>(transform: (second: B) => D) => <A>(these: These<A, B>): These<A, D> => {
		if (isFirst(these)) { return these; }
		if (isSecond(these)) { return makeSecond(transform(these.second)); }
		return makeBoth(these.first, transform(these.second));
	},

	/**
	 * Transforms both the first and second values independently.
	 *
	 * @see {@link These.mapFirst} to transform only the first element.
	 * @see {@link These.mapSecond} to transform only the second element.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   These.make.both(5, "warn"),
	 *   These.mapBoth(n => n * 2, e => e.toUpperCase())
	 * ); // Both(10, "WARN")
	 * ```
	 */
	mapBoth: <A, C, B, D>(onFirst: (first: A) => C, onSecond: (second: B) => D) => (these: These<A, B>): These<C, D> => {
		if (isSecond(these)) { return makeSecond(onSecond(these.second)); }
		if (isFirst(these)) { return makeFirst(onFirst(these.first)); }
		return makeBoth(onFirst(these.first), onSecond(these.second));
	},

	/**
	 * Chains These computations by passing the first value to transform.
	 * Second propagates unchanged; First and Both apply transform to the first value.
	 *
	 * @see {@link These.chainSecond} to chain based on the second value.
	 *
	 * @example
	 * ```ts
	 * const double = (n: number): These<number, string> => These.make.first(n * 2);
	 *
	 * pipe(These.make.first(5), These.chainFirst(double));            // First(10)
	 * pipe(These.make.both(5, "warn"), These.chainFirst(double));     // First(10)
	 * pipe(These.make.second("warn"), These.chainFirst(double));      // Second("warn")
	 * ```
	 */
	chainFirst: <A, B, C>(transform: (first: A) => These<C, B>) => (these: These<A, B>): These<C, B> => {
		if (isSecond(these)) { return these; }
		return transform(these.first);
	},

	/**
	 * Chains These computations by passing the second value to transform.
	 * First propagates unchanged; Second and Both apply transform to the second value.
	 *
	 * @see {@link These.chainFirst} to chain based on the first value.
	 *
	 * @example
	 * ```ts
	 * const shout = (s: string): These<number, string> => These.make.second(s.toUpperCase());
	 *
	 * pipe(These.make.second("warn"), These.chainSecond(shout));      // Second("WARN")
	 * pipe(These.make.both(5, "warn"), These.chainSecond(shout));     // Second("WARN")
	 * pipe(These.make.first(5), These.chainSecond(shout));            // First(5)
	 * ```
	 */
	chainSecond: <A, B, D>(transform: (second: B) => These<A, D>) => (these: These<A, B>): These<A, D> => {
		if (isFirst(these)) { return these; }
		return transform(these.second);
	},

	/**
	 * Extracts a value from a These by providing handlers for all three cases.
	 *
	 * @see {@link These.match} for named-case pattern matching with an object literal.
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
	fold:
		<A, B, C>(onFirst: (first: A) => C, onSecond: (second: B) => C, onBoth: (first: A, second: B) => C) =>
		(these: These<A, B>): C => {
			if (isSecond(these)) { return onSecond(these.second); }
			if (isFirst(these)) { return onFirst(these.first); }
			return onBoth(these.first, these.second);
		},

	/**
	 * Pattern matches on a These, returning the result of the matching case.
	 *
	 * @see {@link These.fold} for positional argument pattern matching.
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
	match:
		<A, B, C>(cases: { first: (first: A) => C; second: (second: B) => C; both: (first: A, second: B) => C; }) =>
		(these: These<A, B>): C => {
			if (isSecond(these)) { return cases.second(these.second); }
			if (isFirst(these)) { return cases.first(these.first); }
			return cases.both(these.first, these.second);
		},

	/**
	 * Returns the first value, or a default if the These has no first value.
	 * The default can be a different type, widening the result to `A | C`.
	 *
	 * @see {@link These.getSecondOrElse} to retrieve the second value with fallback.
	 *
	 * @example
	 * ```ts
	 * pipe(These.make.first(5), These.getFirstOrElse(() => 0));            // 5
	 * pipe(These.make.both(5, "warn"), These.getFirstOrElse(() => 0));     // 5
	 * pipe(These.make.second("warn"), These.getFirstOrElse(() => 0));      // 0
	 * pipe(These.make.second("warn"), These.getFirstOrElse(() => null));   // null — typed as number | null
	 * ```
	 */
	getFirstOrElse: <A, C>(fallback: () => C) => <B>(these: These<A, B>): A | C =>
		hasFirst(these) ? these.first : fallback(),

	/**
	 * Returns the second value, or a default if the These has no second value.
	 * The default can be a different type, widening the result to `B | D`.
	 *
	 * @see {@link These.getFirstOrElse} to retrieve the first value with fallback.
	 *
	 * @example
	 * ```ts
	 * pipe(These.make.second("warn"), These.getSecondOrElse(() => "none")); // "warn"
	 * pipe(These.make.both(5, "warn"), These.getSecondOrElse(() => "none")); // "warn"
	 * pipe(These.make.first(5), These.getSecondOrElse(() => "none"));       // "none"
	 * pipe(These.make.first(5), These.getSecondOrElse(() => null));         // null — typed as string | null
	 * ```
	 */
	getSecondOrElse: <B, D>(fallback: () => D) => <A>(these: These<A, B>): B | D =>
		hasSecond(these) ? these.second : fallback(),

	/**
	 * Runs a side effect on the first value without changing the These.
	 * Useful for logging or debugging.
	 *
	 * @example
	 * ```ts
	 * pipe(These.make.first(5), These.tap(console.log)); // logs 5, returns First(5)
	 * ```
	 */
	tap: <A>(sideEffect: (first: A) => void) => <B>(these: These<A, B>): These<A, B> => {
		if (hasFirst(these)) { sideEffect(these.first); }
		return these;
	},

	/**
	 * Swaps the roles of first and second values.
	 * - First(a)    → Second(a)
	 * - Second(b)   → First(b)
	 * - Both(a, b)  → Both(b, a)
	 *
	 * @example
	 * ```ts
	 * These.swap(These.make.first(5));            // Second(5)
	 * These.swap(These.make.second("warn"));      // First("warn")
	 * These.swap(These.make.both(5, "warn"));     // Both("warn", 5)
	 * ```
	 */
	swap: <A, B>(these: These<A, B>): These<B, A> => {
		if (isSecond(these)) { return makeFirst(these.second); }
		if (isFirst(these)) { return makeSecond(these.first); }
		return makeBoth(these.second, these.first);
	},
};
