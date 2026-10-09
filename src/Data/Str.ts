// =============================================================================
// Imports
// =============================================================================
import { Maybe } from "#core";
import { type NonEmpty as InternalNonEmpty } from "#internal";
import type { Brand } from "#types";

// =============================================================================
// Types
// =============================================================================
/**
 * A branded type representing a string with at least one character.
 */
type NonEmptyString = Brand<InternalNonEmpty<"Str">, string>;

// =============================================================================
// Private Helpers & NonEmpty Constructors
// =============================================================================
const isAscii = (text: string): boolean => {
	for (let i = 0; i < text.length; i++) {
		if (text.charCodeAt(i) > 127) {
			return false;
		}
	}
	return true;
};

let cachedSegmenter: Intl.Segmenter | null | undefined;

const getSegmenter = (): Intl.Segmenter => {
	if (cachedSegmenter === undefined) {
		cachedSegmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
			? new Intl.Segmenter(undefined, { granularity: "grapheme" })
			: null;
	}
	if (cachedSegmenter === null) {
		throw new TypeError("Str.graphemeSize requires Intl.Segmenter to be supported in the runtime environment.");
	}
	return cachedSegmenter;
};

const StrNonEmptyConst = {
	// --- from ---
	from: {
		/**
		 * Returns Some containing NonEmptyString if the string is not empty, None otherwise.
		 *
		 * @example
		 * ```ts
		 * Str.NonEmpty.from.string("hello"); // Some("hello")
		 * Str.NonEmpty.from.string("");      // None
		 * ```
		 */
		string: (
			text: string,
		): Maybe<NonEmptyString> => (text.length > 0 ? Maybe.make.some(text as NonEmptyString) : Maybe.make.none()),
	},
};

const isEmpty = (text: string): boolean => text.length === 0;
const isNonEmpty = (text: string): text is NonEmptyString => text.length > 0;
const isBlank = (text: string): boolean => text.trim().length === 0;

// =============================================================================
// Public Export
// =============================================================================
export const Str = {
	is: {
		/**
		 * Returns `true` when the string is empty.
		 *
		 * @see {@link nonEmpty} for checking if a string contains at least one character.
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
		 *
		 * @see {@link empty} for checking if a string has zero length.
		 */
		nonEmpty: isNonEmpty,

		/**
		 * Returns `true` when the string is empty or contains only whitespace.
		 *
		 * @see {@link empty} for checking zero length without trimming whitespace.
		 *
		 * @example
		 * ```ts
		 * pipe("   ", Str.is.blank); // true
		 * pipe("hi", Str.is.blank);  // false
		 * ```
		 */
		blank: isBlank,
	},

	/**
	 * Splits a string by a separator. Data-last: use in `pipe`.
	 *
	 * @example
	 * ```ts
	 * pipe("a,b,c", Str.split(",")); // ["a", "b", "c"]
	 * ```
	 */
	split: (separator: string | RegExp) => (text: string): readonly string[] => text.split(separator),

	/**
	 * Removes leading and trailing whitespace from a string.
	 *
	 * @example
	 * ```ts
	 * pipe("  hello  ", Str.trim); // "hello"
	 * ```
	 */
	trim: (text: string): string => text.trim(),

	/**
	 * Returns `true` when the string contains the given substring.
	 *
	 * @example
	 * ```ts
	 * pipe("hello world", Str.includes("world")); // true
	 * pipe("hello world", Str.includes("xyz"));   // false
	 * ```
	 */
	includes: (substring: string) => (text: string): boolean => text.includes(substring),

	/**
	 * Replaces the first occurrence of a pattern in a string. Data-last: use in `pipe`.
	 *
	 * @see {@link replaceAll} for substituting every occurrence instead of only the first.
	 *
	 * @example
	 * ```ts
	 * pipe("foo foo foo", Str.replace("foo", "bar")); // "bar foo foo"
	 * pipe("Hello World", Str.replace(/world/i, "Earth")); // "Hello Earth"
	 * ```
	 */
	replace: (pattern: string | RegExp, replacement: string) => (text: string): string =>
		text.replace(pattern, replacement),

	/**
	 * Replaces all occurrences of a pattern in a string. Data-last: use in `pipe`.
	 *
	 * @see {@link replace} for substituting only the first occurrence.
	 *
	 * @example
	 * ```ts
	 * pipe("foo foo foo", Str.replaceAll("foo", "bar")); // "bar bar bar"
	 * pipe("aAbBaA", Str.replaceAll(/a/gi, "x")); // "xxBBxx"
	 * ```
	 */
	replaceAll: (pattern: string | RegExp, replacement: string) => (text: string): string =>
		text.replaceAll(pattern, replacement),

	/**
	 * Returns `true` when the string starts with the given prefix.
	 *
	 * @see {@link endsWith} for checking suffix matches.
	 *
	 * @example
	 * ```ts
	 * pipe("hello world", Str.startsWith("hello")); // true
	 * pipe("hello world", Str.startsWith("world")); // false
	 * ```
	 */
	startsWith: (prefix: string) => (text: string): boolean => text.startsWith(prefix),

	/**
	 * Returns `true` when the string ends with the given suffix.
	 *
	 * @see {@link startsWith} for checking prefix matches.
	 *
	 * @example
	 * ```ts
	 * pipe("hello world", Str.endsWith("world")); // true
	 * pipe("hello world", Str.endsWith("hello")); // false
	 * ```
	 */
	endsWith: (suffix: string) => (text: string): boolean => text.endsWith(suffix),

	/**
	 * Converts a string to uppercase.
	 *
	 * @see {@link toLowerCase} for lowercasing characters.
	 *
	 * @example
	 * ```ts
	 * pipe("hello", Str.toUpperCase); // "HELLO"
	 * ```
	 */
	toUpperCase: (text: string): string => text.toUpperCase(),

	/**
	 * Converts a string to lowercase.
	 *
	 * @see {@link toUpperCase} for uppercasing characters.
	 *
	 * @example
	 * ```ts
	 * pipe("HELLO", Str.toLowerCase); // "hello"
	 * ```
	 */
	toLowerCase: (text: string): string => text.toLowerCase(),

	/**
	 * Converts the first character of a string to uppercase.
	 *
	 * @see {@link uncapitalize} for converting the first character to lowercase.
	 *
	 * @example
	 * ```ts
	 * pipe("hello", Str.capitalize); // "Hello"
	 * ```
	 */
	capitalize: (text: string): string => text.length === 0 ? "" : text.charAt(0).toUpperCase() + text.slice(1),

	/**
	 * Splits a string into lines, normalising `\r\n` and `\r` line endings.
	 *
	 * @example
	 * ```ts
	 * Str.lines("one\ntwo\nthree"); // ["one", "two", "three"]
	 * Str.lines("a\r\nb");         // ["a", "b"]
	 * ```
	 */
	lines: (text: string): readonly string[] => text.split(/\r?\n|\r/),

	/**
	 * Splits a string into words on any whitespace boundary, filtering out empty strings.
	 *
	 * @example
	 * ```ts
	 * Str.words("  hello   world  "); // ["hello", "world"]
	 * ```
	 */
	words: (text: string): readonly string[] => text.trim().split(/\s+/).filter(Boolean),

	/**
	 * Returns the UTF-16 code-unit length of the string.
	 *
	 * @see {@link graphemeSize} for counting user-perceived characters/emojis.
	 *
	 * @example
	 * ```ts
	 * pipe("hello", Str.size); // 5
	 * pipe("", Str.size);      // 0
	 * ```
	 */
	size: (text: string): number => text.length,

	/**
	 * Returns the number of user-perceived characters (grapheme clusters) in the string,
	 * correctly counting emojis and complex Unicode sequences.
	 *
	 * @see {@link size} for fast UTF-16 code-unit length.
	 *
	 * @example
	 * ```ts
	 * pipe("👨‍👩‍👧‍👦", Str.graphemeSize); // 1
	 * pipe("👨‍👩‍👧‍👦", Str.size);         // 11
	 * ```
	 */
	graphemeSize: (text: string): number => {
		if (text.length === 0) {
			return 0;
		}
		if (isAscii(text)) {
			return text.length;
		}
		const segmenter = getSegmenter();
		let count = 0;
		for (const _ of segmenter.segment(text)) {
			count++;
		}
		return count;
	},

	/**
	 * Extracts a substring between two indices. Data-last: use in `pipe`.
	 *
	 * @example
	 * ```ts
	 * pipe("hello", Str.slice(1, 3)); // "el"
	 * pipe("hello", Str.slice(2));    // "llo"
	 * ```
	 */
	slice: (start: number, end?: number) => (text: string): string => text.slice(start, end),

	/**
	 * Pads the start of a string to a specified length. Data-last: use in `pipe`.
	 *
	 * @see {@link padEnd} for padding the right side of a string.
	 *
	 * @example
	 * ```ts
	 * pipe("5", Str.padStart(3, "0")); // "005"
	 * pipe("hi", Str.padStart(5));     // "   hi"
	 * ```
	 */
	padStart: (maxLength: number, fillString?: string) => (text: string): string => text.padStart(maxLength, fillString),

	/**
	 * Pads the end of a string to a specified length. Data-last: use in `pipe`.
	 *
	 * @see {@link padStart} for padding the left side of a string.
	 *
	 * @example
	 * ```ts
	 * pipe("hi", Str.padEnd(5, "."));  // "hi..."
	 * pipe("hi", Str.padEnd(5));       // "hi   "
	 * ```
	 */
	padEnd: (maxLength: number, fillString?: string) => (text: string): string => text.padEnd(maxLength, fillString),

	/**
	 * Safe number parsers that return `Maybe` instead of `NaN`.
	 */
	parse: {
		/**
		 * Parses a string as an integer (base 10). Returns `None` if the result is `NaN`.
		 *
		 * @see {@link float} for parsing floating-point numbers.
		 *
		 * @example
		 * ```ts
		 * Str.parse.int("42");   // Some(42)
		 * Str.parse.int("3.7");  // Some(3)
		 * Str.parse.int("abc");  // None
		 * ```
		 */
		int: (text: string): Maybe<number> => {
			if (text.length === 0) { return Maybe.make.none(); }
			const n = Number.parseInt(text, 10);
			return Number.isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
		},

		/**
		 * Parses a string as a floating-point number. Returns `None` if the result is `NaN`.
		 *
		 * @see {@link int} for parsing base-10 integers.
		 *
		 * @example
		 * ```ts
		 * Str.parse.float("3.14"); // Some(3.14)
		 * Str.parse.float("42");   // Some(42)
		 * Str.parse.float("abc");  // None
		 * ```
		 */
		float: (text: string): Maybe<number> => {
			if (text.length === 0) { return Maybe.make.none(); }
			const n = Number.parseFloat(text);
			return Number.isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
		},
	},

	/**
	 * Matches a string against a regular expression.
	 * Pure and safe: resets `pattern.lastIndex = 0` to prevent bugs with stateful `/g` and `/y` regexes.
	 *
	 * @see {@link test} for boolean validation without extracting capture groups.
	 *
	 * @example
	 * ```ts
	 * pipe("hello 42", Str.match(/\d+/)); // Some(["42"])
	 * pipe("hello", Str.match(/\d+/));    // None
	 * ```
	 */
	match: (pattern: RegExp) => (text: string): Maybe<RegExpMatchArray> => {
		pattern.lastIndex = 0;
		const result = text.match(pattern);
		return result !== null ? Maybe.make.some(result) : Maybe.make.none();
	},

	/**
	 * Tests whether a string matches a regular expression.
	 * Pure and safe: resets `pattern.lastIndex = 0` to prevent bugs with stateful `/g` and `/y` regexes.
	 *
	 * @see {@link match} for extracting capture groups into a Maybe.
	 *
	 * @example
	 * ```ts
	 * pipe("user@example.com", Str.test(/^[^@]+@[^@]+$/)); // true
	 * pipe("invalid-email", Str.test(/^[^@]+@[^@]+$/));    // false
	 * ```
	 */
	test: (pattern: RegExp) => (text: string): boolean => {
		pattern.lastIndex = 0;
		return pattern.test(text);
	},

	/**
	 * Converts the first character of a string to lower case.
	 *
	 * @see {@link capitalize} for converting the first character to uppercase.
	 *
	 * @example
	 * ```ts
	 * pipe("Hello", Str.uncapitalize); // "hello"
	 * pipe("", Str.uncapitalize);      // ""
	 * ```
	 */
	uncapitalize: (text: string): string => text.length === 0 ? "" : text.charAt(0).toLowerCase() + text.slice(1),

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
	truncate: (options: { length: number; suffix?: string; }) => (text: string): string => {
		const { length: targetLength, suffix = "..." } = options;
		if (text.length <= targetLength) {
			return text;
		}
		if (targetLength <= suffix.length) {
			return suffix.slice(0, targetLength);
		}
		return text.slice(0, targetLength - suffix.length) + suffix;
	},

	NonEmpty: StrNonEmptyConst,
};

export namespace Str {
	/**
	 * A branded type representing a string with at least one character.
	 */
	export type NonEmpty = NonEmptyString;
}
