import { describe, expectTypeOf, it } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import type { Maybe } from "../../Core/Maybe.ts";
import { Str } from "../Str.ts";

describe("Str type-level tests", () => {
	it("inspects predicates and type guards", () => {
		const raw: string = "hello";
		expectTypeOf(Str.is.empty(raw)).toEqualTypeOf<boolean>();
		expectTypeOf(Str.is.blank(raw)).toEqualTypeOf<boolean>();

		if (Str.is.nonEmpty(raw)) {
			expectTypeOf(raw).toEqualTypeOf<Str.NonEmpty>();
		}
	});

	it("inspects string manipulation combinators", () => {
		expectTypeOf(pipe("a,b,c", Str.split(","))).toEqualTypeOf<readonly string[]>();
		expectTypeOf(pipe("hello", Str.trim)).toEqualTypeOf<string>();
		expectTypeOf(pipe("hello", Str.includes("ll"))).toEqualTypeOf<boolean>();
		expectTypeOf(pipe("hello", Str.replace("l", "w"))).toEqualTypeOf<string>();
		expectTypeOf(pipe("hello", Str.replaceAll("l", "w"))).toEqualTypeOf<string>();
		expectTypeOf(pipe("hello", Str.startsWith("h"))).toEqualTypeOf<boolean>();
		expectTypeOf(pipe("hello", Str.endsWith("o"))).toEqualTypeOf<boolean>();
		expectTypeOf(pipe("hello", Str.toUpperCase)).toEqualTypeOf<string>();
		expectTypeOf(pipe("hello", Str.toLowerCase)).toEqualTypeOf<string>();
		expectTypeOf(pipe("hello", Str.capitalize)).toEqualTypeOf<string>();
		expectTypeOf(pipe("hello", Str.uncapitalize)).toEqualTypeOf<string>();
		expectTypeOf(Str.lines("a\nb")).toEqualTypeOf<readonly string[]>();
		expectTypeOf(Str.words("a b c")).toEqualTypeOf<readonly string[]>();
		expectTypeOf(pipe("hello", Str.size)).toEqualTypeOf<number>();
		expectTypeOf(pipe("hello", Str.graphemeSize)).toEqualTypeOf<number>();
		expectTypeOf(pipe("hello", Str.slice(1, 3))).toEqualTypeOf<string>();
		expectTypeOf(pipe("hello", Str.padStart(10, " "))).toEqualTypeOf<string>();
		expectTypeOf(pipe("hello", Str.padEnd(10, " "))).toEqualTypeOf<string>();
		expectTypeOf(pipe("hello", Str.truncate({ length: 3 }))).toEqualTypeOf<string>();
	});

	it("inspects regex and parsing combinators", () => {
		expectTypeOf(Str.parse.int("42")).toEqualTypeOf<Maybe<number>>();
		expectTypeOf(Str.parse.float("3.14")).toEqualTypeOf<Maybe<number>>();
		expectTypeOf(pipe("hello", Str.match(/l+/))).toEqualTypeOf<Maybe<RegExpMatchArray>>();
		expectTypeOf(pipe("hello", Str.test(/l+/))).toEqualTypeOf<boolean>();
		expectTypeOf(Str.NonEmpty.from.string("hello")).toEqualTypeOf<Maybe<Str.NonEmpty>>();
	});

	it("rejects invalid input types", () => {
		// @ts-expect-error non-string cannot be trimmed
		expectTypeOf(Str.trim(123)).toBeString();

		// @ts-expect-error non-string cannot be checked with is.empty
		expectTypeOf(Str.is.empty(false)).toBeBoolean();

		// @ts-expect-error non-string cannot be checked with is.nonEmpty
		expectTypeOf(Str.is.nonEmpty(null)).toBeBoolean();

		// @ts-expect-error non-string passed to split
		expectTypeOf(pipe(123, Str.split(","))).toBeObject();
	});
});
