import fc from "fast-check";
import { expect, test } from "vitest";
import { Str } from "../Str.ts";

// ---------------------------------------------------------------------------
// toUpperCase
// ---------------------------------------------------------------------------

test("toUpperCase: satisfies idempotence", () => {
	fc.assert(fc.property(fc.string(), (s) => {
		expect(Str.toUpperCase(Str.toUpperCase(s))).toBe(Str.toUpperCase(s));
	}));
});

test("toUpperCase: agrees with native String#toUpperCase", () => {
	fc.assert(fc.property(fc.string(), (s) => {
		expect(Str.toUpperCase(s)).toBe(s.toUpperCase());
	}));
});

// ---------------------------------------------------------------------------
// toLowerCase
// ---------------------------------------------------------------------------

test("toLowerCase: satisfies idempotence", () => {
	fc.assert(fc.property(fc.string(), (s) => {
		expect(Str.toLowerCase(Str.toLowerCase(s))).toBe(Str.toLowerCase(s));
	}));
});

test("toLowerCase: agrees with native String#toLowerCase", () => {
	fc.assert(fc.property(fc.string(), (s) => {
		expect(Str.toLowerCase(s)).toBe(s.toLowerCase());
	}));
});

// ---------------------------------------------------------------------------
// trim
// ---------------------------------------------------------------------------

test("trim: satisfies idempotence", () => {
	fc.assert(fc.property(fc.string(), (s) => {
		expect(Str.trim(Str.trim(s))).toBe(Str.trim(s));
	}));
});

test("trim: agrees with native String#trim", () => {
	fc.assert(fc.property(fc.string(), (s) => {
		expect(Str.trim(s)).toBe(s.trim());
	}));
});

// ---------------------------------------------------------------------------
// startsWith
// ---------------------------------------------------------------------------

test("startsWith: is reflexive", () => {
	fc.assert(fc.property(fc.string(), (s) => {
		expect(Str.startsWith(s)(s)).toBe(true);
	}));
});

test("startsWith: agrees with native String#startsWith", () => {
	fc.assert(fc.property(fc.string({ maxLength: 20 }), fc.string({ maxLength: 20 }), (prefix, s) => {
		expect(Str.startsWith(prefix)(s)).toBe(s.startsWith(prefix));
	}));
});

// ---------------------------------------------------------------------------
// endsWith
// ---------------------------------------------------------------------------

test("endsWith: is reflexive", () => {
	fc.assert(fc.property(fc.string(), (s) => {
		expect(Str.endsWith(s)(s)).toBe(true);
	}));
});

test("endsWith: agrees with native String#endsWith", () => {
	fc.assert(fc.property(fc.string({ maxLength: 20 }), fc.string({ maxLength: 20 }), (suffix, s) => {
		expect(Str.endsWith(suffix)(s)).toBe(s.endsWith(suffix));
	}));
});

// ---------------------------------------------------------------------------
// includes
// ---------------------------------------------------------------------------

test("includes: is reflexive", () => {
	fc.assert(fc.property(fc.string(), (s) => {
		expect(Str.includes(s)(s)).toBe(true);
	}));
});

test("includes: agrees with native String#includes", () => {
	fc.assert(fc.property(fc.string({ maxLength: 20 }), fc.string({ maxLength: 20 }), (sub, s) => {
		expect(Str.includes(sub)(s)).toBe(s.includes(sub));
	}));
});
