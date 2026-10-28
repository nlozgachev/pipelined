import * as fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Predicate } from "../Predicate.ts";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const arbPredicate = fc.func(fc.boolean()) as fc.Arbitrary<Predicate<number>>;

// ---------------------------------------------------------------------------
// Boolean Algebra Laws
// ---------------------------------------------------------------------------

test("Predicate: satisfies double negation (involution)", () => {
	fc.assert(fc.property(arbPredicate, fc.integer(), (p, x) => {
		expect(Predicate.not(Predicate.not(p))(x)).toBe(p(x));
	}));
});

test("Predicate: satisfies AND commutativity", () => {
	fc.assert(fc.property(arbPredicate, arbPredicate, fc.integer(), (p, q, x) => {
		expect(Predicate.and(q)(p)(x)).toBe(Predicate.and(p)(q)(x));
	}));
});

test("Predicate: satisfies OR commutativity", () => {
	fc.assert(fc.property(arbPredicate, arbPredicate, fc.integer(), (p, q, x) => {
		expect(Predicate.or(q)(p)(x)).toBe(Predicate.or(p)(q)(x));
	}));
});

test("Predicate: satisfies AND idempotence", () => {
	fc.assert(fc.property(arbPredicate, fc.integer(), (p, x) => {
		expect(Predicate.and(p)(p)(x)).toBe(p(x));
	}));
});

test("Predicate: satisfies OR idempotence", () => {
	fc.assert(fc.property(arbPredicate, fc.integer(), (p, x) => {
		expect(Predicate.or(p)(p)(x)).toBe(p(x));
	}));
});

test("Predicate: satisfies De Morgan's laws", () => {
	fc.assert(fc.property(arbPredicate, arbPredicate, fc.integer(), (p, q, x) => {
		// not(p and q) === not(p) or not(q)
		const notAnd = Predicate.not(Predicate.and(q)(p))(x);
		const orNots = Predicate.or(Predicate.not(q))(Predicate.not(p))(x);
		expect(notAnd).toBe(orNots);

		// not(p or q) === not(p) and not(q)
		const notOr = Predicate.not(Predicate.or(q)(p))(x);
		const andNots = Predicate.and(Predicate.not(q))(Predicate.not(p))(x);
		expect(notOr).toBe(andNots);
	}));
});

test("Predicate: all matches binary AND composition", () => {
	fc.assert(fc.property(arbPredicate, arbPredicate, fc.integer(), (p, q, x) => {
		expect(Predicate.all([p, q])(x)).toBe(Predicate.and(q)(p)(x));
	}));
});

test("Predicate: any matches binary OR composition", () => {
	fc.assert(fc.property(arbPredicate, arbPredicate, fc.integer(), (p, q, x) => {
		expect(Predicate.any([p, q])(x)).toBe(Predicate.or(q)(p)(x));
	}));
});

test("Predicate: using satisfies contravariant composition", () => {
	const f = (s: string) => s.length;
	const g = (n: number) => "a".repeat(Math.abs(n) % 50);

	fc.assert(fc.property(arbPredicate, fc.integer(), (p, n) => {
		const adapted = pipe(p, Predicate.using(f), Predicate.using(g));
		const direct = pipe(p, Predicate.using((val: number) => f(g(val))));
		expect(adapted(n)).toBe(direct(n));
	}));
});
