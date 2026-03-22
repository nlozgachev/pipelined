import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Reader } from "../Reader.ts";

type Config = { baseUrl: string; apiKey: string; timeout: number; };

const testConfig: Config = {
	baseUrl: "https://api.example.com",
	apiKey: "secret",
	timeout: 5000,
};

// ---------------------------------------------------------------------------
// resolve
// ---------------------------------------------------------------------------

test("Reader.resolve always returns the value regardless of environment", () => {
	const reader = Reader.resolve<Config, number>(42);
	expect(reader(testConfig)).toBe(42);
});

test("Reader.resolve ignores the environment", () => {
	const reader = Reader.resolve<Config, string>("hello");
	expect(reader({ baseUrl: "x", apiKey: "y", timeout: 0 })).toBe("hello");
	expect(reader(testConfig)).toBe("hello");
});

// ---------------------------------------------------------------------------
// ask
// ---------------------------------------------------------------------------

test("Reader.ask returns the full environment", () => {
	const reader = Reader.ask<Config>();
	expect(reader(testConfig)).toEqual(testConfig);
});

// ---------------------------------------------------------------------------
// asks
// ---------------------------------------------------------------------------

test("Reader.asks projects a value from the environment", () => {
	const getBaseUrl = Reader.asks((c: Config) => c.baseUrl);
	expect(getBaseUrl(testConfig)).toBe("https://api.example.com");
});

test("Reader.asks applies the selector to the environment", () => {
	const getTimeout = Reader.asks((c: Config) => c.timeout);
	expect(getTimeout(testConfig)).toBe(5000);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Reader.map transforms the produced value", () => {
	const reader = pipe(
		Reader.asks((c: Config) => c.baseUrl),
		Reader.map((url) => url.toUpperCase()),
	);
	expect(reader(testConfig)).toBe("HTTPS://API.EXAMPLE.COM");
});

test("Reader.map can change the value type", () => {
	const reader = pipe(
		Reader.asks((c: Config) => c.timeout),
		Reader.map((ms) => `${ms}ms`),
	);
	expect(reader(testConfig)).toBe("5000ms");
});

test("Reader.map still receives the same environment", () => {
	let receivedEnv: Config | undefined;
	const reader = pipe(
		Reader.ask<Config>(),
		Reader.map((env) => {
			receivedEnv = env;
			return env.apiKey;
		}),
	);
	reader(testConfig);
	expect(receivedEnv).toEqual(testConfig);
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Reader.chain sequences two readers sharing the same environment", () => {
	const buildUrl = Reader.asks((c: Config) => `${c.baseUrl}/users`);
	const addAuth = (url: string): Reader<Config, string> => Reader.asks((c) => `${url}?key=${c.apiKey}`);

	const reader = pipe(buildUrl, Reader.chain(addAuth));
	expect(reader(testConfig)).toBe("https://api.example.com/users?key=secret");
});

test("Reader.chain passes the output of the first reader to the function", () => {
	const reader = pipe(
		Reader.resolve<Config, number>(10),
		Reader.chain((n) => Reader.resolve(n * 2)),
	);
	expect(reader(testConfig)).toBe(20);
});

test("Reader.chain threads the environment through multiple steps", () => {
	const reader = pipe(
		Reader.asks((c: Config) => c.baseUrl),
		Reader.chain((url) => Reader.asks((c) => `${url}:${c.timeout}`)),
		Reader.chain((s) => Reader.resolve(s.length)),
	);
	// "https://api.example.com:5000".length === 29
	expect(reader(testConfig)).toBe("https://api.example.com:5000".length);
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("Reader.ap applies a function reader to a value reader", () => {
	const add = (a: number) => (b: number) => a + b;
	const reader = pipe(
		Reader.resolve<Config, typeof add>(add),
		Reader.ap(Reader.asks((c) => c.timeout)),
		Reader.ap(Reader.resolve(500)),
	);
	expect(reader(testConfig)).toBe(5500);
});

test("Reader.ap both readers see the same environment", () => {
	const combine = (a: string) => (b: string) => `${a}/${b}`;
	const reader = pipe(
		Reader.resolve<Config, typeof combine>(combine),
		Reader.ap(Reader.asks((c) => c.baseUrl)),
		Reader.ap(Reader.asks((c) => c.apiKey)),
	);
	expect(reader(testConfig)).toBe("https://api.example.com/secret");
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("Reader.tap executes a side effect and returns the original value", () => {
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

test("Reader.tap does not alter the produced value", () => {
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

test("Reader.local adapts the environment before passing it to the reader", () => {
	type AppEnv = { config: Config; debug: boolean; };

	const getBaseUrl: Reader<Config, string> = Reader.asks((c) => c.baseUrl);

	const fromAppEnv: Reader<AppEnv, string> = pipe(
		getBaseUrl,
		Reader.local((env: AppEnv) => env.config),
	);

	const appEnv: AppEnv = { config: testConfig, debug: true };
	expect(fromAppEnv(appEnv)).toBe("https://api.example.com");
});

test("Reader.local allows composing readers with different environments", () => {
	type DbEnv = { host: string; port: number; };
	type AppEnv = { db: DbEnv; name: string; };

	const getConnectionString: Reader<DbEnv, string> = Reader.asks((db) => `${db.host}:${db.port}`);

	const fromApp: Reader<AppEnv, string> = pipe(
		getConnectionString,
		Reader.local((env: AppEnv) => env.db),
	);

	const appEnv: AppEnv = { db: { host: "localhost", port: 5432 }, name: "myapp" };
	expect(fromApp(appEnv)).toBe("localhost:5432");
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

test("Reader.run executes a reader with the provided environment", () => {
	const reader = Reader.asks((c: Config) => c.apiKey);
	expect(Reader.run(testConfig)(reader)).toBe("secret");
});

test("Reader.run works as a data-last step in pipe", () => {
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

test("Reader composes a realistic URL-building pipeline", () => {
	const buildUrl = (path: string): Reader<Config, string> => Reader.asks((c) => `${c.baseUrl}${path}`);

	const addApiKey = (url: string): Reader<Config, string> => Reader.asks((c) => `${url}?key=${c.apiKey}`);

	const endpoint = pipe(
		buildUrl("/data"),
		Reader.chain(addApiKey),
		Reader.run(testConfig),
	);

	expect(endpoint).toBe("https://api.example.com/data?key=secret");
});

test("Reader.resolve and Reader.chain work together like map", () => {
	const doubled = pipe(
		Reader.asks((c: Config) => c.timeout),
		Reader.chain((n) => Reader.resolve(n * 2)),
	);
	expect(doubled(testConfig)).toBe(10000);
});
