import fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { State } from "../State.ts";

test("map: satisfies functor identity law", () => {
	fc.assert(fc.property(fc.integer(), fc.string(), (init, value) => {
		const st = State.make<number, string>(value);
		const mapped = pipe(st, State.map((x) => x));
		expect(State.run(init)(mapped)).toStrictEqual(State.run(init)(st));
	}));
});

test("map: satisfies functor composition law", () => {
	fc.assert(fc.property(fc.integer(), fc.integer(), (init, value) => {
		const f = (n: number) => n + 3;
		const g = (n: number) => n * 2;
		const st = State.make<number, number>(value);

		const left = pipe(st, State.map(f), State.map(g));
		const right = pipe(st, State.map((x) => g(f(x))));

		expect(State.run(init)(left)).toStrictEqual(State.run(init)(right));
	}));
});

test("chain: satisfies monad left identity", () => {
	fc.assert(fc.property(fc.integer(), fc.string(), (init, a) => {
		const f = (s: string) => State.make<number, number>(s.length);
		const left = pipe(State.make<number, string>(a), State.chain(f));
		const right = f(a);

		expect(State.run(init)(left)).toStrictEqual(State.run(init)(right));
	}));
});

test("chain: satisfies monad right identity", () => {
	fc.assert(fc.property(fc.integer(), fc.string(), (init, a) => {
		const st = State.make<number, string>(a);
		const chained = pipe(st, State.chain((x) => State.make<number, string>(x)));

		expect(State.run(init)(chained)).toStrictEqual(State.run(init)(st));
	}));
});

test("chain: satisfies monad associativity", () => {
	fc.assert(fc.property(fc.integer(), fc.integer(), (init, a) => {
		const f = (n: number) => State.modify<number>((s) => s + n);
		const g = () => State.get<number>();
		const st = State.make<number, number>(a);

		const left = pipe(st, State.chain(f), State.chain(g));
		const right = pipe(st, State.chain((x) => pipe(f(x), State.chain(g))));

		expect(State.run(init)(left)).toStrictEqual(State.run(init)(right));
	}));
});

test("put: put then get returns the put state", () => {
	fc.assert(fc.property(fc.integer(), fc.integer(), (init, s) => {
		const op = pipe(State.put<number>(s), State.chain(() => State.get<number>()));
		expect(State.run(init)(op)).toStrictEqual([s, s]);
	}));
});

test("get: get then put leaves state unchanged", () => {
	fc.assert(fc.property(fc.integer(), (init) => {
		const op = pipe(State.get<number>(), State.chain((s) => State.put<number>(s)));
		expect(State.run(init)(op)).toStrictEqual([undefined, init]);
	}));
});

test("put: put then put overrides previous put", () => {
	fc.assert(fc.property(fc.integer(), fc.integer(), fc.integer(), (init, s1, s2) => {
		const op = pipe(State.put<number>(s1), State.chain(() => State.put<number>(s2)));
		expect(State.run(init)(op)).toStrictEqual([undefined, s2]);
	}));
});
