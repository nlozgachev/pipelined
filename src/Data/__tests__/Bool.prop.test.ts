import fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Bool } from "../Bool.ts";

// ---------------------------------------------------------------------------
// Boolean Algebra Laws
// ---------------------------------------------------------------------------

test("not: satisfies double negation law", () => {
	fc.assert(fc.property(fc.boolean(), (a) => {
		expect(pipe(a, Bool.not, Bool.not)).toBe(a);
	}));
});

test("and: satisfies De Morgan laws with or", () => {
	fc.assert(fc.property(fc.boolean(), fc.boolean(), (a, b) => {
		// not (a and b) === (not a) or (not b)
		const notAnd = Bool.not(pipe(a, Bool.and(b)));
		const notAOrNotB = pipe(Bool.not(a), Bool.or(Bool.not(b)));
		expect(notAnd).toBe(notAOrNotB);

		// not (a or b) === (not a) and (not b)
		const notOr = Bool.not(pipe(a, Bool.or(b)));
		const notANotB = pipe(Bool.not(a), Bool.and(Bool.not(b)));
		expect(notOr).toBe(notANotB);
	}));
});

test("and: satisfies commutativity alongside or and xor", () => {
	fc.assert(fc.property(fc.boolean(), fc.boolean(), (a, b) => {
		expect(pipe(a, Bool.and(b))).toBe(pipe(b, Bool.and(a)));
		expect(pipe(a, Bool.or(b))).toBe(pipe(b, Bool.or(a)));
		expect(pipe(a, Bool.xor(b))).toBe(pipe(b, Bool.xor(a)));
	}));
});

test("and: satisfies associativity alongside or", () => {
	fc.assert(fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (a, b, c) => {
		const andLHS = pipe(a, Bool.and(b), Bool.and(c));
		const andRHS = pipe(a, Bool.and(pipe(b, Bool.and(c))));
		expect(andLHS).toBe(andRHS);

		const orLHS = pipe(a, Bool.or(b), Bool.or(c));
		const orRHS = pipe(a, Bool.or(pipe(b, Bool.or(c))));
		expect(orLHS).toBe(orRHS);
	}));
});

test("and: satisfies identity laws with or", () => {
	fc.assert(fc.property(fc.boolean(), (a) => {
		// a and true === a
		expect(pipe(a, Bool.and(true))).toBe(a);
		// a or false === a
		expect(pipe(a, Bool.or(false))).toBe(a);
	}));
});

test("and: satisfies idempotence laws with or", () => {
	fc.assert(fc.property(fc.boolean(), (a) => {
		// a and a === a
		expect(pipe(a, Bool.and(a))).toBe(a);
		// a or a === a
		expect(pipe(a, Bool.or(a))).toBe(a);
	}));
});

test("all: aggregates arrays consistently with any", () => {
	fc.assert(fc.property(fc.array(fc.boolean()), (bools) => {
		const expectedAll = bools.every(Boolean);
		const expectedAny = bools.some(Boolean);

		expect(Bool.all(bools)).toBe(expectedAll);
		expect(Bool.any(bools)).toBe(expectedAny);
	}));
});
