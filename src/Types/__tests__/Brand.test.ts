import { expect, test } from "vitest";
import { Brand } from "../Brand.ts";

// ---------------------------------------------------------------------------
// wrap
// ---------------------------------------------------------------------------

test("Brand.wrap constructor returns the value unchanged at runtime", () => {
	const toUserId = Brand.wrap<"UserId", string>();
	const id = toUserId("user-123");
	expect(id).toBe("user-123");
});

test("Brand.wrap works with number type", () => {
	const toPositive = Brand.wrap<"Positive", number>();
	expect(toPositive(42)).toBe(42);
});

test("Brand.wrap works with string type alias", () => {
	const toValidEmail = Brand.wrap<"ValidEmail", string>();
	const email = toValidEmail("user@example.com");
	expect(email).toBe("user@example.com");
});

test("Brand.wrap can produce multiple distinct branded values", () => {
	const toUserId = Brand.wrap<"UserId", string>();
	const id1 = toUserId("u-1");
	const id2 = toUserId("u-2");
	expect(id1).toBe("u-1");
	expect(id2).toBe("u-2");
});

test("Brand.wrap returned constructor is reusable", () => {
	const toScore = Brand.wrap<"Score", number>();
	const scores = [1, 2, 3].map(toScore);
	expect(scores).toEqual([1, 2, 3]);
});

// ---------------------------------------------------------------------------
// unwrap
// ---------------------------------------------------------------------------

test("Brand.unwrap returns the underlying value", () => {
	const toUserId = Brand.wrap<"UserId", string>();
	const id = toUserId("user-42");
	const raw = Brand.unwrap(id);
	expect(raw).toBe("user-42");
});

test("Brand.unwrap round-trips with wrap", () => {
	const toScore = Brand.wrap<"Score", number>();
	const score = toScore(100);
	expect(Brand.unwrap(score)).toBe(100);
});

// ---------------------------------------------------------------------------
// type-level behaviour (runtime identity)
// ---------------------------------------------------------------------------

test("branded value is strictly equal to the raw value at runtime", () => {
	const toId = Brand.wrap<"Id", string>();
	const id = toId("abc");
	expect(id).toBe("abc");
});

test("two separately branded values with same underlying value are equal", () => {
	const toUserId = Brand.wrap<"UserId", string>();
	const toProductId = Brand.wrap<"ProductId", string>();
	const uid = toUserId("shared");
	const pid = toProductId("shared");
	// At runtime brands are erased — both are just the string "shared"
	expect(uid).toBe(pid as unknown as typeof uid);
});
