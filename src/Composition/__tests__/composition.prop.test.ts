import fc from "fast-check";
import { expect, test } from "vitest";
import { curry, curry3 } from "../curry.ts";
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
		expect(curry(f)(a)(b)).toBe(f(a, b));
	}));
});

test("curry3: round-trips ternary function application", () => {
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
