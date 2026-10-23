import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Result } from "../../Core/Result.ts";
import { Json } from "../Json.ts";

describe("Json property-based tests", () => {
	it("satisfies round-trip law for arbitrary JSON-compatible values", () => {
		expect(() =>
			fc.assert(fc.property(fc.jsonValue(), (val) => {
				const strResult = Json.stringify(val);
				if (!Result.is.ok(strResult)) {
					return false;
				}
				const parseResult = Json.parse(strResult.value);
				if (!Result.is.ok(parseResult)) {
					return false;
				}
				const expected = JSON.parse(JSON.stringify(val));
				const reStr = Json.stringify(parseResult.value);
				return (JSON.stringify(parseResult.value) === JSON.stringify(expected)
					&& Result.is.ok(reStr)
					&& reStr.value === strResult.value);
			}))
		).not.toThrow();
	});

	it("always returns Err(SyntaxError) for random non-JSON strings", () => {
		expect(() =>
			fc.assert(fc.property(fc.string(), (str) => {
				const result = Json.parse(str);
				if (Result.is.err(result)) {
					return result.error instanceof SyntaxError;
				}
				const reStr = Json.stringify(result.value);
				return Result.is.ok(reStr);
			}))
		).not.toThrow();
	});
});
