import * as fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Logged } from "../Logged.ts";

const arbLogged = fc.tuple(fc.integer(), fc.array(fc.string())).map(([value, log]) => Logged.make(value, log));

// ---------------------------------------------------------------------------
// Functor Laws
// ---------------------------------------------------------------------------

test("map: satisfies functor identity law", () => {
	fc.assert(fc.property(arbLogged, (logged) => {
		const mapped = pipe(logged, Logged.map((x) => x));
		expect(mapped).toStrictEqual(logged);
	}));
});

test("map: satisfies functor composition law", () => {
	fc.assert(fc.property(arbLogged, (logged) => {
		const f = (n: number) => n + 10;
		const g = (n: number) => n * 2;

		const left = pipe(logged, Logged.map(f), Logged.map(g));
		const right = pipe(logged, Logged.map((n) => g(f(n))));

		expect(left).toStrictEqual(right);
	}));
});

// ---------------------------------------------------------------------------
// Monad Laws
// ---------------------------------------------------------------------------

test("chain: satisfies monad left identity law", () => {
	fc.assert(fc.property(fc.integer(), (a) => {
		const f = (n: number) => Logged.make(`val: ${n}`, [`processed ${n}`]);

		const left = pipe(Logged.make(a), Logged.chain(f));
		const right = f(a);

		expect(left).toStrictEqual(right);
	}));
});

test("chain: satisfies monad right identity law", () => {
	fc.assert(fc.property(arbLogged, (logged) => {
		const chained = pipe(logged, Logged.chain((x) => Logged.make(x)));
		expect(chained).toStrictEqual(logged);
	}));
});

test("chain: satisfies monad associativity law", () => {
	fc.assert(fc.property(arbLogged, (logged) => {
		const f = (n: number) => Logged.make(n + 1, [`inc ${n}`]);
		const g = (n: number) => Logged.make(n * 2, [`double ${n}`]);

		const left = pipe(logged, Logged.chain(f), Logged.chain(g));
		const right = pipe(logged, Logged.chain((x) => pipe(f(x), Logged.chain(g))));

		expect(left).toStrictEqual(right);
	}));
});

// ---------------------------------------------------------------------------
// Applicative Laws
// ---------------------------------------------------------------------------

test("apply: satisfies applicative identity law", () => {
	fc.assert(fc.property(arbLogged, (logged) => {
		const id = Logged.make((x: number) => x);
		const applied = pipe(id, Logged.apply(logged));
		expect(applied).toStrictEqual(logged);
	}));
});

test("apply: satisfies applicative homomorphism law", () => {
	fc.assert(fc.property(fc.integer(), (x) => {
		const f = (n: number) => n + 42;
		const left = pipe(Logged.make(f), Logged.apply(Logged.make(x)));
		const right = Logged.make(f(x));
		expect(left).toStrictEqual(right);
	}));
});

// ---------------------------------------------------------------------------
// Log Monoid & Transformation Laws
// ---------------------------------------------------------------------------

test("chain: concatenates logs in strict FIFO order", () => {
	fc.assert(fc.property(arbLogged, fc.array(fc.string()), (logged, extraLogs) => {
		const chained = pipe(logged, Logged.chain((n) => Logged.make(n + 1, extraLogs)));
		expect(chained.log).toStrictEqual([...logged.log, ...extraLogs]);
	}));
});

test("mapLog: satisfies identity law", () => {
	fc.assert(fc.property(arbLogged, (logged) => {
		const mapped = pipe(logged, Logged.mapLog((entry) => entry));
		expect(mapped).toStrictEqual(logged);
	}));
});

test("mapLog: satisfies composition law", () => {
	fc.assert(fc.property(arbLogged, (logged) => {
		const f = (s: string) => `${s}!`;
		const g = (s: string) => `[${s}]`;

		const left = pipe(logged, Logged.mapLog(f), Logged.mapLog(g));
		const right = pipe(logged, Logged.mapLog((s) => g(f(s))));

		expect(left).toStrictEqual(right);
	}));
});
