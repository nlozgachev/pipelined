import { pipe } from "#composition/pipe.ts";
import { Maybe } from "#core/Maybe.ts";
import { expect, test } from "vitest";
import { Str } from "../Str.ts";

// ---------------------------------------------------------------------------
// split
// ---------------------------------------------------------------------------

test("Str.split splits a string by a separator", () => {
	expect(pipe("a,b,c", Str.split(","))).toEqual(["a", "b", "c"]);
});

test("Str.split splits by a regex", () => {
	expect(pipe("a1b2c", Str.split(/\d/))).toEqual(["a", "b", "c"]);
});

test("Str.split on missing separator returns single-element array", () => {
	expect(pipe("hello", Str.split(","))).toEqual(["hello"]);
});

test("Str.split returns empty strings for adjacent separators", () => {
	expect(pipe("a,,b", Str.split(","))).toEqual(["a", "", "b"]);
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
// lines
// ---------------------------------------------------------------------------

test("Str.lines splits on LF line endings", () => {
	expect(Str.lines("one\ntwo\nthree")).toEqual(["one", "two", "three"]);
});

test("Str.lines splits on CRLF line endings", () => {
	expect(Str.lines("one\r\ntwo\r\nthree")).toEqual(["one", "two", "three"]);
});

test("Str.lines splits on CR line endings", () => {
	expect(Str.lines("one\rtwo")).toEqual(["one", "two"]);
});

test("Str.lines returns single-element array for string with no newlines", () => {
	expect(Str.lines("hello")).toEqual(["hello"]);
});

test("Str.lines returns two elements when string ends with newline", () => {
	expect(Str.lines("one\n")).toEqual(["one", ""]);
});

// ---------------------------------------------------------------------------
// words
// ---------------------------------------------------------------------------

test("Str.words splits on whitespace and trims", () => {
	expect(Str.words("  hello   world  ")).toEqual(["hello", "world"]);
});

test("Str.words returns empty array for whitespace-only string", () => {
	expect(Str.words("   ")).toEqual([]);
});

test("Str.words returns single word for single-word string", () => {
	expect(Str.words("hello")).toEqual(["hello"]);
});

test("Str.words splits on mixed whitespace characters", () => {
	expect(Str.words("a\tb\nc")).toEqual(["a", "b", "c"]);
});

// ---------------------------------------------------------------------------
// parse.int
// ---------------------------------------------------------------------------

test("Str.parse.int returns Some for a valid integer string", () => {
	expect(Str.parse.int("42")).toEqual(Maybe.some(42));
});

test("Str.parse.int truncates floats", () => {
	expect(Str.parse.int("3.7")).toEqual(Maybe.some(3));
});

test("Str.parse.int returns None for a non-numeric string", () => {
	expect(Str.parse.int("abc")).toEqual(Maybe.none());
});

test("Str.parse.int returns None for empty string", () => {
	expect(Str.parse.int("")).toEqual(Maybe.none());
});

// ---------------------------------------------------------------------------
// parse.float
// ---------------------------------------------------------------------------

test("Str.parse.float returns Some for a valid float string", () => {
	expect(Str.parse.float("3.14")).toEqual(Maybe.some(3.14));
});

test("Str.parse.float returns Some for an integer string", () => {
	expect(Str.parse.float("42")).toEqual(Maybe.some(42));
});

test("Str.parse.float returns None for a non-numeric string", () => {
	expect(Str.parse.float("abc")).toEqual(Maybe.none());
});

test("Str.parse.float returns None for empty string", () => {
	expect(Str.parse.float("")).toEqual(Maybe.none());
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Str pipe composition - trim then split then toUpperCase each word", () => {
	const result = pipe(
		"  hello world  ",
		Str.trim,
		Str.split(" "),
		(words) => words.map(Str.toUpperCase),
	);
	expect(result).toEqual(["HELLO", "WORLD"]);
});
