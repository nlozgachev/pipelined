import { expect, test } from "vitest";
import { Json } from "../Json.ts";

// --- parse ---

test("Json.parse returns Ok for valid JSON", () => {
	const result = Json.parse('{"a":1}');
	expect(result).toStrictEqual({ kind: "Ok", value: { a: 1 } });
});

test("Json.parse returns Err(SyntaxError) for invalid JSON", () => {
	const result = Json.parse("{invalid}");
	expect(result.kind).toBe("Err");
	expect(result.kind === "Err" ? result.error : undefined).toBeInstanceOf(SyntaxError);
});

// --- stringify ---

test("Json.stringify returns Ok for valid object", () => {
	const result = Json.stringify({ a: 1 });
	expect(result).toStrictEqual({ kind: "Ok", value: '{"a":1}' });
});

test("Json.stringify returns Err(TypeError) for circular references", () => {
	const circular: any = {};
	circular.self = circular;
	const result = Json.stringify(circular);
	expect(result.kind).toBe("Err");
	expect(result.kind === "Err" ? result.error : undefined).toBeInstanceOf(TypeError);
});

test("Json.stringify wraps non-TypeError exception into TypeError", () => {
	const badReplacer = () => {
		throw new Error("custom error");
	};
	const result = Json.stringify({ a: 1 }, badReplacer);
	expect(result.kind).toBe("Err");
	expect(result.kind === "Err" ? result.error : undefined).toBeInstanceOf(TypeError);
});
