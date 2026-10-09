import fc from "fast-check";
import { expect, test } from "vitest";
import { curry } from "../curry.ts";
import { flow } from "../flow.ts";
import { memoize } from "../memoize.ts";
import { pipe } from "../pipe.ts";

// ---------------------------------------------------------------------------
// pipe
// ---------------------------------------------------------------------------

test("pipe: preserves identity on raw values", () => {
	fc.assert(fc.property(fc.integer(), (x) => {
		expect(pipe(x)).toBe(x);
	}));
});

test("pipe: applies single function transformation", () => {
	fc.assert(fc.property(fc.integer(), fc.func<[number], number>(fc.integer()), (x, f) => {
		expect(pipe(x, f)).toBe(f(x));
	}));
});

test("pipe: composes two functions in order", () => {
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

test("pipe: composes three functions in order", () => {
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

test("flow: evaluates single function", () => {
	fc.assert(fc.property(fc.integer(), fc.func<[number], number>(fc.integer()), (x, f) => {
		expect(flow(f)(x)).toBe(f(x));
	}));
});

test("flow: composes two functions in order", () => {
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

test("flow: evaluates equivalently to pipe", () => {
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

test("curry: round-trips binary function application", () => {
	fc.assert(fc.property(fc.integer(), fc.integer(), fc.func<[number, number], number>(fc.integer()), (a, b, f) => {
		const binary = (x: number, y: number) => f(x, y);
		expect(curry(binary)(a)(b)).toBe(f(a, b));
	}));
});

test("curry: round-trips ternary function application", () => {
	fc.assert(
		fc.property(
			fc.integer(),
			fc.integer(),
			fc.integer(),
			fc.func<[number, number, number], number>(fc.integer()),
			(a, b, c, f) => {
				const ternary = (x: number, y: number, z: number) => f(x, y, z);
				expect(curry(ternary)(a)(b)(c)).toBe(f(a, b, c));
			},
		),
	);
});

test("curry: round-trips quaternary function application", () => {
	fc.assert(
		fc.property(
			fc.integer(),
			fc.integer(),
			fc.integer(),
			fc.integer(),
			fc.func<[number, number, number, number], number>(fc.integer()),
			(a, b, c, d, f) => {
				const quaternary = (w: number, x: number, y: number, z: number) => f(w, x, y, z);
				expect(curry(quaternary)(a)(b)(c)(d)).toBe(f(a, b, c, d));
			},
		),
	);
});

// ---------------------------------------------------------------------------
// memoize
// ---------------------------------------------------------------------------

test("memoize: preserves function correctness", () => {
	fc.assert(fc.property(fc.integer(), fc.func<[number], number>(fc.integer()), (x, f) => {
		expect(memoize(f)(x)).toBe(f(x));
	}));
});

test("memoize: satisfies determinism across repeated calls", () => {
	fc.assert(fc.property(fc.integer(), fc.func<[number], number>(fc.integer()), (x, f) => {
		const m = memoize(f);
		expect(m(x)).toBe(m(x));
	}));
});
