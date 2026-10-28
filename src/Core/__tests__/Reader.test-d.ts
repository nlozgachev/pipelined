import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Reader } from "../Reader.ts";

test("make & ask: constructs fundamental reader operations", () => {
	const pure = Reader.make<{ db: string; }, number>(42);
	expectTypeOf(pure).toEqualTypeOf<Reader<{ db: string; }, number>>();

	const askEnv = Reader.ask<{ config: string; }>();
	expectTypeOf(askEnv).toEqualTypeOf<Reader<{ config: string; }, { config: string; }>>();
});

test("map: transforms produced value and preserves environment", () => {
	type Env = { apiKey: string; };
	const r: Reader<Env, number> = (env) => env.apiKey.length;

	const mapped = pipe(r, Reader.map((len) => len > 0));
	expectTypeOf(mapped).toEqualTypeOf<Reader<Env, boolean>>();
});

test("chain: sequences readers and combines environments via intersection", () => {
	type Env1 = { db: string; };
	type Env2 = { logger: string; };

	const r1: Reader<Env1, number> = (env) => env.db.length;
	const r2 = (len: number): Reader<Env2, string> => (env) => `${env.logger}:${len}`;

	const chained = pipe(r1, Reader.chain(r2));
	expectTypeOf(chained).toEqualTypeOf<Reader<Env1 & Env2, string>>();
});

test("apply: applies wrapped function and combines environments via intersection", () => {
	type Env1 = { db: string; };
	type Env2 = { logger: string; };

	const fnReader: Reader<Env1, (n: number) => string> = (env) => (n) => `${env.db}:${n}`;
	const argReader: Reader<Env2, number> = (env) => env.logger.length;

	const applied = pipe(fnReader, Reader.apply(argReader));
	expectTypeOf(applied).toEqualTypeOf<Reader<Env1 & Env2, string>>();
});

test("tap: executes side effect on value without altering reader types", () => {
	type Env = { apiKey: string; };
	const r: Reader<Env, number> = (env) => env.apiKey.length;

	const tapped = pipe(
		r,
		Reader.tap((len) => {
			expectTypeOf(len).toEqualTypeOf<number>();
		}),
	);
	expectTypeOf(tapped).toEqualTypeOf<Reader<Env, number>>();
});

test("local: widens environment by transforming input environment", () => {
	type SmallEnv = { baseUrl: string; };
	type BigEnv = { baseUrl: string; timeout: number; };

	const r: Reader<SmallEnv, string> = (c) => c.baseUrl;
	const adapted = pipe(r, Reader.local((env: BigEnv) => ({ baseUrl: env.baseUrl })));
	expectTypeOf(adapted).toEqualTypeOf<Reader<BigEnv, string>>();
});

test("run: executes reader by providing required environment", () => {
	type Env = { port: number; };
	const r: Reader<Env, string> = (c) => `localhost:${c.port}`;

	const result = pipe(r, Reader.run({ port: 8080 }));
	expectTypeOf(result).toEqualTypeOf<string>();
});

test("assign & assignTo: accumulates record fields across readers", () => {
	type Env1 = { db: string; };
	type Env2 = { port: number; };

	const bound = pipe(
		Reader.make<Env1, string>("initial"),
		Reader.assignTo("dbValue"),
		Reader.assign("portNumber", () => Reader.make<Env2, number>(8080)),
	);
	expectTypeOf(bound).toEqualTypeOf<Reader<Env1 & Env2, { dbValue: string; } & { portNumber: number; }>>();
});

test("negative: enforces environment and argument constraints at compile time", () => {
	type Env = { port: number; };
	const r: Reader<Env, string> = (c) => `localhost:${c.port}`;

	// @ts-expect-error missing required port property in environment
	expectTypeOf(pipe(r, Reader.run({}))).toBeString();

	// @ts-expect-error incompatible environment property type
	expectTypeOf(pipe(r, Reader.run({ port: "8080" }))).toBeString();

	type SmallEnv = { baseUrl: string; };
	const rSmall: Reader<SmallEnv, string> = (c) => c.baseUrl;
	// @ts-expect-error local transform does not satisfy required SmallEnv structure
	expectTypeOf(pipe(rSmall, Reader.local((_env: { other: number; }) => ({ wrong: "url" })))).toBeFunction();

	const numReader: Reader<Env, number> = (c) => c.port;
	// @ts-expect-error apply expects Reader of function on piped data, but received Reader<Env, string>
	expectTypeOf(pipe(r, Reader.apply(numReader))).toBeFunction();
});
