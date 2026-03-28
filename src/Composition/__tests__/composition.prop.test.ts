import fc from "fast-check";
import { expect, test } from "vitest";
import { curry, curry3 } from "../curry.ts";
import { flow } from "../flow.ts";
import { memoize } from "../memoize.ts";
import { pipe } from "../pipe.ts";

// ---------------------------------------------------------------------------
// pipe
// ---------------------------------------------------------------------------

test("pipe — identity", () => {
	fc.assert(
		fc.property(fc.integer(), (x) => {
			expect(pipe(x)).toBe(x);
		}),
	);
});

test("pipe — single function", () => {
	fc.assert(
		fc.property(fc.integer(), fc.func<[number], number>(fc.integer()), (x, f) => {
			expect(pipe(x, f)).toBe(f(x));
		}),
	);
});

test("pipe — two functions", () => {
	fc.assert(
		fc.property(
			fc.integer(),
			fc.func<[number], number>(fc.integer()),
			fc.func<[number], number>(fc.integer()),
			(x, f, g) => {
				expect(pipe(x, f, g)).toBe(g(f(x)));
			},
		),
	);
});

test("pipe — three functions", () => {
	fc.assert(
		fc.property(
			fc.integer(),
			fc.func<[number], number>(fc.integer()),
			fc.func<[number], number>(fc.integer()),
			fc.func<[number], number>(fc.integer()),
			(x, f, g, h) => {
				expect(pipe(x, f, g, h)).toBe(h(g(f(x))));
			},
		),
	);
});

// ---------------------------------------------------------------------------
// flow
// ---------------------------------------------------------------------------

test("flow — single function", () => {
	fc.assert(
		fc.property(fc.integer(), fc.func<[number], number>(fc.integer()), (x, f) => {
			expect(flow(f)(x)).toBe(f(x));
		}),
	);
});

test("flow — two functions", () => {
	fc.assert(
		fc.property(
			fc.integer(),
			fc.func<[number], number>(fc.integer()),
			fc.func<[number], number>(fc.integer()),
			(x, f, g) => {
				expect(flow(f, g)(x)).toBe(g(f(x)));
			},
		),
	);
});

test("pipe + flow — equivalence", () => {
	fc.assert(
		fc.property(
			fc.integer(),
			fc.func<[number], number>(fc.integer()),
			fc.func<[number], number>(fc.integer()),
			(x, f, g) => {
				expect(pipe(x, f, g)).toBe(flow(f, g)(x));
			},
		),
	);
});

// ---------------------------------------------------------------------------
// curry
// ---------------------------------------------------------------------------

test("curry — round-trip", () => {
	fc.assert(
		fc.property(
			fc.integer(),
			fc.integer(),
			fc.func<[number, number], number>(fc.integer()),
			(a, b, f) => {
				expect(curry(f)(a)(b)).toBe(f(a, b));
			},
		),
	);
});

test("curry3 — round-trip", () => {
	fc.assert(
		fc.property(
			fc.integer(),
			fc.integer(),
			fc.integer(),
			fc.func<[number, number, number], number>(fc.integer()),
			(a, b, c, f) => {
				expect(curry3(f)(a)(b)(c)).toBe(f(a, b, c));
			},
		),
	);
});

// ---------------------------------------------------------------------------
// memoize
// ---------------------------------------------------------------------------

test("memoize — correctness", () => {
	fc.assert(
		fc.property(fc.integer(), fc.func<[number], number>(fc.integer()), (x, f) => {
			expect(memoize(f)(x)).toBe(f(x));
		}),
	);
});

test("memoize — determinism", () => {
	fc.assert(
		fc.property(fc.integer(), fc.func<[number], number>(fc.integer()), (x, f) => {
			const m = memoize(f);
			expect(m(x)).toBe(m(x));
		}),
	);
});
