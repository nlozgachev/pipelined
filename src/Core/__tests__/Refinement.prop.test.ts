import * as fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Refinement } from "../Refinement.ts";
import { Result } from "../Result.ts";

// ---------------------------------------------------------------------------
// Helpers & Types
// ---------------------------------------------------------------------------

type BrandA = number & { readonly _brandA: true; };
type BrandB = BrandA & { readonly _brandB: true; };
type BrandC = BrandB & { readonly _brandC: true; };

const arbPredicate = fc.func(fc.boolean()) as fc.Arbitrary<(n: number) => boolean>;

// ---------------------------------------------------------------------------
// Composition & Algebra Laws
// ---------------------------------------------------------------------------

test("Refinement: compose satisfies associativity", () => {
	fc.assert(fc.property(arbPredicate, arbPredicate, arbPredicate, fc.integer(), (p1, p2, p3, x) => {
		const r1: Refinement<number, BrandA> = Refinement.from.Predicate(p1);
		const r2: Refinement<BrandA, BrandB> = Refinement.from.Predicate(p2);
		const r3: Refinement<BrandB, BrandC> = Refinement.from.Predicate(p3);

		const left = pipe(r1, Refinement.compose(r2), Refinement.compose(r3));
		const right = pipe(r1, Refinement.compose(pipe(r2, Refinement.compose(r3))));

		expect(left(x)).toBe(right(x));
	}));
});

test("Refinement: and satisfies commutativity", () => {
	fc.assert(fc.property(arbPredicate, arbPredicate, fc.integer(), (p1, p2, x) => {
		const r1: Refinement<number, BrandA> = Refinement.from.Predicate(p1);
		const r2: Refinement<number, BrandB> = Refinement.from.Predicate(p2);

		const r1AndR2 = pipe(r1, Refinement.and(r2));
		const r2AndR1 = pipe(r2, Refinement.and(r1));

		expect(r1AndR2(x)).toBe(r2AndR1(x));
	}));
});

test("Refinement: and satisfies idempotence", () => {
	fc.assert(fc.property(arbPredicate, fc.integer(), (p, x) => {
		const r: Refinement<number, BrandA> = Refinement.from.Predicate(p);
		const rAndR = pipe(r, Refinement.and(r));

		expect(rAndR(x)).toBe(r(x));
	}));
});

// ---------------------------------------------------------------------------
// Container Converter Consistency
// ---------------------------------------------------------------------------

test("Refinement: to.Maybe matches predicate truth value", () => {
	fc.assert(fc.property(arbPredicate, fc.integer(), (p, x) => {
		const r: Refinement<number, BrandA> = Refinement.from.Predicate(p);
		const maybeVal = Refinement.to.Maybe(r)(x);
		const expected = p(x) ? Maybe.make.some(x) : Maybe.make.none();

		expect(maybeVal).toStrictEqual(expected);
	}));
});

test("Refinement: to.Result matches predicate truth value", () => {
	fc.assert(fc.property(arbPredicate, fc.integer(), (p, x) => {
		const r: Refinement<number, BrandA> = Refinement.from.Predicate(p);
		const resultVal = Refinement.to.Result(r, () => "failure")(x);
		const expected = p(x) ? Result.make.ok(x) : Result.make.err("failure");

		expect(resultVal).toStrictEqual(expected);
	}));
});

test("Refinement: to.Predicate preserves runtime boolean outcome", () => {
	fc.assert(fc.property(arbPredicate, fc.integer(), (p, x) => {
		const r: Refinement<number, BrandA> = Refinement.from.Predicate(p);
		const pred = Refinement.to.Predicate(r);

		expect(pred(x)).toBe(r(x));
	}));
});
