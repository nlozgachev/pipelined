import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Str } from "../Str.ts";
import { Option } from "#core/Option.ts";
import { pipe } from "#composition/pipe.ts";

// ---------------------------------------------------------------------------
// split
// ---------------------------------------------------------------------------

Deno.test("Str.split splits a string by a separator", () => {
	assertEquals(pipe("a,b,c", Str.split(",")), ["a", "b", "c"]);
});

Deno.test("Str.split splits by a regex", () => {
	assertEquals(pipe("a1b2c", Str.split(/\d/)), ["a", "b", "c"]);
});

Deno.test("Str.split on missing separator returns single-element array", () => {
	assertEquals(pipe("hello", Str.split(",")), ["hello"]);
});

Deno.test("Str.split returns empty strings for adjacent separators", () => {
	assertEquals(pipe("a,,b", Str.split(",")), ["a", "", "b"]);
});

// ---------------------------------------------------------------------------
// trim
// ---------------------------------------------------------------------------

Deno.test("Str.trim removes leading and trailing whitespace", () => {
	assertStrictEquals(pipe("  hello  ", Str.trim), "hello");
});

Deno.test("Str.trim returns unchanged string when no whitespace", () => {
	assertStrictEquals(pipe("hello", Str.trim), "hello");
});

Deno.test("Str.trim returns empty string for whitespace-only input", () => {
	assertStrictEquals(pipe("   ", Str.trim), "");
});

// ---------------------------------------------------------------------------
// includes
// ---------------------------------------------------------------------------

Deno.test("Str.includes returns true when substring is present", () => {
	assertStrictEquals(pipe("hello world", Str.includes("world")), true);
});

Deno.test("Str.includes returns false when substring is absent", () => {
	assertStrictEquals(pipe("hello world", Str.includes("xyz")), false);
});

Deno.test("Str.includes matches at the start", () => {
	assertStrictEquals(pipe("hello world", Str.includes("hello")), true);
});

// ---------------------------------------------------------------------------
// startsWith
// ---------------------------------------------------------------------------

Deno.test("Str.startsWith returns true when string starts with prefix", () => {
	assertStrictEquals(pipe("hello world", Str.startsWith("hello")), true);
});

Deno.test("Str.startsWith returns false when string does not start with prefix", () => {
	assertStrictEquals(pipe("hello world", Str.startsWith("world")), false);
});

// ---------------------------------------------------------------------------
// endsWith
// ---------------------------------------------------------------------------

Deno.test("Str.endsWith returns true when string ends with suffix", () => {
	assertStrictEquals(pipe("hello world", Str.endsWith("world")), true);
});

Deno.test("Str.endsWith returns false when string does not end with suffix", () => {
	assertStrictEquals(pipe("hello world", Str.endsWith("hello")), false);
});

// ---------------------------------------------------------------------------
// toUpperCase / toLowerCase
// ---------------------------------------------------------------------------

Deno.test("Str.toUpperCase converts all characters to uppercase", () => {
	assertStrictEquals(pipe("hello", Str.toUpperCase), "HELLO");
});

Deno.test("Str.toLowerCase converts all characters to lowercase", () => {
	assertStrictEquals(pipe("HELLO", Str.toLowerCase), "hello");
});

// ---------------------------------------------------------------------------
// lines
// ---------------------------------------------------------------------------

Deno.test("Str.lines splits on LF line endings", () => {
	assertEquals(Str.lines("one\ntwo\nthree"), ["one", "two", "three"]);
});

Deno.test("Str.lines splits on CRLF line endings", () => {
	assertEquals(Str.lines("one\r\ntwo\r\nthree"), ["one", "two", "three"]);
});

Deno.test("Str.lines splits on CR line endings", () => {
	assertEquals(Str.lines("one\rtwo"), ["one", "two"]);
});

Deno.test("Str.lines returns single-element array for string with no newlines", () => {
	assertEquals(Str.lines("hello"), ["hello"]);
});

Deno.test("Str.lines returns two elements when string ends with newline", () => {
	assertEquals(Str.lines("one\n"), ["one", ""]);
});

// ---------------------------------------------------------------------------
// words
// ---------------------------------------------------------------------------

Deno.test("Str.words splits on whitespace and trims", () => {
	assertEquals(Str.words("  hello   world  "), ["hello", "world"]);
});

Deno.test("Str.words returns empty array for whitespace-only string", () => {
	assertEquals(Str.words("   "), []);
});

Deno.test("Str.words returns single word for single-word string", () => {
	assertEquals(Str.words("hello"), ["hello"]);
});

Deno.test("Str.words splits on mixed whitespace characters", () => {
	assertEquals(Str.words("a\tb\nc"), ["a", "b", "c"]);
});

// ---------------------------------------------------------------------------
// parse.int
// ---------------------------------------------------------------------------

Deno.test("Str.parse.int returns Some for a valid integer string", () => {
	assertEquals(Str.parse.int("42"), Option.some(42));
});

Deno.test("Str.parse.int truncates floats", () => {
	assertEquals(Str.parse.int("3.7"), Option.some(3));
});

Deno.test("Str.parse.int returns None for a non-numeric string", () => {
	assertEquals(Str.parse.int("abc"), Option.none());
});

Deno.test("Str.parse.int returns None for empty string", () => {
	assertEquals(Str.parse.int(""), Option.none());
});

// ---------------------------------------------------------------------------
// parse.float
// ---------------------------------------------------------------------------

Deno.test("Str.parse.float returns Some for a valid float string", () => {
	assertEquals(Str.parse.float("3.14"), Option.some(3.14));
});

Deno.test("Str.parse.float returns Some for an integer string", () => {
	assertEquals(Str.parse.float("42"), Option.some(42));
});

Deno.test("Str.parse.float returns None for a non-numeric string", () => {
	assertEquals(Str.parse.float("abc"), Option.none());
});

Deno.test("Str.parse.float returns None for empty string", () => {
	assertEquals(Str.parse.float(""), Option.none());
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("Str pipe composition - trim then split then toUpperCase each word", () => {
	const result = pipe(
		"  hello world  ",
		Str.trim,
		Str.split(" "),
		(words) => words.map(Str.toUpperCase),
	);
	assertEquals(result, ["HELLO", "WORLD"]);
});
