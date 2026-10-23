import fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Reader } from "../Reader.ts";

test("map: satisfies functor identity law", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (env, value) => {
		const r: Reader<string, number> = () => value;
		const mapped = pipe(r, Reader.map((x) => x));
		expect(mapped(env)).toBe(r(env));
	}));
});

test("map: satisfies functor composition law", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (env, value) => {
		const f = (n: number) => n + 10;
		const g = (n: number) => n * 2;
		const r: Reader<string, number> = () => value;

		const left = pipe(r, Reader.map(f), Reader.map(g));
		const right = pipe(r, Reader.map((x) => g(f(x))));

		expect(left(env)).toBe(right(env));
	}));
});

test("chain: satisfies monad left identity", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (env, a) => {
		const f = (n: number): Reader<string, number> => (e) => n + e.length;
		const left = pipe(Reader.make<string, number>(a), Reader.chain(f));
		const right = f(a);

		expect(left(env)).toBe(right(env));
	}));
});

test("chain: satisfies monad right identity", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (env, a) => {
		const r: Reader<string, number> = (e) => a + e.length;
		const chained = pipe(r, Reader.chain((x) => Reader.make<string, number>(x)));

		expect(chained(env)).toBe(r(env));
	}));
});

test("chain: satisfies monad associativity", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (env, a) => {
		const r: Reader<string, number> = (e) => a + e.length;
		const f = (n: number): Reader<string, number> => (e) => n * 2 + e.length;
		const g = (n: number): Reader<string, string> => (e) => `${e}:${n}`;

		const left = pipe(r, Reader.chain(f), Reader.chain(g));
		const right = pipe(r, Reader.chain((x) => pipe(f(x), Reader.chain(g))));

		expect(left(env)).toBe(right(env));
	}));
});

test("ask: returns the supplied environment directly", () => {
	fc.assert(fc.property(fc.string(), (env) => {
		const r = Reader.ask<string>();
		expect(r(env)).toBe(env);
	}));
});

test("local: transforms environment before running reader", () => {
	fc.assert(fc.property(fc.string(), fc.integer(), (prefix, num) => {
		type BigEnv = { prefix: string; num: number; };
		const r: Reader<string, number> = (s) => s.length;
		const adapted = pipe(r, Reader.local((env: BigEnv) => `${env.prefix}:${env.num}`));

		expect(adapted({ prefix, num })).toBe(`${prefix}:${num}`.length);
	}));
});
