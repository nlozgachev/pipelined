import { describe, expectTypeOf, it } from "vitest";
import type { Result } from "../../Core/Result.ts";
import { Json } from "../Json.ts";

describe("Json type-level tests", () => {
	it("inspects parse and stringify return signatures", () => {
		expectTypeOf(Json.parse('{"a": 1}')).toEqualTypeOf<Result<SyntaxError, unknown>>();
		expectTypeOf(Json.parse<{ name: string; }>('{"name": "Alice"}')).toEqualTypeOf<
			Result<SyntaxError, { name: string; }>
		>();

		expectTypeOf(Json.stringify({ a: 1 })).toEqualTypeOf<Result<TypeError, string>>();
		expectTypeOf(Json.stringify({ a: 1 }, undefined, 2)).toEqualTypeOf<Result<TypeError, string>>();
	});

	it("rejects invalid input types", () => {
		// @ts-expect-error non-string cannot be parsed
		expectTypeOf(Json.parse(123)).toBeObject();
	});
});
