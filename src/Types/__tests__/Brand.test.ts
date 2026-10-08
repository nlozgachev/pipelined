import { expect, test } from "vitest";
import { Brand } from "../Brand.ts";

// ---------------------------------------------------------------------------
// wrap
// ---------------------------------------------------------------------------

test("wrap: returns value unchanged at runtime", () => {
	const toUserId = Brand.wrap<"UserId", string>();
	const id = toUserId("user-123");
	expect(id).toBe("user-123");
});

test("wrap: brands number values", () => {
	const toPositive = Brand.wrap<"Positive", number>();
	expect(toPositive(42)).toBe(42);
});

test("wrap: brands string values", () => {
	const toValidEmail = Brand.wrap<"ValidEmail", string>();
	const email = toValidEmail("user@example.com");
	expect(email).toBe("user@example.com");
});

test("wrap: produces distinct branded values independently", () => {
	const toUserId = Brand.wrap<"UserId", string>();
	const id1 = toUserId("u-1");
	const id2 = toUserId("u-2");
	expect(id1).toBe("u-1");
	expect(id2).toBe("u-2");
});

test("wrap: returned constructor is reusable", () => {
	const toScore = Brand.wrap<"Score", number>();
	const scores = [1, 2, 3].map(toScore);
	expect(scores).toStrictEqual([1, 2, 3]);
});

// ---------------------------------------------------------------------------
// unwrap
// ---------------------------------------------------------------------------

test("unwrap: extracts underlying value", () => {
	const toUserId = Brand.wrap<"UserId", string>();
	const id = toUserId("user-42");
	const raw = Brand.unwrap(id);
	expect(raw).toBe("user-42");
});

test("unwrap: round-trips with wrap", () => {
	const toScore = Brand.wrap<"Score", number>();
	const score = toScore(100);
	expect(Brand.unwrap(score)).toBe(100);
});

// ---------------------------------------------------------------------------
// type-level behaviour (runtime identity)
// ---------------------------------------------------------------------------

test("runtime: preserves strict equality with raw value", () => {
	const toId = Brand.wrap<"Id", string>();
	const id = toId("abc");
	expect(id).toBe("abc");
});

test("runtime: treats distinct brands of same value as strictly equal", () => {
	const toUserId = Brand.wrap<"UserId", string>();
	const toProductId = Brand.wrap<"ProductId", string>();
	const uid = toUserId("shared");
	const pid = toProductId("shared");
	// At runtime brands are erased — both are just the string "shared"
	expect(uid).toBe(pid as unknown as typeof uid);
});
