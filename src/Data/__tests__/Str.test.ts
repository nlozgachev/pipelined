import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Str } from "../Str.ts";

// ---------------------------------------------------------------------------
// split
// ---------------------------------------------------------------------------

test("split: splits string by separator", () => {
	expect(pipe("a,b,c", Str.split(","))).toStrictEqual(["a", "b", "c"]);
});

test("split: splits string by regex", () => {
	expect(pipe("a1b2c", Str.split(/\d/))).toStrictEqual(["a", "b", "c"]);
});

test("split: returns single-element array on missing separator", () => {
	expect(pipe("hello", Str.split(","))).toStrictEqual(["hello"]);
});

test("split: returns empty strings for adjacent separators", () => {
	expect(pipe("a,,b", Str.split(","))).toStrictEqual(["a", "", "b"]);
});

// ---------------------------------------------------------------------------
// trim
// ---------------------------------------------------------------------------

test("trim: removes leading and trailing whitespace", () => {
	expect(pipe("  hello  ", Str.trim)).toBe("hello");
});

test("trim: returns unchanged string when no whitespace", () => {
	expect(pipe("hello", Str.trim)).toBe("hello");
});

test("trim: returns empty string for whitespace-only input", () => {
	expect(pipe("   ", Str.trim)).toBe("");
});

// ---------------------------------------------------------------------------
// includes
// ---------------------------------------------------------------------------

test("includes: returns true when substring is present", () => {
	expect(pipe("hello world", Str.includes("world"))).toBe(true);
});

test("includes: returns false when substring is absent", () => {
	expect(pipe("hello world", Str.includes("xyz"))).toBe(false);
});

test("includes: matches at start of string", () => {
	expect(pipe("hello world", Str.includes("hello"))).toBe(true);
});

// ---------------------------------------------------------------------------
// startsWith
// ---------------------------------------------------------------------------

test("startsWith: returns true when string starts with prefix", () => {
	expect(pipe("hello world", Str.startsWith("hello"))).toBe(true);
});

test("startsWith: returns false when string does not start with prefix", () => {
	expect(pipe("hello world", Str.startsWith("world"))).toBe(false);
});

// ---------------------------------------------------------------------------
// endsWith
// ---------------------------------------------------------------------------

test("endsWith: returns true when string ends with suffix", () => {
	expect(pipe("hello world", Str.endsWith("world"))).toBe(true);
});

test("endsWith: returns false when string does not end with suffix", () => {
	expect(pipe("hello world", Str.endsWith("hello"))).toBe(false);
});

// ---------------------------------------------------------------------------
// toUpperCase / toLowerCase
// ---------------------------------------------------------------------------

test("toUpperCase: converts all characters to uppercase", () => {
	expect(pipe("hello", Str.toUpperCase)).toBe("HELLO");
});

test("toLowerCase: converts all characters to lowercase", () => {
	expect(pipe("HELLO", Str.toLowerCase)).toBe("hello");
});

// ---------------------------------------------------------------------------
// capitalize
// ---------------------------------------------------------------------------

test("capitalize: converts first character to uppercase", () => {
	expect(pipe("hello", Str.capitalize)).toBe("Hello");
});

test("capitalize: leaves already capitalized strings unchanged", () => {
	expect(pipe("Hello", Str.capitalize)).toBe("Hello");
});

test("capitalize: leaves rest of string untouched", () => {
	expect(pipe("hELLO", Str.capitalize)).toBe("HELLO");
});

test("capitalize: handles single-character strings", () => {
	expect(pipe("a", Str.capitalize)).toBe("A");
});

test("capitalize: handles empty strings", () => {
	expect(pipe("", Str.capitalize)).toBe("");
});

test("capitalize: composes in pipe workflow", () => {
	expect(pipe("  hello  ", Str.trim, Str.capitalize)).toBe("Hello");
});

// ---------------------------------------------------------------------------
// lines
// ---------------------------------------------------------------------------

test("lines: splits on LF line endings", () => {
	expect(Str.lines("one\ntwo\nthree")).toStrictEqual(["one", "two", "three"]);
});

test("lines: splits on CRLF line endings", () => {
	expect(Str.lines("one\r\ntwo\r\nthree")).toStrictEqual(["one", "two", "three"]);
});

test("lines: splits on CR line endings", () => {
	expect(Str.lines("one\rtwo")).toStrictEqual(["one", "two"]);
});

test("lines: returns single-element array for string without newlines", () => {
	expect(Str.lines("hello")).toStrictEqual(["hello"]);
});

test("lines: returns two elements when string ends with newline", () => {
	expect(Str.lines("one\n")).toStrictEqual(["one", ""]);
});

// ---------------------------------------------------------------------------
// words
// ---------------------------------------------------------------------------

test("words: splits on whitespace and trims", () => {
	expect(Str.words("  hello   world  ")).toStrictEqual(["hello", "world"]);
});

test("words: returns empty array for whitespace-only string", () => {
	expect(Str.words("   ")).toStrictEqual([]);
});

test("words: returns single word for single-word string", () => {
	expect(Str.words("hello")).toStrictEqual(["hello"]);
});

test("words: splits on mixed whitespace characters", () => {
	expect(Str.words("a\tb\nc")).toStrictEqual(["a", "b", "c"]);
});

// ---------------------------------------------------------------------------
// parse.int
// ---------------------------------------------------------------------------

test("parse.int: returns Some for valid integer string", () => {
	expect(Str.parse.int("42")).toStrictEqual(Maybe.make.some(42));
});

test("parse.int: truncates floats", () => {
	expect(Str.parse.int("3.7")).toStrictEqual(Maybe.make.some(3));
});

test("parse.int: returns None for non-numeric string", () => {
	expect(Str.parse.int("abc")).toStrictEqual(Maybe.make.none());
});

test("parse.int: returns None for empty string", () => {
	expect(Str.parse.int("")).toStrictEqual(Maybe.make.none());
});

// ---------------------------------------------------------------------------
// parse.float
// ---------------------------------------------------------------------------

test("parse.float: returns Some for valid float string", () => {
	expect(Str.parse.float("3.14")).toStrictEqual(Maybe.make.some(3.14));
});

test("parse.float: returns Some for integer string", () => {
	expect(Str.parse.float("42")).toStrictEqual(Maybe.make.some(42));
});

test("parse.float: returns None for non-numeric string", () => {
	expect(Str.parse.float("abc")).toStrictEqual(Maybe.make.none());
});

test("parse.float: returns None for empty string", () => {
	expect(Str.parse.float("")).toStrictEqual(Maybe.make.none());
});

// ---------------------------------------------------------------------------
// replace
// ---------------------------------------------------------------------------

test("replace: replaces first occurrence of substring", () => {
	expect(pipe("foo foo foo", Str.replace("foo", "bar"))).toBe("bar foo foo");
});

test("replace: replaces matching RegExp pattern", () => {
	expect(pipe("Hello World", Str.replace(/world/i, "Earth"))).toBe("Hello Earth");
});

test("replace: returns string unchanged when pattern not found", () => {
	expect(pipe("hello", Str.replace("xyz", "abc"))).toBe("hello");
});

// ---------------------------------------------------------------------------
// replaceAll
// ---------------------------------------------------------------------------

test("replaceAll: replaces all occurrences of substring", () => {
	expect(pipe("foo foo foo", Str.replaceAll("foo", "bar"))).toBe("bar bar bar");
});

test("replaceAll: replaces all matches with global RegExp", () => {
	expect(pipe("aAbBaA", Str.replaceAll(/a/gi, "x"))).toBe("xxbBxx");
});

test("replaceAll: returns string unchanged when pattern not found", () => {
	expect(pipe("hello", Str.replaceAll("xyz", "abc"))).toBe("hello");
});

// ---------------------------------------------------------------------------
// isEmpty
// ---------------------------------------------------------------------------

test("is.empty: returns true for empty string", () => {
	expect(pipe("", Str.is.empty)).toBe(true);
});

test("is.empty: returns false for non-empty string", () => {
	expect(pipe("hi", Str.is.empty)).toBe(false);
});

test("is.empty: returns false for whitespace-only string", () => {
	expect(pipe("   ", Str.is.empty)).toBe(false);
});

// ---------------------------------------------------------------------------
// is.blank
// ---------------------------------------------------------------------------

test("is.blank: returns true for empty string", () => {
	expect(pipe("", Str.is.blank)).toBe(true);
});

test("is.blank: returns true for whitespace-only string", () => {
	expect(pipe("   ", Str.is.blank)).toBe(true);
});

test("is.blank: returns false for non-empty string", () => {
	expect(pipe("hi", Str.is.blank)).toBe(false);
});

// ---------------------------------------------------------------------------
// length
// ---------------------------------------------------------------------------

test("length: returns correct length", () => {
	expect(pipe("hello", Str.length)).toBe(5);
});

test("length: returns 0 for empty string", () => {
	expect(pipe("", Str.length)).toBe(0);
});

test("length: includes whitespace in count", () => {
	expect(pipe("a b c", Str.length)).toBe(5);
});

// ---------------------------------------------------------------------------
// slice
// ---------------------------------------------------------------------------

test("slice: slices with start and end indices", () => {
	expect(pipe("hello", Str.slice(1, 3))).toBe("el");
});

test("slice: slices with only start index", () => {
	expect(pipe("hello", Str.slice(2))).toBe("llo");
});

test("slice: handles negative start index", () => {
	expect(pipe("hello", Str.slice(-2))).toBe("lo");
});

test("slice: returns empty string when start exceeds length", () => {
	expect(pipe("hello", Str.slice(10))).toBe("");
});

// ---------------------------------------------------------------------------
// padStart
// ---------------------------------------------------------------------------

test("padStart: pads to specified length", () => {
	expect(pipe("5", Str.padStart(3, "0"))).toBe("005");
});

test("padStart: uses space as default fill", () => {
	expect(pipe("hi", Str.padStart(5))).toBe("   hi");
});

test("padStart: leaves string unchanged when already long enough", () => {
	expect(pipe("hello", Str.padStart(3, "0"))).toBe("hello");
});

test("padStart: pads with custom fill string", () => {
	expect(pipe("x", Str.padStart(5, "ab"))).toBe("ababx");
});

// ---------------------------------------------------------------------------
// padEnd
// ---------------------------------------------------------------------------

test("padEnd: pads to specified length", () => {
	expect(pipe("hi", Str.padEnd(5, "."))).toBe("hi...");
});

test("padEnd: uses space as default fill", () => {
	expect(pipe("hi", Str.padEnd(5))).toBe("hi   ");
});

test("padEnd: leaves string unchanged when already long enough", () => {
	expect(pipe("hello", Str.padEnd(3, "0"))).toBe("hello");
});

test("padEnd: pads with custom fill string", () => {
	expect(pipe("x", Str.padEnd(5, "ab"))).toBe("xabab");
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes trim split and toUpperCase transformations", () => {
	const result = pipe("  hello world  ", Str.trim, Str.split(" "), (words) => words.map(Str.toUpperCase));
	expect(result).toStrictEqual(["HELLO", "WORLD"]);
});

// ---------------------------------------------------------------------------
// match & test
// ---------------------------------------------------------------------------

test("match: returns Some with match array when regex matches", () => {
	const result = pipe("hello 42 world", Str.match(/\d+/));
	expect(pipe(result, Maybe.map((m) => m[0]))).toStrictEqual(Maybe.make.some("42"));
	expect(pipe(result, Maybe.map((m) => m.index))).toStrictEqual(Maybe.make.some(6));
});

test("match: returns None when regex does not match", () => {
	const result = pipe("hello world", Str.match(/\d+/));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("match: remains pure against stateful global RegExp", () => {
	const regex = /abc/g;
	const first = Str.match(regex)("abc");
	const second = Str.match(regex)("abc");
	expect(Maybe.is.some(first)).toBe(true);
	expect(Maybe.is.some(second)).toBe(true);
});

test("test: returns true for matching regex", () => {
	const result = pipe("user@example.com", Str.test(/^[^@]+@[^@]+$/));
	expect(result).toBe(true);
});

test("test: returns false for non-matching regex", () => {
	const result = pipe("invalid-email", Str.test(/^[^@]+@[^@]+$/));
	expect(result).toBe(false);
});

test("test: remains pure against stateful global RegExp", () => {
	const regex = /pattern/g;
	expect(Str.test(regex)("pattern")).toBe(true);
	expect(Str.test(regex)("pattern")).toBe(true);
});

// ---------------------------------------------------------------------------
// Str.NonEmpty
// ---------------------------------------------------------------------------

test("is.nonEmpty: returns true for non-empty string", () => {
	expect(Str.is.nonEmpty("hello")).toBe(true);
});

test("is.nonEmpty: returns false for empty string", () => {
	expect(Str.is.nonEmpty("")).toBe(false);
});

test("NonEmpty.from.string: returns Some for non-empty string", () => {
	const result = Str.NonEmpty.from.string("hello");
	if (result.kind !== "Some") {
		throw new Error("Expected Some");
	}
	expect(result.value).toBe("hello");
	expectTypeOf(result.value).toEqualTypeOf<Str.NonEmpty>();
});

test("NonEmpty.from.string: returns None for empty string", () => {
	const result = Str.NonEmpty.from.string("");
	expect(result.kind).toBe("None");
});

// --- uncapitalize ---

test("uncapitalize: lowercases first character", () => {
	expect(Str.uncapitalize("Hello")).toBe("hello");
	expect(Str.uncapitalize("")).toBe("");
});

// --- truncate ---

test("truncate: truncates strings exceeding length", () => {
	expect(pipe("Hello, world!", Str.truncate({ length: 8 }))).toBe("Hello...");
	expect(pipe("Hello", Str.truncate({ length: 10 }))).toBe("Hello");
	expect(pipe("Hello, world!", Str.truncate({ length: 8, suffix: "…" }))).toBe("Hello, …");
	expect(pipe("Hello, world!", Str.truncate({ length: 2 }))).toBe("..");
});
