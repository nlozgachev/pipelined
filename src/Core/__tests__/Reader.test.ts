import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Reader } from "../Reader.ts";

type Config = { baseUrl: string; apiKey: string; timeout: number; };

const testConfig: Config = { baseUrl: "https://api.example.com", apiKey: "secret", timeout: 5000 };

// ---------------------------------------------------------------------------
// resolve
// ---------------------------------------------------------------------------

test("resolve: always returns value regardless of environment", () => {
	const reader = Reader.resolve<Config, number>(42);
	expect(reader(testConfig)).toBe(42);
});

test("resolve: ignores environment", () => {
	const reader = Reader.resolve<Config, string>("hello");
	expect(reader({ baseUrl: "x", apiKey: "y", timeout: 0 })).toBe("hello");
	expect(reader(testConfig)).toBe("hello");
});

// ---------------------------------------------------------------------------
// ask
// ---------------------------------------------------------------------------

test("ask: returns full environment", () => {
	const reader = Reader.ask<Config>();
	expect(reader(testConfig)).toStrictEqual(testConfig);
});

// ---------------------------------------------------------------------------
// asks
// ---------------------------------------------------------------------------

test("asks: projects value from environment", () => {
	const getBaseUrl = Reader.asks((c: Config) => c.baseUrl);
	expect(getBaseUrl(testConfig)).toBe("https://api.example.com");
});

test("asks: applies selector to environment", () => {
	const getTimeout = Reader.asks((c: Config) => c.timeout);
	expect(getTimeout(testConfig)).toBe(5000);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: transforms produced value", () => {
	const reader = pipe(Reader.asks((c: Config) => c.baseUrl), Reader.map((url) => url.toUpperCase()));
	expect(reader(testConfig)).toBe("HTTPS://API.EXAMPLE.COM");
});

test("map: can change value type", () => {
	const reader = pipe(Reader.asks((c: Config) => c.timeout), Reader.map((ms) => `${ms}ms`));
	expect(reader(testConfig)).toBe("5000ms");
});

test("map: still receives same environment", () => {
	let receivedEnv: Config | undefined;
	const reader = pipe(
		Reader.ask<Config>(),
		Reader.map((env) => {
			receivedEnv = env;
			return env.apiKey;
		}),
	);
	reader(testConfig);
	expect(receivedEnv).toStrictEqual(testConfig);
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("chain: sequences two readers sharing same environment", () => {
	const buildUrl = Reader.asks((c: Config) => `${c.baseUrl}/users`);
	const addAuth = (url: string): Reader<Config, string> => Reader.asks((c) => `${url}?key=${c.apiKey}`);

	const reader = pipe(buildUrl, Reader.chain(addAuth));
	expect(reader(testConfig)).toBe("https://api.example.com/users?key=secret");
});

test("chain: passes output of first reader to function", () => {
	const reader = pipe(Reader.resolve<Config, number>(10), Reader.chain((n) => Reader.resolve(n * 2)));
	expect(reader(testConfig)).toBe(20);
});

test("chain: threads environment through multiple steps", () => {
	const reader = pipe(
		Reader.asks((c: Config) => c.baseUrl),
		Reader.chain((url) => Reader.asks((c) => `${url}:${c.timeout}`)),
		Reader.chain((s) => Reader.resolve(s.length)),
	);
	// "https://api.example.com:5000".length === 29
	expect(reader(testConfig)).toBe("https://api.example.com:5000".length);
});

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

test("apply: applies function reader to value reader", () => {
	const add = (a: number) => (b: number) => a + b;
	const reader = pipe(
		Reader.resolve<Config, typeof add>(add),
		Reader.apply(Reader.asks((c) => c.timeout)),
		Reader.apply(Reader.resolve(500)),
	);
	expect(reader(testConfig)).toBe(5500);
});

test("apply: passes same environment to both readers", () => {
	const combine = (a: string) => (b: string) => `${a}/${b}`;
	const reader = pipe(
		Reader.resolve<Config, typeof combine>(combine),
		Reader.apply(Reader.asks((c) => c.baseUrl)),
		Reader.apply(Reader.asks((c) => c.apiKey)),
	);
	expect(reader(testConfig)).toBe("https://api.example.com/secret");
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("tap: executes side effect and returns original value", () => {
	let captured = "";
	const reader = pipe(
		Reader.asks((c: Config) => c.baseUrl),
		Reader.tap((url) => {
			captured = url;
		}),
	);
	const result = reader(testConfig);
	expect(result).toBe("https://api.example.com");
	expect(captured).toBe("https://api.example.com");
});

test("tap: does not alter produced value", () => {
	const reader = pipe(
		Reader.resolve<Config, number>(42),
		Reader.tap(() => {/* side effect */}),
		Reader.map((n) => n + 1),
	);
	expect(reader(testConfig)).toBe(43);
});

// ---------------------------------------------------------------------------
// local
// ---------------------------------------------------------------------------

test("local: adapts environment before passing to reader", () => {
	type AppEnv = { config: Config; debug: boolean; };

	const getBaseUrl: Reader<Config, string> = Reader.asks((c) => c.baseUrl);

	const fromAppEnv: Reader<AppEnv, string> = pipe(getBaseUrl, Reader.local((env: AppEnv) => env.config));

	const appEnv: AppEnv = { config: testConfig, debug: true };
	expect(fromAppEnv(appEnv)).toBe("https://api.example.com");
});

test("local: allows composing readers with different environments", () => {
	type DbEnv = { host: string; port: number; };
	type AppEnv = { db: DbEnv; name: string; };

	const getConnectionString: Reader<DbEnv, string> = Reader.asks((db) => `${db.host}:${db.port}`);

	const fromApp: Reader<AppEnv, string> = pipe(getConnectionString, Reader.local((env: AppEnv) => env.db));

	const appEnv: AppEnv = { db: { host: "localhost", port: 5432 }, name: "myapp" };
	expect(fromApp(appEnv)).toBe("localhost:5432");
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

test("run: executes reader with provided environment", () => {
	const reader = Reader.asks((c: Config) => c.apiKey);
	expect(Reader.run(testConfig)(reader)).toBe("secret");
});

test("run: works as data-last step in pipe", () => {
	const result = pipe(
		Reader.asks((c: Config) => c.baseUrl),
		Reader.map((url) => `${url}/health`),
		Reader.run(testConfig),
	);
	expect(result).toBe("https://api.example.com/health");
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes realistic URL-building pipeline", () => {
	const buildUrl = (path: string): Reader<Config, string> => Reader.asks((c) => `${c.baseUrl}${path}`);

	const addApiKey = (url: string): Reader<Config, string> => Reader.asks((c) => `${url}?key=${c.apiKey}`);

	const endpoint = pipe(buildUrl("/data"), Reader.chain(addApiKey), Reader.run(testConfig));

	expect(endpoint).toBe("https://api.example.com/data?key=secret");
});

test("chain: works with resolve to simulate map", () => {
	const doubled = pipe(Reader.asks((c: Config) => c.timeout), Reader.chain((n) => Reader.resolve(n * 2)));
	expect(doubled(testConfig)).toBe(10_000);
});

// --- bindTo ---

test("bindTo: wraps value in accumulator object", () => {
	const result = pipe(Reader.resolve<Config, number>(2), Reader.bindTo("a"))(testConfig);
	expect(result).toStrictEqual({ a: 2 });
});

// --- bind ---

test("bind: accumulates values key-by-key in pipeline", () => {
	const result = pipe(
		Reader.resolve<Config, number>(2),
		Reader.bindTo("a"),
		Reader.bind("b", ({ a }) => Reader.resolve(a * 3)),
		Reader.bind("c", ({ a, b }) => Reader.resolve(a + b)),
	)(testConfig);
	expect(result).toStrictEqual({ a: 2, b: 6, c: 8 });
});

// --- side-effect isolation ---

test("tap: executes side effect callback when reader is run", () => {
	let called = false;
	const reader = pipe(
		Reader.resolve<Config, number>(42),
		Reader.tap(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
	reader(testConfig);
	expect(called).toBe(true);
});

test("map: executes side effect callback when reader is run", () => {
	let called = false;
	const reader = pipe(
		Reader.resolve<Config, number>(10),
		Reader.map((n) => {
			called = true;
			return n * 2;
		}),
	);
	expect(called).toBe(false);
	reader(testConfig);
	expect(called).toBe(true);
});
