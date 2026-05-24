import { pipe } from "#composition";
import { Maybe, Result } from "#core";
import { Str } from "#utils";
import { expect, test } from "vitest";

// ---------------------------------------------------------------------------
// split
// ---------------------------------------------------------------------------

test("Str.split splits a string by a separator", () => {
	expect(pipe("a,b,c", Str.split(","))).toStrictEqual(["a", "b", "c"]);
});

test("Str.split splits by a regex", () => {
	expect(pipe("a1b2c", Str.split(/\d/))).toStrictEqual(["a", "b", "c"]);
});

test("Str.split on missing separator returns single-element array", () => {
	expect(pipe("hello", Str.split(","))).toStrictEqual(["hello"]);
});

test("Str.split returns empty strings for adjacent separators", () => {
	expect(pipe("a,,b", Str.split(","))).toStrictEqual(["a", "", "b"]);
});

// ---------------------------------------------------------------------------
// trim
// ---------------------------------------------------------------------------

test("Str.trim removes leading and trailing whitespace", () => {
	expect(pipe("  hello  ", Str.trim)).toBe("hello");
});

test("Str.trim returns unchanged string when no whitespace", () => {
	expect(pipe("hello", Str.trim)).toBe("hello");
});

test("Str.trim returns empty string for whitespace-only input", () => {
	expect(pipe("   ", Str.trim)).toBe("");
});

// ---------------------------------------------------------------------------
// includes
// ---------------------------------------------------------------------------

test("Str.includes returns true when substring is present", () => {
	expect(pipe("hello world", Str.includes("world"))).toBe(true);
});

test("Str.includes returns false when substring is absent", () => {
	expect(pipe("hello world", Str.includes("xyz"))).toBe(false);
});

test("Str.includes matches at the start", () => {
	expect(pipe("hello world", Str.includes("hello"))).toBe(true);
});

// ---------------------------------------------------------------------------
// startsWith
// ---------------------------------------------------------------------------

test("Str.startsWith returns true when string starts with prefix", () => {
	expect(pipe("hello world", Str.startsWith("hello"))).toBe(true);
});

test("Str.startsWith returns false when string does not start with prefix", () => {
	expect(pipe("hello world", Str.startsWith("world"))).toBe(false);
});

// ---------------------------------------------------------------------------
// endsWith
// ---------------------------------------------------------------------------

test("Str.endsWith returns true when string ends with suffix", () => {
	expect(pipe("hello world", Str.endsWith("world"))).toBe(true);
});

test("Str.endsWith returns false when string does not end with suffix", () => {
	expect(pipe("hello world", Str.endsWith("hello"))).toBe(false);
});

// ---------------------------------------------------------------------------
// toUpperCase / toLowerCase
// ---------------------------------------------------------------------------

test("Str.toUpperCase converts all characters to uppercase", () => {
	expect(pipe("hello", Str.toUpperCase)).toBe("HELLO");
});

test("Str.toLowerCase converts all characters to lowercase", () => {
	expect(pipe("HELLO", Str.toLowerCase)).toBe("hello");
});

// ---------------------------------------------------------------------------
// capitalize
// ---------------------------------------------------------------------------

test("Str.capitalize converts the first character to uppercase", () => {
	expect(pipe("hello", Str.capitalize)).toBe("Hello");
});

test("Str.capitalize leaves already capitalized strings unchanged", () => {
	expect(pipe("Hello", Str.capitalize)).toBe("Hello");
});

test("Str.capitalize leaves the rest of the string untouched", () => {
	expect(pipe("hELLO", Str.capitalize)).toBe("HELLO");
});

test("Str.capitalize handles single-character strings", () => {
	expect(pipe("a", Str.capitalize)).toBe("A");
});

test("Str.capitalize handles empty strings", () => {
	expect(pipe("", Str.capitalize)).toBe("");
});

test("Str.capitalize composes in a pipe", () => {
	expect(pipe("  hello  ", Str.trim, Str.capitalize)).toBe("Hello");
});

// ---------------------------------------------------------------------------
// lines
// ---------------------------------------------------------------------------

test("Str.lines splits on LF line endings", () => {
	expect(Str.lines("one\ntwo\nthree")).toStrictEqual(["one", "two", "three"]);
});

test("Str.lines splits on CRLF line endings", () => {
	expect(Str.lines("one\r\ntwo\r\nthree")).toStrictEqual(["one", "two", "three"]);
});

test("Str.lines splits on CR line endings", () => {
	expect(Str.lines("one\rtwo")).toStrictEqual(["one", "two"]);
});

test("Str.lines returns single-element array for string with no newlines", () => {
	expect(Str.lines("hello")).toStrictEqual(["hello"]);
});

test("Str.lines returns two elements when string ends with newline", () => {
	expect(Str.lines("one\n")).toStrictEqual(["one", ""]);
});

// ---------------------------------------------------------------------------
// words
// ---------------------------------------------------------------------------

test("Str.words splits on whitespace and trims", () => {
	expect(Str.words("  hello   world  ")).toStrictEqual(["hello", "world"]);
});

test("Str.words returns empty array for whitespace-only string", () => {
	expect(Str.words("   ")).toStrictEqual([]);
});

test("Str.words returns single word for single-word string", () => {
	expect(Str.words("hello")).toStrictEqual(["hello"]);
});

test("Str.words splits on mixed whitespace characters", () => {
	expect(Str.words("a\tb\nc")).toStrictEqual(["a", "b", "c"]);
});

// ---------------------------------------------------------------------------
// parse.int
// ---------------------------------------------------------------------------

test("str.parse.int returns Some for a valid integer string", () => {
	expect(Str.parse.int("42")).toStrictEqual(Maybe.some(42));
});

test("str.parse.int truncates floats", () => {
	expect(Str.parse.int("3.7")).toStrictEqual(Maybe.some(3));
});

test("str.parse.int returns None for a non-numeric string", () => {
	expect(Str.parse.int("abc")).toStrictEqual(Maybe.none());
});

test("str.parse.int returns None for empty string", () => {
	expect(Str.parse.int("")).toStrictEqual(Maybe.none());
});

// ---------------------------------------------------------------------------
// parse.float
// ---------------------------------------------------------------------------

test("str.parse.float returns Some for a valid float string", () => {
	expect(Str.parse.float("3.14")).toStrictEqual(Maybe.some(3.14));
});

test("str.parse.float returns Some for an integer string", () => {
	expect(Str.parse.float("42")).toStrictEqual(Maybe.some(42));
});

test("str.parse.float returns None for a non-numeric string", () => {
	expect(Str.parse.float("abc")).toStrictEqual(Maybe.none());
});

test("str.parse.float returns None for empty string", () => {
	expect(Str.parse.float("")).toStrictEqual(Maybe.none());
});

// ---------------------------------------------------------------------------
// replace
// ---------------------------------------------------------------------------

test("Str.replace replaces the first occurrence of a substring", () => {
	expect(pipe("foo foo foo", Str.replace("foo", "bar"))).toBe("bar foo foo");
});

test("Str.replace works with a RegExp pattern", () => {
	expect(pipe("Hello World", Str.replace(/world/i, "Earth"))).toBe("Hello Earth");
});

test("Str.replace returns the string unchanged when pattern not found", () => {
	expect(pipe("hello", Str.replace("xyz", "abc"))).toBe("hello");
});

// ---------------------------------------------------------------------------
// replaceAll
// ---------------------------------------------------------------------------

test("Str.replaceAll replaces all occurrences of a substring", () => {
	expect(pipe("foo foo foo", Str.replaceAll("foo", "bar"))).toBe("bar bar bar");
});

test("Str.replaceAll with a global RegExp replaces all matches", () => {
	expect(pipe("aAbBaA", Str.replaceAll(/a/gi, "x"))).toBe("xxbBxx");
});

test("Str.replaceAll returns the string unchanged when pattern not found", () => {
	expect(pipe("hello", Str.replaceAll("xyz", "abc"))).toBe("hello");
});

// ---------------------------------------------------------------------------
// isEmpty
// ---------------------------------------------------------------------------

test("Str.isEmpty returns true for an empty string", () => {
	expect(pipe("", Str.isEmpty)).toBe(true);
});

test("Str.isEmpty returns false for a non-empty string", () => {
	expect(pipe("hi", Str.isEmpty)).toBe(false);
});

test("Str.isEmpty returns false for a whitespace-only string", () => {
	expect(pipe("   ", Str.isEmpty)).toBe(false);
});

// ---------------------------------------------------------------------------
// isBlank
// ---------------------------------------------------------------------------

test("Str.isBlank returns true for an empty string", () => {
	expect(pipe("", Str.isBlank)).toBe(true);
});

test("Str.isBlank returns true for a whitespace-only string", () => {
	expect(pipe("   ", Str.isBlank)).toBe(true);
});

test("Str.isBlank returns false for a non-empty string", () => {
	expect(pipe("hi", Str.isBlank)).toBe(false);
});

// ---------------------------------------------------------------------------
// length
// ---------------------------------------------------------------------------

test("Str.length returns the correct length", () => {
	expect(pipe("hello", Str.length)).toBe(5);
});

test("Str.length returns 0 for an empty string", () => {
	expect(pipe("", Str.length)).toBe(0);
});

test("Str.length includes whitespace in count", () => {
	expect(pipe("a b c", Str.length)).toBe(5);
});

// ---------------------------------------------------------------------------
// slice
// ---------------------------------------------------------------------------

test("Str.slice slices with start and end indices", () => {
	expect(pipe("hello", Str.slice(1, 3))).toBe("el");
});

test("Str.slice slices with only start index", () => {
	expect(pipe("hello", Str.slice(2))).toBe("llo");
});

test("Str.slice handles negative start index", () => {
	expect(pipe("hello", Str.slice(-2))).toBe("lo");
});

test("Str.slice with start beyond length returns empty string", () => {
	expect(pipe("hello", Str.slice(10))).toBe("");
});

// ---------------------------------------------------------------------------
// padStart
// ---------------------------------------------------------------------------

test("Str.padStart pads to the specified length", () => {
	expect(pipe("5", Str.padStart(3, "0"))).toBe("005");
});

test("Str.padStart with default fill uses space", () => {
	expect(pipe("hi", Str.padStart(5))).toBe("   hi");
});

test("Str.padStart is a no-op when string is already long enough", () => {
	expect(pipe("hello", Str.padStart(3, "0"))).toBe("hello");
});

test("Str.padStart pads with custom fill string", () => {
	expect(pipe("x", Str.padStart(5, "ab"))).toBe("ababx");
});

// ---------------------------------------------------------------------------
// padEnd
// ---------------------------------------------------------------------------

test("Str.padEnd pads to the specified length", () => {
	expect(pipe("hi", Str.padEnd(5, "."))).toBe("hi...");
});

test("Str.padEnd with default fill uses space", () => {
	expect(pipe("hi", Str.padEnd(5))).toBe("hi   ");
});

test("Str.padEnd is a no-op when string is already long enough", () => {
	expect(pipe("hello", Str.padEnd(3, "0"))).toBe("hello");
});

test("Str.padEnd pads with custom fill string", () => {
	expect(pipe("x", Str.padEnd(5, "ab"))).toBe("xabab");
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("str pipe composition - trim then split then toUpperCase each word", () => {
	const result = pipe("  hello world  ", Str.trim, Str.split(" "), (words) => words.map(Str.toUpperCase));
	expect(result).toStrictEqual(["HELLO", "WORLD"]);
});

// ---------------------------------------------------------------------------
// parseJson
// ---------------------------------------------------------------------------

test("Str.parseJson returns Ok for valid JSON object", () => {
	const result = Str.parseJson('{"name":"Alice","age":30}');
	expect(result).toStrictEqual(Result.ok({ name: "Alice", age: 30 }));
});

test("Str.parseJson returns Ok for valid JSON array", () => {
	const result = Str.parseJson("[1,2,3]");
	expect(result).toStrictEqual(Result.ok([1, 2, 3]));
});

test("Str.parseJson returns Ok for valid JSON primitives", () => {
	expect(Str.parseJson('"hello"')).toStrictEqual(Result.ok("hello"));
	expect(Str.parseJson("42")).toStrictEqual(Result.ok(42));
});

test("Str.parseJson returns Error with SyntaxError for invalid JSON", () => {
	const result = Str.parseJson("{not json}");
	const error = Result.fold((e: unknown) => e, () => null)(result);
	expect(error).toBeInstanceOf(SyntaxError);
});

test("Str.parseJson returns Ok for empty object", () => {
	const result = Str.parseJson("{}");
	expect(result).toStrictEqual(Result.ok({}));
});
