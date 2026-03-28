import fc from "fast-check";
import { expect, test } from "vitest";
import { Str } from "../Str.ts";

// ---------------------------------------------------------------------------
// toUpperCase
// ---------------------------------------------------------------------------

test("Str.toUpperCase — idempotence", () => {
	fc.assert(
		fc.property(fc.string(), (s) => {
			expect(Str.toUpperCase(Str.toUpperCase(s))).toBe(Str.toUpperCase(s));
		}),
	);
});

test("Str.toUpperCase — agrees with native", () => {
	fc.assert(
		fc.property(fc.string(), (s) => {
			expect(Str.toUpperCase(s)).toBe(s.toUpperCase());
		}),
	);
});

// ---------------------------------------------------------------------------
// toLowerCase
// ---------------------------------------------------------------------------

test("Str.toLowerCase — idempotence", () => {
	fc.assert(
		fc.property(fc.string(), (s) => {
			expect(Str.toLowerCase(Str.toLowerCase(s))).toBe(Str.toLowerCase(s));
		}),
	);
});

test("Str.toLowerCase — agrees with native", () => {
	fc.assert(
		fc.property(fc.string(), (s) => {
			expect(Str.toLowerCase(s)).toBe(s.toLowerCase());
		}),
	);
});

// ---------------------------------------------------------------------------
// trim
// ---------------------------------------------------------------------------

test("Str.trim — idempotence", () => {
	fc.assert(
		fc.property(fc.string(), (s) => {
			expect(Str.trim(Str.trim(s))).toBe(Str.trim(s));
		}),
	);
});

test("Str.trim — agrees with native", () => {
	fc.assert(
		fc.property(fc.string(), (s) => {
			expect(Str.trim(s)).toBe(s.trim());
		}),
	);
});

// ---------------------------------------------------------------------------
// startsWith
// ---------------------------------------------------------------------------

test("Str.startsWith — reflexive", () => {
	fc.assert(
		fc.property(fc.string(), (s) => {
			expect(Str.startsWith(s)(s)).toBe(true);
		}),
	);
});

test("Str.startsWith — agrees with native", () => {
	fc.assert(
		fc.property(fc.string({ maxLength: 20 }), fc.string({ maxLength: 20 }), (prefix, s) => {
			expect(Str.startsWith(prefix)(s)).toBe(s.startsWith(prefix));
		}),
	);
});

// ---------------------------------------------------------------------------
// endsWith
// ---------------------------------------------------------------------------

test("Str.endsWith — reflexive", () => {
	fc.assert(
		fc.property(fc.string(), (s) => {
			expect(Str.endsWith(s)(s)).toBe(true);
		}),
	);
});

test("Str.endsWith — agrees with native", () => {
	fc.assert(
		fc.property(fc.string({ maxLength: 20 }), fc.string({ maxLength: 20 }), (suffix, s) => {
			expect(Str.endsWith(suffix)(s)).toBe(s.endsWith(suffix));
		}),
	);
});

// ---------------------------------------------------------------------------
// includes
// ---------------------------------------------------------------------------

test("Str.includes — reflexive", () => {
	fc.assert(
		fc.property(fc.string(), (s) => {
			expect(Str.includes(s)(s)).toBe(true);
		}),
	);
});

test("Str.includes — agrees with native", () => {
	fc.assert(
		fc.property(fc.string({ maxLength: 20 }), fc.string({ maxLength: 20 }), (sub, s) => {
			expect(Str.includes(sub)(s)).toBe(s.includes(sub));
		}),
	);
});
