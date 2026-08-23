// =============================================================================
// Imports
// =============================================================================
import { Maybe, Result } from "#core";
import { type NonEmpty as InternalNonEmpty } from "#internal";
import type { Brand } from "#types";

// =============================================================================
// Types
// =============================================================================
/**
 * A branded type representing a string with at least one character.
 */
export type NonEmptyString = Brand<InternalNonEmpty<"Str">, string>;

// =============================================================================
// Private Helpers & NonEmpty Constructors
// =============================================================================
const StrNonEmptyConst = {
	// --- from ---
	from: {
		/**
		 * Returns Some containing NonEmptyString if the string is not empty, None otherwise.
		 *
		 * @example
		 * ```ts
		 * Str.NonEmpty.from.String("hello"); // Some("hello")
		 * Str.NonEmpty.from.String("");      // None
		 * ```
		 */
		String: (
			s: string,
		): Maybe<NonEmptyString> => (s.length > 0 ? Maybe.make.some(s as NonEmptyString) : Maybe.make.none()),
	},
};

const isEmpty = (s: string): boolean => s.length === 0;
const isNonEmpty = (s: string): s is NonEmptyString => s.length > 0;

// =============================================================================
// Public Export
// =============================================================================
export const Str = {
	is: {
		/**
		 * Returns `true` when the string is empty.
		 *
		 * @example
		 * ```ts
		 * pipe("", Str.is.empty);   // true
		 * pipe("hi", Str.is.empty); // false
		 * ```
		 */
		empty: isEmpty,

		/**
		 * Type guard to check if a string is non-empty.
		 */
		nonEmpty: isNonEmpty,
	},

	/**
	 * Splits a string by a separator. Data-last: use in `pipe`.
	 *
	 * @example
	 * ```ts
	 * pipe("a,b,c", Str.split(",")); // ["a", "b", "c"]
	 * ```
	 */
	split: (separator: string | RegExp) => (s: string): readonly string[] => s.split(separator),

	/**
	 * Removes leading and trailing whitespace from a string.
	 *
	 * @example
	 * ```ts
	 * pipe("  hello  ", Str.trim); // "hello"
	 * ```
	 */
	trim: (s: string): string => s.trim(),

	/**
	 * Returns `true` when the string contains the given substring.
	 *
	 * @example
	 * ```ts
	 * pipe("hello world", Str.includes("world")); // true
	 * pipe("hello world", Str.includes("xyz"));   // false
	 * ```
	 */
	includes: (substring: string) => (s: string): boolean => s.includes(substring),

	/**
	 * Replaces the first occurrence of a pattern in a string. Data-last: use in `pipe`.
	 *
	 * @example
	 * ```ts
	 * pipe("foo foo foo", Str.replace("foo", "bar")); // "bar foo foo"
	 * pipe("Hello World", Str.replace(/world/i, "Earth")); // "Hello Earth"
	 * ```
	 */
	replace: (pattern: string | RegExp, replacement: string) => (s: string): string => s.replace(pattern, replacement),

	/**
	 * Replaces all occurrences of a pattern in a string. Data-last: use in `pipe`.
	 *
	 * @example
	 * ```ts
	 * pipe("foo foo foo", Str.replaceAll("foo", "bar")); // "bar bar bar"
	 * pipe("aAbBaA", Str.replaceAll(/a/gi, "x")); // "xxBBxx"
	 * ```
	 */
	replaceAll: (pattern: string | RegExp, replacement: string) => (s: string): string =>
		s.replaceAll(pattern, replacement),

	/**
	 * Returns `true` when the string starts with the given prefix.
	 *
	 * @example
	 * ```ts
	 * pipe("hello world", Str.startsWith("hello")); // true
	 * pipe("hello world", Str.startsWith("world")); // false
	 * ```
	 */
	startsWith: (prefix: string) => (s: string): boolean => s.startsWith(prefix),

	/**
	 * Returns `true` when the string ends with the given suffix.
	 *
	 * @example
	 * ```ts
	 * pipe("hello world", Str.endsWith("world")); // true
	 * pipe("hello world", Str.endsWith("hello")); // false
	 * ```
	 */
	endsWith: (suffix: string) => (s: string): boolean => s.endsWith(suffix),

	/**
	 * Converts a string to uppercase.
	 *
	 * @example
	 * ```ts
	 * pipe("hello", Str.toUpperCase); // "HELLO"
	 * ```
	 */
	toUpperCase: (s: string): string => s.toUpperCase(),

	/**
	 * Converts a string to lowercase.
	 *
	 * @example
	 * ```ts
	 * pipe("HELLO", Str.toLowerCase); // "hello"
	 * ```
	 */
	toLowerCase: (s: string): string => s.toLowerCase(),

	/**
	 * Converts the first character of a string to uppercase.
	 *
	 * @example
	 * ```ts
	 * pipe("hello", Str.capitalize); // "Hello"
	 * ```
	 */
	capitalize: (s: string): string => s.length === 0 ? "" : s.charAt(0).toUpperCase() + s.slice(1),

	/**
	 * Splits a string into lines, normalising `\r\n` and `\r` line endings.
	 *
	 * @example
	 * ```ts
	 * Str.lines("one\ntwo\nthree"); // ["one", "two", "three"]
	 * Str.lines("a\r\nb");         // ["a", "b"]
	 * ```
	 */
	lines: (s: string): readonly string[] => s.split(/\r?\n|\r/),

	/**
	 * Splits a string into words on any whitespace boundary, filtering out empty strings.
	 *
	 * @example
	 * ```ts
	 * Str.words("  hello   world  "); // ["hello", "world"]
	 * ```
	 */
	words: (s: string): readonly string[] => s.trim().split(/\s+/).filter(Boolean),

	/**
	 * Returns `true` when the string is empty or contains only whitespace.
	 *
	 * @example
	 * ```ts
	 * pipe("   ", Str.isBlank); // true
	 * pipe("hi", Str.isBlank);  // false
	 * ```
	 */
	isBlank: (s: string): boolean => s.trim().length === 0,

	/**
	 * Returns the length of the string.
	 *
	 * @example
	 * ```ts
	 * pipe("hello", Str.length); // 5
	 * pipe("", Str.length);      // 0
	 * ```
	 */
	length: (s: string): number => s.length,

	/**
	 * Extracts a substring between two indices. Data-last: use in `pipe`.
	 *
	 * @example
	 * ```ts
	 * pipe("hello", Str.slice(1, 3)); // "el"
	 * pipe("hello", Str.slice(2));    // "llo"
	 * ```
	 */
	slice: (start: number, end?: number) => (s: string): string => s.slice(start, end),

	/**
	 * Pads the start of a string to a specified length. Data-last: use in `pipe`.
	 *
	 * @example
	 * ```ts
	 * pipe("5", Str.padStart(3, "0")); // "005"
	 * pipe("hi", Str.padStart(5));     // "   hi"
	 * ```
	 */
	padStart: (maxLength: number, fillString?: string) => (s: string): string => s.padStart(maxLength, fillString),

	/**
	 * Pads the end of a string to a specified length. Data-last: use in `pipe`.
	 *
	 * @example
	 * ```ts
	 * pipe("hi", Str.padEnd(5, "."));  // "hi..."
	 * pipe("hi", Str.padEnd(5));       // "hi   "
	 * ```
	 */
	padEnd: (maxLength: number, fillString?: string) => (s: string): string => s.padEnd(maxLength, fillString),

	/**
	 * Safe number parsers that return `Maybe` instead of `NaN`.
	 */
	parse: {
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
			if (s.length === 0) { return Maybe.make.none(); }
			const n = Number.parseInt(s, 10);
			return Number.isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
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
			if (s.length === 0) { return Maybe.make.none(); }
			const n = Number.parseFloat(s);
			return Number.isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
		},
	},

	/**
	 * Safely parses a JSON string, returning a `Result<SyntaxError, unknown>`.
	 *
	 * @example
	 * ```ts
	 * Str.parseJson('{"a": 1}'); // Ok({ a: 1 })
	 * Str.parseJson('invalid');  // Err(SyntaxError)
	 * ```
	 */
	parseJson: (s: string): Result<SyntaxError, unknown> => {
		try {
			return Result.make.ok(JSON.parse(s));
		} catch (error) {
			return Result.make.err(error as SyntaxError);
		}
	},

	/**
	 * Converts the first character of a string to lower case.
	 *
	 * @example
	 * ```ts
	 * Str.uncapitalize("Hello"); // "hello"
	 * Str.uncapitalize("");      // ""
	 * ```
	 */
	uncapitalize: (s: string): string => s.length === 0 ? "" : s.charAt(0).toLowerCase() + s.slice(1),

	/**
	 * Truncates a string to a maximum length, appending an optional suffix (default `"..."`).
	 * Data-last curried signature.
	 *
	 * @example
	 * ```ts
	 * pipe("Hello, world!", Str.truncate({ length: 8 })); // "Hello..."
	 * pipe("Hello", Str.truncate({ length: 10 }));        // "Hello"
	 * pipe("Hello, world!", Str.truncate({ length: 8, suffix: "…" })); // "Hello, w…"
	 * ```
	 */
	truncate: (options: { length: number; suffix?: string; }) => (s: string): string => {
		const { length: targetLength, suffix = "..." } = options;
		if (s.length <= targetLength) {
			return s;
		}
		if (targetLength <= suffix.length) {
			return suffix.slice(0, targetLength);
		}
		return s.slice(0, targetLength - suffix.length) + suffix;
	},

	NonEmpty: StrNonEmptyConst,
};

export namespace Str {
	/**
	 * A branded type representing a string with at least one character.
	 */
	export type NonEmpty = NonEmptyString;
}
