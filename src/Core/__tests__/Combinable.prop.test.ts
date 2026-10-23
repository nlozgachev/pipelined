import * as fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Combinable } from "../Combinable.ts";
import { Maybe } from "../Maybe.ts";

// ---------------------------------------------------------------------------
// Monoid Laws: Associativity, Left Identity, Right Identity
// ---------------------------------------------------------------------------

test("string: satisfies monoid laws", () => {
	const c = Combinable.string;

	fc.assert(fc.property(fc.string(), fc.string(), fc.string(), (a, b, d) => {
		// Associativity: combine(d)(combine(b)(a)) === combine(combine(d)(b))(a)
		expect(c.combine(d)(c.combine(b)(a))).toBe(c.combine(c.combine(d)(b))(a));
	}));

	fc.assert(fc.property(fc.string(), (a) => {
		expect(c.combine(a)(c.empty)).toBe(a);
		expect(c.combine(c.empty)(a)).toBe(a);
	}));
});

test("sum: satisfies monoid laws on integers", () => {
	const c = Combinable.sum;
	const arbInt = fc.integer({ min: -10000, max: 10000 });

	fc.assert(fc.property(arbInt, arbInt, arbInt, (a, b, d) => {
		expect(c.combine(d)(c.combine(b)(a))).toBe(c.combine(c.combine(d)(b))(a));
	}));

	fc.assert(fc.property(arbInt, (a) => {
		expect(c.combine(a)(c.empty)).toBe(a);
		expect(c.combine(c.empty)(a)).toBe(a);
	}));
});

test("product: satisfies monoid laws on integers", () => {
	const c = Combinable.product;
	const arbSmallInt = fc.integer({ min: -100, max: 100 });

	fc.assert(fc.property(arbSmallInt, arbSmallInt, arbSmallInt, (a, b, d) => {
		expect(c.combine(d)(c.combine(b)(a))).toBe(c.combine(c.combine(d)(b))(a));
	}));

	fc.assert(fc.property(arbSmallInt, (a) => {
		expect(c.combine(a)(c.empty)).toBe(a);
		expect(c.combine(c.empty)(a)).toBe(a);
	}));
});

test("all: satisfies monoid laws", () => {
	const c = Combinable.all;

	fc.assert(fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (a, b, d) => {
		expect(c.combine(d)(c.combine(b)(a))).toBe(c.combine(c.combine(d)(b))(a));
	}));

	fc.assert(fc.property(fc.boolean(), (a) => {
		expect(c.combine(a)(c.empty)).toBe(a);
		expect(c.combine(c.empty)(a)).toBe(a);
	}));
});

test("any: satisfies monoid laws", () => {
	const c = Combinable.any;

	fc.assert(fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (a, b, d) => {
		expect(c.combine(d)(c.combine(b)(a))).toBe(c.combine(c.combine(d)(b))(a));
	}));

	fc.assert(fc.property(fc.boolean(), (a) => {
		expect(c.combine(a)(c.empty)).toBe(a);
		expect(c.combine(c.empty)(a)).toBe(a);
	}));
});

test("array: satisfies monoid laws for arrays", () => {
	const c = Combinable.array<number>();
	const arbArray = fc.array(fc.integer());

	fc.assert(fc.property(arbArray, arbArray, arbArray, (a, b, d) => {
		expect(c.combine(d)(c.combine(b)(a))).toStrictEqual(c.combine(c.combine(d)(b))(a));
	}));

	fc.assert(fc.property(arbArray, (a) => {
		expect(c.combine(a)(c.empty)).toStrictEqual(a);
		expect(c.combine(c.empty)(a)).toStrictEqual(a);
	}));
});

test("maybe: satisfies monoid laws for lifted Combinables", () => {
	const c = Combinable.maybe(Combinable.sum);
	const arbMaybe: fc.Arbitrary<Maybe<number>> = fc.oneof(
		fc.integer({ min: -1000, max: 1000 }).map(Maybe.make.some),
		fc.constant(Maybe.make.none()),
	);

	fc.assert(fc.property(arbMaybe, arbMaybe, arbMaybe, (a, b, d) => {
		expect(c.combine(d)(c.combine(b)(a))).toStrictEqual(c.combine(c.combine(d)(b))(a));
	}));

	fc.assert(fc.property(arbMaybe, (a) => {
		expect(c.combine(a)(c.empty)).toStrictEqual(a);
		expect(c.combine(c.empty)(a)).toStrictEqual(a);
	}));
});

test("combineAll: satisfies homomorphism across list concatenation", () => {
	const arbInts = fc.array(fc.integer({ min: -100, max: 100 }));

	fc.assert(fc.property(arbInts, arbInts, (xs, ys) => {
		const sumAll = Combinable.combineAll(Combinable.sum);
		const combined = pipe([...xs, ...ys], sumAll);
		const separate = Combinable.sum.combine(sumAll(ys))(sumAll(xs));
		expect(combined).toBe(separate);
	}));
});

test("struct: satisfies monoid laws on structured records", () => {
	const stats = Combinable.struct({ count: Combinable.sum, label: Combinable.string });
	type Stats = { readonly count: number; readonly label: string; };

	const arbStats: fc.Arbitrary<Stats> = fc.tuple(fc.integer({ min: -1000, max: 1000 }), fc.string()).map((
		[count, label],
	) => ({ count, label }));

	fc.assert(fc.property(arbStats, arbStats, arbStats, (a, b, d) => {
		expect(stats.combine(d)(stats.combine(b)(a))).toStrictEqual(stats.combine(stats.combine(d)(b))(a));
	}));

	fc.assert(fc.property(arbStats, (a) => {
		expect(stats.combine(a)(stats.empty)).toStrictEqual(a);
		expect(stats.combine(stats.empty)(a)).toStrictEqual(a);
	}));
});
