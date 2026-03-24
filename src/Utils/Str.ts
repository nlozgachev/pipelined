import { Maybe } from "#core/Maybe.ts";

/**
 * String utilities. All transformation functions are data-last and curried so they
 * compose naturally with `pipe`. Safe parsers return `Maybe` instead of `NaN`.
 *
 * @example
 * ```ts
 * import { Str } from "@nlozgachev/pipelined/utils";
 * import { pipe } from "@nlozgachev/pipelined/composition";
 *
 * pipe("  Hello, World!  ", Str.trim, Str.toLowerCase); // "hello, world!"
 * ```
 */
export namespace Str {
	/**
	 * Splits a string by a separator. Data-last: use in `pipe`.
	 *
	 * @example
	 * ```ts
	 * pipe("a,b,c", Str.split(",")); // ["a", "b", "c"]
	 * ```
	 */
	export const split = (separator: string | RegExp) => (s: string): readonly string[] => s.split(separator);

	/**
	 * Removes leading and trailing whitespace from a string.
	 *
	 * @example
	 * ```ts
	 * pipe("  hello  ", Str.trim); // "hello"
	 * ```
	 */
	export const trim = (s: string): string => s.trim();

	/**
	 * Returns `true` when the string contains the given substring.
	 *
	 * @example
	 * ```ts
	 * pipe("hello world", Str.includes("world")); // true
	 * pipe("hello world", Str.includes("xyz"));   // false
	 * ```
	 */
	export const includes = (substring: string) => (s: string): boolean => s.includes(substring);

	/**
	 * Returns `true` when the string starts with the given prefix.
	 *
	 * @example
	 * ```ts
	 * pipe("hello world", Str.startsWith("hello")); // true
	 * pipe("hello world", Str.startsWith("world")); // false
	 * ```
	 */
	export const startsWith = (prefix: string) => (s: string): boolean => s.startsWith(prefix);

	/**
	 * Returns `true` when the string ends with the given suffix.
	 *
	 * @example
	 * ```ts
	 * pipe("hello world", Str.endsWith("world")); // true
	 * pipe("hello world", Str.endsWith("hello")); // false
	 * ```
	 */
	export const endsWith = (suffix: string) => (s: string): boolean => s.endsWith(suffix);

	/**
	 * Converts a string to uppercase.
	 *
	 * @example
	 * ```ts
	 * pipe("hello", Str.toUpperCase); // "HELLO"
	 * ```
	 */
	export const toUpperCase = (s: string): string => s.toUpperCase();

	/**
	 * Converts a string to lowercase.
	 *
	 * @example
	 * ```ts
	 * pipe("HELLO", Str.toLowerCase); // "hello"
	 * ```
	 */
	export const toLowerCase = (s: string): string => s.toLowerCase();

	/**
	 * Splits a string into lines, normalising `\r\n` and `\r` line endings.
	 *
	 * @example
	 * ```ts
	 * Str.lines("one\ntwo\nthree"); // ["one", "two", "three"]
	 * Str.lines("a\r\nb");         // ["a", "b"]
	 * ```
	 */
	export const lines = (s: string): readonly string[] => s.split(/\r?\n|\r/);

	/**
	 * Splits a string into words on any whitespace boundary, filtering out empty strings.
	 *
	 * @example
	 * ```ts
	 * Str.words("  hello   world  "); // ["hello", "world"]
	 * ```
	 */
	export const words = (s: string): readonly string[] => s.trim().split(/\s+/).filter(Boolean);

	/**
	 * Safe number parsers that return `Maybe` instead of `NaN`.
	 */
	export const parse = {
		/**
		 * Parses a string as an integer (base 10). Returns `None` if the result is `NaN`.
		 *
		 * @example
		 * ```ts
		 * Str.parse.int("42");   // Some(42)
		 * Str.parse.int("3.7");  // Some(3)
		 * Str.parse.int("abc");  // None
		 * ```
		 */
		int: (s: string): Maybe<number> => {
			const n = parseInt(s, 10);
			return isNaN(n) ? Maybe.none() : Maybe.some(n);
		},

		/**
		 * Parses a string as a floating-point number. Returns `None` if the result is `NaN`.
		 *
		 * @example
		 * ```ts
		 * Str.parse.float("3.14"); // Some(3.14)
		 * Str.parse.float("42");   // Some(42)
		 * Str.parse.float("abc");  // None
		 * ```
		 */
		float: (s: string): Maybe<number> => {
			const n = parseFloat(s);
			return isNaN(n) ? Maybe.none() : Maybe.some(n);
		},
	};
}
